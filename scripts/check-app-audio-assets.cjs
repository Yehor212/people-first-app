#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = process.cwd();
const publicSoundsDir = path.join(rootDir, 'public', 'sounds');
const appAudioAssetsPath = path.join(rootDir, 'src', 'lib', 'appAudioAssets.ts');
const appAudioPolicyPath = path.join(rootDir, 'docs', 'audio', 'non-hyperfocus-sound-effects-policy.md');
const generatedProvenancePath = path.join(rootDir, 'docs', 'audio', 'non-hyperfocus-generated-audio-provenance.json');
const thirdPartyNoticesPath = path.join(rootDir, 'THIRD_PARTY_NOTICES.md');
const hyperfocusManifestPath = path.join(rootDir, 'src', 'lib', 'hyperfocusGeneratedAudioManifest.ts');
const docsAssetsDir = path.join(rootDir, 'docs', 'assets');
const packageJsonPath = path.join(rootDir, 'package.json');
const outputAudioQcDir = path.join(rootDir, 'output', 'audio-qc');
const appAudioAssetsReportPath = path.join(outputAudioQcDir, 'app-audio-assets-report.json');

const APPROVED_ROOT_MP3S = new Map([
  ['soft-air-veil.mp3', { gain: 0.18, peakMax: 0.18, rmsMax: 0.04, effectivePeakMax: 0.08, effectiveRmsMax: 0.008, loopDeltaMax: 0.035, startEndRmsDeltaMax: 0.012, transientDeltaMax: 0.16, durationMin: 60, durationMax: 150, sampleRates: [44100], channels: [2] }],
  ['gentle-water-bed.mp3', { gain: 0.36, peakMax: 0.24, rmsMax: 0.06, effectivePeakMax: 0.22, effectiveRmsMax: 0.02, loopDeltaMax: 0.035, startEndRmsDeltaMax: 0.014, decoderThresholds: { ffmpeg: { startEndRmsDeltaMax: 0.0175 } }, transientDeltaMax: 0.2, durationMin: 60, durationMax: 150, sampleRates: [44100], channels: [2] }],
  ['soft-rain-veil.mp3', { gain: 0.32, peakMax: 0.22, rmsMax: 0.055, effectivePeakMax: 0.2, effectiveRmsMax: 0.018, loopDeltaMax: 0.035, startEndRmsDeltaMax: 0.014, transientDeltaMax: 0.2, durationMin: 60, durationMax: 150, sampleRates: [44100], channels: [2] }],
]);

const FORBIDDEN_ROOT_MP3S = [
  'measured-breath.mp3',
  'mixkit-small-waves-harbor-rocks-1208.mp3',
  'fireplace-fx-56636.mp3',
  'cafe-noise-32940.mp3',
  'mixkit-wildlife-environment-in-a-river-2456.wav',
  'mixkit-small-waves-harbor-rocks-1208.wav',
  'mixkit-underwater-transmitter-hum-2135.wav',
  'mixkit-calm-thunderstorm-in-the-jungle-2415.wav',
];

const EXPECTED_ASSETS = new Map([
  ['soft-air-veil', { family: 'entry', publicPath: 'sounds/soft-air-veil.mp3' }],
  ['orb-ambience', { family: 'orb', publicPath: 'sounds/gentle-water-bed.mp3' }],
  ['diary-reflection-loop', { family: 'diary', publicPath: 'sounds/soft-rain-veil.mp3' }],
  ['focus-forest', { family: 'focus', publicPath: 'sounds/hyperfocus/hyperfocus-forest-deep.mp3' }],
  ['focus-rain', { family: 'focus', publicPath: 'sounds/hyperfocus/hyperfocus-rain-deep.mp3' }],
  ['focus-ocean', { family: 'focus', publicPath: 'sounds/hyperfocus/hyperfocus-ocean-deep.mp3' }],
  ['focus-fireplace', { family: 'focus', publicPath: 'sounds/hyperfocus/hyperfocus-fireplace-deep.mp3' }],
  ['focus-river', { family: 'focus', publicPath: 'sounds/hyperfocus/hyperfocus-river-deep.mp3' }],
  ['focus-wind', { family: 'focus', publicPath: 'sounds/hyperfocus/hyperfocus-wind-deep.mp3' }],
]);

const EXPECTED_NON_HYPERFOCUS_ASSET_IDS = [
  'soft-air-veil',
  'orb-ambience',
  'diary-reflection-loop',
];

const EXPECTED_FORBIDDEN_ACTION_IDS = [
  'routineTap',
  'tabChange',
  'pickerMovement',
  'drawerOpen',
  'validationError',
];

