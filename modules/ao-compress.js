
var AudioObject = window.AudioObject;

var assign = Object.assign;

var defaults = {
	threshold: -24,   // dB
	knee:      8,     // dB
	ratio:     4,     // dB input / dB output
	attack:    0.020, // seconds
	release:   0.16   // seconds
};

function Compress(audio, settings) {
	var options = assign({}, defaults, settings);
	var compressor = audio.createDynamicsCompressor();

	compressor.type = 'compress';
	compressor.threshold.value = options.threshold;
	compressor.knee.value      = options.knee;
	compressor.ratio.value     = options.ratio;
	compressor.attack.value    = options.attack;
	compressor.release.value   = options.release;

	AudioObject.call(this, audio, compressor, compressor, {
		threshold: { param: compressor.threshold },
		knee:      { param: compressor.knee },
		ratio:     { param: compressor.ratio },
		attack:    { param: compressor.attack },
		release:   { param: compressor.release }
	});

	this.type = 'compress';

	this.destroy = function destroy() {
		compressor.disconnect();
	};
}

Compress.prototype = AudioObject.prototype;

Compress.defaults = {
	'threshold':     { min: -60, max: 0,   transform: 'linear' ,   value: -12   }, // dB
	'knee':          { min: 0,   max: 40,  transform: 'linear' ,   value: 8     }, // dB
	'ratio':         { min: 0,   max: 20,  transform: 'quadratic', value: 4     }, // dB input / dB output
	'attack':        { min: 0,   max: 0.2, transform: 'quadratic', value: 0.020 }, // seconds
	'release':       { min: 0,   max: 1,   transform: 'quadratic', value: 0.16  }  // seconds
};

export default Compress;
