#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

function valueFor(argv, name) {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
}

function resolveInsideRoot(root, candidate, label) {
  if (!candidate) throw new Error(`${label} is required`);
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the repository`);
  }
  return { absolute, relative: relative.split(path.sep).join("/") };
}

const argv = process.argv.slice(2);
const root = process.cwd();
const input = resolveInsideRoot(root, valueFor(argv, "--input"), "video input");
const output = resolveInsideRoot(root, valueFor(argv, "--output"), "report output");
const framesOutputValue = valueFor(argv, "--frames-output");
const framesOutput = framesOutputValue
  ? resolveInsideRoot(root, framesOutputValue, "checkpoint output")
  : null;
const checkpointTimes = valueFor(argv, "--times");
if (checkpointTimes && !framesOutput) {
  throw new Error("--times requires --frames-output");
}
if (!output.relative.startsWith("output/")) {
  throw new Error("report output must stay under output/");
}
const inputStat = await lstat(input.absolute);
if (!inputStat.isFile() || inputStat.isSymbolicLink()) {
  throw new Error("video input must be a regular file without symlinks");
}

const probeResult = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-count_frames",
    "-select_streams",
    "v:0",
    "-show_entries",
    "format=duration:stream=codec_name,width,height,nb_read_frames",
    "-of",
    "json",
    input.absolute,
  ],
  { encoding: "utf8", timeout: 300_000 }
);
if (probeResult.status !== 0) {
  throw new Error(`Video must fully decode: ${probeResult.stderr.trim()}`);
}
const probe = JSON.parse(probeResult.stdout);
const stream = probe.streams?.[0];
const inspection = {
  codec: stream?.codec_name ?? "unknown",
  decodedSampleCount: Number(stream?.nb_read_frames),
  durationSeconds: Number(probe.format?.duration),
  height: Number(stream?.height),
  width: Number(stream?.width),
};

if (
  !Number.isFinite(inspection.durationSeconds) ||
  inspection.durationSeconds <= 0 ||
  !Number.isInteger(inspection.width) ||
  inspection.width < 1 ||
  !Number.isInteger(inspection.height) ||
  inspection.height < 1 ||
  !Number.isInteger(inspection.decodedSampleCount) ||
  inspection.decodedSampleCount < 1
) {
  throw new Error("Decoded video metadata is incomplete");
}

const decodeResult = spawnSync("ffmpeg", ["-v", "error", "-i", input.absolute, "-f", "null", "-"], {
  encoding: "utf8",
  timeout: 300_000,
});
if (decodeResult.status !== 0) {
  throw new Error(`Video must fully decode: ${decodeResult.stderr.trim()}`);
}

if (framesOutput) {
  await mkdir(framesOutput.absolute, { recursive: true });
  const [trustedRoot, checkpointRoot] = await Promise.all([
    realpath(root),
    realpath(framesOutput.absolute),
  ]);
  const checkpointRelative = path.relative(trustedRoot, checkpointRoot);
  if (
    checkpointRelative === ".." ||
    checkpointRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(checkpointRelative)
  ) {
    throw new Error("checkpoint output must resolve inside the repository");
  }
  const requestedTimes = checkpointTimes
    ? checkpointTimes.split(",").map((value) => Number(value))
    : [0.5, inspection.durationSeconds / 2, Math.max(0.5, inspection.durationSeconds - 0.5)];
  if (
    requestedTimes.length === 0 ||
    requestedTimes.some(
      (seconds) => !Number.isFinite(seconds) || seconds < 0 || seconds > inspection.durationSeconds
    )
  ) {
    throw new Error("checkpoint time is invalid");
  }
  const checkpointNames = requestedTimes.map(
    (seconds) => `frame-${Math.round(seconds * 1000)}ms.png`
  );
  if (new Set(checkpointNames).size !== checkpointNames.length) {
    throw new Error("checkpoint times must resolve to unique millisecond frames");
  }
  inspection.checkpoints = checkpointNames.map((name, index) => {
    const checkpointPath = path.join(checkpointRoot, name);
    const extraction = spawnSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-ss",
        String(requestedTimes[index]),
        "-i",
        input.absolute,
        "-frames:v",
        "1",
        "-y",
        checkpointPath,
      ],
      { encoding: "utf8", timeout: 300_000 }
    );
    if (extraction.status !== 0) {
      throw new Error(`Checkpoint extraction failed: ${extraction.stderr.trim()}`);
    }
    return path.relative(root, checkpointPath).split(path.sep).join("/");
  });
}

const bytes = await readFile(input.absolute);
const report = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  video: {
    path: input.relative,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  },
  inspection,
};
await mkdir(path.dirname(output.absolute), { recursive: true });
await writeFile(output.absolute, `${JSON.stringify(report, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(JSON.stringify({ output: output.relative, ...inspection }));
