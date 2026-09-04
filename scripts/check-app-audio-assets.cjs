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
const eveningCollectionReviewPath = path.join(rootDir, 'docs', 'audio', 'zenflow-evening-collection-review.json');
const cloudlightLicensePath = path.join(rootDir, 'docs', 'audio', 'cloudlight-evening-license.md');
const thirdPartyNoticesPath = path.join(rootDir, 'THIRD_PARTY_NOTICES.md');
const hyperfocusManifestPath = path.join(rootDir, 'src', 'lib', 'hyperfocusGeneratedAudioManifest.ts');
const docsAssetsDir = path.join(rootDir, 'docs', 'assets');
const packageJsonPath = path.join(rootDir, 'package.json');
const outputAudioQcDir = path.join(rootDir, 'output', 'audio-qc');
const appAudioAssetsReportPath = path.join(outputAudioQcDir, 'app-audio-assets-report.json');

const APPROVED_ROOT_MP3S = new Map([
  ['soft-air-veil.mp3', { gain: 0.18, peakMin: 0.12, peakMax: 0.32, rmsMin: 0.055, rmsMax: 0.11, audibleRmsMin: 0.05, audibleBandEnergyRatioMin: 0.75, dcOffsetAbsMax: 0.001, effectivePeakMin: 0.02, effectivePeakMax: 0.08, effectiveRmsMin: 0.009, effectiveRmsMax: 0.022, boundaryDeltaMax: 0.01, boundarySlopeDeltaMax: 0.01, startEndRmsDeltaMax: 0.012, decoderThresholds: { ffmpeg: { boundaryDeltaMax: 0.016, boundarySlopeDeltaMax: 0.012 } }, transientDeltaMax: 0.16, durationMin: 60, durationMax: 150, sampleRates: [44100], channels: [2] }],
  ['cloudlight-evening-loop.mp3', { gain: 0.18, peakMin: 0.08, peakMax: 0.28, rmsMin: 0.032, rmsMax: 0.065, audibleRmsMin: 0.03, audibleBandEnergyRatioMin: 0.9, dcOffsetAbsMax: 0.001, effectivePeakMin: 0.012, effectivePeakMax: 0.06, effectiveRmsMin: 0.005, effectiveRmsMax: 0.014, boundaryDeltaMax: 0.01, boundarySlopeDeltaMax: 0.01, startEndRmsDeltaMax: 0.015, transientDeltaMax: 0.12, durationMin: 149.8, durationMax: 150.3, sampleRates: [44100], channels: [2] }],
  ['gentle-water-bed.mp3', { gain: 0.36, peakMin: 0.12, peakMax: 0.34, rmsMin: 0.05, rmsMax: 0.095, audibleRmsMin: 0.045, audibleBandEnergyRatioMin: 0.7, dcOffsetAbsMax: 0.001, effectivePeakMin: 0.04, effectivePeakMax: 0.22, effectiveRmsMin: 0.017, effectiveRmsMax: 0.04, boundaryDeltaMax: 0.01, boundarySlopeDeltaMax: 0.01, startEndRmsDeltaMax: 0.014, decoderThresholds: { ffmpeg: { startEndRmsDeltaMax: 0.0175 } }, transientDeltaMax: 0.2, durationMin: 60, durationMax: 150, sampleRates: [44100], channels: [2] }],
  ['soft-rain-veil.mp3', { gain: 0.32, peakMin: 0.12, peakMax: 0.34, rmsMin: 0.045, rmsMax: 0.09, audibleRmsMin: 0.04, audibleBandEnergyRatioMin: 0.75, dcOffsetAbsMax: 0.001, effectivePeakMin: 0.035, effectivePeakMax: 0.2, effectiveRmsMin: 0.014, effectiveRmsMax: 0.035, boundaryDeltaMax: 0.01, boundarySlopeDeltaMax: 0.01, startEndRmsDeltaMax: 0.014, decoderThresholds: { ffmpeg: { boundaryDeltaMax: 0.013, boundarySlopeDeltaMax: 0.019 } }, transientDeltaMax: 0.2, durationMin: 60, durationMax: 150, sampleRates: [44100], channels: [2] }],
]);

const EVENING_MUSIC_MASTERS = new Map([
  ['lantern-air.mp3', { id: 'lantern-air', title: 'Lantern Air' }],
  ['rain-on-paper.mp3', { id: 'rain-on-paper', title: 'Rain On Paper' }],
  ['indigo-dusk.mp3', { id: 'indigo-dusk', title: 'Indigo Dusk' }],
  ['quiet-courtyard.mp3', { id: 'quiet-courtyard', title: 'Quiet Courtyard' }],
  ['moonlit-water.mp3', { id: 'moonlit-water', title: 'Moonlit Water' }],
  ['cedar-mist.mp3', { id: 'cedar-mist', title: 'Cedar Mist' }],
  ['glass-bell-dawn.mp3', { id: 'glass-bell-dawn', title: 'Glass Bell Dawn' }],
  ['moss-garden.mp3', { id: 'moss-garden', title: 'Moss Garden' }],
  ['after-rain.mp3', { id: 'after-rain', title: 'After Rain' }],
]);
const EXPECTED_EVENING_MUSIC_FILES = [...EVENING_MUSIC_MASTERS.keys()].sort();
const EXPECTED_EVENING_COLLECTION_MASTER_IDS = [
  'cloudlight-evening-loop',
  ...[...EVENING_MUSIC_MASTERS.values()].map((master) => master.id),
];

const APPROVED_FEEDBACK_MP3S = new Map([
  ['feedback-complete.mp3', { id: 'feedback-complete', gain: 0.4, durationMin: 0.5, durationMax: 0.85 }],
  ['feedback-milestone.mp3', { id: 'feedback-milestone', gain: 0.45, durationMin: 0.6, durationMax: 0.95 }],
  ['feedback-notification.mp3', { id: 'feedback-notification', gain: 0.2, durationMin: 0.7, durationMax: 1.0 }],
  ['feedback-streak.mp3', { id: 'feedback-streak', gain: 0.45, durationMin: 0.7, durationMax: 1.05 }],
  ['feedback-success.mp3', { id: 'feedback-success', gain: 0.35, durationMin: 0.4, durationMax: 0.7 }],
]);
const EXPECTED_FEEDBACK_MP3_FILES = [...APPROVED_FEEDBACK_MP3S.keys()].sort();
const FEEDBACK_METRIC_LIMITS = Object.freeze({
  sampleRates: [44100],
  channels: [2],
  peakMin: 0.02,
  peakMax: 0.22,
  rmsMin: 0.01,
  rmsMax: 0.065,
  audibleBandEnergyRatioMin: 0.985,
  highFrequencyEnergyRatioMax: 0.3,
  dcOffsetAbsMax: 0.001,
  boundaryDeltaMax: 0.01,
  boundarySlopeDeltaMax: 0.02,
  transientDeltaMax: 0.08,
});
const CLOUDLIGHT_LOOP_METRIC_LIMITS = Object.freeze({
  sampleRates: [44100],
  channels: [2],
  durationMin: 149.8,
  durationMax: 150.3,
  peakMin: 0.08,
  peakMax: 0.28,
  rmsMin: 0.032,
  rmsMax: 0.065,
  audibleRmsMin: 0.03,
  audibleBandEnergyRatioMin: 0.9,
  highFrequencyEnergyRatioMax: 0.25,
  dcOffsetAbsMax: 0.001,
  transientDeltaMax: 0.12,
  stereoCorrelationMin: 0.15,
  monoFoldDownEnergyRatioMin: 0.3,
  monoFoldDownEnergyRatioMax: 1.25,
  boundaryDeltaMax: 0.01,
  boundarySlopeDeltaMax: 0.01,
  startEndRmsDeltaMax: 0.015,
  maxSilentWindowSecondsMax: 0.5,
  clippedSampleCountMax: 0,
  pinnedFullScaleSampleCountMax: 0,
  approximateTruePeak4xMax: 0.35,
  longWindowRmsDbSpreadMax: 9,
  loopDeltaMax: 0.03,
  equalPowerSeamRmsRatioMin: 0.7,
  equalPowerSeamRmsRatioMax: 1.5,
  equalPowerSeamTransientDeltaMax: 0.12,
});

