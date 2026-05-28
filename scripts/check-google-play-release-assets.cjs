#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const MAX_APP_ICON_BYTES = 1024 * 1024;
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const PACKAGE_JSON = path.join(ROOT, "package.json");
const ANDROID_MANIFEST = path.join(ROOT, "android", "app", "src", "main", "AndroidManifest.xml");
const PUBLIC_APP_ADS = path.join(ROOT, "public", "app-ads.txt");
const APPROVED_FEATURE_SOURCE = path.join(ROOT, "docs", "release", "google-play", "source", "community-aura-feature-source.png");
const APPROVED_FEATURE_SOURCE_SHA256 = "AA2520C636EEFC8DABF6EC8617CA2C4ACE3B7509B64192973BC57909F334FFE2";
const LOCALIZED_LISTING_PACKET = path.join(
  ROOT,
  "docs",
  "release",
  "google-play",
  "GOOGLE_PLAY_LOCALIZED_LISTING_PACKET.json",
);
const ANDROID_BUILT_RELEASE_MANIFESTS = [
  path.join(ROOT, "android", "app", "build", "intermediates", "merged_manifest", "release", "processReleaseMainManifest", "AndroidManifest.xml"),
  path.join(ROOT, "android", "app", "build", "intermediates", "bundle_manifest", "release", "processApplicationManifestReleaseForBundle", "AndroidManifest.xml"),
];

const FORBIDDEN_NO_ADS_PERMISSION_MARKERS = [
  "com.google.android.gms.permission.AD_ID",
  "android.permission.ACCESS_ADSERVICES_AD_ID",
  "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
  "android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCE",
  "android.permission.ACCESS_ADSERVICES_TOPICS",
];
const REQUIRED_ADS_RUNTIME_MARKERS = [
  "com.google.android.gms.ads.APPLICATION_ID",
];
const REQUIRED_ADS_PERMISSION_MARKERS = [
  "com.google.android.gms.permission.AD_ID",
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

const REQUIRED_LOCALES = ["en-US", "uk-UA", "es-ES", "de-DE", "fr-FR", "ja-JP", "ar-SA", "he-IL"];
const LISTING_LIMITS = {
  appName: 30,
  shortDescription: 80,
  fullDescription: 4000,
  whatsNew: 500,
  featureBullet: 80,
};
const MOJIBAKE_MARKERS = [
  "\uFFFD",
  "Ã",
  "Â",
  "Ð",
  "Ñ",
  "Р°",
  "Рµ",
  "Рё",
  "Рі",
  "Рј",
  "Рѕ",
  "Рї",
  "Рґ",
  "Рє",
  "Р»",
  "Рќ",
  "СЃ",
  "С‚",
  "СЂ",
  "С–",
  "СЊ",
  "СЏ",
  "С”",
  "С€",
  "ГЎ",
  "Г©",
  "Гі",
  "Гј",
  "Г¤",
  "Г¶",
  "ГЁ",
  "Г§",
  "гЃ",
  "гЂ",
  "г‚",
  "гѓ",
  "ж°",
  "зї",
  "иЁ",
  "йќ",
  "Ш§",
  "ШЄ",
  "Ш±",
  "Щ„",
  "Щ…",
  "Чћ",
  "Чў",
  "Ч§",
  "ЧЁ",
  "Ч•",
];

function fail(message) {
  throw new Error(message);
}

function readIfExists(abs) {
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, "utf8");
}

function sha256File(abs) {
  return crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex").toUpperCase();
}

function assertApprovedFeatureSource() {
  if (!fs.existsSync(APPROVED_FEATURE_SOURCE)) {
    fail(`${path.relative(ROOT, APPROVED_FEATURE_SOURCE)} is missing`);
  }
  const actual = sha256File(APPROVED_FEATURE_SOURCE);
  if (actual !== APPROVED_FEATURE_SOURCE_SHA256) {
    fail(
      `Google Play feature source must be the approved image ${APPROVED_FEATURE_SOURCE_SHA256}; got ${actual}`,
    );
  }
}

function assertNoMojibake(value, label) {
  for (const marker of MOJIBAKE_MARKERS) {
    if (value.includes(marker)) {
      fail(`${label} contains likely mojibake marker ${JSON.stringify(marker)}`);
    }
  }
}

function assertTextField(value, label, maxLength) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  assertNoMojibake(value, label);
  const length = Array.from(value).length;
  if (length > maxLength) {
    fail(`${label} exceeds ${maxLength} characters; got ${length}`);
  }
}

