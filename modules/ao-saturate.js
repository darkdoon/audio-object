
// Import
var AudioObject = window.AudioObject;

var assign = Object.assign;
var exp    = Math.exp;
var sqrt   = Math.sqrt;
var abs    = Math.abs;
var pow    = Math.pow;
var sin    = Math.sin;
var atan   = Math.atan;
var pi     = Math.PI;

var defaults = {
	frequency: 1000,
	curve: [-0.125,-0.5,0,0.5,0.125],
	q: 1,
	drive: 1,
	dry: 1,
	wet: 1
};

function populateCurve(curve, fn) {
	var l = curve.length;
	var n = l;

	// Populate the curve array with values given by fn
	// for the range -1 to 1
	while (n--) {
		curve[n] = fn(2 * n/l - 1);
	}
}

function linear(x) {
	return x;
}

function poly3(x) {
	return 1.5 * x - 0.5 * pow(x, 3);
}

function gloubiBoulga(x) {
	var x1 = x * 0.686306;
	var a = 1 + exp(sqrt(abs(x1)) * -0.75);
	var b = exp(x1);

	return (b - exp(-x * a)) * b / (b * b + 1);
}

function transformLinear() {
	return linear;
}

function transform3rdPolynomial() {
	return poly3;
}

function transformGloubiBoulga() {
	return gloubiBoulga;
}

function transformChebyshev1(h0, h1, h2, h3, h4, h5, h6, h7, h8) {
	// Chebyshev Polynomials of the first kind
	// http://mathworld.wolfram.com/ChebyshevPolynomialoftheFirstKind.html

	return function chebyshev(x) {
		return h0 * 1 +
			h1 * x +
			h2 * (2   * pow(x, 2) - 1) +
			h3 * (4   * pow(x, 3) - 3   * x) +
			h4 * (8   * pow(x, 4) - 8   * pow(x, 2) + 1) +
			h5 * (16  * pow(x, 5) - 20  * pow(x, 3) + 5 * x) +
			h6 * (32  * pow(x, 6) - 48  * pow(x, 4) + 18  * pow(x, 2) - 1) +
			h7 * (64  * pow(x, 7) - 112 * pow(x, 5) + 56  * pow(x, 3) - 7 * x) +
			h8 * (128 * pow(x, 8) - 256 * pow(x, 6) + 160 * pow(x, 4) - 32 * pow(x, 2) + 1);
	};
}

// Chebyshev Polynomials of the second kind
// http://mathworld.wolfram.com/ChebyshevPolynomialoftheSecondKind.html

//	U_1(x)	=	2x
//	U_2(x)	=	4x^2-1
//	U_3(x)	=	8x^3-4x
//	U_4(x)	=	16x^4-12x^2+1
//	U_5(x)	=	32x^5-32x^3+6x
//	U_6(x)	=	64x^6-80x^4+24x^2-1

function transformBram1(a) {
	return function bram1(x) {
		return (2 * (a+1)) * (a + (x-a) / (1 + pow((x-a)/(1-a), 2)));
	}
}

function transformBram2(a) {
	// a must be in range -0.9999 to 0.9999
	
	return function bram2(x) {
		var k = 2 * a / (1 - a);
		return (1 - a) * (1 + k) * x / (1 + k * abs(x));
	}
}

function transformAtan(a) {
	return a === 0 ? linear :
		function tangent(x) {
			return atan(a * x * 0.5 * pi) / atan(a * 0.5 * pi);
		};
}

function transformSine(a) {
	return a === 0 ? linear :
		(a > 1 || a < -1) ?
		function sine(x) {
			return sin(a * x * 0.5 * pi);
		} :
		function sine(x) {
			return sin(a * x * 0.5 * pi) / sin(a * 0.5 * pi)
		} ;
}

var shapes = {
	"linear": transformLinear,
	"classic": transform3rdPolynomial,
	"sine": transformSine,
	"atan": transformAtan,
	"chebyshev": transformChebyshev1,
	"bram 1": transformBram1,
	"bram 2": transformBram2,
	"gloubi boulga": transformGloubiBoulga
};

