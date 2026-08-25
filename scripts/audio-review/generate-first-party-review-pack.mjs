#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const SAMPLE_RATE = 48_000;
export const CHANNELS = 2;
export const BITRATE = "128k";
export const GENERATOR_VERSION = "1.0.0";
export const FAMILIES = Object.freeze([
  "forest",
  "rain",
  "ocean",
  "fireplace",
  "river",
  "wind",
]);
export const LEVELS = Object.freeze(["soft", "deep", "intense"]);
export const AMBIENCE_FILE_NAMES = Object.freeze([
  "soft-air-veil.mp3",
  "gentle-water-bed.mp3",
  "soft-rain-veil.mp3",
]);
export const FEEDBACK_FILE_NAMES = Object.freeze([
  "feedback-success.mp3",
  "feedback-complete.mp3",
  "feedback-streak.mp3",
  "feedback-milestone.mp3",
  "feedback-notification.mp3",
]);
export const EXPECTED_FILE_NAMES = Object.freeze([
  ...FAMILIES.flatMap((family) =>
    LEVELS.map((level) => `hyperfocus-${family}-${level}.mp3`)
  ),
  ...AMBIENCE_FILE_NAMES,
  ...FEEDBACK_FILE_NAMES,
]);

const PEAK_LIMIT_DBFS = -3;
const FEEDBACK_PEAK_LIMIT_DBFS = -6;
const TARGET_RMS = Object.freeze({ soft: -33.5, deep: -29.5, intense: -25.5 });
const BASE_SEEDS = Object.freeze({
  forest: 0x0f011e57,
  rain: 0x000a11ce,
  ocean: 0x0000ce4a,
  fireplace: 0x0000f1ae,
  river: 0x0000a1b3,
  wind: 0x000071ad,
  "soft-air-veil": 0x05a17a11,
  "gentle-water-bed": 0x6e71e5a7,
  "soft-rain-veil": 0x005017a1,
  "feedback-success": 0x051cc355,
  "feedback-complete": 0x0c0a1e7e,
  "feedback-streak": 0x00057aea,
  "feedback-milestone": 0x0a11e570,
  "feedback-notification": 0x00a071f1,
});
const FEEDBACK_NOTES = Object.freeze({
  "feedback-success": Object.freeze([
    [392, 0.02, 0.21, 0.70],
    [493.88, 0.135, 0.285, 0.88],
  ]),
  "feedback-complete": Object.freeze([
    [329.63, 0.02, 0.22, 0.58],
    [392, 0.135, 0.255, 0.72],
    [493.88, 0.285, 0.285, 0.88],
  ]),
  "feedback-streak": Object.freeze([
    [349.23, 0.02, 0.23, 0.54],
    [440, 0.145, 0.25, 0.66],
    [523.25, 0.295, 0.27, 0.77],
    [587.33, 0.445, 0.28, 0.86],
  ]),
  "feedback-milestone": Object.freeze([
    [196, 0, 0.52, 0.24],
    [392, 0.025, 0.255, 0.62],
    [493.88, 0.185, 0.275, 0.76],
    [587.33, 0.365, 0.29, 0.88],
  ]),
  "feedback-notification": Object.freeze([[587.33, 0.02, 0.25, 0.74]]),
});

function fail(message) {
  throw new Error(`[first-party-audio-review] ${message}`);
}

