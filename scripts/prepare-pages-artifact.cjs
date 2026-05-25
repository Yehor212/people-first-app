#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");
const pwaInstallIconRevision = "zenflow-browser-leaf-20260525-r5";

const routes = ["orb", "habits", "diary", "settings", "desktop"];

if (!fs.existsSync(indexPath)) {
  throw new Error(`Cannot prepare GitHub Pages artifact: missing ${indexPath}`);
}

const indexHtml = fs.readFileSync(indexPath, "utf8");
const cacheBustedIndexHtml = indexHtml.replace(
  /(<link\s+rel=["']manifest["']\s+href=["'][^"']*manifest\.webmanifest)(?:\?[^"']*)?(["'][^>]*>)/i,
  `$1?v=${pwaInstallIconRevision}$2`,
);

if (!cacheBustedIndexHtml.includes(`manifest.webmanifest?v=${pwaInstallIconRevision}`)) {
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
