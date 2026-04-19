#!/usr/bin/env node
/**
 * check-oss-licenses.cjs — OSS license gate (tech-debt audit §10.10).
 *
 * Runs `npx license-checker --production --failOn 'GPL;AGPL;SSPL'` to prevent
 * copyleft creep into the production dependency tree. Exits 1 on disallowed
 * licenses so CI blocks the PR.
 *
 * Why a wrapper instead of inline npx: lets us pin the exact failOn list in one
 * place, adds allowlist for vetted exceptions, and keeps the command readable
 * in package.json.
 *
 * Usage:
 *   node scripts/check-oss-licenses.cjs         # exit 1 on GPL/AGPL/SSPL prod dep
 *   node scripts/check-oss-licenses.cjs --json  # machine-readable summary
 */

"use strict";

const { execSync } = require("node:child_process");

const FAIL_ON = ["GPL", "AGPL", "SSPL", "LGPL", "CPAL", "OSL", "EPL"]
  .map((s) => s.trim())
  .join(";");

// Known exceptions: none today. Add package@version with a rationale comment.
const EXCLUDE_PACKAGES = [];

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");

  const cmdParts = ["npx", "--yes", "license-checker", "--production", `--failOn='${FAIL_ON}'`];
  if (EXCLUDE_PACKAGES.length > 0) {
    cmdParts.push(`--excludePackages='${EXCLUDE_PACKAGES.join(";")}'`);
  }
  if (json) cmdParts.push("--json");
  else cmdParts.push("--summary");

  const cmd = cmdParts.join(" ");
  console.log(`[licenses] Running: ${cmd}`);

  try {
    const output = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
    if (json) process.stdout.write(output);
    else console.log(output);
    console.log("[licenses] OK — no disallowed licenses in production deps.");
  } catch (err) {
    console.error("[licenses] FAIL — disallowed license detected or tool error.");
    console.error("  Exit:", err.status);
    console.error("");
    console.error("  Fix: review the offending package. Options:");
    console.error("    1. Replace with an MIT/Apache/ISC alternative");
    console.error("    2. Confirm it's not actually linked at runtime (devDep only)");
    console.error("    3. Add to EXCLUDE_PACKAGES in this script with a rationale");
    process.exit(1);
  }
}

main();
