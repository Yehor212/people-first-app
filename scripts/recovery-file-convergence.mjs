#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const {
  classifyMechanicalPolicy,
  collectPacketRecords,
  collectUniqueHeadShas,
  sanitizeLedgerRecord,
  summarizeLedger,
} = require("./recovery-file-convergence-core.cjs");

const options = parseOptions(process.argv.slice(2));
const manifestPath = requireOption(options, "manifest");
const inventoryPath = requireOption(options, "inventory");
const repo = path.resolve(requireOption(options, "repo"));
const baseSha = requireObjectId(requireOption(options, "base-sha"), "base-sha");
const mainSha = requireObjectId(requireOption(options, "main-sha"), "main-sha");
const outputPath = path.resolve(requireOption(options, "output"));

const manifest = readJson(manifestPath);
const inventory = readJson(inventoryPath);
const mainHashes = collectMainHashes({ manifest, mainSha, repo });
const packetRecords = collectPacketRecords(manifest, mainHashes).map(sanitizeLedgerRecord);
const historicalRecords = collectHistoricalRecords({ baseSha, inventory, repo }).map(
  sanitizeLedgerRecord,
);
const allRecords = [...packetRecords, ...historicalRecords];
const ledgerSummary = summarizeLedger(allRecords);

const ledger = {
  schema: "zenflow-recovery-file-convergence-v1",
  baseSha,
  mainSha,
  summary: {
    dirtyVariants: packetRecords.filter((record) => record.sourceKind === "dirty-file").length,
    deletionIntents: packetRecords.filter((record) => record.sourceKind === "deletion-intent")
      .length,
    historicalCommits: historicalRecords.length,
    records: ledgerSummary.total,
    byDisposition: ledgerSummary.byDisposition,
    open: ledgerSummary.open,
  },
  packetRecords,
  historicalRecords,
};

const serialized = `${JSON.stringify(ledger, null, 2)}\n`;
if (/\/(?:Users|home|private)\//.test(serialized) || /[A-Za-z]:\\/.test(serialized)) {
  throw new Error("refusing to write a ledger containing absolute machine paths");
}
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
process.stdout.write(`${JSON.stringify(ledger.summary)}\n`);

function collectMainHashes({ manifest, mainSha: currentMain, repo: repository }) {
  const hashes = {};
  const paths = new Set();
  for (const report of Array.isArray(manifest?.packetReports) ? manifest.packetReports : []) {
    for (const entry of Array.isArray(report?.entries) ? report.entries : []) {
      if (
        entry?.disposition === "exported-non-main-variant" ||
        entry?.disposition === "deleted-in-working-variant"
      ) {
        paths.add(String(entry.path || ""));
      }
    }
  }
  for (const relativePath of [...paths].sort((left, right) => left.localeCompare(right))) {
    if (!relativePath) continue;
    const objectSpec = `${currentMain}:${relativePath}`;
    if (!gitObjectExists(repository, objectSpec)) {
      hashes[relativePath] = null;
      continue;
    }
    const bytes = execFileSync("git", ["-C", repository, "show", objectSpec], {
      encoding: "buffer",
      maxBuffer: 128 * 1024 * 1024,
    });
    hashes[relativePath] = createHash("sha256").update(bytes).digest("hex");
  }
  return hashes;
}

function collectHistoricalRecords({ baseSha: base, inventory, repo: repository }) {
  const heads = collectUniqueHeadShas(inventory);
  if (heads.length === 0) return [];
  const output = execFileSync("git", ["-C", repository, "rev-list", ...heads, "--not", base], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const commits = [...new Set(output.split(/\r?\n/).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
  return commits.map((commit) => {
    const subject = execFileSync(
      "git",
      ["-C", repository, "show", "-s", "--format=%s", commit],
      { encoding: "utf8" },
    ).trim();
    const record = {
      sourceId: `historical-commit:${commit}`,
      sourceKind: "historical-commit",
      commit,
      subject,
      packet: subject,
    };
    return { ...record, disposition: classifyMechanicalPolicy(record) };
  });
}

function gitObjectExists(repository, objectSpec) {
  try {
    execFileSync("git", ["-C", repository, "cat-file", "-e", objectSpec], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(path.resolve(filePath), "utf8"));
}

function parseOptions(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`invalid CLI arguments near ${key || "END"}`);
    }
    parsed[key.slice(2)] = value;
  }
  return parsed;
}

function requireOption(parsed, name) {
  const value = parsed[name];
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

function requireObjectId(value, name) {
  if (!/^[0-9a-f]{40,64}$/i.test(String(value || ""))) {
    throw new Error(`--${name} must be an exact object id`);
  }
  return String(value);
}
