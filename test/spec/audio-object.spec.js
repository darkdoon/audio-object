describe('AudioObject', function () {

  let audio, n1, n2;
  let AudioObject;

  beforeEach(() => {
    audio = new window.AudioContext();
    n1 = audio.createGain();
    n2 = audio.createGain();
    // We can replace this with ES6 imports later
    AudioObject = window.AudioObject;
  });

  describe('constructor', function () {

    it('should link input and output', ()=>{
      var object = AudioObject(audio, n1, n2);
      
      expect(AudioObject.getInput(object)).toEqual(n1);
      expect(AudioObject.getOutput(object)).toEqual(n2);
    });
  });
});