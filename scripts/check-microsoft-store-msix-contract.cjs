#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PRODUCT_ID = "9MZK46FHZV8K";
const failures = [];
const warnings = [];
let passCount = 0;

function abs(file) {
  return path.join(ROOT, file);
}

function read(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) {
    failures.push(`${file} is missing`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function readJson(file) {
  const source = read(file);
  if (!source) return {};
  try {
    return JSON.parse(source);
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function pass() {
  passCount += 1;
}

function requireIncludes(file, snippets) {
  const source = read(file);
  if (!source) return;

  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${file} is missing required Store/MSIX token: ${snippet}`);
    } else {
      pass();
    }
  }
}

function requirePlaceholderOnly(template) {
  const placeholderFields = [
    "packageIdentityName",
    "publisher",
    "publisherDisplayName",
  ];

  for (const field of placeholderFields) {
    const value = String(template[field] || "");
    if (!value.includes("<copy from Partner Center Product Identity>")) {
      failures.push(`docs/release/microsoft-store/identity.template.json must keep ${field} as a placeholder`);
    } else {
      pass();
    }
  }
}

function requireNoHighConfidenceSecrets(files) {
  const patterns = [
    /\bZENFLOW_WINDOWS_CERT_PFX_BASE64\s*=\s*["'][A-Za-z0-9+/=]{40,}["']/g,
    /\bZENFLOW_WINDOWS_CERT_PASSWORD\s*=\s*["'][^"']{8,}["']/g,
    /\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']{20,}["']/g,
    /\bSENTRY_AUTH_TOKEN\s*=\s*["'][^"']{20,}["']/g,
    /\bghp_[A-Za-z0-9_]{30,}\b/g,
    /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  ];

  for (const file of files) {
    const source = read(file);
    if (!source) continue;
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(source)) {
        failures.push(`${file} contains a high-confidence secret pattern`);
      }
    }
  }
  pass();
}

function validateOptionalIdentityEnv() {
  const identity = {
    productId: process.env.ZENFLOW_STORE_PRODUCT_ID || "",
    name: process.env.ZENFLOW_STORE_PACKAGE_IDENTITY_NAME || "",
    publisher: process.env.ZENFLOW_STORE_PUBLISHER || "",
    publisherDisplayName: process.env.ZENFLOW_STORE_PUBLISHER_DISPLAY_NAME || "",
  };

  const anyIdentity = Object.values(identity).some(Boolean);
  if (!anyIdentity) {
    warnings.push("Partner Center Product Identity env values are absent; Store package identity remains UNVERIFIED");
    return;
  }

  if (identity.productId !== PRODUCT_ID) {
    failures.push(`ZENFLOW_STORE_PRODUCT_ID must be ${PRODUCT_ID}`);
  } else {
    pass();
  }

  if (!/^[A-Za-z0-9_.-]{3,80}$/.test(identity.name)) {
    failures.push("ZENFLOW_STORE_PACKAGE_IDENTITY_NAME has an unexpected format");
  } else {
    pass();
  }

  if (!/^CN=.+/.test(identity.publisher)) {
    failures.push("ZENFLOW_STORE_PUBLISHER should look like a Partner Center publisher subject, for example CN=...");
  } else {
    pass();
  }

  if (identity.publisherDisplayName.length < 2 || identity.publisherDisplayName.length > 80) {
    failures.push("ZENFLOW_STORE_PUBLISHER_DISPLAY_NAME must be 2-80 characters");
  } else {
    pass();
  }
}

function main() {
  const packageJson = readJson("package.json");
  const tauriConfig = readJson("src-tauri/tauri.conf.json");
  const identityTemplate = readJson("docs/release/microsoft-store/identity.template.json");

  requireIncludes("docs/ai/MICROSOFT_STORE_MSIX_CONTRACT.md", [
    PRODUCT_ID,
    "MSIX or PWA app",
    "Product Identity",
    "No visual regression",
    "No sync fork",
    "No secrets in the app or repository",
    "No purchase or final submission automation",
    "Path A: Convert The Signed Installer",
    "Path B: Manual MSIX Packaging",
    "Windows App Certification Kit",
    "npm run desktop:store:check",
  ]);

  requireIncludes("docs/release/microsoft-store/README.md", [
    PRODUCT_ID,
    "Product Identity",
    "npm run desktop:store:check",
    "Do not place certificates",
    "accepted package in the Partner Center draft",
  ]);

  requireIncludes("docs/ai/DESKTOP_EXE_RUNTIME_CONTRACT.md", [
    "docs/ai/MICROSOFT_STORE_MSIX_CONTRACT.md",
    "npm run desktop:store:check",
    "Partner Center",
  ]);

  requireIncludes("docs/ai/TASK_COMPLETION_PROTOCOL.md", [
    "Microsoft Store/MSIX",
    "npm run desktop:store:check",
  ]);

  requireIncludes("docs/DEFINITION_OF_DONE.md", [
    "Microsoft Store/MSIX contract",
    "npm run desktop:store:check",
  ]);

  requireIncludes("docs/RELEASE_CHECKLIST.md", [
    "Microsoft Store / MSIX",
    "npm run desktop:store:check",
    "9MZK46FHZV8K",
  ]);

  const storeScript = packageJson.scripts?.["desktop:store:check"];
  if (storeScript !== "node scripts/check-microsoft-store-msix-contract.cjs") {
    failures.push("package.json must expose desktop:store:check");
  } else {
    pass();
  }

  if (tauriConfig.productName !== "ZenFlow") {
    failures.push("src-tauri/tauri.conf.json productName must remain ZenFlow");
  } else {
    pass();
  }

  const targets = tauriConfig.bundle?.targets || [];
  if (!Array.isArray(targets) || !targets.includes("nsis")) {
    failures.push("src-tauri/tauri.conf.json must keep the signed NSIS installer path for Store conversion");
  } else {
    pass();
  }

  if (identityTemplate.productId !== PRODUCT_ID) {
    failures.push(`identity template must record product id ${PRODUCT_ID}`);
  } else {
    pass();
  }
  requirePlaceholderOnly(identityTemplate);
  validateOptionalIdentityEnv();

  requireNoHighConfidenceSecrets([
    "docs/ai/MICROSOFT_STORE_MSIX_CONTRACT.md",
    "docs/release/microsoft-store/README.md",
    "docs/release/microsoft-store/identity.template.json",
    "scripts/check-microsoft-store-msix-contract.cjs",
  ]);

  for (const warning of warnings) {
    console.warn(`[desktop-store-msix] WARN - ${warning}`);
  }

  if (failures.length > 0) {
    console.error("[desktop-store-msix] FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`[desktop-store-msix] PASS - ${passCount} guardrails checked`);
}

main();
