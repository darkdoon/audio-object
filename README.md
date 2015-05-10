# audio-object
A wrapper for graphs of AudioNodes that exposes their AudioParams as
getter/setters on an object.

## The problem

In Web Audio, changes to AudioParam values are difficult to observe.
Neither <code>Object.observe</code> nor redefining them as getters/setters will
work (for good performance reasons, as observers could potentially be called
at the sample rate).

An audioObject provides an observable interface to graphs of AudioNodes and
AudioParams. Changes to the properties of an audioObject are reflected
immediately in the audio graph, but observers of those properties are notified
of the changes at the browser's frame rate. That's good for creating UIs.

## AudioObject(inputNode, outputNode, params);

Here is a simple example of a compressor and a gain wrapped into a single
audio object:

    function createCompressGain() {
        var compressor = audio.createCompressor();
        var gain = audio.createGain();

        compressor.connect(gain);

        return AudioObject(compressor, gain, {
            threshold: compressor.threshold,
            ratio: compressor.ratio,
            level: gain.gain
        });
    }

    var effect = createCompressGain();


Now the audioObject <code>effect</code> is a 'flat' object with properties:

    {
        threshold: -20,
        ratio: 8,
        level: 1
    }

Easy to JSON-ify. Easy to observe. It also has a few methods.

### audioObject methods

#### .automate(name, value, duration, [curve])

Automate a property. The named property will ramp to the new <code>value</code>
from it's current value over <code>duration</code> (in seconds). The optional
parameter <code>code</code> can be either <code>'linear'</code> (the default) or
<code>'exponential'</code>. Exponential curves can only be used on positive
non-zero values.

    effect.automate('level', 0, 1.2)

#### .connect(audioObject | audioNode)

Like <code>node1.connect(node2)</code>, but an audioObject will accept either
a Web Audio node or another audioObject to connect to.

The outputNode that was passed into the <code>AudioObject()</code> constructor
is connected directly to the audioNode or audioObject's input node.

    var delay = audioContext.createDelay();
    effect.connect(delay);

#### .disconnect()

Like <code>node1.disconnect()</code>. Calls <code>.disconnect()</code> on the
outputNode.

    effect.disconnect(delay);

#### .destroy()

Destroy is a noop by default. Override it so that when it is called it destroys
your audio graph.

### AudioObject Functions

#### AudioObject.isAudioObject(object)

Returns <code>true</code> if <code>object</code> is an instance of <code>AudioObject</code>.

#### AudioObject.defineAudioProperties(object, audioContext, audioParams)

This functions takes a map of audio params and defines getters and setters on
<code>object</code> that are bound to their values. It's used by the
<code>AudioObject()</code> constructor to set up and audio object.


    var object = {};

    AudioObject.defineAudioProperties(object, audioContext, {
        ratio: compressor.ratio,
        level: gain.gain
    });

Returns <code>object</code>.

#### AudioObject.defineAudioProperty(object, name, audioContext, audioParam)

As <code>.defineAudioProperties()</code>, but defines a single property with
name <code>name</code>. Returns <code>object</code>.

### Properties

#### AudioObject.inputs = inputs;
#### AudioObject.outputs = outputs;

WeakMaps where input and output nodes for audio objects are stored. Normally
you will not need to touch these. They are used internally by
<code>.connect()</code> and <code>.disconnect()</code>.

