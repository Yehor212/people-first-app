#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const MAX_STORE_BYTES = 50 * 1024 * 1024;
const PWA_INSTALL_ICON_REVISION = "zenflow-browser-leaf-20260524-r3";
const CLASSIC_LEAF_BODY = "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z";
const CLASSIC_LEAF_STEM = "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12";
const REJECTED_FLOW_LEAF_BODY = "M4.2 20.1C3.4 14.2 5.8 8.3 10.5 5.1c3.6-2.5 7.9-2.5 10.9-3.1.3 4.8-.5 9.3-3.8 12.8-3.5 3.7-8.7 5.7-13.4 5.3Z";
const REJECTED_FLOW_LEAF_FLOW = "M8.4 14.4c2.4 1.1 5.8.4 8.6-2.9";

const IMAGE_EXPECTATIONS = [
  ...[16, 32, 48, 64].flatMap((size) => [
    { file: `public/favicon-${size}.png`, width: size, height: size, alpha: "allowed" },
    { file: `docs/favicon-${size}.png`, width: size, height: size, alpha: "allowed" },
  ]),
  ...[72, 96, 128, 144, 152, 192, 384, 512].map((size) => ({
    file: `public/pwa-${size}.png`,
    width: size,
    height: size,
    alpha: "allowed",
  })),
  ...[72, 96, 128, 144, 152, 192, 384, 512].map((size) => ({
    file: `docs/pwa-${size}.png`,
    width: size,
    height: size,
    alpha: "allowed",
  })),
  { file: "public/pwa-maskable-512.png", width: 512, height: 512, alpha: "opaque" },
  { file: "docs/pwa-maskable-512.png", width: 512, height: 512, alpha: "opaque" },
  ...[
    ["pwa-windows-44.png", 44, 44, "allowed"],
    ["pwa-windows-50.png", 50, 50, "allowed"],
    ["pwa-windows-71.png", 71, 71, "allowed"],
    ["pwa-windows-150.png", 150, 150, "allowed"],
    ["pwa-windows-310.png", 310, 310, "allowed"],
    ["pwa-windows-wide-310x150.png", 310, 150, "opaque"],
    ["pwa-windows-splash-620x300.png", 620, 300, "opaque"],
  ].flatMap(([file, width, height, alpha]) => [
    { file: `public/${file}`, width, height, alpha },
    { file: `docs/${file}`, width, height, alpha },
  ]),
  { file: "public/apple-touch-icon.png", width: 180, height: 180, alpha: "opaque" },
  { file: "docs/apple-touch-icon.png", width: 180, height: 180, alpha: "opaque" },
  { file: "public/icon-512.png", width: 512, height: 512, alpha: "opaque" },
  { file: "docs/icon-512.png", width: 512, height: 512, alpha: "opaque" },
  { file: "public/feature-graphic.png", width: 1024, height: 500, alpha: "opaque" },
  { file: "public/feature-graphic.webp", width: 1024, height: 500, alpha: "opaque" },
  { file: "public/og-image.png", width: 1200, height: 630, alpha: "opaque" },
  ...[
    ["32x32.png", 32],
    ["64x64.png", 64],
    ["128x128.png", 128],
    ["128x128@2x.png", 256],
    ["512x512.png", 512],
    ["icon.png", 512],
    ["Square30x30Logo.png", 30],
    ["Square44x44Logo.png", 44],
    ["Square71x71Logo.png", 71],
    ["Square89x89Logo.png", 89],
    ["Square107x107Logo.png", 107],
    ["Square142x142Logo.png", 142],
    ["Square150x150Logo.png", 150],
    ["Square284x284Logo.png", 284],
    ["Square310x310Logo.png", 310],
    ["StoreLogo.png", 50],
  ].map(([file, size]) => ({ file: `src-tauri/icons/${file}`, width: size, height: size, alpha: "allowed" })),
  ...[
    ["mipmap-mdpi", 48],
    ["mipmap-hdpi", 72],
    ["mipmap-xhdpi", 96],
    ["mipmap-xxhdpi", 144],
    ["mipmap-xxxhdpi", 192],
  ].flatMap(([folder, size]) => [
    { file: `android/app/src/main/res/${folder}/ic_launcher.png`, width: size, height: size, alpha: "opaque" },
    { file: `android/app/src/main/res/${folder}/ic_launcher_round.png`, width: size, height: size, alpha: "opaque" },
    { file: `android/app/src/main/res/${folder}/ic_launcher_foreground.png`, width: size, height: size, alpha: "allowed" },
    { file: `src-tauri/icons/android/${folder}/ic_launcher.png`, width: size, height: size, alpha: "opaque" },
    { file: `src-tauri/icons/android/${folder}/ic_launcher_round.png`, width: size, height: size, alpha: "opaque" },
    { file: `src-tauri/icons/android/${folder}/ic_launcher_foreground.png`, width: size, height: size, alpha: "allowed" },
  ]),
  ...[
    ["drawable/splash.png", 480, 320],
    ["drawable-land-hdpi/splash.png", 800, 480],
    ["drawable-land-mdpi/splash.png", 480, 320],
    ["drawable-land-xhdpi/splash.png", 1280, 720],
    ["drawable-land-xxhdpi/splash.png", 1600, 960],
    ["drawable-land-xxxhdpi/splash.png", 1920, 1280],
    ["drawable-port-hdpi/splash.png", 480, 800],
    ["drawable-port-mdpi/splash.png", 320, 480],
    ["drawable-port-xhdpi/splash.png", 720, 1280],
    ["drawable-port-xxhdpi/splash.png", 960, 1600],
    ["drawable-port-xxxhdpi/splash.png", 1280, 1920],
  ].map(([file, width, height]) => ({
    file: `android/app/src/main/res/${file}`,
    width,
    height,
    alpha: "opaque",
    darkSplash: true,
  })),
  { file: "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", width: 1024, height: 1024, alpha: "opaque" },
  ...["splash-2732x2732-2.png", "splash-2732x2732-1.png", "splash-2732x2732.png"].map((file) => ({
    file: `ios/App/App/Assets.xcassets/Splash.imageset/${file}`,
    width: 2732,
    height: 2732,
    alpha: "opaque",
    darkSplash: true,
  })),
  { file: "docs/release/microsoft-store/assets/official-logo/zenflow-official-logo-source-1024.png", width: 1024, height: 1024, alpha: "allowed", maxBytes: MAX_STORE_BYTES },
  { file: "docs/release/microsoft-store/assets/official-logo/zenflow-official-app-tile-icon-300.png", width: 300, height: 300, alpha: "allowed", maxBytes: MAX_STORE_BYTES },
  { file: "docs/release/microsoft-store/assets/official-logo/zenflow-official-app-tile-icon-150.png", width: 150, height: 150, alpha: "allowed", maxBytes: MAX_STORE_BYTES },
  { file: "docs/release/microsoft-store/assets/official-logo/zenflow-official-app-tile-icon-71.png", width: 71, height: 71, alpha: "allowed", maxBytes: MAX_STORE_BYTES },
  { file: "docs/release/microsoft-store/assets/official-logo/zenflow-official-box-art-1080.png", width: 1080, height: 1080, alpha: "opaque", maxBytes: MAX_STORE_BYTES },
  { file: "docs/release/microsoft-store/assets/official-logo/zenflow-official-box-art-2160.png", width: 2160, height: 2160, alpha: "opaque", maxBytes: MAX_STORE_BYTES },
  { file: "docs/release/microsoft-store/assets/official-logo/zenflow-official-poster-art-720x1080.png", width: 720, height: 1080, alpha: "opaque", maxBytes: MAX_STORE_BYTES },
  { file: "docs/release/microsoft-store/assets/official-logo/zenflow-official-poster-art-1440x2160.png", width: 1440, height: 2160, alpha: "opaque", maxBytes: MAX_STORE_BYTES },
  { file: "docs/release/microsoft-store/assets/official-logo/zenflow-official-super-hero-art-1920x1080.png", width: 1920, height: 1080, alpha: "opaque", maxBytes: MAX_STORE_BYTES },
];

