#!/usr/bin/env node
/**
 * normalize-ios-config.cjs
 *
 * Capacitor sync can regenerate ios/App/App/config.xml with Cordova default
 * wildcard access. Keep the generated file least-privilege by listing only
 * the network origins the app already allows through index.html CSP.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.resolve(__dirname, "..", "ios", "App", "App", "config.xml");
const ALLOWED_ACCESS_ORIGINS = [
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://api.zenflowapp.online",
  "wss://api.zenflowapp.online",
  "https://cdn.pixabay.com",
  "https://*.sentry.io",
  "https://*.ingest.sentry.io",
  "https://www.googleapis.com",
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
];

function renderAccessLines() {
  return ALLOWED_ACCESS_ORIGINS.map((origin) => `  <access origin="${origin}" />`).join("\n");
}

function normalizeConfigXml(source) {
  if (!source.includes("<widget")) {
    throw new Error("iOS config.xml is missing a <widget> root");
  }

  const withoutAccess = source.replace(/\s*<access\b[^>]*\/?\s*>/g, "");
  const updated = withoutAccess.replace(/(<widget\b[^>]*>)/, `$1\n${renderAccessLines()}`);

  if (/<access\s+origin=["']\*["']/.test(updated)) {
    throw new Error("iOS config.xml still contains a wildcard access origin");
  }

  return updated;
}

if (!fs.existsSync(CONFIG_PATH)) {
  console.log("[ios-config] config.xml not found — skipping");
  process.exit(0);
}

const before = fs.readFileSync(CONFIG_PATH, "utf8");
const after = normalizeConfigXml(before);

if (after !== before) {
  fs.writeFileSync(CONFIG_PATH, after);
  console.log(`[ios-config] normalized ${path.relative(process.cwd(), CONFIG_PATH)} access origins`);
} else {
  console.log("[ios-config] PASS - access origins already explicit");
}
