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

		data: [

		{
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.pp.C2.wav',
			noteRange: [30, 36, 42],
			velocityRange: [0, 0, 2/12, 6/12],
			velocitySensitivity: 0.5,
			gain: 6,
			muteDecay: 0.2,
			decay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.mf.C2.wav',
			noteRange: [30, 36, 42],
			velocityRange: [2/12, 6/12, 7/12, 11/12],
			velocitySensitivity: 0.5,
			gain: 12/7,
			muteDecay: 0.2,
			decay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.ff.C2.wav',
			noteRange: [30, 36, 42],
			velocityRange: [7/12, 11/12, 1, 1],
			velocitySensitivity: 0.5,
			gain: 1,
			muteDecay: 0.2,
			decay: 0.08
		},
		
		{
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.pp.C3.wav',
			noteRange: [42, 48, 54],
			velocityRange: [0, 0, 2/12, 6/12],
			velocitySensitivity: 0.5,
			gain: 6,
			muteDecay: 0.2,
			decay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.mf.C3.wav',
			noteRange: [42, 48, 54],
			velocityRange: [2/12, 6/12, 7/12, 11/12],
			velocitySensitivity: 0.5,
			gain: 12/7,
			muteDecay: 0.2,
			decay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.ff.C3.wav',
			noteRange: [42, 48, 54],
			velocityRange: [7/12, 11/12, 1, 1],
			velocitySensitivity: 0.5,
			gain: 1,
			muteDecay: 0.2,
			decay: 0.08
		},

		{
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.pp.C4.wav',
			noteRange: [54, 60, 66],
			velocityRange: [0, 0, 2/12, 6/12],
			velocitySensitivity: 0.5,
			gain: 6,
			muteDecay: 0.2,
			decay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.mf.C4.wav',
			noteRange: [54, 60, 66],
			velocityRange: [2/12, 6/12, 7/12, 11/12],
			velocitySensitivity: 0.5,
			gain: 12/7,
			muteDecay: 0.2,
			decay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.ff.C4.wav',
			noteRange: [54, 60, 66],
			velocityRange: [7/12, 11/12, 1, 1],
			velocitySensitivity: 0.5,
			gain: 1,
			muteDecay: 0.2,
			decay: 0.08
		},

		{
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.pp.C5.wav',
			noteRange: [66, 72, 78],
			velocityRange: [0, 0, 2/12, 6/12],
			velocitySensitivity: 0.5,
			gain: 6,
			muteDecay: 0.2,
			decay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.mf.C5.wav',
			noteRange: [66, 72, 78],
			velocityRange: [2/12, 6/12, 7/12, 11/12],
			velocitySensitivity: 0.5,
			gain: 12/7,
			muteDecay: 0.2,
			decay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.ff.C5.wav',
			noteRange: [66, 72, 78],
			velocityRange: [7/12, 11/12, 1, 1],
			velocitySensitivity: 0.5,
			gain: 1,
			muteDecay: 0.2,
			decay: 0.08
		},

		{
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.pp.C6.wav',
			noteRange: [78, 84, 90],
			velocityRange: [0, 0, 2/12, 6/12],
			velocitySensitivity: 0.5,
			gain: 6,
			muteDecay: 0.2,
			decay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.mf.C6.wav',
			noteRange: [78, 84, 90],
			velocityRange: [2/12, 6/12, 7/12, 11/12],
			velocitySensitivity: 0.5,
			gain: 12/7,
			muteDecay: 0.2,
			decay: 0.08
		}, {
			url: 'http://localhost/sound.io/soundio/static/audio/mis-piano/samples/Piano.ff.C6.wav',
			noteRange: [78, 84, 90],
			velocityRange: [7/12, 11/12, 1, 1],
			velocitySensitivity: 0.5,
			gain: 1,
			muteDecay: 0.2,
			decay: 0.08
		}

		]
	});
})(window);