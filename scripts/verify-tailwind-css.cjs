#!/usr/bin/env node
/**
 * verify-tailwind-css.cjs — post-build guard
 *
 * Ensures Tailwind utilities are present in the built CSS.
 * Catches the class of regression introduced and fixed in session
 * 2026-04-19: `css.transformer: "lightningcss"` silently bypassed
 * PostCSS, dropping all Tailwind utility classes while leaving custom
 * CSS intact. CSS bundle looked "smaller" (102KB vs 372KB) but actually
 * had all utility classes missing.
 *
 * Strategy: grep dist/assets/*.css for a baseline set of Tailwind
 * utilities that MUST be present in any healthy build. Fail loudly
 * if any are missing.
 *
 * Usage:
 *   node scripts/verify-tailwind-css.cjs       # exits 1 on fail
 *   npm run verify:tailwind                    # via script
 *
 * Safe to run after every build. Costs ~30 ms.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const DIST_ASSETS = path.resolve(__dirname, "..", "dist", "assets");

// Minimum utility counts expected in a mid-size Tailwind app.
// Numbers are lower-bounds — the real build has 2-10x these.
// Tailwind escapes `:` as `\\:` and brackets as `\\[`, `\\]` in output.
// We probe via exact substring match (post-minify format).
const REQUIRED = [
  { label: "display flex", needle: "{display:flex}", min: 1 },
  { label: "display grid", needle: "{display:grid}", min: 1 },
  { label: "position fixed", needle: "{position:fixed}", min: 1 },
  { label: "position absolute", needle: "{position:absolute}", min: 1 },
  { label: ":hover states", needle: ":hover", min: 50 },
  { label: "border-radius", needle: "border-radius", min: 5 },
  { label: "padding utilities", needle: "padding", min: 20 },
  { label: "margin utilities", needle: "margin", min: 20 },
  { label: "media queries (responsive)", needle: "@media", min: 5 },
  { label: "Tailwind bg-* classes", needle: "background-color:hsl(var(--", min: 3 },
];

function main() {
  if (!fs.existsSync(DIST_ASSETS)) {
    console.error("[verify-tailwind] dist/assets/ not found — run `npm run build` first");
    process.exit(1);
  }

  const cssFiles = fs
    .readdirSync(DIST_ASSETS)
    .filter((f) => f.endsWith(".css") && !f.endsWith(".gz") && !f.endsWith(".br"));

  if (cssFiles.length === 0) {
    console.error("[verify-tailwind] no CSS files found in dist/assets/");
    process.exit(1);
  }

  const combined = cssFiles
    .map((f) => fs.readFileSync(path.join(DIST_ASSETS, f), "utf-8"))
    .join("\n");

  const sizeKB = (combined.length / 1024).toFixed(1);
  console.log(`[verify-tailwind] scanning ${cssFiles.length} CSS file(s), ${sizeKB} KB total`);

  const results = REQUIRED.map(({ label, needle, min }) => {
    const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const count = (combined.match(re) || []).length;
    return { label, needle, min, count, ok: count >= min };
  });

  let failed = 0;
  for (const r of results) {
    const mark = r.ok ? "✓" : "✗";
    const status = r.ok ? "OK" : `FAIL (need ≥${r.min}, got ${r.count})`;
    console.log(`  ${mark} ${r.label.padEnd(32)} ${r.count.toString().padStart(4)}  ${status}`);
    if (!r.ok) failed++;
  }

  if (failed === 0) {
    console.log(`[verify-tailwind] PASS — all ${REQUIRED.length} guards met`);
    process.exit(0);
  }

  console.error(`[verify-tailwind] FAIL — ${failed}/${REQUIRED.length} guards triggered`);
  console.error("[verify-tailwind] Likely cause: CSS pipeline change bypassed PostCSS.");
  console.error("[verify-tailwind] See memory/feedback_tailwind_css_verification.md");
  console.error("[verify-tailwind] Check vite.config.ts for `css.transformer` — it disables PostCSS.");
  process.exit(1);
}

main();
