#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const failures = [];
let passCount = 0;

function abs(file) {
  return path.join(ROOT, file);
}

function rel(file) {
  return file.replaceAll("\\", "/");
}

function read(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) {
    failures.push(`${rel(file)} is missing`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function pass() {
  passCount += 1;
}

function requireIncludes(file, snippets) {
  const source = read(file);
  if (!source) return;

  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${rel(file)} is missing required desktop token: ${snippet}`);
    } else {
      pass();
    }
  }
}

function requireFile(file) {
  if (!fs.existsSync(abs(file))) {
    failures.push(`${rel(file)} is missing`);
    return;
  }
  pass();
}

function requireJson(file, validator) {
  const source = read(file);
  if (!source) return undefined;

  try {
    const json = JSON.parse(source);
    validator(json);
    return json;
  } catch (error) {
    failures.push(`${rel(file)} is not valid JSON: ${error.message}`);
    return undefined;
  }
}

function main() {
  requireIncludes("docs/ai/DESKTOP_EXE_RUNTIME_CONTRACT.md", [
    "Tauri 2",
    "WebView2",
    "Canonical visuals stay frozen",
    "No secrets in the executable",
    "Desktop Dock",
    "sync_events.seq",
    "Desktop is a separate build path",
    "After installation, the desktop executable must open the ZenFlow V2 program",
    "VITE_DESKTOP_RUNTIME=true",
    "shell-first",
    "Signed updater is required",
    "npm run desktop:sign",
    "npm run desktop:release:check",
    "npm run check:canonical-orbs",
    "npm run smoke:chrome-performance",
  ]);

  requireIncludes("docs/adr/0008-zenflow-desktop-exe-runtime.md", [
    "Tauri 2",
    "WebView2",
    "same Vite/React app",
    "canonical orb",
    "signed updater",
  ]);

  requireIncludes("docs/ai/TASK_COMPLETION_PROTOCOL.md", [
    "Desktop EXE/runtime",
    "npm run check:desktop-exe-contract",
    "npm run desktop:release:check",
  ]);

  requireIncludes("docs/DEFINITION_OF_DONE.md", [
    "Desktop EXE contract",
    "npm run check:desktop-exe-contract",
    "npm run desktop:release:check",
  ]);

  requireIncludes("docs/RELEASE_CHECKLIST.md", [
    "Desktop EXE",
    "npm run desktop:check",
    "npm run desktop:sign",
    "npm run desktop:release:check",
    "signed updater",
  ]);

  requireIncludes("package.json", [
    "\"desktop:dev\": \"node scripts/run-with-msvc.cjs \\\"tauri dev\\\"\"",
    "\"desktop:build\": \"node scripts/run-with-msvc.cjs \\\"tauri build\\\"\"",
    "\"desktop:check\": \"node scripts/check-desktop-exe-contract.cjs && node scripts/run-with-msvc.cjs \\\"node scripts/check-desktop-toolchain.cjs && tauri info\\\"\"",
    "\"desktop:sign\": \"node scripts/sign-desktop-windows.cjs\"",
    "\"desktop:release:check\": \"node scripts/check-desktop-release-readiness.cjs\"",
    "\"desktop:release:check:dev\": \"node scripts/check-desktop-release-readiness.cjs --allow-unsigned-dev\"",
    "\"check:desktop-exe-contract\": \"node scripts/check-desktop-exe-contract.cjs\"",
    "\"@tauri-apps/cli\"",
  ]);

  requireIncludes("src/pages/Index.tsx", [
    "DesktopDownloadPage",
    "IS_DESKTOP_RUNTIME",
    "shouldUseNavV2Shell",
    "PUBLIC_ROUTE_PATHS",
    "\"/desktop\"",
  ]);

  requireIncludes("src/lib/env.ts", [
    "IS_DESKTOP_RUNTIME",
    "VITE_DESKTOP_RUNTIME",
  ]);

  requireIncludes("src/components/AuthGate.tsx", [
    "IS_DESKTOP_RUNTIME",
    "shouldBypassDesktopInteractiveGates",
  ]);

  requireIncludes("src/hooks/useNavigationV2.ts", [
    "\"/index.html\"",
    "normalized.endsWith(\"/index.html\")",
  ]);

  requireIncludes("src/pages/DesktopDownloadPage.tsx", [
    "MiniValenceOrb",
    "APP_VERSION",
    "getDesktopReleaseState",
    "aria-disabled=\"true\"",
    "https://github.com/Yehor212/people-first-app/releases",
    "data-testid=\"desktop-download-page\"",
  ]);

  requireIncludes("src/lib/desktopRelease.ts", [
    "VITE_DESKTOP_SIGNED_RELEASE_URL",
    "VITE_DESKTOP_SIGNED_RELEASE_SHA256",
    "VITE_DESKTOP_SIGNED_RELEASE_AUTHENTICODE",
    "isTrustedDesktopReleaseUrl",
    "releases/download",
    "ZenFlow_",
    "x64-setup",
  ]);

  requireIncludes(".github/workflows/deploy.yml", [
    "VITE_DESKTOP_SIGNED_RELEASE_URL",
    "VITE_DESKTOP_SIGNED_RELEASE_SHA256",
    "VITE_DESKTOP_SIGNED_RELEASE_AUTHENTICODE",
  ]);

  requireIncludes(".github/workflows/desktop-release.yml", [
    "windows-latest",
    "npm run desktop:build",
    "npm run desktop:sign",
    "npm run desktop:release:check",
    "ZENFLOW_WINDOWS_CERT_PFX_BASE64",
    "ZENFLOW_WINDOWS_CERT_PASSWORD",
    "gh release create",
  ]);

  requireIncludes("scripts/run-with-msvc.cjs", [
    "VsDevCmd.bat",
    "vswhere.exe",
    "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
  ]);

  requireIncludes("scripts/check-desktop-toolchain.cjs", [
    "link.exe",
    "Visual Studio Build Tools",
    "Desktop development with C++",
  ]);

  requireIncludes("scripts/sign-desktop-windows.cjs", [
    "ZENFLOW_WINDOWS_CERT_PFX_BASE64",
    "ZENFLOW_WINDOWS_CERT_PASSWORD",
    "signtool.exe",
    "ZENFLOW_WINDOWS_TIMESTAMP_URL",
    "SHA256",
  ]);

  requireIncludes("scripts/check-desktop-release-readiness.cjs", [
    "Get-AuthenticodeSignature",
    "--allow-unsigned-dev",
    "VITE_DISABLE_PWA=true",
    "src-tauri/target/",
    "high-confidence secret",
  ]);

  requireJson("src-tauri/tauri.conf.json", (config) => {
    if (config.productName !== "ZenFlow") {
      failures.push("src-tauri/tauri.conf.json productName must be ZenFlow");
    } else {
      pass();
    }

    if (!config.identifier || !/zenflow/i.test(config.identifier)) {
      failures.push("src-tauri/tauri.conf.json identifier must be ZenFlow-specific");
    } else {
      pass();
    }

    const beforeBuild = config.build?.beforeBuildCommand || "";
    if (
      !beforeBuild.includes("VITE_APP_BASE=./") ||
      !beforeBuild.includes("VITE_DISABLE_PWA=true") ||
      !beforeBuild.includes("VITE_DESKTOP_RUNTIME=true")
    ) {
      failures.push("desktop beforeBuildCommand must use relative base, disable PWA, and force desktop runtime");
    } else {
      pass();
    }

    const beforeDev = config.build?.beforeDevCommand || "";
    if (!beforeDev.includes("VITE_DESKTOP_RUNTIME=true")) {
      failures.push("desktop beforeDevCommand must force desktop runtime for tauri dev");
    } else {
      pass();
    }

    const csp = config.app?.security?.csp || "";
    if (!String(csp).includes("object-src 'none'") || !String(csp).includes("script-src 'self'")) {
      failures.push("desktop CSP must block objects and arbitrary scripts");
    } else {
      pass();
    }
  });

  requireJson("src-tauri/capabilities/default.json", (capability) => {
    const permissions = capability.permissions || [];
    if (!permissions.includes("core:default")) {
      failures.push("desktop capability must include core:default");
    } else {
      pass();
    }

    const broadPermission = permissions.find((permission) =>
      /shell|fs|process|clipboard|http|updater/i.test(permission),
    );
    if (broadPermission) {
      failures.push(`desktop capability is too broad for first pass: ${broadPermission}`);
    } else {
      pass();
    }
  });

  requireIncludes("src-tauri/Cargo.toml", [
    "tauri = { version = \"2.11.2\"",
    "tauri-build = { version = \"2.6.2\"",
  ]);

  requireFile("src-tauri/icons/icon.ico");
  requireFile("src-tauri/icons/icon.icns");
  requireFile("src-tauri/icons/128x128@2x.png");

  if (failures.length > 0) {
    console.error("[desktop-exe-contract] FAIL");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`[desktop-exe-contract] PASS - ${passCount} checks`);
}

main();
