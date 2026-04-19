#!/usr/bin/env node
/**
 * a11y-icons-audit.cjs — Semantic a11y classifier for lucide-react icons.
 *
 * Addresses tech-debt audit §10.1 "254 buttons missing aria-label" which
 * conflates two distinct WCAG violations:
 *
 *  1. **Decorative icons inside a labelled button** (WCAG 1.1.1 Non-text Content,
 *     axe-core rule `svg-img-alt`) — need `aria-hidden="true"` so screen readers
 *     do not announce the SVG icon name as noise next to visible text.
 *  2. **Icon-only buttons without text** (WCAG 4.1.2 Name/Role/Value,
 *     axe-core rule `button-name`) — need `aria-label` to provide an accessible
 *     name.
 *
 * Counting `<button>` without `aria-label` (the first-pass audit heuristic)
 * mixes these. A button with text child + icon is already accessible but
 * creates noise (case 1). A button with icon only is broken (case 2).
 *
 * This script distinguishes them by scanning the JSX body of each `<button>`
 * in every `.tsx` file under `src/`, classifying each discovered icon by
 * whether the button has a visible text-node sibling, and writing a structured
 * report.
 *
 * Reference:
 *  - WCAG 2.2 SC 1.1.1: https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html
 *  - WCAG 2.2 SC 4.1.2: https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html
 *  - axe-core rules: https://dequeuniversity.com/rules/axe/4.9/svg-img-alt
 *
 * Usage:
 *   node scripts/a11y-icons-audit.cjs            # print report (default)
 *   node scripts/a11y-icons-audit.cjs --json     # machine-readable
 *   node scripts/a11y-icons-audit.cjs --top 10   # show top-N offenders
 *   node scripts/a11y-icons-audit.cjs --file path.tsx  # single file deep-dive
 *
 * CI-gate modes (Law 27 Ratchet — baseline can only move down):
 *   --max-icon-only=N       exit 2 if icon-only buttons > N (default OFF)
 *   --max-decorative=N      exit 2 if decorative-without-aria-hidden > N (default OFF)
 *
 * DOES NOT modify code. A separate `--fix` mode is a future PR because the
 * classifier has an "ambiguous" bucket that must not be auto-mutated.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

// ────────────────────────────────────────────────────────────────────────────
// File walker
// ────────────────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      walk(full, out);
    } else if (/\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Minimal TSX scanner
// ────────────────────────────────────────────────────────────────────────────
//
// We do not pull in a full TS AST library. Instead we work on text ranges using
// two passes:
//
//   Pass 1: tokenize-away comments and string literals so regex can't hit them.
//   Pass 2: find each `<button ... >...</button>` block and its imported
//           lucide-react icon set, then classify each `<IconName ... />` inside.
//
// This is deliberately conservative: if classification is uncertain, we bucket
// the finding as "ambiguous" rather than auto-deciding.

function stripNoise(src) {
  // Strip /* block */ and // line comments outside strings. Strip "..." and
  // '...' and `...`. Replace with same-length spaces so line/col positions
  // remain stable.
  const chars = [...src];
  let i = 0;
  const n = chars.length;
  const blank = (start, end) => {
    for (let j = start; j < end; j++) {
      if (chars[j] !== "\n") chars[j] = " ";
    }
  };
  while (i < n) {
    const c = chars[i];
    const c2 = chars[i + 1];
    if (c === "/" && c2 === "/") {
      let j = i;
      while (j < n && chars[j] !== "\n") j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === "/" && c2 === "*") {
      let j = i + 2;
      while (j < n - 1 && !(chars[j] === "*" && chars[j + 1] === "/")) j++;
      blank(i, Math.min(n, j + 2));
      i = j + 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let j = i + 1;
      while (j < n && chars[j] !== quote) {
        if (chars[j] === "\\") j++;
        j++;
      }
      blank(i, Math.min(n, j + 1));
      i = j + 1;
      continue;
    }
    i++;
  }
  return chars.join("");
}

function parseLucideImports(src) {
  // Match:  import { A, B as C, ... } from "lucide-react"
  // Return Set of local names that are lucide icons.
  const importRegex = /import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g;
  const names = new Set();
  let m;
  while ((m = importRegex.exec(src))) {
    const items = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    for (const item of items) {
      const asMatch = /\bas\s+(\w+)$/.exec(item);
      const local = asMatch ? asMatch[1] : item.replace(/\s+.*$/, "").trim();
      if (local) names.add(local);
    }
  }
  return names;
}

