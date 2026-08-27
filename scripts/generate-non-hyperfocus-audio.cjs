#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const rootDir = process.cwd();
const sampleRate = 44100;
const channels = 2;
const encoderKbps = 128;
const publicSoundsDir = path.join(rootDir, 'public', 'sounds');
const docsSoundsDir = path.join(rootDir, 'docs', 'sounds');
const publicFeedbackDir = path.join(publicSoundsDir, 'feedback');
const docsFeedbackDir = path.join(docsSoundsDir, 'feedback');
const androidFurinPath = path.join(
  rootDir,
  'android',
  'app',
  'src',
  'main',
  'res',
  'raw',
  'zenflow_furin.wav',
);
const provenancePath = path.join(rootDir, 'docs', 'audio', 'non-hyperfocus-generated-audio-provenance.json');

const forbiddenRootFiles = [
  'measured-breath.mp3',
  'mixkit-small-waves-harbor-rocks-1208.mp3',
  'fireplace-fx-56636.mp3',
  'cafe-noise-32940.mp3',
  'mixkit-wildlife-environment-in-a-river-2456.wav',
  'mixkit-small-waves-harbor-rocks-1208.wav',
  'mixkit-underwater-transmitter-hum-2135.wav',
  'mixkit-calm-thunderstorm-in-the-jungle-2415.wav',
];

const assets = [
  {
    id: 'soft-air-veil',
    fileName: 'soft-air-veil.mp3',
    role: 'Entry/auth ambience',
    seed: 0x5a17a11,
    durationSeconds: 96,
    targetRms: 0.080,
    targetPeak: 0.28,
    runtimeGain: 0.18,
    generator: 'deterministic band-limited air-noise bed with a loop crossfade',
    exclusions: ['voice', 'human breathing', 'birds', 'thunder', 'fire crackle', 'rock clacks', 'melody'],
  },
  {
    id: 'cloudlight-evening-loop',
    fileName: 'cloudlight-evening-loop.mp3',
    role: 'Persistent opt-in app-entry background music',
    seed: 0xc10d1e57,
    durationSeconds: 150,
    tempoBpm: 64,
    targetRms: 0.045,
    targetPeak: 0.22,
    runtimeGain: 0.18,
    loopCrossfadeSeconds: 4,
    deterministicSpec: 'original-four-section-felt-piano-air-pad-circular-loop',
    generator: 'deterministic original felt-piano, open-harmony, and air-pad circular composition',
    exclusions: [
      'voice',
      'human breathing',
      'field recording',
      'sampled piano',
      'sampled audio',
      'stock loop',
      'reference audio',
      'reference score',
      'copied melody',
      'copied harmony',
      'alarm',
      'siren',
      'static noise',
    ],
  },
  {
    id: 'gentle-water-bed',
    fileName: 'gentle-water-bed.mp3',
    role: 'Orb ambience',
    seed: 0x6e71e5a7,
    durationSeconds: 96,
    targetRms: 0.070,
    targetPeak: 0.28,
    runtimeGain: 0.36,
    generator: 'deterministic band-limited soft-flow water bed with a loop crossfade',
    exclusions: ['voice', 'birds', 'gulls', 'rock clacks', 'splashes', 'thunder', 'melody'],
  },
  {
    id: 'soft-rain-veil',
    fileName: 'soft-rain-veil.mp3',
    role: 'Diary/settings ambience',
    seed: 0x5017a1,
    durationSeconds: 96,
    targetRms: 0.065,
    targetPeak: 0.26,
    runtimeGain: 0.32,
    generator: 'deterministic band-limited rain-noise sheet with a loop crossfade',
    exclusions: ['voice', 'birds', 'thunder', 'fire crackle', 'hard rain hits', 'melody'],
  },
];

