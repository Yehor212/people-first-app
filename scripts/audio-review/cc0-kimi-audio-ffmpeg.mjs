import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { SAMPLE_RATE, CHANNELS, BITRATE, GENERATOR_VERSION } from "./cc0-kimi-audio-config.mjs";

function fail(message) {
  throw new Error(`[cc0-kimi-audio] ${message}`);
}

export function executable(name) {
  const result = spawnSync(name, ["-version"], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    fail(`required executable is unavailable: ${name}`);
  }
  return {
    name,
    version: String(result.stdout || result.stderr).split(/\r?\n/, 1)[0].trim(),
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: options.binary || options.input ? undefined : "utf8",
    input: options.input,
    maxBuffer: options.maxBuffer ?? 256 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8")
      : String(result.stderr || "");
    fail(`${command} failed (${result.status ?? "spawn"}): ${stderr.slice(-6000)}`);
  }
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function downloadFile(url, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": "ZenFlow-Audio-Reconstruction/2.0 (+https://github.com/Yehor212/people-first-app)",
          accept: "audio/mpeg,application/octet-stream;q=0.9,*/*;q=0.1",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 32_000) throw new Error(`downloaded file is too small (${bytes.length} bytes)`);
      fs.writeFileSync(destination, bytes);
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(750 * attempt);
    }
  }
  fail(`download failed for ${url}: ${lastError?.message || lastError}`);
}

export function probeAudio(file, ffprobe) {
  const result = run(ffprobe, [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "stream=sample_rate,channels,codec_name,channel_layout",
    "-show_entries", "format=duration,size,format_name",
    "-of", "json",
    file,
  ]);
  return JSON.parse(result.stdout);
}

export function decodeAudio(file, ffmpeg) {
  const result = run(ffmpeg, [
    "-hide_banner", "-loglevel", "error",
    "-i", file,
    "-f", "f32le",
    "-acodec", "pcm_f32le",
    "-ar", String(SAMPLE_RATE),
    "-ac", String(CHANNELS),
    "pipe:1",
  ], { binary: true, maxBuffer: 512 * 1024 * 1024 });
  const buffer = Buffer.from(result.stdout);
  if (buffer.length % (4 * CHANNELS) !== 0) {
    fail(`decoded byte length is invalid for ${path.basename(file)}`);
  }
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Float32Array(arrayBuffer);
}

export function encodePcmMp3(audio, output, ffmpeg, metadata) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (os.endianness() !== "LE") fail("raw Float32 encoder requires little-endian host");
  const args = [
    "-hide_banner", "-loglevel", "error",
    "-f", "f32le",
    "-ar", String(SAMPLE_RATE),
    "-ac", String(CHANNELS),
    "-i", "pipe:0",
    "-map_metadata", "-1",
    "-codec:a", "libmp3lame",
    "-b:a", BITRATE,
    "-ar", String(SAMPLE_RATE),
    "-ac", String(CHANNELS),
  ];
  for (const [key, value] of Object.entries(metadata)) {
    args.push("-metadata", `${key}=${value}`);
  }
  args.push("-y", output);
  run(ffmpeg, args, {
    input: Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength),
    maxBuffer: 512 * 1024 * 1024,
  });
}
export function buildSourceLoop({ definition, sourceFile, outputFile, ffmpeg }) {
  const rawDuration = definition.durationSeconds + definition.overlapSeconds;
  const overlap = definition.overlapSeconds;
  const target = definition.durationSeconds;
  const middleEnd = target;
  const tailEnd = target + overlap;
  const loudnorm = `loudnorm=I=${definition.targetLoudnessLufs}:TP=${definition.truePeakDbfs}:LRA=7:linear=true`;
  const preFilters = [
    "aresample=48000",
    "aformat=sample_fmts=fltp:channel_layouts=stereo",
    definition.filters,
    loudnorm,
    `alimiter=limit=${(10 ** (definition.truePeakDbfs / 20)).toFixed(6)}:level=false`,
    "asetpts=PTS-STARTPTS",
  ].filter(Boolean).join(",");
  const graph = [
    `[0:a]${preFilters},asplit=3[midin][tailin][headin]`,
    `[midin]atrim=start=${overlap}:end=${middleEnd},asetpts=PTS-STARTPTS[mid]`,
    `[tailin]atrim=start=${middleEnd}:end=${tailEnd},asetpts=PTS-STARTPTS[tail]`,
    `[headin]atrim=start=0:end=${overlap},asetpts=PTS-STARTPTS[head]`,
    `[tail][head]acrossfade=d=${overlap}:c1=qsin:c2=qsin[seam]`,
    `[mid][seam]concat=n=2:v=0:a=1[out]`,
  ].join(";");

  const metadata = {
    title: definition.fileName.replace(/\.mp3$/, ""),
    artist: "ZenFlow / Yehor212",
    comment: `CC0-derived from BigSoundBank; source ${definition.sourceKey}; deterministic processing; ${GENERATOR_VERSION}`,
    copyright: "Source recording released under CC0; derived mastering metadata retained in evidence.",
  };
  const args = [
    "-hide_banner", "-loglevel", "error",
    "-ss", String(definition.sourceStartSeconds),
    "-t", String(rawDuration),
    "-i", sourceFile,
    "-filter_complex", graph,
    "-map", "[out]",
    "-map_metadata", "-1",
    "-codec:a", "libmp3lame",
    "-b:a", BITRATE,
    "-ar", String(SAMPLE_RATE),
    "-ac", String(CHANNELS),
  ];
  for (const [key, value] of Object.entries(metadata)) {
    args.push("-metadata", `${key}=${value}`);
  }
  args.push("-y", outputFile);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  run(ffmpeg, args);
}

export function validateAsset(definition, file, probe, metrics) {
  const streams = probe.streams || [];
  if (
    streams.length !== 1 ||
    streams[0].codec_name !== "mp3" ||
    Number(streams[0].sample_rate) !== SAMPLE_RATE ||
    Number(streams[0].channels) !== CHANNELS
  ) {
    fail(`${definition.fileName} violates MP3 / 48 kHz / stereo contract`);
  }
  const durationTolerance = definition.category === "feedback" ? 0.09 : 0.16;
  if (Math.abs(metrics.durationSeconds - definition.durationSeconds) > durationTolerance) {
    fail(`${definition.fileName} duration ${metrics.durationSeconds}s is outside tolerance`);
  }
  if (metrics.peakDbfs > -2.0) fail(`${definition.fileName} peak exceeds -2 dBFS`);
  if (metrics.clippedSamples !== 0) fail(`${definition.fileName} contains clipped samples`);
  if (Math.abs(metrics.dcOffsetLeft) > 0.001 || Math.abs(metrics.dcOffsetRight) > 0.001) {
    fail(`${definition.fileName} DC offset exceeds 0.001`);
  }
  if (definition.looped) {
    if (metrics.seamJump > 0.055) {
      fail(`${definition.fileName} seam jump ${metrics.seamJump} exceeds 0.055`);
    }
    if (metrics.seamMeanAbsDifference250ms > 0.105) {
      fail(`${definition.fileName} seam mean difference ${metrics.seamMeanAbsDifference250ms} exceeds 0.105`);
    }
    if (metrics.startEndRmsDeltaDb > 2.5) {
      fail(`${definition.fileName} start/end RMS delta ${metrics.startEndRmsDeltaDb} dB exceeds 2.5 dB`);
    }
  }
  if (!fs.statSync(file).size) fail(`${definition.fileName} is empty`);
}

