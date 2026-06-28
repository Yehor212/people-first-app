#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const OUTPUT = path.join(ROOT, "public", "app-ads.txt");
const GOOGLE_SELLER_ID = "f08c47fec0942fa0";
const SAMPLE_PUBLISHER_ID = "pub-3940256099942544";

function fail(message) {
  console.error(`[app-ads] FAIL - ${message}`);
  process.exit(1);
}

function publisherIdFromEnv() {
  return String(process.env.ZENFLOW_ADMOB_PUBLISHER_ID || process.env.ADMOB_PUBLISHER_ID || "").trim();
}

function validatePublisherId(publisherId) {
  if (!/^pub-\d{16}$/.test(publisherId)) {
    fail("Set ZENFLOW_ADMOB_PUBLISHER_ID to the real AdMob publisher id in pub-0000000000000000 format");
  }
  if (publisherId === SAMPLE_PUBLISHER_ID) {
    fail("Refusing to write Google's sample AdMob publisher id to public/app-ads.txt");
  }
}

function expectedLine(publisherId) {
  return `google.com, ${publisherId}, DIRECT, ${GOOGLE_SELLER_ID}`;
}

function readExisting() {
  if (!fs.existsSync(OUTPUT)) return "";
  return fs.readFileSync(OUTPUT, "utf8").trim();
}

function checkExisting(publisherId) {
  const existing = readExisting();
  if (!existing) {
    fail("public/app-ads.txt is missing; run npm run google-play:app-ads with the real publisher id");
  }
  if (existing !== expectedLine(publisherId)) {
    fail("public/app-ads.txt does not match the expected AdMob authorized seller line for the configured publisher id");
  }
  console.log("[app-ads] PASS - public/app-ads.txt matches the configured real AdMob publisher id");
}

function writeFile(publisherId) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${expectedLine(publisherId)}\n`);
  console.log("[app-ads] PASS - wrote public/app-ads.txt from ZENFLOW_ADMOB_PUBLISHER_ID");
}

const publisherId = publisherIdFromEnv();
validatePublisherId(publisherId);

if (process.argv.includes("--check")) {
  checkExisting(publisherId);
} else {
  writeFile(publisherId);
}