const SVG_EXPECTATIONS = [
  "public/icon-source.svg",
  "public/icon-source-round.svg",
  "public/feature-graphic.svg",
  "docs/icon-source.svg",
  "docs/icon-source-round.svg",
  "docs/feature-graphic.svg",
];
const DOCS_STATIC_HTML = fs
  .readdirSync(path.join(ROOT, "docs"))
  .filter((name) => /^(404|delete-account|privacy|privacy-policy|terms)(?:-[a-z]{2})?\.html$/.test(name))
  .map((name) => `docs/${name}`)
  .sort();
const PUBLIC_STATIC_HTML = [
  "public/404.html",
  "public/delete-account.html",
  "public/offline.html",
  "public/privacy.html",
  "public/privacy-policy.html",
  "public/terms.html",
  "docs/offline.html",
  ...DOCS_STATIC_HTML,
];
const WHITE_MARK_SAFE_ZONE_EXPECTATIONS = [
  "public/pwa-72.png",
  "public/pwa-192.png",
  "public/pwa-windows-44.png",
  "public/pwa-windows-50.png",
  "docs/pwa-192.png",
  "docs/pwa-windows-44.png",
  "src-tauri/icons/32x32.png",
  "src-tauri/icons/StoreLogo.png",
  "android/app/src/main/res/mipmap-mdpi/ic_launcher.png",
  "android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png",
  "docs/release/microsoft-store/assets/official-logo/zenflow-official-app-tile-icon-71.png",
  "docs/release/microsoft-store/assets/official-logo/zenflow-official-app-tile-icon-300.png",
];