const REQUIRED_POLICY_MARKERS = [
  'WCAG 2.2 Audio Control',
  'MDN autoplay',
  'Apple Human Interface Guidelines',
  'Android audio focus',
  'Android notification channels',
  'Non-Hyperfocus',
  'Forbidden Routine Sounds',
  'does not introduce V2 XP behavior',
  'Generated Non-Hyperfocus Asset Provenance',
  'UNVERIFIED',
];

const STALE_RUNTIME_STRINGS = [
  'focus-cafe',
  'sounds/cafe-noise-32940.mp3',
  'sounds/measured-breath.mp3',
  'sounds/mixkit-small-waves-harbor-rocks-1208.mp3',
  'sounds/fireplace-fx-56636.mp3',
  'sounds/mixkit-wildlife-environment-in-a-river-2456.mp3',
  'sounds/polished-stone-and-paper.mp3',
  'sounds/v2-diary-reflection-loop.mp3',
  'sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.mp3',
  'sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.wav',
  'sounds/mixkit-small-waves-harbor-rocks-1208.wav',
  'sounds/mixkit-wildlife-environment-in-a-river-2456.wav',
  'sounds/mixkit-underwater-transmitter-hum-2135.mp3',
];

const TEXT_OUTPUT_ARTIFACT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.csv',
  '.d',
  '.html',
  '.htm',
  '.ini',
  '.js',
  '.json',
  '.jsx',
  '.map',
  '.md',
  '.mjs',
  '.plist',
  '.properties',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

function fail(message, details = {}) {
  console.error('[app-audio-qc] FAIL - ' + message);
  if (Object.keys(details).length > 0) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) fail(message, details);
}

function parseCliOptions(argv) {
  if (argv.length === 0) return { writeReport: false };
  if (argv.length === 1 && argv[0] === '--write-report') return { writeReport: true };
  if (argv[0] === '--write-report' && argv.length > 1) {
    throw new Error('--write-report writes to output/audio-qc/app-audio-assets-report.json and does not accept a path');
  }
  throw new Error('unknown app audio QC option: ' + argv.join(' '));
}

function validateCommandLine(argv = process.argv.slice(2)) {
  return parseCliOptions(argv);
}

function parseAssets(source) {
  const assets = [];
  const re = /makeAsset\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(source))) {
    assets.push({ id: match[1], family: match[2], publicPath: match[3] });
  }
  return assets;
}

function parseStringArrayConst(source, name) {
  const match = new RegExp('export const ' + name + ' = \\[([\\s\\S]*?)\\]').exec(source);
  assert(Boolean(match), 'missing exported string array constant', { name });
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function parseObjectIdsFromConst(source, name) {
  const match = new RegExp('export const ' + name + ':[\\s\\S]*?= \\[([\\s\\S]*?)\\];').exec(source);
  assert(Boolean(match), 'missing exported object array constant', { name });
  return [...match[1].matchAll(/id:\s*"([^"]+)"/g)].map((item) => item[1]);
}

function assertSameStringArray(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message, { expected, actual });
}

function checkSourceBackedPolicy() {
  assert(fs.existsSync(appAudioPolicyPath), 'non-Hyperfocus sound policy doc is missing', {
    path: path.relative(rootDir, appAudioPolicyPath),
  });
  const policy = fs.readFileSync(appAudioPolicyPath, 'utf8');
  for (const marker of REQUIRED_POLICY_MARKERS) {
    assert(policy.includes(marker), 'non-Hyperfocus sound policy doc is missing required marker', { marker });
  }
}


function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function canonicalGeneratedDuplicateMp3Name(fileName) {
  const match = /^(.*) \d+(\.mp3)$/i.exec(fileName);
  return match ? match[1] + match[2] : null;
}

function canonicalGeneratedDuplicateDirectoryName(directoryName) {
  const match = /^(.*) \d+$/.exec(directoryName);
  return match ? match[1] : null;
}

function isDirectoryEmpty(directoryPath) {
  return fs.readdirSync(directoryPath).length === 0;
}