const EXPECTED_GENERATED_AUDIO_PROVENANCE = new Map([
  ['soft-air-veil.mp3', {
    id: 'soft-air-veil',
    family: 'ambience',
    publicPath: 'public/sounds/soft-air-veil.mp3',
    deployDocsPath: 'docs/sounds/soft-air-veil.mp3',
    runtimeGain: 0.18,
  }],
  ['cloudlight-evening-loop.mp3', {
    id: 'cloudlight-evening-loop',
    family: 'ambience',
    publicPath: 'public/sounds/cloudlight-evening-loop.mp3',
    deployDocsPath: 'docs/sounds/cloudlight-evening-loop.mp3',
    runtimeGain: 0.18,
    deterministicSpec: 'original-four-section-felt-piano-air-pad-circular-loop',
  }],
  ['gentle-water-bed.mp3', {
    id: 'gentle-water-bed',
    family: 'ambience',
    publicPath: 'public/sounds/gentle-water-bed.mp3',
    deployDocsPath: 'docs/sounds/gentle-water-bed.mp3',
    runtimeGain: 0.36,
  }],
  ['soft-rain-veil.mp3', {
    id: 'soft-rain-veil',
    family: 'ambience',
    publicPath: 'public/sounds/soft-rain-veil.mp3',
    deployDocsPath: 'docs/sounds/soft-rain-veil.mp3',
    runtimeGain: 0.32,
  }],
  ...[...EVENING_MUSIC_MASTERS].map(([fileName, master]) => [
    fileName,
    {
      id: master.id,
      family: 'music',
      publicPath: 'public/sounds/music/' + fileName,
      deployDocsPath: 'docs/sounds/music/' + fileName,
      runtimeGain: 0.18,
      deterministicSpecPrefix: 'original-evening-collection-',
    },
  ]),
  ...[...APPROVED_FEEDBACK_MP3S].map(([fileName, thresholds]) => [
    fileName,
    {
      id: thresholds.id,
      family: 'feedback',
      publicPath: 'public/sounds/feedback/' + fileName,
      deployDocsPath: 'docs/sounds/feedback/' + fileName,
      runtimeGain: thresholds.gain,
      deterministicSpec: fileName === 'feedback-notification.mp3'
        ? 'fixed-modal-glass-bell-with-cosine-attack-and-exponential-decay'
        : 'fixed-note-sequence-with-cosine-envelopes',
      ...(fileName === 'feedback-notification.mp3'
        ? { nativeAndroidPath: 'android/app/src/main/res/raw/zenflow_furin.wav' }
        : {}),
    },
  ]),
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
  ['cloudlight-evening-loop', { family: 'entry', publicPath: 'sounds/cloudlight-evening-loop.mp3' }],
  ...[...EVENING_MUSIC_MASTERS].map(([fileName, master]) => [
    master.id,
    { family: 'entry', publicPath: 'sounds/music/' + fileName },
  ]),
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
  'cloudlight-evening-loop',
  ...[...EVENING_MUSIC_MASTERS.values()].map((master) => master.id),
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
  'ITU-R BS.1770-5',
  'EBU R 128',
  'MDN autoplay',
  'Apple Human Interface Guidelines',
  'Android audio focus',
  'Android notification channels',
  'Non-Hyperfocus',
  'Forbidden Routine Sounds',
  'does not introduce V2 XP behavior',
  'Generated Non-Hyperfocus Asset Provenance',
  'Audibility and Loop Contract',
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
  const re = /makeAsset\(\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"/g;
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

function findGeneratedDuplicateSoundArtifacts(soundsDir, label) {
  if (!fs.existsSync(soundsDir)) return [];
  const entries = fs.readdirSync(soundsDir, { withFileTypes: true });
  const entryTypes = new Map(entries.map((entry) => [entry.name, entry.isDirectory() ? 'directory' : 'file']));
  const duplicates = [];
  for (const entry of entries) {
    const canonicalName = entry.isFile()
      ? /^(.*) \d+(\.mp3)$/i.exec(entry.name)?.slice(1).join('') ?? null
      : entry.isDirectory()
        ? /^(.*) \d+$/.exec(entry.name)?.[1] ?? null
        : null;
    if (!canonicalName || entryTypes.get(canonicalName) !== entryTypes.get(entry.name)) continue;
    duplicates.push({
      location: label,
      type: entryTypes.get(entry.name),
      duplicate: entry.name,
      canonical: canonicalName,
    });
  }
  return duplicates;
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
      'BigSoundBank / LaSonotheque — Hyperfocus CC0 Nature Sound Effects',
      'https://bigsoundbank.com/licenses.html',
      'public/sounds/hyperfocus/',
      'docs/audio/hyperfocus-runtime-v2-manifest.json',
      'Forest: `3085`, `2749`, `905`',
      'Wind: `904`, `907`, `1450`',
    ]) {
      assert(notices.includes(marker), 'THIRD_PARTY_NOTICES.md is missing Hyperfocus BigSoundBank coverage', { marker });
    }
  }
}

function inspectGeneratedAudioProvenance(assets) {
  const expectedFiles = [...EXPECTED_GENERATED_AUDIO_PROVENANCE.keys()].sort();
  const actualFiles = assets.map((asset) => asset.fileName).sort();
  const expectedSet = new Set(expectedFiles);
  const actualSet = new Set(actualFiles);
  const missing = expectedFiles.filter((fileName) => !actualSet.has(fileName));
  const unexpected = actualFiles.filter((fileName, index) =>
    !expectedSet.has(fileName) || actualFiles.indexOf(fileName) !== index);
  const mismatched = [];

  for (const [fileName, expected] of EXPECTED_GENERATED_AUDIO_PROVENANCE) {
    const asset = assets.find((item) => item.fileName === fileName);
    if (!asset) continue;
    const fields = [];
    if (asset.id !== expected.id) fields.push('id');
    if (asset.publicPath !== expected.publicPath) fields.push('publicPath');
    if (asset.deployDocsPath !== expected.deployDocsPath) fields.push('deployDocsPath');
    if (!/^[a-f0-9]{64}$/.test(asset.sha256 || '')) fields.push('sha256');
    if (!Number.isInteger(asset.bytes) || asset.bytes <= 0) fields.push('bytes');
    if (!asset.parameters || asset.parameters.family !== expected.family) fields.push('parameters.family');
    if (!asset.parameters || asset.parameters.sampleRate !== 44100) fields.push('parameters.sampleRate');
    if (!asset.parameters || asset.parameters.channels !== 2) fields.push('parameters.channels');
    if (!asset.parameters || asset.parameters.runtimeGain !== expected.runtimeGain) fields.push('parameters.runtimeGain');
    if (expected.deterministicSpec && asset.deterministicSpec !== expected.deterministicSpec) {
      fields.push('deterministicSpec');
    }
    if (expected.deterministicSpecPrefix &&
        !String(asset.deterministicSpec || '').startsWith(expected.deterministicSpecPrefix)) {
      fields.push('deterministicSpec');
    }

    if (expected.family === 'feedback') {
      const thresholds = APPROVED_FEEDBACK_MP3S.get(fileName);
      const duration = asset.parameters && asset.parameters.durationSeconds;
      if (!thresholds || !Number.isFinite(duration) ||
          duration < thresholds.durationMin || duration > thresholds.durationMax) {
        fields.push('parameters.durationSeconds');
      }
    }
    if (expected.family === 'music' &&
        (!asset.parameters || asset.parameters.durationSeconds !== 150)) {
      fields.push('parameters.durationSeconds');
    }
    if (expected.nativeAndroidPath) {
      if (asset.nativeAndroidPath !== expected.nativeAndroidPath) fields.push('nativeAndroidPath');
      if (!/^[a-f0-9]{64}$/.test(asset.nativeAndroidSha256 || '')) fields.push('nativeAndroidSha256');
      if (!Number.isInteger(asset.nativeAndroidBytes) || asset.nativeAndroidBytes <= 44) fields.push('nativeAndroidBytes');
    }

    if (fields.length > 0) mismatched.push({ fileName, fields });
  }

  return {
    exact: missing.length === 0 &&
      unexpected.length === 0 &&
      mismatched.length === 0 &&
      actualFiles.length === expectedFiles.length,
    missing,
    unexpected,
    mismatched,
  };
}

