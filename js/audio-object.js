(function(window) {
	"use strict";

	if (!window.AudioContext) { return; }

	var assign = Object.assign;

	// defineAudioProperty()
	// defineAudioProperties()

	var automatorMap = new WeakMap();

	var defaults = {
	    	duration: 0.008
	    };

	var features = {};

	var ramps = {
	    	'step': stepRamp,
	    	'linear': linearRamp,
	    	'exponential': exponentialRamp
	    };

	var map = Function.prototype.call.bind(Array.prototype.map);

	var minExponentialValue = 1.4013e-45;

	function noop() {}

	function toType(object) {
		return typeof object;
	}

	function isDefined(value) {
		return value !== undefined && value !== null;
	}

	function overloadByType(signatures, returnFlag) {
		return function method() {
			var signature = map(arguments, toType).join(' ');
			var fn = signatures[signature] || signatures.default;

			if (!fn) { throw new Error('overload: Function for type signature "' + signature + '" not found, and no default defined.'); }

			var result = fn.apply(this, arguments);
			return returnFlag ? this : result ;
		};
	}

	function isAudioContext(object) {
		return window.AudioContext && window.AudioContext.prototype.isPrototypeOf(object);
	}

	function isAudioNode(object) {
		return window.AudioNode && window.AudioNode.prototype.isPrototypeOf(object);
	}

	function isAudioParam(object) {
		return window.AudioParam && window.AudioParam.prototype.isPrototypeOf(object);
	}

	function testDisconnectParameters() {
		var audio = new AudioContext();

		try {
			// This will error if disconnect(parameters) is
			// supported.
			audio.createGain().disconnect(audio.destination);
			return false;
		} catch (error) { 
			return true;  
		}
	}

	function registerAutomator(object, name, fn) {
		var automators = automatorMap.get(object) || (automatorMap.set(object, {}));
		automators[name] = fn;
	}

	function stepRamp(param, n, time, duration) {
		param.setValueAtTime(n, time);
	}

	function linearRamp(param, n, time, duration) {
		param.setValueAtTime(param.value, time);
		param.linearRampToValueAtTime(n, time + duration);
	}

	function exponentialRamp(param, n, time, duration) {
		param.setValueAtTime(param.value, time);

		if (n < 0) {
			throw new Error('AudioObject: Cannot automate negative values via an exponential curve.');
		}

		if (n < minExponentialValue) {
			// minExponentialValue is orders of magnitude lower than a single
			// quantization step, so for all practical purposes we can safely
			// set it to 0 immediately at the end of the exponential ramp.
			param.exponentialRampToValueAtTime(minExponentialValue, time + duration);
			param.setValueAtTime(n, time + duration);
		}
		else {
			param.exponentialRampToValueAtTime(n, time + duration);
		}
	}

	function rampToValue(param, value, time, duration, curve) {
		// Curve defaults to 'step' where a duration is 0 or not defined, and
		// otherwise to 'linear'.
		curve = duration === 0 || duration === undefined ? 'step' : curve || 'linear' ;
		param.cancelScheduledValues(time);
		ramps[curve](param, value, time, duration);
	}

	function defineAudioProperty(object, name, audio, data) {
		var param = isAudioParam(data) ? data : data.param ;

		if (param ? !isAudioParam(param) : (!data.set || !data.get)) {
			throw new Error(
				'AudioObject.defineAudioProperty requires EITHER data.param to be an AudioParam' + 
				'OR both data.set and data.get to be defined as functions.'
			);
		}

		var set = param ?
		    	function set(value, time, duration, curve) {
		    		rampToValue(param, value, time, duration, curve);
		    	} :
		    	data.set.bind(object) ;

		var get = param ?
		    	function get() { return param.value; } :
		    	data.get.bind(object) ;

		var value = get();

		var message = {
		    	type: 'update',
		    	name: name
		    };

		function update(val) {
			// Set the old value of the message to the current value before
			// updating the value.
			message.oldValue = value;
			value = val;

			// Update the observe message and send it.
			if (Object.getNotifier) {
				Object.getNotifier(object).notify(message);
			}
		}

		function frame() {
			// Stop updating if value has reached param value
			if (value === get()) { return; }

			// Castrate the calls to automate the value, then call the setter
			// with the param's current value. Done like this, where the setter
			// has been redefined externally it nonetheless gets called with
			// automated values.
			var _automate = automate;

			automate = noop;
			object[name] = get();
			automate = _automate;

			window.requestAnimationFrame(frame);
		}

		function automate(value, duration, curve) {
			set(value, audio.currentTime, duration || data.duration || defaults.duration, curve || data.curve);
			window.requestAnimationFrame(frame);
		}

		registerAutomator(object, name, automate);

		Object.defineProperty(object, name, {
			// Return value because we want values that have just been set
			// to be immediately reflected by get, to be coherent.
			get: function() { return value; },

			set: function(val) {
				// Create a new notify message and update the value.
				update(val);
				automate(val);
			},

			enumerable: isDefined(data.enumerable) ? data.enumerable : true,
			configurable: isDefined(data.configurable) ? data.configurable : true
		});

		return object;
	}

	function defineAudioProperties(object, audio, data) {
		// Define params as getters/setters
		var name;

		for (name in data) {
			AudioObject.defineAudioProperty(object, name, audio, data[name]);
		}

		return object;
	}



	// AudioObject()

	var inputs = new WeakMap();
	var outputs = new WeakMap();
	var connectionsMap = new WeakMap();

	function getInput(object, name) {
		var map = inputs.get(object);
		return map && map[isDefined(name) ? name : 'default'];
	}

	function getOutput(object, name) {
		var map = outputs.get(object);
		return map && map[isDefined(name) ? name : 'default'];
	}

	function getConnections(object) {
		return connectionsMap.get(object);
	}

	function setConnection(source, outName, outNumber, inNode, inNumber) {
		var connections = getConnections(source);
		var outMap = connections[outName] || (connections[outName] = new Map());
		var numberMap = outMap.get(inNode);
		var tempMap = {};

		tempMap[outNumber || 0] = inNumber || 0;

		if (numberMap) {
			assign(numberMap, tempMap);
		}
		else {
			outMap.set(inNode, tempMap);
		}
	}

	function removeConnection(source, outName, outNumber, inNode, inNumber) {
		var connections = getConnections(source);
		var outMap = connections[outName];

		if (!outMap) {
			console.warn('AudioObject: .disconnect() There are no connections from "' + outName + '". Doing nothing.');
			return;
		}

		if (!inNode) {
			outMap.clear();
			return;
		}

		var numberMap = outMap.get(inNode);

		if (!numberMap) {
			console.warn('AudioObject: .disconnect() Not connected to inNode.');
			return;
		}

		outNumber = outNumber || 0;

		if (isDefined(outNumber)) {
			delete numberMap[outNumber];
		}

		if (Object.keys(numberMap).length === 0) {
			outMap.delete(inNode);
		}
	}

	function disconnectDestination(source, outName, outNode, inNode, outNumber, inNumber) {
		outNode.disconnect();

		if (!inNode) { return; }

		var connections = getConnections(source);
		var outMap = connections[outName];
		var entry;

		if (!outMap) { return; }

		// Reconnect all entries apart from the node we just
		// disconnected.
		for (entry of outMap) {
			if (entry[0] === inNode) { continue; }
			// TODO: connect outNumber to inNumber based on
			// entry[1].
			outNode.connect(entry[0]);
		}
	}

	function getInNode(object, name) {
		return isAudioNode(object) ? object : getInput(object, name) ;
	}

	function connect(source, outName, outNumber, destination, inName, inNumber) {
		// Support both AudioObjects and native AudioNodes.
		var inNode = getInNode(destination, inName);

		if (!inNode) {
			console.warn('AudioObject: trying to .connect() an object without input "' + inName + '". Dropping connection.', destination);
			return;
		}

		var outNode = getOutput(source, outName);

		if (!outNode) {
			console.warn('AudioObject: trying to .connect() from an object without output "' + outName + '". Dropping connection.', source);
			return;
		}

		if (isDefined(outNumber) && isDefined(inNumber)) {
			if (outNumber >= outNode.numberOfOutputs) {
				console.warn('AudioObject: Trying to .connect() from a non-existent output (' +
					outNumber + ') on output node {numberOfOutputs: ' + outNode.numberOfOutputs + '}. Dropping connection.');
				return;
			}

			if (inNumber >= inNode.numberOfInputs) {
				console.warn('AudioObject: Trying to .connect() to a non-existent input (' +
					inNumber + ') on input node {numberOfInputs: ' + inNode.numberOfInputs + '}. Dropping connection.');
				return;
			}

			outNode.connect(inNode, outNumber, inNumber);
			setConnection(source, outName, outNumber, inNode, inNumber);
		}
		else {
			outNode.connect(inNode);
			setConnection(source, outName, 0, inNode);
		}
	}

	function disconnect(source, outName, outNumber, destination, inName, inNumber) {
		var outNode = getOutput(source, outName);

		if (!outNode) {
			console.warn('AudioObject: trying to .disconnect() from an object without output "' + outName + '". Dropping connection.', source);
			return;
		}

		if (!destination) {
			outNode.disconnect();
			removeConnection(source, outName);
			return;
		}

		var inNode = destination && getInNode(destination, inName);

		if (!inNode) {
			console.warn('AudioObject: trying to .disconnect() an object with no inputs.', destination);
			return;
		}

		if (features.disconnectParameters) {
			outNode.disconnect(inNode, outNumber, inNumber);
		}
		else {
			disconnectDestination(source, outName, outNode, inNode, outNumber, inNumber);
		}

		removeConnection(source, outName, outNumber, inNode, inNumber);
	}

	function isAudioObject(object) {
		return prototype.isPrototypeOf(object);
	}

	function AudioObject(audio, input, output, params) {
		if (this === undefined || this === window || this.connect !== prototype.connect) {
			// If this is undefined the constructor has been called without the
			// new keyword, or without a context applied. Do that now.
			return new AudioObject(audio, input, output, params);
		}

		if (!(input || output)) {
			throw new Error('AudioObject: new AudioObject() must be given an input OR output OR both.');
		}

		// Keep a map of inputs in AudioObject.inputs
		if (input) {
			inputs.set(this, isAudioNode(input) ?
				{ default: input } :
				assign({}, input)
			);
		}

		// Keep a map of outputs in AudioObject.outputs
		if (output) {
			outputs.set(this, isAudioNode(output) ?
				{ default: output } :
				assign({}, output)
			);

			connectionsMap.set(this, {});
		}
		else {
			this.connect = this.disconnect = noop;
		}

		// Define Audio Params as getters/setters
		if (params) {
			AudioObject.defineAudioProperties(this, audio, params);
		}

		Object.defineProperty(this, 'context', { value: audio });
	}

	var prototype = {
		automate: function(name, value, time, curve) {
			var automators = automatorMap.get(this);

			if (!automators) {
				// Only properties that have been registered
				// by defineAudioProperty() can be automated.
				throw new Error('AudioObject: property ' + name + ' is not automatable.');
				return;
			}

			var fn = automators[name];

			if (!fn) {
				// Only properties that have been registered
				// by defineAudioProperty() can be automated.
				throw new Error('AudioObject: property ' + name + ' is not automatable.');
				return;
			}

			fn(value, time, curve);
			return this;
		},

		// Like AudioNode.connect(), but accepts parameters for output name
		// and input name.

		connect: overloadByType({
			'object': function run() {
				connect(this, 'default', undefined, arguments[0], 'default');
			},
			'object string': function run() {
				connect(this, 'default', undefined, arguments[0], arguments[1]);
			},
			'object string number': function run() {
				connect(this, 'default', undefined, arguments[0], arguments[1], arguments[2]);
			},
			'object number': function run() {
				connect(this, 'default', arguments[1], arguments[0], 'default');
			},
			'object number number': function run() {
				connect(this, 'default', arguments[1], arguments[0], 'default', arguments[2]);
			},
			'string object': function run() {
				connect(this, arguments[0], undefined, arguments[1], 'default');
			},
			'string object number': function run() {
				connect(this, arguments[0], undefined, arguments[1], 'default', arguments[2]);
			},
			'string object string': function run() {
				connect(this, arguments[0], undefined, arguments[1], arguments[2]);
			},
			'string object string number': function run() {
				connect(this, arguments[0], undefined, arguments[1], arguments[2], arguments[3]);
			},
			default: function run(outName, outNumber, destination, inName, inNumber) {
				connect(this, outName, outNumber, destination, inName, inNumber);
			}
		}, true),

		// Like AudioNode.disconnect(), but accepts parameters for output name
		// and input name.

		// In a nutshell, the AudioNode spec boils down to:
		// .disconnect([AudioNode || AudioParam], [outNumber], [inNumber])
		// All parameters are optional, although some combinations are
		// not supported. Here's those that are:
		//
		// .disconnect()
		// .disconnect(output)
		// .disconnect(AudioNode, output)
		// .disconnect(AudioNode, output, input)
		// .disconnect(AudioParam)
		// .disconnect(AudioParam, output)

		disconnect: overloadByType({
			'': function run() {
				disconnect(this, 'default');
			},
			'object': function run() {
				disconnect(this, 'default', undefined, arguments[0], 'default');
			},
			'object string': function run() {
				disconnect(this, 'default', undefined, arguments[0], arguments[1]);
			},
			'object string number': function run() {
				disconnect(this, 'default', undefined, arguments[0], arguments[1], arguments[2]);
			},
			'object number': function run() {
				disconnect(this, 'default', arguments[1], arguments[0], 'default');
			},
			'object number number': function run() {
				disconnect(this, 'default', arguments[1], arguments[0], 'default', arguments[2]);
			},
			'string object': function run() {
				disconnect(this, arguments[0], undefined, arguments[1], 'default');
			},
			'string object number': function run() {
				disconnect(this, arguments[0], undefined, arguments[1], 'default', arguments[2]);
			},
			'string object string': function run() {
				disconnect(this, arguments[0], undefined, arguments[1], arguments[2], arguments[3]);
			},
			'string object string number': function run() {
				disconnect(this, arguments[0], undefined, arguments[1], arguments[2], arguments[3]);
			},
			default: function run(outName, outNumber, destination, inName, inNumber) {
				disconnect(this, outName, outNumber, destination, inName, inNumber);
			}
		}, true),

		destroy: noop
	};

	// Extend AudioObject.prototype
	assign(AudioObject.prototype, prototype);

	// Feature tests
	features.disconnectParameters = testDisconnectParameters();

	AudioObject.inputs = getInput;
	AudioObject.outputs = getOutput;
	AudioObject.connections = getConnections;
	AudioObject.automate = rampToValue;
	AudioObject.features = features;
	AudioObject.defineAudioProperty = defineAudioProperty;
	AudioObject.defineAudioProperties = defineAudioProperties;
	AudioObject.isAudioObject = isAudioObject;

	window.AudioObject = AudioObject;
})(window);