const feedbackAssets = [
  {
    id: 'feedback-success',
    fileName: 'feedback-success.mp3',
    role: 'Quiet saved-action confirmation',
    durationSeconds: 0.48,
    targetRms: 0.038,
    targetPeak: 0.16,
    runtimeGain: 0.35,
    notes: [
      { frequency: 392, start: 0.02, length: 0.20, level: 0.72 },
      { frequency: 493.88, start: 0.13, length: 0.28, level: 0.88 },
    ],
    generator: 'deterministic two-note soft confirmation with cosine envelopes',
    exclusions: ['voice', 'sampled audio', 'harsh click', 'alarm', 'siren', 'bass hit', 'long tail'],
  },
  {
    id: 'feedback-complete',
    fileName: 'feedback-complete.mp3',
    role: 'Completed-activity confirmation',
    durationSeconds: 0.62,
    targetRms: 0.040,
    targetPeak: 0.17,
    runtimeGain: 0.40,
    notes: [
      { frequency: 329.63, start: 0.02, length: 0.22, level: 0.64 },
      { frequency: 392, start: 0.13, length: 0.25, level: 0.76 },
      { frequency: 493.88, start: 0.27, length: 0.28, level: 0.90 },
    ],
    generator: 'deterministic three-note completion cue with cosine envelopes',
    exclusions: ['voice', 'sampled audio', 'harsh click', 'alarm', 'siren', 'bass hit', 'long tail'],
  },
  {
    id: 'feedback-streak',
    fileName: 'feedback-streak.mp3',
    role: 'Occasional streak milestone cue',
    durationSeconds: 0.78,
    targetRms: 0.042,
    targetPeak: 0.18,
    runtimeGain: 0.45,
    notes: [
      { frequency: 349.23, start: 0.02, length: 0.23, level: 0.60 },
      { frequency: 440, start: 0.14, length: 0.25, level: 0.70 },
      { frequency: 523.25, start: 0.28, length: 0.27, level: 0.80 },
      { frequency: 587.33, start: 0.43, length: 0.28, level: 0.88 },
    ],
    generator: 'deterministic four-note low-salience streak cue with cosine envelopes',
    exclusions: ['voice', 'sampled audio', 'fanfare', 'alarm', 'siren', 'bass hit', 'long tail'],
  },
  {
    id: 'feedback-milestone',
    fileName: 'feedback-milestone.mp3',
    role: 'Rare milestone cue',
    durationSeconds: 0.70,
    targetRms: 0.042,
    targetPeak: 0.18,
    runtimeGain: 0.45,
    notes: [
      { frequency: 392, start: 0.02, length: 0.25, level: 0.66 },
      { frequency: 493.88, start: 0.17, length: 0.27, level: 0.78 },
      { frequency: 587.33, start: 0.34, length: 0.29, level: 0.90 },
    ],
    generator: 'deterministic three-note rare milestone cue with cosine envelopes',
    exclusions: ['voice', 'sampled audio', 'fanfare', 'alarm', 'siren', 'bass hit', 'long tail'],
  },
  {
    id: 'feedback-notification',
    fileName: 'feedback-notification.mp3',
    role: 'Opt-in in-app reminder preview',
    durationSeconds: 0.92,
    targetRms: 0.040,
    targetPeak: 0.18,
    runtimeGain: 0.20,
    modes: [
      { frequency: 1180, level: 0.11, decaySeconds: 0.26, pan: -0.08 },
      { frequency: 2380, level: 0.20, decaySeconds: 0.38, pan: 0.06 },
      { frequency: 3375, level: 1.00, decaySeconds: 0.72, pan: -0.03 },
      { frequency: 3412, level: 0.08, decaySeconds: 0.48, pan: 0.03 },
      { frequency: 5025, level: 0.16, decaySeconds: 0.28, pan: 0.10 },
      { frequency: 6810, level: 0.05, decaySeconds: 0.16, pan: -0.10 },
    ],
    strikes: [
      { start: 0.012, level: 1.0 },
      { start: 0.235, level: 0.22 },
    ],
    deterministicSpec: 'fixed-modal-glass-bell-with-cosine-attack-and-exponential-decay',
    generator: 'deterministic clean-room fūrin-style modal glass-bell cue',
    exclusions: ['voice', 'sampled audio', 'stock audio', 'alarm', 'siren', 'bass hit', 'melody'],
  },
];

function mulberry32(seed) {
  let t = Number(seed >>> 0);
  return function random() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeControls(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => random() * 2 - 1);
}

function smoothstep(x) {
  return x * x * (3 - 2 * x);
}

function cyclicValue(controls, phase) {
  const count = controls.length;
  const wrappedPhase = ((phase % 1) + 1) % 1;
  const scaled = wrappedPhase * count;
  const index = Math.floor(scaled) % count;
  const frac = smoothstep(scaled - Math.floor(scaled));
  const a = controls[index];
  const b = controls[(index + 1) % count];
  return a + (b - a) * frac;
}

function makeLayers(seed, counts) {
  return counts.map((count, index) => makeControls(count, (Number(seed) + (index + 1) * 0x9e3779b1) >>> 0));
}

const AMBIENCE_PROFILES = Object.freeze({
  'soft-air-veil': {
    bands: [[120, 900, 0.34], [900, 5200, 0.66]],
    commonMix: 0.78,
    sideMix: 0.22,
    modulationDepth: 0.07,
    modulationControls: 37,
    modulationCycles: 17,
  },
  'gentle-water-bed': {
    bands: [[55, 480, 0.66], [480, 2600, 0.34]],
    commonMix: 0.52,
    sideMix: 0.48,
    modulationDepth: 0.13,
    modulationControls: 29,
    modulationCycles: 11,
  },
  'soft-rain-veil': {
    bands: [[180, 1600, 0.38], [1600, 7000, 0.62]],
    commonMix: 0.34,
    sideMix: 0.66,
    modulationDepth: 0.09,
    modulationControls: 43,
    modulationCycles: 19,
  },
});

function createLowPass(cutoffHz) {
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
  let state = 0;
  return (input) => {
    state += alpha * (input - state);
    return state;
  };
}

