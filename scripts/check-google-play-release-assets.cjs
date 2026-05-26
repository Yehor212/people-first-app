#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const MAX_APP_ICON_BYTES = 1024 * 1024;
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const PACKAGE_JSON = path.join(ROOT, "package.json");
const ANDROID_MANIFEST = path.join(ROOT, "android", "app", "src", "main", "AndroidManifest.xml");
const GOOGLE_SERVICES_JSON = path.join(ROOT, "android", "app", "google-services.json");
const PUBLIC_APP_ADS = path.join(ROOT, "public", "app-ads.txt");
const ANDROID_BUILT_RELEASE_MANIFESTS = [
  path.join(ROOT, "android", "app", "build", "intermediates", "merged_manifest", "release", "processReleaseMainManifest", "AndroidManifest.xml"),
  path.join(ROOT, "android", "app", "build", "intermediates", "bundle_manifest", "release", "processApplicationManifestReleaseForBundle", "AndroidManifest.xml"),
];

const FORBIDDEN_NO_ADS_RUNTIME_MARKERS = [
  "com.google.android.gms.ads.APPLICATION_ID",
  "com.google.android.gms.ads.",
];

const FORBIDDEN_NO_ADS_PERMISSION_MARKERS = [
  "com.google.android.gms.permission.AD_ID",
  "android.permission.ACCESS_ADSERVICES_AD_ID",
  "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
  "android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCE",
  "android.permission.ACCESS_ADSERVICES_TOPICS",
];

const REQUIRED = [
  {
    file: "docs/release/google-play/assets/google-play-app-icon-512.png",
    width: 512,
    height: 512,
    maxBytes: MAX_APP_ICON_BYTES,
    alpha: "opaque-alpha",
  },
  {
    file: "docs/release/google-play/assets/google-play-feature-graphic-1024x500.png",
    width: 1024,
    height: 500,
    alpha: "opaque",
  },
  ...[
    "01-v2-orb-desktop.png",
    "02-v2-habits-desktop.png",
    "03-v2-diary-desktop.png",
  ].map((file) => ({
    file: `docs/release/google-play/screenshots/desktop/${file}`,
    width: 1440,
    height: 900,
    maxBytes: MAX_SCREENSHOT_BYTES,
    alpha: "opaque",
    screenshot: true,
  })),
];

function fail(message) {
  throw new Error(message);
}

function readIfExists(abs) {
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, "utf8");
}

function hasPermissionRemoval(manifest, permission) {
  const tags = manifest.match(/<uses-permission\b[\s\S]*?\/?>/g) || [];
  return tags.some(
    (tag) =>
      (tag.includes(`android:name="${permission}"`) || tag.includes(`android:name='${permission}'`)) &&
      (tag.includes('tools:node="remove"') || tag.includes("tools:node='remove'")),
  );
}

async function hasOnlyOpaqueAlpha(abs) {
  const image = sharp(abs);
  const metadata = await image.metadata();
  if (!metadata.hasAlpha) return false;
  const raw = await image.ensureAlpha().raw().toBuffer();
  for (let i = 3; i < raw.length; i += 4) {
    if (raw[i] !== 255) return false;
  }
  return true;
}

async function assertOpaque(abs) {
  const metadata = await sharp(abs).metadata();
  if (!metadata.hasAlpha) return;
  if (!(await hasOnlyOpaqueAlpha(abs))) {
    fail(`${path.relative(ROOT, abs)} must not contain transparent pixels`);
  }
}

async function assertImage(expectation) {
  const abs = path.join(ROOT, expectation.file);
  if (!fs.existsSync(abs)) fail(`${expectation.file} is missing`);

  const metadata = await sharp(abs).metadata();
  if (metadata.format !== "png") fail(`${expectation.file} must be a PNG`);
  if (metadata.width !== expectation.width || metadata.height !== expectation.height) {
    fail(`${expectation.file} must be ${expectation.width}x${expectation.height}; got ${metadata.width}x${metadata.height}`);
  }
  if (expectation.alpha === "opaque-alpha" && !(await hasOnlyOpaqueAlpha(abs))) {
    fail(`${expectation.file} must be a 32-bit PNG with a fully opaque alpha channel for Google Play`);
  }
  if (expectation.alpha === "opaque") {
    await assertOpaque(abs);
  }
  if (expectation.maxBytes && fs.statSync(abs).size > expectation.maxBytes) {
    fail(`${expectation.file} exceeds ${expectation.maxBytes} bytes`);
  }
  if (expectation.screenshot) {
    const min = Math.min(metadata.width, metadata.height);
    const max = Math.max(metadata.width, metadata.height);
    if (min < 320 || max > 3840 || max > min * 2) {
      fail(`${expectation.file} violates Google Play screenshot dimension ratio limits`);
    }
  }
}

function assertAdDeclarationMatchesArtifact() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const hasAdMobDependency = Boolean(deps["@capacitor-community/admob"]);

  if (hasAdMobDependency) {
    fail("@capacitor-community/admob is installed, but this Google Play packet is declared as no ads");
  }

  const sourceManifest = readIfExists(ANDROID_MANIFEST);
  if (!sourceManifest) {
    fail("android/app/src/main/AndroidManifest.xml is missing");
  }

  for (const marker of FORBIDDEN_NO_ADS_RUNTIME_MARKERS) {
    if (sourceManifest.includes(marker)) {
      fail(`${path.relative(ROOT, ANDROID_MANIFEST)} contains ${marker}; no-ads release must not declare ad runtime metadata`);
    }
  }

  for (const permission of FORBIDDEN_NO_ADS_PERMISSION_MARKERS) {
    if (!hasPermissionRemoval(sourceManifest, permission)) {
      fail(`${path.relative(ROOT, ANDROID_MANIFEST)} must remove ${permission} with tools:node="remove" for the current no-ads/no-Advertising-ID release`);
    }
  }

  const forbiddenBuiltMarkers = [
    ...FORBIDDEN_NO_ADS_RUNTIME_MARKERS,
    ...FORBIDDEN_NO_ADS_PERMISSION_MARKERS,
  ];

  for (const manifestPath of ANDROID_BUILT_RELEASE_MANIFESTS) {
    const manifest = readIfExists(manifestPath);
    if (!manifest) continue;
    for (const marker of forbiddenBuiltMarkers) {
      if (manifest.includes(marker)) {
        fail(`${path.relative(ROOT, manifestPath)} contains ${marker}; no-ads/no-Advertising-ID release is not truthful`);
      }
    }
  }

  const googleServices = readIfExists(GOOGLE_SERVICES_JSON);
  if (googleServices && /"admob_app_id"\s*:/.test(googleServices)) {
    fail("android/app/google-services.json contains admob_app_id; remove it for the current no-ads release");
  }

  const appAds = readIfExists(PUBLIC_APP_ADS);
  if (appAds) {
    const sellerLines = appAds
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    if (sellerLines.length > 0) {
      fail("public/app-ads.txt contains ad seller lines; remove it for the current no-ads release");
    }
  }
}

async function main() {
  for (const expectation of REQUIRED) {
    await assertImage(expectation);
  }
  assertAdDeclarationMatchesArtifact();
  console.log(`[google-play-assets] PASS - ${REQUIRED.length} Play Console assets verified`);
}

main().catch((error) => {
  console.error(`[google-play-assets] FAIL - ${error.message}`);
  process.exit(1);
});
