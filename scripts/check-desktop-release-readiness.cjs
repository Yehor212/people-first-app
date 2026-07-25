#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const allowUnsignedDev = process.argv.includes("--allow-unsigned-dev");
const failures = [];
const warnings = [];
const evidence = [];

function abs(file) {
  return path.join(ROOT, file);
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

function readJson(file) {
  const target = abs(file);
  try {
    return JSON.parse(fs.readFileSync(target, "utf8"));
  } catch (error) {
    failures.push(`${file} is not readable JSON: ${error.message}`);
    return {};
  }
}

function sha256(file) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex").toUpperCase();
}

function requireFile(file) {
  if (!fs.existsSync(file)) {
    failures.push(`${rel(file)} is missing`);
    return false;
  }
  return true;
}

function getAuthenticodeStatus(file) {
  if (process.platform !== "win32") {
    warnings.push(`${rel(file)} Authenticode status is UNVERIFIED outside Windows`);
    return { status: "UNVERIFIED", signer: "" };
  }

  const ps = [
    "$ErrorActionPreference='Stop';",
    `$sig = Get-AuthenticodeSignature -LiteralPath ${JSON.stringify(file)};`,
    "[pscustomobject]@{",
    "Status = [string]$sig.Status;",
    "StatusMessage = [string]$sig.StatusMessage;",
    "Signer = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { '' };",
    "}",
    "| ConvertTo-Json -Compress",
  ].join(" ");

  try {
    // pwsh (PowerShell 7+): Microsoft.PowerShell.Security is built into the core
    // and always available; legacy powershell.exe 5.1 autoload is broken on
    // windows-2025-vs2026 runner images (module could not be loaded).
    const output = execFileSync("pwsh.exe", ["-NoProfile", "-Command", ps], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }).trim();
    const parsed = JSON.parse(output);
    return {
      status: parsed.Status || "UNKNOWN",
      signer: parsed.Signer || "",
      message: parsed.StatusMessage || "",
    };
  } catch (error) {
    const stderr = String(error.stderr || "").trim();
    failures.push(`${rel(file)} Authenticode check failed: ${stderr || error.message}`);
    return { status: "ERROR", signer: "" };
  }
}

function requireNoHighConfidenceSecrets() {
  const scannedFiles = [
    "package.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
    "src-tauri/build.rs",
    "src-tauri/src/main.rs",
    "src-tauri/capabilities/default.json",
    "scripts/sign-desktop-windows.cjs",
    "scripts/check-desktop-release-readiness.cjs",
    "docs/ai/DESKTOP_EXE_RUNTIME_CONTRACT.md",
    "docs/ai/TASK_COMPLETION_PROTOCOL.md",
  ];

  const patterns = [
    /\bghp_[A-Za-z0-9_]{30,}\b/g,
    /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
    /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/g,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    /\bTAURI_PRIVATE_KEY\s*=\s*["'][^"']{20,}["']/g,
    /\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']{20,}["']/g,
    /\bSENTRY_AUTH_TOKEN\s*=\s*["'][^"']{20,}["']/g,
    /\bZENFLOW_WINDOWS_CERT_PFX_BASE64\s*=\s*["'][^"']{40,}["']/g,
  ];

  for (const file of scannedFiles) {
    const target = abs(file);
    if (!fs.existsSync(target)) continue;
    const source = fs.readFileSync(target, "utf8");
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(source)) {
        failures.push(`${file} contains a high-confidence secret pattern`);
      }
    }
  }

  evidence.push("secret scan: no high-confidence signing/API secrets in desktop release sources");
}

function requireDesktopBuildConfig() {
  const config = readJson("src-tauri/tauri.conf.json");
  const beforeBuild = config.build?.beforeBuildCommand || "";
  if (!beforeBuild.includes("VITE_APP_BASE=./") || !beforeBuild.includes("VITE_DISABLE_PWA=true")) {
    failures.push("src-tauri/tauri.conf.json must build desktop with relative base and PWA disabled");
  } else {
    evidence.push("desktop build config: relative base and PWA disabled");
  }

  const permissions = readJson("src-tauri/capabilities/default.json").permissions || [];
  const broad = permissions.find((permission) => /shell|fs|process|clipboard|http|updater/i.test(permission));
  if (broad) {
    failures.push(`desktop capability is too broad for release: ${broad}`);
  } else {
    evidence.push(`desktop permissions: ${permissions.join(", ") || "none"}`);
  }

  const gitignore = fs.existsSync(abs(".gitignore")) ? fs.readFileSync(abs(".gitignore"), "utf8") : "";
  if (!gitignore.includes("src-tauri/target/")) {
    failures.push(".gitignore must ignore src-tauri/target/");
  } else {
    evidence.push("artifact hygiene: src-tauri/target/ is ignored");
  }
}

function checkArtifact(file) {
  if (!requireFile(file)) return;
  const stat = fs.statSync(file);
  const signature = getAuthenticodeStatus(file);
  evidence.push(`${rel(file)}: ${stat.size} bytes, sha256=${sha256(file)}`);
  evidence.push(`${rel(file)}: Authenticode=${signature.status}${signature.signer ? `, signer=${signature.signer}` : ""}`);

  if (signature.status !== "Valid") {
    if (allowUnsignedDev) {
      warnings.push(`${rel(file)} is ${signature.status}; accepted only because --allow-unsigned-dev was used`);
      return;
    }
    failures.push(`${rel(file)} is not signed with a valid Authenticode signature (${signature.status})`);
  }
}

function main() {
  const packageJson = readJson("package.json");
  const version = packageJson.version || "0.0.0";
  const exe = abs("src-tauri/target/release/zenflow-desktop.exe");
  const installer = abs(`src-tauri/target/release/bundle/nsis/ZenFlow_${version}_x64-setup.exe`);

  requireDesktopBuildConfig();
  requireNoHighConfidenceSecrets();
  checkArtifact(exe);
  checkArtifact(installer);

  for (const item of evidence) console.log(`[desktop-release] ${item}`);
  for (const warning of warnings) console.warn(`[desktop-release] WARN - ${warning}`);

  if (failures.length > 0) {
    console.error("[desktop-release] FAIL");
    for (const failure of failures) console.error(`- ${failure}`);
    console.error("- Public desktop release requires Valid Authenticode signatures. Use npm run desktop:sign before npm run desktop:release:check.");
    process.exit(1);
  }

  const mode = allowUnsignedDev ? "DEV-ONLY unsigned waiver" : "PUBLIC signed release";
  console.log(`[desktop-release] PASS - ${mode}`);
}

main();