function createBandPass(lowHz, highHz) {
  const lowPassHighA = createLowPass(highHz);
  const lowPassHighB = createLowPass(highHz);
  const lowPassHighC = createLowPass(highHz);
  const lowPassLowA = createLowPass(lowHz);
  const lowPassLowB = createLowPass(lowHz);
  const lowPassLowC = createLowPass(lowHz);
  return (input) => (
    lowPassHighC(lowPassHighB(lowPassHighA(input)))
      - lowPassLowC(lowPassLowB(lowPassLowA(input)))
  );
}

function createNoiseVoice(profile) {
  const bands = profile.bands.map(([lowHz, highHz, weight]) => ({
    filter: createBandPass(lowHz, highHz),
    weight,
  }));
  return (input) => bands.reduce(
    (sum, band) => sum + band.filter(input) * band.weight,
    0,
  );
}

function renderPcm(asset) {
  const frameCount = asset.durationSeconds * sampleRate;
  const crossfadeFrames = Math.round(sampleRate * 2);
  const warmupFrames = sampleRate;
  const rawFrameCount = frameCount + crossfadeFrames;
  const left = new Float64Array(rawFrameCount);
  const right = new Float64Array(rawFrameCount);
  const profile = AMBIENCE_PROFILES[asset.id];
  if (!profile) throw new Error('Missing ambience profile for ' + asset.id);

  const commonRandom = mulberry32((asset.seed ^ 0x9e3779b9) >>> 0);
  const leftRandom = mulberry32((asset.seed ^ 0x243f6a88) >>> 0);
  const rightRandom = mulberry32((asset.seed ^ 0xb7e15162) >>> 0);
  const leftVoice = createNoiseVoice(profile);
  const rightVoice = createNoiseVoice(profile);
  const modulationControls = makeControls(
    profile.modulationControls,
    (asset.seed ^ 0xa4093822) >>> 0,
  );
  const inputScale = 1 / Math.sqrt(
    profile.commonMix ** 2 + profile.sideMix ** 2,
  );

  for (let sourceFrame = -warmupFrames; sourceFrame < rawFrameCount; sourceFrame += 1) {
    const common = commonRandom() * 2 - 1;
    const sideLeft = leftRandom() * 2 - 1;
    const sideRight = rightRandom() * 2 - 1;
    const phase = sourceFrame / frameCount;
    const slowShape = cyclicValue(modulationControls, phase);
    const slowDrift = Math.sin(Math.PI * 2 * profile.modulationCycles * phase + 0.31);
    const envelope = 1 + profile.modulationDepth * (0.72 * slowShape + 0.28 * slowDrift);
    const leftSample = leftVoice(
      (common * profile.commonMix + sideLeft * profile.sideMix) * inputScale,
    ) * envelope;
    const rightSample = rightVoice(
      (common * profile.commonMix + sideRight * profile.sideMix) * inputScale,
    ) * envelope;
    if (sourceFrame >= 0) {
      left[sourceFrame] = leftSample;
      right[sourceFrame] = rightSample;
    }
  }

  for (let frame = 0; frame < crossfadeFrames; frame += 1) {
    const progress = (frame + 0.5) / crossfadeFrames;
    const fadeIn = Math.sin(progress * Math.PI * 0.5);
    const fadeOut = Math.cos(progress * Math.PI * 0.5);
    left[frame] = left[frame] * fadeIn + left[frameCount + frame] * fadeOut;
    right[frame] = right[frame] * fadeIn + right[frameCount + frame] * fadeOut;
  }

  let leftMean = 0;
  let rightMean = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    leftMean += left[frame];
    rightMean += right[frame];
  }
  leftMean /= frameCount;
  rightMean /= frameCount;

  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < frameCount; i += 1) {
    const l = left[i] - leftMean;
    const r = right[i] - rightMean;
    left[i] = l;
    right[i] = r;
    sumSquares += l * l + r * r;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }

  const rms = Math.sqrt(sumSquares / (frameCount * channels));
  const scale = Math.min(asset.targetRms / rms, asset.targetPeak / peak);
  const left16 = new Int16Array(frameCount);
  const right16 = new Int16Array(frameCount);
  let scaledPeak = 0;
  let scaledSquares = 0;
  for (let i = 0; i < frameCount; i += 1) {
    const l = Math.max(-0.98, Math.min(0.98, left[i] * scale));
    const r = Math.max(-0.98, Math.min(0.98, right[i] * scale));
    left16[i] = Math.round(l * 32767);
    right16[i] = Math.round(r * 32767);
    scaledPeak = Math.max(scaledPeak, Math.abs(l), Math.abs(r));
    scaledSquares += l * l + r * r;
  }

  return {
    left16,
    right16,
    metrics: {
      sampleRate,
      channels,
      durationSeconds: asset.durationSeconds,
      sourcePeak: Number(scaledPeak.toFixed(6)),
      sourceRms: Number(Math.sqrt(scaledSquares / (frameCount * channels)).toFixed(6)),
      synthesisProfile: profile,
      warmupSeconds: warmupFrames / sampleRate,
      crossfadeSeconds: crossfadeFrames / sampleRate,
      targetRms: asset.targetRms,
      targetPeak: asset.targetPeak,
    },
  };
}

