#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const MAX_APP_ICON_BYTES = 1024 * 1024;
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const PACKAGE_JSON = path.join(ROOT, "package.json");
const ANDROID_MANIFEST = path.join(ROOT, "android", "app", "src", "main", "AndroidManifest.xml");
const ANDROID_BUILD_GRADLE = path.join(ROOT, "android", "app", "build.gradle");
const PUBLIC_APP_ADS = path.join(ROOT, "public", "app-ads.txt");
const APP_ADS_GOOGLE_SELLER_ID = "f08c47fec0942fa0";
const APP_ADS_SAMPLE_PUBLISHER_ID = "pub-3940256099942544";
const FEATURE_WIDTH = 1024;
const FEATURE_HEIGHT = 500;
const FEATURE_SOURCE = path.join(ROOT, "docs", "release", "google-play", "source", "community-aura-feature-source.png");
const LOCALIZED_LISTING_PACKET = path.join(
  ROOT,
  "docs",
  "release",
  "google-play",
  "GOOGLE_PLAY_LOCALIZED_LISTING_PACKET.json",
);
const GOOGLE_PLAY_FIELD_PACKET = path.join(
  ROOT,
  "docs",
  "release",
  "google-play",
  "GOOGLE_PLAY_CONSOLE_FIELD_PACKET.md",
);
const GOOGLE_PLAY_DRAFT_AUDIT = path.join(
  ROOT,
  "docs",
  "release",
  "google-play",
  "GOOGLE_PLAY_DRAFT_COMPLETION_AUDIT.md",
);
const GOOGLE_PLAY_README = path.join(ROOT, "docs", "release", "google-play", "README.md");
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

const REQUIRED_IMAGE_FILES = new Set(REQUIRED.map((expectation) => expectation.file));

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

function assertIncludes(abs, snippets) {
  const source = readIfExists(abs);
  if (!source) {
    fail(`${path.relative(ROOT, abs)} is missing`);
  }
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      fail(`${path.relative(ROOT, abs)} must include ${snippet}`);
    }
  }
}

