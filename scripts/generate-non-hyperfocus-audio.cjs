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
    targetRms: 0.030,
    targetPeak: 0.14,
    runtimeGain: 0.18,
    generator: 'cyclic low-density value-noise air bed',
    exclusions: ['voice', 'human breathing', 'birds', 'thunder', 'fire crackle', 'rock clacks', 'melody'],
  },
  {
    id: 'gentle-water-bed',
    fileName: 'gentle-water-bed.mp3',
    role: 'Orb ambience',
    seed: 0x6e71e5a7,
    durationSeconds: 96,
    targetRms: 0.042,
    targetPeak: 0.18,
    runtimeGain: 0.36,
    generator: 'cyclic soft-flow water bed without discrete impacts',
    exclusions: ['voice', 'birds', 'gulls', 'rock clacks', 'splashes', 'thunder', 'melody'],
  },
  {
    id: 'soft-rain-veil',
    fileName: 'soft-rain-veil.mp3',
    role: 'Diary/settings ambience',
    seed: 0x5017a1,
    durationSeconds: 96,
    targetRms: 0.038,
    targetPeak: 0.16,
    runtimeGain: 0.32,
    generator: 'cyclic soft rain sheet without thunder or impact spikes',
    exclusions: ['voice', 'birds', 'thunder', 'fire crackle', 'hard rain hits', 'melody'],
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

function airSample(phase, t, layers, side) {
  const slow = cyclicValue(layers[0], phase);
  const body = cyclicValue(layers[1], phase + side * 0.017);
  const veil = cyclicValue(layers[2], phase + side * 0.031);
  const drift = Math.sin(Math.PI * 2 * (0.052 * t + side * 0.13));
  return 0.68 * slow + 0.24 * body + 0.08 * veil + 0.04 * drift;
}

function waterSample(phase, t, layers, side) {
  const flow = cyclicValue(layers[0], phase + side * 0.011);
  const shimmer = cyclicValue(layers[1], phase + side * 0.037);
  const sheet = cyclicValue(layers[2], phase + side * 0.071);
  const swell = 0.76 + 0.18 * cyclicValue(layers[3], phase) + 0.06 * Math.sin(Math.PI * 2 * 0.041 * t);
  return (0.56 * flow + 0.28 * shimmer + 0.16 * sheet) * swell;
}

function rainSample(phase, t, layers, side) {
  const mist = cyclicValue(layers[0], phase + side * 0.009);
  const sheet = cyclicValue(layers[1], phase + side * 0.021);
  const fine = cyclicValue(layers[2], phase + side * 0.055);
  const cloud = 0.82 + 0.14 * cyclicValue(layers[3], phase) + 0.04 * Math.sin(Math.PI * 2 * 0.033 * t);
  return (0.34 * mist + 0.40 * sheet + 0.26 * fine) * cloud;
}

function renderPcm(asset) {
  const frameCount = asset.durationSeconds * sampleRate;
  const left = new Float64Array(frameCount);
  const right = new Float64Array(frameCount);
  const layerCounts = asset.id === 'soft-air-veil'
    ? [9, 57, 421]
    : asset.id === 'gentle-water-bed'
      ? [197, 719, 2503, 17]
      : [293, 1103, 3907, 19];
  const layers = makeLayers(asset.seed, layerCounts);

  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < frameCount; i += 1) {
    const phase = i / frameCount;
    const t = i / sampleRate;
    let l;
    let r;
    if (asset.id === 'soft-air-veil') {
      l = airSample(phase, t, layers, 0);
      r = airSample(phase, t, layers, 1);
    } else if (asset.id === 'gentle-water-bed') {
      l = waterSample(phase, t, layers, 0);
      r = waterSample(phase, t, layers, 1);
    } else {
      l = rainSample(phase, t, layers, 0);
      r = rainSample(phase, t, layers, 1);
    }
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
      layerCounts,
      targetRms: asset.targetRms,
      targetPeak: asset.targetPeak,
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

  const lameVersion = readPackageVersion('lamejs');
  const provenanceAssets = [];
  for (const asset of assets) {
    const rendered = renderPcm(asset);
    const mp3 = encodeMp3(rendered.left16, rendered.right16);
    const publicPath = path.join(publicSoundsDir, asset.fileName);
    const docsPath = path.join(docsSoundsDir, asset.fileName);
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
      seed: '0x' + Number(asset.seed).toString(16),
      generator: asset.generator,
      parameters: {
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
    purpose: 'ZenFlow non-Hyperfocus local ambience replacement for entry/auth, orb, and diary/settings surfaces.',
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
