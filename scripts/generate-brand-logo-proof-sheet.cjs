#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "logo-quality-proof-sheet.png");

const CARD_W = 360;
const CARD_H = 300;
const GAP = 16;
const COLS = 4;
const HEADER_H = 118;
const PADDING = 18;
const TINY_RASTER_LIMIT = 96;
const MAX_TINY_PROOF_SCALE = 4;
const MAX_TINY_AUDIT_PX = 144;
const MAX_SURFACE_W = CARD_W - 48;
const MAX_SURFACE_H = 142;

const ITEMS = [
  {
    label: "Browser favicon 16",
    rel: "public/favicon-16.png",
    role: "Chrome toolbar app-chip favicon",
    tiny: true,
  },
  {
    label: "Browser favicon 32",
    rel: "public/favicon-32.png",
    role: "Browser tab and toolbar icon",
    tiny: true,
  },
  {
    label: "PWA 192",
    rel: "public/pwa-192.png",
    role: "Install icon",
  },
  {
    label: "PWA 512",
    rel: "public/icon-512.png",
    role: "High-density app icon",
  },
  {
    label: "PWA Win 44",
    rel: "public/pwa-windows-44.png",
    role: "Installed app/taskbar icon",
    tiny: true,
  },
  {
    label: "PWA Win 150",
    rel: "public/pwa-windows-150.png",
    role: "Windows Start medium tile",
  },
  {
    label: "Tauri 32",
    rel: "src-tauri/icons/32x32.png",
    role: "Native window/taskbar small icon",
    tiny: true,
  },
  {
    label: "Win StoreLogo",
    rel: "src-tauri/icons/StoreLogo.png",
    role: "Windows StoreLogo 50px surface",
    tiny: true,
  },
  {
    label: "Android mdpi",
    rel: "android/app/src/main/res/mipmap-mdpi/ic_launcher.png",
    role: "Launcher mdpi 48px icon",
    tiny: true,
  },
  {
    label: "Android round mdpi",
    rel: "android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png",
    role: "Legacy round launcher icon",
    tiny: true,
  },
  {
    label: "Android round hdpi",
    rel: "android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png",
    role: "Round launcher 72px density",
    tiny: true,
  },
  {
    label: "Android round xhdpi",
    rel: "android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png",
    role: "Round launcher 96px density",
    tiny: true,
  },
  {
    label: "Android round xxhdpi",
    rel: "android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png",
    role: "Round launcher 144px density",
    tiny: true,
  },
  {
    label: "Android round xxxhdpi",
    rel: "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png",
    role: "Round launcher 192px density",
    tiny: true,
  },
  {
    label: "Android foreground",
    rel: "android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png",
    role: "Adaptive foreground layer",
    tiny: true,
  },
  {
    label: "Splash Android",
    rel: "android/app/src/main/res/drawable/splash.png",
    role: "Native launch background",
  },
  {
    label: "Splash iOS",
    rel: "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
    role: "iOS launch image source",
  },
  {
    label: "PWA Win wide",
    rel: "public/pwa-windows-wide-310x150.png",
    role: "Windows Start wide tile",
  },
  {
    label: "PWA Win splash",
    rel: "public/pwa-windows-splash-620x300.png",
    role: "Windows PWA splash artwork",
  },
  {
    label: "Store tile 300",
    rel: "docs/release/microsoft-store/assets/official-logo/zenflow-official-app-tile-icon-300.png",
    role: "Microsoft Store app tile",
  },
  {
    label: "Store box art",
    rel: "docs/release/microsoft-store/assets/official-logo/zenflow-official-box-art-1080.png",
    role: "Square Store artwork",
  },
  {
    label: "Store poster",
    rel: "docs/release/microsoft-store/assets/official-logo/zenflow-official-poster-art-1440x2160.png",
    role: "Portrait Store artwork",
  },
  {
    label: "Store hero",
    rel: "docs/release/microsoft-store/assets/official-logo/zenflow-official-super-hero-art-1920x1080.png",
    role: "Wide Store artwork",
  },
];

const ALLOWED_ASSET_RELS = new Set(ITEMS.map((item) => item.rel));

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function svgBuffer(svg) {
  return Buffer.from(svg);
}

function cardBase(item, meta, modeLabel) {
  const title = escapeXml(item.label);
  const file = escapeXml(truncate(item.rel, 52));
  const role = escapeXml(item.role);
  const dimensions = `${meta.width}x${meta.height}`;
  return svgBuffer(`
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
  <rect width="${CARD_W}" height="${CARD_H}" rx="12" fill="#071B15"/>
  <rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${CARD_H - 1}" rx="11.5" fill="none" stroke="#164236"/>
  <text x="18" y="28" fill="#EAF8F0" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="800">${title}</text>
  <text x="18" y="49" fill="#8FB9A6" font-family="Inter, Arial, sans-serif" font-size="9">${file}</text>
  <text x="18" y="${CARD_H - 48}" fill="#CFE6D9" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700">${escapeXml(dimensions)} native</text>
  <text x="18" y="${CARD_H - 29}" fill="#9FBAAD" font-family="Inter, Arial, sans-serif" font-size="10">${role}</text>
  <text x="${CARD_W - 18}" y="${CARD_H - 29}" text-anchor="end" fill="#62D1A0" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="800">${escapeXml(modeLabel)}</text>
</svg>`);
}

