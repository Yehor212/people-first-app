#!/usr/bin/env node
/**
 * doc-counts.cjs — Law 6 (Reality Anchor) enforcement for documentation.
 *
 * Measures ZenFlow-specific counts (hooks, stores, Index.tsx LOC, V2 files, etc.)
 * and regenerates the Codebase Metrics block in ARCHITECTURE.md between
 * `<!-- BEGIN:counts -->` and `<!-- END:counts -->` markers.
 *
 * Usage:
 *   node scripts/doc-counts.cjs --check    Exit 1 if docs drift from reality
 *   node scripts/doc-counts.cjs --update   Rewrite ARCHITECTURE.md markers
 *   node scripts/doc-counts.cjs --print    Print JSON snapshot (no writes)
 *
 * Rationale: tech-debt audit 2026-04-18 found CLAUDE.md and ARCHITECTURE.md
 * had drifted by 34-175% (4 stores claimed vs 11 actual, 56 hooks vs 75,
 * Index.tsx 452 LOC vs 606). Every Team Lead brief downstream was seeded
 * with lies. This script makes the drift mechanically impossible: CI
 * runs --check; docs fail the build until regenerated.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const ARCH = path.join(ROOT, "ARCHITECTURE.md");
const BEGIN = "<!-- BEGIN:counts -->";
const END = "<!-- END:counts -->";

function listFiles(dir, opts = {}) {
  const { recursive = false, extensions = [".ts", ".tsx"], excludeTests = true } = opts;
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  const walk = (d, depth) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (excludeTests && entry.name === "__tests__") continue;
        if (recursive) walk(full, depth + 1);
        continue;
      }
      if (excludeTests && (/\.test\.[tj]sx?$/.test(entry.name) || /\.spec\.[tj]sx?$/.test(entry.name))) continue;
      if (extensions.length === 0 || extensions.includes(path.extname(entry.name))) {
        out.push(full);
      }
    }
  };
  walk(abs, 0);
  return out;
}

function lineCount(file) {
  return fs.readFileSync(file, "utf8").split("\n").length;
}

function walkAll(dir, { extensions = [".ts", ".tsx"], onlyTests = false, excludeTests = false } = {}) {
  const out = [];
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  const isTest = (name) => /\.(test|spec)\.[tj]sx?$/.test(name);
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        walk(full);
      } else if (extensions.includes(path.extname(entry.name))) {
        if (onlyTests && !isTest(entry.name)) continue;
        if (excludeTests && isTest(entry.name)) continue;
        out.push(full);
      }
    }
  };
  walk(abs);
  return out;
}

function grepCount(regex, dir, opts = {}) {
  const files = walkAll(dir, opts);
  let count = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    const matches = src.match(regex);
    if (matches) count += matches.length;
  }
  return count;
}

function countTopLevelDirs(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return 0;
  return fs.readdirSync(abs, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== "__tests__").length;
}

function collect() {
  const hooksFiles = listFiles("src/hooks", { recursive: false });
  const storesFiles = listFiles("src/stores", { recursive: false });
  const hydrateBridges = storesFiles.filter((f) => /useHydrate/i.test(path.basename(f)));
  const runtimeStores = storesFiles.filter(
    (f) => !/useHydrate/i.test(path.basename(f)) && path.basename(f) !== "index.ts",
  );
  const componentsTopLevel = countTopLevelDirs("src/components");
  const featuresTopLevel = countTopLevelDirs("src/features");
  const indexTsx = path.join(ROOT, "src/pages/Index.tsx");
  const indexLoc = fs.existsSync(indexTsx) ? lineCount(indexTsx) : 0;

  // V2 coexistence files (navigation-v2, nav-v2, MoodSliderV2, ThemeToggleV2, useNavigationV2, NavV2Preview)
  let v2Count = 0;
  const v2Walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) v2Walk(full);
      else if (/V2|-v2/.test(entry.name)) v2Count++;
    }
  };
  v2Walk(path.join(ROOT, "src"));

  const publicSoundsBytes = (() => {
    const dir = path.join(ROOT, "public/sounds");
    if (!fs.existsSync(dir)) return 0;
    let total = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile()) total += fs.statSync(path.join(dir, entry.name)).size;
    }
    return total;
  })();

  // Count console.* in production paths, excluding test files AND the two legitimate
  // sinks where console is the implementation target (logger.ts, crashReporting.ts).
  const consoleLeaksInProd = (() => {
    const prodFiles = walkAll("src", { excludeTests: true }).filter(
      (f) => !/\/(logger|crashReporting)\.ts$/.test(f.replace(/\\/g, "/")),
    );
    let n = 0;
    for (const f of prodFiles) {
      const m = fs.readFileSync(f, "utf8").match(/console\.(log|error|warn|debug|info)\s*\(/g);
      if (m) n += m.length;
    }
    return n;
  })();

  const adrFiles = (() => {
    const dir = path.join(ROOT, "docs/adr");
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((f) => /^\d{4}-.+\.md$/.test(f)).length;
  })();

  const hasFile = (p) => fs.existsSync(path.join(ROOT, p));
  const repoHygiene = {
    securityMd: hasFile("SECURITY.md"),
    contributingMd: hasFile("CONTRIBUTING.md"),
    license: hasFile("LICENSE") || hasFile("LICENSE.md"),
    thirdPartyNotices: hasFile("THIRD_PARTY_NOTICES.md") || hasFile("public/OSS-NOTICES.txt"),
    codeowners: hasFile(".github/CODEOWNERS") || hasFile("CODEOWNERS"),
    adrReadme: hasFile("docs/adr/README.md"),
  };

  return {
    generatedAt: new Date().toISOString(),
    hooks: hooksFiles.length,
    storesTotal: storesFiles.length,
    runtimeStores: runtimeStores.length,
    hydrateBridges: hydrateBridges.length,
    indexTsxLoc: indexLoc,
    componentsTopLevelDirs: componentsTopLevel,
    featuresTopLevelDirs: featuresTopLevel,
    v2CoexistenceFiles: v2Count,
    itTodo: grepCount(/\bit\.todo\(/g, "src"),
    asAnyTotal: grepCount(/\bas any\b/g, "src"),
    asAnyInTests: grepCount(/\bas any\b/g, "src", { onlyTests: true }),
    publicSoundsMB: Math.round(publicSoundsBytes / (1024 * 1024)),
    consoleLeaksInProd,
    adrFiles,
    repoHygiene,
  };
}

function formatMarkdown(m) {
  // NOTE: no timestamp inside the generated block — would break idempotency of --check.
  const prodAsAny = Math.max(0, m.asAnyTotal - m.asAnyInTests);
  const yn = (b) => (b ? "yes" : "**MISSING**");
  return [
    "| Metric | Value | Source |",
    "| --- | ---: | --- |",
    `| Hooks (src/hooks, non-test) | **${m.hooks}** | \`ls src/hooks/*.ts\` |`,
    `| Zustand stores (runtime) | **${m.runtimeStores}** | \`ls src/stores/*.ts\` excl. hydrate + index |`,
    `| Hydrate bridges | ${m.hydrateBridges} | \`useHydrate*.ts\` |`,
    `| Index.tsx LOC | **${m.indexTsxLoc}** | \`wc -l src/pages/Index.tsx\` |`,
    `| Components top-level dirs | **${m.componentsTopLevelDirs}** | \`ls src/components/ -d\` |`,
    `| Features modules | ${m.featuresTopLevelDirs} | \`ls src/features/ -d\` |`,
    `| V2 coexistence files | ${m.v2CoexistenceFiles} | \`find src -name '*V2*' -o -name '*-v2*'\` |`,
    `| \`it.todo(\` occurrences | ${m.itTodo} | regex walk |`,
    `| \`as any\` total | ${m.asAnyTotal} (${m.asAnyInTests} in tests, ~${prodAsAny} prod) | regex walk |`,
    `| Console.\\* in prod (excl. logger/crashReporting) | **${m.consoleLeaksInProd}** | regex walk |`,
    `| ADR files (\`docs/adr/NNNN-*.md\`) | ${m.adrFiles} | ls |`,
    `| SECURITY.md | ${yn(m.repoHygiene.securityMd)} | fs |`,
    `| CONTRIBUTING.md | ${yn(m.repoHygiene.contributingMd)} | fs |`,
    `| LICENSE | ${yn(m.repoHygiene.license)} | fs |`,
    `| THIRD_PARTY_NOTICES | ${yn(m.repoHygiene.thirdPartyNotices)} | fs |`,
    `| CODEOWNERS | ${yn(m.repoHygiene.codeowners)} | fs |`,
    `| \`public/sounds/\` weight | ${m.publicSoundsMB} MB | \`du -sh public/sounds\` |`,
    "",
    `_Generated by \`scripts/doc-counts.cjs\`. Do not edit between markers — regenerate with \`npm run doc-counts:update\`._`,
  ].join("\n");
}

function readArch() {
  return fs.readFileSync(ARCH, "utf8");
}

function replaceMarkers(src, body) {
  const pattern = new RegExp(`${BEGIN}[\\s\\S]*?${END}`);
  if (!pattern.test(src)) {
    throw new Error(`Missing ${BEGIN} / ${END} markers in ARCHITECTURE.md`);
  }
  return src.replace(pattern, `${BEGIN}\n${body}\n${END}`);
}

function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "--check";
  const snapshot = collect();

  if (mode === "--print") {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  const body = formatMarkdown(snapshot);
  const src = readArch();
  const next = replaceMarkers(src, body);

  if (mode === "--update") {
    if (next !== src) {
      fs.writeFileSync(ARCH, next, "utf8");
      console.log(`[doc-counts] Updated ARCHITECTURE.md (${snapshot.hooks} hooks, ${snapshot.runtimeStores} stores, Index.tsx ${snapshot.indexTsxLoc} LOC)`);
    } else {
      console.log("[doc-counts] No drift detected. ARCHITECTURE.md already current.");
    }
    return;
  }

  if (mode === "--check") {
    if (next !== src) {
      console.error("[doc-counts] FAIL: ARCHITECTURE.md is out of sync with filesystem.");
      console.error(`  Expected:\n${body.split("\n").map((l) => "    " + l).join("\n")}`);
      console.error("\n  Fix: npm run doc-counts:update");
      process.exit(1);
    }
    console.log(`[doc-counts] OK (${snapshot.hooks} hooks, ${snapshot.runtimeStores} stores, Index.tsx ${snapshot.indexTsxLoc} LOC)`);
    return;
  }

  console.error(`Unknown mode: ${mode}. Use --check | --update | --print.`);
  process.exit(2);
}

main();
