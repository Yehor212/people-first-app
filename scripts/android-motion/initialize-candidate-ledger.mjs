#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateEvidenceLedger } from "./evidence-lib.mjs";

function valueFor(argv, name) {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
}

function resolveInsideRoot(root, candidate, label) {
  if (!candidate) throw new Error(`${label} is required`);
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must stay inside the repository`);
  }
  return { absolute, relative: relative.split(path.sep).join("/") };
}

const argv = process.argv.slice(2);
const root = process.cwd();
const candidateId = valueFor(argv, "--candidate-id");
const sourceManifest = resolveInsideRoot(
  root,
  valueFor(argv, "--source-manifest"),
  "source manifest",
);
const apk = resolveInsideRoot(root, valueFor(argv, "--apk"), "APK");
const output = resolveInsideRoot(root, valueFor(argv, "--output"), "ledger output");
const installedSha256 = valueFor(argv, "--installed-sha256");
const signingCertificateSha256 = valueFor(argv, "--signing-certificate-sha256");
const lastUpdateTime = valueFor(argv, "--last-update-time");
for (const [label, value] of [
  ["installed SHA-256", installedSha256],
  ["signing certificate SHA-256", signingCertificateSha256],
]) {
  if (!/^[0-9a-f]{64}$/.test(value ?? "")) throw new Error(`${label} is invalid`);
}
if (!lastUpdateTime) throw new Error("last update time is required");
const outputStat = await lstat(path.dirname(output.absolute));
if (!outputStat.isDirectory()) throw new Error("ledger output directory is missing");
try {
  await lstat(output.absolute);
  throw new Error(`ledger output already exists: ${output.relative}`);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const sourceEnvelope = JSON.parse(await readFile(sourceManifest.absolute, "utf8"));
const apkBytes = await readFile(apk.absolute);
const apkSha256 = createHash("sha256").update(apkBytes).digest("hex");
const ledger = validateEvidenceLedger({
  schemaVersion: 2,
  source: sourceEnvelope.source,
  candidate: {
    id: candidateId,
    status: "UNVERIFIED",
    apk: {
      path: apk.relative,
      bytes: apkBytes.byteLength,
      sha256: apkSha256,
      installedBeforeSha256: installedSha256,
      installedAfterSha256: installedSha256,
      packageName: "com.zenflow.app",
      versionName: "2.1.1",
      versionCode: 38,
      signingCertificateSha256,
      lastUpdateTime,
    },
  },
  runs: [],
  completion: {
    emulatorApi36: "UNVERIFIED",
    emulatorApi26: "UNVERIFIED",
    physical60Hz: "UNVERIFIED",
    physicalHighRefresh: "UNVERIFIED",
    visualCritic: "UNVERIFIED",
    userReview: "UNVERIFIED",
  },
});
await mkdir(path.dirname(output.absolute), { recursive: true });
await writeFile(output.absolute, `${JSON.stringify(ledger, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(
  JSON.stringify({
    output: output.relative,
    candidateId,
    apkSha256,
    installedSha256,
    status: ledger.candidate.status,
  }),
);