function inspectGeneratedAudioRights(provenance, environment) {
  const violations = [];
  const reference = provenance && provenance.rights && provenance.rights.referenceResearch;
  const projectLicense = provenance && provenance.rights && provenance.rights.projectLicense;

  if (!provenance || !String(provenance.generationPolicy || '').includes('No third-party samples')) {
    violations.push('generationPolicy');
  }
  if (!reference || reference.title !== 'Cloudbound Evening') {
    violations.push('referenceResearch.title');
  }
  if (!reference || reference.sourceUrl !== 'https://www.youtube.com/watch?v=cJvhJqgDbKI') {
    violations.push('referenceResearch.sourceUrl');
  }
  if (!reference || reference.useBoundary !== 'high-level mood and app-entry background-music research only') {
    violations.push('referenceResearch.useBoundary');
  }
  if (!reference || reference.sourceAudioImported !== false) {
    violations.push('referenceResearch.sourceAudioImported');
  }
  if (!reference || reference.sourceAudioRetained !== false) {
    violations.push('referenceResearch.sourceAudioRetained');
  }
  if (!reference || reference.samplesCopied !== false) {
    violations.push('referenceResearch.samplesCopied');
  }
  if (!reference || reference.melodyOrHarmonyTranscribed !== false) {
    violations.push('referenceResearch.melodyOrHarmonyTranscribed');
  }

  const rootLicensePresent = Boolean(environment && environment.rootLicensePresent);
  if (!projectLicense || projectLicense.status !== 'ASSET_SPECIFIC_PROPRIETARY_NOTICE') {
    violations.push('projectLicense.status');
  }
  if (!projectLicense || projectLicense.rootLicensePresent !== rootLicensePresent) {
    violations.push('projectLicense.rootLicensePresent');
  }
  if (!projectLicense || projectLicense.copyrightNotice !==
      'Copyright © 2026 Yehor212 / ZenFlow. All rights reserved.') {
    violations.push('projectLicense.copyrightNotice');
  }
  return violations;
}

function inspectEveningCollectionReview(review, provenanceAssets) {
  const violations = [];
  const addViolation = (field) => {
    if (!violations.includes(field)) violations.push(field);
  };
  const provenanceById = new Map(
    (Array.isArray(provenanceAssets) ? provenanceAssets : []).map((asset) => [asset.id, asset]),
  );
  const masters = Array.isArray(review && review.masters) ? review.masters : [];
  const actualIds = masters.map((master) => master && master.id);
  const releaseBoundary = review && review.releaseBoundary;
  const promotionAllowed = releaseBoundary && releaseBoundary.promotionAllowed === true;
  const status = String((releaseBoundary && releaseBoundary.status) || '');

  if (!review || review.schemaVersion !== 1) addViolation('schemaVersion');
  if (!review || review.collectionId !== 'zenflow-evening-collection-v1') addViolation('collectionId');
  if (!review || !review.technicalQc || review.technicalQc.status !== 'PASS') {
    addViolation('technicalQc.status');
  }
  if (!review || !review.technicalQc ||
      review.technicalQc.command !== 'npm run check:app-audio -- --write-report') {
    addViolation('technicalQc.command');
  }
  if (!review || !review.technicalQc ||
      review.technicalQc.report !== 'output/audio-qc/app-audio-assets-report.json') {
    addViolation('technicalQc.report');
  }
  if (!releaseBoundary || !Array.isArray(releaseBoundary.requiredContexts) ||
      JSON.stringify(releaseBoundary.requiredContexts) !== JSON.stringify(['headphones', 'device-speaker'])) {
    addViolation('releaseBoundary.requiredContexts');
  }
  if (!releaseBoundary || releaseBoundary.minimumLoopMinutesPerMaster !== 10) {
    addViolation('releaseBoundary.minimumLoopMinutesPerMaster');
  }
  if (JSON.stringify(actualIds) !== JSON.stringify(EXPECTED_EVENING_COLLECTION_MASTER_IDS)) {
    addViolation('masters.ids');
  }

  for (const expectedId of EXPECTED_EVENING_COLLECTION_MASTER_IDS) {
    const master = masters.find((candidate) => candidate && candidate.id === expectedId);
    const provenance = provenanceById.get(expectedId);
    if (!master) {
      addViolation('masters.' + expectedId);
      continue;
    }
    if (!provenance) {
      addViolation('provenance.' + expectedId);
      continue;
    }
    if (master.path !== provenance.publicPath) addViolation('masters.' + expectedId + '.path');
    if (master.bytes !== provenance.bytes) addViolation('masters.' + expectedId + '.bytes');
    if (master.durationSeconds !== provenance.parameters.durationSeconds) {
      addViolation('masters.' + expectedId + '.durationSeconds');
    }
    if (master.sha256 !== provenance.sha256) addViolation('masters.' + expectedId + '.sha256');
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(master.decision)) {
      addViolation('masters.' + expectedId + '.decision');
    }
    if (!Number.isFinite(master.listenedMinutes) || master.listenedMinutes < 0) {
      addViolation('masters.' + expectedId + '.listenedMinutes');
    }
    if (!Array.isArray(master.contexts) ||
        master.contexts.some((context) => !['headphones', 'device-speaker'].includes(context))) {
      addViolation('masters.' + expectedId + '.contexts');
    }
  }

  if (promotionAllowed) {
    if (status !== 'HUMAN_AUDIO_REVIEW_COMPLETE') addViolation('releaseBoundary.status');
    if (!review || typeof review.reviewer !== 'string' || review.reviewer.trim().length === 0) {
      addViolation('reviewer');
    }
    if (!review || typeof review.reviewedAt !== 'string' || !Number.isFinite(Date.parse(review.reviewedAt))) {
      addViolation('reviewedAt');
    }
    for (const master of masters) {
      if (master.decision !== 'APPROVED') addViolation('masters.' + master.id + '.decision');
      if (master.listenedMinutes < 10) addViolation('masters.' + master.id + '.listenedMinutes');
      if (!Array.isArray(master.contexts) ||
          !['headphones', 'device-speaker'].every((context) => master.contexts.includes(context))) {
        addViolation('masters.' + master.id + '.contexts');
      }
    }
  } else if (status !== 'STOP_PENDING_HUMAN_AUDIO_REVIEW') {
    addViolation('releaseBoundary.status');
  }

  return { violations, promotionAllowed, status };
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
  assert(fs.existsSync(cloudlightLicensePath), 'Cloudlight asset-specific license notice is missing', {
    path: path.relative(rootDir, cloudlightLicensePath),
  });
  const cloudlightLicense = fs.readFileSync(cloudlightLicensePath, 'utf8');
  assert(cloudlightLicense.includes('Copyright © 2026 Yehor212 / ZenFlow. All rights reserved.'),
    'Cloudlight asset-specific license notice is incomplete');
  const rootLicensePresent = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].some((fileName) =>
    fs.existsSync(path.join(rootDir, fileName)));
  const rightsViolations = inspectGeneratedAudioRights(provenance, { rootLicensePresent });
  assert(rightsViolations.length === 0,
    'generated provenance contains unsupported reference-use or project-license claims', {
      rootLicensePresent,
      rightsViolations,
    });

  const provenanceInspection = inspectGeneratedAudioProvenance(provenance.assets || []);
  assert(provenanceInspection.exact,
    'generated provenance asset list must contain four root ambience, nine collection masters, and five feedback assets', {
      expectedFiles: [...EXPECTED_GENERATED_AUDIO_PROVENANCE.keys()].sort(),
      ...provenanceInspection,
  });

  for (const asset of provenance.assets || []) {
    assert(asset.parameters && asset.parameters.noThirdPartySamples === true, 'asset provenance must reject third-party samples', asset);
    assert(asset.parameters && asset.parameters.noModelOrAiGeneratedAudioInput === true, 'asset provenance must reject model-generated audio input', asset);
    assert(Array.isArray(asset.parameters.exclusions) && asset.parameters.exclusions.length >= 5, 'asset provenance must list audible exclusions', asset);
    for (const relativePath of [asset.publicPath, asset.deployDocsPath]) {
      const fullPath = path.join(rootDir, relativePath);
      assert(fs.existsSync(fullPath), 'provenance references a missing generated asset', { relativePath });
      assert(fs.statSync(fullPath).size === asset.bytes, 'generated asset byte count does not match provenance', {
        relativePath,
        expected: asset.bytes,
        actual: fs.statSync(fullPath).size,
      });
      assert(sha256File(fullPath) === asset.sha256, 'generated asset SHA-256 does not match provenance', {
        relativePath,
        expected: asset.sha256,
        actual: sha256File(fullPath),
      });
    }
    if (asset.nativeAndroidPath) {
      const nativePath = path.join(rootDir, asset.nativeAndroidPath);
      assert(fs.existsSync(nativePath), 'generated native notification sound is missing', {
        relativePath: asset.nativeAndroidPath,
      });
      assert(fs.statSync(nativePath).size === asset.nativeAndroidBytes,
        'generated native notification sound byte count does not match provenance', {
          relativePath: asset.nativeAndroidPath,
          expected: asset.nativeAndroidBytes,
          actual: fs.statSync(nativePath).size,
        });
      assert(sha256File(nativePath) === asset.nativeAndroidSha256,
        'generated native notification sound SHA-256 does not match provenance', {
          relativePath: asset.nativeAndroidPath,
          expected: asset.nativeAndroidSha256,
          actual: sha256File(nativePath),
        });
    }
  }
  assert(fs.existsSync(eveningCollectionReviewPath), 'evening collection human-review gate is missing', {
    path: path.relative(rootDir, eveningCollectionReviewPath),
  });
  const eveningCollectionReview = JSON.parse(fs.readFileSync(eveningCollectionReviewPath, 'utf8'));
  const reviewInspection = inspectEveningCollectionReview(eveningCollectionReview, provenance.assets || []);
  assert(reviewInspection.violations.length === 0,
    'evening collection review gate is inconsistent with generated master provenance', reviewInspection);
  return {
    rootLicensePresent,
    projectLicenseStatus: provenance.rights.projectLicense.status,
    referenceTitle: provenance.rights.referenceResearch.title,
    eveningCollectionReview: {
      status: reviewInspection.status,
      promotionAllowed: reviewInspection.promotionAllowed,
    },
  };
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