async function assertFeatureSourceUsable() {
  if (!fs.existsSync(FEATURE_SOURCE)) {
    fail(`${path.relative(ROOT, FEATURE_SOURCE)} is missing`);
  }

  const metadata = await sharp(FEATURE_SOURCE).metadata();
  if (!metadata.width || !metadata.height || metadata.width < FEATURE_WIDTH || metadata.height < FEATURE_HEIGHT) {
    fail(
      `${path.relative(ROOT, FEATURE_SOURCE)} must be at least ${FEATURE_WIDTH}x${FEATURE_HEIGHT}; got ${metadata.width || 0}x${metadata.height || 0}`,
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
  if (!REQUIRED_IMAGE_FILES.has(expectation.file) || path.isAbsolute(expectation.file) || expectation.file.includes("\0")) {
    fail(`Unexpected Google Play image path ${expectation.file}`);
  }
  const normalizedFile = path.normalize(expectation.file);
  if (normalizedFile.startsWith("..") || path.isAbsolute(normalizedFile)) {
    fail(`Google Play image path escapes repo root: ${expectation.file}`);
  }
  const abs = path.resolve(ROOT, normalizedFile); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal - expectation.file is allow-listed and checked to stay inside ROOT above.
  const rootRelative = path.relative(ROOT, abs);
  if (rootRelative.startsWith("..") || path.isAbsolute(rootRelative)) {
    fail(`Google Play image path resolves outside repo root: ${expectation.file}`);
  }
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

  if (packageJson.scripts?.["google-play:app-ads"] !== "node scripts/write-app-ads.cjs") {
    fail("package.json must expose google-play:app-ads so public/app-ads.txt is generated only from the real AdMob publisher id");
  }

  if (packageJson.scripts?.["google-play:app-ads:check"] !== "node scripts/write-app-ads.cjs --check") {
    fail("package.json must expose google-play:app-ads:check for the real AdMob publisher id gate");
  }

  if (packageJson.scripts?.["google-play:app-ads:public-check"] !== "node scripts/check-app-ads-public.cjs") {
    fail("package.json must expose google-play:app-ads:public-check for deployed root-domain app-ads.txt proof");
  }

  if (packageJson.scripts?.["google-play:admob:check"] !== "node scripts/check-admob-production-readiness.cjs") {
    fail("package.json must expose google-play:admob:check for real non-sample AdMob app/ad-unit ids");
  }

  if (packageJson.scripts?.["google-play:public-listing:check"] !== "node scripts/check-google-play-public-listing.cjs") {
    fail("package.json must expose google-play:public-listing:check for public Play ads/developer website proof");
  }

  assertIncludes(GOOGLE_PLAY_FIELD_PACKET, [
    "ZENFLOW_ADMOB_PUBLISHER_ID=pub-0000000000000000 npm run google-play:app-ads",
    "ZENFLOW_ADMOB_PUBLISHER_ID=pub-0000000000000000 npm run google-play:app-ads:check",
    "ZENFLOW_APP_ADS_PUBLIC_URL=https://your-developer-domain.example/app-ads.txt npm run google-play:app-ads:public-check",
    "npm run google-play:public-listing:check",
    "npm run google-play:admob:check",
    "Do not hand-write the file",
    "do not use Google's sample publisher id",
    "Play Console/AdMob",
    "GitHub Pages project subpath",
    "enough proof by itself",
    "Store listing contact details -> website",
    "https://yehor212.github.io/people-first-app/",
    "appstore:developer_url=about:invalid#navigation",
    "public probe",
    "Contains ads",
    "no stale `No ads` claim",
  ]);

  assertIncludes(GOOGLE_PLAY_DRAFT_AUDIT, [
    "ZENFLOW_ADMOB_PUBLISHER_ID=pub-0000000000000000 npm run google-play:app-ads",
    "npm run google-play:app-ads:check",
    "npm run google-play:app-ads:public-check",
    "npm run google-play:public-listing:check",
    "npm run google-play:admob:check",
    "Do not invent this value",
    "Google's sample publisher id",
    "PUBLIC ROOT READY / ADMOB CRAWL PENDING",
    "root of the developer website configured in Play Console/AdMob",
    "appstore:developer_url=about:invalid#navigation",
    "Public Play ads label and copy",
    "PASS / PUBLIC LISTING UPDATED",
    "npm run google-play:public-listing:check",
    "PUBLISHED / ADMOB VERIFY PENDING",
  ]);

  assertIncludes(GOOGLE_PLAY_README, [
    "appstore:developer_url=about:invalid#navigation",
    "Store listing contact details -> website",
    "https://yehor212.github.io/people-first-app/",
    "No ads",
    "Contains ads",
    "google-play:public-listing:check",
    "Verify app",
  ]);

  const androidBuildGradle = readIfExists(ANDROID_BUILD_GRADLE);
  if (!androidBuildGradle) {
    fail("android/app/build.gradle is missing");
  }

  assertIncludes(ANDROID_BUILD_GRADLE, [
    "ZENFLOW_ADMOB_ANDROID_SAMPLE_APP_IDS",
    "gradle.taskGraph.whenReady",
    "throw new GradleException",
    "Release builds require ZENFLOW_ADMOB_ANDROID_APP_ID",
  ]);

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
    console.warn("[google-play-assets] WARN - public/app-ads.txt is missing; run npm run google-play:app-ads with the real AdMob publisher id before production monetization");
    return;
  }

  const trimmed = appAds.trim();
  const match = /^google\.com, (pub-\d{16}), DIRECT, ([a-f0-9]{16})$/i.exec(trimmed);
  if (!match) {
    fail("public/app-ads.txt must contain exactly the AdMob authorized seller line: google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0");
  }
  const [, publisherId, sellerId] = match;
  if (publisherId === APP_ADS_SAMPLE_PUBLISHER_ID) {
    fail("public/app-ads.txt must not use Google's sample AdMob publisher id");
  }
  if (sellerId.toLowerCase() !== APP_ADS_GOOGLE_SELLER_ID) {
    fail(`public/app-ads.txt must use Google's AdMob seller id ${APP_ADS_GOOGLE_SELLER_ID}`);
  }
}

async function main() {
  await assertFeatureSourceUsable();
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
