#!/usr/bin/env node
/**
 * bundle-report.cjs — Empirical bundle observability (tech-debt §10.5).
 *
 * Walks `dist/` (produced by `npm run build`), computes raw + gzip + brotli
 * size per asset, groups by file type, and compares totals against the budget
 * in `.size-limit.json`. Zero npm deps — uses Node 22+ built-ins (`node:zlib`,
 * `node:fs`).
 *
 * Why a custom script instead of `rollup-plugin-visualizer` or `size-limit`:
 *  - visualizer needs a build-time plugin install (+~2 MB dev-dep) and emits
 *    an HTML report that only tells you what's in chunks, not over-budget.
 *  - `size-limit` is already installed and runs in CI, but emits to stdout
 *    with hard-coded patterns; this script gives per-file detail without
 *    modifying `.size-limit.json`.
 *  - This script is READ-ONLY on dist/, never mutates, never installs anything.
 *
 * Usage:
 *   node scripts/bundle-report.cjs              # full report
 *   node scripts/bundle-report.cjs --top 20     # top-N largest chunks
 *   node scripts/bundle-report.cjs --json       # machine-readable
 *   node scripts/bundle-report.cjs --filter js  # only js chunks
 *
 * Exit codes:
 *   0 — report generated (does NOT enforce budget; use --strict for that)
 *   1 — dist/ missing (run `npm run build` first)
 *   2 — --strict: at least one budget class exceeded
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SIZE_LIMIT = path.join(ROOT, ".size-limit.json");

// ────────────────────────────────────────────────────────────────────────────
// Filesystem walker
// ────────────────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Compression
// ────────────────────────────────────────────────────────────────────────────
/**
 * Measure sizes. Prefer pre-compressed sidecar files written by
 * vite-plugin-compression2 at build time (they exist in production dist/)
 * because (a) it's 50-100× faster than re-compressing at quality 11, and
 * (b) it matches the exact bytes shipped. Fall back to runtime compression
 * at quality 6 (balanced, fast) if sidecars missing.
 */
function measureFile(abs) {
  const raw = fs.statSync(abs).size;

  // Sidecar .gz
  let gzip;
  if (fs.existsSync(abs + ".gz")) {
    gzip = fs.statSync(abs + ".gz").size;
  } else {
    const buf = fs.readFileSync(abs);
    gzip = zlib.gzipSync(buf, { level: 6 }).byteLength;
  }

  // Sidecar .br
  let brotli;
  if (fs.existsSync(abs + ".br")) {
    brotli = fs.statSync(abs + ".br").size;
  } else {
    const buf = fs.readFileSync(abs);
    brotli = zlib.brotliCompressSync(buf, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 },
    }).byteLength;
  }

  return { raw, gzip, brotli };
}

function classify(file) {
  const ext = path.extname(file).toLowerCase();
  // Skip pre-compressed sidecars — counted transitively via their sibling.
  if (ext === ".gz" || ext === ".br") return null;
  if (ext === ".js" || ext === ".mjs") return "js";
  if (ext === ".css") return "css";
  if (ext === ".html") return "html";
  if (ext === ".svg") return "svg";
  if (ext === ".woff" || ext === ".woff2") return "font";
  if (/\.(png|jpg|jpeg|webp|avif|ico)$/i.test(ext)) return "image";
  if (/\.(wav|mp3|ogg|opus)$/i.test(ext)) return "audio";
  if (/\.(json|map)$/i.test(ext)) return "meta";
  return "other";
}

// ────────────────────────────────────────────────────────────────────────────
// Budget loader
// ────────────────────────────────────────────────────────────────────────────
function loadBudget() {
  if (!fs.existsSync(SIZE_LIMIT)) return null;
  try {
    const entries = JSON.parse(fs.readFileSync(SIZE_LIMIT, "utf8"));
    // size-limit uses a list of { name, path, limit } entries.
    return Array.isArray(entries) ? entries : null;
  } catch {
    return null;
  }
}

