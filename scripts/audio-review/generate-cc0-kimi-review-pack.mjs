#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  SAMPLE_RATE, CHANNELS, BITRATE, GENERATOR_VERSION, STATUS,
  FAMILIES, LEVELS, EXPECTED_FILE_NAMES, OFFICIAL_LICENSE_URL,
  SOURCE_CACHE_VERSION, SOURCE_MANIFEST, ASSET_DEFINITIONS, outputRelativePath,
} from "./cc0-kimi-audio-config.mjs";
import { sha256, renderFirstPartyAsset, measureDecoded, calculateFamilyDistinctness } from "./cc0-kimi-audio-core.mjs";
import { executable, downloadFile, probeAudio, decodeAudio, encodePcmMp3, buildSourceLoop, validateAsset } from "./cc0-kimi-audio-ffmpeg.mjs";

export { STATUS, EXPECTED_FILE_NAMES, SOURCE_MANIFEST, ASSET_DEFINITIONS };
export { renderFirstPartyAsset };

function fail(message) {
  throw new Error(`[cc0-kimi-audio] ${message}`);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function buildRightsLedger(provenance, sourceEvidence) {
  const entries = provenance.map((entry) => ({
    fileName: entry.fileName,
    sha256: entry.sha256,
    sourceType: entry.sourceType,
    sourceKey: entry.sourceKey,
    sourceLicense: entry.sourceType.startsWith("CC0") ? "CC0-1.0 / public-domain equivalent" : "No third-party audio input",
    thirdPartyAudioInputs: entry.sourceType.startsWith("CC0"),
    recoveredKimiBinaryInputs: false,
    aiGeneratedAudioInputs: false,
    rightsStatus: "DOCUMENTED_BY_RECORDED_SOURCE_BASIS",
  }));
  return {
    schemaVersion: 2,
    status: STATUS,
    sourceRightsDocumented: true,
    releaseAuthorization: false,
    assetCount: entries.length,
    basis: [
      "CC0-derived files use only the exact BigSoundBank source recordings recorded in source-evidence.json.",
      "First-party procedural files use deterministic mathematical synthesis and no third-party audio input.",
      "No recovered Kimi MP3/WAV, spectrogram-derived signal, voice, MIDI, stock library outside the recorded CC0 sources, or AI-generated audio input is used.",
    ],
    officialLicenseUrl: OFFICIAL_LICENSE_URL,
    formalLegalReview: "UNVERIFIED",
    humanListening: "UNVERIFIED",
    sources: sourceEvidence,
    entries,
  };
}

function writeRightsNotice(outputDir, sourceEvidence) {
  const sourceRows = Object.entries(sourceEvidence)
    .map(([key, item]) => `| ${key} | ${item.title} (#${item.soundNumber}) | ${item.author} | CC0 | ${item.pageUrl} | \`${item.sha256}\` |`)
    .join("\n");
  fs.writeFileSync(
    path.join(outputDir, "RIGHTS_AND_PROVENANCE.md"),
    `# ZenFlow source-rights-documented Kimi-role audio reconstruction\n\n` +
      `Status: **${STATUS}**\n\n` +
      `This pack reconstructs the 26 useful Kimi audio roles without using any recovered Kimi audio binary or derivative signal. It contains 20 CC0-derived environmental files and 6 deterministic first-party procedural files.\n\n` +
      `## Rights basis\n\n` +
      `BigSoundBank states on each selected source page that the recording is released under CC0/public-domain-equivalent terms, may be edited and redistributed, and may be used commercially. The exact downloaded MP3 bytes are bound below by SHA-256. Attribution is not required by the source pages, but is retained here for audit quality.\n\n` +
      `Official license page: ${OFFICIAL_LICENSE_URL}\n\n` +
      `| Key | Source | Author | License | Page | Source SHA-256 |\n| --- | --- | --- | --- | --- | --- |\n${sourceRows}\n\n` +
      `## First-party procedural files\n\n` +
      `- \`soft-air-veil.mp3\`\n` +
      `- \`feedback-success.mp3\`\n` +
      `- \`feedback-complete.mp3\`\n` +
      `- \`feedback-streak.mp3\`\n` +
      `- \`feedback-milestone.mp3\`\n` +
      `- \`feedback-notification.mp3\`\n\n` +
      `They are generated from fixed numeric seeds, oscillators, cyclic value-noise fields, and envelopes. They use no recorded or model-generated audio input.\n\n` +
      `## Remaining acceptance boundary\n\n` +
      `Rights provenance and objective decoded-audio checks can pass without establishing subjective sound quality. Human listening, physical-device playback, and formal legal review remain unverified until separately recorded against the exact output hashes.\n`
  );
}

function writeListeningChecklist(outputDir, provenance) {
  const rows = provenance
    .map((entry) => `| \`${entry.fileName}\` | \`${entry.sha256}\` | UNREVIEWED | |`)
    .join("\n");
  fs.writeFileSync(
    path.join(outputDir, "HUMAN_LISTENING_CHECKLIST.md"),
    `# Human listening acceptance — exact-hash gate\n\n` +
      `1. Use neutral headphones and a phone speaker at low and moderate volume.\n` +
      `2. Repeat every feedback cue at least ten times.\n` +
      `3. Loop every Hyperfocus and long ambience file for at least ten minutes.\n` +
      `4. Reject speech, music, beat, alarm resemblance, harsh clicks, foreground scares, obvious seams, fatigue, or incorrect soft/deep/intense order.\n` +
      `5. Acceptance applies only to the exact SHA-256 shown below.\n\n` +
      `| File | SHA-256 | Decision | Notes |\n| --- | --- | --- | --- |\n${rows}\n`
  );
}

export async function buildReviewPack({ outputDir, sourceCacheDir } = {}) {
  if (!outputDir) fail("outputDir is required");
  const ffmpeg = executable("ffmpeg");
  const ffprobe = executable("ffprobe");
  const absoluteOutput = path.resolve(outputDir);
  const cacheDir = path.resolve(sourceCacheDir || path.join(absoluteOutput, ".source-cache"));
  fs.rmSync(path.join(absoluteOutput, "audio"), { recursive: true, force: true });
  fs.rmSync(path.join(absoluteOutput, "evidence"), { recursive: true, force: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(absoluteOutput, { recursive: true });

  const sourceEvidence = {};
  for (const [key, item] of Object.entries(SOURCE_MANIFEST)) {
    const sourcePath = path.join(cacheDir, `${String(item.soundNumber).padStart(4, "0")}.mp3`);
    let bytes;
    if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).size >= 32_000) {
      bytes = fs.readFileSync(sourcePath);
    } else {
      bytes = await downloadFile(item.mp3Url, sourcePath);
    }
    const probe = probeAudio(sourcePath, ffprobe.name);
    sourceEvidence[key] = {
      ...item,
      cacheVersion: SOURCE_CACHE_VERSION,
      sha256: sha256(bytes),
      bytes: bytes.length,
      probe,
    };
  }

  const provenance = [];
  const qc = [];
  for (const definition of ASSET_DEFINITIONS) {
    const relativePath = outputRelativePath(definition);
    const destination = path.join(absoluteOutput, relativePath);
    if (definition.sourceType === "CC0-derived-field-recording") {
      const sourceItem = SOURCE_MANIFEST[definition.sourceKey];
      const sourcePath = path.join(cacheDir, `${String(sourceItem.soundNumber).padStart(4, "0")}.mp3`);
      buildSourceLoop({
        definition,
        sourceFile: sourcePath,
        outputFile: destination,
        ffmpeg: ffmpeg.name,
      });
    } else if (definition.sourceType === "first-party-deterministic-procedural-synthesis") {
      encodePcmMp3(renderFirstPartyAsset(definition), destination, ffmpeg.name, {
        title: definition.id,
        artist: "ZenFlow / Yehor212",
        comment: `First-party deterministic synthesis; no recorded or AI audio input; ${GENERATOR_VERSION}`,
      });
    } else {
      fail(`unsupported asset definition: ${definition.id}`);
    }

    const probe = probeAudio(destination, ffprobe.name);
    const decoded = decodeAudio(destination, ffmpeg.name);
    const metrics = measureDecoded(decoded);
    validateAsset(definition, destination, probe, metrics);
    const bytes = fs.readFileSync(destination);
    provenance.push({
      assetId: definition.id,
      fileName: definition.fileName,
      category: definition.category,
      role: definition.role,
      relativePath: relativePath.split(path.sep).join("/"),
      sha256: sha256(bytes),
      bytes: bytes.length,
      generatorVersion: GENERATOR_VERSION,
      sourceType: definition.sourceType,
      sourceKey: definition.sourceKey,
      sourceSha256: definition.sourceKey ? sourceEvidence[definition.sourceKey].sha256 : null,
      sourcePageUrl: definition.sourceKey ? SOURCE_MANIFEST[definition.sourceKey].pageUrl : null,
      sourceLicense: definition.sourceKey ? SOURCE_MANIFEST[definition.sourceKey].license : "No third-party audio input",
      recoveredKimiBinaryInputs: false,
      aiGeneratedAudioInputs: false,
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      family: definition.family ?? null,
      level: definition.level ?? null,
      looped: definition.looped,
    });
    qc.push({
      assetId: definition.id,
      fileName: definition.fileName,
      probe,
      decodedMetrics: metrics,
      status: "PASS",
    });
  }

  const intensityProgression = {};
  for (const family of FAMILIES) {
    const scores = LEVELS.map(
      (level) => qc.find((entry) => entry.assetId === `${family}:${level}`).decodedMetrics.intensityScore
    );
    const gaps = [rounded(scores[1] - scores[0], 4), rounded(scores[2] - scores[1], 4)];
    if (gaps.some((gap) => gap < 3)) {
      fail(`${family} intensity progression gaps ${gaps.join(", ")} are below 3`);
    }
    intensityProgression[family] = { order: LEVELS, scores, gaps, status: "PASS" };
  }

  const familyDistinctness = calculateFamilyDistinctness(qc);
  const rightsLedger = buildRightsLedger(provenance, sourceEvidence);
  const verification = {
    schemaVersion: 2,
    status: "PASS",
    rightsStatus: STATUS,
    sourceRightsDocumented: true,
    releaseAuthorization: false,
    assetCount: provenance.length,
    exactInventory:
      provenance.map((entry) => entry.fileName).join("\n") === EXPECTED_FILE_NAMES.join("\n"),
    decodedQcCount: qc.length,
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,
    bitrate: BITRATE,
    intensityProgression,
    familyDistinctness,
    runtimeModified: false,
    humanListening: "UNVERIFIED",
    platformPlayback: {
      web: "UNVERIFIED",
      pwa: "UNVERIFIED",
      android: "UNVERIFIED",
      ios: "UNVERIFIED",
      desktop: "UNVERIFIED",
    },
    toolchain: {
      node: process.version,
      ffmpeg: ffmpeg.version,
      ffprobe: ffprobe.version,
    },
  };
  if (!verification.exactInventory || provenance.length !== 26 || qc.length !== 26) {
    fail("verification inventory is incomplete");
  }

  fs.mkdirSync(path.join(absoluteOutput, "evidence"), { recursive: true });
  writeJson(path.join(absoluteOutput, "evidence", "provenance.json"), {
    schemaVersion: 2,
    assets: provenance,
  });
  writeJson(path.join(absoluteOutput, "evidence", "source-evidence.json"), {
    schemaVersion: 2,
    officialLicenseUrl: OFFICIAL_LICENSE_URL,
    sources: sourceEvidence,
  });
  writeJson(path.join(absoluteOutput, "evidence", "rights-ledger.json"), rightsLedger);
  writeJson(path.join(absoluteOutput, "evidence", "decoded-qc.json"), {
    schemaVersion: 2,
    assets: qc,
  });
  writeJson(path.join(absoluteOutput, "evidence", "verification.json"), verification);
  fs.writeFileSync(
    path.join(absoluteOutput, "SHA256SUMS"),
    `${provenance.map((entry) => `${entry.sha256}  ${entry.relativePath}`).join("\n")}\n`
  );
  writeRightsNotice(absoluteOutput, sourceEvidence);
  writeListeningChecklist(absoluteOutput, provenance);
  fs.writeFileSync(
    path.join(absoluteOutput, "README.md"),
    `# ZenFlow source-rights-documented audio reconstruction\n\n` +
      `- Status: ${STATUS}\n` +
      `- Assets: 26\n` +
      `- Hyperfocus: 18 CC0-derived 30-second loops\n` +
      `- Long ambience: one first-party air loop plus two CC0-derived nature loops\n` +
      `- Feedback: five first-party deterministic cues\n` +
      `- Format: 48 kHz stereo MP3 at 128 kbps\n` +
      `- Recovered Kimi audio inputs: none\n` +
      `- Runtime modified: no\n\n` +
      `Objective QC and source-rights provenance passed. Human listening and platform playback remain UNVERIFIED.\n`
  );
  return verification;
}

function parseArguments(argv) {
  const result = { outputDir: "", sourceCacheDir: "" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output") result.outputDir = argv[++index] || "";
    else if (argv[index] === "--source-cache") result.sourceCacheDir = argv[++index] || "";
    else fail(`unknown argument: ${argv[index]}`);
  }
  if (!result.outputDir) fail("--output is required");
  return result;
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entry === import.meta.url) {
  const result = await buildReviewPack(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