function fail(message) {
  throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assertNoSvgFilters(rel) {
  const text = read(rel);
  if (/<filter\b|filter\s*=/.test(text)) {
    fail(`${rel} must not use SVG filters; filters can rasterize as square glow artifacts`);
  }
  if (!/aria-label="ZenFlow"/.test(text)) {
    fail(`${rel} must keep an accessible ZenFlow label`);
  }
}

function assertClassicLogoContract() {
  for (const rel of [
    "scripts/generate-icons.cjs",
    "scripts/generate-microsoft-store-logo-assets.cjs",
    "src/components/SplashScreen.tsx",
    ...SVG_EXPECTATIONS,
  ]) {
    const text = read(rel);
    if (text.includes(REJECTED_FLOW_LEAF_BODY) || text.includes(REJECTED_FLOW_LEAF_FLOW)) {
      fail(`${rel} still uses the rejected flow-leaf experiment; ZenFlow logo surfaces must use the approved classic leaf mark`);
    }
    for (const token of [CLASSIC_LEAF_BODY, CLASSIC_LEAF_STEM]) {
      if (!text.includes(token)) fail(`${rel} is missing the approved classic ZenFlow logo token ${token}`);
    }
  }
  for (const rel of ["scripts/generate-icons.cjs", "scripts/generate-microsoft-store-logo-assets.cjs"]) {
    const text = read(rel);
    for (const token of ["LEAF_DETAIL_SHADOW_MIN_SIZE", "useLeafDetailShadow"]) {
      if (!text.includes(token)) {
        fail(`${rel} must keep the small-icon clarity guard ${token}`);
      }
    }
  }
}

async function assertOpaquePng(file) {
  const image = sharp(path.join(ROOT, file));
  const metadata = await image.metadata();
  if (!metadata.hasAlpha) return;
  const raw = await image.ensureAlpha().raw().toBuffer();
  for (let i = 3; i < raw.length; i += 4) {
    if (raw[i] !== 255) {
      fail(`${file} must be opaque for platform/store surfaces that reject or flatten alpha`);
    }
  }
}

async function assertImage(expectation) {
  const abs = path.join(ROOT, expectation.file);
  if (!fs.existsSync(abs)) fail(`${expectation.file} is missing`);
  const metadata = await sharp(abs).metadata();
  if (metadata.width !== expectation.width || metadata.height !== expectation.height) {
    fail(`${expectation.file} must be ${expectation.width}x${expectation.height}; got ${metadata.width}x${metadata.height}`);
  }
  if (expectation.alpha === "opaque") {
    await assertOpaquePng(expectation.file);
  }
  if (expectation.maxBytes && fs.statSync(abs).size > expectation.maxBytes) {
    fail(`${expectation.file} exceeds ${expectation.maxBytes} bytes`);
  }
  if (expectation.darkSplash) {
    const stats = await sharp(abs).stats();
    const mean = (stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean) / 3;
    if (mean > 96) {
      fail(`${expectation.file} must stay on the dark ZenFlow launch background; average luminance is ${mean.toFixed(1)}`);
    }
  }
}

async function assertWhiteMarkSafeZone(file) {
  const abs = path.join(ROOT, file);
  const metadata = await sharp(abs).metadata();
  const raw = await sharp(abs).ensureAlpha().raw().toBuffer();
  let minX = metadata.width;
  let minY = metadata.height;
  let maxX = -1;
  let maxY = -1;
  let whitePixels = 0;

  for (let y = 0; y < metadata.height; y += 1) {
    for (let x = 0; x < metadata.width; x += 1) {
      const index = (y * metadata.width + x) * 4;
      const r = raw[index];
      const g = raw[index + 1];
      const b = raw[index + 2];
      const alpha = raw[index + 3];
      if (alpha > 48 && r > 205 && g > 205 && b > 205) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        whitePixels += 1;
      }
    }
  }

  if (whitePixels < 24) {
    fail(`${file} must keep a readable white ZenFlow leaf mark; only ${whitePixels} white pixels detected`);
  }

  const margins = [
    minX / metadata.width,
    minY / metadata.height,
    (metadata.width - 1 - maxX) / metadata.width,
    (metadata.height - 1 - maxY) / metadata.height,
  ];
  const markWidth = (maxX - minX + 1) / metadata.width;
  const markHeight = (maxY - minY + 1) / metadata.height;
  const smallestMargin = Math.min(...margins);

  if (smallestMargin < 0.18) {
    fail(`${file} white mark is too close to an edge; smallest margin is ${(smallestMargin * 100).toFixed(1)}%`);
  }
  if (markWidth < 0.28 || markHeight < 0.28 || markWidth > 0.62 || markHeight > 0.62) {
    fail(`${file} white mark has poor icon scale; measured ${(markWidth * 100).toFixed(1)}% x ${(markHeight * 100).toFixed(1)}%`);
  }
}