function assertLocalizedListingPacket() {
  if (!fs.existsSync(LOCALIZED_LISTING_PACKET)) {
    fail(`${path.relative(ROOT, LOCALIZED_LISTING_PACKET)} is missing`);
  }

  const packet = JSON.parse(fs.readFileSync(LOCALIZED_LISTING_PACKET, "utf8"));
  if (packet.releasePolicy?.draftOnly !== true) {
    fail("Google Play localized listing packet must be draftOnly=true");
  }
  if (packet.releasePolicy?.packageName !== "com.zenflow.app") {
    fail("Google Play localized listing packet must target com.zenflow.app");
  }
  if (packet.releasePolicy?.ads !== "Yes" || packet.releasePolicy?.advertisingId !== "Yes") {
    fail("Google Play localized listing packet must match the current ads/Advertising-ID release");
  }

  const assetPaths = [
    packet.sharedAssets?.appIcon,
    packet.sharedAssets?.featureGraphic,
    ...(packet.sharedAssets?.screenshots || []),
  ];
  for (const rel of assetPaths) {
    if (typeof rel !== "string" || !rel) {
      fail("Google Play localized listing packet contains an invalid shared asset path");
    }
    if (!fs.existsSync(path.join(ROOT, rel))) {
      fail(`Google Play localized listing packet points at missing asset ${rel}`);
    }
  }

  const locales = packet.locales || {};
  const actualLocales = Object.keys(locales).sort();
  const expectedLocales = [...REQUIRED_LOCALES].sort();
  if (JSON.stringify(actualLocales) !== JSON.stringify(expectedLocales)) {
    fail(`Google Play localized listing packet locales must be ${expectedLocales.join(", ")}; got ${actualLocales.join(", ")}`);
  }

  for (const locale of REQUIRED_LOCALES) {
    const listing = locales[locale];
    if (!listing || typeof listing !== "object") {
      fail(`Google Play localized listing packet is missing ${locale}`);
    }
    assertTextField(listing.languageName, `${locale}.languageName`, 80);
    assertTextField(listing.appName, `${locale}.appName`, LISTING_LIMITS.appName);
    assertTextField(listing.shortDescription, `${locale}.shortDescription`, LISTING_LIMITS.shortDescription);
    assertTextField(listing.fullDescription, `${locale}.fullDescription`, LISTING_LIMITS.fullDescription);
    assertTextField(listing.whatsNew, `${locale}.whatsNew`, LISTING_LIMITS.whatsNew);
    if (!Array.isArray(listing.featureBullets) || listing.featureBullets.length < 3 || listing.featureBullets.length > 5) {
      fail(`${locale}.featureBullets must contain 3-5 items`);
    }
    listing.featureBullets.forEach((bullet, index) => {
      assertTextField(bullet, `${locale}.featureBullets[${index}]`, LISTING_LIMITS.featureBullet);
    });
  }

  return packet;
}

function hasPermissionRemoval(manifest, permission) {
  const tags = manifest.match(/<uses-permission\b[\s\S]*?\/?>/g) || [];
  return tags.some(
    (tag) =>
      (tag.includes(`android:name="${permission}"`) || tag.includes(`android:name='${permission}'`)) &&
      (tag.includes('tools:node="remove"') || tag.includes("tools:node='remove'")),
  );
}

function hasPermissionDeclaration(manifest, permission) {
  const tags = manifest.match(/<uses-permission\b[\s\S]*?\/?>/g) || [];
  return tags.some(
    (tag) =>
      (tag.includes(`android:name="${permission}"`) || tag.includes(`android:name='${permission}'`)) &&
      !(tag.includes('tools:node="remove"') || tag.includes("tools:node='remove'")),
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

function assertAdDeclarationMatchesArtifact(packet) {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const hasAdMobDependency = Boolean(deps["@capacitor-community/admob"]);

  if (packet.releasePolicy?.ads !== "Yes" || packet.releasePolicy?.advertisingId !== "Yes") {
    fail("Google Play packet must declare Ads=Yes and Advertising ID=Yes for this AdMob release path");
  }

  if (!hasAdMobDependency) {
    fail("@capacitor-community/admob must be installed for the current ads release path");
  }

  const sourceManifest = readIfExists(ANDROID_MANIFEST);
  if (!sourceManifest) {
    fail("android/app/src/main/AndroidManifest.xml is missing");
  }

  for (const marker of REQUIRED_ADS_RUNTIME_MARKERS) {
    if (!sourceManifest.includes(marker)) {
      fail(`${path.relative(ROOT, ANDROID_MANIFEST)} must declare ${marker} for the AdMob release path`);
    }
  }

  for (const permission of REQUIRED_ADS_PERMISSION_MARKERS) {
    if (!hasPermissionDeclaration(sourceManifest, permission)) {
      fail(`${path.relative(ROOT, ANDROID_MANIFEST)} must declare ${permission} for the current ads/Advertising-ID release`);
    }
  }

  for (const permission of FORBIDDEN_NO_ADS_PERMISSION_MARKERS) {
    if (hasPermissionRemoval(sourceManifest, permission)) {
      fail(`${path.relative(ROOT, ANDROID_MANIFEST)} still removes ${permission}; remove tools:node="remove" for the ads release path`);
    }
  }

  for (const manifestPath of ANDROID_BUILT_RELEASE_MANIFESTS) {
    const manifest = readIfExists(manifestPath);
    if (!manifest) continue;
    for (const marker of REQUIRED_ADS_RUNTIME_MARKERS) {
      if (!manifest.includes(marker)) {
        fail(`${path.relative(ROOT, manifestPath)} must contain ${marker}; run the Android release manifest step after ad changes`);
      }
    }
    for (const permission of REQUIRED_ADS_PERMISSION_MARKERS) {
      if (!hasPermissionDeclaration(manifest, permission)) {
        fail(`${path.relative(ROOT, manifestPath)} must contain ${permission}; Play Console Advertising ID=Yes would be unverified`);
      }
    }
  }

  const appAds = readIfExists(PUBLIC_APP_ADS);
  if (!appAds) {
    console.warn("[google-play-assets] WARN - public/app-ads.txt is missing; add the real AdMob publisher line before production monetization");
  }
}

async function main() {
  assertApprovedFeatureSource();
  for (const expectation of REQUIRED) {
    await assertImage(expectation);
  }
  const packet = assertLocalizedListingPacket();
  assertAdDeclarationMatchesArtifact(packet);
  console.log(`[google-play-assets] PASS - ${REQUIRED.length} Play Console assets and ${REQUIRED_LOCALES.length} localized listings verified`);
}

main().catch((error) => {
  console.error(`[google-play-assets] FAIL - ${error.message}`);
  process.exit(1);
});
