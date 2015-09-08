describe('AudioObject', function () {

  var audio, n1, n2;
  var AudioObject;

  beforeEach(function() {
    audio = new window.AudioContext();
    n1 = audio.createGain();
    n2 = audio.createGain();
    // We can replace this with ES6 imports later
    AudioObject = window.AudioObject;
  });

  describe('constructor', function() {

    it('should link input and output', function() {
      var object = AudioObject(audio, n1, n2);
      
      expect(AudioObject.getInput(object)).toEqual(n1);
      expect(AudioObject.getOutput(object)).toEqual(n2);
    });
  });
});