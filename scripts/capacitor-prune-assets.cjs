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
 * pwa-192.png is KEPT because native index.html still references it as a
 * rel=icon target after the PWA manifest link is stripped.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "..", "dist");
const ANDROID_PUBLIC = path.resolve(__dirname, "..", "android", "app", "src", "main", "assets", "public");
const ANDROID_RES = path.resolve(__dirname, "..", "android", "app", "src", "main", "res");
const ANDROID_APP_BUILD = path.resolve(__dirname, "..", "android", "app", "build");
const ANDROID_CORDOVA_PLUGINS = path.resolve(__dirname, "..", "android", "capacitor-cordova-android-plugins");
const IOS_APP = path.resolve(__dirname, "..", "ios", "App", "App");
const IOS_CORDOVA_PLUGINS = path.resolve(__dirname, "..", "ios", "capacitor-cordova-ios-plugins");
const LATE_DUPLICATE_CONFIRM_PASSES = 24;
const LATE_DUPLICATE_CONFIRM_DELAY_MS = 500;
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
  // so these PNGs are dead weight in the APK. VitePWA plugin is also gated
  // `!isCapacitor` so no manifest is generated in native builds.
  // Keep pwa-192.png: index.html references it as a favicon, and removing it
  // produces a broken native WebKit asset request.
  "pwa-72.png",
  "pwa-96.png",
  "pwa-128.png",
  "pwa-144.png",
  "pwa-152.png",
  "pwa-384.png",
  "pwa-512.png",
  "pwa-maskable-512.png",
];

function resolveChildInsideRoot(root, childName) {
  // childName comes from fs.readdirSync(root), but keep an explicit
  // containment check so future call sites cannot turn this into traversal.
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const childPath = path.resolve(root, childName);
  const relative = path.relative(root, childPath);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to prune outside ${root}: ${childName}`);
  }
  return childPath;
}

function pruneMacDuplicateArtifacts(root, label) {
  if (!fs.existsSync(root)) {
    console.log(`[prune-assets] ${label} not found — skipping duplicate artifact cleanup`);
    return 0;
  }

  let removed = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = resolveChildInsideRoot(root, entry.name);
    if (/ \d+(?=\.|$)/.test(entry.name)) {
      fs.rmSync(entryPath, { force: true, recursive: true });
      removed++;
      continue;
    }
    if (entry.isDirectory()) {
      removed += pruneMacDuplicateArtifacts(entryPath, `${label}/${entry.name}`);
    }
  }
  console.log(`[prune-assets] removed ${removed} duplicate ${label} artifact(s)`);
  return removed;
}

function prunePrecompressedNativeAssets(root, label) {
  if (!fs.existsSync(root)) {
    console.log(`[prune-assets] ${label} not found — skipping precompressed cleanup`);
    return 0;
  }

  let removed = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = resolveChildInsideRoot(root, entry.name);
    if (entry.isDirectory()) {
      removed += prunePrecompressedNativeAssets(entryPath, `${label}/${entry.name}`);
      continue;
    }
    if (/\.(?:br|gz)$/.test(entry.name)) {
      fs.rmSync(entryPath, { force: true });
      removed++;
    }
  }
  console.log(`[prune-assets] removed stale precompressed ${label} asset(s): ${removed}`);
  return removed;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function pruneLateMacDuplicateArtifacts() {
  // Some macOS/iCloud workspaces materialize " 2" duplicate artifacts after
  // Capacitor sync completes. Poll long enough for delayed local filesystem
  // copies to settle before native runtime verification and release guards.
  let removedTotal = 0;
  for (let pass = 1; pass <= LATE_DUPLICATE_CONFIRM_PASSES; pass++) {
    sleepSync(LATE_DUPLICATE_CONFIRM_DELAY_MS);
    removedTotal +=
      pruneMacDuplicateArtifacts(DIST, `dist-late-${pass}`) +
      pruneMacDuplicateArtifacts(IOS_APP, `ios-app-late-${pass}`) +
      pruneMacDuplicateArtifacts(IOS_CORDOVA_PLUGINS, `ios-cordova-plugins-late-${pass}`);
  }

  if (removedTotal > 0) {
    console.log(`[prune-assets] removed ${removedTotal} late duplicate artifact(s)`);
  }
}

function stripNativeManifestLink() {
  const indexPath = path.join(DIST, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.warn("[prune-assets] index.html not found — cannot strip native manifest link");
    return;
  }

  const original = fs.readFileSync(indexPath, "utf8");
  const updated = original.replace(
    /^\s*<link\s+rel=["']manifest["'][^>]*>\s*$/im,
    "",
  );

  if (updated !== original) {
    fs.writeFileSync(indexPath, updated);
    console.log("[prune-assets] removed native manifest link from index.html");
  } else {
    console.log("[prune-assets] native manifest link already absent");
  }
}

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

pruneMacDuplicateArtifacts(DIST, "dist");
pruneMacDuplicateArtifacts(ANDROID_PUBLIC, "android-public");
pruneMacDuplicateArtifacts(ANDROID_RES, "android-res");
pruneMacDuplicateArtifacts(ANDROID_APP_BUILD, "android-app-build");
pruneMacDuplicateArtifacts(ANDROID_CORDOVA_PLUGINS, "android-cordova-plugins");
pruneMacDuplicateArtifacts(IOS_APP, "ios-app");
pruneMacDuplicateArtifacts(IOS_CORDOVA_PLUGINS, "ios-cordova-plugins");
prunePrecompressedNativeAssets(ANDROID_PUBLIC, "android-public");
prunePrecompressedNativeAssets(path.join(IOS_APP, "public"), "ios-public");

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

stripNativeManifestLink();
pruneLateMacDuplicateArtifacts();
