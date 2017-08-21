(function(window) {
	"use strict";

	var AudioObject = window.AudioObject;

	var cache = [];

	// Signal Detector Audio object

	function SignalDetector(audio) {
		var object = this;
		var scriptNode = audio.createScriptProcessor(256, 1, 1);
		var signal;

		scriptNode.channelCountMode = "explicit";

		// Script nodes should be kept in memory to avoid
		// Chrome bugs, and also need to be connected to
		// destination to avoid garbage collection. This is
		// ok, as we're not sending any sound out of this
		// script node.
		cache.push(scriptNode);
		scriptNode.connect(audio.destination);

		scriptNode.onaudioprocess = function(e) {
			var buffer = e.inputBuffer.getChannelData(0);
			var n = buffer.length;

			while (n--) {
				if (buffer[n] !== 0) {
					object.signal = true;
					return;
				}
			}

			object.signal = false;
		};

		AudioObject.call(this, audio, scriptNode);

		this.signal = false;

		this.destroy = function() {
			scriptNode.disconnect();
			var i = cache.indexOf(scriptNode);
			if (i > -1) { cache.splice(i, 1); }
		};
	}

	SignalDetector.prototype = AudioObject.prototype;
	AudioObject.SignalDetector = SignalDetector;
})(this);