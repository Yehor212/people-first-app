import crypto from "node:crypto";
import {
  SAMPLE_RATE,
  CHANNELS,
  FAMILIES,
  LEVELS,
  PROCEDURAL_SEEDS,
  FEEDBACK_SPECS,
} from "./cc0-kimi-audio-config.mjs";

function fail(message) {
  throw new Error(`[cc0-kimi-audio] ${message}`);
}

export function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}
export function measureDecoded(decoded) {
  const frames = decoded.length / CHANNELS;
  if (!Number.isInteger(frames) || frames < 1) fail("decoded PCM frame count is invalid");
  let sumSquares = 0;
  let motionSquares = 0;
  let peak = 0;
  let leftMean = 0;
  let rightMean = 0;
  let crossings = 0;
  let previous = 0;
  let clippedSamples = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const left = decoded[frame * 2];
    const right = decoded[frame * 2 + 1];
    const mono = (left + right) * 0.5;
    sumSquares += mono * mono;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    leftMean += left;
    rightMean += right;
    if (Math.abs(left) >= 0.999 || Math.abs(right) >= 0.999) clippedSamples += 1;
    if (frame > 0) {
      const delta = mono - previous;
      motionSquares += delta * delta;
      if ((mono >= 0) !== (previous >= 0)) crossings += 1;
    }
    previous = mono;
  }
  const durationSeconds = frames / SAMPLE_RATE;
  const rms = Math.sqrt(sumSquares / frames);
  const motion = Math.sqrt(motionSquares / Math.max(1, frames - 1));
  const rmsDbfs = 20 * Math.log10(Math.max(rms, 1e-12));
  const peakDbfs = 20 * Math.log10(Math.max(peak, 1e-12));
  const motionDbfs = 20 * Math.log10(Math.max(motion, 1e-12));
  const zeroCrossingsPerSecond = crossings / Math.max(durationSeconds, 1e-9);
  const intensityScore =
    (rmsDbfs + 60) * 1.2 +
    (motionDbfs + 70) * 0.45 +
    Math.min(20, zeroCrossingsPerSecond / 400);

  const seamFrames = Math.min(Math.round(0.25 * SAMPLE_RATE), Math.floor(frames / 2));
  let seamDifference = 0;
  let startSquares = 0;
  let endSquares = 0;
  for (let frame = 0; frame < seamFrames; frame += 1) {
    const endFrame = frames - seamFrames + frame;
    const startMono = (decoded[frame * 2] + decoded[frame * 2 + 1]) * 0.5;
    const endMono = (decoded[endFrame * 2] + decoded[endFrame * 2 + 1]) * 0.5;
    seamDifference += Math.abs(startMono - endMono);
    startSquares += startMono * startMono;
    endSquares += endMono * endMono;
  }
  const startRms = Math.sqrt(startSquares / Math.max(1, seamFrames));
  const endRms = Math.sqrt(endSquares / Math.max(1, seamFrames));
  const startEndRmsDeltaDb = Math.abs(
    20 * Math.log10(Math.max(startRms, 1e-12)) -
      20 * Math.log10(Math.max(endRms, 1e-12))
  );
  const seamJump =
    (Math.abs(decoded[0] - decoded[decoded.length - 2]) +
      Math.abs(decoded[1] - decoded[decoded.length - 1])) *
    0.5;

  return {
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,
    frames,
    durationSeconds: rounded(durationSeconds, 6),
    rmsDbfs: rounded(rmsDbfs, 4),
    peakDbfs: rounded(peakDbfs, 4),
    dcOffsetLeft: rounded(leftMean / frames, 8),
    dcOffsetRight: rounded(rightMean / frames, 8),
    motionDbfs: rounded(motionDbfs, 4),
    zeroCrossingsPerSecond: rounded(zeroCrossingsPerSecond, 4),
    intensityScore: rounded(intensityScore, 4),
    seamJump: rounded(seamJump, 8),
    seamMeanAbsDifference250ms: rounded(seamDifference / Math.max(1, seamFrames), 8),
    startEndRmsDeltaDb: rounded(startEndRmsDeltaDb, 4),
    spectralFingerprint: calculateSpectralFingerprint(decoded),
    clippedSamples,
  };
}

function rounded(value, digits) {
  return Number(value.toFixed(digits));
}

const SPECTRAL_FREQUENCIES_HZ = Object.freeze([
  63, 90, 125, 180, 250, 355, 500, 710, 1_000, 1_400, 2_000, 2_800,
  4_000, 5_600, 8_000, 11_200, 15_000, 19_000,
]);

