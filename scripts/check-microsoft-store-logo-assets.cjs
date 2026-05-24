#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "docs", "release", "microsoft-store", "assets", "official-logo");
const MANIFEST = path.join(DIR, "zenflow-official-store-assets-manifest.json");
const MAX_BYTES = 50 * 1024 * 1024;
const MIN_STORE_LOCKUP_CLEAR_SPACE_RATIO = 0.045;

const REQUIRED = [
  ["zenflow-official-logo-source-1024.png", 1024, 1024],
  ["zenflow-official-app-tile-icon-300.png", 300, 300],
  ["zenflow-official-app-tile-icon-150.png", 150, 150],
  ["zenflow-official-app-tile-icon-71.png", 71, 71],
  ["zenflow-official-box-art-1080.png", 1080, 1080],
  ["zenflow-official-box-art-2160.png", 2160, 2160],
  ["zenflow-official-poster-art-720x1080.png", 720, 1080],
  ["zenflow-official-poster-art-1440x2160.png", 1440, 2160],
  ["zenflow-official-super-hero-art-1920x1080.png", 1920, 1080],
];

const failures = [];

function fail(message) {
  failures.push(message);
}

async function inspectImage(file, width, height) {
  const filePath = path.join(DIR, file);
  if (!fs.existsSync(filePath)) {
    fail(`${file} is missing`);
    return;
  }
  const stat = fs.statSync(filePath);
  if (stat.size <= 0 || stat.size > MAX_BYTES) {
    fail(`${file} size is outside Store limits: ${stat.size}`);
  }

  const image = sharp(filePath).ensureAlpha();
  const metadata = await image.metadata();
  if (metadata.width !== width || metadata.height !== height) {
    fail(`${file} is ${metadata.width}x${metadata.height}, expected ${width}x${height}`);
  }

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  let cornerAlpha = 0;
  let cornerPixels = 0;
  const corner = Math.max(2, Math.floor(Math.min(info.width, info.height) * 0.06));
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      const a = data[i + 3];
      if ((x < corner && y < corner) || (x >= info.width - corner && y < corner) || (x < corner && y >= info.height - corner) || (x >= info.width - corner && y >= info.height - corner)) {
        cornerAlpha += a;
        cornerPixels += 1;
      }
    }
  }

  const cornerAlphaAvg = cornerAlpha / Math.max(1, cornerPixels);
  if ((file.includes("tile-icon") || file.includes("logo-source")) && cornerAlphaAvg > 24) {
    fail(`${file} has too much opaque corner area (${cornerAlphaAvg.toFixed(1)}); app tile should not read as a hard square`);
  }

}

async function main() {
  if (!fs.existsSync(MANIFEST)) {
    fail("official logo manifest is missing");
  } else {
    const text = fs.readFileSync(MANIFEST, "utf8");
    for (const expected of [
      "scripts/generate-microsoft-store-logo-assets.cjs",
      "No SVG filters",
      "Golden-ratio proportions",
      "Runtime canonical WebGL orbs are not changed",
    ]) {
      if (!text.includes(expected)) fail(`manifest does not mention ${expected}`);
    }
    try {
      const manifest = JSON.parse(text);
      const composition = manifest.composition || {};
      for (const key of ["squareArt", "posterArt"]) {
        const ratio = composition[key]?.iconTitleClearSpaceRatio;
        if (typeof ratio !== "number" || ratio < MIN_STORE_LOCKUP_CLEAR_SPACE_RATIO) {
          fail(`manifest ${key} icon/title clear-space must be at least ${MIN_STORE_LOCKUP_CLEAR_SPACE_RATIO}; got ${ratio}`);
        }
      }
    } catch (error) {
      fail(`official logo manifest is not valid JSON: ${error.message}`);
    }
  }

  const sourceSvg = fs.readFileSync(path.join(ROOT, "public", "icon-source.svg"), "utf8");
  if (sourceSvg.includes("<filter") || sourceSvg.includes("filter=")) {
    fail("public/icon-source.svg must not use SVG filters; filters caused square shader artifacts");
  }

  for (const [file, width, height] of REQUIRED) {
    await inspectImage(file, width, height);
  }

  if (failures.length > 0) {
    console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
    process.exit(1);
  }

  console.log(`Microsoft Store logo asset gate passed for ${REQUIRED.length} PNG files`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