const CLOUDLIGHT_CHORD_VOICINGS = Object.freeze({
  ebAdd9: [39, 46, 53, 55],
  cm9: [36, 43, 50, 51],
  abMaj7: [44, 51, 55, 58],
  bbSus2: [46, 53, 60, 62],
  gm9: [43, 50, 57, 58],
  fAdd9: [41, 48, 55, 57],
  ebOverBb: [46, 51, 55, 58],
});

const CLOUDLIGHT_CHORD_SEQUENCE = Object.freeze([
  'ebAdd9', 'cm9', 'abMaj7', 'bbSus2', 'ebAdd9', 'gm9', 'abMaj7', 'bbSus2',
  'cm9', 'abMaj7', 'ebOverBb', 'bbSus2', 'gm9', 'cm9', 'fAdd9', 'bbSus2',
  'abMaj7', 'bbSus2', 'gm9', 'cm9', 'abMaj7', 'fAdd9', 'bbSus2', 'bbSus2',
  'ebAdd9', 'gm9', 'abMaj7', 'cm9', 'fAdd9', 'abMaj7', 'bbSus2', 'bbSus2',
  'ebAdd9', 'cm9', 'abMaj7', 'bbSus2', 'gm9', 'fAdd9', 'abMaj7', 'bbSus2',
]);

const CLOUDLIGHT_MELODY_SCALE = Object.freeze([63, 65, 67, 70, 72, 74, 75]);
const CLOUDLIGHT_MELODY_PATTERNS = Object.freeze([
  [{ beat: 0.55, degree: 2, lengthBeats: 1.35 }, { beat: 2.45, degree: 4, lengthBeats: 1.05 }],
  [{ beat: 1.05, degree: 3, lengthBeats: 1.45 }, { beat: 3.15, degree: 1, lengthBeats: 0.65 }],
  [{ beat: 0.35, degree: 4, lengthBeats: 1.15 }, { beat: 1.95, degree: 2, lengthBeats: 1.6 }],
  [{ beat: 1.35, degree: 5, lengthBeats: 1.1 }, { beat: 2.95, degree: 3, lengthBeats: 0.85 }],
  [{ beat: 0.75, degree: 1, lengthBeats: 1.7 }, { beat: 3.05, degree: 2, lengthBeats: 0.7 }],
  [{ beat: 0.4, degree: 3, lengthBeats: 1.05 }, { beat: 1.85, degree: 6, lengthBeats: 1.55 }],
  [{ beat: 1.1, degree: 4, lengthBeats: 1.25 }, { beat: 2.8, degree: 2, lengthBeats: 1.0 }],
  [{ beat: 0.65, degree: 3, lengthBeats: 1.2 }, { beat: 2.35, degree: 0, lengthBeats: 1.4 }],
]);

function midiToFrequency(midi) {
  return 440 * (2 ** ((midi - 69) / 12));
}

function cloudlightSectionIndex(bar) {
  if (bar < 8) return 0;
  if (bar < 18) return 1;
  if (bar < 30) return 2;
  return 3;
}

function addCloudlightVoice(left, right, event) {
  const startFrame = Math.max(0, Math.round(event.startSeconds * sampleRate));
  const endFrame = Math.min(
    left.length,
    Math.ceil((event.startSeconds + event.durationSeconds) * sampleRate),
  );
  const partials = event.partials;
  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const localTime = frame / sampleRate - event.startSeconds;
    const attack = Math.sin(
      Math.min(1, localTime / event.attackSeconds) * Math.PI * 0.5,
    ) ** 2;
    let voice = 0;
    for (let index = 0; index < partials.length; index += 1) {
      const partial = partials[index];
      const decay = Math.exp(
        -localTime / Math.max(0.02, event.decaySeconds * partial.decayScale),
      );
      voice += Math.sin(
        Math.PI * 2 * event.frequency * partial.ratio * localTime + index * 0.173,
      ) * partial.level * decay;
    }
    const value = voice * event.level * attack;
    const leftGain = Math.sqrt((1 - event.pan) * 0.5);
    const rightGain = Math.sqrt((1 + event.pan) * 0.5);
    left[frame] += value * leftGain;
    right[frame] += value * rightGain;
  }
}

