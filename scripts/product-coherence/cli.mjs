#!/usr/bin/env node
import { loadAuditBundle, renderAuditMarkdown, validateAuditBundle } from "./core.mjs";

const [command, ...args] = process.argv.slice(2);

try {
  if (!["inventory", "validate", "report"].includes(command)) {
    throw new Error("usage: cli.mjs <inventory|validate|report> --input <ledger-directory>");
  }
  const inputIndex = args.indexOf("--input");
  const inputDirectory = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  if (!inputDirectory || args.length !== 2) throw new Error("--input <ledger-directory> is required");

  const bundle = await loadAuditBundle(inputDirectory);
  const result = validateAuditBundle(bundle);
  if (!result.ok && command !== "validate") {
    process.stderr.write(`${result.errors.join("\n")}\n`);
  } else if (command === "inventory") {
    const manifests = bundle.manifests
      .map(normalizeManifest)
      .sort((left, right) => left.subjectId.localeCompare(right.subjectId));
    process.stdout.write(`${JSON.stringify(manifests)}\n`);
  } else if (command === "validate") {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    process.stdout.write(renderAuditMarkdown(bundle));
  }
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}

function normalizeManifest(manifest) {
  return manifest.subjectId === "candidate"
    ? {
        subjectId: manifest.subjectId,
        subjectSnapshotSha256: manifest.subjectSnapshotSha256,
        candidateProvenance: {
          gitStatusSha256: manifest.candidateProvenance.gitStatusSha256,
          trackedDiffSha256: manifest.candidateProvenance.trackedDiffSha256,
        },
      }
    : { subjectId: manifest.subjectId, subjectSnapshotSha256: manifest.subjectSnapshotSha256 };
}