function Saturate(audio, settings) {
	var options = assign({}, defaults, settings);
	var input = audio.createGain();
	var drive = audio.createGain();
	var output = audio.createGain();
	var wet = audio.createGain();
	var dry = audio.createGain();
	var waveshaper = audio.createWaveShaper();
	var filter1 = audio.createBiquadFilter();
	var filter2 = audio.createBiquadFilter();
	var filter3 = audio.createBiquadFilter();
	var curve = new Float32Array(1024);
	var params = [
	    	options[0] || 0,
	    	options[1] || 1,
	    	options[2] || 0,
	    	options[3] || 0,
	    	options[4] || 0,
	    	options[5] || 0,
	    	options[6] || 0,
	    	options[7] || 0,
	    	options[8] || 0,
	    	options[9] || 0
	    ];
	var shapeName = options.shape || "atan";
	var transform = shapes[shapeName].apply(this, params);

	populateCurve(curve, transform);

	input.gain.value = 1;
	output.gain.value = 1;
	drive.gain.value = options.drive;
	waveshaper.curve = curve;
	filter1.type = "highpass";
	filter2.type = "highpass";
	filter3.type = "lowpass";
	filter1.Q.value = filter2.Q.value = filter3.Q.value = options.q;
	filter1.frequency.value = filter2.frequency.value = filter3.frequency.value = options.frequency;
	dry.gain.value = 1;
	wet.gain.value = 1;

	input.connect(filter1);
	input.connect(filter3);
	filter1.connect(drive);
	drive.connect(waveshaper);
	waveshaper.connect(filter2);
	filter2.connect(wet);
	filter3.connect(dry);
	dry.connect(output);
	wet.connect(output);

	AudioObject.call(this, audio, input, output, {
		drive: drive.gain,
		wet:   wet.gain,
		dry:   dry.gain,
		frequency: {
			get: function() {
				return filter1.frequency.value;
			},
			set: function(hz) {
				filter1.frequency.value = filter2.frequency.value = filter3.frequency.value = hz;
			}
		}
	});

	Object.defineProperties(this, {
		type: { value: 'saturate', enumerable: true },
		//drive: { value: drive.gain, enumerable: true, configurable: true },
		//input: { value: input },
		//output: { value: output },
		//wet: { value: wet.gain, enumerable: true, configurable: true },
		//dry: { value: dry.gain, enumerable: true, configurable: true },
		shape: {
			get: function() {
				return shapeName;
			},

			set: function(name) {
				shapeName = name;
				this.transform = shapes[shapeName].apply(this, params);
				populateCurve(curve, this.transform);
			},
			
			enumerable: true,
			configurable: true
		},
		shapes: { value: Object.keys(shapes) },
		transform: {
			value: transform,
			configurable: true,
			writable: true
		},
		destroy: {
			value: function() {
				input.disconnect();
				drive.disconnect();
				output.disconnect();
				wet.disconnect();
				dry.disconnect();
				waveshaper.disconnect();
				filter1.disconnect();
				filter2.disconnect();
				filter3.disconnect();
			}
		}
	});

	var l = params.length;

	while (l--) {
		(function(l) {
			Object.defineProperty(this, l, {
				get: function() { return params[l]; },
				set: function(n) {
					params[l] = n;
					this.transform = shapes[shapeName].apply(this, params);
					populateCurve(curve, this.transform);
				},
				configurable: true,
				enumerable: true
			});
		})(l);
	}

	return this;
}

Saturate.prototype = AudioObject.prototype;

Saturate.defaults = {
	'frequency':     { min: 16,  max: 16384, transform: 'logarithmic', value: 1000 },
	'drive':         { min: 0.5, max: 8,     transform: 'cubic',       value: 1 },
	'wet':           { min: 0,   max: 2,     transform: 'cubic',       value: 1 }
};

export default Saturate;