function pruneGeneratedRootSoundDuplicates(soundsDir, label) {
  const pruned = [];
  if (!fs.existsSync(soundsDir)) return pruned;

  for (const entry of fs.readdirSync(soundsDir, { withFileTypes: true })) {
    const duplicatePath = path.join(soundsDir, entry.name);

    if (entry.isFile()) {
      const canonicalName = canonicalGeneratedDuplicateMp3Name(entry.name);
      if (!canonicalName) continue;
      const canonicalPath = path.join(soundsDir, canonicalName);
      if (!fs.existsSync(canonicalPath) || !fs.statSync(canonicalPath).isFile()) continue;

      const duplicateHash = sha256File(duplicatePath);
      const canonicalHash = sha256File(canonicalPath);
      assert(duplicateHash === canonicalHash, 'generated root MP3 duplicate differs from canonical file', {
        location: label,
        duplicate: entry.name,
        canonical: canonicalName,
        duplicateHash,
        canonicalHash,
      });
      fs.rmSync(duplicatePath, { force: true });
      pruned.push({ location: label, type: 'root-mp3', duplicate: entry.name, canonical: canonicalName, sha256: canonicalHash });
      continue;
    }

    if (entry.isDirectory()) {
      const canonicalName = canonicalGeneratedDuplicateDirectoryName(entry.name);
      if (!canonicalName) continue;
      const canonicalPath = path.join(soundsDir, canonicalName);
      if (!fs.existsSync(canonicalPath) || !fs.statSync(canonicalPath).isDirectory()) continue;

      assert(isDirectoryEmpty(duplicatePath), 'generated duplicate sound directory is not empty', {
        location: label,
        duplicate: entry.name,
        canonical: canonicalName,
        duplicateFiles: fs.readdirSync(duplicatePath),
      });
      fs.rmSync(duplicatePath, { recursive: true, force: true });
      pruned.push({ location: label, type: 'empty-directory', duplicate: entry.name, canonical: canonicalName });
    }
  }

  return pruned;
}

function checkThirdPartyNotices() {
  assert(fs.existsSync(thirdPartyNoticesPath), 'THIRD_PARTY_NOTICES.md is missing', {
    path: path.relative(rootDir, thirdPartyNoticesPath),
  });
  const notices = fs.readFileSync(thirdPartyNoticesPath, 'utf8');
  const manifest = fs.readFileSync(hyperfocusManifestPath, 'utf8');
  const hyperfocusUsesMixkit = /provider:\s*["']Mixkit["']/i.test(manifest);
  const hyperfocusUsesBigSoundBank = /provider:\s*["']BigSoundBank \/ LaSonotheque["']/i.test(manifest);

  if (hyperfocusUsesMixkit) {
    for (const marker of [
      'MixKit — Hyperfocus Nature Sound Effects',
      'public/sounds/hyperfocus/',
      'src/lib/hyperfocusGeneratedAudioManifest.ts',
      'docs/audio/hyperfocus-generated-audio-provenance.json',
      'https://mixkit.co/license/',
      'forest, rain, ocean/sea, river, and wind',
    ]) {
      assert(notices.includes(marker), 'THIRD_PARTY_NOTICES.md is missing Hyperfocus MixKit coverage', { marker });
    }
  }

  if (hyperfocusUsesBigSoundBank) {
    for (const marker of [
      'BigSoundBank / LaSonotheque — Hyperfocus Fireplace Sound Effects',
      'https://bigsoundbank.com/fireplace-4-s2856.html',
      'https://bigsoundbank.com/licenses.html',
      'public/sounds/hyperfocus/hyperfocus-fireplace-',
    ]) {
      assert(notices.includes(marker), 'THIRD_PARTY_NOTICES.md is missing Hyperfocus BigSoundBank coverage', { marker });
    }
  }
}

function checkGeneratedProvenance() {
  assert(fs.existsSync(generatedProvenancePath), 'generated non-Hyperfocus audio provenance is missing', {
    path: path.relative(rootDir, generatedProvenancePath),
  });
  const provenance = JSON.parse(fs.readFileSync(generatedProvenancePath, 'utf8'));
  assert(provenance.generationPolicy && provenance.generationPolicy.includes('No third-party samples'),
    'generated provenance must state sample/model provenance', { generationPolicy: provenance.generationPolicy });
  assert(provenance.generatorScript === 'scripts/generate-non-hyperfocus-audio.cjs',
    'generated provenance must point to the local generator script', { generatorScript: provenance.generatorScript });
  assert(provenance.encoder && provenance.encoder.name === 'lamejs' && provenance.encoder.version === '1.2.1',
    'generated provenance must pin the MP3 encoder', { encoder: provenance.encoder });

  const expectedFiles = [...APPROVED_ROOT_MP3S.keys()].sort();
  const actualFiles = (provenance.assets || []).map((asset) => asset.fileName).sort();
  assert(JSON.stringify(actualFiles) === JSON.stringify(expectedFiles), 'generated provenance asset list does not match approved root MP3s', {
    expectedFiles,
    actualFiles,
  });

  for (const asset of provenance.assets || []) {
    assert(asset.parameters && asset.parameters.noThirdPartySamples === true, 'asset provenance must reject third-party samples', asset);
    assert(asset.parameters && asset.parameters.noModelOrAiGeneratedAudioInput === true, 'asset provenance must reject model-generated audio input', asset);
    assert(Array.isArray(asset.parameters.exclusions) && asset.parameters.exclusions.length >= 5, 'asset provenance must list audible exclusions', asset);
    for (const relativePath of [asset.publicPath, asset.deployDocsPath]) {
      const fullPath = path.join(rootDir, relativePath);
      assert(fs.existsSync(fullPath), 'provenance references a missing generated asset', { relativePath });
      assert(sha256File(fullPath) === asset.sha256, 'generated asset SHA-256 does not match provenance', {
        relativePath,
        expected: asset.sha256,
        actual: sha256File(fullPath),
      });
    }
  }
}

function checkPackageScript() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  assert(packageJson.scripts && packageJson.scripts['check:app-audio'] === 'node scripts/check-app-audio-assets.cjs',
    'package.json must expose check:app-audio', {
      actual: packageJson.scripts && packageJson.scripts['check:app-audio'],
    });
  assert(packageJson.scripts && packageJson.scripts['audio:generate-non-hyperfocus'] === 'node scripts/generate-non-hyperfocus-audio.cjs',
    'package.json must expose the deterministic non-Hyperfocus audio generator', {
      actual: packageJson.scripts && packageJson.scripts['audio:generate-non-hyperfocus'],
    });
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function scanCurrentSourceForStaleStrings() {
  const srcDir = path.join(rootDir, 'src');
  const matches = [];
  for (const file of walk(srcDir)) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    if (/\.test\.(ts|tsx)$/.test(file) || file.includes('__tests__')) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const stale of STALE_RUNTIME_STRINGS) {
      if (text.includes(stale)) matches.push({ file: path.relative(rootDir, file), stale });
    }
  }
  assert(matches.length === 0, 'stale runtime audio paths remain in current source', { matches });
}

