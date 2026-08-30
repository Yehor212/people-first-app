"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CLOUDLIGHT_V2_CANDIDATE_SPECS = Object.freeze([
  Object.freeze({
    id: "cloudlight-v2-a-felt-hall",
    displayName: "A - Felt Hall",
    fileName: "cloudlight-v2-a-felt-hall.mp3",
    durationSeconds: 150,
    tempoBpm: 58,
    minimumForegroundGapSeconds: 2.4,
    reverbT60Seconds: 8.4,
    tonalCenterMidi: 62,
    eventSeed: 0xc102a11,
    feltBrightness: 0.5,
    roomMix: 0.42,
    pedalResonance: 0.68,
    targetRms: 0.042,
    targetPeak: 0.28,
    loopCrossfadeSeconds: 5.5,
    referenceWaveformInput: null,
  }),
  Object.freeze({
    id: "cloudlight-v2-b-cloud-hall",
    displayName: "B - Cloud Hall",
    fileName: "cloudlight-v2-b-cloud-hall.mp3",
    durationSeconds: 150,
    tempoBpm: 60,
    minimumForegroundGapSeconds: 2.1,
    reverbT60Seconds: 9.2,
    tonalCenterMidi: 64,
    eventSeed: 0xc102b22,
    feltBrightness: 0.44,
    roomMix: 0.5,
    pedalResonance: 0.76,
    targetRms: 0.04,
    targetPeak: 0.27,
    loopCrossfadeSeconds: 6.5,
    referenceWaveformInput: null,
  }),
  Object.freeze({
    id: "cloudlight-v2-c-warm-haze",
    displayName: "C - Warm Haze",
    fileName: "cloudlight-v2-c-warm-haze.mp3",
    durationSeconds: 150,
    tempoBpm: 61,
    minimumForegroundGapSeconds: 1.9,
    reverbT60Seconds: 7.6,
    tonalCenterMidi: 59,
    eventSeed: 0xc102c33,
    feltBrightness: 0.34,
    roomMix: 0.36,
    pedalResonance: 0.62,
    targetRms: 0.043,
    targetPeak: 0.29,
    loopCrossfadeSeconds: 5,
    referenceWaveformInput: null,
  }),
]);

const HARMONY_INTERVALS_BY_CANDIDATE = Object.freeze({
  "cloudlight-v2-a-felt-hall": Object.freeze([
    [0, 4, 7, 14],
    [-3, 4, 9, 14],
    [-5, 2, 7, 11],
    [-8, -1, 4, 9],
    [-3, 2, 7, 12],
  ]),
  "cloudlight-v2-b-cloud-hall": Object.freeze([
    [0, 3, 7, 10],
    [-4, 3, 8, 14],
    [-7, 0, 5, 10],
    [-2, 5, 9, 12],
    [-5, 2, 7, 10],
  ]),
  "cloudlight-v2-c-warm-haze": Object.freeze([
    [0, 4, 9, 14],
    [-5, 2, 7, 11],
    [-3, 4, 9, 12],
    [-8, -1, 4, 11],
    [-2, 5, 9, 14],
  ]),
});

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function getHarmonyIntervals(spec) {
  const fields = HARMONY_INTERVALS_BY_CANDIDATE[spec.id];
  if (!fields) throw new Error("Unknown Cloudlight v2 candidate: " + spec.id);
  return fields;
}

function buildMidiPool(spec, intervals) {
  const center = spec.tonalCenterMidi + 5;
  const pool = [];
  for (const interval of intervals) {
    for (const octaveOffset of [-12, 0, 12]) {
      const midi = center + interval + octaveOffset;
      if (midi >= 53 && midi <= 84) pool.push(midi);
    }
  }
  return [...new Set(pool)].sort((left, right) => left - right);
}

function chooseVoiceLedMidi(pool, previousMidi, random) {
  if (!Number.isFinite(previousMidi)) {
    return pool[Math.floor(random() * pool.length)];
  }
  return pool
    .map((midi) => ({ midi, score: Math.abs(midi - previousMidi) + random() * 5.5 }))
    .sort((left, right) => left.score - right.score)[0].midi;
}

function getCloudlightV2CandidateSpecs() {
  return CLOUDLIGHT_V2_CANDIDATE_SPECS.map((spec) => ({ ...spec }));
}