function assertIco(rel) {
  const file = path.join(ROOT, rel);
  const buffer = fs.readFileSync(file);
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) {
    fail(`${rel} is not a valid ICO`);
  }
  const count = buffer.readUInt16LE(4);
  const sizes = new Set();
  for (let i = 0; i < count; i += 1) {
    const base = 6 + i * 16;
    const width = buffer.readUInt8(base) || 256;
    const height = buffer.readUInt8(base + 1) || 256;
    if (width === height) sizes.add(width);
  }
  for (const size of [16, 32, 48, 64, 128, 256]) {
    if (!sizes.has(size)) fail(`${rel} is missing ${size}x${size}`);
  }
}

function assertIcns(rel) {
  const file = path.join(ROOT, rel);
  const buffer = fs.readFileSync(file);
  if (buffer.toString("ascii", 0, 4) !== "icns") {
    fail(`${rel} is not a valid ICNS`);
  }
  const chunks = new Set();
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32BE(offset + 4);
    chunks.add(type);
    offset += length;
  }
  for (const type of ["icp4", "icp5", "icp6", "ic07", "ic08", "ic09", "ic10"]) {
    if (!chunks.has(type)) fail(`${rel} is missing ${type}`);
  }
}

function assertAndroidXml(baseRel) {
  const background = read(`${baseRel}/values/ic_launcher_background.xml`);
  if (!/#2E9B70/i.test(background)) {
    fail(`${baseRel}/values/ic_launcher_background.xml must use the ZenFlow emerald background`);
  }
  for (const file of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const xml = read(`${baseRel}/mipmap-anydpi-v26/${file}`);
    for (const token of ["@color/ic_launcher_background", "@mipmap/ic_launcher_foreground", "<monochrome"]) {
      if (!xml.includes(token)) fail(`${baseRel}/mipmap-anydpi-v26/${file} is missing ${token}`);
    }
  }
}