function renderCloudlightEveningPcm(asset) {
  const frameCount = Math.round(asset.durationSeconds * sampleRate);
  const crossfadeFrames = Math.round(asset.loopCrossfadeSeconds * sampleRate);
  const rawFrameCount = frameCount + crossfadeFrames;
  const rawLeft = new Float32Array(rawFrameCount);
  const rawRight = new Float32Array(rawFrameCount);
  const beatSeconds = 60 / asset.tempoBpm;
  const barSeconds = beatSeconds * 4;
  const rawDurationSeconds = rawFrameCount / sampleRate;
  const barCount = Math.ceil(rawDurationSeconds / barSeconds) + 1;
  const random = mulberry32(asset.seed);
  const sectionDegreeOffset = [0, 1, -1, 0];
  const sectionDensity = [0.72, 0.88, 1, 0.78];
  const pianoPartials = [
    { ratio: 1, level: 1, decayScale: 1 },
    { ratio: 2.002, level: 0.16, decayScale: 0.58 },
    { ratio: 3.01, level: 0.055, decayScale: 0.4 },
    { ratio: 4.02, level: 0.022, decayScale: 0.28 },
    { ratio: 5.41, level: 0.009, decayScale: 0.2 },
  ];
  const padPartials = [
    { ratio: 1, level: 1, decayScale: 1 },
    { ratio: 2, level: 0.045, decayScale: 0.7 },
  ];
  const bassPartials = [
    { ratio: 1, level: 1, decayScale: 1 },
    { ratio: 2, level: 0.07, decayScale: 0.52 },
  ];
  const bellPartials = [
    { ratio: 1, level: 1, decayScale: 1 },
    { ratio: 2.71, level: 0.11, decayScale: 0.46 },
    { ratio: 4.08, level: 0.035, decayScale: 0.28 },
  ];

  for (let bar = 0; bar < barCount; bar += 1) {
    const canonicalBar = bar % CLOUDLIGHT_CHORD_SEQUENCE.length;
    const section = cloudlightSectionIndex(canonicalBar);
    const chordName = CLOUDLIGHT_CHORD_SEQUENCE[canonicalBar];
    const chord = CLOUDLIGHT_CHORD_VOICINGS[chordName];
    const barStart = bar * barSeconds;
    const cycleGain = bar >= CLOUDLIGHT_CHORD_SEQUENCE.length ? 0.96 : 1;

    chord.forEach((midi, voiceIndex) => {
      addCloudlightVoice(rawLeft, rawRight, {
        startSeconds: barStart - 0.04 + voiceIndex * 0.018,
        durationSeconds: barSeconds + 1.15,
        attackSeconds: 0.58 + voiceIndex * 0.06,
        decaySeconds: 3.65 + voiceIndex * 0.18,
        frequency: midiToFrequency(midi),
        level: (0.058 - voiceIndex * 0.006) * sectionDensity[section] * cycleGain,
        pan: [-0.34, -0.1, 0.14, 0.32][voiceIndex],
        partials: padPartials,
      });
    });

    addCloudlightVoice(rawLeft, rawRight, {
      startSeconds: barStart + 0.03,
      durationSeconds: 3.1,
      attackSeconds: 0.13,
      decaySeconds: 2.25,
      frequency: midiToFrequency(chord[0]),
      level: 0.075 * sectionDensity[section] * cycleGain,
      pan: -0.04,
      partials: bassPartials,
    });

    const pattern = CLOUDLIGHT_MELODY_PATTERNS[canonicalBar % 8];
    pattern.forEach((note, noteIndex) => {
      if (section === 0 && noteIndex > 0 && canonicalBar % 4 === 1) return;
      const degree = (
        note.degree + sectionDegreeOffset[section] + CLOUDLIGHT_MELODY_SCALE.length
      ) % CLOUDLIGHT_MELODY_SCALE.length;
      const timingJitter = (random() - 0.5) * 0.085;
      const levelJitter = 0.9 + random() * 0.16;
      addCloudlightVoice(rawLeft, rawRight, {
        startSeconds: barStart + note.beat * beatSeconds + timingJitter,
        durationSeconds: note.lengthBeats * beatSeconds + 1.7,
        attackSeconds: 0.027 + random() * 0.018,
        decaySeconds: 1.45 + note.lengthBeats * 0.34,
        frequency: midiToFrequency(CLOUDLIGHT_MELODY_SCALE[degree]),
        level: 0.21 * sectionDensity[section] * levelJitter * cycleGain,
        pan: Math.max(-0.36, Math.min(0.36, (degree - 3) * 0.09)),
        partials: pianoPartials,
      });
    });

    if ([7, 17, 29, 39].includes(canonicalBar)) {
      addCloudlightVoice(rawLeft, rawRight, {
        startSeconds: barStart + 3.15 * beatSeconds,
        durationSeconds: 2.8,
        attackSeconds: 0.07,
        decaySeconds: 1.65,
        frequency: midiToFrequency(79 + (section % 2) * 2),
        level: 0.035 * cycleGain,
        pan: section % 2 === 0 ? 0.28 : -0.28,
        partials: bellPartials,
      });
    }
  }

  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  const bodyFrames = frameCount - crossfadeFrames;
  for (let frame = 0; frame < bodyFrames; frame += 1) {
    left[frame] = rawLeft[frame + crossfadeFrames];
    right[frame] = rawRight[frame + crossfadeFrames];
  }
  for (let frame = 0; frame < crossfadeFrames; frame += 1) {
    const progress = (frame + 0.5) / crossfadeFrames;
    const fadeOut = Math.cos(progress * Math.PI * 0.5);
    const fadeIn = Math.sin(progress * Math.PI * 0.5);
    const correlatedGain = 1 / Math.max(1, fadeOut + fadeIn);
    const outputFrame = bodyFrames + frame;
    left[outputFrame] = (
      rawLeft[frameCount + frame] * fadeOut + rawLeft[frame] * fadeIn
    ) * correlatedGain;
    right[outputFrame] = (
      rawRight[frameCount + frame] * fadeOut + rawRight[frame] * fadeIn
    ) * correlatedGain;
  }

  let leftMean = 0;
  let rightMean = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const slowGain = 0.95 + 0.05 * Math.sin((Math.PI * 2 * frame) / frameCount - 0.6);
    left[frame] *= slowGain;
    right[frame] *= slowGain;
    leftMean += left[frame];
    rightMean += right[frame];
  }
  leftMean /= frameCount;
  rightMean /= frameCount;

  let sumSquares = 0;
  let peak = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    left[frame] -= leftMean;
    right[frame] -= rightMean;
    sumSquares += left[frame] ** 2 + right[frame] ** 2;
    peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
  }
  const rms = Math.sqrt(sumSquares / (frameCount * channels));
  const scale = Math.min(
    asset.targetRms / Math.max(rms, 1e-9),
    asset.targetPeak / Math.max(peak, 1e-9),
  );
  const left16 = new Int16Array(frameCount);
  const right16 = new Int16Array(frameCount);
  let scaledSquares = 0;
  let scaledPeak = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const l = Math.max(-0.98, Math.min(0.98, left[frame] * scale));
    const r = Math.max(-0.98, Math.min(0.98, right[frame] * scale));
    left16[frame] = Math.round(l * 32767);
    right16[frame] = Math.round(r * 32767);
    scaledSquares += l * l + r * r;
    scaledPeak = Math.max(scaledPeak, Math.abs(l), Math.abs(r));
  }

  return {
    left16,
    right16,
    metrics: {
      sampleRate,
      channels,
      durationSeconds: asset.durationSeconds,
      sourcePeak: Number(scaledPeak.toFixed(6)),
      sourceRms: Number(Math.sqrt(scaledSquares / (frameCount * channels)).toFixed(6)),
      targetRms: asset.targetRms,
      targetPeak: asset.targetPeak,
      tempoBpm: asset.tempoBpm,
      bars: CLOUDLIGHT_CHORD_SEQUENCE.length,
      sections: 4,
      chordSequence: CLOUDLIGHT_CHORD_SEQUENCE,
      melodyScaleMidi: CLOUDLIGHT_MELODY_SCALE,
      melodyPatterns: CLOUDLIGHT_MELODY_PATTERNS,
      loopCrossfadeSeconds: asset.loopCrossfadeSeconds,
      loopMethod: 'correlation-compensated-equal-power-circular-overlap',
      sourceInputs: 'tracked numeric synthesis parameters only',
    },
  };
}

