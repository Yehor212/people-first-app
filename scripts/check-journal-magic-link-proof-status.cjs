#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DEFAULT_PROOF_FILE = "docs/release/auth/JOURNAL_MAGIC_LINK_LIVE_PROOF.json";

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    requirePass: process.env.ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_STATUS_REQUIRED === "true",
    file: process.env.ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_FILE || DEFAULT_PROOF_FILE,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--require-pass") {
      args.requirePass = true;
    } else if (arg === "--file") {
      args.file = argv[++i] || "";
    } else {
      throw new Error("Unknown argument: " + arg);
    }
  }
  return args;
}

function safeProofFile(file) {
  const normalized = String(file || "").replace(/\\\\/g, "/").replace(/^\.\//, "");
  if (path.isAbsolute(normalized) || !normalized.startsWith("docs/release/")) {
    throw new Error("Unsupported proof file: " + file);
  }
  return { normalized, filePath: path.join(ROOT, normalized) };
}

function loadProof(file) {
  const { normalized, filePath } = safeProofFile(file);
  if (!fs.existsSync(filePath)) return { source: normalized, proof: null };
  return { source: normalized, proof: JSON.parse(fs.readFileSync(filePath, "utf8")) };
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (["PASS", "PARTIAL", "UNVERIFIED", "FAIL"].includes(status)) return status;
  return "UNVERIFIED";
}

function output({ status, source, requirePass, reason, checkedAt }) {
  console.log("[journal-magic-link-proof] " + status + " - " + reason);
  console.log("[journal-magic-link-proof] required=" + (requirePass ? "true" : "false"));
  console.log("[journal-magic-link-proof] source=" + source);
  if (checkedAt) console.log("[journal-magic-link-proof] checkedAt=" + checkedAt);
  process.exit(status === "PASS" || !requirePass ? 0 : 2);
}

function main() {
  const args = parseArgs();
  const { source, proof } = loadProof(args.file);
  const envStatus = normalizeStatus(process.env.ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_STATUS);
  const proofStatus = proof ? normalizeStatus(proof.status) : "UNVERIFIED";
  const status = process.env.ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_STATUS ? envStatus : proofStatus;
  const checkedAt = proof && typeof proof.checkedAt === "string" ? proof.checkedAt : "";
  const reason = status === "PASS"
    ? "Owner-recorded Magic Link live proof is PASS"
    : "Owner-recorded Magic Link live proof is missing or not PASS";
  output({ status, source, requirePass: args.requirePass, reason, checkedAt });
}

try {
  main();
} catch (error) {
  output({
    status: "UNVERIFIED",
    source: DEFAULT_PROOF_FILE,
    requirePass: true,
    reason: error.message || String(error),
  });
}