function buildCloudlightV2Composition(spec) {
  if (!Number.isFinite(spec.eventSeed) || !Number.isFinite(spec.tonalCenterMidi)) {
    throw new Error("Cloudlight v2 composition requires a complete candidate spec");
  }
  const intervalFields = getHarmonyIntervals(spec);
  const harmonicFields = intervalFields.map((intervals) => ({
    intervals: [...intervals],
    pitchClasses: [
      ...new Set(intervals.map((interval) => modulo(spec.tonalCenterMidi + interval, 12))),
    ].sort((left, right) => left - right),
  }));
  harmonicFields.push({
    intervals: [...harmonicFields[0].intervals],
    pitchClasses: [...harmonicFields[0].pitchClasses],
  });

  const random = mulberry32(spec.eventSeed);
  const sectionSeconds = spec.durationSeconds / harmonicFields.length;
  const foregroundEvents = [];
  let startSeconds = 2.1 + random() * 1.7;
  let previousMidi = Number.NaN;

  while (startSeconds < spec.durationSeconds - 1.2) {
    const sectionIndex = Math.min(
      harmonicFields.length - 1,
      Math.floor(startSeconds / sectionSeconds)
    );
    const pool = buildMidiPool(spec, harmonicFields[sectionIndex].intervals);
    const midi = chooseVoiceLedMidi(pool, previousMidi, random);
    foregroundEvents.push({
      startSeconds,
      durationSeconds: 1.1 + random() * 3.55,
      midi,
      velocity: 0.22 + random() * 0.35,
      pan: Math.max(-0.42, Math.min(0.42, (midi - 68) * 0.035)),
      sectionIndex,
    });
    previousMidi = midi;
    startSeconds += spec.minimumForegroundGapSeconds + 0.55 + random() * 1.45;
  }

  return {
    harmonicFields,
    foregroundEvents,
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function centsRatio(cents) {
  return 2 ** (cents / 1200);
}

function createModalOscillator(frequency, sampleRate, amplitude, decaySeconds, phase) {
  const angularFrequency = (Math.PI * 2 * frequency) / sampleRate;
  return {
    coefficient: 2 * Math.cos(angularFrequency),
    previous: Math.sin(phase - angularFrequency),
    current: Math.sin(phase),
    fastAmplitude: amplitude * 0.72,
    slowAmplitude: amplitude * 0.28,
    fastDecay: Math.exp(-1 / (sampleRate * Math.max(0.08, decaySeconds * 0.42))),
    slowDecay: Math.exp(-1 / (sampleRate * Math.max(0.12, decaySeconds))),
  };
}

function buildPianoModes(event, sampleRate, random, spec) {
  const frequency = midiToFrequency(event.midi);
  const nyquistLimit = sampleRate * 0.47;
  const brightness = clamp(spec.feltBrightness * (0.72 + event.velocity * 0.75), 0.18, 0.72);
  const inharmonicity = 0.00012 + Math.max(0, event.midi - 48) * 0.000006;
  const pitchDecay = clamp(7.4 - Math.max(0, event.midi - 48) * 0.055, 4.2, 7.4);
  const decayBase = pitchDecay * (0.88 + spec.pedalResonance * 0.5);
  const modes = [];

  for (const [stringIndex, cents] of [-0.72, 0, 0.81].entries()) {
    const stringFrequency = frequency * centsRatio(cents);
    modes.push(
      createModalOscillator(
        stringFrequency,
        sampleRate,
        [0.3, 0.38, 0.32][stringIndex],
        decayBase * (0.96 + stringIndex * 0.035),
        random() * Math.PI * 2
      )
    );
  }

  for (let partial = 2; partial <= 9; partial += 1) {
    const ratio = partial * Math.sqrt(1 + inharmonicity * partial * partial);
    const partialFrequency = frequency * ratio;
    if (partialFrequency >= nyquistLimit) break;
    const rolloff = partial ** -(2.55 - brightness * 1.25);
    const amplitude = rolloff * (0.42 + brightness * 0.92);
    const decaySeconds = decayBase / partial ** (0.2 + brightness * 0.18);
    modes.push(
      createModalOscillator(
        partialFrequency,
        sampleRate,
        amplitude,
        decaySeconds,
        random() * Math.PI * 2
      )
    );
    if (partial <= 3 && partialFrequency * centsRatio(0.55) < nyquistLimit) {
      modes.push(
        createModalOscillator(
          partialFrequency * centsRatio(partial === 2 ? 0.55 : -0.42),
          sampleRate,
          amplitude * 0.34,
          decaySeconds * 0.92,
          random() * Math.PI * 2
        )
      );
    }
  }
  return modes;
}

function addModalPianoNote(left, right, event, sampleRate, spec, seedOffset) {
  const startFrame = Math.max(0, Math.round(event.startSeconds * sampleRate));
  const tailSeconds =
    event.role === "pedal-resonance"
      ? Math.min(spec.reverbT60Seconds * 0.82, 8.2)
      : Math.min(spec.reverbT60Seconds * 0.7, 7.2);
  const endFrame = Math.min(
    left.length,
    Math.ceil((event.startSeconds + event.durationSeconds + tailSeconds) * sampleRate)
  );
  if (startFrame >= endFrame) return;

  const random = mulberry32((spec.eventSeed ^ seedOffset ^ (event.midi << 13)) >>> 0);
  const modes = buildPianoModes(event, sampleRate, random, spec);
  const attackSeconds =
    event.role === "pedal-resonance" ? 0.085 : 0.018 + (1 - spec.feltBrightness) * 0.018;
  const attackFrames = Math.max(1, Math.round(attackSeconds * sampleRate));
  const hammerFrames = Math.max(1, Math.round((0.026 + spec.feltBrightness * 0.014) * sampleRate));
  const damperStart = Math.round((event.startSeconds + event.durationSeconds) * sampleRate);
  const damperFrames = Math.max(1, Math.round(0.052 * sampleRate));
  const leftGain = Math.sqrt((1 - event.pan) * 0.5);
  const rightGain = Math.sqrt((1 + event.pan) * 0.5);
  const roleGain = event.role === "pedal-resonance" ? 0.46 : 1;
  const noteGain = event.velocity * roleGain * 0.56;
  let hammerLowPass = 0;

  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const localFrame = frame - startFrame;
    const attackProgress = Math.min(1, (localFrame + 1) / attackFrames);
    const attack = attackProgress * attackProgress * (3 - 2 * attackProgress);
    let modalSample = 0;
    for (const mode of modes) {
      modalSample += mode.current * (mode.fastAmplitude + mode.slowAmplitude);
      const next = mode.coefficient * mode.current - mode.previous;
      mode.previous = mode.current;
      mode.current = next;
      mode.fastAmplitude *= mode.fastDecay;
      mode.slowAmplitude *= mode.slowDecay;
    }

    let mechanicalSample = 0;
    if (localFrame < hammerFrames && event.role !== "pedal-resonance") {
      const noise = random() * 2 - 1;
      hammerLowPass += 0.16 * (noise - hammerLowPass);
      const hammerEnvelope = 1 - localFrame / hammerFrames;
      mechanicalSample += hammerLowPass * hammerEnvelope * (0.015 + spec.feltBrightness * 0.025);
    }
    if (
      frame >= damperStart &&
      frame < damperStart + damperFrames &&
      event.role !== "pedal-resonance"
    ) {
      const damperProgress = (frame - damperStart) / damperFrames;
      mechanicalSample += (random() * 2 - 1) * (1 - damperProgress) * 0.0035;
    }

    const value = (modalSample * attack + mechanicalSample) * noteGain;
    left[frame] += value * leftGain;
    right[frame] += value * rightGain;
  }
}

function renderDryPiano(spec, composition, sampleRate, frameCount) {
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  const sectionSeconds = frameCount / sampleRate / composition.harmonicFields.length;
  let seedOffset = 0x51f15e;

  composition.harmonicFields.forEach((field, sectionIndex) => {
    const usableIntervals = field.intervals.slice(0, 3);
    usableIntervals.forEach((interval, voiceIndex) => {
      const midi = clamp(spec.tonalCenterMidi - 12 + interval, 43, 72);
      addModalPianoNote(
        left,
        right,
        {
          startSeconds: Math.max(0, sectionIndex * sectionSeconds + voiceIndex * 0.055),
          durationSeconds: Math.min(sectionSeconds * 0.9, 7.5),
          midi,
          velocity: 0.12 + voiceIndex * 0.018,
          pan: [-0.28, 0.04, 0.3][voiceIndex],
          role: "pedal-resonance",
        },
        sampleRate,
        spec,
        seedOffset
      );
      seedOffset += 0x9e3779;
    });
  });

  composition.foregroundEvents.forEach((event, eventIndex) => {
    addModalPianoNote(
      left,
      right,
      {
        ...event,
        role: "foreground",
      },
      sampleRate,
      spec,
      seedOffset + eventIndex * 0x45d9f3b
    );

    if (eventIndex % 5 === 2 && event.midi >= 65) {
      addModalPianoNote(
        left,
        right,
        {
          ...event,
          startSeconds: event.startSeconds + 0.038,
          durationSeconds: event.durationSeconds * 0.86,
          midi: event.midi - 12,
          velocity: event.velocity * 0.42,
          pan: -event.pan * 0.55,
          role: "foreground",
        },
        sampleRate,
        spec,
        seedOffset + eventIndex * 0x27d4eb2d
      );
    }
  });

  return { left, right };
}

function applyFeedbackDelayNetwork(dryLeft, dryRight, sampleRate, spec) {
  const delaySeconds = [0.0437, 0.0529, 0.0617, 0.0719, 0.0833, 0.0971, 0.1139, 0.1373];
  const delayLines = delaySeconds.map(
    (seconds) => new Float32Array(Math.max(3, Math.round(seconds * sampleRate)))
  );
  const writeIndices = new Uint32Array(delayLines.length);
  const feedbackGains = delayLines.map(
    (line) => 10 ** ((-3 * (line.length / sampleRate)) / spec.reverbT60Seconds)
  );
  const dampingCutoff = Math.min(sampleRate * 0.42, 3100 + spec.feltBrightness * 2300);
  const dampingMemory = Math.exp((-Math.PI * 2 * dampingCutoff) / sampleRate);
  const dampingStates = new Float64Array(delayLines.length);
  const outputs = new Float64Array(delayLines.length);
  const wetLeftSigns = [1, 1, -1, 1, -1, -1, 1, -1];
  const wetRightSigns = [1, -1, 1, 1, -1, 1, -1, -1];
  const inputSigns = [1, -1, 1, -1, -1, 1, -1, 1];
  const left = new Float32Array(dryLeft.length);
  const right = new Float32Array(dryRight.length);
  const dryGain = 0.68;
  const wetGain = (spec.roomMix * 1.55) / Math.sqrt(delayLines.length);
  const injectionGain = 0.34 / Math.sqrt(delayLines.length);

  for (let frame = 0; frame < dryLeft.length; frame += 1) {
    let sum = 0;
    let wetLeft = 0;
    let wetRight = 0;
    for (let lineIndex = 0; lineIndex < delayLines.length; lineIndex += 1) {
      const value = delayLines[lineIndex][writeIndices[lineIndex]];
      outputs[lineIndex] = value;
      sum += value;
      wetLeft += value * wetLeftSigns[lineIndex];
      wetRight += value * wetRightSigns[lineIndex];
    }

    left[frame] = dryLeft[frame] * dryGain + wetLeft * wetGain;
    right[frame] = dryRight[frame] * dryGain + wetRight * wetGain;

    const meanTwice = (2 * sum) / delayLines.length;
    const monoInput = (dryLeft[frame] + dryRight[frame]) * 0.5;
    const sideInput = (dryLeft[frame] - dryRight[frame]) * 0.35;
    for (let lineIndex = 0; lineIndex < delayLines.length; lineIndex += 1) {
      const householder = outputs[lineIndex] - meanTwice;
      const injection = monoInput + inputSigns[lineIndex] * sideInput;
      const nextValue = householder * feedbackGains[lineIndex] + injection * injectionGain;
      const damped = nextValue * (1 - dampingMemory) + dampingStates[lineIndex] * dampingMemory;
      dampingStates[lineIndex] = damped;
      delayLines[lineIndex][writeIndices[lineIndex]] = damped;
      writeIndices[lineIndex] = (writeIndices[lineIndex] + 1) % delayLines[lineIndex].length;
    }
  }

  return { left, right };
}

function circularizePcm(rawLeft, rawRight, frameCount, crossfadeFrames) {
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  const boundedCrossfade = Math.min(Math.max(1, crossfadeFrames), Math.floor(frameCount * 0.45));
  const bodyFrames = frameCount - boundedCrossfade;
  for (let frame = 0; frame < bodyFrames; frame += 1) {
    left[frame] = rawLeft[frame + boundedCrossfade];
    right[frame] = rawRight[frame + boundedCrossfade];
  }
  for (let frame = 0; frame < boundedCrossfade; frame += 1) {
    const progress = (frame + 0.5) / boundedCrossfade;
    const fadeOut = Math.cos(progress * Math.PI * 0.5);
    const fadeIn = Math.sin(progress * Math.PI * 0.5);
    const normalization = 1 / Math.max(1, fadeOut + fadeIn);
    const outputFrame = bodyFrames + frame;
    left[outputFrame] =
      (rawLeft[frameCount + frame] * fadeOut + rawLeft[frame] * fadeIn) * normalization;
    right[outputFrame] =
      (rawRight[frameCount + frame] * fadeOut + rawRight[frame] * fadeIn) * normalization;
  }
  return { left, right, crossfadeFrames: boundedCrossfade };
}

function applyCircularSlowMastering(left, right, sampleRate, options = {}) {
  const exponent = Number.isFinite(options.exponent) ? options.exponent : 0.85;
  const minimumGain = Number.isFinite(options.minimumGain) ? options.minimumGain : 0.38;
  const maximumGain = Number.isFinite(options.maximumGain) ? options.maximumGain : 4.5;
  const transitionFraction = Number.isFinite(options.transitionFraction)
    ? clamp(options.transitionFraction, 0.05, 0.45)
    : 0.22;
  const blockFrames = Math.max(1, Math.round(sampleRate * 3));
  const blockCount = Math.ceil(left.length / blockFrames);
  const blockRms = new Float64Array(blockCount);
  for (let block = 0; block < blockCount; block += 1) {
    const start = block * blockFrames;
    const end = Math.min(left.length, start + blockFrames);
    let squares = 0;
    for (let frame = start; frame < end; frame += 1) {
      squares += left[frame] * left[frame] + right[frame] * right[frame];
    }
    blockRms[block] = Math.sqrt(squares / Math.max(1, (end - start) * 2));
  }
  const audibleBlocks = [...blockRms].filter((value) => value > 1e-9).sort((a, b) => a - b);
  if (audibleBlocks.length === 0) return;
  const medianRms = audibleBlocks[Math.floor(audibleBlocks.length / 2)];
  const rawGains = [...blockRms].map((rms) =>
    clamp((medianRms / Math.max(rms, medianRms * 0.04)) ** exponent, minimumGain, maximumGain)
  );
  const gains = rawGains.map((gain, index) => {
    const previous = rawGains[modulo(index - 1, rawGains.length)];
    const next = rawGains[(index + 1) % rawGains.length];
    return previous * 0.05 + gain * 0.9 + next * 0.05;
  });
  if (gains.length > 1) {
    const seamGain = (gains[0] + gains[gains.length - 1]) * 0.5;
    gains[0] = seamGain;
    gains[gains.length - 1] = seamGain;
  }

  for (let frame = 0; frame < left.length; frame += 1) {
    const block = Math.min(gains.length - 1, Math.floor(frame / blockFrames));
    const previousBlock = modulo(block - 1, gains.length);
    const nextBlock = (block + 1) % gains.length;
    const progress = (frame % blockFrames) / blockFrames;
    let gain = gains[block];
    if (progress < transitionFraction) {
      const localProgress = progress / transitionFraction;
      const smoothProgress = localProgress * localProgress * (3 - 2 * localProgress);
      gain = gains[previousBlock] + (gains[block] - gains[previousBlock]) * smoothProgress;
    } else if (progress > 1 - transitionFraction) {
      const localProgress = (progress - (1 - transitionFraction)) / transitionFraction;
      const smoothProgress = localProgress * localProgress * (3 - 2 * localProgress);
      gain = gains[block] + (gains[nextBlock] - gains[block]) * smoothProgress;
    }
    left[frame] *= gain;
    right[frame] *= gain;
  }
}

function applyLoopBreathingBed(left, right, sampleRate, spec) {
  let squares = 0;
  for (let frame = 0; frame < left.length; frame += 1) {
    squares += left[frame] * left[frame] + right[frame] * right[frame];
  }
  const sourceRms = Math.sqrt(squares / Math.max(1, left.length * 2));
  const bedAmplitude = sourceRms * 0.5;
  const edgeFrames = Math.max(
    1,
    Math.min(Math.round(sampleRate * 1.8), Math.floor(left.length / 5))
  );
  const durationSeconds = left.length / sampleRate;
  const desiredFrequencies = [
    midiToFrequency(spec.tonalCenterMidi - 24),
    midiToFrequency(spec.tonalCenterMidi - 17),
    midiToFrequency(spec.tonalCenterMidi - 12),
  ];
  const cycles = desiredFrequencies.map((frequency) =>
    Math.max(1, Math.round(frequency * durationSeconds))
  );

  for (let frame = 0; frame < left.length; frame += 1) {
    let edgeBlend = 0;
    if (frame < edgeFrames) {
      edgeBlend = Math.cos((frame / edgeFrames) * Math.PI * 0.5) ** 2;
    } else if (frame >= left.length - edgeFrames) {
      const progress = (frame - (left.length - edgeFrames)) / edgeFrames;
      edgeBlend = Math.sin(progress * Math.PI * 0.5) ** 2;
    }
    if (edgeBlend <= 0) continue;
    const cyclePhase = frame / left.length;
    const first = Math.sin(Math.PI * 2 * cycles[0] * cyclePhase + 0.31);
    const second = Math.sin(Math.PI * 2 * cycles[1] * cyclePhase + 1.17);
    const third = Math.sin(Math.PI * 2 * cycles[2] * cyclePhase + 2.03);
    const bedLeft = (first * 0.58 + second * 0.29 + third * 0.13) * bedAmplitude;
    const bedRight = (first * 0.55 + second * 0.26 + third * 0.19) * bedAmplitude;
    left[frame] += (bedLeft - left[frame]) * edgeBlend;
    right[frame] += (bedRight - right[frame]) * edgeBlend;
  }
}

function applyAdaptivePeakControl(left, right) {
  let squares = 0;
  let peak = 0;
  for (let frame = 0; frame < left.length; frame += 1) {
    squares += left[frame] * left[frame] + right[frame] * right[frame];
    peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
  }
  const rms = Math.sqrt(squares / Math.max(1, left.length * 2));
  const targetCrestFactor = 6.3;
  if (rms <= 1e-12 || peak / rms <= targetCrestFactor) return;
  const knee = rms * 4.2;
  const ceiling = rms * targetCrestFactor;
  const range = Math.max(1e-12, ceiling - knee);
  for (let frame = 0; frame < left.length; frame += 1) {
    for (const channel of [left, right]) {
      const value = channel[frame];
      const absolute = Math.abs(value);
      if (absolute <= knee) continue;
      const controlled = knee + range * Math.tanh((absolute - knee) / range);
      channel[frame] = Math.sign(value) * controlled;
    }
  }
}

function normalizeAndMeasure(left, right, spec, sampleRate) {
  let leftMean = 0;
  let rightMean = 0;
  for (let frame = 0; frame < left.length; frame += 1) {
    leftMean += left[frame];
    rightMean += right[frame];
  }
  leftMean /= left.length;
  rightMean /= right.length;

  let sourceSquares = 0;
  let sourcePeak = 0;
  for (let frame = 0; frame < left.length; frame += 1) {
    left[frame] -= leftMean;
    right[frame] -= rightMean;
    sourceSquares += left[frame] * left[frame] + right[frame] * right[frame];
    sourcePeak = Math.max(sourcePeak, Math.abs(left[frame]), Math.abs(right[frame]));
  }
  const sourceRms = Math.sqrt(sourceSquares / Math.max(1, left.length * 2));
  const scale = Math.min(
    spec.targetRms / Math.max(sourceRms, 1e-12),
    spec.targetPeak / Math.max(sourcePeak, 1e-12)
  );

  let squares = 0;
  let peak = 0;
  let sumLeft = 0;
  let sumRight = 0;
  let sumLeftSquares = 0;
  let sumRightSquares = 0;
  let sumProduct = 0;
  let finiteSamples = true;
  for (let frame = 0; frame < left.length; frame += 1) {
    const l = clamp(left[frame] * scale, -0.98, 0.98);
    const r = clamp(right[frame] * scale, -0.98, 0.98);
    left[frame] = l;
    right[frame] = r;
    finiteSamples = finiteSamples && Number.isFinite(l) && Number.isFinite(r);
    squares += l * l + r * r;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    sumLeft += l;
    sumRight += r;
    sumLeftSquares += l * l;
    sumRightSquares += r * r;
    sumProduct += l * r;
  }

  const frames = Math.max(1, left.length);
  const covariance = sumProduct - (sumLeft * sumRight) / frames;
  const leftVariance = sumLeftSquares - (sumLeft * sumLeft) / frames;
  const rightVariance = sumRightSquares - (sumRight * sumRight) / frames;
  const stereoCorrelation = covariance / Math.max(1e-12, Math.sqrt(leftVariance * rightVariance));
  const boundaryDelta = Math.max(
    Math.abs(left[0] - left[left.length - 1]),
    Math.abs(right[0] - right[right.length - 1])
  );
  const loopWindowFrames = Math.max(
    1,
    Math.min(Math.round(sampleRate * 0.5), Math.floor(left.length / 4))
  );
  let leftLoopDifference = 0;
  let rightLoopDifference = 0;
  for (let frame = 0; frame < loopWindowFrames; frame += 1) {
    const tailFrame = left.length - loopWindowFrames + frame;
    leftLoopDifference += Math.abs(left[frame] - left[tailFrame]);
    rightLoopDifference += Math.abs(right[frame] - right[tailFrame]);
  }
  const loopWindowDelta = Math.max(
    leftLoopDifference / loopWindowFrames,
    rightLoopDifference / loopWindowFrames
  );

  return {
    finiteSamples,
    peak: Number(peak.toFixed(6)),
    rms: Number(Math.sqrt(squares / (frames * 2)).toFixed(6)),
    stereoCorrelation: Number(stereoCorrelation.toFixed(6)),
    boundaryDelta: Number(boundaryDelta.toFixed(6)),
    loopWindowDelta: Number(loopWindowDelta.toFixed(6)),
    sampleRate,
  };
}

function renderCloudlightV2Candidate(spec, options = {}) {
  if (!spec || spec.referenceWaveformInput !== null) {
    throw new Error("Cloudlight v2 rendering accepts only a clean-room candidate spec");
  }
  const sampleRate = Number.isFinite(options.sampleRate) ? Math.round(options.sampleRate) : 44100;
  const durationSeconds = Number.isFinite(options.durationSeconds)
    ? Number(options.durationSeconds)
    : spec.durationSeconds;
  if (sampleRate < 8000 || sampleRate > 96000 || durationSeconds < 2) {
    throw new Error("Cloudlight v2 render options are outside supported bounds");
  }
  const frameCount = Math.round(durationSeconds * sampleRate);
  const requestedCrossfade = Math.round(spec.loopCrossfadeSeconds * sampleRate);
  const crossfadeFrames = Math.min(requestedCrossfade, Math.floor(frameCount * 0.4));
  const rawFrameCount = frameCount + crossfadeFrames;
  const renderSpec = {
    ...spec,
    durationSeconds: rawFrameCount / sampleRate,
  };
  const composition = buildCloudlightV2Composition(renderSpec);
  const dry = renderDryPiano(renderSpec, composition, sampleRate, rawFrameCount);
  const reverberated = applyFeedbackDelayNetwork(dry.left, dry.right, sampleRate, renderSpec);
  const circular = circularizePcm(
    reverberated.left,
    reverberated.right,
    frameCount,
    crossfadeFrames
  );
  applyCircularSlowMastering(circular.left, circular.right, sampleRate);
  applyCircularSlowMastering(circular.left, circular.right, sampleRate, {
    exponent: 0.35,
    minimumGain: 0.7,
    maximumGain: 1.6,
    transitionFraction: 0.15,
  });
  applyLoopBreathingBed(circular.left, circular.right, sampleRate, renderSpec);
  applyAdaptivePeakControl(circular.left, circular.right);
  const measured = normalizeAndMeasure(circular.left, circular.right, renderSpec, sampleRate);

  return {
    left: circular.left,
    right: circular.right,
    metrics: {
      ...measured,
      channels: 2,
      durationSeconds,
      foregroundEventCount: composition.foregroundEvents.length,
      harmonicFieldCount: composition.harmonicFields.length,
      synthesisModel:
        "deterministic clean-room inharmonic modal felt-piano with detuned strings and sympathetic pedal resonances",
      reverbModel: "eight-line damped Householder feedback-delay-network",
      reverbT60Seconds: spec.reverbT60Seconds,
      loopCrossfadeSeconds: circular.crossfadeFrames / sampleRate,
      sourceAudioImported: false,
      sourceAudioRetained: false,
      samplesCopied: false,
      melodyOrHarmonyTranscribed: false,
    },
  };
}

function floatPcmToInt16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    pcm[index] = Math.round(clamp(samples[index], -1, 1) * 32767);
  }
  return pcm;
}

