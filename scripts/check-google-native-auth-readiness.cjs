#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");
const defaultEvidencePath = "docs/release/google-native-auth-evidence.json";
const maxEvidenceAgeMs = 30 * 24 * 60 * 60 * 1000;
const sha1Pattern = /^(?:[0-9A-F]{2}:){19}[0-9A-F]{2}$/;
const oauthClientPattern = /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i;

function output(status, message) {
  console.log(`[google-native-auth] ${status} ${message}`);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function configuredPackageNames() {
  const gradle = readText("android/app/build.gradle");
  const capacitor = readText("capacitor.config.ts");
  const gradleMatch = gradle.match(/applicationId\s+["']([^"']+)["']/);
  const capacitorMatch = capacitor.match(/appId:\s*["']([^"']+)["']/);
  return {
    gradle: gradleMatch?.[1] || "",
    capacitor: capacitorMatch?.[1] || "",
  };
}

function clientProjectNumber(clientId) {
  const match = String(clientId || "").match(/^(\d+)-/);
  return match?.[1] || "";
}

function inspectEvidence(evidence, now = new Date()) {
  const failures = [];
  const packages = configuredPackageNames();
  const expectedPackage = packages.gradle;

  if (!expectedPackage || packages.capacitor !== expectedPackage) {
    failures.push("Android Gradle and Capacitor package IDs do not match");
  }
  if (evidence?.schemaVersion !== 1) {
    failures.push("Google native auth evidence schemaVersion is not 1");
  }
  if (evidence?.status !== "OBSERVED_UNVERIFIED") {
    failures.push("Tracked Google native auth evidence must remain OBSERVED_UNVERIFIED");
  }
  if (!expectedPackage || evidence?.packageName !== expectedPackage) {
    failures.push(`Google native auth evidence package does not match ${expectedPackage || "the Android app"}`);
  }
  if (!oauthClientPattern.test(String(evidence?.webClientId || ""))) {
    failures.push("Google Web OAuth client ID is missing or malformed");
  }

  const observedAt = Date.parse(String(evidence?.observedAt || ""));
  if (!Number.isFinite(observedAt) || now.getTime() - observedAt > maxEvidenceAgeMs || observedAt > now.getTime() + 5 * 60 * 1000) {
    failures.push("Google native auth console evidence is stale");
  }

  const clients = Array.isArray(evidence?.androidOAuthClients)
    ? evidence.androidOAuthClients
    : [];
  const upload = clients.find((client) => client?.signingRole === "upload");
  const play = clients.find((client) => client?.signingRole === "play-app-signing");

  for (const [label, client] of [["Upload", upload], ["Play App Signing", play]]) {
    if (!client || client.status !== "OBSERVED_UNVERIFIED") {
      failures.push(`${label} tracked OAuth client status must remain OBSERVED_UNVERIFIED`);
      continue;
    }
    if (!sha1Pattern.test(String(client.sha1 || ""))) {
      failures.push(`${label} Android OAuth client SHA-1 is missing or malformed`);
    }
    if (!oauthClientPattern.test(String(client.clientId || ""))) {
      failures.push(`${label} Android OAuth client ID is missing or malformed`);
    }
  }

  if (upload?.sha1 && play?.sha1 && upload.sha1 === play.sha1) {
    failures.push("Upload and Play App Signing OAuth clients use the same SHA-1");
  }
  if (upload?.clientId && play?.clientId && upload.clientId === play.clientId) {
    failures.push("Upload and Play App Signing registrations reuse the same OAuth client ID");
  }

  const projectNumbers = [
    clientProjectNumber(evidence?.webClientId),
    clientProjectNumber(upload?.clientId),
    clientProjectNumber(play?.clientId),
  ].filter(Boolean);
  if (new Set(projectNumbers).size > 1) {
    failures.push("Google Web, upload, and Play OAuth clients belong to different project numbers");
  }

  const configuredWebClientId = String(process.env.VITE_GOOGLE_WEB_CLIENT_ID || "").trim();
  const webClientRequired = process.env.ZENFLOW_GOOGLE_WEB_CLIENT_REQUIRED === "true";
  if (webClientRequired && !configuredWebClientId) {
    failures.push("VITE_GOOGLE_WEB_CLIENT_ID is required for the Android release build");
  } else if (configuredWebClientId && configuredWebClientId !== evidence?.webClientId) {
    failures.push("VITE_GOOGLE_WEB_CLIENT_ID does not match the tracked Google Web OAuth observation");
  }

  return { failures, packageName: expectedPackage };
}

function main() {
  const requestedPath = process.env.ZENFLOW_GOOGLE_NATIVE_AUTH_EVIDENCE_FILE || defaultEvidencePath;
  const evidencePath = path.isAbsolute(requestedPath)
    ? requestedPath
    : path.join(rootDir, requestedPath);

  if (!fs.existsSync(evidencePath)) {
    output(strict ? "FAIL" : "UNVERIFIED", "Google native auth console evidence file is missing");
    process.exitCode = strict ? 1 : 0;
    return;
  }

  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  } catch {
    output("FAIL", "Google native auth console evidence is not valid JSON");
    process.exitCode = 1;
    return;
  }

  const nowRaw = process.env.ZENFLOW_GOOGLE_NATIVE_AUTH_NOW;
  const now = nowRaw ? new Date(nowRaw) : new Date();
  const result = inspectEvidence(evidence, now);
  if (result.failures.length > 0) {
    for (const failure of result.failures) output("FAIL", failure);
    process.exitCode = 1;
    return;
  }

  output(
    "STRUCTURE_PASS",
    `Android OAuth evidence structure is valid for ${result.packageName}`,
  );
  output(
    "CONSOLE_UNVERIFIED",
    "Tracked repository data cannot independently verify the current Google Cloud or Play Console state",
  );
  output(
    "RUNTIME_UNVERIFIED",
    "Completed sign-in must be proven with the exact Play-installed Android artifact",
  );
}

if (require.main === module) main();

module.exports = { inspectEvidence };
