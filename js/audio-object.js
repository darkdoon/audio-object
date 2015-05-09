(function(window) {
	"use strict";


	// defineAudioProperty()
	// defineAudioProperties()

	var fadeDuration = 0.008;
	var automation = new WeakMap();

	function noop() {}

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

	function defineAudioProperty(object, name, audio, data) {
		var param = isAudioParam(data) ? data : data.param ;

		if (!isAudioParam(param)) { throw new Error('AudioObject.defineAudioProperty requires data.param to be an AudioParam. ' + data.param); }

		var value = param.value;
		var duration = data.duration || fadeDuration;
		var fn = data.curve === 'exponential' ? exponentialRamp : linearRamp ;
		var ramp = fn;
		var message = {
		    	type: 'update',
		    	name: name
		    };

		function frame() {
			if (value === param.value) { return; }

			// Castrate the setter.
			ramp = noop;

			// Call the setter with the param's current value.
			object[name] = param.value;

			// Make the setter able to automate once more.
			ramp = fn;

			window.requestAnimationFrame(frame);
		}

		registerAutomator(object, name, function automate(v, duration, curve) {
			curve = curve || data.curve;

			if (curve === 'exponential') {
				exponentialRamp(param, v, audio.currentTime, duration);
			}
			else {
				linearRamp(param, v, audio.currentTime, duration);
			}

			window.requestAnimationFrame(frame);
		});

		Object.defineProperty(object, name, {
			get: function() {
				return value;
			},

			set: function(n) {
				// Set the value as the old value of the message and update
				// value with the new value.
				message.oldValue = value;
				value = n;

				// Update the observe message and send it.
				if (Object.getNotifier) {
					Object.getNotifier(object).notify(message);
				}

				// Call the WebAudio ramp
				ramp(param, n, audio.currentTime, duration);
			},

			enumerable: true,
			configurable: true
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
	var prototype = {
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

			var output = outputs.get(this);

			output.connect(input);
		},

		disconnect: function disconnect() {
			var output = outputs.get(this);
			output.disconnect();
		},

		destroy: noop
	};

	function isAudioObject(object) {
		return prototype.isPrototypeOf(object);
	}

	function AudioObject(audio, input, output, params) {
		var effect = Object.create(prototype);

		if (!(input || output)) {
			throw new Error('AudioObject must be given an input OR output OR both.');
		}

		// Keep a reference to the input node without exposing it, so that
		// it can be used by .connect() and .disconnect().
		input && inputs.set(effect, input);
		output && outputs.set(effect, output);

		// If no params were passed in, hightail it outta here
		if (!params) { return effect; }

		// Define params as getters/setters
		AudioObject.defineAudioProperties(effect, audio, params);

		return effect;
	}

	AudioObject.inputs = inputs;
	AudioObject.outputs = outputs;
	AudioObject.prototype = prototype;
	AudioObject.defineAudioProperty = defineAudioProperty;
	AudioObject.defineAudioProperties = defineAudioProperties;
	AudioObject.isAudioObject = isAudioObject;

	window.AudioObject = AudioObject;
})(window);