function executable(name) {
  const probe = spawnSync(name, ["-version"], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (probe.error || probe.status !== 0) fail(`required executable is unavailable: ${name}`);
  return {
    name,
    version: String(probe.stdout || probe.stderr).split(/\r?\n/, 1)[0].trim(),
  };
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

function gaussian(random) {
  const first = Math.max(random(), 1e-12);
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * random());
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function valueNoise(frames, periodSamples, random) {
  const period = Math.max(1, Math.round(periodSamples));
  const controls = new Float32Array(Math.ceil(frames / period) + 2);
  for (let index = 0; index < controls.length; index += 1) controls[index] = gaussian(random);
  const output = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    const position = frame / period;
    const index = Math.floor(position);
    const fraction = smoothstep(position - index);
    output[frame] = controls[index] * (1 - fraction) + controls[index + 1] * fraction;
  }
  return output;
}

function periodicEnvelope(frames, cycles, weights) {
  const output = new Float32Array(frames);
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let frame = 0; frame < frames; frame += 1) {
    const phase = frame / frames;
    let value = 1;
    for (let index = 0; index < cycles.length; index += 1) {
      value += weights[index] * Math.sin(2 * Math.PI * cycles[index] * phase);
    }
    output[frame] = value;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  const range = Math.max(1e-9, maximum - minimum);
  for (let frame = 0; frame < frames; frame += 1) {
    output[frame] = 0.62 + 0.38 * ((output[frame] - minimum) / range);
  }
  return output;
}

function stereoMix(base, side, width) {
  const output = new Float32Array(base.length * CHANNELS);
  const boundedWidth = Math.min(0.75, Math.max(0, width));
  for (let frame = 0; frame < base.length; frame += 1) {
    output[frame * 2] = base[frame] + side[frame] * boundedWidth;
    output[frame * 2 + 1] = base[frame] - side[frame] * boundedWidth;
  }
  return output;
}

function addDecayEvents(audio, random, ratePerSecond, durationSeconds, kernelSeconds, frequencyHz, amplitudeRange, noiseMix) {
  const expected = ratePerSecond * durationSeconds;
  const eventCount = Math.max(0, Math.round(expected + gaussian(random) * Math.sqrt(Math.max(1, expected))));
  const frames = audio.length / CHANNELS;
  const kernelFrames = Math.max(8, Math.round(kernelSeconds * SAMPLE_RATE));
  for (let event = 0; event < eventCount; event += 1) {
    const position = Math.floor(random() * Math.max(1, frames - 1));
    const amplitude = amplitudeRange[0] + random() * (amplitudeRange[1] - amplitudeRange[0]);
    const phaseOffset = random() * 2 * Math.PI;
    const pan = -0.7 + random() * 1.4;
    const leftGain = Math.sqrt((1 - pan) * 0.5);
    const rightGain = Math.sqrt((1 + pan) * 0.5);
    const available = Math.min(kernelFrames, frames - position);
    for (let frame = 0; frame < available; frame += 1) {
      const time = frame / SAMPLE_RATE;
      const decay = Math.exp(-time / Math.max(0.001, kernelSeconds * 0.24));
      const tone = Math.sin(2 * Math.PI * frequencyHz * time + phaseOffset);
      const noise = gaussian(random);
      const sample = (tone * (1 - noiseMix) + noise * noiseMix) * decay * amplitude;
      const target = (position + frame) * 2;
      audio[target] += sample * leftGain;
      audio[target + 1] += sample * rightGain;
    }
  }
}

function addChirps(audio, random, count, durationSeconds, amplitude) {
  const frames = audio.length / CHANNELS;
  const chirpFrames = Math.round(0.16 * SAMPLE_RATE);
  for (let chirpIndex = 0; chirpIndex < count; chirpIndex += 1) {
    const start = Math.floor((1 + random() * Math.max(0.01, durationSeconds - 2)) * SAMPLE_RATE);
    const available = Math.min(chirpFrames, frames - start);
    const low = 1100 + random() * 600;
    const high = 1700 + random() * 900;
    const pan = -0.65 + random() * 1.3;
    const leftGain = Math.sqrt((1 - pan) * 0.5);
    const rightGain = Math.sqrt((1 + pan) * 0.5);
    for (let frame = 0; frame < available; frame += 1) {
      const time = frame / SAMPLE_RATE;
      const progress = Math.min(1, time / 0.16);
      const envelope = Math.sin(Math.PI * progress) ** 2;
      const phase = 2 * Math.PI * (low * time + 0.5 * ((high - low) / 0.16) * time * time);
      const sample = Math.sin(phase) * envelope * amplitude;
      const target = (start + frame) * 2;
      audio[target] += sample * leftGain;
      audio[target + 1] += sample * rightGain;
    }
  }
}

function loopify(raw, targetFrames, overlapFrames) {
  if (raw.length !== (targetFrames + overlapFrames) * CHANNELS) fail("loop source length does not match contract");
  const output = new Float32Array(targetFrames * CHANNELS);
  const bodyFrames = targetFrames - overlapFrames;
  output.set(raw.subarray(overlapFrames * CHANNELS, targetFrames * CHANNELS), 0);
  for (let frame = 0; frame < overlapFrames; frame += 1) {
    const progress = frame / Math.max(1, overlapFrames - 1);
    const weight = Math.sin(progress * Math.PI * 0.5) ** 2;
    for (let channel = 0; channel < CHANNELS; channel += 1) {
      output[(bodyFrames + frame) * 2 + channel] = raw[(targetFrames + frame) * 2 + channel] * (1 - weight) + raw[frame * 2 + channel] * weight;
    }
  }
  return output;
}

function normalize(audio, targetRmsDbfs, peakLimitDbfs) {
  let leftMean = 0;
  let rightMean = 0;
  const frames = audio.length / CHANNELS;
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
  if (!(rms > 1e-9)) fail("generated signal is silent");
  const targetRms = 10 ** (targetRmsDbfs / 20);
  let scale = targetRms / rms;
  let peak = 0;
  for (const sample of audio) peak = Math.max(peak, Math.abs(sample * scale));
  const peakLimit = 10 ** (peakLimitDbfs / 20);
  if (peak > peakLimit) scale *= peakLimit / peak;
  for (let index = 0; index < audio.length; index += 1) audio[index] *= scale;
  return audio;
}

function renderFamily(definition) {
  const targetFrames = Math.round(definition.durationSeconds * SAMPLE_RATE);
  const overlapFrames = Math.min(Math.round(1.5 * SAMPLE_RATE), Math.max(64, Math.floor(targetFrames / 3)));
  const total = targetFrames + overlapFrames;
  const random = mulberry32(definition.seed);
  const sideRandom = mulberry32(definition.seed ^ 0x9e3779b9);
  const rank = LEVELS.indexOf(definition.level);
  const low = valueNoise(total, definition.family === "wind" ? 7200 : 4200, random);
  const body = valueNoise(total, ["ocean", "wind"].includes(definition.family) ? 520 : 240, random);
  const detail = valueNoise(total, ["rain", "river"].includes(definition.family) ? 4 : 12, random);
  const side = valueNoise(total, 17, sideRandom);
  let audio;

  if (definition.family === "forest") {
    const envelope = periodicEnvelope(total, [3 + rank, 7 + rank], [0.17, 0.08]);
    const base = new Float32Array(total);
    for (let frame = 0; frame < total; frame += 1) base[frame] = 0.5 * low[frame] + 0.31 * body[frame] + (0.08 + 0.035 * rank) * detail[frame] * envelope[frame];
    audio = stereoMix(base, side, 0.18 + 0.05 * rank);
    addChirps(audio, random, [0, 2, 4][rank], total / SAMPLE_RATE, [0, 0.01, 0.014][rank]);
  } else if (definition.family === "rain") {
    const envelope = periodicEnvelope(total, [2 + rank, 5 + rank], [0.1, 0.05]);
    const fine = valueNoise(total, 2, random);
    const base = new Float32Array(total);
    for (let frame = 0; frame < total; frame += 1) base[frame] = (0.18 * low[frame] + 0.3 * body[frame] + (0.42 + 0.08 * rank) * detail[frame] + 0.1 * fine[frame]) * envelope[frame];
    audio = stereoMix(base, side, 0.16 + 0.04 * rank);
    addDecayEvents(audio, random, [4, 13, 31][rank], total / SAMPLE_RATE, [0.025, 0.032, 0.04][rank], [1700, 1450, 1200][rank], [[0.015, 0.035], [0.018, 0.045], [0.02, 0.055]][rank], 0.7);
  } else if (definition.family === "ocean") {
    const wave = periodicEnvelope(total, [3 + rank, 5 + rank], [0.3, 0.1]);
    const base = new Float32Array(total);
    for (let frame = 0; frame < total; frame += 1) {
      const foam = Math.max(0, wave[frame] - (0.67 - 0.04 * rank));
      base[frame] = (0.55 * low[frame] + 0.3 * body[frame]) * wave[frame] + (0.12 + 0.06 * rank) * detail[frame] * foam;
    }
    audio = stereoMix(base, side, 0.27 + 0.05 * rank);
    addDecayEvents(audio, random, [0.35, 0.7, 1.15][rank], total / SAMPLE_RATE, [0.45, 0.6, 0.75][rank], [190, 165, 140][rank], [[0.025, 0.055], [0.035, 0.075], [0.045, 0.095]][rank], 0.84);
  } else if (definition.family === "fireplace") {
    const envelope = periodicEnvelope(total, [4 + rank, 9 + rank], [0.08, 0.04]);
    const base = new Float32Array(total);
    for (let frame = 0; frame < total; frame += 1) base[frame] = (0.62 * low[frame] + 0.25 * body[frame] + 0.08 * detail[frame]) * envelope[frame];
    audio = stereoMix(base, side, 0.12 + 0.04 * rank);
    addDecayEvents(audio, random, [1.7, 4.8, 8.5][rank], total / SAMPLE_RATE, [0.018, 0.024, 0.032][rank], [420, 510, 620][rank], [[0.015, 0.04], [0.02, 0.06], [0.025, 0.075]][rank], 0.62);
  } else if (definition.family === "river") {
    const envelope = periodicEnvelope(total, [4 + rank, 11 + rank], [0.12, 0.05]);
    const fine = valueNoise(total, 3, random);
    const base = new Float32Array(total);
    for (let frame = 0; frame < total; frame += 1) base[frame] = (0.24 * low[frame] + 0.34 * body[frame] + (0.3 + 0.07 * rank) * detail[frame] + 0.07 * fine[frame]) * envelope[frame];
    audio = stereoMix(base, side, 0.22 + 0.05 * rank);
    addDecayEvents(audio, random, [0.9, 2.6, 5][rank], total / SAMPLE_RATE, [0.055, 0.07, 0.085][rank], [310, 260, 220][rank], [[0.01, 0.025], [0.015, 0.035], [0.02, 0.045]][rank], 0.48);
  } else if (definition.family === "wind") {
    const envelope = periodicEnvelope(total, [2 + rank, 6 + rank], [0.29, 0.1]);
    const base = new Float32Array(total);
    for (let frame = 0; frame < total; frame += 1) base[frame] = (0.62 * low[frame] + 0.28 * body[frame] + (0.05 + 0.035 * rank) * detail[frame]) * envelope[frame];
    audio = stereoMix(base, side, 0.3 + 0.06 * rank);
  } else fail(`unsupported family: ${definition.family}`);

  return normalize(loopify(audio, targetFrames, overlapFrames), definition.targetRmsDbfs, definition.peakLimitDbfs);
}

function renderAmbience(definition) {
  const targetFrames = Math.round(definition.durationSeconds * SAMPLE_RATE);
  const overlapFrames = Math.min(Math.round(2 * SAMPLE_RATE), Math.max(64, Math.floor(targetFrames / 3)));
  const total = targetFrames + overlapFrames;
  const random = mulberry32(definition.seed);
  const sideRandom = mulberry32(definition.seed ^ 0xa5a5a5a5);
  const low = valueNoise(total, 7600, random);
  const body = valueNoise(total, 620, random);
  const detail = valueNoise(total, 18, random);
  const side = valueNoise(total, 41, sideRandom);
  const envelope = periodicEnvelope(total, [3, 8, 13], [0.1, 0.05, 0.025]);
  const base = new Float32Array(total);
  let audio;
  if (definition.id === "soft-air-veil") {
    for (let frame = 0; frame < total; frame += 1) base[frame] = (0.72 * low[frame] + 0.23 * body[frame] + 0.05 * detail[frame]) * envelope[frame];
    audio = stereoMix(base, side, 0.23);
  } else if (definition.id === "gentle-water-bed") {
    const flow = periodicEnvelope(total, [5, 9, 17], [0.13, 0.06, 0.03]);
    for (let frame = 0; frame < total; frame += 1) base[frame] = (0.36 * low[frame] + 0.43 * body[frame] + 0.21 * detail[frame]) * flow[frame];
    audio = stereoMix(base, side, 0.3);
    addDecayEvents(audio, random, 0.45, total / SAMPLE_RATE, 0.1, 245, [0.007, 0.018], 0.45);
  } else if (definition.id === "soft-rain-veil") {
    const mist = valueNoise(total, 5, random);
    for (let frame = 0; frame < total; frame += 1) base[frame] = (0.18 * low[frame] + 0.31 * body[frame] + 0.39 * detail[frame] + 0.12 * mist[frame]) * envelope[frame];
    audio = stereoMix(base, side, 0.19);
    addDecayEvents(audio, random, 5, total / SAMPLE_RATE, 0.022, 1550, [0.007, 0.02], 0.72);
  } else fail(`unsupported ambience asset: ${definition.id}`);
  return normalize(loopify(audio, targetFrames, overlapFrames), definition.targetRmsDbfs, definition.peakLimitDbfs);
}

function renderFeedback(definition) {
  const frames = Math.round(definition.durationSeconds * SAMPLE_RATE);
  const audio = new Float32Array(frames * CHANNELS);
  const notes = FEEDBACK_NOTES[definition.id];
  for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
    const [frequency, startSeconds, lengthSeconds, level] = notes[noteIndex];
    const start = Math.round(startSeconds * SAMPLE_RATE);
    const noteFrames = Math.min(Math.round(lengthSeconds * SAMPLE_RATE), frames - start);
    const pan = -0.08 + noteIndex * 0.05;
    const leftGain = Math.sqrt((1 - pan) * 0.5);
    const rightGain = Math.sqrt((1 + pan) * 0.5);
    const attack = 0.018;
    const release = Math.min(0.16, lengthSeconds * 0.48);
    for (let frame = 0; frame < noteFrames; frame += 1) {
      const time = frame / SAMPLE_RATE;
      const attackPhase = Math.min(1, time / attack);
      const releasePhase = Math.min(1, Math.max(0, (lengthSeconds - time) / release));
      const envelope = Math.sin(attackPhase * Math.PI * 0.5) ** 2 * Math.sin(releasePhase * Math.PI * 0.5) ** 2;
      const phase = 2 * Math.PI * frequency * time;
      const tone = Math.sin(phase) + 0.105 * Math.sin(phase * 2 + 0.12) + 0.035 * Math.sin(phase * 0.5 + 0.25);
      const sample = tone * envelope * level;
      const target = (start + frame) * 2;
      audio[target] += sample * leftGain;
      audio[target + 1] += sample * rightGain;
    }
  }
  const fadeFrames = Math.min(Math.floor(frames / 4), Math.round(0.025 * SAMPLE_RATE));
  for (let frame = 0; frame < fadeFrames; frame += 1) {
    const fade = Math.sin((frame / Math.max(1, fadeFrames - 1)) * Math.PI * 0.5) ** 2;
    audio[frame * 2] *= fade;
    audio[frame * 2 + 1] *= fade;
    const reverse = frames - 1 - frame;
    audio[reverse * 2] *= fade;
    audio[reverse * 2 + 1] *= fade;
  }
  return normalize(audio, definition.targetRmsDbfs, definition.peakLimitDbfs);
}

