(function(window) {
	"use strict";
	
	var AudioObject = window.AudioObject;

	function Pan(audio, settings) {
		var options = assign({}, defaults, settings);
		var node;

		if (audio.createStereoPanner) {
			node  = audio.createStereoPanner();
			node.pan.value = options.angle;
		}
		else {
			node  = audio.createPanner();
			node.panningModel = 'equalpower';
		}

		AudioObject.call(this, audio, node, node, {
			angle: audio.createStereoPanner ?
				node.pan :
				{
					set: function(value) {
						var angle = value > 90 ? 90 : value < -90 ? -90 : value ;
						var x = Math.sin(angle * pi / 180);
						var y = 0;
						var z = Math.cos(angle * pi / 180);
						pan.setPosition(x, y, z);
					},

					value: options.angle,
					duration: 0
				},
		});
	}

	AudioObject.Pan = Pan;
})(this);