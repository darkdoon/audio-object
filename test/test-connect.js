module('AudioObject', function(fixture) {

	var audio = new window.AudioContext();
	var cache = [];

	// We're going to test .connect() and .disconnect() by feeding a signal
	// through a couple of audio nodes and seeing if we can detect it coming
	// out the other end.

	// Set up oscillator

	var n0 = audio.createOscillator();

	n0.start();

	// Set up script processor

	var n1 = createScriptProcessor(audio, 512);
	var signal, buffer;

	function sum(a, b) { return a + b; }

	function process(node, buffers) {
		var n = node.channelCount;
		var level;

		while (n--) {
			buffer = buffers.getChannelData(n);
			if (Array.prototype.reduce.call(buffer, sum, 0) !== 0) {
				// There is signal!
				signal = true;
				return;
			}
		}

		signal = false;
	}

	function isReceivingSignal() {
		return signal;
	}

	function createScriptProcessor(audio, count) {
		var node = audio.createScriptProcessor(count);

		// Script nodes should be kept in memory to avoid Chrome bugs
		cache.push(node);
	
		node.onaudioprocess = function(e) {
			process(node, e.inputBuffer);
		};
	
		// Script nodes do nothing unless connected in Chrome due to a bug. This
		// will have no effect, since we don't pass the input to the output.
		node.connect(audio.destination);
		node.channelCountMode = "explicit";
		node.channelInterpretation = "discrete";
		return node;
	}


	// Set up the other destination node

	var n2 = audio.createGain();


	// Create an AudioObject and test it

	var object0 = AudioObject(audio, undefined, n0);
	var object1 = AudioObject(audio, n1);

	asyncTest('Testing .connect(node)', 1, function() {
		object0.connect(n1);
		setTimeout(function() {
			ok(isReceivingSignal(), 'Not receiving any signal! Buffer sum: ' + (Array.prototype.reduce.call(buffer, sum, 0)));
			start();
		}, 50);
	});

	asyncTest('Testing .disconnect()', 1, function() {
		object0.disconnect();
		setTimeout(function() {
			ok(!isReceivingSignal(), 'Signal should have been disconnected.');
			start();
		}, 50);
	});

	asyncTest('Testing .disconnect(node)', 1, function() {
		object0.connect(n1);
		object0.connect(n2);
		object0.disconnect(n2);
		setTimeout(function() {
			ok(isReceivingSignal(), 'Not receiving any signal! Buffer sum: ' + (Array.prototype.reduce.call(buffer, sum, 0)));
			start();
		}, 50);
	});

	asyncTest('Testing .disconnect(node)', 4, function() {
		object0.connect(n1);
		object0.connect(n2);

		var map = AudioObject.connections.get(object0)[0];

		ok(map.get(n1), 'n1 should be in the connections map.');
		ok(map.get(n2), 'n2 should be in the connections map.');

		object0.disconnect(n1);

		ok(map.get(n1) === undefined, 'n1 should not be in the connections map.');

		setTimeout(function() {
			ok(!isReceivingSignal(), 'Signal should have been disconnected.');
			start();
		}, 50);
	});

	asyncTest('Testing .connect(object)', 1, function() {
		object0.disconnect();
		object0.connect(object1);
		setTimeout(function() {
			ok(isReceivingSignal(), 'Not receiving any signal! Buffer sum: ' + (Array.prototype.reduce.call(buffer, sum, 0)));
			start();
		}, 50);
	});

	asyncTest('Testing .disconnect()', 1, function() {
		object0.disconnect();
		setTimeout(function() {
			ok(!isReceivingSignal(), 'Signal should have been disconnected.');
			start();
		}, 50);
	});

	asyncTest('Testing .disconnect(object)', 1, function() {
		object0.connect(object1);
		object0.connect(n2);
		object0.disconnect(n2);
		setTimeout(function() {
			ok(isReceivingSignal(), 'Not receiving any signal! Buffer sum: ' + (Array.prototype.reduce.call(buffer, sum, 0)));
			start();
		}, 50);
	});

	asyncTest('Testing .disconnect(object) and checking the connections map', 5, function() {
		object0.connect(object1);
		object0.connect(n2);

		var map = AudioObject.connections.get(object0)[0];

		var o1 = map.get(object1);
		ok(o1 === undefined, 'o1 should not be in the connections map.');

		var c1 = map.get(n1);
		ok(c1, 'c1 should be a something... an array, maybe?');

		var c2 = map.get(n2);
		ok(c2, 'c2 should be a something... an array, maybe?');

		object0.disconnect(object1);

		c1 = map.get(n1);
		ok(c1 === undefined, 'c1 should not be in the connections map.');

		setTimeout(function() {
			ok(!isReceivingSignal(), 'Signal should have been disconnected.');
			start();
		}, 50);
	});
});