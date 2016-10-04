(function(window) {
	"use strict";

	var assign   = Object.assign;

	// Ignore any notes that have a region gain less than -60dB. This does not
	// stop you from playing soft – region gain is multiplied by velocity gain –
	// it's just a cut-off to avoid creating inaudible buffer nodes.
	var minGain = 0.0009765625; // -60dB

	var defaults = {
		"sample-map": "Gretsch Kit"
	};

	
	// ------------------------------------

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
		var follow = isDefined(region.pitchFollow) ? region.pitchFollow : 1;
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


	// Voice

//	function Note(audio, buffer, loop, destination, options) {
//		this.audio = audio;
//		this.nodes = [undefined, audio.createGain()];
//		this.nodes[1].connect(destination);
//		Note.reset.apply(this, arguments);
//	}
//
//	assign(Note, {
//		reset: function reset(audio, buffer, loop, destination, options) {
//			var nodes = this.nodes;
//			nodes[0] = audio.createBufferSource();
//			nodes[0].buffer = buffer;
//			nodes[0].loop = loop;
//			nodes[0].connect(nodes[1]);
//			this.startTime = Infinity;
//			this.stopTime = Infinity;
//		}
//	});
//
//	assign(Note.prototype, {
//		start: function(time, gain, detune) {
//			// WebAudio uses cents for detune where we use semitones.
//			// Bug: Chrome does not seem to support scheduling for detune...
//			//this.nodes[0].detune.setValueAtTime(detune * 100, time);
//			this.nodes[0].detune.value = detune * 100;
//			this.nodes[0].start(time);
//			this.nodes[1].gain.setValueAtTime(gain, time);
//			this.startTime = time;
//		},
//
//		stop: function(time, decay) {
//			// setTargetAtTime reduces the value exponentially according to the
//			// decay. If we set the timeout to decay x 11 we can be pretty sure
//			// the value is down at least -96dB.
//			// http://webaudio.github.io/web-audio-api/#widl-AudioParam-setTargetAtTime-void-float-target-double-startTime-float-timeConstant
//
//			this.stopTime = time + Math.ceil(decay * 11);
//			this.nodes[0].stop(this.stopTime);
//			this.nodes[1].gain.setTargetAtTime(0, time, decay);
//
//			// Do we need to disconnect nodes or are they thrown away automatically?
//			//setTimeout(function() {
//			//	this.nodes[0].disconnect();
//			//	this.nodes[1].disconnect();
//			//}, Math.ceil(decay * 11));
//		}
//	});
//
//	var Voice = Fn.pool(Note, function isIdle(note) {
//		var audio = note.audio;
//		// currentTime is the start of the next 128 sample frame, so add a
//		// frame duration to stopTime before comparing.
//		return audio.currentTime > note.stopTime + 128 / audio.sampleRate;
//	});


	var Voice = Fn.Pool({
		create: function create(audio, buffer, loop, destination, options) {
			this.audio = audio;
			this.nodes = [undefined, audio.createGain()];
			this.nodes[1].connect(destination);
		},

		reset: function reset(audio, buffer, loop, destination, options) {
			var nodes = this.nodes;
			nodes[0] = audio.createBufferSource();
			nodes[0].buffer = buffer;
			nodes[0].loop = loop;
			nodes[0].connect(nodes[1]);
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
			this.nodes[0].detune.value = detune * 100;
			this.nodes[0].start(time);
			this.nodes[1].gain.setValueAtTime(gain, time);
			this.startTime = time;
		},

		stop: function(time, decay) {
			// setTargetAtTime reduces the value exponentially according to the
			// decay. If we set the timeout to decay x 11 we can be pretty sure
			// the value is down at least -96dB.
			// http://webaudio.github.io/web-audio-api/#widl-AudioParam-setTargetAtTime-void-float-target-double-startTime-float-timeConstant

			this.stopTime = time + Math.ceil(decay * 11);
			this.nodes[1].gain.setTargetAtTime(0, time, decay);
			this.nodes[0].stop(this.stopTime);

			// Do we need to disconnect nodes or are they thrown away automatically?
			//setTimeout(function() {
			//	this.nodes[0].disconnect();
			//	this.nodes[1].disconnect();
			//}, Math.ceil(decay * 11));
		}
	});

	// Sampler

	function Sampler(audio, settings, clock, presets) {
		var options = assign({}, defaults, settings);
		var output = audio.createGain();
		var object = AudioObject(audio, undefined, output);
		var regions;
		var buffers = [];

		// Maintain a map of currently playing notes
		var notes = {};

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
				console.log('Soundstage sampler:', object['sample-map'], 'is not in presets.');
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

		observe(object, 'sample-map', updateSampleMap);
		object['sample-map'] = options['sample-map'];

		object.start = function(time, number, velocity) {
			time = time || audio.currentTime;

			if (velocity === 0) { return; }

			if (!notes[number]) { notes[number] = []; }

			// Store the currently playing nodes until we know
			// how quickly they should be muted.
			var currentNodes = notes[number].slice();
			var n = regions.length;
			var minMute = Infinity;
			var region, regionGain, regionDetune, buffer, note, sensitivity, velocityGain, muteDecay;

			// Empty the array ready for the new nodes
			notes[number].length = 0;

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

				note = Voice(audio, buffer, region.loop, output, options);
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
		};

		object.stop = function(time, number) {
			var packets = notes[number];
			if (!packets) { return; }
			dampNote(time || audio.currentTime, packets);
		};

		object.destroy = function() {
			output.disconnect();
		};

		// Expose sample-maps settings, but non-enumerably so it
		// doesn't get JSONified.
		Object.defineProperties(object, {
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
