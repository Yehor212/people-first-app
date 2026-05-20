#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const command = process.argv.slice(2).join(" ");

if (!command) {
  console.error("[msvc-env] FAIL - missing command");
  console.error("[msvc-env] usage: node scripts/run-with-msvc.cjs \"tauri build\"");
  process.exit(2);
}

function runDirect() {
  const result = spawnSync(command, {
    shell: true,
    stdio: "inherit",
    windowsHide: true,
  });
  process.exit(result.status ?? 1);
}

function findVsDevCmd() {
  const candidates = [
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\Common7\\Tools\\VsDevCmd.bat",
    "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\Common7\\Tools\\VsDevCmd.bat",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const vswhere = "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe";
  if (!fs.existsSync(vswhere)) return "";

  try {
    const installationPath = execFileSync(
      vswhere,
      [
        "-latest",
        "-products",
        "*",
        "-requires",
        "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
        "-property",
        "installationPath",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      },
    ).trim();
    const devCmd = path.join(installationPath, "Common7", "Tools", "VsDevCmd.bat");
    return fs.existsSync(devCmd) ? devCmd : "";
  } catch {
    return "";
  }
}

if (process.platform !== "win32") {
  runDirect();
}

const devCmd = findVsDevCmd();
if (!devCmd) {
  console.error("[msvc-env] FAIL - Visual Studio Build Tools with C++ tools was not found");
  console.error("[msvc-env] Install Microsoft.VisualStudio.2022.BuildTools with the VC tools workload.");
  process.exit(1);
}

const batchFile = path.join(os.tmpdir(), `zenflow-msvc-${process.pid}.cmd`);
fs.writeFileSync(
  batchFile,
  [
    "@echo off",
    `call "${devCmd}" -arch=x64 -host_arch=x64`,
    "if errorlevel 1 exit /b %errorlevel%",
    command,
  ].join("\r\n"),
);

const result = spawnSync("cmd.exe", ["/d", "/c", batchFile], {
  stdio: "inherit",
  windowsHide: true,
});

try {
  fs.unlinkSync(batchFile);
} catch {
  // The temporary command file is best-effort cleanup only.
}

process.exit(result.status ?? 1);