function parseLimit(str) {
  // Accepts "500 KB", "1.5 MB", "2000 B"
  if (!str) return 0;
  const m = /^([\d.]+)\s*(B|KB|MB|GB)?$/i.exec(str.trim());
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = (m[2] || "B").toUpperCase();
  const mult = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[unit];
  return Math.round(n * mult);
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting
// ────────────────────────────────────────────────────────────────────────────
function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function pad(s, n, side = "left") {
  const str = String(s);
  if (str.length >= n) return str;
  return side === "left" ? str.padStart(n) : str.padEnd(n);
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const strict = args.includes("--strict");
  const topIdx = args.indexOf("--top");
  const top = topIdx >= 0 ? parseInt(args[topIdx + 1], 10) || 20 : 20;
  const filterIdx = args.indexOf("--filter");
  const filter = filterIdx >= 0 ? args[filterIdx + 1] : null;

  if (!fs.existsSync(DIST)) {
    console.error("[bundle-report] dist/ not found. Run `npm run build` first.");
    process.exit(1);
  }

  const files = walk(DIST);
  const assets = files
    .map((abs) => {
      const rel = path.relative(DIST, abs).replace(/\\/g, "/");
      const cls = classify(rel);
      if (cls === null) return null; // skip .gz/.br sidecars
      if (filter && cls !== filter) return null;
      const sizes = measureFile(abs);
      return { path: rel, cls, ...sizes };
    })
    .filter(Boolean);

  // Totals by class
  const totals = {};
  for (const a of assets) {
    if (!totals[a.cls]) totals[a.cls] = { count: 0, raw: 0, gzip: 0, brotli: 0 };
    totals[a.cls].count++;
    totals[a.cls].raw += a.raw;
    totals[a.cls].gzip += a.gzip;
    totals[a.cls].brotli += a.brotli;
  }

  const grand = assets.reduce(
    (acc, a) => ({ raw: acc.raw + a.raw, gzip: acc.gzip + a.gzip, brotli: acc.brotli + a.brotli }),
    { raw: 0, gzip: 0, brotli: 0 },
  );

  // Budget
  const budget = loadBudget();
  let budgetStatus = null;
  if (budget) {
    budgetStatus = budget.map((b) => {
      const limitBytes = parseLimit(b.limit);
      const matched = assets.filter((a) => matchPath(a.path, b.path));
      // size-limit schema (https://github.com/ai/size-limit):
      //   { "brotli": true }                  → measure brotli
      //   { "gzip": false, "brotli": false }  → measure raw
      //   { "gzip": true } | default          → measure gzip
      let compression;
      if (b.brotli === true) compression = "brotli";
      else if (b.gzip === false && b.brotli !== true) compression = "raw";
      else compression = "gzip";

      const actual = matched.reduce((acc, a) => {
        if (compression === "brotli") return acc + a.brotli;
        if (compression === "raw") return acc + a.raw;
        return acc + a.gzip;
      }, 0);
      return {
        name: b.name,
        pattern: b.path,
        compression,
        limit: limitBytes,
        actual,
        over: actual > limitBytes,
        overBy: Math.max(0, actual - limitBytes),
      };
    });
  }

  const topAssets = [...assets].sort((a, b) => b.raw - a.raw).slice(0, top);

  if (json) {
    console.log(JSON.stringify({ totals, grand, topAssets, budgetStatus }, null, 2));
  } else {
    printReport({ totals, grand, topAssets, budgetStatus, top });
  }

  if (strict && budgetStatus && budgetStatus.some((b) => b.over)) {
    process.exit(2);
  }
}

function matchPath(assetPath, pattern) {
  // Very simple glob: supports ** and * and exact prefixes.
  if (!pattern) return false;
  const re = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "§")
        .replace(/\*/g, "[^/]*")
        .replace(/§/g, ".*") +
      "$",
  );
  return re.test("dist/" + assetPath) || re.test(assetPath);
}

function printReport({ totals, grand, topAssets, budgetStatus, top }) {
  console.log("=".repeat(78));
  console.log("  ZenFlow bundle report — produced by scripts/bundle-report.cjs");
  console.log("=".repeat(78));
  console.log("");

  // Grand totals
  console.log("Grand totals:");
  console.log(`  raw    : ${fmtBytes(grand.raw)}`);
  console.log(`  gzip   : ${fmtBytes(grand.gzip)}`);
  console.log(`  brotli : ${fmtBytes(grand.brotli)}`);
  console.log("");

  // By class
  console.log("By asset class:");
  console.log("  " + pad("class", 8, "right") + pad("files", 8) + pad("raw", 14) + pad("gzip", 14) + pad("brotli", 14));
  const classes = Object.keys(totals).sort((a, b) => totals[b].raw - totals[a].raw);
  for (const c of classes) {
    const t = totals[c];
    console.log(
      "  " +
        pad(c, 8, "right") +
        pad(t.count, 8) +
        pad(fmtBytes(t.raw), 14) +
        pad(fmtBytes(t.gzip), 14) +
        pad(fmtBytes(t.brotli), 14),
    );
  }
  console.log("");

  // Top-N largest
  console.log(`Top ${topAssets.length} largest assets (by raw):`);
  console.log("  " + pad("raw", 10) + pad("gzip", 10) + pad("brotli", 10) + "  path");
  for (const a of topAssets) {
    console.log(
      "  " +
        pad(fmtBytes(a.raw), 10) +
        pad(fmtBytes(a.gzip), 10) +
        pad(fmtBytes(a.brotli), 10) +
        "  " +
        a.path,
    );
  }
  console.log("");

  // Budget
  if (budgetStatus && budgetStatus.length > 0) {
    console.log("Budget check (.size-limit.json):");
    for (const b of budgetStatus) {
      const status = b.over ? "FAIL" : "ok";
      const overStr = b.over ? `  (over by ${fmtBytes(b.overBy)})` : "";
      console.log(
        `  [${status}] ${b.name}: ${fmtBytes(b.actual)} / ${fmtBytes(b.limit)} (${b.compression})${overStr}`,
      );
    }
    console.log("");
  } else {
    console.log("No budget loaded (.size-limit.json missing or unreadable).");
    console.log("");
  }

  console.log("Hints:");
  console.log("  Filter:  node scripts/bundle-report.cjs --filter js");
  console.log("  CI gate: node scripts/bundle-report.cjs --strict   (exit 2 on over-budget)");
  console.log("  JSON:    node scripts/bundle-report.cjs --json > bundle.json");
}

main();