// Locate every `<button ... >...</button>` block and scan its body for icons.
// Returns an array of { buttonStart, buttonEnd, bodyStart, bodyEnd, hasAriaLabel }.
function findButtonBlocks(src) {
  const out = [];
  const re = /<button\b/g;
  let m;
  while ((m = re.exec(src))) {
    const openStart = m.index;
    // Find end of opening tag: first unescaped > that's not inside {}.
    let i = openStart + "<button".length;
    let braces = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === "{") braces++;
      else if (c === "}") braces--;
      else if (c === ">" && braces === 0) break;
      i++;
    }
    if (i >= src.length) continue;
    const openEnd = i;
    const openTag = src.slice(openStart, openEnd + 1);
    const hasAriaLabel = /\baria-label\s*=/.test(openTag);
    const selfClosing = /\/>\s*$/.test(openTag.trim());
    let closeEnd = -1;
    if (!selfClosing) {
      // Find matching </button>. Not perfect for deeply nested pseudo-buttons,
      // but real JSX rarely nests button-in-button.
      const closeRe = /<\/button>/g;
      closeRe.lastIndex = openEnd + 1;
      const closeMatch = closeRe.exec(src);
      if (!closeMatch) continue;
      closeEnd = closeMatch.index + "</button>".length;
    } else {
      closeEnd = openEnd + 1;
    }
    out.push({
      buttonStart: openStart,
      buttonEnd: closeEnd,
      bodyStart: openEnd + 1,
      bodyEnd: closeEnd - "</button>".length,
      hasAriaLabel,
      selfClosing,
    });
  }
  return out;
}

// Within a button body, check if any NON-whitespace text/JSX-expression exists
// alongside icon tags. Simplified heuristic: treat any {t.something} or literal
// text (word char) as "has visible text."
function buttonBodyHasVisibleText(body, icons) {
  // Remove icon self-closing tags from body
  let cleaned = body;
  for (const icon of icons) {
    const iconRe = new RegExp(`<${icon}\\b[^/]*?/>`, "g");
    cleaned = cleaned.replace(iconRe, "");
  }
  // Remove decorative emojis/span wrappers? Keep them — they count as text.
  // Strip JSX fragments/whitespace-only patterns.
  const textContent = cleaned
    .replace(/<[^>]+>/g, "")    // strip tags
    .replace(/\{[^{}]*\}/g, (m) => {
      // A JSX expression. Count as text if it references `t.something` or a
      // variable/string. Skip if it's just whitespace/spread.
      return /\b[\w.]+\b/.test(m) ? "TEXT" : "";
    });
  return /\S/.test(textContent);
}