export function createDefinitions({ durationScale = 1 } = {}) {
  const scale = Number(durationScale);
  if (!(scale > 0 && scale <= 1)) fail("durationScale must be in (0, 1]");
  const definitions = [];
  for (let familyIndex = 0; familyIndex < FAMILIES.length; familyIndex += 1) {
    const family = FAMILIES[familyIndex];
    for (let levelIndex = 0; levelIndex < LEVELS.length; levelIndex += 1) {
      const level = LEVELS[levelIndex];
      definitions.push({
        id: `${family}:${level}`,
        fileName: `hyperfocus-${family}-${level}.mp3`,
        category: "hyperfocus",
        role: `${family} focus bed — ${level}`,
        durationSeconds: Math.max(0.5, 30 * scale),
        targetRmsDbfs: TARGET_RMS[level],
        peakLimitDbfs: PEAK_LIMIT_DBFS,
        seed: (BASE_SEEDS[family] + familyIndex * 0x10001 + levelIndex * 0x9e37) >>> 0,
        family,
        level,
        looped: true,
      });
    }
  }
  for (const [id, fileName, role, targetRmsDbfs] of [
    ["soft-air-veil", "soft-air-veil.mp3", "Entry/auth air ambience", -34],
    ["gentle-water-bed", "gentle-water-bed.mp3", "Orb water ambience", -31.5],
    ["soft-rain-veil", "soft-rain-veil.mp3", "Diary/settings rain ambience", -32.5],
  ]) definitions.push({ id, fileName, category: "ambience", role, durationSeconds: Math.max(0.75, 96 * scale), targetRmsDbfs, peakLimitDbfs: PEAK_LIMIT_DBFS, seed: BASE_SEEDS[id], family: null, level: null, looped: true });
  for (const [id, fileName, role, duration, targetRmsDbfs] of [
    ["feedback-success", "feedback-success.mp3", "Quiet saved-action confirmation", 0.48, -25],
    ["feedback-complete", "feedback-complete.mp3", "Completed-activity confirmation", 0.62, -24],
    ["feedback-streak", "feedback-streak.mp3", "Occasional streak cue", 0.78, -23],
    ["feedback-milestone", "feedback-milestone.mp3", "Rare milestone cue", 0.72, -22.5],
    ["feedback-notification", "feedback-notification.mp3", "Opt-in reminder preview", 0.34, -27],
  ]) definitions.push({ id, fileName, category: "feedback", role, durationSeconds: Math.max(0.2, duration * Math.max(scale, 0.5)), targetRmsDbfs, peakLimitDbfs: FEEDBACK_PEAK_LIMIT_DBFS, seed: BASE_SEEDS[id], family: null, level: null, looped: false });
  if (definitions.length !== 26 || definitions.some((definition, index) => definition.fileName !== EXPECTED_FILE_NAMES[index])) fail("asset definitions violate the exact 26-file inventory");
  return definitions;
}

