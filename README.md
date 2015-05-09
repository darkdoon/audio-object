# audio-object
A thin wrapper for sub-graphs of AudioNodes that exposes their AudioParams as
simple getter/setters on a vanilla JS object and updates their values using.

## The problem

The WebAudio graph was always intended to be wrapped and built upon. AudioNodes
and AudioParams have some idiosyncrasies that relate to the way they represent
things that are happening in a separate thread.

Changes AudioParam values cannot be observed, either by
<code>Object.observe</code> nor by redefining as getters/setters, but only by
polling. This is for a very good reason: a-rate params can change at the sample
rate of the audio system – potentially 192,000 times a second – and observing
them would have your JavaScript tripping over itself.

AudioObject provides an observable interface to sub-graphs of AudioNodes and
AudioParams.

AudioParam values are polled at the browser frame rate for just the duration of
any transition, and their values exposed as properties of AudioObject.

## AudioObject(input, output, params);

Here is a simple example of a compressor and a gain stage wrapped into a single
object:

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

    effect = createCompressGain();


That results in a 'flat' object <code>effect</code> that looks like this:

    {
        threshold: -20,
        ratio: 8,
        level: 1
    }

Easy to JSON-ify. Easy to observe.

### Methods

#### .automate(name, value, duration, [curve])

Automate a property. The named property will ramp to the new <code>value</code>
from it's current value over <code>duration</code> (in seconds). The optional
parameter <code>code</code> can be either <code>'linear'</code> (the default) or
<code>'exponential'</code>. Exponential curves can only be used on positive
non-zero values.

#### .connect(audioObject | audioNode)


#### .disconnect()



#### .destroy()

Destroy is a noop by default. Override it to disconnect all the nodes in your
sub-graph.

### Functions

#### AudioObject.defineAudioProperties(object, audioContext, audioParams)

Used by the <code>AudioObject()</code>, this functions takes a map of audio
params and defines getters and setters on <code>object</code> to control the
param values.

    var object = {};

    AudioObject.defineAudioProperties(object, audioContext, {
        ratio: compressor.ratio,
        level: gain.gain
    });

Returns <code>object</code>.

#### AudioObject.defineAudioProperty(object, name, audioContext, audioParam)

As <code>.defineAudioProperties()</code>, but defines a single property with
name <code>name</code>. Returns <code>object</code>.

#### AudioObject.nodes

A WeakMap where WebAudio graph nodes are stored. Normally you will not need to
touch this. It is used internally by <code>.connect()</code> and
<code>.disconnect()</code>. It is also useful for debugging.

	var effect = createCompressGain();
    var data = AudioObject.nodes.get(effect);

    // {
    //     input: compressorNode,
    //     output: gainNode
    // }
