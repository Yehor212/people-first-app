#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const TIMESTAMP_URL = process.env.ZENFLOW_WINDOWS_TIMESTAMP_URL || "http://timestamp.digicert.com";

function abs(file) {
  return path.join(ROOT, file);
}

function run(command, args, label) {
  try {
    const output = execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }).trim();
    console.log(`[desktop-sign] ${label}: ${output.split(/\r?\n/)[0] || "ok"}`);
    return output;
  } catch (error) {
    const stderr = String(error.stderr || "").trim();
    const stdout = String(error.stdout || "").trim();
    console.error(`[desktop-sign] FAIL - ${label}`);
    console.error(stderr || stdout || error.message);
    process.exit(1);
  }
}

function tryRun(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    }).trim();
  } catch {
    return "";
  }
}

function findSignTool() {
  if (process.platform !== "win32") {
    console.error("[desktop-sign] FAIL - Windows SignTool is only available on Windows release runners");
    process.exit(1);
  }

  const fromPath = tryRun("where.exe", ["signtool.exe"]).split(/\r?\n/)[0].trim();
  if (fromPath) {
    console.log(`[desktop-sign] signtool: ${fromPath}`);
    return fromPath;
  }

  const kitRoot = "C:\\Program Files (x86)\\Windows Kits\\10\\bin";
  if (fs.existsSync(kitRoot)) {
    const versions = fs
      .readdirSync(kitRoot)
      .filter((entry) => fs.existsSync(path.join(kitRoot, entry, "x64", "signtool.exe")))
      .sort()
      .reverse();
    if (versions.length > 0) {
      const candidate = path.join(kitRoot, versions[0], "x64", "signtool.exe");
      console.log(`[desktop-sign] signtool: ${candidate}`);
      return candidate;
    }
  }

  console.error("[desktop-sign] FAIL - signtool.exe was not found. Install the Windows SDK on the release runner.");
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[desktop-sign] FAIL - missing ${name}`);
    process.exit(1);
  }
  return value;
}

function getArtifacts() {
  const packageJson = JSON.parse(fs.readFileSync(abs("package.json"), "utf8"));
  const version = packageJson.version;
  const artifacts = [
    abs("src-tauri/target/release/zenflow-desktop.exe"),
    abs(`src-tauri/target/release/bundle/nsis/ZenFlow_${version}_x64-setup.exe`),
  ];

  for (const artifact of artifacts) {
    if (!fs.existsSync(artifact)) {
      console.error(`[desktop-sign] FAIL - missing artifact ${artifact}`);
      console.error("[desktop-sign] Run npm run desktop:build before signing.");
      process.exit(1);
    }
  }

  return artifacts;
}

function main() {
  const pfxBase64 = requireEnv("ZENFLOW_WINDOWS_CERT_PFX_BASE64");
  const pfxPassword = requireEnv("ZENFLOW_WINDOWS_CERT_PASSWORD");
  const signTool = findSignTool();
  const artifacts = getArtifacts();
  const certFile = path.join(os.tmpdir(), `zenflow-windows-cert-${process.pid}.pfx`);

  try {
    fs.writeFileSync(certFile, Buffer.from(pfxBase64, "base64"));
    for (const artifact of artifacts) {
      run(
        signTool,
        [
          "sign",
          "/fd",
          "SHA256",
          "/td",
          "SHA256",
          "/tr",
          TIMESTAMP_URL,
          "/f",
          certFile,
          "/p",
          pfxPassword,
          artifact,
        ],
        `signed ${path.basename(artifact)}`,
      );
      run(signTool, ["verify", "/pa", "/v", artifact], `verified ${path.basename(artifact)}`);
    }
  } finally {
    try {
      fs.rmSync(certFile, { force: true });
    } catch {
      // Best-effort cleanup only; the file lives in the OS temp directory.
    }
  }

  console.log("[desktop-sign] PASS - Windows desktop artifacts signed and verified");
}

main();