function tinyPanelsSvg(scale) {
  return svgBuffer(`
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
  <rect x="31" y="78" width="118" height="118" rx="14" fill="#06130F" stroke="#123A30"/>
  <rect x="211" y="66" width="118" height="142" rx="14" fill="#06130F" stroke="#123A30"/>
  <text x="90" y="220" text-anchor="middle" fill="#A9C9B9" font-family="Inter, Arial, sans-serif" font-size="10">1x native</text>
  <text x="270" y="220" text-anchor="middle" fill="#A9C9B9" font-family="Inter, Arial, sans-serif" font-size="10">${scale}x pixel audit</text>
</svg>`);
}

function sheetHeader(width) {
  return svgBuffer(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEADER_H}" viewBox="0 0 ${width} ${HEADER_H}">
  <rect width="${width}" height="${HEADER_H}" fill="#04100D"/>
  <text x="${PADDING}" y="34" fill="#F0FFF7" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="900">ZenFlow logo quality proof</text>
  <text x="${PADDING}" y="62" fill="#A9C9B9" font-family="Inter, Arial, sans-serif" font-size="12">Small platform rasters are validated at native size and capped pixel-audit scale. They are not enlarged as hero art.</text>
  <text x="${PADDING}" y="86" fill="#62D1A0" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="800">Rule: vector source first, exact platform sizes, no SVG filters, no square glow artifacts, no misleading upscaling.</text>
</svg>`);
}

async function readImage(rel) {
  if (!ALLOWED_ASSET_RELS.has(rel) || path.isAbsolute(rel) || rel.includes("\0")) {
    throw new Error(`Unexpected logo asset path: ${rel}`);
  }
  const normalizedRel = path.normalize(rel);
  if (normalizedRel.startsWith("..") || path.isAbsolute(normalizedRel)) {
    throw new Error(`Logo asset path escapes repo root: ${rel}`);
  }
  const abs = path.resolve(ROOT, normalizedRel); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal - rel is allow-listed and checked to stay inside ROOT above.
  const rootRelative = path.relative(ROOT, abs);
  if (rootRelative.startsWith("..") || path.isAbsolute(rootRelative)) {
    throw new Error(`Logo asset path resolves outside repo root: ${rel}`);
  }
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing logo asset: ${rel}`);
  }
  const meta = await sharp(abs).metadata();
  return { abs, meta };
}

async function renderSurface(item, abs, meta) {
  const resized = await sharp(abs)
    .resize({
      width: MAX_SURFACE_W,
      height: MAX_SURFACE_H,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  const resizedMeta = await sharp(resized).metadata();
  const left = Math.round((CARD_W - resizedMeta.width) / 2);
  const top = Math.round(78 + (MAX_SURFACE_H - resizedMeta.height) / 2);
  return sharp(cardBase(item, meta, "downscale/native"))
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
}

async function renderTiny(item, abs, meta) {
  if (meta.width > TINY_RASTER_LIMIT || meta.height > TINY_RASTER_LIMIT) {
    return renderSurface(item, abs, meta);
  }
  const maxSide = Math.max(meta.width, meta.height);
  const auditScale = Math.max(1, Math.min(MAX_TINY_PROOF_SCALE, Math.floor(MAX_TINY_AUDIT_PX / maxSide)));
  const native = await sharp(abs).png().toBuffer();
  const audit = await sharp(abs)
    .resize({
      width: meta.width * auditScale,
      height: meta.height * auditScale,
      kernel: sharp.kernel.nearest,
    })
    .png()
    .toBuffer();
  const nativeMeta = await sharp(native).metadata();
  const auditMeta = await sharp(audit).metadata();
  return sharp(cardBase(item, meta, "native raster"))
    .composite([
      { input: tinyPanelsSvg(auditScale), left: 0, top: 0 },
      {
        input: native,
        left: Math.round(31 + (118 - nativeMeta.width) / 2),
        top: Math.round(78 + (118 - nativeMeta.height) / 2),
      },
      {
        input: audit,
        left: Math.round(211 + (118 - auditMeta.width) / 2),
        top: Math.round(66 + (142 - auditMeta.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const rows = Math.ceil(ITEMS.length / COLS);
  const width = PADDING * 2 + COLS * CARD_W + (COLS - 1) * GAP;
  const height = HEADER_H + PADDING + rows * CARD_H + (rows - 1) * GAP + PADDING;
  const composites = [{ input: sheetHeader(width), left: 0, top: 0 }];

  for (let index = 0; index < ITEMS.length; index += 1) {
    const item = ITEMS[index];
    const { abs, meta } = await readImage(item.rel);
    const card = item.tiny ? await renderTiny(item, abs, meta) : await renderSurface(item, abs, meta);
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    composites.push({
      input: card,
      left: PADDING + col * (CARD_W + GAP),
      top: HEADER_H + PADDING + row * (CARD_H + GAP),
    });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#04100D",
    },
  })
    .composite(composites)
    .png()
    .toFile(OUT);

  console.log(`[brand-logo-proof] PASS - ${OUT}`);
}

main().catch((error) => {
  console.error(`[brand-logo-proof] FAIL - ${error.message}`);
  process.exit(1);
});