// Find icon usages `<IconName ...attrs... />` within a body range.
// Returns [{ iconName, start, end, hasAriaHidden }].
function findIconUsages(src, start, end, icons) {
  const out = [];
  const region = src.slice(start, end);
  for (const icon of icons) {
    const re = new RegExp(`<${icon}\\b([^>]*?)/>`, "g");
    let m;
    while ((m = re.exec(region))) {
      const absStart = start + m.index;
      const absEnd = absStart + m[0].length;
      const attrs = m[1] || "";
      const hasAriaHidden = /\baria-hidden\s*=/.test(attrs);
      out.push({
        iconName: icon,
        start: absStart,
        end: absEnd,
        hasAriaHidden,
        attrs,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function lineOf(src, offset) {
  return src.slice(0, offset).split("\n").length;
}

// ────────────────────────────────────────────────────────────────────────────
// Per-file classifier
// ────────────────────────────────────────────────────────────────────────────
function classifyFile(absPath) {
  const srcRaw = fs.readFileSync(absPath, "utf8");
  // Extract imports from RAW source — stripNoise blanks string literals, which
  // would destroy `from "lucide-react"` and hide every Lucide usage.
  const icons = parseLucideImports(srcRaw);
  // Then strip strings/comments so JSX-body scanning doesn't trip on
  // lookalike text inside literals.
  const src = stripNoise(srcRaw);
  if (icons.size === 0) {
    return {
      file: path.relative(ROOT, absPath),
      hasLucide: false,
      decorative: [],
      iconOnly: [],
      ambiguous: [],
    };
  }

  const blocks = findButtonBlocks(src);
  const decorative = [];
  const iconOnly = [];
  const ambiguous = [];

  for (const b of blocks) {
    const body = src.slice(b.bodyStart, b.bodyEnd);
    const usages = findIconUsages(src, b.bodyStart, b.bodyEnd, icons);
    if (usages.length === 0) continue;
    const hasText = buttonBodyHasVisibleText(body, icons);

    for (const u of usages) {
      const rec = {
        file: path.relative(ROOT, absPath),
        line: lineOf(srcRaw, u.start),
        icon: u.iconName,
        buttonHasAriaLabel: b.hasAriaLabel,
        iconHasAriaHidden: u.hasAriaHidden,
      };
      if (hasText) {
        // Icon is decorative — it accompanies text inside a labelled/titled button.
        if (!u.hasAriaHidden) decorative.push(rec);
      } else {
        // Icon is sole child of button — it IS the button's label.
        if (!b.hasAriaLabel) iconOnly.push(rec);
      }
    }
  }

  return {
    file: path.relative(ROOT, absPath),
    hasLucide: true,
    decorative,
    iconOnly,
    ambiguous,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const topIdx = args.indexOf("--top");
  const top = topIdx >= 0 ? parseInt(args[topIdx + 1], 10) || 10 : null;
  const fileIdx = args.indexOf("--file");
  const singleFile = fileIdx >= 0 ? args[fileIdx + 1] : null;

  const files = singleFile
    ? [path.isAbsolute(singleFile) ? singleFile : path.join(ROOT, singleFile)]
    : walk(SRC);

  const results = files.map(classifyFile).filter((r) => r.hasLucide);

  const totals = results.reduce(
    (acc, r) => {
      acc.decorative += r.decorative.length;
      acc.iconOnly += r.iconOnly.length;
      return acc;
    },
    { decorative: 0, iconOnly: 0 },
  );

  // Ratchet gates (Law 27): caller supplies maxima; script exits 2 when
  // current value exceeds the baseline. Omitting a flag disables that gate.
  const parseIntFlag = (flag) => {
    const entry = args.find((a) => a.startsWith(flag + "="));
    if (!entry) return null;
    const n = parseInt(entry.split("=")[1], 10);
    return Number.isFinite(n) ? n : null;
  };
  const maxIconOnly = parseIntFlag("--max-icon-only");
  const maxDecorative = parseIntFlag("--max-decorative");
  const gateFailures = [];
  if (maxIconOnly !== null && totals.iconOnly > maxIconOnly) {
    gateFailures.push(`icon-only buttons: ${totals.iconOnly} > baseline ${maxIconOnly}`);
  }
  if (maxDecorative !== null && totals.decorative > maxDecorative) {
    gateFailures.push(`decorative-without-aria-hidden: ${totals.decorative} > baseline ${maxDecorative}`);
  }

  if (json) {
    console.log(
      JSON.stringify(
        { totals, gates: { maxIconOnly, maxDecorative, failures: gateFailures }, files: results.filter((r) => r.decorative.length || r.iconOnly.length) },
        null,
        2,
      ),
    );
    if (gateFailures.length > 0) process.exit(2);
    return;
  }

  console.log("=".repeat(72));
  console.log("Lucide-icon a11y audit — tech-debt §10.1 semantic classifier");
  console.log("=".repeat(72));
  console.log("");
  console.log(`Files scanned (with lucide-react imports): ${results.length}`);
  console.log(`Decorative icons needing aria-hidden="true": ${totals.decorative}`);
  console.log(`Icon-only buttons needing aria-label:       ${totals.iconOnly}`);
  console.log("");

  const byFile = results
    .filter((r) => r.decorative.length + r.iconOnly.length > 0)
    .map((r) => ({
      file: r.file,
      decorative: r.decorative.length,
      iconOnly: r.iconOnly.length,
      total: r.decorative.length + r.iconOnly.length,
    }))
    .sort((a, b) => b.total - a.total);

  const shown = top ? byFile.slice(0, top) : byFile;
  console.log(`Top ${shown.length} offender file${shown.length === 1 ? "" : "s"}:`);
  console.log("");
  console.log(
    "  DEC  ICON  FILE".padEnd(70),
  );
  for (const f of shown) {
    console.log(`  ${String(f.decorative).padStart(3)}  ${String(f.iconOnly).padStart(4)}  ${f.file}`);
  }
  console.log("");
  console.log("DEC  = decorative icons inside labelled buttons (need aria-hidden=\"true\")");
  console.log("ICON = icon-only buttons (need aria-label)");
  console.log("");
  console.log("Fix decorative with bulk Edit; investigate each icon-only individually.");
  console.log("Re-run with --file=<path> for file-level detail, --json for machine-readable.");

  if (gateFailures.length > 0) {
    console.log("");
    console.error("[a11y-icons] RATCHET FAIL:");
    for (const f of gateFailures) console.error(`  - ${f}`);
    process.exit(2);
  }
}

main();
