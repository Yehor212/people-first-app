#!/usr/bin/env node
import path from "node:path";

import {
  parseStrictJson,
  validateEvalCatalog,
  validateEvalReport,
  validateNoSemanticBaseline,
} from "./persistent-agent-orchestra/eval-core.mjs";
import { readRegularFileInsideRoot } from "./persistent-agent-orchestra/secure-read.mjs";

const rootDir = process.cwd();
const args = process.argv.slice(2);

try {
  if (args.length === 1 && args[0] === "--catalog") {
    const [registry, catalog, baseline] = await Promise.all([
      readJsonWithinRepo("config/persistent-agent-orchestra.json"),
      readJsonWithinRepo("config/persistent-agent-orchestra.evals.json"),
      readJsonWithinRepo("config/persistent-agent-orchestra.eval-baseline.json"),
    ]);
    const catalogResult = validateEvalCatalog(catalog, registry);
    const baselineResult = validateNoSemanticBaseline(baseline);
    const errors = [...catalogResult.errors, ...baselineResult.errors];
    if (errors.length > 0) {
      printErrors(errors);
      process.exit(1);
    }
    console.log(`[agent-orchestra-evals] LOCAL_CATALOG_STRUCTURE_VALID (${catalog.scenarios.length} scenarios)`);
    console.log("[agent-orchestra-evals] semantic/runtime/human/user statuses: UNVERIFIED");
    process.exit(0);
  }

  if (args.length !== 1) {
    console.error("Usage: node scripts/validate-persistent-agent-orchestra-eval-report.mjs --catalog|<report.json>");
    process.exit(2);
  }
  const reportRelativePath = resolveWithinRepo(args[0]);
  const report = parseStrictJson(
    await readRegularFileInsideRoot({ rootDir, relativePath: reportRelativePath }),
  );
  const result = await validateEvalReport({ rootDir, report, now: new Date() });
  if (result.errors.length > 0) {
    printErrors(result.errors);
    process.exit(1);
  }
  console.log("[agent-orchestra-evals] LOCAL_EVAL_STRUCTURE_VALID");
  console.log("[agent-orchestra-evals] semantic/runtime/human/user statuses remain UNVERIFIED");
} catch (error) {
  console.error(`[agent-orchestra-evals] ${error.message}`);
  process.exit(2);
}

async function readJsonWithinRepo(relativePath) {
  const safeRelativePath = resolveWithinRepo(relativePath);
  return parseStrictJson(
    await readRegularFileInsideRoot({ rootDir, relativePath: safeRelativePath }),
  );
}

function resolveWithinRepo(relativeOrAbsolutePath) {
  const resolved = path.resolve(rootDir, relativeOrAbsolutePath);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Report path must stay inside the repository.");
  }
  if (relative === "") throw new Error("Report path must name a file inside the repository.");
  return relative;
}

function printErrors(errors) {
  console.error("[agent-orchestra-evals] validation failed");
  for (const error of errors) console.error(`- ${error}`);
}
