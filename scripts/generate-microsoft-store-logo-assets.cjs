#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "release", "microsoft-store", "assets", "official-logo");
const UPLOAD_PACK = path.join(ROOT, "tmp", "microsoft-store-upload-pack");
const MANIFEST = path.join(OUT, "zenflow-official-store-assets-manifest.json");

const LEAF_BODY = "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z";
const LEAF_STEM = "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12";
const LEAF_DETAIL_SHADOW_MIN_SIZE = 72;
const PHI = 1.61803398875;
const MIN_STORE_LOCKUP_CLEAR_SPACE_RATIO = 0.045;
const STORE_TITLE_VISUAL_ASCENT = 0.76;
const STORE_TITLE_VISUAL_DESCENT = 0.18;
const SQUARE_ART_LOCKUP = {
  plateScale: 0.37,
  plateCenterY: 0.32,
  titleBaselineY: 0.66,
  titleFontScale: 0.092,
};
const POSTER_ART_LOCKUP = {
  plateScale: 0.42,
  plateCenterY: 0.27,
  titleBaselineY: 0.55,
  titleFontScale: 0.095,
  subtitleBaselineY: 0.61,
  subtitleFontScale: 0.029,
  subtitleTrackingScale: 0.0024,
};

const ASSETS = [
  { file: "zenflow-official-logo-source-1024.png", slot: "official vector logo source", width: 1024, height: 1024, type: "tile", iconScale: 0.82 },
  { file: "zenflow-official-app-tile-icon-300.png", slot: "1:1 App tile icon", width: 300, height: 300, type: "tile", iconScale: 0.82 },
  { file: "zenflow-official-app-tile-icon-150.png", slot: "1:1 App tile icon small", width: 150, height: 150, type: "tile", iconScale: 0.82 },
  { file: "zenflow-official-app-tile-icon-71.png", slot: "1:1 App tile icon compact", width: 71, height: 71, type: "tile", iconScale: 0.84 },
  { file: "zenflow-official-box-art-1080.png", slot: "1:1 Box art", width: 1080, height: 1080, type: "square-art" },
  { file: "zenflow-official-box-art-2160.png", slot: "1:1 Box art preferred", width: 2160, height: 2160, type: "square-art" },
  { file: "zenflow-official-poster-art-720x1080.png", slot: "2:3 Poster art", width: 720, height: 1080, type: "poster-art" },
  { file: "zenflow-official-poster-art-1440x2160.png", slot: "2:3 Poster art preferred", width: 1440, height: 2160, type: "poster-art" },
  { file: "zenflow-official-super-hero-art-1920x1080.png", slot: "16:9 Super hero art optional, no text", width: 1920, height: 1080, type: "hero-art" },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function useLeafDetailShadow(size) {
  return size >= LEAF_DETAIL_SHADOW_MIN_SIZE;
}

function lockupMetrics({ width, height, lockup }) {
  const plate = width * lockup.plateScale;
  const titleFont = width * lockup.titleFontScale;
  const plateBottom = height * lockup.plateCenterY + plate / 2;
  const titleTop = height * lockup.titleBaselineY - titleFont * STORE_TITLE_VISUAL_ASCENT;
  const titleBottom = height * lockup.titleBaselineY + titleFont * STORE_TITLE_VISUAL_DESCENT;
  const metrics = {
    plateScale: Number(lockup.plateScale.toFixed(4)),
    plateCenterY: Number(lockup.plateCenterY.toFixed(4)),
    titleBaselineY: Number(lockup.titleBaselineY.toFixed(4)),
    titleFontScale: Number(lockup.titleFontScale.toFixed(4)),
    iconTitleClearSpaceRatio: Number(((titleTop - plateBottom) / height).toFixed(4)),
  };

  if (lockup.subtitleBaselineY && lockup.subtitleFontScale) {
    const subtitleFont = width * lockup.subtitleFontScale;
    const subtitleTop = height * lockup.subtitleBaselineY - subtitleFont * STORE_TITLE_VISUAL_ASCENT;
    metrics.titleSubtitleClearSpaceRatio = Number(((subtitleTop - titleBottom) / height).toFixed(4));
    metrics.subtitleBaselineY = Number(lockup.subtitleBaselineY.toFixed(4));
    metrics.subtitleFontScale = Number(lockup.subtitleFontScale.toFixed(4));
  }

  return metrics;
}

function assertLockupClearSpace(name, metrics) {
  if (metrics.iconTitleClearSpaceRatio < MIN_STORE_LOCKUP_CLEAR_SPACE_RATIO) {
    throw new Error(`${name} icon/title clear-space is ${(metrics.iconTitleClearSpaceRatio * 100).toFixed(1)}%; expected at least ${(MIN_STORE_LOCKUP_CLEAR_SPACE_RATIO * 100).toFixed(1)}%`);
  }
}

function leafGroup({ cx, cy, size, shadow = useLeafDetailShadow(size) }) {
  const scale = size / 24;
  const tx = cx - 12 * scale;
  const ty = cy - 12 * scale;
  const shadowPaths = shadow
    ? `
      <path d="${LEAF_BODY}" fill="rgba(255,255,255,.06)" stroke="#06291f" stroke-opacity=".22" stroke-width="2.28" transform="translate(.13 .22)"/>
      <path d="${LEAF_STEM}" stroke="#06291f" stroke-opacity=".22" stroke-width="2.28" transform="translate(.13 .22)"/>`
    : "";
  return `
    <g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(5)})"
      fill="none" stroke-linecap="round" stroke-linejoin="round">
      ${shadowPaths}
      <path d="${LEAF_BODY}" fill="rgba(255,255,255,.12)" stroke="#fff" stroke-width="2"/>
      <path d="${LEAF_STEM}" stroke="#fff" stroke-width="2"/>
    </g>`;
}

function iconPlate({ cx, cy, size, idPrefix = "zf", opacity = 1 }) {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const radius = size * 0.22;
  const leafSize = size * 0.58;
  return `
    <defs>
      <linearGradient id="${idPrefix}Plate" x1="${x}" y1="${y}" x2="${x + size}" y2="${y + size}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#286f59"/>
        <stop offset=".48" stop-color="#2e9b70"/>
        <stop offset="1" stop-color="#42c386"/>
      </linearGradient>
      <radialGradient id="${idPrefix}PlateHi" cx="${x + size * 0.3}" cy="${y + size * 0.22}" r="${size * 0.72}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#fff" stop-opacity=".16"/>
        <stop offset=".52" stop-color="#fff" stop-opacity=".035"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${idPrefix}PlateShade" cx="${x + size * 0.7}" cy="${y + size * 0.76}" r="${size * 0.64}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#06291f" stop-opacity=".16"/>
        <stop offset="1" stop-color="#06291f" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${idPrefix}Rim" x1="${x}" y1="${y}" x2="${x + size}" y2="${y + size}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#fff" stop-opacity=".22"/>
        <stop offset=".6" stop-color="#fff" stop-opacity=".05"/>
        <stop offset="1" stop-color="#001f18" stop-opacity=".1"/>
      </linearGradient>
    </defs>
    <g opacity="${opacity}">
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="url(#${idPrefix}Plate)"/>
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="url(#${idPrefix}PlateHi)"/>
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="url(#${idPrefix}PlateShade)"/>
      <rect x="${x + 1}" y="${y + 1}" width="${size - 2}" height="${size - 2}" rx="${Math.max(1, radius - 1)}" fill="none" stroke="url(#${idPrefix}Rim)" stroke-width="${Math.max(1, size * 0.004)}"/>
      ${leafGroup({ cx, cy: cy - size * 0.015, size: leafSize })}
    </g>`;
}

function backgroundDefs(width, height, id = "bg") {
  return `
    <defs>
      <linearGradient id="${id}Base" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#071513"/>
        <stop offset=".46" stop-color="#0d2f27"/>
        <stop offset="1" stop-color="#06120f"/>
      </linearGradient>
      <radialGradient id="${id}GlowA" cx="${width * 0.42}" cy="${height * 0.28}" r="${Math.max(width, height) * 0.42}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#2ed99a" stop-opacity=".2"/>
        <stop offset=".44" stop-color="#21b983" stop-opacity=".075"/>
        <stop offset="1" stop-color="#21b983" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${id}GlowB" cx="${width * 0.78}" cy="${height * 0.18}" r="${Math.max(width, height) * 0.36}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#75f0bf" stop-opacity=".06"/>
        <stop offset="1" stop-color="#75f0bf" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${id}Line" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#8cfbd0" stop-opacity=".08"/>
        <stop offset=".5" stop-color="#8cfbd0" stop-opacity=".035"/>
        <stop offset="1" stop-color="#8cfbd0" stop-opacity="0"/>
      </linearGradient>
    </defs>`;
}

function starField(width, height) {
  const stars = [
    [0.18, 0.22, 1.5, 0.34], [0.26, 0.74, 1.1, 0.28], [0.62, 0.16, 1.2, 0.3],
    [0.79, 0.58, 1.6, 0.34], [0.88, 0.27, 0.9, 0.24], [0.38, 0.12, 1.0, 0.22],
  ];
  return stars
    .map(([x, y, r, opacity]) => `<circle cx="${width * x}" cy="${height * y}" r="${r * Math.max(width, height) / 1440}" fill="#dffff5" opacity="${opacity}"/>`)
    .join("\n");
}

function tileSvg(width, height, iconScale) {
  const size = Math.min(width, height) * iconScale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${iconPlate({ cx: width / 2, cy: height / 2, size, idPrefix: "tile" })}
  </svg>`;
}

function squareArtSvg(width, height) {
  const plate = width * SQUARE_ART_LOCKUP.plateScale;
  const metrics = lockupMetrics({ width, height, lockup: SQUARE_ART_LOCKUP });
  assertLockupClearSpace("square art", metrics);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${backgroundDefs(width, height, "sq")}
    <rect width="${width}" height="${height}" fill="url(#sqBase)"/>
    <rect width="${width}" height="${height}" fill="url(#sqGlowA)"/>
    <rect width="${width}" height="${height}" fill="url(#sqGlowB)"/>
    <path d="M${-width * 0.08} ${height * 0.78} C ${width * 0.28} ${height * 0.56}, ${width * 0.45} ${height * 0.22}, ${width * 0.64} ${-height * 0.08}" fill="none" stroke="url(#sqLine)" stroke-width="${width * 0.006}"/>
    <path d="M${width * 0.08} ${height * 1.08} C ${width * 0.34} ${height * 0.78}, ${width * 0.64} ${height * 0.52}, ${width * 1.06} ${height * 0.34}" fill="none" stroke="url(#sqLine)" stroke-width="${width * 0.0022}"/>
    ${starField(width, height)}
    ${iconPlate({ cx: width / 2, cy: height * SQUARE_ART_LOCKUP.plateCenterY, size: plate, idPrefix: "sqIcon" })}
    <text x="${width / 2}" y="${height * SQUARE_ART_LOCKUP.titleBaselineY}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${width * SQUARE_ART_LOCKUP.titleFontScale}" font-weight="800" fill="#f7fff9">ZenFlow</text>
  </svg>`;
}

function posterSvg(width, height) {
  const plate = width * POSTER_ART_LOCKUP.plateScale;
  const metrics = lockupMetrics({ width, height, lockup: POSTER_ART_LOCKUP });
  assertLockupClearSpace("poster art", metrics);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${backgroundDefs(width, height, "poster")}
    <rect width="${width}" height="${height}" fill="url(#posterBase)"/>
    <rect width="${width}" height="${height}" fill="url(#posterGlowA)"/>
    <rect width="${width}" height="${height}" fill="url(#posterGlowB)"/>
    <path d="M${-width * 0.05} ${height * 0.72} C ${width * 0.24} ${height * 0.46}, ${width * 0.44} ${height * 0.18}, ${width * 0.58} ${-height * 0.04}" fill="none" stroke="url(#posterLine)" stroke-width="${width * 0.006}"/>
    ${starField(width, height)}
    ${iconPlate({ cx: width / 2, cy: height * POSTER_ART_LOCKUP.plateCenterY, size: plate, idPrefix: "posterIcon" })}
    <text x="${width / 2}" y="${height * POSTER_ART_LOCKUP.titleBaselineY}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${width * POSTER_ART_LOCKUP.titleFontScale}" font-weight="800" fill="#f7fff9">ZenFlow</text>
    <text x="${width / 2}" y="${height * POSTER_ART_LOCKUP.subtitleBaselineY}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${width * POSTER_ART_LOCKUP.subtitleFontScale}" font-weight="600" letter-spacing="${width * POSTER_ART_LOCKUP.subtitleTrackingScale}" fill="#a7e8d0" opacity=".78">MOOD · HABITS · JOURNAL</text>
  </svg>`;
}

function heroSvg(width, height) {
  const plate = clamp(height / PHI / 1.86, 300, 380);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${backgroundDefs(width, height, "hero")}
    <radialGradient id="heroCenterGlow" cx="${width * 0.5}" cy="${height * 0.44}" r="${height * 0.48}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2ed99a" stop-opacity=".2"/>
      <stop offset=".45" stop-color="#1ab37d" stop-opacity=".07"/>
      <stop offset="1" stop-color="#1ab37d" stop-opacity="0"/>
    </radialGradient>
    <rect width="${width}" height="${height}" fill="url(#heroBase)"/>
    <rect width="${width}" height="${height}" fill="url(#heroGlowB)"/>
    <rect width="${width}" height="${height}" fill="url(#heroCenterGlow)"/>
    <path d="M${-width * 0.05} ${height * 0.77} C ${width * 0.24} ${height * 0.62}, ${width * 0.38} ${height * 0.28}, ${width * 0.55} ${-height * 0.08}" fill="none" stroke="url(#heroLine)" stroke-width="${height * 0.009}"/>
    <path d="M${width * 0.22} ${height * 1.08} C ${width * 0.46} ${height * 0.76}, ${width * 0.72} ${height * 0.44}, ${width * 1.05} ${height * 0.25}" fill="none" stroke="url(#heroLine)" stroke-width="${height * 0.003}"/>
    ${starField(width, height)}
    ${iconPlate({ cx: width / 2, cy: height * 0.45, size: plate, idPrefix: "heroIcon" })}
  </svg>`;
}

function svgForAsset(asset) {
  if (asset.type === "tile") return tileSvg(asset.width, asset.height, asset.iconScale);
  if (asset.type === "square-art") return squareArtSvg(asset.width, asset.height);
  if (asset.type === "poster-art") return posterSvg(asset.width, asset.height);
  if (asset.type === "hero-art") return heroSvg(asset.width, asset.height);
  throw new Error(`Unknown asset type: ${asset.type}`);
}

async function writePng(asset) {
  const output = path.join(OUT, asset.file);
  await sharp(Buffer.from(svgForAsset(asset)))
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toFile(output);
  return {
    file: asset.file,
    slot: asset.slot,
    dimensions: `${asset.width}x${asset.height}`,
    width: asset.width,
    height: asset.height,
    sizeBytes: fs.statSync(output).size,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const assets = [];
  for (const asset of ASSETS) {
    assets.push(await writePng(asset));
  }

  fs.writeFileSync(
    MANIFEST,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: {
          vector: "public/icon-source.svg",
          generator: "scripts/generate-microsoft-store-logo-assets.cjs",
        },
        designNotes: [
          "One clean source generates every Store logo and artwork slot.",
          "The ZenFlow leaf geometry is unchanged; the raster treatment removes filter-box artifacts.",
          "Glow is intentionally restrained so thumbnails stay crisp in dark and light Store surfaces.",
          "Square and poster lockups keep measured clear-space between the icon plate and product wordmark.",
          "The large artwork keeps key imagery in the center/top half and leaves overlay-safe lower space.",
          "Golden-ratio proportions are used only as an optical composition guide; platform readability and safe-zone rules are authoritative.",
        ],
        composition: {
          goldenRatio: PHI,
          minIconTitleClearSpaceRatio: MIN_STORE_LOCKUP_CLEAR_SPACE_RATIO,
          squareArt: lockupMetrics({ width: 1080, height: 1080, lockup: SQUARE_ART_LOCKUP }),
          posterArt: lockupMetrics({ width: 720, height: 1080, lockup: POSTER_ART_LOCKUP }),
        },
        assets,
        constraints: [
          "No SVG filters are used in the official logo source or generated Store assets.",
          "All output files are PNG and under 50 MB.",
          "The 16:9 super hero art contains no product title or text, matching Microsoft Store guidance.",
          "Runtime canonical WebGL orbs are not changed by this Store asset generation.",
        ],
      },
      null,
      2,
    )}\n`,
  );

  if (fs.existsSync(UPLOAD_PACK)) {
    for (const name of [
      "zenflow-official-app-tile-icon-300.png",
      "zenflow-official-box-art-2160.png",
      "zenflow-official-poster-art-1440x2160.png",
      "zenflow-official-super-hero-art-1920x1080.png",
    ]) {
      fs.copyFileSync(path.join(OUT, name), path.join(UPLOAD_PACK, name));
    }
  }

  console.log(`Generated ${assets.length} Microsoft Store logo assets in ${path.relative(ROOT, OUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
