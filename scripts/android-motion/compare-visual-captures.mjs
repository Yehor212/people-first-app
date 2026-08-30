#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { median, medianAbsoluteDeviation } from "./evidence-lib.mjs";

const argv = process.argv.slice(2);
const valuesFor = (name) => argv.flatMap((value, index) => value === name && argv[index + 1] ? [argv[index + 1]] : []);
const valueFor = (name) => valuesFor(name)[0];
const baselinePaths = valuesFor("--baseline");
const candidatePaths = valuesFor("--candidate");
const output = valueFor("--output");
const board = valueFor("--board");
if (baselinePaths.length < 1 || candidatePaths.length < 1 || !output || !board) {
  throw new Error("Usage: compare-visual-captures.mjs --baseline <png> [--baseline <png> ...] --candidate <png> [--candidate <png> ...] --output <json> --board <png>");
}

async function readCapture(capturePath) {
  const image = sharp(capturePath).removeAlpha();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.height <= 160) throw new Error(`Invalid capture geometry: ${capturePath}`);
  const crop = { left: 0, top: 64, width: metadata.width, height: metadata.height - 144 };
  const { data, info } = await image.extract(crop).raw().toBuffer({ resolveWithObject: true });
  return { path: capturePath, data, info, original: { width: metadata.width, height: metadata.height } };
}

function compare(first, second) {
  if (first.info.width !== second.info.width || first.info.height !== second.info.height || first.info.channels !== second.info.channels) {
    throw new Error(`Capture geometry mismatch: ${first.path} vs ${second.path}`);
  }
  let absoluteDelta = 0;
  let changedChannels = 0;
  for (let index = 0; index < first.data.length; index += 1) {
    const delta = Math.abs(first.data[index] - second.data[index]);
    absoluteDelta += delta;
    if (delta > 8) changedChannels += 1;
  }
  return {
    first: first.path,
    second: second.path,
    meanAbsoluteChannelDelta: Number((absoluteDelta / first.data.length).toFixed(6)),
    changedChannelPct: Number(((changedChannels * 100) / first.data.length).toFixed(6)),
  };
}

const baselines = await Promise.all(baselinePaths.map(readCapture));
const candidates = await Promise.all(candidatePaths.map(readCapture));
const baselineComparisons = [];
for (let first = 0; first < baselines.length; first += 1) {
  for (let second = first + 1; second < baselines.length; second += 1) baselineComparisons.push(compare(baselines[first], baselines[second]));
}
const candidateComparisons = candidates.flatMap((candidate) => baselines.map((baseline) => compare(baseline, candidate)));
const bestCandidateComparison = candidateComparisons.reduce((best, entry) => (
  !best || entry.meanAbsoluteChannelDelta < best.meanAbsoluteChannelDelta ? entry : best
), null);
const baselineDeltas = baselineComparisons.length > 0
  ? baselineComparisons.map((entry) => entry.meanAbsoluteChannelDelta)
  : [0];
const fixedNoiseEnvelope = {
  sampleCount: baselineDeltas.length,
  medianMeanAbsoluteChannelDelta: median(baselineDeltas),
  madMeanAbsoluteChannelDelta: medianAbsoluteDeviation(baselineDeltas),
  maxMeanAbsoluteChannelDelta: Math.max(...baselineDeltas),
};
const report = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  crop: { topPx: 64, bottomPx: 80 },
  geometry: baselines[0].original,
  baselineCaptureCount: baselines.length,
  candidateCaptureCount: candidates.length,
  fixedNoiseEnvelope,
  bestCandidateComparison,
  withinBaselineNoiseEnvelope:
    bestCandidateComparison.meanAbsoluteChannelDelta <= fixedNoiseEnvelope.maxMeanAbsoluteChannelDelta,
  boundary:
    "Natural animated-frame noise only; this report is not artistic approval or physical-device proof.",
};

const resolvedOutput = path.resolve(output);
const resolvedBoard = path.resolve(board);
await mkdir(path.dirname(resolvedOutput), { recursive: true });
await mkdir(path.dirname(resolvedBoard), { recursive: true });
await writeFile(resolvedOutput, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

const bestBaselinePath = bestCandidateComparison.first;
const bestCandidatePath = bestCandidateComparison.second;
const boardWidth = baselines[0].original.width * 2;
const boardHeight = baselines[0].original.height + 64;
const label = Buffer.from(`<svg width="${boardWidth}" height="64" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="64" fill="#071812"/><text x="24" y="42" fill="#fff" font-family="sans-serif" font-size="28">EXACT SHA BASELINE</text><text x="${baselines[0].original.width + 24}" y="42" fill="#fff" font-family="sans-serif" font-size="28">BENCHMARK INSTRUMENTATION</text></svg>`);
await sharp({ create: { width: boardWidth, height: boardHeight, channels: 3, background: "#071812" } })
  .composite([
    { input: label, left: 0, top: 0 },
    { input: bestBaselinePath, left: 0, top: 64 },
    { input: bestCandidatePath, left: baselines[0].original.width, top: 64 },
  ])
  .png()
  .toFile(resolvedBoard);

console.log(JSON.stringify({ output, board, withinBaselineNoiseEnvelope: report.withinBaselineNoiseEnvelope, fixedNoiseEnvelope, bestCandidateComparison }));