function calculateSpectralFingerprint(decoded) {
  const frames = decoded.length / CHANNELS;
  const windowFrames = Math.min(4_096, frames);
  if (windowFrames < 512) return [];
  const segmentCount = Math.min(8, Math.max(1, Math.floor(frames / windowFrames)));
  const logPowers = new Float64Array(SPECTRAL_FREQUENCIES_HZ.length);

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const start = Math.floor(
      segmentCount === 1
        ? Math.max(0, (frames - windowFrames) / 2)
        : (segment * (frames - windowFrames)) / (segmentCount - 1)
    );
    for (let frequencyIndex = 0; frequencyIndex < SPECTRAL_FREQUENCIES_HZ.length; frequencyIndex += 1) {
      const frequency = SPECTRAL_FREQUENCIES_HZ[frequencyIndex];
      const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / SAMPLE_RATE);
      let previous = 0;
      let previousPrevious = 0;
      for (let frame = 0; frame < windowFrames; frame += 1) {
        const absoluteFrame = start + frame;
        const mono =
          (decoded[absoluteFrame * 2] + decoded[absoluteFrame * 2 + 1]) * 0.5;
        const hann =
          0.5 - 0.5 * Math.cos((2 * Math.PI * frame) / Math.max(1, windowFrames - 1));
        const current = mono * hann + coefficient * previous - previousPrevious;
        previousPrevious = previous;
        previous = current;
      }
      const power = Math.max(
        1e-24,
        previousPrevious * previousPrevious +
          previous * previous -
          coefficient * previous * previousPrevious
      );
      logPowers[frequencyIndex] += 10 * Math.log10(power);
    }
  }

  const averaged = Array.from(logPowers, (value) => value / segmentCount);
  const mean = averaged.reduce((sum, value) => sum + value, 0) / averaged.length;
  const centered = averaged.map((value) => value - mean);
  const norm = Math.sqrt(centered.reduce((sum, value) => sum + value * value, 0));
  if (!(norm > 1e-12)) return centered.map(() => 0);
  return centered.map((value) => rounded(value / norm, 8));
}

function averageFingerprint(vectors) {
  if (!vectors.length || vectors.some((vector) => vector.length !== SPECTRAL_FREQUENCIES_HZ.length)) {
    fail("spectral fingerprint inventory is incomplete");
  }
  const averaged = SPECTRAL_FREQUENCIES_HZ.map((_, index) =>
    vectors.reduce((sum, vector) => sum + vector[index], 0) / vectors.length
  );
  const norm = Math.sqrt(averaged.reduce((sum, value) => sum + value * value, 0));
  if (!(norm > 1e-12)) fail("spectral fingerprint norm is invalid");
  return averaged.map((value) => value / norm);
}

function cosineSimilarity(left, right) {
  if (left.length !== right.length || left.length === 0) fail("fingerprint dimensions differ");
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return dot / Math.max(1e-12, Math.sqrt(leftNorm * rightNorm));
}

export function calculateFamilyDistinctness(qc) {
  const signatures = {};
  for (const family of FAMILIES) {
    signatures[family] = averageFingerprint(
      LEVELS.map(
        (level) =>
          qc.find((entry) => entry.assetId === `${family}:${level}`).decodedMetrics
            .spectralFingerprint
      )
    );
  }
  const comparisons = [];
  let maximumCorrelation = -1;
  for (let leftIndex = 0; leftIndex < FAMILIES.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < FAMILIES.length; rightIndex += 1) {
      const left = FAMILIES[leftIndex];
      const right = FAMILIES[rightIndex];
      const correlation = rounded(cosineSimilarity(signatures[left], signatures[right]), 6);
      maximumCorrelation = Math.max(maximumCorrelation, correlation);
      comparisons.push({ left, right, correlation });
    }
  }
  if (maximumCorrelation >= 0.995) {
    fail(`cross-family spectral correlation ${maximumCorrelation} is too high`);
  }
  return {
    frequenciesHz: SPECTRAL_FREQUENCIES_HZ,
    maximumCorrelation: rounded(maximumCorrelation, 6),
    thresholdExclusive: 0.995,
    comparisons,
    status: "PASS",
  };
}

