(function(window) {
	"use strict";

	// Import

	var Fn          = window.Fn;
	var AudioObject = window.AudioObject;
	var observe     = window.observe;

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

//	function aliasProperty(object, node, name) {
//		Object.defineProperty(object, name, {
//			get: function() { return node[name]; },
//			set: function(value) { node[name] = value; },
//			enumerable: true
//		});
//	}

//	function aliasMethod(object, node, name) {
//		object[name] = function() {
//			node[name].apply(node, arguments);
//		};
//	}

	var Voice = Fn.Pool({
		name: "Oscillator Voice",

		create: function(audio, number, destination, options) {
			this.envelope = audio.createGain();
			this.envelope.connect(destination);
		},

		reset: function(audio, number, destination, options) {
			this.oscillator = audio.createOscillator();
			this.oscillator.detune.value    = options.detune;
			this.oscillator.frequency.value = numberToFrequency(number);
			this.oscillator.type            = options.waveform || 'sine';
			this.oscillator.connect(this.envelope);
			this.envelope.gain.setValueAtTime(0, audio.currentTime);
		},

		isIdle: function(voice) {
			var audio = voice.audio;
			// currentTime is the start of the next 128 sample frame, so add a
			// frame duration to stopTime before comparing.
			return audio.currentTime >= voice.stopTime + 128 / audio.sampleRate;
		}
	}, {
		start: function(time) {
			this.nodes[0].start(time);
			this.nodes[1].gain.setValueAtTime(0, time);
			this.nodes[1].gain.linearRampToValueAtTime(1, time + 0.004);
		},

		stop: function(time) {
			this.nodes[0].stop(time + 0.012);
			this.nodes[1].gain.linearRampToValueAtTime(0, time + 0.006);
		}
	});

	function Oscillator(audio, settings) {
		if (!AudioObject.isAudioObject(this)) {
			return new Oscillator(audio, settings);
		}

		var object  = this;
		var options = assign({}, defaults, settings);
		var output  = audio.createGain();
		var notes   = {};

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

		function updateWaveform() {
			var waveform = object.waveform;
			var name;
			for (name in Object.keys(notes)) {
				notes[name].oscillator.type = waveform;
			}
		}

		observe(this, 'waveform', updateWaveform);

		this.start = function(time, number) {
			if (notes[number]) {
				notes[number].stop(time);
			}

			var voice = new Voice(audio, number, output, options);
			notes[number] = voice;
			voice.start(time || audio.currentTime);
			return this;
		};

		this.stop = function(time, number) {
			var note = notes[number];
			note.stop(time || audio.currentTime);
			notes[number] = undefined;
			return this;
		};

		this.destroy = function() {
			var name;
			for (name in Object.keys(notes)) {
				notes[name].stop();
			}
			output.disconnect();
			return this;
		};
	}

	Oscillator.prototype = Object.create(AudioObject.prototype);
	AudioObject.Oscillator = Oscillator;
})(this);
