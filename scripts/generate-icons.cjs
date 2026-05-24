#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");

const LEAF_BODY = "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z";
const LEAF_STEM = "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12";
const LEAF_DETAIL_SHADOW_MIN_SIZE = 72;

const PWA_INSTALL_ICON_REVISION = "zenflow-browser-leaf-20260524-r3";
const PWA_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const BROWSER_FAVICON_SIZES = [16, 32, 48, 64];
const PWA_WINDOWS_ICONS = [
  { file: "pwa-windows-44.png", width: 44, height: 44, kind: "tile" },
  { file: "pwa-windows-50.png", width: 50, height: 50, kind: "tile" },
  { file: "pwa-windows-71.png", width: 71, height: 71, kind: "tile" },
  { file: "pwa-windows-150.png", width: 150, height: 150, kind: "tile" },
  { file: "pwa-windows-310.png", width: 310, height: 310, kind: "tile" },
  { file: "pwa-windows-wide-310x150.png", width: 310, height: 150, kind: "wide" },
  { file: "pwa-windows-splash-620x300.png", width: 620, height: 300, kind: "wide" },
];
const DOCS_PWA_BASE = "/people-first-app/";
const PUBLIC_TO_DOCS_ASSETS = [
  "favicon.ico",
  ...BROWSER_FAVICON_SIZES.map((size) => `favicon-${size}.png`),
  "apple-touch-icon.png",
  "icon-512.png",
  "pwa-maskable-512.png",
  ...PWA_SIZES.map((size) => `pwa-${size}.png`),
  ...PWA_WINDOWS_ICONS.map((icon) => icon.file),
];
const ANDROID_SIZES = [
  { name: "mipmap-mdpi", size: 48 },
  { name: "mipmap-hdpi", size: 72 },
  { name: "mipmap-xhdpi", size: 96 },
  { name: "mipmap-xxhdpi", size: 144 },
  { name: "mipmap-xxxhdpi", size: 192 },
];
const TAURI_PNGS = [
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
];
const ANDROID_SPLASH_TARGETS = [
  "drawable/splash.png",
  "drawable-land-hdpi/splash.png",
  "drawable-land-mdpi/splash.png",
  "drawable-land-xhdpi/splash.png",
  "drawable-land-xxhdpi/splash.png",
  "drawable-land-xxxhdpi/splash.png",
  "drawable-port-hdpi/splash.png",
  "drawable-port-mdpi/splash.png",
  "drawable-port-xhdpi/splash.png",
  "drawable-port-xxhdpi/splash.png",
  "drawable-port-xxxhdpi/splash.png",
];
const IOS_SPLASH_FILES = [
  "splash-2732x2732-2.png",
  "splash-2732x2732-1.png",
  "splash-2732x2732.png",
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function cleanSvg(svg) {
  return `${svg.replace(/[ \t]+$/gm, "").trim()}\n`;
}

function useLeafDetailShadow(size) {
  return size >= LEAF_DETAIL_SHADOW_MIN_SIZE;
}

function leafGroup({ cx, cy, size, fill = "rgba(255,255,255,.12)", stroke = "#fff", shadow = useLeafDetailShadow(size) }) {
  const scale = size / 24;
  const tx = cx - 12 * scale;
  const ty = cy - 12 * scale;
  const shadowPaths = shadow
    ? `
      <path d="${LEAF_BODY}" fill="${fill}" stroke="#052c22" stroke-opacity=".18" stroke-width="2.28" transform="translate(.14 .22)"/>
      <path d="${LEAF_STEM}" stroke="#052c22" stroke-opacity=".18" stroke-width="2.28" transform="translate(.14 .22)"/>`
    : "";

  return `
    <g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(5)})"
      fill="none" stroke-linecap="round" stroke-linejoin="round">
      ${shadowPaths}
      <path d="${LEAF_BODY}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <path d="${LEAF_STEM}" stroke="${stroke}" stroke-width="2"/>
    </g>`;
}

function plateDefs({ x, y, size, idPrefix }) {
  return `
    <linearGradient id="${idPrefix}Plate" x1="${x}" y1="${y}" x2="${x + size}" y2="${y + size}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#286f59"/>
      <stop offset=".48" stop-color="#2e9b70"/>
      <stop offset="1" stop-color="#42c386"/>
    </linearGradient>
    <radialGradient id="${idPrefix}Highlight" cx="${x + size * 0.3}" cy="${y + size * 0.22}" r="${size * 0.72}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".16"/>
      <stop offset=".52" stop-color="#fff" stop-opacity=".04"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${idPrefix}Vignette" cx="${x + size * 0.72}" cy="${y + size * 0.74}" r="${size * 0.64}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#083227" stop-opacity=".16"/>
      <stop offset="1" stop-color="#083227" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${idPrefix}Rim" x1="${x}" y1="${y}" x2="${x + size}" y2="${y + size}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".2"/>
      <stop offset=".55" stop-color="#fff" stop-opacity=".055"/>
      <stop offset="1" stop-color="#001f18" stop-opacity=".08"/>
    </linearGradient>
    <radialGradient id="${idPrefix}LeafFill" cx="${x + size * 0.46}" cy="${y + size * 0.43}" r="${size * 0.38}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".18"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".05"/>
    </radialGradient>`;
}

function plate({ cx, cy, size, idPrefix = "zf", round = false }) {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const radius = round ? size / 2 : size * 0.215;
  const tag = round
    ? `<circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="url(#${idPrefix}Plate)"/>
      <circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="url(#${idPrefix}Highlight)"/>
      <circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="url(#${idPrefix}Vignette)"/>
      <circle cx="${cx}" cy="${cy}" r="${Math.max(1, size / 2 - 1.5)}" fill="none" stroke="url(#${idPrefix}Rim)" stroke-width="${Math.max(1, size * 0.004)}"/>`
    : `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="url(#${idPrefix}Plate)"/>
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="url(#${idPrefix}Highlight)"/>
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="url(#${idPrefix}Vignette)"/>
      <rect x="${x + 1}" y="${y + 1}" width="${size - 2}" height="${size - 2}" rx="${Math.max(1, radius - 1)}" fill="none" stroke="url(#${idPrefix}Rim)" stroke-width="${Math.max(1, size * 0.004)}"/>`;

  return `
    ${tag}
    ${leafGroup({ cx, cy: cy - size * 0.015, size: size * 0.58, fill: `url(#${idPrefix}LeafFill)` })}`;
}

function tileSvg({ width, height, scale = 0.78, round = false, role = false }) {
  const size = Math.min(width, height) * scale;
  const x = width / 2 - size / 2;
  const y = height / 2 - size / 2;
  const roleAttrs = role ? ' role="img" aria-label="ZenFlow"' : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"${roleAttrs}>
  <defs>
    ${plateDefs({ x, y, size, idPrefix: "zfIcon" })}
  </defs>
  ${plate({ cx: width / 2, cy: height / 2, size, idPrefix: "zfIcon", round })}
</svg>`;
}

function fullBleedDefs(width, height, idPrefix) {
  return `
    <linearGradient id="${idPrefix}Base" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#10362d"/>
      <stop offset=".42" stop-color="#2f9b72"/>
      <stop offset="1" stop-color="#1b6b51"/>
    </linearGradient>
    <radialGradient id="${idPrefix}Glow" cx="${width * 0.34}" cy="${height * 0.22}" r="${Math.max(width, height) * 0.75}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".17"/>
      <stop offset=".46" stop-color="#e5fff7" stop-opacity=".045"/>
      <stop offset="1" stop-color="#e5fff7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${idPrefix}Shade" cx="${width * 0.72}" cy="${height * 0.75}" r="${Math.max(width, height) * 0.62}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#05241c" stop-opacity=".2"/>
      <stop offset="1" stop-color="#05241c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${idPrefix}LeafFill" cx="${width * 0.5}" cy="${height * 0.44}" r="${Math.min(width, height) * 0.32}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".16"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".05"/>
    </radialGradient>`;
}

function fullBleedSvg({ width, height, leafScale = 0.54, role = false }) {
  const roleAttrs = role ? ' role="img" aria-label="ZenFlow"' : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"${roleAttrs}>
  <defs>
    ${fullBleedDefs(width, height, "zfFull")}
  </defs>
  <rect width="${width}" height="${height}" fill="url(#zfFullBase)"/>
  <rect width="${width}" height="${height}" fill="url(#zfFullGlow)"/>
  <rect width="${width}" height="${height}" fill="url(#zfFullShade)"/>
  ${leafGroup({ cx: width / 2, cy: height * 0.5, size: Math.min(width, height) * leafScale, fill: "url(#zfFullLeafFill)" })}
</svg>`;
}

function foregroundSvg({ width, height, leafScale = 0.56 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="zfFgLeafFill" cx="${width * 0.5}" cy="${height * 0.45}" r="${Math.min(width, height) * 0.38}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".18"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".05"/>
    </radialGradient>
  </defs>
  ${leafGroup({ cx: width / 2, cy: height / 2, size: Math.min(width, height) * leafScale, fill: "url(#zfFgLeafFill)" })}
</svg>`;
}

function featureGraphicSvg({ width, height, role = false }) {
  const icon = Math.min(height * 0.58, width * 0.28);
  const roleAttrs = role ? ' role="img" aria-label="ZenFlow"' : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"${roleAttrs}>
  <defs>
    <linearGradient id="zfFeatureBase" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#071513"/>
      <stop offset=".48" stop-color="#0d3329"/>
      <stop offset="1" stop-color="#06120f"/>
    </linearGradient>
    <radialGradient id="zfFeatureGlow" cx="${width * 0.54}" cy="${height * 0.43}" r="${height * 0.84}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2ed99a" stop-opacity=".18"/>
      <stop offset=".48" stop-color="#1fb982" stop-opacity=".065"/>
      <stop offset="1" stop-color="#1fb982" stop-opacity="0"/>
    </radialGradient>
    ${plateDefs({ x: width / 2 - icon / 2, y: height * 0.48 - icon / 2, size: icon, idPrefix: "zfFeatureIcon" })}
  </defs>
  <rect width="${width}" height="${height}" fill="url(#zfFeatureBase)"/>
  <rect width="${width}" height="${height}" fill="url(#zfFeatureGlow)"/>
  <path d="M${-width * 0.04} ${height * 0.82} C ${width * 0.24} ${height * 0.64}, ${width * 0.42} ${height * 0.18}, ${width * 0.58} ${-height * 0.08}" fill="none" stroke="#8cfbd0" stroke-opacity=".08" stroke-width="${height * 0.012}"/>
  <path d="M${width * 0.24} ${height * 1.12} C ${width * 0.5} ${height * 0.78}, ${width * 0.74} ${height * 0.44}, ${width * 1.04} ${height * 0.24}" fill="none" stroke="#8cfbd0" stroke-opacity=".035" stroke-width="${height * 0.005}"/>
  ${plate({ cx: width / 2, cy: height * 0.48, size: icon, idPrefix: "zfFeatureIcon" })}
</svg>`;
}

function nativeSplashSvg({ width, height, role = false }) {
  const icon = Math.min(Math.min(width, height) * 0.28, 420);
  const cx = width / 2;
  const cy = height / 2;
  const iconX = cx - icon / 2;
  const iconY = cy - icon / 2;
  const roleAttrs = role ? ' role="img" aria-label="ZenFlow"' : "";
  const lineStroke = Math.max(1, Math.min(width, height) * 0.0045);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"${roleAttrs}>
  <defs>
    <linearGradient id="zfSplashBase" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#071513"/>
      <stop offset=".48" stop-color="#0d3329"/>
      <stop offset="1" stop-color="#06120f"/>
    </linearGradient>
    <radialGradient id="zfSplashGlow" cx="${cx}" cy="${cy}" r="${Math.max(width, height) * 0.46}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2ed99a" stop-opacity=".16"/>
      <stop offset=".56" stop-color="#1fb982" stop-opacity=".055"/>
      <stop offset="1" stop-color="#1fb982" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="zfSplashQuietShade" cx="${width * 0.72}" cy="${height * 0.76}" r="${Math.max(width, height) * 0.58}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#020807" stop-opacity=".2"/>
      <stop offset="1" stop-color="#020807" stop-opacity="0"/>
    </radialGradient>
    ${plateDefs({ x: iconX, y: iconY, size: icon, idPrefix: "zfSplashIcon" })}
  </defs>
  <rect width="${width}" height="${height}" fill="url(#zfSplashBase)"/>
  <rect width="${width}" height="${height}" fill="url(#zfSplashGlow)"/>
  <rect width="${width}" height="${height}" fill="url(#zfSplashQuietShade)"/>
  <path d="M${-width * 0.06} ${height * 0.78} C ${width * 0.22} ${height * 0.66}, ${width * 0.42} ${height * 0.18}, ${width * 0.58} ${-height * 0.08}" fill="none" stroke="#8cfbd0" stroke-opacity=".055" stroke-width="${lineStroke}"/>
  <path d="M${width * 0.2} ${height * 1.08} C ${width * 0.46} ${height * 0.76}, ${width * 0.72} ${height * 0.42}, ${width * 1.06} ${height * 0.2}" fill="none" stroke="#8cfbd0" stroke-opacity=".032" stroke-width="${Math.max(1, lineStroke * 0.46)}"/>
  ${plate({ cx, cy, size: icon, idPrefix: "zfSplashIcon" })}
</svg>`;
}

async function pngFromSvg(svg, output, options = {}) {
  ensureDir(output);
  let pipeline = sharp(Buffer.from(svg));
  if (options.resize) {
    pipeline = pipeline.resize(options.resize.width, options.resize.height);
  }
  if (options.flatten) {
    pipeline = pipeline.flatten({ background: options.flatten });
  }
  await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toFile(output);
}

async function webpFromSvg(svg, output, options = {}) {
  ensureDir(output);
  let pipeline = sharp(Buffer.from(svg));
  if (options.resize) {
    pipeline = pipeline.resize(options.resize.width, options.resize.height);
  }
  if (options.flatten) {
    pipeline = pipeline.flatten({ background: options.flatten });
  }
  await pipeline.webp({ quality: 88, effort: 6 }).toFile(output);
}

async function pngBuffer(svg, size, options = {}) {
  let pipeline = sharp(Buffer.from(svg)).resize(size, size);
  if (options.flatten) {
    pipeline = pipeline.flatten({ background: options.flatten });
  }
  return pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
}

function writeIco(output, entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach((entry, index) => {
    const size = entry.size >= 256 ? 0 : entry.size;
    const base = index * 16;
    dir.writeUInt8(size, base);
    dir.writeUInt8(size, base + 1);
    dir.writeUInt8(0, base + 2);
    dir.writeUInt8(0, base + 3);
    dir.writeUInt16LE(1, base + 4);
    dir.writeUInt16LE(32, base + 6);
    dir.writeUInt32LE(entry.buffer.length, base + 8);
    dir.writeUInt32LE(offset, base + 12);
    offset += entry.buffer.length;
  });

  ensureDir(output);
  fs.writeFileSync(output, Buffer.concat([header, dir, ...entries.map((entry) => entry.buffer)]));
}

function writeIcns(output, entries) {
  const chunks = entries.map((entry) => {
    const header = Buffer.alloc(8);
    header.write(entry.type, 0, 4, "ascii");
    header.writeUInt32BE(entry.buffer.length + 8, 4);
    return Buffer.concat([header, entry.buffer]);
  });
  const fileHeader = Buffer.alloc(8);
  fileHeader.write("icns", 0, 4, "ascii");
  fileHeader.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
  ensureDir(output);
  fs.writeFileSync(output, Buffer.concat([fileHeader, ...chunks]));
}

function writeAndroidBackground(dir) {
  const file = path.join(dir, "values", "ic_launcher_background.xml");
  ensureDir(file);
  fs.writeFileSync(
    file,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2E9B70</color>\n</resources>\n`,
  );
}

function writeAdaptiveXml(dir) {
  const anydpi = path.join(dir, "mipmap-anydpi-v26");
  fs.mkdirSync(anydpi, { recursive: true });
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`;
  fs.writeFileSync(path.join(anydpi, "ic_launcher.xml"), xml);
  fs.writeFileSync(path.join(anydpi, "ic_launcher_round.xml"), xml);
}

function writeDocsWebManifest() {
  const iconSrc = (file) => `${file}?v=${PWA_INSTALL_ICON_REVISION}`;
  const manifest = {
    name: "ZenFlow - Daily Wellness",
    short_name: "ZenFlow",
    description: "Habit, mood and productivity tracker. Works offline.",
    id: DOCS_PWA_BASE,
    start_url: DOCS_PWA_BASE,
    scope: DOCS_PWA_BASE,
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#4a9d7c",
    background_color: "#071513",
    lang: "en",
    dir: "ltr",
    categories: ["health", "lifestyle", "productivity"],
    icons: [
      ...PWA_SIZES.map((size) => ({
        src: iconSrc(`pwa-${size}.png`),
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any",
      })),
      ...PWA_WINDOWS_ICONS.map((icon) => ({
        src: iconSrc(icon.file),
        sizes: `${icon.width}x${icon.height}`,
        type: "image/png",
        purpose: "any",
      })),
      {
        src: iconSrc("pwa-maskable-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Log Mood",
        short_name: "Mood",
        description: "Quickly log your mood",
        url: `${DOCS_PWA_BASE}?tab=home`,
        icons: [{ src: iconSrc("pwa-192.png"), sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Track Habit",
        short_name: "Habit",
        description: "Mark a habit as completed",
        url: `${DOCS_PWA_BASE}?tab=home`,
        icons: [{ src: iconSrc("pwa-192.png"), sizes: "192x192", type: "image/png" }],
      },
    ],
  };

  fs.writeFileSync(path.join(ROOT, "docs", "manifest.webmanifest"), `${JSON.stringify(manifest)}\n`);
}

function syncPublicInstallAssetsToDocs() {
  const publicDir = path.join(ROOT, "public");
  const docsDir = path.join(ROOT, "docs");
  fs.mkdirSync(docsDir, { recursive: true });
  for (const fileName of PUBLIC_TO_DOCS_ASSETS) {
    fs.copyFileSync(path.join(publicDir, fileName), path.join(docsDir, fileName));
  }
  writeDocsWebManifest();
}

async function generatePublicAssets() {
  const publicDir = path.join(ROOT, "public");
  const iconSourceSvg = cleanSvg(tileSvg({ width: 512, height: 512, role: true }));
  const iconSourceRoundSvg = cleanSvg(tileSvg({ width: 512, height: 512, round: true, role: true }));
  const featureSourceSvg = cleanSvg(featureGraphicSvg({ width: 1024, height: 500, role: true }));
  fs.writeFileSync(path.join(publicDir, "icon-source.svg"), iconSourceSvg);
  fs.writeFileSync(path.join(publicDir, "icon-source-round.svg"), iconSourceRoundSvg);
  fs.writeFileSync(path.join(publicDir, "feature-graphic.svg"), featureSourceSvg);
  fs.writeFileSync(path.join(ROOT, "docs", "icon-source.svg"), iconSourceSvg);
  fs.writeFileSync(path.join(ROOT, "docs", "icon-source-round.svg"), iconSourceRoundSvg);
  fs.writeFileSync(path.join(ROOT, "docs", "feature-graphic.svg"), featureSourceSvg);

  for (const size of PWA_SIZES) {
    await pngFromSvg(tileSvg({ width: size, height: size, scale: 0.78 }), path.join(publicDir, `pwa-${size}.png`));
  }
  for (const icon of PWA_WINDOWS_ICONS) {
    const svg =
      icon.kind === "wide"
        ? featureGraphicSvg({ width: icon.width, height: icon.height })
        : tileSvg({ width: icon.width, height: icon.height, scale: icon.width <= 50 ? 0.86 : 0.8 });
    await pngFromSvg(svg, path.join(publicDir, icon.file), {
      flatten: icon.kind === "wide" ? "#071513" : undefined,
    });
  }
  await pngFromSvg(fullBleedSvg({ width: 512, height: 512, leafScale: 0.52 }), path.join(publicDir, "pwa-maskable-512.png"), {
    flatten: "#2E9B70",
  });
  await pngFromSvg(fullBleedSvg({ width: 180, height: 180, leafScale: 0.54 }), path.join(publicDir, "apple-touch-icon.png"), {
    flatten: "#2E9B70",
  });
  await pngFromSvg(fullBleedSvg({ width: 512, height: 512, leafScale: 0.54 }), path.join(publicDir, "icon-512.png"), {
    flatten: "#2E9B70",
  });
  await pngFromSvg(featureGraphicSvg({ width: 1024, height: 500 }), path.join(publicDir, "feature-graphic.png"), {
    flatten: "#071513",
  });
  await webpFromSvg(featureGraphicSvg({ width: 1024, height: 500 }), path.join(publicDir, "feature-graphic.webp"), {
    flatten: "#071513",
  });
  await pngFromSvg(featureGraphicSvg({ width: 1200, height: 630 }), path.join(publicDir, "og-image.png"), {
    flatten: "#071513",
  });

  const faviconEntries = await Promise.all(
    [16, 32, 48, 64, 128, 256].map(async (size) => ({
      size,
      buffer: await pngBuffer(tileSvg({ width: size, height: size, scale: 0.82 }), size),
    })),
  );
  writeIco(path.join(publicDir, "favicon.ico"), faviconEntries);
  for (const size of BROWSER_FAVICON_SIZES) {
    await pngFromSvg(tileSvg({ width: size, height: size, scale: size <= 32 ? 0.88 : 0.82 }), path.join(publicDir, `favicon-${size}.png`));
  }
  syncPublicInstallAssetsToDocs();
}

async function generateTauriAssets() {
  const tauriDir = path.join(ROOT, "src-tauri", "icons");
  for (const [file, size] of TAURI_PNGS) {
    await pngFromSvg(tileSvg({ width: size, height: size, scale: size <= 44 ? 0.86 : 0.8 }), path.join(tauriDir, file));
  }

  const icoEntries = await Promise.all(
    [16, 32, 48, 64, 128, 256].map(async (size) => ({
      size,
      buffer: await pngBuffer(tileSvg({ width: size, height: size, scale: size <= 32 ? 0.88 : 0.82 }), size),
    })),
  );
  writeIco(path.join(tauriDir, "icon.ico"), icoEntries);

  const icnsEntries = await Promise.all(
    [
      ["icp4", 16],
      ["icp5", 32],
      ["icp6", 64],
      ["ic07", 128],
      ["ic08", 256],
      ["ic09", 512],
      ["ic10", 1024],
    ].map(async ([type, size]) => ({
      type,
      buffer: await pngBuffer(tileSvg({ width: size, height: size, scale: size <= 32 ? 0.88 : 0.82 }), size),
    })),
  );
  writeIcns(path.join(tauriDir, "icon.icns"), icnsEntries);

  const androidIconDir = path.join(tauriDir, "android");
  await generateAndroidAssets(androidIconDir);
}

async function generateAndroidAssets(androidResDir = path.join(ROOT, "android", "app", "src", "main", "res")) {
  for (const { name, size } of ANDROID_SIZES) {
    const dir = path.join(androidResDir, name);
    fs.mkdirSync(dir, { recursive: true });
    await pngFromSvg(fullBleedSvg({ width: size, height: size, leafScale: 0.52 }), path.join(dir, "ic_launcher.png"), {
      flatten: "#2E9B70",
    });
    await pngFromSvg(fullBleedSvg({ width: size, height: size, leafScale: 0.52 }), path.join(dir, "ic_launcher_round.png"), {
      flatten: "#2E9B70",
    });
    await pngFromSvg(foregroundSvg({ width: size, height: size, leafScale: 0.56 }), path.join(dir, "ic_launcher_foreground.png"));
  }

  writeAndroidBackground(androidResDir);
  writeAdaptiveXml(androidResDir);
}

async function generateAndroidSplashAssets(androidResDir = path.join(ROOT, "android", "app", "src", "main", "res")) {
  for (const target of ANDROID_SPLASH_TARGETS) {
    const output = path.join(androidResDir, target);
    if (!fs.existsSync(output)) {
      throw new Error(`Missing Android splash target: ${target}`);
    }
    const metadata = await sharp(output).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error(`Unable to read dimensions for Android splash target: ${target}`);
    }
    await pngFromSvg(nativeSplashSvg({ width: metadata.width, height: metadata.height }), output, {
      flatten: "#071513",
    });
  }
}

async function generateIosAssets() {
  const file = path.join(ROOT, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png");
  await pngFromSvg(fullBleedSvg({ width: 1024, height: 1024, leafScale: 0.54 }), file, {
    flatten: "#2E9B70",
  });

  const splashDir = path.join(ROOT, "ios", "App", "App", "Assets.xcassets", "Splash.imageset");
  for (const fileName of IOS_SPLASH_FILES) {
    await pngFromSvg(nativeSplashSvg({ width: 2732, height: 2732 }), path.join(splashDir, fileName), {
      flatten: "#071513",
    });
  }
}

async function generateStoreAssets() {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "generate-microsoft-store-logo-assets.cjs")], {
    cwd: ROOT,
    stdio: "inherit",
  });
}

async function main() {
  await generatePublicAssets();
  await generateAndroidAssets();
  await generateAndroidSplashAssets();
  await generateIosAssets();
  await generateTauriAssets();
  await generateStoreAssets();

  console.log("Generated ZenFlow logo assets for web, PWA, favicon, native splash, Tauri, Android, iOS, and Microsoft Store.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
