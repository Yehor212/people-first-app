#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const brandLogoAssets = require("../config/brand-logo-assets.json");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");
const pwaInstallIconRevision = brandLogoAssets.pwaInstallIconRevision;

const routes = ["orb", "habits", "diary", "planning", "settings", "desktop"];

if (!fs.existsSync(indexPath)) {
  throw new Error(`Cannot prepare GitHub Pages artifact: missing ${indexPath}`);
}

const indexHtml = fs.readFileSync(indexPath, "utf8");
const manifestLinkPattern = /\s*<link\s+rel=["']manifest["'][^>]*manifest\.webmanifest[^>]*>/gi;
const manifestLinks = indexHtml.match(manifestLinkPattern) ?? [];

if (manifestLinks.length === 0) {
  throw new Error(
    `Cannot prepare GitHub Pages artifact: missing manifest.webmanifest link for ${pwaInstallIconRevision}`,
  );
}

const canonicalManifestLink =
  `    <link rel="manifest" href="/people-first-app/manifest.webmanifest?v=${pwaInstallIconRevision}">`;
const cacheBustedIndexHtml = indexHtml
  .replace(manifestLinkPattern, "")
  .replace(/\s*<script id=["']vite-plugin-pwa:register-sw["']/, "\n  <script id=\"vite-plugin-pwa:register-sw\"")
  .replace(/\s*<\/head>/i, `\n${canonicalManifestLink}\n  </head>`);

const preparedManifestLinks = cacheBustedIndexHtml.match(manifestLinkPattern) ?? [];
if (preparedManifestLinks.length !== 1) {
  throw new Error(
    `Cannot prepare GitHub Pages artifact: expected exactly one manifest link, found ${preparedManifestLinks.length}`,
  );
}

if (!preparedManifestLinks[0].includes(`manifest.webmanifest?v=${pwaInstallIconRevision}`)) {
  throw new Error(
    `Cannot prepare GitHub Pages artifact: manifest link must cache-bust with ${pwaInstallIconRevision}`,
  );
}

if (cacheBustedIndexHtml !== indexHtml) {
  fs.writeFileSync(indexPath, cacheBustedIndexHtml);
}

for (const route of routes) {
  const routeDir = path.join(distDir, route);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.copyFileSync(indexPath, path.join(routeDir, "index.html"));
}

fs.writeFileSync(path.join(distDir, ".nojekyll"), "");

console.log(
  `[pages-artifact] Prepared ${routes.length} direct route entrypoints and .nojekyll`,
);
