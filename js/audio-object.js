(function(window) {
	if (!window.console || !window.console.log) { return; }

	console.log('AudioObject');
	console.log('http://github.com/soundio/audio-object');
	//console.log('A wrapper for Web Audio sub-graphs');
	console.log('______________________________________');
})(window);

(function(window) {
	"use strict";

	if (!window.AudioContext) { return; }

	// Import
	
	var Fn     = window.Fn;
	var assign = Object.assign;


	// Define

	var automatorMap = new WeakMap();

	var defaults = {
	    	duration: 0.008,
	    	curve: 'linear'
	    };

	var features = {};

	var map = Function.prototype.call.bind(Array.prototype.map);

	var minExponentialValue = 1.4013e-45;


	// Functions

	var noop      = Fn.noop;
	var isDefined = Fn.isDefined;

	function fetch(url) {
		return new Promise(function(accept, reject) {
			var request = new XMLHttpRequest();
			request.open('GET', url, true);
			request.responseType = 'arraybuffer';
			request.onload = function() { accept(request.response); };
			request.onerror = function() { reject(request.response); };
			request.send();
		});
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

	function isAudioObject(object) {
		return AudioObject.prototype.isPrototypeOf(object);
	}

	function registerAutomator(object, name, fn) {
		var automators = automatorMap.get(object);

		if (!automators) {
			automators = {};
			automatorMap.set(object, automators);
		}

		automators[name] = fn;
	}


	// Feature tests

	function testDisconnectParameters() {
		var audio = new AudioContext();

		try {
			// This will error if disconnect(parameters) is supported
			// because it is not connected to audio destination.
			audio.createGain().disconnect(audio.destination);
			return false;
		} catch (error) {
			return true;
		}
	}


	// Maths

	var methods = {
		"step":        "setValueAtTime",
		"linear":      "linearRampToValueAtTime",
		"exponential": "exponentialRampToValueAtTime",
		"target":      "setTargetAtTime"
	};

	var curves = {
		// Automation curves as described at:
		// http://webaudio.github.io/web-audio-api/#h4_methods-3

		'step': function stepValueAtTime(value1, value2, time1, time2, time) {
			return time < time2 ? value1 : value2 ;
		},

		'linear': function linearValueAtTime(value1, value2, time1, time2, time) {
			return value1 + (value2 - value1) * (time - time1) / (time2 - time1) ;
		},

		'exponential': function exponentialValueAtTime(value1, value2, time1, time2, time) {
			return value1 * Math.pow(value2 / value1, (time - time1) / (time2 - time1)) ;
		},

		'target': function targetValueAtTime(value1, value2, time1, time2, time, duration) {
			return time < time2 ?
				value1 :
				value2 + (value1 - value2) * Math.pow(Math.E, -(time - time2) / duration);
		}
	};

	function getValueBetweenEvents(events, n, time) {
		var event1 = events[n];
		var event2 = events[n + 1];
		var time1  = event1[0];
		var time2  = event2[0];
		var value1 = event1[1];
		var value2 = event2[1];
		var curve  = event2[2];
		var duration = event2[3];

		return curves[curve](value1, value2, time1, time2, time, duration);
	}

	function getValueAtEvent(events, n, time) {
		if (events[n][2] === "target") {
			return curves.target(getValueAtEvent(events, n - 1, events[n][0]), events[n][1], 0, events[n][0], time, events[n][3]);
		}
		else {
			return events[n][1];
		}
	}

	function getEventsValueAtTime(events, time) {
		var n = events.length;

		while (events[--n] && events[n][0] >= time);

		var event1 = events[n];
		var event2 = events[n + 1];

		if (!event2) {
			return getValueAtEvent(events, n, time) ;
		}

		if (event2[0] === time) {
			// Spool through to find last event at this time
			while (events[++n] && events[n][0] === time);
			return getValueAtEvent(events, --n, time) ;
		}

		if (time < event2[0]) {
			return event2[2] === "linear" || event2[2] === "exponential" ?
				getValueBetweenEvents(events, n, time) :
				getValueAtEvent(events, n, time) ;
		}
	}

	function getParamValueAtTime(param, time) {
		var events = param['audio-object-events'];

		if (!events || events.length === 0) {
			return param.value;
		}

		return getEventsValueAtTime(events, time);
	}

	function getParamEvents(param) {
		// I would love to use a WeakMap to store data about
		// AudioParams, but FF refuses to allow that. I'm
		// going to use an expando, against my better
		// judgement, but let's come back to this problem.
		var events = param['audio-object-events'];

		if (!events) {
			events = [[0, param.value]];
			param['audio-object-events'] = events;
		}

		return events;
	}

	function truncateParamEvents(param, events, time) {
		var n = events.length;

		while (events[--n] && events[n][0] >= time);

		var event = events[n + 1];

		if (!event) {
			if (events[n]) {
				var value = getValueAtEvent(events, n, time);
				automateParamEvents(param, events, time, value, "step");
			}

			return;
		}

		param.cancelScheduledValues(time);

		if (event[0] === time) {
			events.splice(n + 1);

			// Reschedule lopped curve
			if (curve === "linear" || curve === "exponential") {
				automateParamEvents(param, events, time, event[1], event[2], event[3]);
			}

			return;
		}

		if (event[0] > time) {
			var curve = event[2];
			var value = getEventsValueAtTime(events, time);

			events.splice(n + 1);

			// Schedule intermediate point on the curve
			if (curve === "linear" || curve === "exponential") {
				automateParamEvents(param, events, time, value, curve);
			}
			else if (events[n] && events[n][2] === "target") {
				automateParamEvents(param, events, time, value, "step");
			}

			return;
		}
	}

	function automateParamEvents(param, events, time, value, curve, duration) {
		curve = curve || "step";
//console.log('automateParamEvents', events, time, value, curve, duration);
		var n = events.length;

		while (events[--n] && events[n][0] >= time);

		var event1 = events[n];
		var event2 = events[n + 1];

		// Swap exponential to- or from- 0 values for step
		// curves, which is what they tend towards for low
		// values. This does not deal with -ve values,
		// however. It probably should.
		if (curve === "exponential") {
			if (value < minExponentialValue) {
				time = event1 && event1[0] || 0 ;
				curve = "step";
			}
			else if (event1 && event1[1] < minExponentialValue) {
				curve = "step";
			}
		}

		duration = curve === "step" ? 0 : duration ;

		var event = [time, value, curve, duration];
		var method = methods[curve];

		// Automate the param

//console.log('AUTOMATE', value, time, duration)

		param[method](value, time, duration);

		// If the new event is at the end of the events list
		if (!event2) {
			events.push(event);
			return;
		}

		// If the new event is at the same time as an
		// existing event spool forward through events at
		// this time and if an event with the same curve is
		// found, replace it
		if (event2[0] === time) {
			while (events[++n] && events[n][0] === time) {
				if (events[n][2] === curve) {
					events.splice(n + 1, 1, event);
					return;
				}
			}

			--n;
		}

		// The new event is between event1 and event2
		events.splice(n + 1, 0, event);
	}

	function automateParam(param, time, value, curve, duration) {
		var events = getParamEvents(param);
		automateParamEvents(param, events, time, value, curve, duration);
	}


	// AudioProperty

	function defineAudioProperty(object, name, audio, data) {
		var param = isAudioParam(data) ? data : data.param ;

		if (param ? !isAudioParam(param) : !data.set) {
			throw new Error(
				'AudioObject.defineAudioProperty requires EITHER data.param to be an AudioParam' +
				'OR data.set to be defined as a function.'
			);
		}

		var defaultDuration = isDefined(data.duration) ? data.duration : defaults.duration ;
		var defaultCurve = data.curve || defaults.curve ;
		var value = param ? param.value : data.value || 0 ;
		var events = param ? getParamEvents(param) : [[0, value]];
		var message = {
		    	type: 'update',
		    	name: name
		    };

		function set(value, time, curve, duration) {
			//var value1 = getEventsValueAtTime(events, time);
			var value2 = value;
			//var time1  = time;
			var time2  = time + duration;

			curve = duration ?
				curve === "decay" ? "target" :
					curve || defaultCurve :
					'step' ;

			if (param) {
				automateParamEvents(param, events, time2, value2, curve, duration);
			}
			else {
				data.set.apply(object, arguments);
				events.push([time2, value2, curve, duration]);
			}
		}

		function update(v) {
			// Set the old value of the message to the current value before
			// updating the value.
			message.oldValue = value;
			value = v;

			// Update the observe message and send it.
			if (Object.getNotifier) {
				Object.getNotifier(object).notify(message);
			}
		}

		function frame() {
			var currentValue = getEventsValueAtTime(events, audio.currentTime);

			// Stop updating if value has reached param value
			if (value === currentValue) { return; }

			// Castrate the calls to automate the value, then call the setter
			// with the param's current value. Done like this, where the setter
			// has been redefined externally it nonetheless gets called with
			// automated values.
			var _automate = automate;
			automate = noop;

			// Set the property. This is what causes observers to be called.
			object[name] = currentValue;
			automate = _automate;
			window.requestAnimationFrame(frame);
		}

		function automate(value, time, curve, duration) {
			time     = isDefined(time) ? time : audio.currentTime;
			duration = isDefined(duration) ? duration : defaultDuration;

			set(value, time, curve || data.curve, duration);
			window.requestAnimationFrame(frame);
		}

		registerAutomator(object, name, automate);

		Object.defineProperty(object, name, {
			// Return value because we want values that have just been set
			// to be immediately reflected by get, even if they are being
			// quickly automated.
			get: function() { return value; },

			set: function(val) {
				// If automate is not set to noop this will launch an
				// automation.
				automate(val);

				// Create a new notify message and update the value.
				update(val);
			},

			enumerable: isDefined(data.enumerable) ? data.enumerable : true,
			configurable: isDefined(data.configurable) ? data.configurable : true
		});

		return object;
	}

	function defineAudioProperties(object, audio, data) {
		var name;

		for (name in data) {
			AudioObject.defineAudioProperty(object, name, audio, data[name]);
		}

		return object;
	}


	// AudioObject

	var inputs = new WeakMap();
	var outputs = new WeakMap();

	function defineInputs(object, properties) {
		var map = inputs.get(object);

		if (!map) {
			map = {};
			inputs.set(object, map);
		}

		assign(map, properties);
	}

	function defineOutputs(object, properties) {
		var map = outputs.get(object);

		if (!map) {
			map = {};
			outputs.set(object, map);
		}

		assign(map, properties);
	}

	function getInput(object, name) {
		var map = inputs.get(object);
		return map && map[isDefined(name) ? name : 'default'];
	}

	function getOutput(object, name) {
		var map = outputs.get(object);
		return map && map[isDefined(name) ? name : 'default'];
	}

	function AudioObject(audio, input, output, params) {
		if (this === undefined || this === window) {
			// If this is undefined the constructor has been called without the
			// new keyword, or without a context applied. Do that now.
			return new AudioObject(audio, input, output, params);
		}

		if (!(input || output)) {
			throw new Error('AudioObject: new AudioObject() must be given an input OR output OR both.');
		}

		// Keep a map of inputs in AudioObject.inputs. Where we're using
		// AudioObject as a mixin, extend the inputs object if it already
		// exists.
		if (input) {
			var inputs1 = isAudioNode(input) ? { default: input } : input ;
			var inputs2 = inputs.get(this);

			if (inputs2) {
				assign(inputs2, inputs1);
			}
			else {
				inputs.set(this, assign({}, inputs1));
			}
		}

		// Keep a map of outputs in AudioObject.outputs. Where we're using
		// AudioObject as a mixin, extend the inputs object if it already
		// exists.
		if (output) {
			var outputs1 = isAudioNode(output) ? { default: output } : output ;
			var outputs2 = outputs.get(this);

			if (outputs2) {
				assign(outputs2, outputs1);
			}
			else {
				outputs.set(this, assign({}, outputs1));
			}
		}

		// Define Audio Params as getters/setters
		if (params) {
			AudioObject.defineAudioProperties(this, audio, params);
		}

		Object.defineProperty(this, 'audio', { value: audio });
	}

	assign(AudioObject.prototype, {
		schedule: function() {
			var n = -1;
			var l = arguments.length;
			while (++n < l) { scheduleEvent(this, arguments[n]); }
			return this;
		},

		automate: function(name, value, time, curve, duration) {
			var automators = automatorMap.get(this);

			if (!automators) {
				// Only properties that have been registered
				// by defineAudioProperty() can be automated.
				throw new Error('AudioObject: property "' + name + '" is not automatable.');
				return;
			}

			var fn = automators[name];

			if (!fn) {
				// Only properties that have been registered
				// by defineAudioProperty() can be automated.
				throw new Error('AudioObject: property "' + name + '" is not automatable.');
				return;
			}

			fn(value, time, curve, duration);
			return this;
		},

		truncate: function(name, time) {
			//var param = ??
			//var events = paramMap.get(param);

			//if (!events) { return; }

			//truncateParamEvents(param, events, time);
		},

		destroy: noop
	});

	function scheduleEvent(object, event) {
		var param, value, curve;

		//var events = getParamEvents(param);

		var time = event[0];
		var type = event[1];

		if (type === "note") {
			//console.log('AudioObject: schedule note ', event);
			if (!object.start) { return; }
			object.start(time, event[2], event[3]);
			if (!object.stop)  { return; }
			object.stop(time + (event[4] || 0));
			return;
		}

		if (type === "noteon") {
			if (!object.start) { return; }
			object.start(time, event[2], event[3]);
			return;
		}

		if (type === "noteoff") {
			if (!object.stop) { return; }
			object.stop(time, event[2]);
			return;
		}

		//console.log('AudioObject: schedule event', event);

		var automators = automatorMap.get(object);
		var name  = event[2];

		if (!automators || !automators[name]) {
			// Only properties that have been registered
			// by defineAudioProperty() can be automated.
			// Ignore.
			console.log('AudioObject: no param "' + name + '"', event);
			return;
			//throw new Error('AudioObject: property "' + name + '" is not automatable.');
		}

		var value = event[3];
		var curve = event[4];

		// Swap exponential to- or from- 0 values for step
		// curves, which is what they tend towards for low
		// values. This does not deal with -ve values,
		// however. It probably should.
		if (curve === "exponential") {
			if (value < minExponentialValue) {
				curve = "step";
			}
		}

		automators[name](value, time, curve);

//		var event = [time, value, curve];
//		var method = methods[curve];

		// Automate the param

//console.log('AUTOMATE', value, time, curve, param)

//		param[method](value, time, 0);
//		events.push(event);
	}

	assign(AudioObject, {
		automate: function(param, time, value, curve, duration) {
			time = curve === "linear" || curve === "exponential" ?
				time + duration :
				time ;
	
			return automateParam(param, time, value, curve === "decay" ? "target" : curve, curve === "decay" && duration || undefined);
		},

		truncate: function(param, time) {
			var events = param['audio-object-events'];
			if (!events) { return; }

			truncateParamEvents(param, events, time);
		},

		automate2: automateParam,
		valueAtTime: getParamValueAtTime,
		defineInputs: defineInputs,
		defineOutputs: defineOutputs,
		defineAudioProperty: defineAudioProperty,
		defineAudioProperties: defineAudioProperties,
		getInput:       getInput,
		getOutput:      getOutput,
		isAudioContext: isAudioContext,
		isAudioNode:    isAudioNode,
		isAudioParam:   isAudioParam,
		isAudioObject:  isAudioObject,

		features: {
			disconnectParameters: testDisconnectParameters()
		},

		fetchBuffer: Fn.cacheCurry(function fetchBuffer(audio, url) {
			return fetch(url).then(function(response) {
				return new Promise(function(accept, reject) {
					audio.decodeAudioData(response, accept, reject);
				});
			});
		}),

		UnityNode: Fn.cache(function UnityNode(audio) {
			var oscillator = audio.createOscillator();
			var waveshaper = audio.createWaveShaper();
		
			var curve = new Float32Array(2);
			curve[0] = curve[1] = 1;
		
			oscillator.type = 'square';
			oscillator.connect(waveshaper);
			oscillator.frequency.value = 100;
			waveshaper.curve = curve;
			oscillator.start();
		
			return waveshaper;
		})
	});

	Object.defineProperty(AudioObject, 'minExponentialValue', {
		value: minExponentialValue,
		enumerable: true
	});

	window.AudioObject = AudioObject;
})(window);