export function renderAsset(definition) {
  if (definition.category === "hyperfocus") return renderFamily(definition);
  if (definition.category === "ambience") return renderAmbience(definition);
  if (definition.category === "feedback") return renderFeedback(definition);
  fail(`unsupported category: ${definition.category}`);
}

function encodeMp3(audio, destination, ffmpeg) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (os.endianness() !== "LE") fail("raw Float32 encoder requires little-endian host");
  const completed = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "f32le", "-ar", String(SAMPLE_RATE), "-ac", String(CHANNELS), "-i", "pipe:0", "-map_metadata", "-1", "-codec:a", "libmp3lame", "-b:a", BITRATE, "-ar", String(SAMPLE_RATE), "-ac", String(CHANNELS), "-write_id3v1", "0", "-y", destination], { input: Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength), maxBuffer: 128 * 1024 * 1024 });
  if (completed.error || completed.status !== 0) fail(`ffmpeg encode failed for ${path.basename(destination)}: ${String(completed.stderr || completed.error)}`);
}

function probeMp3(file, ffprobe) {
  const completed = spawnSync(ffprobe, ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate,channels,codec_name", "-show_entries", "format=duration,size", "-of", "json", file], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (completed.error || completed.status !== 0) fail(`ffprobe failed for ${path.basename(file)}`);
  return JSON.parse(completed.stdout);
}

function decodeMp3(file, ffmpeg) {
  const completed = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", file, "-f", "f32le", "-acodec", "pcm_f32le", "-ar", String(SAMPLE_RATE), "-ac", String(CHANNELS), "pipe:1"], { maxBuffer: 128 * 1024 * 1024 });
  if (completed.error || completed.status !== 0) fail(`ffmpeg decode failed for ${path.basename(file)}`);
  const buffer = Buffer.from(completed.stdout);
  if (buffer.length % (4 * CHANNELS) !== 0) fail(`decoded byte length is invalid for ${path.basename(file)}`);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Float32Array(arrayBuffer);
}

function measure(decoded) {
  const frames = decoded.length / CHANNELS;
  let sumSquares = 0, motionSquares = 0, peak = 0, leftMean = 0, rightMean = 0, crossings = 0, previous = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const left = decoded[frame * 2], right = decoded[frame * 2 + 1], mono = (left + right) * 0.5;
    sumSquares += mono * mono;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    leftMean += left;
    rightMean += right;
    if (frame > 0) {
      const difference = mono - previous;
      motionSquares += difference * difference;
      if ((mono >= 0) !== (previous >= 0)) crossings += 1;
    }
    previous = mono;
  }
  const durationSeconds = frames / SAMPLE_RATE;
  const rms = Math.sqrt(sumSquares / Math.max(1, frames));
  const motion = Math.sqrt(motionSquares / Math.max(1, frames - 1));
  const rmsDbfs = 20 * Math.log10(Math.max(rms, 1e-12));
  const peakDbfs = 20 * Math.log10(Math.max(peak, 1e-12));
  const motionDbfs = 20 * Math.log10(Math.max(motion, 1e-12));
  const zeroCrossingsPerSecond = crossings / Math.max(durationSeconds, 1e-9);
  const intensityScore = (rmsDbfs + 60) * 1.2 + (motionDbfs + 70) * 0.45 + Math.min(20, zeroCrossingsPerSecond / 400);
  const seamJump = (Math.abs(decoded[0] - decoded[decoded.length - 2]) + Math.abs(decoded[1] - decoded[decoded.length - 1])) * 0.5;
  let clippedSamples = 0;
  for (const sample of decoded) if (Math.abs(sample) >= 0.999) clippedSamples += 1;
  return { sampleRate: SAMPLE_RATE, channels: CHANNELS, frames, durationSeconds: Number(durationSeconds.toFixed(6)), rmsDbfs: Number(rmsDbfs.toFixed(4)), peakDbfs: Number(peakDbfs.toFixed(4)), dcOffsetLeft: Number((leftMean / frames).toFixed(8)), dcOffsetRight: Number((rightMean / frames).toFixed(8)), motionDbfs: Number(motionDbfs.toFixed(4)), zeroCrossingsPerSecond: Number(zeroCrossingsPerSecond.toFixed(4)), intensityScore: Number(intensityScore.toFixed(4)), seamJump: Number(seamJump.toFixed(8)), clippedSamples };
}

