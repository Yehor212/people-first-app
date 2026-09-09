#!/usr/bin/env node

import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { assertIndependentInstallationEvidence, hashPath, validateRunEnvironmentEvidence } from "./evidence-lib.mjs";

function valueFor(argv, name) {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
}

function valuesFor(argv, name) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== name || argv[index + 1] === undefined) continue;
    values.push(argv[index + 1]);
    index += 1;
  }
  return values;
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
const output = resolveInsideRoot(root, valueFor(argv, "--output"), "run output");
if (!output.relative.startsWith("output/")) throw new Error("run output must stay under output/");
try {
  await lstat(output.absolute);
  throw new Error(`run output already exists: ${output.relative}`);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const environmentPath = resolveInsideRoot(
  root,
  valueFor(argv, "--environment"),
  "environment",
);
const environmentBytes = await readFile(environmentPath.absolute);
const environmentEnvelope = JSON.parse(environmentBytes.toString("utf8"));
if (environmentEnvelope.schemaVersion !== 2 || !environmentEnvelope.environment) {
  throw new Error("environment file must contain schemaVersion 2 and environment");
}
const artifactPaths = valuesFor(argv, "--artifact");
if (artifactPaths.length === 0) throw new Error("At least one --artifact is required");
const artifacts = [];
for (const artifactPath of artifactPaths) {
  const artifact = resolveInsideRoot(root, artifactPath, "artifact");
  const hashed = await hashPath(artifact.absolute);
  if (hashed.kind !== "file") throw new Error(`artifact must be a file: ${artifact.relative}`);
  artifacts.push({ path: artifact.relative, bytes: hashed.bytes, sha256: hashed.sha256 });
}
const actionsValue = valueFor(argv, "--actions");
let actions;
if (actionsValue) {
  const actionPath = resolveInsideRoot(root, actionsValue, "actions");
  const hashed = await hashPath(actionPath.absolute);
  if (hashed.kind !== "file") throw new Error("actions must be a file");
  actions = { path: actionPath.relative, bytes: hashed.bytes, sha256: hashed.sha256 };
}
const installationReceipts = [];
const readInstallation = async (flag) => {
  const receiptPath = resolveInsideRoot(root, valueFor(argv, flag), `${flag} independent observation`);
  const hashed = await hashPath(receiptPath.absolute);
  if (hashed.kind !== "file") throw new Error(`${flag} must be a file`);
  installationReceipts.push({ path: receiptPath.relative, bytes: hashed.bytes, sha256: hashed.sha256 });
  return JSON.parse(await readFile(receiptPath.absolute, "utf8"));
};
const before = await readInstallation("--installed-before");
const after = await readInstallation("--installed-after");
if (installationReceipts[0].path === installationReceipts[1].path || installationReceipts[0].sha256 === installationReceipts[1].sha256) {
  throw new Error("Independent installation receipts must be distinct files and observations");
}
const sourceApk = resolveInsideRoot(root, valueFor(argv, "--source-apk"), "source APK");
const source = await hashPath(sourceApk.absolute);
if (source.kind !== "file") throw new Error("source APK must be a file");
const startedAt = valueFor(argv, "--started-at");
const endedAt = valueFor(argv, "--ended-at");
const identity = assertIndependentInstallationEvidence({ before, after, sourceSha256: source.sha256, startedAt, endedAt });
validateRunEnvironmentEvidence(environmentEnvelope.environment);
if (environmentEnvelope.deviceKey !== before.deviceKey) {
  throw new Error("Environment device key must match both independent installation observations");
}
artifacts.push({ path: environmentPath.relative, bytes: environmentBytes.byteLength, sha256: createHash("sha256").update(environmentBytes).digest("hex") });
artifacts.push(...installationReceipts, { path: sourceApk.relative, bytes: source.bytes, sha256: source.sha256 });
const record = {
  runId: valueFor(argv, "--run-id"),
  scenario: valueFor(argv, "--scenario"),
  pass: valueFor(argv, "--pass"),
  status: valueFor(argv, "--status"),
  startedAt,
  endedAt,
  environment: environmentEnvelope.environment,
  ...identity,
  ...(actions ? { actions } : {}),
  symptom: valueFor(argv, "--symptom") ?? null,
  attribution: valueFor(argv, "--attribution") ?? null,
  rootCause: valueFor(argv, "--root-cause") ?? null,
  fix: valueFor(argv, "--fix") ?? null,
  metrics: null,
  artifacts,
};
await mkdir(path.dirname(output.absolute), { recursive: true });
await writeFile(output.absolute, `${JSON.stringify(record, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
  flag: "wx",
});
console.log(
  JSON.stringify({
    output: output.relative,
    runId: record.runId,
    pass: record.pass,
    status: record.status,
    artifactCount: artifacts.length,
  }),
);
