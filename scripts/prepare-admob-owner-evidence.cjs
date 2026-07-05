#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { evaluateOwnerEvidence } = require("./check-admob-owner-evidence.cjs");

const ROOT = path.join(__dirname, "..");
const TEMPLATE_FILE = path.join(ROOT, "docs", "release", "google-play", "ADMOB_OWNER_EVIDENCE_TEMPLATE.json");
const DEFAULT_PRIVATE_FILE = path.join(ROOT, "output", "private", "admob-owner-evidence.json");

function parseArgs(argv) {
  const args = { file: DEFAULT_PRIVATE_FILE, force: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") args.file = path.resolve(ROOT, argv[++i]);
    else if (arg === "--force") args.force = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error("Unknown argument: " + arg);
  }
  return args;
}

function usage() {
  return [
    "Usage: node scripts/prepare-admob-owner-evidence.cjs [--file output/private/admob-owner-evidence.json] [--force]",
    "Creates an ignored private owner-evidence working file from ADMOB_OWNER_EVIDENCE_TEMPLATE.json.",
    "It never promotes PASS rows and refuses to overwrite existing owner evidence unless --force is provided.",
  ].join("\n");
}

function readTemplate() {
  if (!fs.existsSync(TEMPLATE_FILE)) {
    throw new Error("ADMOB_OWNER_EVIDENCE_TEMPLATE.json is missing");
  }
  const template = JSON.parse(fs.readFileSync(TEMPLATE_FILE, "utf8"));
  const report = evaluateOwnerEvidence(template, { requirePass: false });
  if (!report.ok) {
    const issues = report.issues.map((issue) => issue.code).join(", ");
    throw new Error("ADMOB_OWNER_EVIDENCE_TEMPLATE.json is not valid owner evidence: " + issues);
  }
  return template;
}

function relativeOrAbsolute(file) {
  const relative = path.relative(ROOT, file);
  return relative.startsWith("..") || path.isAbsolute(relative) ? file : relative;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.log("[admob-owner-evidence-prepare] UNVERIFIED - " + error.message);
    console.log(usage());
    process.exit(2);
  }

  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  try {
    if (fs.existsSync(args.file) && !args.force) {
      console.log(
        "[admob-owner-evidence-prepare] UNVERIFIED - " +
          relativeOrAbsolute(args.file) +
          " already exists; review it or rerun with --force to replace the private working file",
      );
      process.exit(2);
    }

    const template = readTemplate();
    fs.mkdirSync(path.dirname(args.file), { recursive: true });
    fs.writeFileSync(args.file, JSON.stringify(template, null, 2) + "\n");

    const prepared = JSON.parse(fs.readFileSync(args.file, "utf8"));
    const report = evaluateOwnerEvidence(prepared, { requirePass: false });
    if (!report.ok) {
      const issues = report.issues.map((issue) => issue.code).join(", ");
      console.log("[admob-owner-evidence-prepare] UNVERIFIED - prepared private evidence did not validate: " + issues);
      process.exit(2);
    }

    console.log("[admob-owner-evidence-prepare] WROTE - prepared private owner evidence working file " + args.file);
    console.log("[admob-owner-evidence-prepare] readiness=UNVERIFIED");
    console.log("[admob-owner-evidence-prepare] next=fill only public-safe owner summaries and boolean facts");
    console.log(
      "[admob-owner-evidence-prepare] next=node scripts/check-admob-owner-evidence.cjs --file " +
        relativeOrAbsolute(args.file),
    );
  } catch (error) {
    console.log("[admob-owner-evidence-prepare] UNVERIFIED - " + error.message);
    process.exit(2);
  }
}

main();