function renderFeedbackPcm(asset) {
  if (asset.id === 'feedback-notification') return renderFurinNotificationPcm(asset);
  const frameCount = Math.round(asset.durationSeconds * sampleRate);
  const left = new Float64Array(frameCount);
  const right = new Float64Array(frameCount);

  for (const note of asset.notes) {
    const attackSeconds = 0.018;
    const releaseSeconds = Math.min(0.16, note.length * 0.48);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const localTime = frame / sampleRate - note.start;
      if (localTime < 0 || localTime > note.length) continue;
      const attack = Math.min(1, localTime / attackSeconds);
      const release = Math.min(1, Math.max(0, (note.length - localTime) / releaseSeconds));
      const envelope = Math.sin(Math.PI * 0.5 * attack) ** 2 * Math.sin(Math.PI * 0.5 * release) ** 2;
      const phase = Math.PI * 2 * note.frequency * localTime;
      const tone = Math.sin(phase) + 0.12 * Math.sin(phase * 2);
      const sample = tone * note.level * envelope;
      left[frame] += sample * 0.98;
      right[frame] += sample;
    }
  }

  let sumSquares = 0;
  let peak = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    sumSquares += left[frame] ** 2 + right[frame] ** 2;
    peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
  }
  const rms = Math.sqrt(sumSquares / (frameCount * channels));
  const scale = Math.min(asset.targetRms / Math.max(rms, 1e-9), asset.targetPeak / Math.max(peak, 1e-9));
  const left16 = new Int16Array(frameCount);
  const right16 = new Int16Array(frameCount);
  let scaledSquares = 0;
  let scaledPeak = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const l = Math.max(-0.98, Math.min(0.98, left[frame] * scale));
    const r = Math.max(-0.98, Math.min(0.98, right[frame] * scale));
    left16[frame] = Math.round(l * 32767);
    right16[frame] = Math.round(r * 32767);
    scaledSquares += l * l + r * r;
    scaledPeak = Math.max(scaledPeak, Math.abs(l), Math.abs(r));
  }

  return {
    left16,
    right16,
    metrics: {
      sampleRate,
      channels,
      durationSeconds: asset.durationSeconds,
      sourcePeak: Number(scaledPeak.toFixed(6)),
      sourceRms: Number(Math.sqrt(scaledSquares / (frameCount * channels)).toFixed(6)),
      targetRms: asset.targetRms,
      targetPeak: asset.targetPeak,
      notes: asset.notes,
    },
  };
}

