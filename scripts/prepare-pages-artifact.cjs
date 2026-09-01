#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { brotliCompressSync, constants: zlibConstants, gzipSync } = require("node:zlib");
const {
  computeWorkboxRevision,
  writePreparedPagesArtifactManifest,
} = require("./check-release-artifact-integrity.cjs");

const root = process.cwd();
const brandLogoAssets = require("../config/brand-logo-assets.json");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");
const pwaInstallIconRevision = brandLogoAssets.pwaInstallIconRevision;

const routes = ["orb", "habits", "diary", "planning", "settings", "desktop"];

function updateIndexPrecacheRevision(serviceWorkerSource, revision) {
  let indexEntryCount = 0;
  const updated = serviceWorkerSource.replace(/\{[^{}]*\}/g, (objectLiteral) => {
    const urlMatch = objectLiteral.match(/(?:["']?url["']?)\s*:\s*(["'])(.*?)\1/);
    const url = urlMatch?.[2];
    if (url !== "index.html" && url !== "/people-first-app/index.html") {
      return objectLiteral;
    }

    indexEntryCount += 1;
    const revisionPattern = /((?:["']?revision["']?)\s*:\s*)(["'])(.*?)\2/;
    if (!revisionPattern.test(objectLiteral)) {
      throw new Error(
        "Cannot prepare GitHub Pages artifact: index precache entry must have a string revision"
      );
    }
    return objectLiteral.replace(
      revisionPattern,
      (_match, prefix, quote) => `${prefix}${quote}${revision}${quote}`
    );
  });

  if (indexEntryCount !== 1) {
    throw new Error(
      `Cannot prepare GitHub Pages artifact: expected exactly one index precache entry, found ${indexEntryCount}`
    );
  }
  return updated;
}

if (!fs.existsSync(indexPath)) {
  throw new Error(`Cannot prepare GitHub Pages artifact: missing ${indexPath}`);
}

const indexHtml = fs.readFileSync(indexPath, "utf8");
const manifestLinkPattern = /\s*<link\s+rel=["']manifest["'][^>]*manifest\.webmanifest[^>]*>/gi;
const manifestLinks = indexHtml.match(manifestLinkPattern) ?? [];

if (manifestLinks.length === 0) {
  throw new Error(
    `Cannot prepare GitHub Pages artifact: missing manifest.webmanifest link for ${pwaInstallIconRevision}`
  );
}

const canonicalManifestLink = `    <link rel="manifest" href="/people-first-app/manifest.webmanifest?v=${pwaInstallIconRevision}">`;
const cacheBustedIndexHtml = indexHtml
  .replace(manifestLinkPattern, "")
  .replace(
    /\s*<script id=["']vite-plugin-pwa:register-sw["']/,
    '\n  <script id="vite-plugin-pwa:register-sw"'
  )
  .replace(/\s*<\/head>/i, `\n${canonicalManifestLink}\n  </head>`);

const preparedManifestLinks = cacheBustedIndexHtml.match(manifestLinkPattern) ?? [];
if (preparedManifestLinks.length !== 1) {
  throw new Error(
    `Cannot prepare GitHub Pages artifact: expected exactly one manifest link, found ${preparedManifestLinks.length}`
  );
}

if (!preparedManifestLinks[0].includes(`manifest.webmanifest?v=${pwaInstallIconRevision}`)) {
  throw new Error(
    `Cannot prepare GitHub Pages artifact: manifest link must cache-bust with ${pwaInstallIconRevision}`
  );
}

if (cacheBustedIndexHtml !== indexHtml) {
  fs.writeFileSync(indexPath, cacheBustedIndexHtml);
}

const preparedIndexBytes = Buffer.from(cacheBustedIndexHtml, "utf8");
const gzipIndexPath = `${indexPath}.gz`;
if (fs.existsSync(gzipIndexPath)) {
  fs.writeFileSync(gzipIndexPath, gzipSync(preparedIndexBytes, { level: 9 }));
}
const brotliIndexPath = `${indexPath}.br`;
if (fs.existsSync(brotliIndexPath)) {
  fs.writeFileSync(
    brotliIndexPath,
    brotliCompressSync(preparedIndexBytes, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
    })
  );
}

const serviceWorkerPath = path.join(distDir, "sw.js");
if (!fs.existsSync(serviceWorkerPath)) {
  throw new Error(`Cannot prepare GitHub Pages artifact: missing ${serviceWorkerPath}`);
}
const indexRevision = computeWorkboxRevision(preparedIndexBytes);
const serviceWorkerSource = fs.readFileSync(serviceWorkerPath, "utf8");
const updatedServiceWorkerSource = updateIndexPrecacheRevision(serviceWorkerSource, indexRevision);
if (updatedServiceWorkerSource !== serviceWorkerSource) {
  fs.writeFileSync(serviceWorkerPath, updatedServiceWorkerSource);
}

for (const route of routes) {
  const routeDir = path.join(distDir, route);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.copyFileSync(indexPath, path.join(routeDir, "index.html"));
}

fs.writeFileSync(path.join(distDir, ".nojekyll"), "");

const preparedManifest = writePreparedPagesArtifactManifest(distDir, { allowedRoot: root });

console.log(
  `[pages-artifact] Prepared ${routes.length} direct route entrypoints and sealed ${preparedManifest.fileCount} uploadable files`
);
