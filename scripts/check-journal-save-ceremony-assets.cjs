#!/usr/bin/env node
"use strict";

const { createHash } = require("node:crypto");
const { lstatSync, readFileSync, realpathSync } = require("node:fs");
const { resolve, sep } = require("node:path");
const { gunzipSync } = require("node:zlib");

const projectRoot = resolve(__dirname, "..");
const assetRootArgumentIndex = process.argv.indexOf("--asset-root");
const assetRoot =
  assetRootArgumentIndex >= 0 && process.argv[assetRootArgumentIndex + 1]
    ? resolve(process.argv[assetRootArgumentIndex + 1])
    : resolve(projectRoot, "src/assets/journal/save-ceremony");
const manifestPath = resolve(assetRoot, "manifest.json");
const APPROVED_ASSET_TRUST_ANCHOR = Object.freeze({
  "atelier-v12-3-night.tgs": Object.freeze({
    bytes: 37872,
    sha256: "7047a29d245c165315d49f3de5102c37406b78a9b5a95437ca20fa5db1d2bc28",
  }),
  "atelier-v12-3-day.tgs": Object.freeze({
    bytes: 37779,
    sha256: "a55c998596f8210664d51f8eb51eb40a090dbc4dc76d8ea7109cdd30098d1170",
  }),
  "atelier-v12-3-night-reduced.svg": Object.freeze({
    bytes: 112948,
    sha256: "35d097507bcbcd4198fb1717ddce63253a69fec3ff01eaf598fe24648aab6c61",
  }),
  "atelier-v12-3-day-reduced.svg": Object.freeze({
    bytes: 118821,
    sha256: "7aaac329edc6efcf4a7898b6aa8a7abec6c23311c62c046444d0a8694d95a9e6",
  }),
});

function fail(message) {
  process.stderr.write(`[journal-save-ceremony-assets] ${message}\n`);
  process.exit(1);
}

function assertBoundedRegularFile(filePath) {
  const stat = lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`${filePath} must be a regular non-symlink file`);
  }
  const real = realpathSync(filePath);
  if (!real.startsWith(`${realpathSync(assetRoot)}${sep}`)) {
    fail(`${filePath} resolves outside the approved asset directory`);
  }
}

function walkAnimation(value, visit) {
  if (Array.isArray(value)) {
    value.forEach((entry) => walkAnimation(entry, visit));
    return;
  }
  if (!value || typeof value !== "object") return;
  visit(value);
  Object.values(value).forEach((entry) => walkAnimation(entry, visit));
}

function validateTgs(bytes, label) {
  let animation;
  try {
    animation = JSON.parse(gunzipSync(bytes).toString("utf8"));
  } catch {
    fail(`${label} is not valid gzip-compressed Lottie JSON`);
  }
  if (
    animation.w !== 512 ||
    animation.h !== 512 ||
    animation.fr !== 60 ||
    animation.ip !== 0 ||
    animation.op !== 180 ||
    animation.ddd !== 0 ||
    !Array.isArray(animation.layers)
  ) {
    fail(`${label} does not match the approved 512x512/60fps/180-frame contract`);
  }
  if ((animation.assets?.length ?? 0) > 0 || animation.chars || animation.fonts) {
    fail(`${label} contains external assets, characters, or fonts`);
  }

  walkAnimation(animation, (node) => {
    if (typeof node.x === "string" || typeof node.expression === "string") {
      fail(`${label} contains an expression`);
    }
    if (node.ddd && node.ddd !== 0) fail(`${label} contains a 3D layer`);
    if (Array.isArray(node.masksProperties) && node.masksProperties.length > 0) {
      fail(`${label} contains a mask`);
    }
    if (Array.isArray(node.ef) && node.ef.length > 0) {
      fail(`${label} contains an effect`);
    }
    if (typeof node.ty === "number" && ![3, 4].includes(node.ty)) {
      fail(`${label} contains a non-vector layer type ${node.ty}`);
    }
    if (typeof node.ty === "string" && ["gs", "mm", "rp", "sr"].includes(node.ty)) {
      fail(`${label} contains a forbidden shape primitive ${node.ty}`);
    }
    if (typeof node.sr === "number" && node.sr !== 1) {
      fail(`${label} contains time stretch`);
    }
    if (Object.hasOwn(node, "tm") && typeof node.ty === "number") {
      fail(`${label} contains layer time remapping`);
    }
  });
}

function validateSvg(bytes, label) {
  const source = bytes.toString("utf8");
  if (
    !source.includes("<svg") ||
    /<script\b|javascript:|(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/|data:)/i.test(
      source,
    )
  ) {
    fail(`${label} is not a self-contained inert SVG`);
  }
}

let manifest;
try {
  assertBoundedRegularFile(manifestPath);
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(`manifest is unavailable or invalid: ${error.message}`);
}

if (
  manifest.schemaVersion !== 1 ||
  manifest.model !== "Atelier V12.3" ||
  manifest.sourcePolicy !== "hash-bound-local-build-assets"
) {
  fail("manifest identity is not approved");
}

const records = [];
for (const variant of ["night", "day"]) {
  const entry = manifest.assets?.[variant];
  if (!entry?.tgs || !entry?.reduced) fail(`manifest is missing ${variant}`);
  records.push({ ...entry.tgs, kind: "tgs", variant });
  records.push({ ...entry.reduced, kind: "svg", variant });
}

const relativePaths = new Set();
for (const record of records) {
  if (
    typeof record.file !== "string" ||
    record.file.includes("/") ||
    relativePaths.has(record.file)
  ) {
    fail("asset paths must be unique bounded filenames");
  }
  relativePaths.add(record.file);
  const trusted = APPROVED_ASSET_TRUST_ANCHOR[record.file];
  if (
    !trusted ||
    trusted.bytes !== record.bytes ||
    trusted.sha256 !== record.sha256
  ) {
    fail(`${record.file} does not match the independent trust anchor`);
  }
  const filePath = resolve(assetRoot, record.file);
  assertBoundedRegularFile(filePath);
  const bytes = readFileSync(filePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== record.bytes || sha256 !== record.sha256) {
    fail(`${record.file} differs from the approved byte/hash record`);
  }
  if (record.kind === "tgs") validateTgs(bytes, record.file);
  else validateSvg(bytes, record.file);
}

process.stdout.write(
  `[journal-save-ceremony-assets] ${records.length} hash-bound assets verified\n`,
);