function inspectExactDirectoryInventory(directory, expectedFiles) {
  const expected = [...expectedFiles].sort();
  const actualFiles = fs.existsSync(directory)
    ? fs.readdirSync(directory, { withFileTypes: true }).map((entry) => entry.name).sort()
    : [];
  const expectedSet = new Set(expected);
  const actualSet = new Set(actualFiles);
  return {
    actualFiles,
    missing: expected.filter((fileName) => !actualSet.has(fileName)),
    unexpected: actualFiles.filter((fileName) => !expectedSet.has(fileName)),
  };
}

function validateExactDirectoryInventory(directory, expectedFiles, label) {
  const inspection = inspectExactDirectoryInventory(directory, expectedFiles);
  if (inspection.missing.length > 0 || inspection.unexpected.length > 0) {
    throw new Error('unexpected feedback inventory at ' + label + ': ' + JSON.stringify(inspection));
  }
  return inspection;
}

function checkRootInventory() {
  const expected = [...APPROVED_ROOT_MP3S.keys()].sort();
  const checked = [];
  const locations = [
    { label: 'public', dir: publicSoundsDir, required: true, generated: false },
    { label: 'docs', dir: path.join(rootDir, 'docs', 'sounds'), required: true, generated: false },
    { label: 'dist', dir: path.join(rootDir, 'dist', 'sounds'), required: false, generated: true },
    { label: 'android', dir: path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'sounds'), required: false, generated: true },
    { label: 'ios', dir: path.join(rootDir, 'ios', 'App', 'App', 'public', 'sounds'), required: false, generated: true },
  ];

  for (const location of locations) {
    if (location.generated) {
      const duplicates = findGeneratedDuplicateSoundArtifacts(location.dir, location.label);
      assert(duplicates.length === 0, 'generated duplicate sound artifacts are not allowed', {
        location: location.label,
        duplicates,
      });
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

  return checked;
}

function checkFeedbackInventory() {
  const checked = [];
  const locations = [
    { label: 'public', soundsDir: publicSoundsDir, required: true },
    { label: 'docs', soundsDir: path.join(rootDir, 'docs', 'sounds'), required: true },
    { label: 'dist', soundsDir: path.join(rootDir, 'dist', 'sounds'), required: false },
    { label: 'android', soundsDir: path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'sounds'), required: false },
    { label: 'ios', soundsDir: path.join(rootDir, 'ios', 'App', 'App', 'public', 'sounds'), required: false },
  ];

  for (const location of locations) {
    if (!fs.existsSync(location.soundsDir)) {
      assert(!location.required, 'required sound inventory is missing', location);
      continue;
    }
    const directory = path.join(location.soundsDir, 'feedback');
    const inventory = validateExactDirectoryInventory(
      directory,
      EXPECTED_FEEDBACK_MP3_FILES,
      location.label + ' feedback',
    );
    checked.push({ location: location.label, feedbackMp3s: inventory.actualFiles });
  }

  return checked;
}

function checkMusicInventory() {
  const checked = [];
  const locations = [
    { label: 'public', soundsDir: publicSoundsDir, required: true },
    { label: 'docs', soundsDir: path.join(rootDir, 'docs', 'sounds'), required: true },
    { label: 'dist', soundsDir: path.join(rootDir, 'dist', 'sounds'), required: false },
    { label: 'android', soundsDir: path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'sounds'), required: false },
    { label: 'ios', soundsDir: path.join(rootDir, 'ios', 'App', 'App', 'public', 'sounds'), required: false },
  ];

  for (const location of locations) {
    if (!fs.existsSync(location.soundsDir)) {
      assert(!location.required, 'required sound inventory is missing', location);
      continue;
    }
    const directory = path.join(location.soundsDir, 'music');
    const inventory = inspectExactDirectoryInventory(directory, EXPECTED_EVENING_MUSIC_FILES);
    assert(inventory.missing.length === 0 && inventory.unexpected.length === 0,
      'unexpected evening music inventory', {
        location: location.label,
        expected: EXPECTED_EVENING_MUSIC_FILES,
        ...inventory,
      });
    checked.push({ location: location.label, musicMp3s: inventory.actualFiles });
  }

  return checked;
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