function renderFurinNotificationPcm(asset) {
  const frameCount = Math.round(asset.durationSeconds * sampleRate);
  const left = new Float64Array(frameCount);
  const right = new Float64Array(frameCount);
  const attackSeconds = 0.007;

  for (const strike of asset.strikes) {
    for (let frame = 0; frame < frameCount; frame += 1) {
      const localTime = frame / sampleRate - strike.start;
      if (localTime < 0) continue;
      const attack = Math.sin(
        Math.min(1, localTime / attackSeconds) * Math.PI * 0.5,
      ) ** 2;
      for (const mode of asset.modes) {
        const decay = Math.exp(-localTime / mode.decaySeconds);
        const sample = Math.sin(Math.PI * 2 * mode.frequency * localTime) *
          mode.level * strike.level * attack * decay;
        left[frame] += sample * (1 - mode.pan * 0.12);
        right[frame] += sample * (1 + mode.pan * 0.12);
      }
    }
  }

  const fadeFrames = Math.round(sampleRate * 0.08);
  for (let frame = 0; frame < fadeFrames; frame += 1) {
    const gain = Math.sin(((fadeFrames - frame) / fadeFrames) * Math.PI * 0.5) ** 2;
    const index = frameCount - fadeFrames + frame;
    left[index] *= gain;
    right[index] *= gain;
  }

  let leftMean = 0;
  let rightMean = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    leftMean += left[frame];
    rightMean += right[frame];
  }
  leftMean /= frameCount;
  rightMean /= frameCount;

  let sumSquares = 0;
  let peak = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    left[frame] -= leftMean;
    right[frame] -= rightMean;
    sumSquares += left[frame] ** 2 + right[frame] ** 2;
    peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
  }
  const rms = Math.sqrt(sumSquares / (frameCount * channels));
  const scale = Math.min(
    asset.targetRms / Math.max(rms, 1e-9),
    asset.targetPeak / Math.max(peak, 1e-9),
  );
  const left16 = new Int16Array(frameCount);
  const right16 = new Int16Array(frameCount);
  let scaledSquares = 0;
  let scaledPeak = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const l = Math.max(-0.98, Math.min(0.98, left[frame] * scale));
    const r = Math.max(-0.98, Math.min(0.98, right[frame] * scale));
    left16[frame] = Math.round(l * 32767);
    right16[frame] = Math.round(r * 32767);
    scaledSquares += l * l + r * r;
    scaledPeak = Math.max(scaledPeak, Math.abs(l), Math.abs(r));
  }

  return {
    left16,
    right16,
    metrics: {
      sampleRate,
      channels,
      durationSeconds: asset.durationSeconds,
      sourcePeak: Number(scaledPeak.toFixed(6)),
      sourceRms: Number(Math.sqrt(scaledSquares / (frameCount * channels)).toFixed(6)),
      targetRms: asset.targetRms,
      targetPeak: asset.targetPeak,
      modes: asset.modes,
      strikes: asset.strikes,
    },
  };
}

function loadLamejs() {
  const bundlePath = require.resolve('lamejs/lame.all.js');
  const bundle = fs.readFileSync(bundlePath, 'utf8');
  return vm.runInNewContext(bundle + '\n; lamejs;', {});
}

const lamejs = loadLamejs();

function encodeMp3(left16, right16) {
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, encoderKbps);
  const blockSize = 1152;
  const chunks = [];
  for (let i = 0; i < left16.length; i += blockSize) {
    const leftChunk = left16.subarray(i, i + blockSize);
    const rightChunk = right16.subarray(i, i + blockSize);
    const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) chunks.push(Buffer.from(mp3buf));
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(Buffer.from(tail));
  return Buffer.concat(chunks);
}

function encodePcm16Wav(left16, right16) {
  const frameCount = left16.length;
  const blockAlign = channels * 2;
  const dataSize = frameCount * blockAlign;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * blockAlign, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataSize, 40);
  for (let frame = 0; frame < frameCount; frame += 1) {
    wav.writeInt16LE(left16[frame], 44 + frame * blockAlign);
    wav.writeInt16LE(right16[frame], 44 + frame * blockAlign + 2);
  }
  return wav;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function ensureCleanRoot(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const fileName of forbiddenRootFiles) {
    fs.rmSync(path.join(dir, fileName), { force: true });
  }
}

function readPackageVersion(name) {
  const packagePath = require.resolve(path.join(name, 'package.json'));
  return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
}

