#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");

const failures = [];
const evidence = [];

function run(command, args, label) {
  try {
    const output = execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }).trim();
    evidence.push(`${label}: ${output.split(/\r?\n/)[0] || "present"}`);
    return output;
  } catch (error) {
    const stderr = String(error.stderr || "").trim();
    const stdout = String(error.stdout || "").trim();
    failures.push(`${label}: ${stderr || stdout || error.message}`);
    return "";
  }
}

const isWindows = process.platform === "win32";
function runShell(command, label) {
  if (isWindows) return run("cmd.exe", ["/d", "/s", "/c", command], label);
  return run("sh", ["-lc", command], label);
}

run("node", ["--version"], "Node");
runShell("npm --version", "npm");
run("rustc", ["--version"], "Rust");
run("cargo", ["--version"], "Cargo");
runShell(isWindows ? "where link.exe" : "command -v link.exe", "MSVC linker");

if (failures.length > 0) {
  console.error("[desktop-toolchain] FAIL");
  for (const item of evidence) console.error(`- ${item}`);
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("- Install Visual Studio Build Tools with the Desktop development with C++ workload before building the Windows EXE.");
  process.exit(1);
}

console.log(`[desktop-toolchain] PASS - ${evidence.length} checks`);
for (const item of evidence) console.log(`- ${item}`);
