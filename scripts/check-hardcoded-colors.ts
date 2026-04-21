#!/usr/bin/env npx tsx
/**
 * Check for hardcoded colors in the codebase
 *
 * Scans .tsx and .ts files for hardcoded color values that should use CSS variables.
 * Outputs a report of violations and exits with error if threshold exceeded.
 *
 * Usage: npx tsx scripts/check-hardcoded-colors.ts
 */

import * as path from "path";
import { fileURLToPath } from "url";
import { runColorCheck } from "./check-hardcoded-colors-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, "../src");

function main() {
  console.log("🎨 Checking for hardcoded colors...\n");

  const { reports, totalViolations } = runColorCheck(SRC_DIR);

  if (reports.length === 0) {
    console.log("✅ No hardcoded colors found!\n");
    process.exit(0);
  }

  console.log(`Found ${totalViolations} hardcoded color(s) in ${reports.length} file(s):\n`);

  console.log("📊 Summary by file:");
  console.log("─".repeat(60));
  for (const report of reports.slice(0, 20)) {
    console.log(`  ${report.violations.length.toString().padStart(4)} │ ${report.file}`);
  }
  if (reports.length > 20) {
    console.log(`  ... and ${reports.length - 20} more files`);
  }
  console.log("─".repeat(60));
  console.log(`Total: ${totalViolations} violations\n`);

  console.log("\n📝 Details (top 5 files):");
  for (const report of reports.slice(0, 5)) {
    console.log(`\n${report.file}:`);
    for (const violation of report.violations.slice(0, 10)) {
      console.log(`  Line ${violation.line}: ${violation.match} (${violation.type})`);
    }
    if (report.violations.length > 10) {
      console.log(`  ... and ${report.violations.length - 10} more`);
    }
  }

  const THRESHOLD = 900;
  if (totalViolations > THRESHOLD) {
    console.log(`\n❌ Too many hardcoded colors (${totalViolations} > ${THRESHOLD})`);
    process.exit(1);
  }

  console.log(`\n⚠️  ${totalViolations} hardcoded colors found (threshold: ${THRESHOLD})`);
  console.log("Consider replacing with CSS variables for better theme support.\n");
  process.exit(0);
}

main();
