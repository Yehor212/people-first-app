import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateT192BaselineManifest } from "./validate-t192-motion-baseline-manifest.mjs";

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function validateT192BaselineFiles(manifest, root = process.cwd()) {
  const errors = [...validateT192BaselineManifest(manifest).errors];
  for (const [index, row] of (manifest?.rows ?? []).entries()) {
    const path = resolve(root, row?.capture?.path ?? "");
    if (!existsSync(path)) {
      errors.push(`rows[${index}].capture.path is missing`);
      continue;
    }
    if (sha256(path) !== row.capture.sha256) errors.push(`rows[${index}].capture SHA-256 drift`);
    if (readFileSync(path).byteLength !== row.capture.bytes) errors.push(`rows[${index}].capture byte count drift`);
  }
  const normalPath = resolve(root, manifest?.artifacts?.normal?.path ?? "");
  if (!existsSync(normalPath)) errors.push("normal artifact path is missing");
  else if (sha256(normalPath) !== manifest.artifacts.normal.apk_sha256) errors.push("normal artifact SHA-256 drift");
  return { errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifestPath = process.argv[2];
  if (!manifestPath) throw new Error("usage: node scripts/validate-t192-motion-baseline-files.mjs <manifest.json>");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const result = validateT192BaselineFiles(manifest);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.errors.length ? 1 : 0;
}