function assertPackageScripts() {
  const packageJson = JSON.parse(read("package.json"));
  for (const script of [
    "assets:logos",
    "assets:logos:check",
    "assets:logos:proof",
    "desktop:store:assets",
    "desktop:store:assets:check",
  ]) {
    if (!packageJson.scripts?.[script]) fail(`package.json is missing ${script}`);
  }
  if (!packageJson.scripts["check:visual"].includes("assets:logos:check")) {
    fail("check:visual must include assets:logos:check");
  }
}

function assertNoLegacyStoreLogoDrafts() {
  const legacyDraftDir = path.join(ROOT, "docs", "release", "microsoft-store", "assets", "orb-draft");
  if (fs.existsSync(legacyDraftDir)) {
    fail("docs/release/microsoft-store/assets/orb-draft must not exist; Store identity uses official-logo only");
  }
}

function assertPublicStaticPageLogoContract() {
  for (const rel of PUBLIC_STATIC_HTML) {
    const text = read(rel);
    for (const token of ["favicon-16.png", "favicon-32.png", "favicon-48.png", "favicon-64.png", "favicon.ico", "pwa-192.png", "apple-touch-icon.png"]) {
      if (!text.includes(token)) {
        fail(`${rel} must expose ${token} so public, offline, and legal pages use the canonical ZenFlow app icon`);
      }
    }
  }
  for (const rel of PUBLIC_STATIC_HTML.filter((file) => !file.endsWith("/404.html"))) {
    const text = read(rel);
    if (!text.includes("https://yehor212.github.io/people-first-app/og-image.png")) {
      fail(`${rel} must expose og-image.png for public share previews`);
    }
  }
  for (const rel of PUBLIC_STATIC_HTML.filter((file) => /\/(delete-account|privacy|privacy-policy|terms)(?:-[a-z]{2})?\.html$/.test(file))) {
    const text = read(rel);
    for (const token of ["title-logo", "pwa-72.png"]) {
      if (!text.includes(token)) {
        fail(`${rel} must render a visible canonical ZenFlow leaf mark in the page title`);
      }
    }
  }
}

function assertPlaceholderLogoContract() {
  for (const rel of ["public/placeholder.svg", "docs/placeholder.svg"]) {
    const text = read(rel);
    for (const token of [CLASSIC_LEAF_BODY, CLASSIC_LEAF_STEM, 'aria-label="ZenFlow placeholder"']) {
      if (!text.includes(token)) fail(`${rel} is missing ${token}`);
    }
    for (const rejected of ["#EAEAEA", "#C9C9C9", "<filter", "filter="]) {
      if (text.includes(rejected)) fail(`${rel} must not keep the old gray placeholder or SVG filter artifact ${rejected}`);
    }
  }
}

