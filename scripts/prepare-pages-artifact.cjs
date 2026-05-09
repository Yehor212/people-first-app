#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");

const routes = ["orb", "habits", "diary", "settings"];

if (!fs.existsSync(indexPath)) {
  throw new Error(`Cannot prepare GitHub Pages artifact: missing ${indexPath}`);
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
