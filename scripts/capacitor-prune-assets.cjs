#!/usr/bin/env node
/**
 * capacitor-prune-assets.cjs — strip store-only assets from dist/ for APK
 *
 * These files exist in public/ for Play Store listing uploads and docs
 * references but are not loaded by the native runtime. Including them in
 * the APK adds dead weight (APK asset footprint).
 *
 * Only runs when CAPACITOR_BUILD=true so PWA web deploys keep the files
 * (they might be served for SEO/social share or Play Store manifest).
 *
 * Verified unreferenced (see session 2026-04-19 audit):
 *   feature-graphic.png  (379 KB) — Play Store listing artwork
 *   feature-graphic.webp (19 KB)  — alt format for above
 *   feature-graphic.svg  (10 KB)  — source vector
 *
 * og-image.png is KEPT because index.html references it in meta tags.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "..", "dist");
const PRUNE = [
  // Play Store listing artwork — only for manual uploads, not runtime
  "feature-graphic.png",
  "feature-graphic.webp",
  "feature-graphic.svg",
  // Round icon source vector — used only by scripts/generate-icons.cjs at
  // build time to regenerate pwa-*.png. NOT loaded at runtime. Keep
  // icon-source.svg: the entry gate brand mark references the official SVG.
  "icon-source-round.svg",
  // icon-512.png: alt-size output, manifest uses pwa-512.png exclusively.
  // Verified: 0 refs in src/ or vite.config.ts manifest.
  "icon-512.png",
  // PWA manifest icons — consumed by browser when installing as PWA via
  // manifest.webmanifest. Capacitor Android/iOS use NATIVE launcher icons
  // from android/app/src/main/res/mipmap-*/ and ios/App/App/Assets.xcassets/
  // so these 9 PNGs are dead weight in the APK. VitePWA plugin is also
  // gated `!isCapacitor` so no manifest is generated in native builds.
  "pwa-72.png",
  "pwa-96.png",
  "pwa-128.png",
  "pwa-144.png",
  "pwa-152.png",
  "pwa-192.png",
  "pwa-384.png",
  "pwa-512.png",
  "pwa-maskable-512.png",
];

if (process.env.CAPACITOR_BUILD !== "true") {
  console.log("[prune-assets] not a Capacitor build — skipping");
  process.exit(0);
}

if (!fs.existsSync(DIST)) {
  console.error("[prune-assets] dist/ not found — run build first");
  process.exit(1);
}

let pruned = 0;
let savedBytes = 0;

for (const name of PRUNE) {
  const p = path.join(DIST, name);
  if (fs.existsSync(p)) {
    const size = fs.statSync(p).size;
    fs.unlinkSync(p);
    console.log(`[prune-assets] removed ${name} (${(size / 1024).toFixed(1)} KB)`);
    pruned++;
    savedBytes += size;
  }
}

if (pruned === 0) {
  console.log("[prune-assets] nothing to prune");
} else {
  console.log(
    `[prune-assets] pruned ${pruned} files, saved ${(savedBytes / 1024).toFixed(1)} KB from APK`,
  );
}
