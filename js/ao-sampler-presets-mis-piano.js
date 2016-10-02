(function(window) {
	"use strict";

	var presets = AudioObject.presets || (AudioObject.presets = Collection([], { index: 'name' }));

	// University of Iowa piano samples:
	// http://theremin.music.uiowa.edu/MISpiano.html

	// A region looks like this:
	// 
	// {
	//   url: 'audio.wav',
	//   noteRange: [minLimit, minFade, maxFade, maxLimit],     // All numbers as MIDI note numbers
	//   velocityRange: [minLimit, minFade, maxFade, maxLimit], // All numbers in the range 0-1
	//   velocitySensitivity: // 0-1
	//   gain:                // 0-1
	//   muteDecay:           // seconds
	// }
	
	// Note: URLs are temporary! They will change.

	presets.add({
		type: 'sample-map',
		version: '0.1',
		name: 'MIS Piano',

		data: [{
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.pp.C1.aiff',
			noteRange: [24],
			velocityRange: [0/3, 1/3],
			velocitySensitivity: 0.25,
			gain: 1.5,
			muteDecay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.mf.C1.aiff',
			noteRange: [24],
			velocityRange: [1/3, 2/3],
			velocitySensitivity: 0.25,
			gain: 1.5,
			muteDecay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.ff.C1.aiff',
			noteRange: [24],
			velocityRange: [2/3, 3/3],
			velocitySensitivity: 0.25,
			gain: 1.5,
			muteDecay: 0.08
		}, 


		{
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.pp.C4.aiff',
			noteRange: [60],
			velocityRange: [0/3, 1/3],
			velocitySensitivity: 0.25,
			gain: 1.5,
			muteDecay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.mf.C4.aiff',
			noteRange: [60],
			velocityRange: [1/3, 2/3],
			velocitySensitivity: 0.25,
			gain: 1.5,
			muteDecay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.ff.C4.aiff',
			noteRange: [60],
			velocityRange: [2/3, 3/3],
			velocitySensitivity: 0.25,
			gain: 1.5,
			muteDecay: 0.08
		}]
	});
})(window);