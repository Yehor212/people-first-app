const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const androidSizes = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 },
];

const playStoreSize = 512;

async function generateIcons() {
  const svgSquare = fs.readFileSync(path.join(__dirname, '../public/icon-source.svg'));
  const svgRound = fs.readFileSync(path.join(__dirname, '../public/icon-source-round.svg'));

  const androidResDir = path.join(__dirname, '../android/app/src/main/res');

  // Generate Android icons
  for (const { name, size } of androidSizes) {
    const dir = path.join(androidResDir, name);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Square icon (ic_launcher.png)
    await sharp(svgSquare)
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // Round icon (ic_launcher_round.png)
    await sharp(svgRound)
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // Foreground for adaptive icon
    await sharp(svgSquare)
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`Generated ${name}: ${size}x${size}`);
  }

  // Generate Play Store icon (512x512)
  const outputDir = path.join(__dirname, '../public');

  await sharp(svgSquare)
    .resize(playStoreSize, playStoreSize)
    .png()
    .toFile(path.join(outputDir, 'icon-512.png'));

  console.log(`Generated Play Store icon: ${playStoreSize}x${playStoreSize}`);
  console.log('\nDone! Icons saved to:');
  console.log('- android/app/src/main/res/mipmap-*/');
  console.log('- public/icon-512.png (for Google Play)');
}

generateIcons().catch(console.error);
