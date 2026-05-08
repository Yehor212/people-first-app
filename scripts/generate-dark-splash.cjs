const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const androidResDir = path.join(__dirname, "../android/app/src/main/res");

const splashTargets = [
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

function splashSvg(width, height) {
  const min = Math.min(width, height);
  const iconSize = Math.round(Math.max(74, Math.min(148, min * 0.18)));
  const iconRadius = Math.round(iconSize * 0.22);
  const iconX = Math.round((width - iconSize) / 2);
  const iconY = Math.round((height - iconSize) / 2 - min * 0.08);
  const brandY = Math.round(iconY + iconSize + min * 0.11);
  const brandSize = Math.round(Math.max(24, Math.min(44, min * 0.08)));

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="76%">
      <stop offset="0%" stop-color="#26231f"/>
      <stop offset="58%" stop-color="#1b1916"/>
      <stop offset="100%" stop-color="#151411"/>
    </radialGradient>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2f9a75"/>
      <stop offset="52%" stop-color="#31b581"/>
      <stop offset="100%" stop-color="#47c48a"/>
    </linearGradient>
    <radialGradient id="iconLight" cx="35%" cy="28%" r="68%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-45%" y="-45%" width="190%" height="190%">
      <feDropShadow dx="0" dy="${Math.max(8, Math.round(min * 0.018))}" stdDeviation="${Math.max(8, Math.round(min * 0.02))}" flood-color="#0f2c23" flood-opacity="0.38"/>
    </filter>
    <filter id="textShadow" x="-30%" y="-60%" width="160%" height="220%">
      <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="#000000" flood-opacity="0.28"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <path d="M0 ${Math.round(height * 0.62)} C ${Math.round(width * 0.28)} ${Math.round(height * 0.48)}, ${Math.round(width * 0.72)} ${Math.round(height * 0.78)}, ${width} ${Math.round(height * 0.52)} L ${width} ${height} L 0 ${height} Z" fill="#211e1a" opacity="0.34"/>
  <line x1="${Math.round(width * 0.12)}" y1="${Math.round(height * 0.54)}" x2="${Math.round(width * 0.88)}" y2="${Math.round(height * 0.54)}" stroke="#4c463d" stroke-opacity="0.16" stroke-width="1"/>

  <g filter="url(#softShadow)">
    <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="${iconRadius}" fill="url(#brand)"/>
    <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="${iconRadius}" fill="url(#iconLight)"/>
    <g transform="translate(${iconX + iconSize * 0.21} ${iconY + iconSize * 0.18}) scale(${iconSize / 34})">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" fill="#ffffff" fill-opacity="0.18" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>

  <text x="50%" y="${brandY}" text-anchor="middle" fill="#eeeae3" font-family="Segoe UI, system-ui, sans-serif" font-size="${brandSize}" font-weight="700" letter-spacing="${Math.max(3, Math.round(brandSize * 0.18))}" filter="url(#textShadow)">ZenFlow</text>
</svg>`;
}

async function generateDarkSplash() {
  for (const target of splashTargets) {
    const outputPath = path.join(androidResDir, target);
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Missing Android splash target: ${target}`);
    }

    const metadata = await sharp(outputPath).metadata();
    const { width, height } = metadata;
    if (!width || !height) {
      throw new Error(`Unable to read dimensions for ${target}`);
    }

    await sharp(Buffer.from(splashSvg(width, height)))
      .png()
      .toFile(outputPath);

    console.log(`Generated ${target}: ${width}x${height}`);
  }
}

generateDarkSplash().catch((error) => {
  console.error(error);
  process.exit(1);
});
