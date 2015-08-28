(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

(function () {
	"use strict";

	var defaults = {
		defaultValue: 1,
		maxValue: 1,
		minValue: 0,
		name: "",
		units: 0,
		value: 1
	};

	var extend = Object.assign;

	var prototype = {
		cancelScheduledValues: function cancelScheduledValues() {},
		exponentialRampToValueAtTime: function exponentialRampToValueAtTime() {},
		linearRampToValueAtTime: function linearRampToValueAtTime() {},
		setTargetAtTime: function setTargetAtTime() {},
		setValueAtTime: function setValueAtTime() {},
		setValueCurveAtTime: function setValueCurveAtTime() {}
	};

	function isDefined(val) {
		return val !== undefined && val !== null;
	}

	function AudioParamSim(fn, options) {
		extend(this, defaults, options);

		var value = isDefined(options.value) ? options.value : defaults.value;

		Object.defineProperty(this, 'value', {
			get: function get() {
				return value;
			},

			set: function set(n) {
				value = n;
				fn.call(this, n);
			}
		});
	}

	AudioParamSim.prototype = prototype;
	window.AudioParamSim = AudioParamSim;
})();

},{}]},{},[1]);
