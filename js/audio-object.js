(function(window) {
	if (!window.console || !window.console.log) { return; }
	console.log('AudioObject - http://github.com/soundio/audio-object');
})(window);

(function(window) {
	"use strict";

	if (!window.AudioContext) { return; }

	// Import
	
	var Fn     = window.Fn;
	var cache  = Fn.cache;
	var curry  = Fn.curry;
	var Music  = window.Music;
	var assign = Object.assign;


	// Define

	var defaults = {
		duration: 0.008,
		curve: 'linear'
	};

	var minExponentialValue = 1.4013e-45;


	// Functions

	var noop      = Fn.noop;
	var isDefined = Fn.isDefined;

	function fetch(url) {
		return new Promise(function(accept, reject) {
			var request = new XMLHttpRequest();
			request.open('GET', url, true);
			request.responseType = 'arraybuffer';
			request.onload = function() { accept(request.response); };
			request.onerror = function() { reject(request.response); };
			request.send();
		});
	}

	function isAudioContext(object) {
		return window.AudioContext && window.AudioContext.prototype.isPrototypeOf(object);
	}

	function isAudioNode(object) {
		return window.AudioNode && window.AudioNode.prototype.isPrototypeOf(object);
	}

	function isAudioParam(object) {
		return window.AudioParam && window.AudioParam.prototype.isPrototypeOf(object);
	}

	function isAudioObject(object) {
		return AudioObject.prototype.isPrototypeOf(object);
	}


	// Feature tests

	function testDisconnectParameters() {
		var audio = new AudioContext();

		try {
			// This will error if disconnect(parameters) is supported
			// because it is not connected to audio destination.
			audio.createGain().disconnect(audio.destination);
			return false;
		} catch (error) {
			return true;
		}
	}


	// AudioNode

	function UnityNode(audio) {
		var oscillator = audio.createOscillator();
		var waveshaper = audio.createWaveShaper();
	
		var curve = new Float32Array(2);
		curve[0] = curve[1] = 1;
	
		oscillator.type = 'square';
		oscillator.connect(waveshaper);
		oscillator.frequency.value = 100;
		waveshaper.curve = curve;
		oscillator.start();
	
		return waveshaper;
	}

	// AudioParam

	var longnames = {
		"step":        "setValueAtTime",
		"linear":      "linearRampToValueAtTime",
		"exponential": "exponentialRampToValueAtTime",
		"target":      "setTargetAtTime"
	};

	var curves = {
		// Automation curves as described at:
		// http://webaudio.github.io/web-audio-api/#h4_methods-3

		'step': function stepValueAtTime(value1, value2, time1, time2, time) {
			return time < time2 ? value1 : value2 ;
		},

		'linear': function linearValueAtTime(value1, value2, time1, time2, time) {
			return value1 + (value2 - value1) * (time - time1) / (time2 - time1) ;
		},

		'exponential': function exponentialValueAtTime(value1, value2, time1, time2, time) {
			return value1 * Math.pow(value2 / value1, (time - time1) / (time2 - time1)) ;
		},

		'target': function targetValueAtTime(value1, value2, time1, time2, time, duration) {
			return time < time2 ?
				value1 :
				value2 + (value1 - value2) * Math.pow(Math.E, -(time - time2) / duration);
		},

		'decay': function targetValueAtTime(value1, value2, time1, time2, time, duration) {
			return time < time2 ?
				value1 :
				value2 + (value1 - value2) * Math.pow(Math.E, -(time - time2) / duration);
		}
	};

	function getValueBetweenEvents(event1, event2, time) {
		var curve  = event2[2];
		return curves[curve](event1[1], event2[1], event1[0], event2[0], time, event1[3]);
	}

	function getValueAtEvent(events, n, time) {
		var event = events[n];

		return event[2] === "target" ?
			curves.target(getValueAtEvent(events, n - 1, event[0]), event[1], 0, event[0], time, event[3]) :
			event[1] ;
	}

	function getValueAtTime(events, time) {
		var n = events.length;

		while (events[--n] && events[n][0] >= time);

		var event1 = events[n];
		var event2 = events[n + 1];

		if (!event2) {
			return getValueAtEvent(events, n, time);
		}

		if (event2[0] === time) {
			// Spool through to find last event at this time
			while (events[++n] && events[n][0] === time);
			return getValueAtEvent(events, --n, time) ;
		}

		if (time < event2[0]) {
			return event2[2] === "linear" || event2[2] === "exponential" ?
				getValueBetweenEvents(event1, event2, time) :
				getValueAtEvent(events, n, time) ;
		}
	}

	function getParamEvents(param) {
		// Todo: I would love to use a WeakMap to store data about AudioParams,
		// but FF refuses to allow AudioParams as WeakMap keys. So... lets use
		// an expando *sigh*.

		//var events = paramEvents.get(param);
		var events = param.audioObjectEvents;

		if (!events) {
			events = [[0, param.value, 'step']];
			//paramEvents.set(param, events);
			param.audioObjectEvents = events;
		}

		return events;
	}

	function automateParamEvents(param, events, time, value, curve, duration) {
		curve = curve || "step";

		var n = events.length;

		while (events[--n] && events[n][0] >= time);

		var event1 = events[n];
		var event2 = events[n + 1];

		// Swap exponential to- or from- 0 values for step
		// curves, which is what they tend towards for low
		// values. This does not deal with -ve values,
		// however. It probably should.
		if (curve === "exponential") {
			if (value < minExponentialValue) {
				time = event1 && event1[0] || 0 ;
				curve = "step";
			}
			else if (event1 && event1[1] < minExponentialValue) {
				curve = "step";
			}
		}

		// Schedule the param event - curve is shorthand for one of the
		// automation methods
		param[longnames[curve]](value, time, duration);

		// Keep events organised as AudioParams do
		var event = [time, value, curve, duration];

		// If the new event is at the end of the events list
		if (!event2) {
			events.push(event);
			return;
		}

		// If the new event is at the same time as an
		// existing event spool forward through events at
		// this time and if an event with the same curve is
		// found, replace it
		if (event2[0] === time) {
			while (events[++n] && events[n][0] === time) {
				if (events[n][2] === curve) {
					events.splice(n + 1, 1, event);
					return;
				}
			}

			--n;
		}

		// The new event is between event1 and event2
		events.splice(n + 1, 0, event);
	}


	// AudioProperty

	function defineAudioProperty(object, name, audio, data) {
		var param = isAudioParam(data) ? data : data.param ;

		if (param ? !isAudioParam(param) : !data.set) {
			throw new Error(
				'AudioObject.defineAudioProperty requires EITHER data.param ' +
				'to be an AudioParam OR data.set to be a function.'
			);
		}

		var defaultDuration = isDefined(data.duration) ? data.duration : defaults.duration ;
		var defaultCurve = data.curve || defaults.curve ;
		var value = param ? param.value : data.value || 0 ;
		var events = param ? getParamEvents(param) : [[0, value, 'step']];

		function set(value, time, curve, duration) {
			curve = curve || defaultCurve;

			if (param) {
				automateParamEvents(param, events, time, value, curve, duration);
			}
			else {
				data.set.apply(object, arguments);
				events.push([time, value, curve, duration]);
			}
		}

		function frame() {
			var currentValue = getValueAtTime(events, audio.currentTime);

			// Stop updating if value has reached param value
			if (value === currentValue) { return; }

			// Castrate the calls to automate the value, then call the setter
			// with the param's current value. Done like this, where the setter
			// has been redefined externally it nonetheless gets called with
			// automated values.
			var _automate = automate;
			automate = noop;

			// Set the property. This is what causes observers to be called.
			object[name] = currentValue;

			// Replace automate and cue animation frame update
			automate = _automate;
			window.requestAnimationFrame(frame);
		}

		var automate = function automate(value, time, curve, duration) {
			time     = isDefined(time) ? time : audio.currentTime;
			duration = isDefined(duration) ? duration : defaultDuration;
			set(value, time, curve || data.curve, duration);
			window.requestAnimationFrame(frame);
		};

		setObjectParam(object, name, param || data);
		setAutomate(param || data, automate);

		Object.defineProperty(object, name, {
			// Return value because we want values that have just been set
			// to be immediately reflected by get, even if they are being
			// quickly automated.
			get: function() { return value; },

			set: function(val) {
				// If automate is not set to noop this will launch an
				// automation.
				automate(val);
				value = val;
			},

			enumerable: isDefined(data.enumerable) ? data.enumerable : true,
			configurable: isDefined(data.configurable) ? data.configurable : true
		});

		return object;
	}

	function defineAudioProperties(object, audio, data) {
		var name;

		for (name in data) {
			AudioObject.defineAudioProperty(object, name, audio, data[name]);
		}

		return object;
	}


	// AudioObject

	var inputs       = new WeakMap();
	var outputs      = new WeakMap();
	var objectParams = new WeakMap();

	function defineInputs(object, properties) {
		var map = inputs.get(object);

		if (!map) {
			map = {};
			inputs.set(object, map);
		}

		assign(map, properties);
	}

	function defineOutputs(object, properties) {
		var map = outputs.get(object);

		if (!map) {
			map = {};
			outputs.set(object, map);
		}

		assign(map, properties);
	}

	function getInput(object, name) {
		var map = inputs.get(object);
		return map && map[isDefined(name) ? name : 'default'];
	}

	function getOutput(object, name) {
		var map = outputs.get(object);
		return map && map[isDefined(name) ? name : 'default'];
	}

	function setObjectParam(object, name, param) {
		var params = objectParams.get(object);

		if (!params) {
			params = {};
			objectParams.set(object, params);
		}

		params[name] = param;
	}

	function getObjectParam(object, name) {
		var params = objectParams.get(object);
		return params && params[name];
	}

	function setAutomate(param, fn) {
		// Todo: I would love to use a WeakMap to store data about AudioParams,
		// but FF refuses to allow AudioParams as WeakMap keys. So... lets use
		// an expando *sigh*. At least it'll be fast.
		
		//automatorMap.set(param, fn);
		param.audioObjectAutomateFn = fn;
	}

	function getAutomate(param, name) {
		//return automatorMap.get(param);
		return param.audioObjectAutomateFn;
	}

	function AudioObject(audio, input, output, params) {
		if (!isAudioObject(this)) {
			return new AudioObject(audio, input, output, params);
		}

		if (!(input || output)) {
			throw new Error('AudioObject: new AudioObject() must be given an input OR output OR both.');
		}

		// Keep a map of inputs in AudioObject.inputs. Where we're using
		// AudioObject as a mixin, extend the inputs object if it already
		// exists.
		var inputs1, inputs2;

		if (input) {
			inputs1 = isAudioNode(input) ? { default: input } : input ;
			inputs2 = inputs.get(this);

			if (inputs2) {
				assign(inputs2, inputs1);
			}
			else {
				inputs.set(this, assign({}, inputs1));
			}
		}

		// Keep a map of outputs in AudioObject.outputs. Where we're using
		// AudioObject as a mixin, extend the inputs object if it already
		// exists.
		var outputs1, outputs2;

		if (output) {
			outputs1 = isAudioNode(output) ? { default: output } : output ;
			outputs2 = outputs.get(this);

			if (outputs2) {
				assign(outputs2, outputs1);
			}
			else {
				outputs.set(this, assign({}, outputs1));
			}
		}

		// Define Audio Params as getters/setters
		if (params) {
			AudioObject.defineAudioProperties(this, audio, params);
		}

		Object.defineProperty(this, 'audio', { value: audio });
	}

	assign(AudioObject.prototype, {
		start:   noop,
		stop:    noop,
		destroy: noop,

		automate: function(time, name, value, curve, duration) {
			var param = getObjectParam(this, name);

			if (!param) {
				if (AudioObject.debug) { console.warn('AudioObject: cannot .automate(), no param "' + name + '"'); }
				return;
			}

			var automate = getAutomate(param);

			if (!automate) {
				if (AudioObject.debug) { console.warn('AudioObject: cannot .automate(), param "' + name + '" has no automate fn'); }
				return;
			}

			// Swap exponential to- or from- 0 values for step
			// curves, which is what they tend towards for low
			// values. This does not deal with -ve values,
			// however. It probably should.
			if (curve === "exponential") {
				if (value < minExponentialValue) {
					curve = "step";
				}
			}

			automate(value, time, curve, duration);
			return this;
		},

		valueAtTime: function(name, time) {
			var param  = getObjectParam(this, name);
			if (!param) { return; }
			var events = getParamEvents(param);
			if (!events) { return; }
			return getValueAtTime(events, time);
		}
	});


	// Handle user media streams

	var streamRequest;
	var mediaRequests = new WeakMap();

	function requestStream() {
		if (!streamRequest) {
			streamRequest = new Promise(function(accept, reject) {
				return navigator.getUserMedia ?
					navigator.getUserMedia({
						audio: { optional: [{ echoCancellation: false }] }
					}, accept, reject) :
					reject({
						message: 'navigator.getUserMedia: ' + !!navigator.getUserMedia
					});
			});
		}

		return streamRequest;
	}

	function requestMedia(audio) {
		var request = mediaRequests.get(audio);

		if (!request) {
			request = requestStream().then(function(stream) {
				var source       = audio.createMediaStreamSource(stream);
				var channelCount = source.channelCount;
				var splitter     = audio.createChannelSplitter(channelCount);

				source.connect(splitter);
				return splitter;
			});

			mediaRequests.set(audio, request);
		}

		return request;
	}

	assign(AudioObject, {
		debug: true,

		// Functions

		defineInputs:      defineInputs,
		defineOutputs:     defineOutputs,
		defineAudioProperty: defineAudioProperty,
		defineAudioProperties: defineAudioProperties,
		getInput:          getInput,
		getOutput:         getOutput,
		isAudioContext:    isAudioContext,
		isAudioNode:       isAudioNode,
		isAudioParam:      isAudioParam,
		isAudioObject:     isAudioObject,
		requestMedia:      requestMedia,

		numberToFrequency: Music.numberToFrequency,
		frequencyToNumber: Music.frequencyToNumber,

		features: {
			disconnectParameters: testDisconnectParameters()
		},

		fetchBuffer: curry(function fetchBuffer(audio, url) {
			return fetch(url).then(function(response) {
				return new Promise(function(accept, reject) {
					audio.decodeAudioData(response, accept, reject);
				});
			});
		}, 2, false),

		UnityNode: cache(UnityNode)
	});

	Object.defineProperty(AudioObject, 'minExponentialValue', {
		value: minExponentialValue,
		enumerable: true
	});

	window.AudioObject = AudioObject;
})(this);
