#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateProductionWebBundleManifest } from "./ratchet-bundle-manifest";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

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
}

function main(): void {
  if (process.argv.length !== 2) {
    throw new Error("PRODUCTION WEB BUILD VALIDATION: this command does not accept arguments");
  }
  validateCompletedProductionWebBuild();
  console.log("PRODUCTION WEB BUILD VALIDATION: manifest and artifact hashes are valid");
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message.slice(0, 1_024) : "validation failed");
    process.exitCode = 1;
  }
}
