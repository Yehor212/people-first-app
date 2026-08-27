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
    durationSeconds: 0.34,
    targetRms: 0.030,
    targetPeak: 0.12,
    runtimeGain: 0.20,
    notes: [
      { frequency: 587.33, start: 0.02, length: 0.25, level: 0.82 },
    ],
    generator: 'deterministic single-note gentle reminder cue with cosine envelope',
    exclusions: ['voice', 'sampled audio', 'sharp ping', 'alarm', 'siren', 'bass hit', 'long tail'],
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

function renderFeedbackPcm(asset) {
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
    const rendered = isFeedback ? renderFeedbackPcm(asset) : renderPcm(asset);
    const mp3 = encodeMp3(rendered.left16, rendered.right16);
    const publicPath = path.join(isFeedback ? publicFeedbackDir : publicSoundsDir, asset.fileName);
    const docsPath = path.join(isFeedback ? docsFeedbackDir : docsSoundsDir, asset.fileName);
    fs.writeFileSync(publicPath, mp3);
    fs.writeFileSync(docsPath, mp3);
    const hash = sha256(mp3);
    provenanceAssets.push({
      id: asset.id,
      fileName: asset.fileName,
      role: asset.role,
      publicPath: path.relative(rootDir, publicPath),
      deployDocsPath: path.relative(rootDir, docsPath),
      sha256: hash,
      bytes: mp3.length,
      ...(Number.isFinite(asset.seed)
        ? { seed: '0x' + Number(asset.seed).toString(16) }
        : { deterministicSpec: 'fixed-note-sequence-with-cosine-envelopes' }),
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
    schemaVersion: 1,
    purpose: 'ZenFlow non-Hyperfocus local ambience and feedback cues for entry/auth, orb, diary/settings, completed activities, milestones, and opt-in reminder previews.',
    generationPolicy: 'First-party deterministic procedural synthesis. No third-party samples, recordings, stock loops, voices, or AI-generated audio inputs are used.',
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