function parseWavMetrics(wavPath, { measureStrictLoopMetrics = false } = {}) {
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
  let audibleSquares = 0;
  let highFrequencySquares = 0;
  let transientDelta = 0;
  let stereoLeftSquares = 0;
  let stereoRightSquares = 0;
  let stereoCrossProducts = 0;
  let monoFoldDownSquares = 0;
  let clippedSampleCount = 0;
  let pinnedFullScaleSampleCount = 0;
  const silenceWindowFrames = Math.max(1, Math.round(fmt.sampleRate * 0.25));
  let silenceWindowSquares = 0;
  let silenceWindowFrameCount = 0;
  let consecutiveSilentWindows = 0;
  let maxConsecutiveSilentWindows = 0;
  const longWindowFrames = Math.max(1, Math.round(fmt.sampleRate * 3));
  let longWindowSquares = 0;
  let longWindowFrameCount = 0;
  const longWindowRmsValues = [];
  const sampleSumsByChannel = new Array(fmt.channels).fill(0);
  const previousRawByChannel = new Array(fmt.channels).fill(null);
  const highPassStateByChannel = new Array(fmt.channels).fill(0);
  const highPassInputByChannel = new Array(fmt.channels).fill(0);
  const highFrequencyLowPassStateByChannel = new Array(fmt.channels).fill(0);
  const highPassCutoffHz = 20;
  const highPassRc = 1 / (2 * Math.PI * highPassCutoffHz);
  const highPassAlpha = highPassRc / (highPassRc + (1 / fmt.sampleRate));
  const highFrequencyLowPassAlpha = 1 - Math.exp((-2 * Math.PI * 4000) / fmt.sampleRate);
  let previousByChannel = new Array(fmt.channels).fill(0);
  const readNormalizedFrame = (frame, channel) => {
    const sampleIndex = (frame * fmt.channels) + channel;
    return buffer.readInt16LE(dataStart + sampleIndex * bytesPerSample) / 32768;
  };
  for (let frame = 0; frame < frameCount; frame += 1) {
    const frameValues = new Array(fmt.channels).fill(0);
    for (let ch = 0; ch < fmt.channels; ch += 1) {
      const sampleIndex = (frame * fmt.channels) + ch;
      const rawValue = buffer.readInt16LE(dataStart + sampleIndex * bytesPerSample);
      const value = rawValue / 32768;
      frameValues[ch] = value;
      if (Math.abs(rawValue) >= 32767) {
        clippedSampleCount += 1;
        if (previousRawByChannel[ch] === rawValue) pinnedFullScaleSampleCount += 1;
      }
      previousRawByChannel[ch] = rawValue;
      const abs = Math.abs(value);
      if (abs > peak) peak = abs;
      sumSquares += value * value;
      sampleSumsByChannel[ch] += value;
      const audibleValue = highPassAlpha * (
        highPassStateByChannel[ch] + value - highPassInputByChannel[ch]
      );
      highPassStateByChannel[ch] = audibleValue;
      highPassInputByChannel[ch] = value;
      audibleSquares += audibleValue * audibleValue;
      highFrequencyLowPassStateByChannel[ch] += highFrequencyLowPassAlpha * (
        value - highFrequencyLowPassStateByChannel[ch]
      );
      const highFrequencyValue = value - highFrequencyLowPassStateByChannel[ch];
      highFrequencySquares += highFrequencyValue * highFrequencyValue;
      if (frame > 0) transientDelta = Math.max(transientDelta, Math.abs(value - previousByChannel[ch]));
      previousByChannel[ch] = value;
    }
    if (fmt.channels >= 2) {
      const left = frameValues[0];
      const right = frameValues[1];
      stereoLeftSquares += left * left;
      stereoRightSquares += right * right;
      stereoCrossProducts += left * right;
      const mono = (left + right) * 0.5;
      monoFoldDownSquares += mono * mono;
    }
    silenceWindowSquares += frameValues.reduce((sum, value) => sum + value * value, 0);
    longWindowSquares += frameValues.reduce((sum, value) => sum + value * value, 0);
    longWindowFrameCount += 1;
    if (longWindowFrameCount === longWindowFrames) {
      longWindowRmsValues.push(
        Math.sqrt(longWindowSquares / (longWindowFrameCount * fmt.channels)),
      );
      longWindowSquares = 0;
      longWindowFrameCount = 0;
    }
    silenceWindowFrameCount += 1;
    if (silenceWindowFrameCount === silenceWindowFrames || frame === frameCount - 1) {
      const windowRms = Math.sqrt(
        silenceWindowSquares / Math.max(1, silenceWindowFrameCount * fmt.channels),
      );
      if (windowRms < 0.001) {
        consecutiveSilentWindows += 1;
        maxConsecutiveSilentWindows = Math.max(
          maxConsecutiveSilentWindows,
          consecutiveSilentWindows,
        );
      } else {
        consecutiveSilentWindows = 0;
      }
      silenceWindowSquares = 0;
      silenceWindowFrameCount = 0;
    }
  }

  const rms = Math.sqrt(sumSquares / sampleCount);
  const audibleRms = Math.sqrt(audibleSquares / sampleCount);
  const dcOffsetAbs = Math.max(
    ...sampleSumsByChannel.map((sum) => Math.abs(sum / frameCount)),
  );
  const stereoCorrelation = fmt.channels >= 2
    ? stereoCrossProducts / Math.max(
      1e-12,
      Math.sqrt(stereoLeftSquares * stereoRightSquares),
    )
    : 1;
  const stereoMeanSquare = sumSquares / Math.max(1, sampleCount);
  const monoFoldDownMeanSquare = monoFoldDownSquares / Math.max(1, frameCount);
  const monoFoldDownEnergyRatio = fmt.channels >= 2
    ? monoFoldDownMeanSquare / Math.max(1e-12, stereoMeanSquare)
    : 1;
  const maxSilentWindowSeconds = maxConsecutiveSilentWindows *
    (silenceWindowFrames / fmt.sampleRate);
  const longWindowRmsDbValues = longWindowRmsValues
    .filter((value) => value > 1e-9)
    .map((value) => 20 * Math.log10(value));
  const longWindowRmsDbSpread = longWindowRmsDbValues.length >= 2
    ? Math.max(...longWindowRmsDbValues) - Math.min(...longWindowRmsDbValues)
    : 0;

  let approximateTruePeak4x = peak;
  if (measureStrictLoopMetrics && frameCount >= 4 && peak > 0) {
    const fractions = [0.25, 0.5, 0.75];
    for (let frame = 1; frame < frameCount - 2; frame += 1) {
      for (let ch = 0; ch < fmt.channels; ch += 1) {
        const p0 = readNormalizedFrame(frame - 1, ch);
        const p1 = readNormalizedFrame(frame, ch);
        const p2 = readNormalizedFrame(frame + 1, ch);
        const p3 = readNormalizedFrame(frame + 2, ch);
        if (Math.max(Math.abs(p0), Math.abs(p1), Math.abs(p2), Math.abs(p3)) < peak * 0.65) {
          continue;
        }
        for (const t of fractions) {
          const t2 = t * t;
          const t3 = t2 * t;
          const interpolated = 0.5 * (
            (2 * p1) +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3
          );
          approximateTruePeak4x = Math.max(approximateTruePeak4x, Math.abs(interpolated));
        }
      }
    }
  }

  const windowFrames = Math.max(1, Math.min(
    Math.round(fmt.sampleRate * 0.5),
    Math.floor(frameCount / 4),
  ));
  const loopDiffByChannel = new Array(fmt.channels).fill(0);
  const startSquaresByChannel = new Array(fmt.channels).fill(0);
  const endSquaresByChannel = new Array(fmt.channels).fill(0);
  let equalPowerSeamSquares = 0;
  let equalPowerReferenceSquares = 0;
  let equalPowerSeamTransientDelta = 0;
  const previousEqualPowerByChannel = new Array(fmt.channels).fill(0);
  for (let frame = 0; frame < windowFrames; frame += 1) {
    const angle = ((frame + 0.5) / windowFrames) * (Math.PI / 2);
    const endGain = Math.cos(angle);
    const startGain = Math.sin(angle);
    for (let ch = 0; ch < fmt.channels; ch += 1) {
      const firstIndex = ((frame * fmt.channels) + ch) * bytesPerSample;
      const lastIndex = (((frameCount - windowFrames + frame) * fmt.channels) + ch) * bytesPerSample;
      const first = buffer.readInt16LE(dataStart + firstIndex) / 32768;
      const last = buffer.readInt16LE(dataStart + lastIndex) / 32768;
      loopDiffByChannel[ch] += Math.abs(first - last);
      startSquaresByChannel[ch] += first * first;
      endSquaresByChannel[ch] += last * last;
      const mixed = (last * endGain) + (first * startGain);
      equalPowerSeamSquares += mixed * mixed;
      equalPowerReferenceSquares += (first * first + last * last) * 0.5;
      const previous = frame === 0
        ? readNormalizedFrame(Math.max(0, frameCount - windowFrames - 1), ch)
        : previousEqualPowerByChannel[ch];
      equalPowerSeamTransientDelta = Math.max(
        equalPowerSeamTransientDelta,
        Math.abs(mixed - previous),
      );
      previousEqualPowerByChannel[ch] = mixed;
    }
  }
  for (let ch = 0; ch < fmt.channels; ch += 1) {
    const next = readNormalizedFrame(Math.min(frameCount - 1, windowFrames), ch);
    equalPowerSeamTransientDelta = Math.max(
      equalPowerSeamTransientDelta,
      Math.abs(next - previousEqualPowerByChannel[ch]),
    );
  }

  const loopDeltaByChannel = loopDiffByChannel.map((sum) =>
    windowFrames > 0 ? sum / windowFrames : 0);
  const startEndRmsDeltaByChannel = startSquaresByChannel.map((startSquares, ch) =>
    windowFrames > 0
      ? Math.abs(
        Math.sqrt(startSquares / windowFrames) -
        Math.sqrt(endSquaresByChannel[ch] / windowFrames)
      )
      : 0);

  const boundaryDeltaByChannel = [];
  const boundarySlopeDeltaByChannel = [];
  for (let ch = 0; ch < fmt.channels; ch += 1) {
    const readFrame = (frame) => {
      const sampleIndex = (frame * fmt.channels) + ch;
      return buffer.readInt16LE(dataStart + sampleIndex * bytesPerSample) / 32768;
    };
    const first = readFrame(0);
    const second = readFrame(1);
    const penultimate = readFrame(frameCount - 2);
    const last = readFrame(frameCount - 1);
    boundaryDeltaByChannel.push(Math.abs(first - last));
    boundarySlopeDeltaByChannel.push(Math.abs((second - first) - (last - penultimate)));
  }
  const loopDelta = Math.max(...loopDeltaByChannel);
  const boundaryDelta = Math.max(...boundaryDeltaByChannel);
  const boundarySlopeDelta = Math.max(...boundarySlopeDeltaByChannel);
  const startEndRmsDelta = Math.max(...startEndRmsDeltaByChannel);
  const equalPowerSeamRmsRatio = equalPowerReferenceSquares > 1e-12
    ? Math.sqrt(equalPowerSeamSquares / equalPowerReferenceSquares)
    : 1;

  return {
    channels: fmt.channels,
    sampleRate: fmt.sampleRate,
    durationSeconds: frameCount / fmt.sampleRate,
    peak,
    rms,
    audibleRms,
    audibleBandEnergyRatio: sumSquares > 0 ? Math.min(1, audibleSquares / sumSquares) : 0,
    highFrequencyEnergyRatio: sumSquares > 0
      ? Math.min(1, highFrequencySquares / sumSquares)
      : 0,
    dcOffsetAbs,
    stereoCorrelation,
    monoFoldDownEnergyRatio,
    maxSilentWindowSeconds,
    clippedSampleCount,
    pinnedFullScaleSampleCount,
    approximateTruePeak4x,
    approximateTruePeak4xMethod: measureStrictLoopMetrics
      ? '4x-catmull-rom-non-formal'
      : 'not-measured',
    formalTruePeakStatus: 'UNVERIFIED_NON_CONFORMANT_ESTIMATE',
    longWindowRmsDbSpread,
    formalLoudnessStatus: 'UNVERIFIED_NO_BS1770_METER',
    loopDelta,
    loopDeltaByChannel,
    boundaryDelta,
    boundaryDeltaByChannel,
    boundarySlopeDelta,
    boundarySlopeDeltaByChannel,
    startEndRmsDelta,
    startEndRmsDeltaByChannel,
    equalPowerSeamRmsRatio,
    equalPowerSeamTransientDelta,
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

function convertAndMeasure(relativePath, fileName = path.basename(relativePath)) {
  const source = path.join(publicSoundsDir, relativePath);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-audio-qc-'));
  const wavPath = path.join(tempDir, fileName.replace(/\.mp3$/, '.wav'));
  const decoder = selectAudioDecoder();
  try {
    decodeMp3ToWav(decoder, source, wavPath, fileName);
    return {
      decoder,
      ...parseWavMetrics(wavPath, {
        measureStrictLoopMetrics:
          fileName === 'cloudlight-evening-loop.mp3' || EVENING_MUSIC_MASTERS.has(fileName),
      }),
    };
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

function resolveMetricLimit(thresholds, decoder, metricName) {
  return (thresholds.decoderThresholds && thresholds.decoderThresholds[decoder] && thresholds.decoderThresholds[decoder][metricName]) || thresholds[metricName];
}

function inspectAmbienceMetrics(fileName, measured) {
  const thresholds = APPROVED_ROOT_MP3S.get(fileName);
  if (!thresholds) return ['fileName'];

  const effectivePeak = measured.peak * thresholds.gain;
  const effectiveRms = measured.rms * thresholds.gain;
  const violations = [];
  if (!thresholds.channels.includes(measured.channels)) violations.push('channels');
  if (!thresholds.sampleRates.includes(measured.sampleRate)) violations.push('sampleRate');
  if (!Number.isFinite(measured.durationSeconds) ||
      measured.durationSeconds < thresholds.durationMin ||
      measured.durationSeconds > thresholds.durationMax) violations.push('durationSeconds');
  if (!Number.isFinite(measured.peak) ||
      measured.peak < thresholds.peakMin ||
      measured.peak > resolveMetricLimit(thresholds, measured.decoder, 'peakMax')) violations.push('peak');
  if (!Number.isFinite(measured.rms) ||
      measured.rms < thresholds.rmsMin ||
      measured.rms > resolveMetricLimit(thresholds, measured.decoder, 'rmsMax')) violations.push('rms');
  if (!Number.isFinite(measured.audibleRms) ||
      measured.audibleRms < thresholds.audibleRmsMin) violations.push('audibleRms');
  if (!Number.isFinite(measured.audibleBandEnergyRatio) ||
      measured.audibleBandEnergyRatio < thresholds.audibleBandEnergyRatioMin) violations.push('audibleBandEnergyRatio');
  if (!Number.isFinite(measured.dcOffsetAbs) ||
      measured.dcOffsetAbs > thresholds.dcOffsetAbsMax) violations.push('dcOffsetAbs');
  if (!Number.isFinite(effectivePeak) ||
      effectivePeak < thresholds.effectivePeakMin ||
      effectivePeak > resolveMetricLimit(thresholds, measured.decoder, 'effectivePeakMax')) violations.push('effectivePeak');
  if (!Number.isFinite(effectiveRms) ||
      effectiveRms < thresholds.effectiveRmsMin ||
      effectiveRms > resolveMetricLimit(thresholds, measured.decoder, 'effectiveRmsMax')) violations.push('effectiveRms');
  if (!Number.isFinite(measured.boundaryDelta) ||
      measured.boundaryDelta > resolveMetricLimit(thresholds, measured.decoder, 'boundaryDeltaMax')) violations.push('boundaryDelta');
  if (!Number.isFinite(measured.boundarySlopeDelta) ||
      measured.boundarySlopeDelta > resolveMetricLimit(thresholds, measured.decoder, 'boundarySlopeDeltaMax')) violations.push('boundarySlopeDelta');
  if (!Number.isFinite(measured.startEndRmsDelta) ||
      measured.startEndRmsDelta > resolveMetricLimit(thresholds, measured.decoder, 'startEndRmsDeltaMax')) violations.push('startEndRmsDelta');
  if (!Number.isFinite(measured.transientDelta) ||
      measured.transientDelta > resolveMetricLimit(thresholds, measured.decoder, 'transientDeltaMax')) violations.push('transientDelta');
  return violations;
}

function inspectCloudlightLoopMetrics(measured) {
  const thresholds = CLOUDLIGHT_LOOP_METRIC_LIMITS;
  const violations = [];
  if (!thresholds.channels.includes(measured.channels)) violations.push('channels');
  if (!thresholds.sampleRates.includes(measured.sampleRate)) violations.push('sampleRate');
  if (!Number.isFinite(measured.durationSeconds) ||
      measured.durationSeconds < thresholds.durationMin ||
      measured.durationSeconds > thresholds.durationMax) violations.push('durationSeconds');
  if (!Number.isFinite(measured.peak) ||
      measured.peak < thresholds.peakMin ||
      measured.peak > thresholds.peakMax) violations.push('peak');
  if (!Number.isFinite(measured.rms) ||
      measured.rms < thresholds.rmsMin ||
      measured.rms > thresholds.rmsMax) violations.push('rms');
  if (!Number.isFinite(measured.audibleRms) ||
      measured.audibleRms < thresholds.audibleRmsMin) violations.push('audibleRms');
  if (!Number.isFinite(measured.audibleBandEnergyRatio) ||
      measured.audibleBandEnergyRatio < thresholds.audibleBandEnergyRatioMin) {
    violations.push('audibleBandEnergyRatio');
  }
  if (!Number.isFinite(measured.highFrequencyEnergyRatio) ||
      measured.highFrequencyEnergyRatio > thresholds.highFrequencyEnergyRatioMax) {
    violations.push('highFrequencyEnergyRatio');
  }
  if (!Number.isFinite(measured.dcOffsetAbs) ||
      measured.dcOffsetAbs > thresholds.dcOffsetAbsMax) violations.push('dcOffsetAbs');
  if (!Number.isFinite(measured.transientDelta) ||
      measured.transientDelta > thresholds.transientDeltaMax) violations.push('transientDelta');
  if (!Number.isFinite(measured.stereoCorrelation) ||
      measured.stereoCorrelation < thresholds.stereoCorrelationMin) {
    violations.push('stereoCorrelation');
  }
  if (!Number.isFinite(measured.monoFoldDownEnergyRatio) ||
      measured.monoFoldDownEnergyRatio < thresholds.monoFoldDownEnergyRatioMin ||
      measured.monoFoldDownEnergyRatio > thresholds.monoFoldDownEnergyRatioMax) {
    violations.push('monoFoldDownEnergyRatio');
  }
  if (!Number.isFinite(measured.boundaryDelta) ||
      measured.boundaryDelta > thresholds.boundaryDeltaMax) violations.push('boundaryDelta');
  if (!Number.isFinite(measured.boundarySlopeDelta) ||
      measured.boundarySlopeDelta > thresholds.boundarySlopeDeltaMax) {
    violations.push('boundarySlopeDelta');
  }
  if (!Number.isFinite(measured.startEndRmsDelta) ||
      measured.startEndRmsDelta > thresholds.startEndRmsDeltaMax) {
    violations.push('startEndRmsDelta');
  }
  if (!Number.isFinite(measured.maxSilentWindowSeconds) ||
      measured.maxSilentWindowSeconds > thresholds.maxSilentWindowSecondsMax) {
    violations.push('maxSilentWindowSeconds');
  }
  if (!Number.isFinite(measured.clippedSampleCount) ||
      measured.clippedSampleCount > thresholds.clippedSampleCountMax) {
    violations.push('clippedSampleCount');
  }
  if (!Number.isFinite(measured.pinnedFullScaleSampleCount) ||
      measured.pinnedFullScaleSampleCount > thresholds.pinnedFullScaleSampleCountMax) {
    violations.push('pinnedFullScaleSampleCount');
  }
  if (!Number.isFinite(measured.approximateTruePeak4x) ||
      measured.approximateTruePeak4x > thresholds.approximateTruePeak4xMax) {
    violations.push('approximateTruePeak4x');
  }
  if (!Number.isFinite(measured.longWindowRmsDbSpread) ||
      measured.longWindowRmsDbSpread > thresholds.longWindowRmsDbSpreadMax) {
    violations.push('longWindowRmsDbSpread');
  }
  if (!Number.isFinite(measured.loopDelta) ||
      measured.loopDelta > thresholds.loopDeltaMax) {
    violations.push('loopDelta');
  }
  if (!Number.isFinite(measured.equalPowerSeamRmsRatio) ||
      measured.equalPowerSeamRmsRatio < thresholds.equalPowerSeamRmsRatioMin ||
      measured.equalPowerSeamRmsRatio > thresholds.equalPowerSeamRmsRatioMax) {
    violations.push('equalPowerSeamRmsRatio');
  }
  if (!Number.isFinite(measured.equalPowerSeamTransientDelta) ||
      measured.equalPowerSeamTransientDelta > thresholds.equalPowerSeamTransientDeltaMax) {
    violations.push('equalPowerSeamTransientDelta');
  }
  return violations;
}

function checkMetrics(rootMp3s) {
  const metrics = [];
  for (const fileName of rootMp3s) {
    const thresholds = APPROVED_ROOT_MP3S.get(fileName);
    const measured = convertAndMeasure(fileName);
    const effectivePeak = measured.peak * thresholds.gain;
    const effectiveRms = measured.rms * thresholds.gain;
    const ambienceViolations = inspectAmbienceMetrics(fileName, measured);
    const loopViolations = fileName === 'cloudlight-evening-loop.mp3'
      ? inspectCloudlightLoopMetrics(measured)
      : [];
    const violations = [...new Set([...ambienceViolations, ...loopViolations])];
    metrics.push({
      fileName,
      gain: thresholds.gain,
      effectivePeak,
      effectiveRms,
      ...measured,
    });
    assert(violations.length === 0, 'ambience format or decoded metrics are outside the audible calm-sound contract', {
      fileName,
      measured,
      effectivePeak,
      effectiveRms,
      thresholds,
      violations,
    });
  }
  return metrics;
}

function inspectFeedbackMetrics(fileName, measured) {
  const thresholds = APPROVED_FEEDBACK_MP3S.get(fileName);
  if (!thresholds) return ['fileName'];

  const violations = [];
  if (!FEEDBACK_METRIC_LIMITS.channels.includes(measured.channels)) violations.push('channels');
  if (!FEEDBACK_METRIC_LIMITS.sampleRates.includes(measured.sampleRate)) violations.push('sampleRate');
  if (!Number.isFinite(measured.durationSeconds) ||
      measured.durationSeconds < thresholds.durationMin ||
      measured.durationSeconds > thresholds.durationMax) {
    violations.push('durationSeconds');
  }
  if (!Number.isFinite(measured.peak) ||
      measured.peak < FEEDBACK_METRIC_LIMITS.peakMin ||
      measured.peak > FEEDBACK_METRIC_LIMITS.peakMax) {
    violations.push('peak');
  }
  if (!Number.isFinite(measured.rms) ||
      measured.rms < FEEDBACK_METRIC_LIMITS.rmsMin ||
      measured.rms > FEEDBACK_METRIC_LIMITS.rmsMax) {
    violations.push('rms');
  }
  if (!Number.isFinite(measured.audibleBandEnergyRatio) ||
      measured.audibleBandEnergyRatio < FEEDBACK_METRIC_LIMITS.audibleBandEnergyRatioMin) {
    violations.push('audibleBandEnergyRatio');
  }
  if (!Number.isFinite(measured.highFrequencyEnergyRatio) ||
      measured.highFrequencyEnergyRatio > FEEDBACK_METRIC_LIMITS.highFrequencyEnergyRatioMax) {
    violations.push('highFrequencyEnergyRatio');
  }
  if (!Number.isFinite(measured.dcOffsetAbs) ||
      measured.dcOffsetAbs > FEEDBACK_METRIC_LIMITS.dcOffsetAbsMax) {
    violations.push('dcOffsetAbs');
  }
  if (!Number.isFinite(measured.boundaryDelta) ||
      measured.boundaryDelta > FEEDBACK_METRIC_LIMITS.boundaryDeltaMax) {
    violations.push('boundaryDelta');
  }
  if (!Number.isFinite(measured.boundarySlopeDelta) ||
      measured.boundarySlopeDelta > FEEDBACK_METRIC_LIMITS.boundarySlopeDeltaMax) {
    violations.push('boundarySlopeDelta');
  }
  if (!Number.isFinite(measured.transientDelta) ||
      measured.transientDelta > FEEDBACK_METRIC_LIMITS.transientDeltaMax) {
    violations.push('transientDelta');
  }
  return violations;
}

function checkFeedbackMetrics(feedbackMp3s) {
  const metrics = [];
  for (const fileName of feedbackMp3s) {
    const thresholds = APPROVED_FEEDBACK_MP3S.get(fileName);
    const measured = convertAndMeasure(path.join('feedback', fileName), fileName);
    const violations = inspectFeedbackMetrics(fileName, measured);
    const effectivePeak = measured.peak * thresholds.gain;
    const effectiveRms = measured.rms * thresholds.gain;
    metrics.push({
      fileName,
      gain: thresholds.gain,
      effectivePeak,
      effectiveRms,
      ...measured,
    });
    assert(violations.length === 0, 'feedback cue format or decoded metrics are outside the approved short UI-cue contract', {
      fileName,
      measured,
      thresholds: {
        ...FEEDBACK_METRIC_LIMITS,
        durationMin: thresholds.durationMin,
        durationMax: thresholds.durationMax,
      },
      violations,
    });
  }
  return metrics;
}

function checkMusicMetrics(musicMp3s) {
  const metrics = [];
  for (const fileName of musicMp3s) {
    const measured = convertAndMeasure(path.join('music', fileName), fileName);
    const violations = inspectCloudlightLoopMetrics(measured);
    metrics.push({ fileName, gain: 0.18, ...measured });
    assert(violations.length === 0,
      'evening music format or decoded metrics are outside the calm loop contract', {
        fileName,
        measured,
        thresholds: CLOUDLIGHT_LOOP_METRIC_LIMITS,
        violations,
      });
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
  const rights = checkGeneratedProvenance();
  checkPackageScript();
  const assets = checkManifest();
  scanCurrentSourceForStaleStrings();
  const inventories = checkRootInventory();
  const feedbackInventories = checkFeedbackInventory();
  const musicInventories = checkMusicInventory();
  const desktopTargets = scanDesktopTargetForStaleStrings();
  const docsAssets = scanDocsAssetsForStaleStrings();
  const outputArtifacts = scanOutputArtifactsForStaleStrings();
  const publicInventory = inventories.find((inventory) => inventory.location === 'public');
  const rootMp3s = publicInventory ? publicInventory.rootMp3s : [];
  const publicFeedbackInventory = feedbackInventories.find((inventory) => inventory.location === 'public');
  const feedbackMp3s = publicFeedbackInventory ? publicFeedbackInventory.feedbackMp3s : [];
  const publicMusicInventory = musicInventories.find((inventory) => inventory.location === 'public');
  const musicMp3s = publicMusicInventory ? publicMusicInventory.musicMp3s : [];
  const metrics = checkMetrics(rootMp3s);
  const feedbackMetrics = checkFeedbackMetrics(feedbackMp3s);
  const musicMetrics = checkMusicMetrics(musicMp3s);
  const report = {
    generatedAt: new Date().toISOString(),
    status: 'PASS',
    assetCount: assets.length,
    rootMp3Count: rootMp3s.length,
    rootMp3s,
    shippedInventories: inventories,
    feedbackMp3Count: feedbackMp3s.length,
    feedbackMp3s,
    shippedFeedbackInventories: feedbackInventories,
    musicMp3Count: musicMp3s.length,
    musicMp3s,
    shippedMusicInventories: musicInventories,
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
    feedbackMetrics,
    musicMetrics,
    rights,
  };
  writeReportIfRequested(report, options);
  console.log('[app-audio-qc] PASS - ' + assets.length + ' current app assets, ' + rootMp3s.length + ' non-Hyperfocus root MP3s checked across ' + inventories.length + ' inventories; ' + musicMp3s.length + ' evening music masters checked across ' + musicInventories.length + ' inventories; ' + feedbackMp3s.length + ' feedback MP3s checked across ' + feedbackInventories.length + ' inventories; generated duplicate sound artifacts are not allowed; ' + desktopTargets.length + ' Desktop/Tauri generated target files scanned; ' + docsAssets.length + ' docs/assets bundles scanned; ' + outputArtifacts.files.length + ' output artifact filenames checked; ' + outputArtifacts.textFiles.length + ' text artifacts content-scanned');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

module.exports = {
  EXPECTED_FEEDBACK_MP3_FILES,
  inspectAmbienceMetrics,
  inspectCloudlightLoopMetrics,
  inspectFeedbackMetrics,
  inspectGeneratedAudioProvenance,
  inspectGeneratedAudioRights,
  inspectEveningCollectionReview,
  inspectOutputArtifacts,
  isTextOutputArtifact,
  parseWavMetrics,
  parseCliOptions,
  validateExactDirectoryInventory,
  writeReportIfRequested,
};
