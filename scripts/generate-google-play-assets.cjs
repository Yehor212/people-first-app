#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "release", "google-play", "assets");
const SCREENSHOT_OUT = path.join(ROOT, "docs", "release", "google-play", "screenshots", "desktop");

const COPY_SCREENSHOTS = [
  ["docs/release/microsoft-store/store-screenshots/desktop/01-v2-orb-desktop.png", "01-v2-orb-desktop.png"],
  ["docs/release/microsoft-store/store-screenshots/desktop/02-v2-habits-desktop.png", "02-v2-habits-desktop.png"],
  ["docs/release/microsoft-store/store-screenshots/desktop/03-v2-diary-desktop.png", "03-v2-diary-desktop.png"],
];

const FEATURE_WIDTH = 1024;
const FEATURE_HEIGHT = 500;
const COMMUNITY_AURA_SOURCE = path.join(
  ROOT,
  "docs",
  "release",
  "google-play",
  "source",
  "community-aura-feature-source.png",
);

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

async function writeAppIcon() {
  const output = path.join(OUT, "google-play-app-icon-512.png");
  ensureDir(output);
  await sharp(path.join(ROOT, "public", "icon-512.png"))
    .ensureAlpha(1)
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function writeFeatureGraphic() {
  const output = path.join(OUT, "google-play-feature-graphic-1024x500.png");
  ensureDir(output);
  if (!fs.existsSync(COMMUNITY_AURA_SOURCE)) {
    throw new Error("Google Play feature graphic source is missing");
  }

  const metadata = await sharp(COMMUNITY_AURA_SOURCE).metadata();
  if (!metadata.width || !metadata.height || metadata.width < FEATURE_WIDTH || metadata.height < FEATURE_HEIGHT) {
    throw new Error(
      `Google Play feature graphic source must be at least ${FEATURE_WIDTH}x${FEATURE_HEIGHT}; got ${metadata.width || 0}x${metadata.height || 0}`,
    );
  }

  await sharp(COMMUNITY_AURA_SOURCE)
    .resize(FEATURE_WIDTH, FEATURE_HEIGHT, { fit: "cover", position: "center" })
    .flatten({ background: "#071513" })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function writeDesktopScreenshots() {
  for (const [source, target] of COPY_SCREENSHOTS) {
    const output = path.join(SCREENSHOT_OUT, target);
    ensureDir(output);
    await sharp(path.join(ROOT, source))
      .flatten({ background: "#071513" })
      .png({ compressionLevel: 9 })
      .toFile(output);
  }
}

async function main() {
  await writeAppIcon();
  await writeFeatureGraphic();
  await writeDesktopScreenshots();
  console.log("[google-play-assets] generated app icon, feature graphic, and desktop screenshot pack");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
