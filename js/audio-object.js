(function(window) {
	"use strict";


	// defineAudioProperty()
	// defineAudioProperties()

	var automation = new WeakMap();

	var ramps = {
	    	'linear': linearRamp,
	    	'exponential': exponentialRamp
	    };

	function noop() {}

	function isDefined(val) {
		return val !== undefined && val !== null;
	}

	function isAudioParam(object) {
		return window.AudioParam && window.AudioParam.prototype.isPrototypeOf(object);
	}

	function registerAutomator(object, name, fn) {
		var automators = automation.get(object) || (automation.set(object, {}));
		automators[name] = fn;
	}

	function linearRamp(param, n, time, duration) {
		param.cancelScheduledValues(time);
		param.setValueAtTime(param.value, time);
		param.linearRampToValueAtTime(n, time + duration);
	}

	function exponentialRamp(param, n, time, duration) {
		param.cancelScheduledValues(time);
		param.setValueAtTime(param.value, time);
		param.exponentialRampToValueAtTime(n, time + duration);
	}

	function ramp(param, value, time, duration, curve) {
		ramps[curve](param, value, time, duration);
	}

	function defineAudioProperty(object, name, audio, data) {
		var param = isAudioParam(data) ? data : data.param ;

		if (param && !isAudioParam(param)) { throw new Error('AudioObject.defineAudioProperty requires data.param to be an AudioParam. ' + data.param); }

		var defaultCurve = data.curve || 'linear';
		var defaultDuration = data.duration || 0.008;

		var set = param ?
		    	function set(value, time, duration, curve) {
		    		ramps[curve](param, value, time, duration);
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

		function automate(value, duration, curve) {
			set(value, audio.currentTime, duration || defaultDuration, curve || defaultCurve);
			window.requestAnimationFrame(frame);
		}

		function frame() {
			if (value === get()) { return; }

			var _automate = automate;

			// Castrate the calls to automate the value, then call the setter
			// with the param's current value. Done like this, where the setter
			// has been redefined externally it nonetheless gets called with
			// automated values.
			automate = noop;
			object[name] = get();
			automate = _automate;
			window.requestAnimationFrame(frame);
		}

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

		registerAutomator(object, name, automate);

		Object.defineProperty(object, name, {
			// Should this return value or call get() ? I think calling get is
			// what we want but it returned value before and I'm not sure.
			get: get,

			set: function(val) {
				// Create a new notify message and update the value.
				update(val);
				automate(val, duration, curve);
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

	function isAudioObject(object) {
		return prototype.isPrototypeOf(object);
	}

	function AudioObject(audio, input, output, params, properties) {
		if (this === undefined || this === window) {
			// If this is undefined the constructor has been called without the
			// new keyword, or without a context applied. Do that now.
			return new AudioObject(audio, input, output, params, properties);
		}

		if (!(input || output)) {
			throw new Error('AudioObject must be given an input OR output OR both.');
		}

		// Keep a reference to the input node without exposing it, so that
		// it can be used by .connect() and .disconnect().
		input && inputs.set(this, input);
		output && outputs.set(this, output);

		if (!output) {
			this.connect = this.disconnect = noop;
		}

		// Define Audio Params as getters/setters
		if (params) {
			AudioObject.defineAudioProperties(this, audio, params);
		}

		Object.defineProperty(this, 'context', { value: audio });

		// Define normal properties
		if (properties) {
			Object.defineProperties(this, properties);
		}
	}

	extend(AudioObject.prototype, {
		automate: function(name, value, time, curve) {
			var automators = automation.get(this);
			if (!automators) { return; }

			var fn = automators[name];
			if (!fn) { return; }

			fn(value, time, curve);
		},

		connect: function connect(destination) {
			// Support both AudioObjects and native AudioNodes.
			var input = isAudioObject(destination) ?
			    	inputs.get(destination).input :
			    	destination ;

			if (!input) { return; }

			var output = outputs.get(this);

			output.connect(input);
		},

		disconnect: function disconnect() {
			var output = outputs.get(this);
			output.disconnect();
		},

		destroy: noop
	});

	AudioObject.inputs = inputs;
	AudioObject.outputs = outputs;
	AudioObject.ramp = ramp;
	AudioObject.defineAudioProperty = defineAudioProperty;
	AudioObject.defineAudioProperties = defineAudioProperties;
	AudioObject.isAudioObject = isAudioObject;

	window.AudioObject = AudioObject;
})(window);