function validate(definition, file, probe, metrics) {
  const streams = probe.streams || [];
  if (streams.length !== 1 || streams[0].codec_name !== "mp3" || Number(streams[0].sample_rate) !== SAMPLE_RATE || Number(streams[0].channels) !== CHANNELS) fail(`${path.basename(file)} violates the MP3/48 kHz/stereo contract`);
  const tolerance = definition.category === "feedback" ? 0.09 : 0.15;
  if (Math.abs(metrics.durationSeconds - definition.durationSeconds) > tolerance) fail(`${path.basename(file)} decoded duration is outside tolerance`);
  if (metrics.peakDbfs > definition.peakLimitDbfs + 0.4) fail(`${path.basename(file)} decoded peak exceeds its limit`);
  if (metrics.clippedSamples !== 0) fail(`${path.basename(file)} contains clipped samples`);
  if (Math.abs(metrics.dcOffsetLeft) > 0.001 || Math.abs(metrics.dcOffsetRight) > 0.001) fail(`${path.basename(file)} DC offset exceeds its limit`);
  if (definition.looped && metrics.seamJump > 0.16) fail(`${path.basename(file)} loop boundary jump exceeds its limit`);
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function relativeOutputPath(definition) {
  return definition.category === "hyperfocus" ? path.join("audio", "hyperfocus", definition.fileName) : path.join("audio", definition.category, definition.fileName);
}
function writeListeningChecklist(outputDir, provenance) {
  const rows = provenance.map((entry) => `| \`${entry.fileName}\` | \`${entry.sha256}\` | UNREVIEWED | |`).join("\n");
  fs.writeFileSync(path.join(outputDir, "HUMAN_LISTENING_CHECKLIST.md"), `# Human listening acceptance — REVIEW_ONLY\n\nDo not copy these files into runtime paths until a human accepts the exact hashes.\n\n1. Use neutral headphones and the device speaker at low volume.\n2. Repeat every short cue at least ten times.\n3. Loop every Hyperfocus and ambience file for at least ten minutes.\n4. Reject speech-like content, melody, beat, alarm resemblance, harsh clicks, foreground scares, obvious seams, fatigue, or incorrect intensity order.\n5. Record Web/PWA, Android, iOS, and Desktop separately.\n\n| File | SHA-256 | Decision | Notes |\n| --- | --- | --- | --- |\n${rows}\n\n| Surface | Status |\n| --- | --- |\n| Web/Vite | UNVERIFIED |\n| Installed PWA | UNVERIFIED |\n| Android/Capacitor | UNVERIFIED |\n| iOS/WKWebView | UNVERIFIED |\n| Desktop/Tauri | UNVERIFIED |\n`);
}

export function buildReviewPack({ outputDir, durationScale = 1 } = {}) {
  if (!outputDir) fail("outputDir is required");
  const ffmpeg = executable("ffmpeg"), ffprobe = executable("ffprobe"), absoluteOutput = path.resolve(outputDir);
  fs.rmSync(path.join(absoluteOutput, "audio"), { recursive: true, force: true });
  fs.rmSync(path.join(absoluteOutput, "evidence"), { recursive: true, force: true });
  fs.mkdirSync(absoluteOutput, { recursive: true });
  const definitions = createDefinitions({ durationScale }), provenance = [], qc = [];
  for (const definition of definitions) {
    const relativePath = relativeOutputPath(definition), destination = path.join(absoluteOutput, relativePath), rendered = renderAsset(definition);
    encodeMp3(rendered, destination, ffmpeg.name);
    const probe = probeMp3(destination, ffprobe.name), decoded = decodeMp3(destination, ffmpeg.name), metrics = measure(decoded);
    validate(definition, destination, probe, metrics);
    const bytes = fs.readFileSync(destination);
    provenance.push({ assetId: definition.id, fileName: definition.fileName, category: definition.category, role: definition.role, relativePath: relativePath.split(path.sep).join("/"), sha256: sha256(bytes), bytes: bytes.length, seed: `0x${definition.seed.toString(16).padStart(8, "0")}`, sourceType: "first-party-deterministic-procedural-synthesis", thirdPartySamples: false, stockRecordings: false, voices: false, aiGeneratedAudioInputs: false, recoveredKimiBinaryInputs: false, generatorVersion: GENERATOR_VERSION, sampleRate: SAMPLE_RATE, channels: CHANNELS, targetRmsDbfs: definition.targetRmsDbfs, peakLimitDbfs: definition.peakLimitDbfs, looped: definition.looped, family: definition.family, level: definition.level, feedbackNotes: FEEDBACK_NOTES[definition.id] || null });
    qc.push({ assetId: definition.id, fileName: definition.fileName, probe, decodedMetrics: metrics, status: "PASS" });
  }
  const intensityProgression = {};
  for (const family of FAMILIES) {
    const scores = LEVELS.map((level) => qc.find((candidate) => candidate.assetId === `${family}:${level}`).decodedMetrics.intensityScore);
    const gaps = [Number((scores[1] - scores[0]).toFixed(4)), Number((scores[2] - scores[1]).toFixed(4))];
    if (gaps.some((gap) => gap < 3)) fail(`${family} intensity progression gaps ${gaps.join(", ")} are invalid`);
    intensityProgression[family] = { order: LEVELS, scores, gaps, status: "PASS" };
  }
  const rights = { schemaVersion: 1, status: "REVIEW_ONLY", releaseAuthorization: false, assetCount: provenance.length, basis: "Every waveform is deterministic mathematical synthesis; no third-party audio input or recovered Kimi binary is used.", ownerLicenseDecision: "UNVERIFIED", formalLegalReview: "UNVERIFIED", entries: provenance.map((entry) => ({ fileName: entry.fileName, sha256: entry.sha256, sourceType: entry.sourceType, thirdPartyAudioInputs: false, releaseStatus: "REVIEW_ONLY" })) };
  const verification = { schemaVersion: 1, status: "PASS", assetCount: provenance.length, exactInventory: provenance.map((entry) => entry.fileName).join("\n") === EXPECTED_FILE_NAMES.join("\n"), decodedQcCount: qc.length, sampleRate: SAMPLE_RATE, channels: CHANNELS, durationScale, intensityProgression, runtimeModified: false, humanListening: "UNVERIFIED", platformPlayback: { web: "UNVERIFIED", pwa: "UNVERIFIED", android: "UNVERIFIED", ios: "UNVERIFIED", desktop: "UNVERIFIED" }, toolchain: { node: process.version, ffmpeg: ffmpeg.version, ffprobe: ffprobe.version } };
  if (!verification.exactInventory || provenance.length !== 26 || qc.length !== 26) fail("verification inventory is incomplete");
  writeJson(path.join(absoluteOutput, "evidence", "provenance.json"), { schemaVersion: 1, assets: provenance });
  writeJson(path.join(absoluteOutput, "evidence", "rights-ledger.json"), rights);
  writeJson(path.join(absoluteOutput, "evidence", "decoded-qc.json"), { schemaVersion: 1, assets: qc });
  writeJson(path.join(absoluteOutput, "evidence", "verification.json"), verification);
  fs.writeFileSync(path.join(absoluteOutput, "SHA256SUMS"), `${provenance.map((entry) => `${entry.sha256}  ${entry.relativePath}`).join("\n")}\n`);
  writeListeningChecklist(absoluteOutput, provenance);
  fs.writeFileSync(path.join(absoluteOutput, "README.md"), `# ZenFlow first-party audio review pack\n\n- Status: REVIEW_ONLY\n- Assets: 26\n- Source audio: none\n- Runtime modified: no\n- Format: 48 kHz stereo MP3 at 128 kbps\n\nThe included evidence is engineering provenance, not legal advice. Human listening, platform playback, owner licensing, and formal legal acceptance remain UNVERIFIED.\n`);
  return verification;
}

function parseArguments(argv) {
  const result = { outputDir: "", durationScale: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output") result.outputDir = argv[++index] || "";
    else if (argv[index] === "--duration-scale") result.durationScale = Number(argv[++index]);
    else fail(`unknown argument: ${argv[index]}`);
  }
  if (!result.outputDir) fail("--output is required");
  return result;
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entry === import.meta.url) {
  const verification = buildReviewPack(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(verification, null, 2)}\n`);
}
