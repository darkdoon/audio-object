(function(window) {
	"use strict";

	// Import

	var AudioObject = window.AudioObject;

	// Todo: move the function out of midi-utils into a more generic library.
	// Well write it out in full here for now.
	var A4 = 69;
	var numberToFrequency = function numberToFrequency(n, tuning) {
		return (tuning || 440) * Math.pow(2, (n - A4) / 12);
	};

	var assign = Object.assign;


	// Oscillator Audio Object

	function createDefaults(automation) {
		var defaults = {};

		Object.keys(automation)
		.forEach(function(key) {
			defaults[key] = automation[key].value;
		});

		return defaults;
	}

	var automation = {
		detune:    { min: -1200, max: 1200,  transform: 'linear' ,     value: 0 },
		frequency: { min: 16,    max: 16000, transform: 'logarithmic', value: 440 }
	};

	var defaults = createDefaults(automation);

	function aliasProperty(object, node, name) {
		Object.defineProperty(object, name, {
			get: function() { return node[name]; },
			set: function(value) { node[name] = value; },
			enumerable: true
		});
	}

	function aliasMethod(object, node, name) {
		object[name] = function() {
			node[name].apply(node, arguments);
		};
	}

	function Oscillator(audio, settings) {
		var options = assign({}, defaults, settings);
		var output  = audio.createGain();
		var oscillators = Fn.Stream.of();

		AudioObject.call(this, audio, undefined, output, {
			gain:        output.gain,
			//detune:    node.detune,
			//frequency: node.frequency
		});

		output.gain.value = options.gain;

		//aliasProperty(this, node, 'onended');

		// We shouldn't use 'type' as it is required by
		// Soundstage to describe the type of audio object.
		// Waveform. Yeah.
		Object.defineProperty(this, 'waveform', {
			get: function() { return node.type; },
			set: function(value) { node.type = value; },
			enumerable: true
		});

		assign(this, {
			start: function(time, number) {
				var node    = audio.createOscillator();
				node.detune.value = options.detune;
				node.frequency.value = number ?
					numberToFrequency(number) :
					options.frequency ;
				node.type = options.waveform || 'sine';
				node.connect(output);
				node.start(time);
				oscillators.push(node);
				return this;
			},

			stop: function() {
				var node = oscillators.shift();
				if (!node) { return; }
				node.stop.apply(node, arguments);
				return this;
			},

			setPeriodicWave: function() {
				node.setPeriodicWave.apply(node, arguments);
				return this;
			},

			destroy: function() {
				node.disconnect();
				return this;
			}
		});
	}

	Oscillator.prototype = Object.create(AudioObject.prototype);
	AudioObject.Oscillator = Oscillator;
})(this);