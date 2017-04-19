(function(window) {
	"use strict";

	var AudioObject = window.AudioObject;
	var assign = Object.assign;
	var defaults = { gain: 1 };

	function Gain(audio, settings) {
		var options = assign({}, defaults, settings);
		var node = audio.createGain();

		AudioObject.call(this, audio, node, node, {
			gain: {
				param: node.gain,
				curve: 'exponential'
			}
		});

		this.destroy = function destroy() {
			node.disconnect();
		};
	}

	Gain.prototype = AudioObject.prototype;
	AudioObject.Gain = Gain;
})(this);