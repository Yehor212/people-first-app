import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const audioDir = join(rootDir, "public/sounds/hyperfocus");
const wavDir = join(rootDir, "output/audio-analysis/test-wav");
const levelOrder = ["soft", "deep", "intense"] as const;
const afconvertPath = "/usr/bin/afconvert";
const canRunAudioProgressionTest = process.platform === "darwin" && existsSync(afconvertPath);

interface AudioMetrics {
  durationSeconds: number;
  rmsDb: number;
  motionDb: number;
  zeroCrossingsPerSecond: number;
  intensityScore: number;
}

function readWavFloat32(filePath: string): {
  channels: number;
  sampleRate: number;
  samples: number[];
} {
  const buffer = readFileSync(filePath);
  if (
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WAVE"
  ) {
    throw new Error(`Expected WAV file: ${filePath}`);
  }

  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let audioFormat = 0;
  let bitsPerSample = 0;
  let dataStart = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunkStart);
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    }

    if (chunkId === "data") {
      dataStart = chunkStart;
      dataSize = chunkSize;
      break;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (!channels || !sampleRate || dataStart < 0) {
    throw new Error(`Missing WAV metadata: ${filePath}`);
  }
  if (audioFormat !== 3 || bitsPerSample !== 32) {
    throw new Error(
      `Expected 32-bit float WAV, got format ${audioFormat}/${bitsPerSample}: ${filePath}`
    );
  }

  const samples: number[] = [];
  for (let index = dataStart; index < dataStart + dataSize; index += 4) {
    samples.push(buffer.readFloatLE(index));
  }

  return { channels, sampleRate, samples };
}

function measureMp3(fileName: string): AudioMetrics {
  mkdirSync(wavDir, { recursive: true });
  const mp3Path = join(audioDir, fileName);
  const wavPath = join(wavDir, fileName.replace(/\.mp3$/, ".wav"));
  execFileSync(afconvertPath, ["-f", "WAVE", "-d", "LEF32", mp3Path, wavPath]);

  const { channels, sampleRate, samples } = readWavFloat32(wavPath);
  const frameCount = Math.floor(samples.length / channels);
  let sumSq = 0;
  let diffSq = 0;
  let zeroCrossings = 0;
  let previous = 0;

  for (let index = 0; index < samples.length; index += channels) {
    let mono = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      mono += samples[index + channel] ?? 0;
    }
    mono /= channels;

    sumSq += mono * mono;
    if (index > 0) {
      const delta = mono - previous;
      diffSq += delta * delta;
      if ((mono >= 0 && previous < 0) || (mono < 0 && previous >= 0)) {
        zeroCrossings += 1;
      }
    }
    previous = mono;
  }

  const durationSeconds = frameCount / sampleRate;
  const rms = Math.sqrt(sumSq / frameCount);
  const motion = Math.sqrt(diffSq / Math.max(1, frameCount - 1));
  const rmsDb = 20 * Math.log10(Math.max(rms, 1e-9));
  const motionDb = 20 * Math.log10(Math.max(motion, 1e-9));
  const zeroCrossingsPerSecond = zeroCrossings / durationSeconds;

  return {
    durationSeconds,
    rmsDb,
    motionDb,
    zeroCrossingsPerSecond,
    intensityScore:
      (rmsDb + 60) * 1.2 + (motionDb + 70) * 0.45 + Math.min(20, zeroCrossingsPerSecond / 400),
  };
}

describe("hyperfocus bundled audio intensity progression", () => {
  it.skipIf(!canRunAudioProgressionTest)(
    "ships soft, deep, and intense files that progress from calm to noisy",
    () => {
      const files = readdirSync(audioDir).filter((file) => file.endsWith(".mp3"));
      const families = new Set(
        files.map((file) => file.match(/^hyperfocus-([^-]+)-/)?.[1]).filter(Boolean)
      );

      for (const family of families) {
        const metrics = levelOrder.map((level) => ({
          level,
          fileName: `hyperfocus-${family}-${level}.mp3`,
          metrics: measureMp3(`hyperfocus-${family}-${level}.mp3`),
        }));

        for (const { metrics: audioMetrics } of metrics) {
          expect(audioMetrics.durationSeconds, `${family} duration`).toBeGreaterThanOrEqual(10);
        }

        const [soft, deep, intense] = metrics;
        expect(
          deep.metrics.intensityScore - soft.metrics.intensityScore,
          `${family} soft->deep`
        ).toBeGreaterThanOrEqual(3);
        expect(
          intense.metrics.intensityScore - deep.metrics.intensityScore,
          `${family} deep->intense`
        ).toBeGreaterThanOrEqual(3);
      }
    },
    120000
  );
});