function assertPwaInstallLogoContract() {
  const sourceIndex = read("index.html");
  const mojibakeTokens = ["\u0432\u0402", "\u0420\u0406", "\u0420\u00b0", "\u0421\u0403"];
  for (const token of [
    "apple-touch-icon.png",
    "favicon-16.png",
    "favicon-32.png",
    "favicon-48.png",
    "favicon-64.png",
    "favicon.ico",
    "pwa-192.png",
  ]) {
    if (!sourceIndex.includes(`href="%BASE_URL%${token}`)) {
      fail(`index.html must reference ${token} through %BASE_URL%; copied route entrypoints must not resolve app icons under /orb, /habits, /diary, /settings, or /desktop`);
    }
  }
  if (/href=["']\.\//.test(sourceIndex)) {
    fail("index.html must not use ./ icon hrefs; GitHub Pages route entrypoints are copied into nested route directories");
  }

  for (const rel of ["index.html", "docs/index.html"]) {
    const text = read(rel);
    if (/rel=["']icon["'][^>]+data:image\/svg\+xml/i.test(text)) {
      fail(`${rel} must not use an inline emoji favicon; installed PWA shortcuts must use the canonical ZenFlow leaf assets`);
    }
    for (const token of ["favicon-16.png", "favicon-32.png", "favicon-48.png", "favicon-64.png", "favicon.ico", "pwa-192.png"]) {
      if (!text.includes(token)) {
        fail(`${rel} must expose ${token} for browser toolbar and PWA install surfaces`);
      }
    }
    if (!text.includes(`?v=${PWA_INSTALL_ICON_REVISION}`)) {
      fail(`${rel} must cache-bust browser app icons with ${PWA_INSTALL_ICON_REVISION}`);
    }
    if (mojibakeTokens.some((token) => text.includes(token))) {
      fail(`${rel} must not expose mojibake in browser title/meta install surfaces`);
    }
  }

  const docsIndex = read("docs/index.html");
  if (!docsIndex.includes(`manifest.webmanifest?v=${PWA_INSTALL_ICON_REVISION}`)) {
    fail(
      `docs/index.html must cache-bust the PWA manifest link with ${PWA_INSTALL_ICON_REVISION}; Chrome only refreshes installed app icons when manifest/icon URLs change`,
    );
  }

  const docsManifest = JSON.parse(read("docs/manifest.webmanifest"));
  const icons = docsManifest.icons || [];
  const iconPath = (icon) => (icon.src || "").split("?")[0];
  const iconRevision = (icon) => (icon.src || "").split("?")[1] || "";
  const hasMaskable = icons.some((icon) => iconPath(icon) === "pwa-maskable-512.png" && /\bmaskable\b/.test(icon.purpose || ""));
  const hasAny192 = icons.some((icon) => iconPath(icon) === "pwa-192.png" && icon.sizes === "192x192");
  const hasAny512 = icons.some((icon) => iconPath(icon) === "pwa-512.png" && icon.sizes === "512x512");
  const requiredWindowsSizes = new Set(["44x44", "50x50", "71x71", "150x150", "310x310", "310x150", "620x300"]);
  for (const size of requiredWindowsSizes) {
    if (!icons.some((icon) => icon.sizes === size && iconPath(icon).startsWith("pwa-windows-"))) {
      fail(`docs/manifest.webmanifest must expose Windows/PWA install icon size ${size}`);
    }
  }
  for (const icon of icons) {
    if (iconRevision(icon) !== `v=${PWA_INSTALL_ICON_REVISION}`) {
      fail(`docs/manifest.webmanifest icon ${icon.src} must use ${PWA_INSTALL_ICON_REVISION} so installed PWA shortcuts refresh stale cached icons`);
    }
  }
  for (const shortcut of docsManifest.shortcuts || []) {
    for (const icon of shortcut.icons || []) {
      if (iconRevision(icon) !== `v=${PWA_INSTALL_ICON_REVISION}`) {
        fail(`docs/manifest.webmanifest shortcut icon ${icon.src} must use ${PWA_INSTALL_ICON_REVISION}`);
      }
    }
  }
  if (docsManifest.name !== "ZenFlow - Daily Wellness" || docsManifest.short_name !== "ZenFlow") {
    fail("docs/manifest.webmanifest must keep clean ZenFlow install names without stale mojibake");
  }
  if (
    docsManifest.lang !== "en" ||
    docsManifest.id !== "/people-first-app/" ||
    docsManifest.start_url !== "/people-first-app/" ||
    docsManifest.scope !== "/people-first-app/"
  ) {
    fail("docs/manifest.webmanifest must keep the canonical GitHub Pages PWA id, scope, start URL, and English store-facing install language");
  }
  if (!hasMaskable || !hasAny192 || !hasAny512) {
    fail("docs/manifest.webmanifest must expose 192, 512, and maskable ZenFlow install icons");
  }
}

function assertProofSheetGeneratorContract() {
  const proofGenerator = read("scripts/generate-brand-logo-proof-sheet.cjs");
  for (const token of [
    "TINY_RASTER_LIMIT",
    "MAX_TINY_PROOF_SCALE",
    "native raster",
    "They are not enlarged as hero art",
  ]) {
    if (!proofGenerator.includes(token)) {
      fail(`scripts/generate-brand-logo-proof-sheet.cjs must keep proof-sheet clarity guard ${token}`);
    }
  }
}

function assertNativeSplashContracts() {
  const capacitor = read("capacitor.config.ts");
  for (const token of ['SplashScreen', 'launchAutoHide: false', 'androidScaleType: "CENTER_CROP"']) {
    if (!capacitor.includes(token)) fail(`capacitor.config.ts native splash contract is missing ${token}`);
  }

  const storyboard = read("ios/App/App/Base.lproj/LaunchScreen.storyboard");
  for (const token of ['image="Splash"', 'contentMode="scaleAspectFill"']) {
    if (!storyboard.includes(token)) fail(`iOS LaunchScreen.storyboard is missing ${token}`);
  }

  const iosSplash = JSON.parse(read("ios/App/App/Assets.xcassets/Splash.imageset/Contents.json"));
  const filenames = new Set((iosSplash.images || []).map((image) => image.filename));
  for (const file of ["splash-2732x2732-2.png", "splash-2732x2732-1.png", "splash-2732x2732.png"]) {
    if (!filenames.has(file)) fail(`iOS Splash.imageset Contents.json is missing ${file}`);
  }

  const darkSplashGenerator = read("scripts/generate-dark-splash.cjs");
  if (/<filter\b|filter\s*=|feDropShadow/.test(darkSplashGenerator)) {
    fail("scripts/generate-dark-splash.cjs must not reintroduce SVG filters or square glow artifacts");
  }
}

function assertRuntimeSplashLogoContract() {
  const splash = read("src/components/SplashScreen.tsx");
  for (const token of [
    'data-testid="splash-brand-logo"',
    'role="img"',
    'aria-label="ZenFlow"',
    CLASSIC_LEAF_BODY,
    CLASSIC_LEAF_STEM,
  ]) {
    if (!splash.includes(token)) fail(`src/components/SplashScreen.tsx splash logo is missing ${token}`);
  }
  if (/<filter\b|filter\s*=|feDropShadow/.test(splash)) {
    fail("src/components/SplashScreen.tsx splash logo must not use SVG filters; use CSS shadows only");
  }
}

function assertUploadPack() {
  const uploadPack = path.join(ROOT, "tmp", "microsoft-store-upload-pack");
  if (!fs.existsSync(uploadPack)) return;
  for (const name of [
    "zenflow-official-app-tile-icon-300.png",
    "zenflow-official-box-art-2160.png",
    "zenflow-official-poster-art-1440x2160.png",
    "zenflow-official-super-hero-art-1920x1080.png",
  ]) {
    const source = path.join(ROOT, "docs", "release", "microsoft-store", "assets", "official-logo", name);
    const target = path.join(uploadPack, name);
    if (!fs.existsSync(target)) fail(`upload pack missing ${name}`);
    if (fs.readFileSync(source).compare(fs.readFileSync(target)) !== 0) {
      fail(`upload pack ${name} does not match official-logo source`);
    }
  }
}

function assertMicrosoftStoreChecker() {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-microsoft-store-logo-assets.cjs")], {
    cwd: ROOT,
    stdio: "pipe",
  });
}