function normalizePcm(audio, targetRmsDbfs, peakLimitDbfs) {
  const frames = audio.length / CHANNELS;
  let leftMean = 0;
  let rightMean = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    leftMean += audio[frame * 2];
    rightMean += audio[frame * 2 + 1];
  }
  leftMean /= frames;
  rightMean /= frames;
  let sumSquares = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    audio[frame * 2] -= leftMean;
    audio[frame * 2 + 1] -= rightMean;
    sumSquares += audio[frame * 2] ** 2 + audio[frame * 2 + 1] ** 2;
  }
  const rms = Math.sqrt(sumSquares / audio.length);
  if (!(rms > 1e-10)) fail("generated PCM is silent");
  const targetRms = 10 ** (targetRmsDbfs / 20);
  let scale = targetRms / rms;
  let peak = 0;
  for (const sample of audio) peak = Math.max(peak, Math.abs(sample * scale));
  const limit = 10 ** (peakLimitDbfs / 20);
  if (peak > limit) scale *= limit / peak;
  for (let index = 0; index < audio.length; index += 1) audio[index] *= scale;
  return audio;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function makeCyclicControls(count, random) {
  return Float64Array.from({ length: count }, () => random() * 2 - 1);
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function cyclicValue(controls, phase) {
  const wrapped = ((phase % 1) + 1) % 1;
  const scaled = wrapped * controls.length;
  const index = Math.floor(scaled) % controls.length;
  const fraction = smoothstep(scaled - Math.floor(scaled));
  const next = (index + 1) % controls.length;
  return controls[index] * (1 - fraction) + controls[next] * fraction;
}

function renderSoftAir() {
  const durationSeconds = 96;
  const frames = durationSeconds * SAMPLE_RATE;
  const audio = new Float32Array(frames * CHANNELS);
  const random = mulberry32(PROCEDURAL_SEEDS.softAir);
  const slow = makeCyclicControls(11, random);
  const body = makeCyclicControls(67, random);
  const veil = makeCyclicControls(509, random);
  const shimmer = makeCyclicControls(3_071, random);
  for (let frame = 0; frame < frames; frame += 1) {
    const phase = frame / frames;
    const leftPhase = phase;
    const rightPhase = (phase + 0.0137) % 1;
    const shared =
      0.64 * cyclicValue(slow, phase) +
      0.25 * cyclicValue(body, phase) +
      0.08 * cyclicValue(veil, phase) +
      0.03 * cyclicValue(shimmer, phase);
    const left =
      shared +
      0.055 * cyclicValue(body, leftPhase + 0.071) +
      0.025 * Math.sin(2 * Math.PI * 3 * phase);
    const right =
      shared +
      0.055 * cyclicValue(body, rightPhase + 0.071) +
      0.025 * Math.sin(2 * Math.PI * 5 * phase + 0.6);
    audio[frame * 2] = left;
    audio[frame * 2 + 1] = right;
  }
  return normalizePcm(audio, -35, -14);
}

function renderFeedback(spec) {
  const frames = Math.round(spec.durationSeconds * SAMPLE_RATE);
  const audio = new Float32Array(frames * CHANNELS);
  const random = mulberry32(spec.seed);
  for (let noteIndex = 0; noteIndex < spec.notes.length; noteIndex += 1) {
    const [frequency, startSeconds, lengthSeconds, level, pan] = spec.notes[noteIndex];
    const start = Math.round(startSeconds * SAMPLE_RATE);
    const noteFrames = Math.min(Math.round(lengthSeconds * SAMPLE_RATE), frames - start);
    const leftGain = Math.sqrt((1 - pan) * 0.5);
    const rightGain = Math.sqrt((1 + pan) * 0.5);
    const attack = Math.min(0.020, lengthSeconds * 0.16);
    const release = Math.min(0.180, lengthSeconds * 0.52);
    const detune = (random() - 0.5) * 0.35;
    for (let frame = 0; frame < noteFrames; frame += 1) {
      const time = frame / SAMPLE_RATE;
      const attackPhase = Math.min(1, time / Math.max(attack, 1e-6));
      const releasePhase = Math.min(
        1,
        Math.max(0, (lengthSeconds - time) / Math.max(release, 1e-6))
      );
      const envelope =
        Math.sin(attackPhase * Math.PI * 0.5) ** 2 *
        Math.sin(releasePhase * Math.PI * 0.5) ** 2;
      const phase = 2 * Math.PI * (frequency + detune) * time;
      const tone =
        Math.sin(phase) +
        0.14 * Math.sin(phase * 2.01 + 0.17) +
        0.055 * Math.sin(phase * 3.98 + 0.41) +
        0.022 * Math.sin(phase * 6.03 + 0.83);
      const air = (random() * 2 - 1) * Math.exp(-time / 0.045) * 0.018;
      const sample = (tone + air) * envelope * level;
      const target = (start + frame) * 2;
      audio[target] += sample * leftGain;
      audio[target + 1] += sample * rightGain;
    }
  }
  const edgeFrames = Math.min(Math.floor(frames / 4), Math.round(0.020 * SAMPLE_RATE));
  for (let frame = 0; frame < edgeFrames; frame += 1) {
    const fade = Math.sin((frame / Math.max(1, edgeFrames - 1)) * Math.PI * 0.5) ** 2;
    audio[frame * 2] *= fade;
    audio[frame * 2 + 1] *= fade;
    const reverse = frames - 1 - frame;
    audio[reverse * 2] *= fade;
    audio[reverse * 2 + 1] *= fade;
  }
  return normalizePcm(audio, spec.targetRmsDbfs, spec.peakLimitDbfs);
}

export function renderFirstPartyAsset(definition) {
  if (!definition || definition.sourceType !== "first-party-deterministic-procedural-synthesis") {
    fail("renderFirstPartyAsset requires a first-party procedural definition");
  }
  if (definition.id === "soft-air-veil") return renderSoftAir();
  if (definition.category === "feedback") {
    const spec = FEEDBACK_SPECS[definition.fileName];
    if (!spec) fail(`missing feedback synthesis spec for ${definition.fileName}`);
    return renderFeedback(spec);
  }
  fail(`unsupported first-party procedural asset: ${definition.id}`);
}