function checkManifest() {
  const source = fs.readFileSync(appAudioAssetsPath, 'utf8');
  for (const stale of STALE_RUNTIME_STRINGS) {
    assert(!source.includes(stale), 'stale audio path remains in app audio manifest', { stale });
  }

  const assets = parseAssets(source);
  assert(source.includes('APP_AUDIO_NON_HYPERFOCUS_ASSET_IDS'), 'app audio manifest must export non-Hyperfocus asset IDs');
  assert(source.includes('APP_AUDIO_FORBIDDEN_ACTIONS'), 'app audio manifest must export forbidden routine sound actions');
  assert(source.includes('allowedTrigger'), 'app audio action events must include trigger policy metadata');
  assert(source.includes('nonAudioFeedback'), 'app audio action events must include non-audio fallback metadata');
  assert(source.includes('does not introduce current V2 XP behavior'), 'app audio action map must not introduce current V2 XP behavior');
  assert(!source.includes('"levelUp"'), 'app audio manifest must not use levelUp naming while V2 XP is out of scope');

  const nonHyperfocusIds = parseStringArrayConst(source, 'APP_AUDIO_NON_HYPERFOCUS_ASSET_IDS');
  assertSameStringArray(nonHyperfocusIds, EXPECTED_NON_HYPERFOCUS_ASSET_IDS, 'unexpected non-Hyperfocus asset ID list');

  const forbiddenActionIds = parseObjectIdsFromConst(source, 'APP_AUDIO_FORBIDDEN_ACTIONS');
  assertSameStringArray(forbiddenActionIds, EXPECTED_FORBIDDEN_ACTION_IDS, 'unexpected forbidden routine sound action list');

  const actionIds = [...source.matchAll(/makeActionEvent\(\s*"([^"]+)"/g)].map((item) => item[1]);
  assert(!actionIds.includes('levelUp'), 'action sound map must not add a current V2 XP levelUp action', { actionIds });
  assert(actionIds.includes('majorProgressMilestone'), 'action sound map must reserve a neutral major progress milestone action', { actionIds });

  const actualIds = assets.map((asset) => asset.id);
  assert(actualIds.length === EXPECTED_ASSETS.size, 'unexpected current app audio asset count', {
    expected: [...EXPECTED_ASSETS.keys()],
    actual: actualIds,
  });

  for (const [id, expected] of EXPECTED_ASSETS) {
    const actual = assets.find((asset) => asset.id === id);
    assert(Boolean(actual), 'missing expected app audio asset', { id });
    assert(actual.family === expected.family && actual.publicPath === expected.publicPath, 'unexpected app audio asset mapping', {
      id,
      expected,
      actual,
    });
    const assetFile = path.join(rootDir, 'public', expected.publicPath);
    assert(fs.existsSync(assetFile), 'app audio asset file is missing', { id, publicPath: expected.publicPath });
  }

  for (const id of nonHyperfocusIds) {
    const asset = assets.find((item) => item.id === id);
    assert(Boolean(asset), 'non-Hyperfocus asset ID is missing from manifest assets', { id });
    assert(asset.family !== 'focus', 'non-Hyperfocus asset cannot be in the focus family', asset);
    assert(!asset.publicPath.includes('hyperfocus/'), 'non-Hyperfocus asset cannot point into Hyperfocus files', asset);
  }

  const focusAssets = assets.filter((asset) => asset.family === 'focus');
  assert(focusAssets.length === 6, 'V2 focus library should expose six approved nature families', { focusAssets });
  for (const asset of focusAssets) {
    assert(asset.publicPath.startsWith('sounds/hyperfocus/'), 'focus asset bypasses Hyperfocus V2 pack', asset);
  }

  return assets;
}

function readRootFileInventory(soundsDir) {
  if (!fs.existsSync(soundsDir)) return null;
  return fs.readdirSync(soundsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function readRootMp3Inventory(soundsDir) {
  const files = readRootFileInventory(soundsDir);
  if (!files) return null;
  return files.filter((name) => name.endsWith('.mp3')).sort();
}

function checkRootInventory() {
  const expected = [...APPROVED_ROOT_MP3S.keys()].sort();
  const checked = [];
  const generatedRootDuplicatePrunes = [];
  const locations = [
    { label: 'public', dir: publicSoundsDir, required: true, generated: false },
    { label: 'docs', dir: path.join(rootDir, 'docs', 'sounds'), required: true, generated: false },
    { label: 'dist', dir: path.join(rootDir, 'dist', 'sounds'), required: false, generated: true },
    { label: 'android', dir: path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'sounds'), required: false, generated: true },
    { label: 'ios', dir: path.join(rootDir, 'ios', 'App', 'App', 'public', 'sounds'), required: false, generated: true },
  ];

  for (const location of locations) {
    if (location.generated) {
      generatedRootDuplicatePrunes.push(...pruneGeneratedRootSoundDuplicates(location.dir, location.label));
    }

    const allRootFiles = readRootFileInventory(location.dir);
    const rootMp3s = readRootMp3Inventory(location.dir);
    if (!rootMp3s || !allRootFiles) {
      assert(!location.required, 'required sound inventory is missing', location);
      continue;
    }
    const forbidden = allRootFiles.filter((name) => FORBIDDEN_ROOT_MP3S.includes(name));
    assert(forbidden.length === 0, 'forbidden stale non-Hyperfocus root sound files remain', {
      location: location.label,
      forbidden,
    });
    assert(JSON.stringify(rootMp3s) === JSON.stringify(expected), 'unexpected non-Hyperfocus root MP3 inventory', {
      location: location.label,
      expected,
      actual: rootMp3s,
      allRootFiles,
    });
    checked.push({ location: location.label, rootMp3s });
  }

  return { checked, generatedRootDuplicatePrunes };
}

function collectDesktopTargetFiles() {
  const files = [];
  const bundleDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle');
  const depsDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'deps');
  const releaseExecutable = path.join(rootDir, 'src-tauri', 'target', 'release', 'zenflow-desktop');
  const releaseDependencyFile = path.join(rootDir, 'src-tauri', 'target', 'release', 'zenflow-desktop.d');

  if (fs.existsSync(bundleDir)) walk(bundleDir, files);
  if (fs.existsSync(releaseExecutable)) files.push(releaseExecutable);
  if (fs.existsSync(releaseDependencyFile)) files.push(releaseDependencyFile);
  if (fs.existsSync(depsDir)) {
    for (const file of walk(depsDir)) {
      if (file.endsWith('.d')) files.push(file);
    }
  }

  return files;
}

function scanDesktopTargetForStaleStrings() {
  const files = collectDesktopTargetFiles();
  const matches = [];

  for (const file of files) {
    const buffer = fs.readFileSync(file);
    for (const stale of STALE_RUNTIME_STRINGS) {
      if (buffer.includes(Buffer.from(stale))) {
        matches.push({ file: path.relative(rootDir, file), stale });
      }
    }
  }

  assert(matches.length === 0, 'stale audio paths remain in Desktop/Tauri generated package artifacts', { matches });
  return files.map((file) => path.relative(rootDir, file));
}


function collectDocsAssetFiles() {
  if (!fs.existsSync(docsAssetsDir)) return [];
  return walk(docsAssetsDir, []).filter((file) => /\.(?:js|css|html)$/.test(file));
}

function scanDocsAssetsForStaleStrings() {
  const files = collectDocsAssetFiles();
  const matches = [];

  for (const file of files) {
    const buffer = fs.readFileSync(file);
    for (const stale of STALE_RUNTIME_STRINGS) {
      if (buffer.includes(Buffer.from(stale))) {
        matches.push({ file: path.relative(rootDir, file), stale });
      }
    }
  }

  assert(matches.length === 0, 'stale audio paths remain in docs/assets generated bundles', { matches });
  return files.map((file) => path.relative(rootDir, file));
}

function isVolatileOutputRace(error) {
  return error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

function walkVolatileOutputArtifacts(dir, files = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (isVolatileOutputRace(error)) return files;
    throw error;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkVolatileOutputArtifacts(full, files);
    else files.push(full);
  }
  return files;
}

function isExistingOutputFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch (error) {
    if (isVolatileOutputRace(error)) return false;
    throw error;
  }
}

