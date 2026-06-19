#!/usr/bin/env node
/**
 * normalize-android-config.cjs
 *
 * Capacitor sync can regenerate android/app/src/main/res/xml/config.xml with
 * Cordova default wildcard access. Keep the generated file least-privilege by
 * listing only the network origins the app already allows through index.html CSP.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.resolve(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "res",
  "xml",
  "config.xml",
);
const ALLOWED_ACCESS_ORIGINS = [
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://api.zenflowapp.online",
  "wss://api.zenflowapp.online",
  "https://cdn.pixabay.com",
  "https://*.sentry.io",
  "https://*.ingest.sentry.io",
  "https://*.ingest.us.sentry.io",
  "https://*.ingest.de.sentry.io",
  "https://www.googleapis.com",
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
];

function renderAccessLines() {
  return ALLOWED_ACCESS_ORIGINS.map((origin) => `  <access origin="${origin}" />`).join("\n");
}

function removeDuplicateConfigFiles() {
  const configDir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(configDir)) return [];

  const removed = [];
  for (const name of fs.readdirSync(configDir)) {
    if (!/^config\s+.+\.xml$/i.test(name)) continue;
    const duplicatePath = path.join(configDir, name);
    fs.rmSync(duplicatePath, { force: true });
    removed.push(path.relative(process.cwd(), duplicatePath));
  }
  return removed;
}

function normalizeConfigXml(source) {
  if (!source.includes("<widget")) {
    throw new Error("Android config.xml is missing a <widget> root");
  }

  const withoutAccess = source.replace(/\s*<access\b[^>]*\/?\s*>/g, "");
  const updated = withoutAccess.replace(/(<widget\b[^>]*>)/, `$1\n${renderAccessLines()}`);

  if (/<access\s+origin=["']\*["']/.test(updated)) {
    throw new Error("Android config.xml still contains a wildcard access origin");
  }

  return updated;
}

const removedDuplicates = removeDuplicateConfigFiles();
for (const removed of removedDuplicates) {
  console.log(`[android-config] removed duplicate config file: ${removed}`);
}

if (!fs.existsSync(CONFIG_PATH)) {
  console.log("[android-config] config.xml not found — skipping");
  process.exit(0);
}

const before = fs.readFileSync(CONFIG_PATH, "utf8");
const after = normalizeConfigXml(before);

if (after !== before) {
  fs.writeFileSync(CONFIG_PATH, after);
  console.log(`[android-config] normalized ${path.relative(process.cwd(), CONFIG_PATH)} access origins`);
} else {
  console.log("[android-config] PASS - access origins already explicit");
}
