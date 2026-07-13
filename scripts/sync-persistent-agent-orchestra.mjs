import { fileURLToPath } from "node:url";
import path from "node:path";

import { syncWorkspace } from "./persistent-agent-orchestra/registry-core.mjs";

const USAGE = "Usage: node scripts/sync-persistent-agent-orchestra.mjs --check|--write";

export async function main(argv = process.argv.slice(2), rootDir = process.cwd()) {
  if (argv.length !== 1 || (argv[0] !== "--check" && argv[0] !== "--write")) {
    console.error(USAGE);
    return 2;
  }

  const mode = argv[0] === "--write" ? "write" : "check";
  let result;
  try {
    result = await syncWorkspace({ rootDir, mode, now: new Date() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[persistent-agent-orchestra] internal error: ${message}`);
    return 2;
  }

  for (const warning of result.warnings) {
    console.warn(`[persistent-agent-orchestra] WARNING: ${warning}`);
  }
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`[persistent-agent-orchestra] ERROR: ${error}`);
    }
    return 1;
  }

  if (mode === "write") {
    console.log(
      `[persistent-agent-orchestra] structural write complete; ${result.writtenPaths.length} managed artifact(s) changed. Runtime loading and effective permissions remain UNVERIFIED.`
    );
  } else {
    console.log(
      "[persistent-agent-orchestra] structural check passed for exactly 10 project profiles. Runtime loading and effective permissions remain UNVERIFIED."
    );
  }
  return 0;
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  process.exitCode = await main();
}