function main() {
  ensureCleanRoot(publicSoundsDir);
  ensureCleanRoot(docsSoundsDir);
  fs.mkdirSync(publicFeedbackDir, { recursive: true });
  fs.mkdirSync(docsFeedbackDir, { recursive: true });

  const lameVersion = readPackageVersion('lamejs');
  const provenanceAssets = [];
  for (const asset of [...assets, ...feedbackAssets]) {
    const isFeedback = asset.id.startsWith('feedback-');
    const rendered = isFeedback
      ? renderFeedbackPcm(asset)
      : asset.id === 'cloudlight-evening-loop'
        ? renderCloudlightEveningPcm(asset)
        : renderPcm(asset);
    const mp3 = encodeMp3(rendered.left16, rendered.right16);
    const publicPath = path.join(isFeedback ? publicFeedbackDir : publicSoundsDir, asset.fileName);
    const docsPath = path.join(isFeedback ? docsFeedbackDir : docsSoundsDir, asset.fileName);
    fs.writeFileSync(publicPath, mp3);
    fs.writeFileSync(docsPath, mp3);
    const hash = sha256(mp3);
    let nativeAndroidReceipt = {};
    if (asset.id === 'feedback-notification') {
      const nativeWav = encodePcm16Wav(rendered.left16, rendered.right16);
      fs.mkdirSync(path.dirname(androidFurinPath), { recursive: true });
      fs.writeFileSync(androidFurinPath, nativeWav);
      nativeAndroidReceipt = {
        nativeAndroidPath: path.relative(rootDir, androidFurinPath),
        nativeAndroidSha256: sha256(nativeWav),
        nativeAndroidBytes: nativeWav.length,
      };
    }
    provenanceAssets.push({
      id: asset.id,
      fileName: asset.fileName,
      role: asset.role,
      publicPath: path.relative(rootDir, publicPath),
      deployDocsPath: path.relative(rootDir, docsPath),
      sha256: hash,
      bytes: mp3.length,
      ...nativeAndroidReceipt,
      ...(Number.isFinite(asset.seed)
        ? {
            seed: '0x' + Number(asset.seed).toString(16),
            ...(asset.deterministicSpec ? { deterministicSpec: asset.deterministicSpec } : {}),
          }
        : { deterministicSpec: asset.deterministicSpec || 'fixed-note-sequence-with-cosine-envelopes' }),
      generator: asset.generator,
      parameters: {
        family: isFeedback ? 'feedback' : 'ambience',
        sampleRate,
        channels,
        durationSeconds: asset.durationSeconds,
        encoder: 'lamejs',
        encoderVersion: lameVersion,
        encoderKbps,
        runtimeGain: asset.runtimeGain,
        exclusions: asset.exclusions,
        noThirdPartySamples: true,
        noModelOrAiGeneratedAudioInput: true,
        sourceSignalMetrics: rendered.metrics,
      },
    });
    console.log('[non-hyperfocus-audio] wrote ' + asset.fileName + ' ' + mp3.length + ' bytes ' + hash);
  }

  const provenance = {
    schemaVersion: 2,
    purpose: 'ZenFlow non-Hyperfocus local ambience, persistent opt-in app-entry music, and feedback cues for entry/auth, orb, diary/settings, completed activities, milestones, and reminder previews.',
    generationPolicy: 'First-party deterministic procedural synthesis. No third-party samples, recordings, stock loops, voices, or AI-generated audio inputs are used.',
    rights: {
      referenceResearch: {
        title: 'Cloudbound Evening',
        creator: '3 Minute Escape',
        sourceUrl: 'https://www.youtube.com/watch?v=cJvhJqgDbKI',
        publicMetadataObserved: {
          durationSeconds: 167,
          statedIntent: ['relaxation', 'focus', 'emotional reset'],
        },
        licenseBoundary: 'No Creative Commons permission was identified; treat the upload as Standard YouTube License.',
        useBoundary: 'high-level mood and app-entry background-music research only',
        sourceAudioImported: false,
        sourceAudioRetained: false,
        samplesCopied: false,
        melodyOrHarmonyTranscribed: false,
      },
      projectLicense: {
        status: 'ASSET_SPECIFIC_PROPRIETARY_NOTICE',
        rootLicensePresent: false,
        copyrightNotice: 'Copyright © 2026 Yehor212 / ZenFlow. All rights reserved.',
        appliesTo: ['cloudlight-evening-loop composition', 'cloudlight-evening-loop sound recording', 'cloudlight-evening-loop generator specification'],
        releaseRightsScope: 'The Cloudlight Evening asset is first-party clean-room work with no external sample or recording license dependency; no repository-wide license is declared.',
        humanLegalReviewRequired: true,
      },
    },
    generatorScript: 'scripts/generate-non-hyperfocus-audio.cjs',
    encoder: {
      name: 'lamejs',
      version: lameVersion,
      license: 'LGPL-3.0',
      packageUse: 'dev-time MP3 encoder for generated local assets; encoder code is not shipped in the app bundle.',
    },
    rollback: 'Restore the previous public/docs root sound files and appAudioAssets mappings from git, then rerun npm run check:app-audio and Capacitor sync.',
    assets: provenanceAssets,
  };
  fs.mkdirSync(path.dirname(provenancePath), { recursive: true });
  fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n');
  console.log('[non-hyperfocus-audio] wrote ' + path.relative(rootDir, provenancePath));
}

main();
