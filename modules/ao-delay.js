
var assign = Object.assign;
var AudioObject = window.AudioObject;
var defaults = { maxDelay: 1, delay: 0 };

function Delay(audio, settings, sequencer) {
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

Delay.prototype = Object.create(AudioObject.prototype);

Delay.defaults  = {
	delay: { min: 0, max: 2, transform: 'linear', value: 0.020 }
};

export default Delay;