function collectOutputArtifactFiles(
  outputDir = path.join(rootDir, 'output'),
  reportPath = appAudioAssetsReportPath,
) {
  if (!fs.existsSync(outputDir)) return [];
  return walkVolatileOutputArtifacts(outputDir, []).filter((file) =>
    isExistingOutputFile(file) && path.resolve(file) !== path.resolve(reportPath));
}

function isTextOutputArtifact(file) {
  return TEXT_OUTPUT_ARTIFACT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function inspectOutputArtifacts({
  outputDir = path.join(rootDir, 'output'),
  reportPath = appAudioAssetsReportPath,
  forbiddenRootMp3s = FORBIDDEN_ROOT_MP3S,
  staleRuntimeStrings = STALE_RUNTIME_STRINGS,
} = {}) {
  const files = collectOutputArtifactFiles(outputDir, reportPath);
  const scannedFiles = [];
  const textFiles = [];
  const matches = [];
  for (const file of files) {
    scannedFiles.push(file);
    const relative = path.relative(rootDir, file);
    const baseName = path.basename(file);
    if (forbiddenRootMp3s.includes(baseName)) {
      matches.push({ file: relative, stale: baseName });
      continue;
    }
    if (!isTextOutputArtifact(file)) continue;

    let buffer;
    try {
      buffer = fs.readFileSync(file);
    } catch (error) {
      if (isVolatileOutputRace(error)) continue;
      throw error;
    }

    textFiles.push(file);
    for (const stale of staleRuntimeStrings) {
      if (buffer.includes(Buffer.from(stale))) {
        matches.push({ file: relative, stale });
      }
    }
  }
  return { matches, scannedFiles, textFiles };
}

function scanOutputArtifactsForStaleStrings(options) {
  const inspection = inspectOutputArtifacts(options);
  const { matches, scannedFiles, textFiles } = inspection;
  assert(matches.length === 0, 'stale audio paths remain in output artifacts', { matches });
  return {
    files: scannedFiles.map((file) => path.relative(rootDir, file)),
    textFiles: textFiles.map((file) => path.relative(rootDir, file)),
  };
}

function commandExists(name) {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(lookup, [name], { encoding: 'utf8' });
  return result.status === 0;
}

function readChunk(buffer, offset) {
  return buffer.toString('ascii', offset, offset + 4);
}

function parseWavMetrics(wavPath) {
  const buffer = fs.readFileSync(wavPath);
  assert(readChunk(buffer, 0) === 'RIFF' && readChunk(buffer, 8) === 'WAVE', 'converted audio is not a PCM WAV', { wavPath });
  let offset = 12;
  let fmt = null;
  let dataStart = -1;
  let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const id = readChunk(buffer, offset);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      dataStart = body;
      dataSize = size;
      break;
    }
    offset = body + size + (size % 2);
  }
  assert(fmt && dataStart >= 0, 'WAV is missing fmt/data chunks', { wavPath });
  assert(fmt.audioFormat === 1 && fmt.bitsPerSample === 16, 'QC expects 16-bit PCM output', { wavPath, fmt });

  const bytesPerSample = fmt.bitsPerSample / 8;
  const sampleCount = dataSize / bytesPerSample;
  const frameCount = sampleCount / fmt.channels;
  let peak = 0;
  let sumSquares = 0;
  let transientDelta = 0;
  let previousByChannel = new Array(fmt.channels).fill(0);
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let ch = 0; ch < fmt.channels; ch += 1) {
      const sampleIndex = (frame * fmt.channels) + ch;
      const value = buffer.readInt16LE(dataStart + sampleIndex * bytesPerSample) / 32768;
      const abs = Math.abs(value);
      if (abs > peak) peak = abs;
      sumSquares += value * value;
      if (frame > 0) transientDelta = Math.max(transientDelta, Math.abs(value - previousByChannel[ch]));
      previousByChannel[ch] = value;
    }
  }

  const windowFrames = Math.min(2048, Math.floor(frameCount / 4));
  let loopDiff = 0;
  let loopSamples = 0;
  let startSquares = 0;
  let endSquares = 0;
  for (let frame = 0; frame < windowFrames; frame += 1) {
    for (let ch = 0; ch < fmt.channels; ch += 1) {
      const firstIndex = ((frame * fmt.channels) + ch) * bytesPerSample;
      const lastIndex = (((frameCount - windowFrames + frame) * fmt.channels) + ch) * bytesPerSample;
      const first = buffer.readInt16LE(dataStart + firstIndex) / 32768;
      const last = buffer.readInt16LE(dataStart + lastIndex) / 32768;
      loopDiff += Math.abs(first - last);
      startSquares += first * first;
      endSquares += last * last;
      loopSamples += 1;
    }
  }

  return {
    channels: fmt.channels,
    sampleRate: fmt.sampleRate,
    durationSeconds: frameCount / fmt.sampleRate,
    peak,
    rms: Math.sqrt(sumSquares / sampleCount),
    loopDelta: loopSamples > 0 ? loopDiff / loopSamples : 0,
    startEndRmsDelta: loopSamples > 0 ? Math.abs(Math.sqrt(startSquares / loopSamples) - Math.sqrt(endSquares / loopSamples)) : 0,
    transientDelta,
  };
}

