#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.resolve(ROOT, process.env.ZENFLOW_DIST_DIR || "dist");
const SOURCE_MAP_REFERENCE_PATTERN = /sourceMappingURLs*=/;
const REFERENCE_EXTENSIONS = new Set([".html", ".js", ".mjs", ".css"]);
const MAX_LISTED_FILES = 20;

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/") || ".";
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(target, files);
    } else if (entry.isFile()) {
      files.push(target);
    }
  }
  return files;
}

function finish(status, message, exitCode, details = []) {
  console.log("[sentry-artifacts] " + status + " - " + message);
  for (const detail of details.slice(0, MAX_LISTED_FILES)) {
    console.log("[sentry-artifacts] " + detail);
  }
  if (details.length > MAX_LISTED_FILES) {
    console.log("[sentry-artifacts] ... " + (details.length - MAX_LISTED_FILES) + " more file(s)");
  }
  process.exit(exitCode);
}

if (!fs.existsSync(DIST_DIR) || !fs.statSync(DIST_DIR).isDirectory()) {
  finish("UNVERIFIED", "dist directory is missing: " + relative(DIST_DIR), 2);
}

const files = walk(DIST_DIR);
const publicMaps = files.filter((file) => file.endsWith(".map"));
const sourceMappingUrlFiles = [];

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (!REFERENCE_EXTENSIONS.has(ext)) continue;

  const source = fs.readFileSync(file, "utf8");
  if (SOURCE_MAP_REFERENCE_PATTERN.test(source)) {
    sourceMappingUrlFiles.push(file);
  }
}

if (publicMaps.length > 0 || sourceMappingUrlFiles.length > 0) {
  const details = [
    ...publicMaps.map((file) => "public .map: " + relative(file)),
    ...sourceMappingUrlFiles.map((file) => "sourceMappingURL: " + relative(file)),
  ];
  finish(
    "FAIL",
    "production artifact exposes source-map files or references",
    1,
    details,
  );
}

finish(
  "PASS",
  "checked " + files.length + " public artifact file(s); publicMaps=0; sourceMappingURL=0",
  0,
);
