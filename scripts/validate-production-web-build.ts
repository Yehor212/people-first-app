#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { validateProductionWebBundleManifest } from "./ratchet-bundle-manifest";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

function readPwaManifest(rootDir: string, relativePath: string): Record<string, unknown> {
  const filePath = path.join(rootDir, relativePath);
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(
      `PRODUCTION WEB BUILD VALIDATION: PWA manifest parity could not read ${relativePath}`,
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      `PRODUCTION WEB BUILD VALIDATION: PWA manifest parity requires an object at ${relativePath}`,
    );
  }
  return value as Record<string, unknown>;
}

export function validatePwaManifestParity(rootDir: string = REPO_ROOT): void {
  const publicManifest = readPwaManifest(rootDir, "public/manifest.webmanifest");
  const docsManifest = readPwaManifest(rootDir, "docs/manifest.webmanifest");
  const distManifest = readPwaManifest(rootDir, "dist/manifest.webmanifest");

  if (!isDeepStrictEqual(publicManifest, docsManifest)) {
    throw new Error(
      "PRODUCTION WEB BUILD VALIDATION: PWA manifest parity failed for docs/manifest.webmanifest",
    );
  }
  if (!isDeepStrictEqual(publicManifest, distManifest)) {
    throw new Error(
      "PRODUCTION WEB BUILD VALIDATION: PWA manifest parity failed for dist/manifest.webmanifest",
    );
  }
}

export function validateCompletedProductionWebBuild(
  rootDir: string = REPO_ROOT,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.CAPACITOR_BUILD === "true") {
    throw new Error(
      "PRODUCTION WEB BUILD VALIDATION: CAPACITOR_BUILD=true is not a production-web context",
    );
  }
  validateProductionWebBundleManifest({ rootDir, env });
  validatePwaManifestParity(rootDir);
}

function main(): void {
  if (process.argv.length !== 2) {
    throw new Error("PRODUCTION WEB BUILD VALIDATION: this command does not accept arguments");
  }
  validateCompletedProductionWebBuild();
  console.log(
    "PRODUCTION WEB BUILD VALIDATION: bundle hashes and PWA manifest parity are valid",
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message.slice(0, 1_024) : "validation failed");
    process.exitCode = 1;
  }
}