async function main() {
  for (const rel of SVG_EXPECTATIONS) assertNoSvgFilters(rel);
  for (const expectation of IMAGE_EXPECTATIONS) await assertImage(expectation);
  for (const rel of WHITE_MARK_SAFE_ZONE_EXPECTATIONS) await assertWhiteMarkSafeZone(rel);
  assertIco("public/favicon.ico");
  assertIco("docs/favicon.ico");
  assertIco("src-tauri/icons/icon.ico");
  assertIcns("src-tauri/icons/icon.icns");
  assertAndroidXml("android/app/src/main/res");
  assertAndroidXml("src-tauri/icons/android");
  assertNativeSplashContracts();
  assertRuntimeSplashLogoContract();
  assertClassicLogoContract();
  assertNoLegacyStoreLogoDrafts();
  assertPublicStaticPageLogoContract();
  assertPlaceholderLogoContract();
  assertProofSheetGeneratorContract();
  assertPwaInstallLogoContract();
  assertUploadPack();
  assertPackageScripts();
  assertMicrosoftStoreChecker();
  console.log(`[brand-logo-assets] PASS - ${IMAGE_EXPECTATIONS.length} images, ${SVG_EXPECTATIONS.length} SVG sources, native splash, ICO/ICNS, Android XML, Store upload pack, and package scripts checked`);
}

main().catch((error) => {
  console.error(`[brand-logo-assets] FAIL - ${error.message}`);
  process.exit(1);
});