function selectAudioDecoder() {
  const requested = process.env.ZENFLOW_AUDIO_QC_DECODER;
  if (requested) {
    assert(['afconvert', 'ffmpeg'].includes(requested), 'unsupported audio QC decoder requested', { requested });
    assert(commandExists(requested), requested + ' is required for MP3 metric QC on this machine');
    return requested;
  }
  if (commandExists('afconvert')) return 'afconvert';
  if (commandExists('ffmpeg')) return 'ffmpeg';
  fail('afconvert or ffmpeg is required for MP3 metric QC on this machine');
}

function decodeMp3ToWav(decoder, source, wavPath, fileName) {
  const command = decoder === 'afconvert'
    ? { bin: 'afconvert', args: [source, '-f', 'WAVE', '-d', 'LEI16', wavPath] }
    : { bin: 'ffmpeg', args: ['-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-f', 'wav', '-acodec', 'pcm_s16le', wavPath] };
  const result = spawnSync(command.bin, command.args, { encoding: 'utf8' });
  assert(result.status === 0, decoder + ' failed to decode MP3', { fileName, stderr: result.stderr, stdout: result.stdout });
}

function convertAndMeasure(fileName) {
  const source = path.join(publicSoundsDir, fileName);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-audio-qc-'));
  const wavPath = path.join(tempDir, fileName.replace(/\.mp3$/, '.wav'));
  const decoder = selectAudioDecoder();
  try {
    decodeMp3ToWav(decoder, source, wavPath, fileName);
    return { decoder, ...parseWavMetrics(wavPath) };
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

function resolveMetricLimit(thresholds, decoder, metricName) {
  return (thresholds.decoderThresholds && thresholds.decoderThresholds[decoder] && thresholds.decoderThresholds[decoder][metricName]) || thresholds[metricName];
}

function checkMetrics(rootMp3s) {
  const metrics = [];
  for (const fileName of rootMp3s) {
    const thresholds = APPROVED_ROOT_MP3S.get(fileName);
    const measured = convertAndMeasure(fileName);
    const effectivePeak = measured.peak * thresholds.gain;
    const effectiveRms = measured.rms * thresholds.gain;
    metrics.push({
      fileName,
      gain: thresholds.gain,
      effectivePeak,
      effectiveRms,
      ...measured,
    });
    assert(thresholds.channels.includes(measured.channels), 'audio channel count is outside approved set', { fileName, measured, thresholds });
    assert(thresholds.sampleRates.includes(measured.sampleRate), 'audio sample rate is outside approved set', { fileName, measured, thresholds });
    assert(measured.durationSeconds >= thresholds.durationMin && measured.durationSeconds <= thresholds.durationMax,
      'audio duration is outside approved range', { fileName, measured, thresholds });
    assert(measured.peak <= resolveMetricLimit(thresholds, measured.decoder, 'peakMax'), 'audio peak is too hot', { fileName, measured, thresholds });
    assert(measured.rms <= resolveMetricLimit(thresholds, measured.decoder, 'rmsMax'), 'audio RMS is too dense for calm V2 ambience', { fileName, measured, thresholds });
    assert(effectivePeak <= resolveMetricLimit(thresholds, measured.decoder, 'effectivePeakMax'), 'runtime-adjusted peak is too hot for the V2 surface', {
      fileName,
      measured,
      effectivePeak,
      thresholds,
    });
    assert(effectiveRms <= resolveMetricLimit(thresholds, measured.decoder, 'effectiveRmsMax'), 'runtime-adjusted RMS is too dense for the V2 surface', {
      fileName,
      measured,
      effectiveRms,
      thresholds,
    });
    assert(measured.loopDelta <= resolveMetricLimit(thresholds, measured.decoder, 'loopDeltaMax'), 'loop seam is too abrupt for repeated ambience', { fileName, measured, thresholds });
    assert(measured.startEndRmsDelta <= resolveMetricLimit(thresholds, measured.decoder, 'startEndRmsDeltaMax'), 'start/end loudness shift is too abrupt for repeated ambience', { fileName, measured, thresholds });
    assert(measured.transientDelta <= resolveMetricLimit(thresholds, measured.decoder, 'transientDeltaMax'), 'decoded MP3 contains abrupt sample-to-sample transients', { fileName, measured, thresholds });
  }
  return metrics;
}

function writeReportIfRequested(report, options, reportPath = appAudioAssetsReportPath) {
  if (!options.writeReport) return;
  const outputRoot = outputAudioQcDir;
  const absolute = reportPath;
  const relativeToOutput = path.relative(outputRoot, absolute);
  if (reportPath === appAudioAssetsReportPath) {
    assert(Boolean(relativeToOutput) && !relativeToOutput.startsWith('..') && !path.isAbsolute(relativeToOutput),
      '--write-report target must stay under output/audio-qc');
  }
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, JSON.stringify(report, null, 2) + '\n');
}

function main(options = validateCommandLine()) {
  checkSourceBackedPolicy();
  checkThirdPartyNotices();
  checkGeneratedProvenance();
  checkPackageScript();
  const assets = checkManifest();
  scanCurrentSourceForStaleStrings();
  const inventoryResult = checkRootInventory();
  const inventories = inventoryResult.checked;
  const generatedRootDuplicatePrunes = inventoryResult.generatedRootDuplicatePrunes;
  const desktopTargets = scanDesktopTargetForStaleStrings();
  const docsAssets = scanDocsAssetsForStaleStrings();
  const outputArtifacts = scanOutputArtifactsForStaleStrings();
  const publicInventory = inventories.find((inventory) => inventory.location === 'public');
  const rootMp3s = publicInventory ? publicInventory.rootMp3s : [];
  const metrics = checkMetrics(rootMp3s);
  const report = {
    generatedAt: new Date().toISOString(),
    status: 'PASS',
    assetCount: assets.length,
    rootMp3Count: rootMp3s.length,
    rootMp3s,
    shippedInventories: inventories,
    generatedRootDuplicatePrunes,
    desktopTargetsScanned: desktopTargets,
    docsAssetsScanned: docsAssets,
    outputArtifactScanScope: {
      root: 'output',
      excluded: ['output/audio-qc/app-audio-assets-report.json'],
      contentExtensions: [...TEXT_OUTPUT_ARTIFACT_EXTENSIONS].sort(),
    },
    outputArtifactsScannedCount: outputArtifacts.files.length,
    outputTextArtifactsScannedCount: outputArtifacts.textFiles.length,
    metrics,
  };
  writeReportIfRequested(report, options);
  console.log('[app-audio-qc] PASS - ' + assets.length + ' current app assets, ' + rootMp3s.length + ' non-Hyperfocus root MP3s checked across ' + inventories.length + ' inventories; ' + generatedRootDuplicatePrunes.length + ' generated duplicate sound artifacts pruned; ' + desktopTargets.length + ' Desktop/Tauri generated target files scanned; ' + docsAssets.length + ' docs/assets bundles scanned; ' + outputArtifacts.files.length + ' output artifact filenames checked; ' + outputArtifacts.textFiles.length + ' text artifacts content-scanned');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

module.exports = {
  inspectOutputArtifacts,
  isTextOutputArtifact,
  parseCliOptions,
  writeReportIfRequested,
};
