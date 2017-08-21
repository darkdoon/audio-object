(function(window) {
	"use strict";

	function Dummy(audio, settings, sequencer) {
		this.start = function(time, name, velocity) {
			console.log('dummy.start()', time, name, velocity);
		};

		this.stop = function(time, name) {
			console.log('dummy.stop() ', time, name);
		};
	}

	Dummy.prototype = Object.create(AudioObject.prototype);
	AudioObject.Dummy = Dummy;
})(this);
