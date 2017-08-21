import AudioObject from './audio-object.js';

const assign = Object.assign;

function Module(audio, settings, sequencer) {
	this.start = function(time, name, velocity) {
		console.log('module.start()', time, name, velocity);
	};

	this.stop = function(time, name) {
		console.log('module.stop() ', time, name);
	};
}

assign(Module, {
	prototype: Object.create(AudioObject.prototype),

	defaults: {
		'frequency':     { min: 16,  max: 16384, transform: 'logarithmic', value: 1000 },
		'drive':         { min: 0.5, max: 8,     transform: 'cubic',       value: 1 },
		'wet':           { min: 0,   max: 2,     transform: 'cubic',       value: 1 }
	}
});

export default Module;
