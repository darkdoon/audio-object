(function(window) {
	"use strict";
	
	var Fn          = window.Fn;
	var Music       = window.Music;
	var AudioObject = window.AudioObject;
	var observe     = window.observe;
	var assign      = Object.assign;

	var debug       = true;

	// Ignore any notes that have a region gain less than -60dB. This does not
	// stop you from playing soft – region gain is multiplied by velocity gain –
	// it's just a cut-off to avoid creating inaudible buffer nodes.

	// -60dB
	var minGain = 0.0009765625;

	var defaults = {
		"sample-map":       "Gretsch Kit",
		"gain":             0.5,
		"detune":           0,
		"filter-type":      "off",
		// frequency at "note", 69, 0.5
		"filter-frequency": 1760,
		// octaves/octave
		"filter-frequency-from-note": 1,
		// octaves/velocity
		"filter-frequency-from-velocity": 0,
		"filter-q":                   6,
		//"filter-q-from-note":         0,
		//"filter-q-from-velocity":     0,

		//"connect": {
		//	"filter-frequency": {
		//		"note": 1,
		//		"velocity": 0,
		//		"envelope": 0
		//	},
		//	"filter-q": {
		//		"note": 1,
		//		"velocity": 0,
		//		"envelope": 0
		//	},
		//	"attack": {
		//		"note": 1,
		//		"velocity": 1
		//	},
		//	"attack-rate": {
		//		"note": 1,
		//		"velocity": 1
		//	}
		//},

		//"attack":                     [],
		//"attack-rate-from-note":      0,
		//"attack-rate-from-velocity":  0,
		//"attack-scale-from-note":     0,
		//"attack-scale-from-velocity": 0,
		//"release":                    [],
		//"release-rate-from-note":     0,
		//"release-scale-from-note":    0,
	};


	function isDefined(val) {
		return val !== undefined && val !== null;
	}

	function ratio(n, min, max) {
		return (n - min) / (max - min);
	}

	function rangeGain(region, note, velo) {
		var noteRange       = region.noteRange || [0, 49, 127];
		var veloRange       = region.velocityRange || [0, 1];
		var noteRangeLength = noteRange.length;
		var veloRangeLength = veloRange.length;

		// If note or velocity is outside range, return 0
		if (note < noteRange[0] || noteRange[noteRangeLength - 1] < note) { return 0; }
		if (velo < veloRange[0] || veloRange[veloRangeLength - 1] < velo) { return 0; }

		var noteFactor = noteRangeLength < 4 ? 1 :
				note < noteRange[1] ?
					ratio(note, noteRange[0], noteRange[1]) :
				noteRange[noteRangeLength - 2] < note ?
					1 - ratio(note, noteRange[noteRangeLength - 2], noteRange[noteRangeLength - 1]) :
				1 ;

		var veloFactor = veloRangeLength < 3 ? 1 :
				velo < veloRange[1] ?
					ratio(velo, veloRange[0], veloRange[1]) :
				veloRange[veloRangeLength - 2] < velo ?
					1 - ratio(velo, veloRange[veloRangeLength - 2], veloRange[veloRangeLength - 1]) :
				1 ;

		// return noteFactor squared x veloFactor squared, in order to give
		// us equal-power fade curves (I think). No! Wait, no! If the two
		// sounds are correlated, then we want overall amplitude to remain
		// constant, so the crossfade should be linear. I'm not sure :(
		return noteFactor * veloFactor * (region.gain || 1);
	}

	function rangeDetune(region, number) {
		var range  = region.noteRange || [0, 127];
		//var follow = isDefined(region.pitchFollow) ? region.pitchFollow : 1;
		var l      = range.length;
		var center = range[Math.floor((l - 1) / 2)];
		return number - center;
	}

	function dampNote(time, packets) {
		var n = packets.length;
		var packet, note;

		while (n--) {
			packet = packets[n];

			// If region's dampDecay is not defined, or if it is set to 0,
			// treat sample as a one-shot sound. ie, don't damp it.
			if (!isDefined(packet[0].decay)) { continue; }

			note = packet[1];
			note.stop(time, packet[0].decay);

			// This packet has been damped, so remove it.
			//packets.splice(n, 1);
		}
	}

	function muteNote(time, packets, muteDecay) {
		var n = packets.length;
		var packet, note;

		while (n--) {
			packet = packets[n];
			note = packet[1];
			note.stop(time, muteDecay);
		}
	}


	// Filter

	var Filter = Fn.Pool({
		name: 'Sampler Filter',

		create: function create(audio, destination, object, q, frequency) {
			this.audio = audio;

			this.filter             = audio.createBiquadFilter();
			this.envelopeGain       = audio.createGain();
			//this.velocityMultiplier = audio.createGain();
			//this.envelope           = audio.createGain();
			this.noteGain           = audio.createGain();

			this.filter.type = object['filter-type'];
			this.filter.frequency.value = 0;

			//AudioObject.UnityNode(audio).connect(envelope);
			//envelope.connect(velocityMultiplier);
			//velocityMultiplier.connect(envelopeGain.gain);

			q.connect(this.filter.Q);
			frequency.connect(this.noteGain);
			this.noteGain.connect(this.filter.frequency);
			//envelopeGain.connect(filter.frequency);

			this.input = this.filter;
		},

		reset: function reset(audio, destination, object, q, frequency) {
			var time = audio.currentTime;

			this.filter.disconnect();
			this.filter.connect(destination);
			this.filter.Q.cancelScheduledValues(time);
			this.filter.Q.setValueAtTime(0, time);
			this.envelopeGain.gain.cancelScheduledValues(time);
			this.envelopeGain.gain.setValueAtTime(1, time);
			//this.envelope.gain.setValueAtTime(0, time);
			//this.velocityMultiplier.gain.setValueAtTime(1 + velocityFollow * velocityFactor, time);

			this.startTime = 0;
			this.stopTime  = Infinity;
		},

		isIdle: function(note) {
			var audio = note.audio;
			// currentTime is the start of the next 128 sample frame, so add a
			// frame duration to stopTime before comparing.
			return audio.currentTime > note.stopTime + 128 / audio.sampleRate;
		}
	}, {
		start: function(time, gain) {
			this.noteGain.gain.setValueAtTime(gain, time);
			this.startTime = time;
		},

		stop: function(time, decay) {
			// setTargetAtTime reduces the value exponentially according to the
			// decay. If we set the timeout to decay x 11 we can be pretty sure
			// the value is down at least -96dB.
			// http://webaudio.github.io/web-audio-api/#widl-AudioParam-setTargetAtTime-void-float-target-double-startTime-float-timeConstant

			decay = decay || 0.08;
			this.stopTime = time + Math.ceil(decay * 11);
			
			// Reset Q now to prevent it ringing? No? Let Q ring?
			this.filter.Q.setValueAtTime(0, this.stopTime);

			//this.envelope.gain.setValueAtTime(0, time);
			//this.noteGain.gain.setValueAtTime(1, time);
			//this.velocityMultiplier.gain.setValueAtTime(1 + velocityFollow * velocityFactor, time);
		}
	});


	// Voice

	var Voice = Fn.Pool({
		name: 'Sampler Voice',

		create: function create(audio, buffer, loop, destination, options) {
			this.audio = audio;
			this.gain = audio.createGain();
		},

		reset: function reset(audio, buffer, loop, destination, options) {
			this.source = audio.createBufferSource();
			this.source.buffer = buffer;
			this.source.loop = loop;
			this.source.connect(this.gain);
			this.gain.disconnect();
			this.gain.connect(destination);
			this.startTime = 0;
			this.stopTime  = Infinity;
		},

		isIdle: function(note) {
			var audio = note.audio;
			// currentTime is the start of the next 128 sample frame, so add a
			// frame duration to stopTime before comparing.
			return audio.currentTime > note.stopTime + 128 / audio.sampleRate;
		}
	}, {
		start: function(time, gain, detune) {
			// WebAudio uses cents for detune where we use semitones.
			// Bug: Chrome does not seem to support scheduling for detune...
			//this.nodes[0].detune.setValueAtTime(detune * 100, time);
			this.source.detune.value = detune * 100;
			this.source.start(time);
			this.gain.gain.cancelScheduledValues(time);
			this.gain.gain.setValueAtTime(gain, time);
			this.startTime = time;
		},

		stop: function(time, decay) {
			// setTargetAtTime reduces the value exponentially according to the
			// decay. If we set the timeout to decay x 11 we can be pretty sure
			// the value is down at least -96dB.
			// http://webaudio.github.io/web-audio-api/#widl-AudioParam-setTargetAtTime-void-float-target-double-startTime-float-timeConstant
			this.stopTime = time + Math.ceil(decay * 11);
			this.gain.gain.setTargetAtTime(0, time, decay);
			this.source.stop(this.stopTime);
		}
	});


	// Sampler

	function start(time, number, velocity, audio, object, destination, regions, notes, filters, frequency, q, buffers, options) {
		// Store the currently playing nodes until we know
		// how quickly they should be muted.
		var currentNodes = notes[number].slice();
		var n = regions.length;
		var minMute = Infinity;
		var region, regionGain, regionDetune, buffer, note, filter, sensitivity, velocityGain,
			noteFollow, noteFactor, veloFollow;

		// Empty the array ready for the new packets
		notes[number].length = 0;

		if (object['filter-type'] && object['filter-type'] !== "off") {
			if (!filters[number]) { filters[number] = []; }

			//var velocityFollow   = object['velocity-follow'];
			//var velocityFactor   = 2 * velocity - 1;
			noteFollow = object['filter-frequency-from-note'];
			veloFollow = object['filter-frequency-from-velocity'];
			noteFactor = Music.numberToFrequency(number, 1);
			filter     = Filter(audio, destination, object, q, frequency);
			filter.start(time, 1 + noteFollow * (noteFactor - 1) + veloFollow * (velocity - 0.5));

			// Store the region and associated filter
			filters[number].push(filter);

			// Set the destination to the filter
			destination = filter.input;
		}

		while (n--) {
			region = regions[n];
			buffer = buffers[n];

			if (!buffer) {
				console.log('Soundstage sampler: No buffer for region', n, region.url);
				continue;
			}

			regionGain  = rangeGain(region, number, velocity);
			sensitivity = isDefined(region.velocitySensitivity) ? region.velocitySensitivity : 1 ;

			// If the regionGain is low don't play the region
			if (regionGain <= minGain) { continue; }

			// If sensitivity is 0, we get gain 1
			// If sensitivity is 1, we get gain range 0-1
			velocityGain = sensitivity * velocity * velocity + 1 - sensitivity;
			regionDetune = rangeDetune(region, number);

			note = Voice(audio, buffer, region.loop, destination, options);
			note.start(time, regionGain * velocityGain, regionDetune);

			// Store the region and associated nodes, that we may
			// dispose of them elegantly later.
			notes[number].push([region, note]);

			if (isDefined(region.muteDecay) && region.muteDecay < minMute) {
				minMute = region.muteDecay;
			}
		}

		if (minMute < Infinity) {
			// Mute nodes currently playing at this number
			muteNote(time, currentNodes, minMute);
		}
	}

	function Sampler(audio, settings, presets) {
		if (!AudioObject.isAudioObject(this)) {
			return new Sampler(audio, settings, presets);
		}

		var options = assign({}, defaults, settings);
		var buffers = [];
		var object = this;
		var regions;

		var unityNode  = AudioObject.UnityNode(audio);
		var pitchNode  = audio.createGain();
		//var detuneNode = audio.createGain();
		var frequency  = audio.createGain();
		var q          = audio.createGain();
		var output     = audio.createGain();

		// Maintain a map of currently playing notes and filters
		var notes = {};
		var filters = {};

		function updateLoaded() {
			object.loaded = buffers.filter(isDefined).length / buffers.length;
		}

		function fetchBufferN(n, url) {
			AudioObject
			.fetchBuffer(audio, url)
			.then(function(buffer) {
				buffers[n] = buffer;
				updateLoaded();
			});
		}

		function updateSampleMap() {
			var sampleMap = AudioObject.presets.find(object['sample-map']);

			if (!sampleMap) {
				if (debug) { console.log('Soundstage sampler:', object['sample-map'], 'is not in presets.'); }
				return;
			}

			// Maintain a list of buffers of urls declared in regions
			var n = sampleMap.data.length;
			buffers.length = 0;
			buffers.length = n;

			while (n--) {
				fetchBufferN(n, sampleMap.data[n].url);
			}

			updateLoaded();
			regions = sampleMap.data;
		}

		function updateFilterType() {
			var number;
			// Todo: handle filter-type "off" or falsy
			for(number of Object.keys(filters)) {
				filters[number].filter.type = object['filter-type'];
			}
		}

		observe(object, 'filter-type', updateFilterType);
		observe(object, 'sample-map', updateSampleMap);

		unityNode.connect(frequency);
		unityNode.connect(q);
		unityNode.connect(pitchNode);
		//pitchNode.connect(detuneNode);
		//pitchNode.gain.setValueAtTime(0, 0);
		//detuneNode.gain.setValueAtTime(100, 0);

		frequency.gain.value = options['filter-frequency'];
		q.gain.value         = options['filter-q'];

		AudioObject.call(this, audio, undefined, output, {
			"gain": {
				param: output.gain,
				curve: 'linear',
				duration: 0.006
			},

			"pitch": {
				param: pitchNode.gain,
				curve: 'linear',
				duration: 0.006
			},

			"filter-frequency": {
				param: frequency.gain,
				curve: 'exponential',
				duration: 0.006
			},

			"filter-q": {
				param: q.gain,
				curve: 'linear',
				duration: 0.006
			}
		});

		this['sample-map']                     = options['sample-map'];
		this['filter-type']                    = options['filter-type'];
		this['filter-frequency']               = options['filter-frequency'];
		this['filter-frequency-from-note']     = options['filter-frequency-from-note'];
		this['filter-frequency-from-velocity'] = options['filter-frequency-from-velocity'];
		this['filter-q']                       = options['filter-q'];

		this.start = function(time, number, velocity) {
			time = time || audio.currentTime;

			if (velocity === 0) { return; }

			if (!notes[number]) { notes[number] = []; }
			start(time, number, velocity, audio, this, output, regions, notes, filters, frequency, q, buffers, options);
			return this;
		};

		this.stop = function stop(time, number) {
			// If no number given, stop all notes
			if (arguments.length === 1) {
				for (number of Object.keys(notes)) {
					stop(time, number);
				}
				return this;
			}

			// Damp playing note
			var packets = notes[number];
			if (!packets) { return this; }

			dampNote(time || audio.currentTime, packets);
			packets.length = 0;

			var packet = filters[number];
			if (!Fn.get('length', packet)) { return this; }
			var filter = packet[0];
			filter.stop(time || audio.currentTime);
			packet.length = 0;

			return this;
		};

		this.destroy = function() {
			output.disconnect();
		};

		// Expose sample-maps settings, but non-enumerably so it
		// doesn't get JSONified.
		Object.defineProperties(this, {
			"loaded": {
				value: 0,
				writable: true,
				enumerable: false
			},

			"sample-maps": {
				value: presets.sub({ type: 'sample-map' })
			}
		});

		return object;
	}

	Sampler.prototype = Object.create(AudioObject.prototype);

	AudioObject.Sampler = Sampler;
})(window);
