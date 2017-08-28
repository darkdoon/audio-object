(function(window) {
	"use strict";


	// Import

	var AudioObject = window.AudioObject;
	var Fn          = window.Fn;

	var assign      = Object.assign;
	var noop        = Fn.noop;
	var todB        = Fn.todB;
	var toLevel     = Fn.toLevel;


	// Define

	var defaults = {
		gain:      0.25,
		decay:     0.06,
		resonance: 22
	};

	var dB48 = toLevel(-48);
	var dummy = { stop: noop };


	// Tick

	function Tick(audio, options) {
		if (!Tick.prototype.isPrototypeOf(this)) {
			return new Tick(audio, options);
		}

		var settings   = assign({}, defaults, options);

		var oscillator = audio.createOscillator();
		var filter     = audio.createBiquadFilter();
		var gain       = audio.createGain();
		var output     = audio.createGain();
		var merger     = audio.createChannelMerger(2);

		oscillator.channelCount = 1;
		filter.channelCount     = 1;
		gain.channelCount       = 1;
		output.channelCount     = 1;

		function schedule(time, frequency, level, decay, resonance) {
			var attackTime = time > 0.002 ? time - 0.002 : 0 ;

			// Todo: Feature test setTargetAtTime in the AudioObject namespace.
			// Firefox is REALLY flakey at setTargetAtTime. More often than not
			// it acts like setValueAtTime. Avoid using it where possible.

			oscillator.frequency.setValueAtTime(frequency, attackTime);
			oscillator.frequency.exponentialRampToValueAtTime(frequency / 1.06, time + decay);

			filter.frequency.cancelScheduledValues(attackTime);
			filter.frequency.setValueAtTime(frequency * 1.1, attackTime);
			filter.frequency.exponentialRampToValueAtTime(frequency * 4.98, time);
			//filter.frequency.setTargetAtTime(frequency + 300, time + 0.003, 0.0625);
			filter.frequency.exponentialRampToValueAtTime(frequency * 1.5, time + decay);

			filter.Q.cancelScheduledValues(attackTime);
			filter.Q.setValueAtTime(0, attackTime);
			filter.Q.linearRampToValueAtTime(resonance, time);
			//filter.Q.setTargetAtTime(0, time + 0.05, 0.0625);
			filter.Q.linearRampToValueAtTime(0, time + decay);

			gain.gain.cancelScheduledValues(attackTime);
			gain.gain.setValueAtTime(0, attackTime);
			gain.gain.linearRampToValueAtTime(level, time);
			//gain.gain.setTargetAtTime(0, time, decay);
			gain.gain.exponentialRampToValueAtTime(dB48, time + decay);
			// Todo: work out the gradient of the exponential at time + decay,
			// us it to schedule the linear ramp of the same gradient.
			gain.gain.linearRampToValueAtTime(0, time + decay * 1.25);
		}

		function unschedule(time, decay) {
			gain.gain.cancelScheduledValues(time + decay * 1.25);
		}

		oscillator.type = 'square';
		oscillator.frequency.setValueAtTime(300, audio.currentTime);
		oscillator.start();
		oscillator.connect(filter);

		filter.connect(gain);

		gain.gain.value = 0;
		gain.connect(output);
		output.connect(merger, 0, 0);
		output.connect(merger, 0, 1);

		// Initialise as AudioObject
		AudioObject.call(this, audio, undefined, merger, {
			gain: output.gain
		});

		this.resonance = settings.resonance;
		this.decay     = settings.decay;
		this.gain      = settings.gain;

		this.start = function(time, number, level) {
			var frequency = AudioObject.numberToFrequency(number);
			schedule(time || audio.currentTime, frequency, level, this.decay, this.resonance);
			return this;
		};

		this.stop = function(time) {
			// Don't. It's causing problems. I think we'll simply live with the
			// fact that the metronome doesn't stop immediately when you stop
			// the sequencer. 
			//unschedule(time, this.decay);
			return this;
		};

		this.stop = function(time) {
			stop(time || audio.currentTime, this.decay);
		};

		this.destroy = function() {
			oscillator.disconnect();
			filter.disconnect();
			gain.disconnect();
			output.disconnect();
		};
	}


	// Export

	Tick.prototype = AudioObject.prototype;
	Tick.prototype.stop = noop;

	Tick.defaults = defaults;
	AudioObject.Tick = Tick;
})(this);
