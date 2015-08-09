module('AudioObject', function(fixture) {

	var audio = new window.AudioContext();

	var n1 = audio.createGain();
	var n2 = audio.createGain();

	// Create an AudioObject and test it

	test('Testing AudioObject(audio, node, node)', 3, function() {
		var object = AudioObject(audio, n1, n2);

		ok(object.automate);
		ok(AudioObject.inputs.get(object), 'No inputs registered!');
		ok(AudioObject.outputs.get(object), 'No outputs registered!');
	});

	test('Testing AudioObject(audio, undefined, node)', 3, function() {
		var object = AudioObject(audio, undefined, n2);

		ok(object.automate);
		ok(!AudioObject.inputs.get(object), 'Inputs registered in AudioObject.inputs. They should not be.');
		ok(AudioObject.outputs.get(object), 'No outputs registered in AudioObject.outputs.');
	});

	test('Testing AudioObject(audio, node, undefined)', 3, function() {
		var object = AudioObject(audio, n1, undefined);

		ok(object.automate);
		ok(AudioObject.inputs.get(object), 'No inputs registered in AudioObject.inputs.');
		ok(!AudioObject.outputs.get(object), 'Outputs registered in AudioObject.outputs. They should not be.');
	});
});