let cachedLamejs;
function loadLamejs() {
  if (cachedLamejs) return cachedLamejs;
  const bundlePath = require.resolve("lamejs/lame.all.js");
  const bundle = fs.readFileSync(bundlePath, "utf8");
  cachedLamejs = vm.runInNewContext(bundle + "\n; lamejs;", {});
  return cachedLamejs;
}

function encodeStereoMp3(left, right, sampleRate, encoderKbps) {
  const lamejs = loadLamejs();
  const encoder = new lamejs.Mp3Encoder(2, sampleRate, encoderKbps);
  const left16 = floatPcmToInt16(left);
  const right16 = floatPcmToInt16(right);
  const chunks = [];
  const blockSize = 1152;
  for (let frame = 0; frame < left16.length; frame += blockSize) {
    const encoded = encoder.encodeBuffer(
      left16.subarray(frame, frame + blockSize),
      right16.subarray(frame, frame + blockSize)
    );
    if (encoded.length > 0) chunks.push(Buffer.from(encoded));
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(Buffer.from(tail));
  return Buffer.concat(chunks);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertPrivateOutputDirectory(rootDir, outputDir) {
  const rootInput = path.resolve(rootDir);
  const outputInput = path.resolve(outputDir);
  const relativeInput = path.relative(rootInput, outputInput);
  const relativeBeforeCreation = relativeInput.split(path.sep).join("/");
  if (!relativeBeforeCreation.startsWith("output/private/")) {
    throw new Error("Cloudlight v2 review output must stay under <root>/output/private");
  }
  const resolvedRoot = fs.realpathSync(rootInput);
  const resolvedOutput = path.join(resolvedRoot, relativeInput);
  fs.mkdirSync(resolvedOutput, { recursive: true, mode: 0o700 });
  const realOutput = fs.realpathSync(resolvedOutput);
  const relativeAfterCreation = path.relative(resolvedRoot, realOutput).split(path.sep).join("/");
  if (!relativeAfterCreation.startsWith("output/private/")) {
    throw new Error("Cloudlight v2 review output resolves outside <root>/output/private");
  }
  return realOutput;
}

function writeAtomic(filePath, contents) {
  const temporaryPath =
    filePath + ".tmp-" + process.pid + "-" + crypto.randomBytes(6).toString("hex");
  try {
    fs.writeFileSync(temporaryPath, contents, { mode: 0o600 });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function renderReviewReadme(manifest) {
  const candidateLines = manifest.candidates.map(
    (candidate) =>
      "- `" +
      candidate.fileName +
      "` — " +
      candidate.displayName +
      "; " +
      candidate.parameters.tempoBpm +
      " BPM; " +
      candidate.parameters.reverbT60Seconds +
      " s T60; SHA-256 `" +
      candidate.sha256 +
      "`."
  );
  return [
    "# Cloudlight Evening v2 — приватное прослушивание",
    "",
    "Эти три файла являются самостоятельными clean-room композициями. Референс использовался только для высокоуровневого профиля: медленный темп, редкие felt-piano события, длинное пространство, тихая вечерняя динамика и круговая макроформа.",
    "",
    "Запись, сэмплы, мелодия и гармоническая последовательность референса не импортировались и не транскрибировались.",
    "",
    ...candidateLines,
    "",
    "Статус: только прослушивание владельцем. Ни один файл не внедрён в приложение.",
    "",
    "При выборе слушайте на наушниках и динамике телефона: утомляемость через 2–3 минуты, резкость атаки, естественность пауз, ширину без потери центра и заметность точки лупа.",
    "",
  ].join("\n");
}

function writeCloudlightV2ReviewPack(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const outputDir = assertPrivateOutputDirectory(
    rootDir,
    options.outputDir || path.join(rootDir, "output", "private", "cloudlight-evening-v2-review")
  );
  const sampleRate = Number.isFinite(options.sampleRate) ? Math.round(options.sampleRate) : 44100;
  const durationSeconds = Number.isFinite(options.durationSeconds)
    ? Number(options.durationSeconds)
    : 150;
  const encoderKbps = Number.isFinite(options.encoderKbps) ? Math.round(options.encoderKbps) : 128;
  const expectedFiles = new Set([
    ...CLOUDLIGHT_V2_CANDIDATE_SPECS.map((spec) => spec.fileName),
    "README.md",
    "decoded-audit.json",
    "review-manifest.json",
  ]);
  const unexpectedFiles = fs
    .readdirSync(outputDir)
    .filter((fileName) => !expectedFiles.has(fileName));
  if (unexpectedFiles.length > 0) {
    throw new Error(
      "Cloudlight v2 review output contains unrelated files: " + unexpectedFiles.join(", ")
    );
  }
  fs.rmSync(path.join(outputDir, "decoded-audit.json"), { force: true });

  const candidates = [];
  for (const spec of getCloudlightV2CandidateSpecs()) {
    const rendered = renderCloudlightV2Candidate(spec, { sampleRate, durationSeconds });
    const mp3 = encodeStereoMp3(rendered.left, rendered.right, sampleRate, encoderKbps);
    const filePath = path.join(outputDir, spec.fileName);
    writeAtomic(filePath, mp3);
    candidates.push({
      id: spec.id,
      displayName: spec.displayName,
      fileName: spec.fileName,
      bytes: mp3.length,
      sha256: sha256(mp3),
      parameters: {
        durationSeconds,
        sampleRate,
        channels: 2,
        encoder: "lamejs",
        encoderKbps,
        tempoBpm: spec.tempoBpm,
        minimumForegroundGapSeconds: spec.minimumForegroundGapSeconds,
        reverbT60Seconds: spec.reverbT60Seconds,
        feltBrightness: spec.feltBrightness,
        roomMix: spec.roomMix,
        pedalResonance: spec.pedalResonance,
        eventSeed: "0x" + spec.eventSeed.toString(16),
      },
      sourceSignalMetrics: rendered.metrics,
    });
  }

  const manifest = {
    schemaVersion: 1,
    purpose: "Private owner listening pack for a replacement Cloudlight Evening app-entry loop.",
    generatedAt: new Date().toISOString(),
    technicalStatus: "PASS_GENERATOR_AND_PCM_CONTRACTS_MP3_DECODE_AUDIT_PENDING",
    artisticStatus: "UNVERIFIED_OWNER_LISTENING_REQUIRED",
    runtimePromotionStatus: "NOT_PROMOTED",
    formalLoudnessStatus: "UNVERIFIED_EBU_R128_METER_UNAVAILABLE",
    formalTruePeakStatus: "UNVERIFIED_TRUE_PEAK_METER_UNAVAILABLE",
    rights: {
      generationPolicy:
        "First-party deterministic procedural synthesis using numeric parameters only; no external audio or score input.",
      referenceResearch: {
        title: "Cloudbound Evening",
        creator: "3 Minute Escape",
        sourceUrl: "https://www.youtube.com/watch?v=cJvhJqgDbKI",
        useBoundary:
          "High-level mood, tempo, density, timbre, dynamics, reverb, and macro-form research only.",
        licenseBoundary:
          "No Creative Commons permission identified; reference treated as Standard YouTube License.",
        sourceAudioImported: false,
        sourceAudioRetained: false,
        samplesCopied: false,
        melodyOrHarmonyTranscribed: false,
      },
      candidateOwnership: {
        status: "FIRST_PARTY_CLEAN_ROOM",
        projectNotice: "Copyright © 2026 Yehor212 / ZenFlow. All rights reserved.",
        humanLegalReviewRequiredBeforeRelease: true,
      },
    },
    synthesis: {
      model:
        "Inharmonic modal felt-piano with three detuned strings, velocity-shaped partials, mechanical onset/damper noise, sympathetic pedal resonances, and damped Householder feedback-delay-network reverb.",
      deterministic: true,
      sourceInputs: "Tracked numeric synthesis parameters only.",
      generatorScript: "scripts/cloudlight-evening-v2-synthesis.cjs",
    },
    candidates,
  };
  writeAtomic(
    path.join(outputDir, "review-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );
  writeAtomic(path.join(outputDir, "README.md"), renderReviewReadme(manifest));
  return { outputDir, manifest };
}

module.exports = {
  buildCloudlightV2Composition,
  getCloudlightV2CandidateSpecs,
  renderCloudlightV2Candidate,
  writeCloudlightV2ReviewPack,
};
