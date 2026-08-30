#!/usr/bin/env node

import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashPath } from "./evidence-lib.mjs";

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
const environmentEnvelope = JSON.parse(await readFile(environmentPath.absolute, "utf8"));
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
const installedSha256 = valueFor(argv, "--installed-sha256");
if (!/^[0-9a-f]{64}$/.test(installedSha256 ?? "")) {
  throw new Error("installed SHA-256 is invalid");
}
const record = {
  runId: valueFor(argv, "--run-id"),
  scenario: valueFor(argv, "--scenario"),
  pass: valueFor(argv, "--pass"),
  status: valueFor(argv, "--status"),
  startedAt: valueFor(argv, "--started-at"),
  endedAt: valueFor(argv, "--ended-at"),
  environment: environmentEnvelope.environment,
  installedBeforeSha256: installedSha256,
  installedAfterSha256: installedSha256,
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
