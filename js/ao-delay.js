(function(window) {
	"use strict";

	var assign = Object.assign;
	var AudioObject = window.AudioObject;
	var defaults = { maxDelay: 1, delay: 0 };

	function Delay(audio, settings, clock) {
		var options = assign({}, defaults, settings);
		var node = audio.createDelay(options.maxDelay);

		node.delayTime.setValueAtTime(options.delay, 0);

		AudioObject.call(this, audio, node, node, {
			delay: node.delayTime
		});

		Object.defineProperties(this, {
			maxDelay: { value: options.maxDelay, enumerable: true }
		});
	}

	Delay.prototype = Obect.create(AudioObject.prototype);

	AudioObject.Delay = Delay;
})(this);