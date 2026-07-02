#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const zlib = require("node:zlib");

const DEFAULT_ROOT = path.join(__dirname, "..");
const SPEC_PATH = "docs/audio/hyperfocus-three-level-generation-spec.json";
const PUBLIC_ASSET_DIR = "public/sounds/hyperfocus";
const PILOT_VARIANT_ID = "fireplace:soft";
const PROVENANCE_PATH = "docs/audio/hyperfocus-generated-audio-provenance.json";
const GENERATION_CREDITS_PATH = "output/audio-qc/hyperfocus-generation-credits-current.json";
const GENERATION_AUTHORIZATION_PATH = "output/audio-qc/hyperfocus-generation-authorization-current.json";
const GENERATION_DECISION_PATH = "output/audio-qc/hyperfocus-generation-decision-current.json";
const SOURCE_COVERAGE_PATH = "output/audio-qc/hyperfocus-source-coverage-current.json";
const PROMPT_POLICY_PATH = "output/audio-qc/hyperfocus-prompt-policy-current.json";
const PROVIDER_CAPABILITY_PATH = "output/audio-qc/hyperfocus-provider-capability-current.json";
const EXPECTED_HYPERFOCUS_LEVEL_IDS = Object.freeze(["soft", "deep", "intense"]);
const PACKAGED_ASSET_TARGETS = Object.freeze([
  Object.freeze({ id: "source-public", platform: "source", label: "Public source assets", relativeDir: PUBLIC_ASSET_DIR }),
  Object.freeze({ id: "web-dist", platform: "web", label: "Vite web/PWA build", relativeDir: "dist/sounds/hyperfocus" }),
  Object.freeze({ id: "ios-capacitor", platform: "ios", label: "Capacitor iOS bundle", relativeDir: "ios/App/App/public/sounds/hyperfocus" }),
  Object.freeze({ id: "ios-simulator-app", platform: "ios", label: "iOS simulator App.app artifact", artifactPath: "output/xcodebuild-hyperfocus-ios/Build/Products/Debug-iphonesimulator/App.app", relativeDir: "output/xcodebuild-hyperfocus-ios/Build/Products/Debug-iphonesimulator/App.app/public/sounds/hyperfocus" }),
  Object.freeze({ id: "android-capacitor", platform: "android", label: "Capacitor Android bundle", relativeDir: "android/app/src/main/assets/public/sounds/hyperfocus" }),
  Object.freeze({ id: "android-debug-apk", platform: "android", label: "Android debug APK artifact", kind: "zip", archivePath: "android/app/build/outputs/apk/debug/app-debug.apk", entryDir: "assets/public/sounds/hyperfocus" }),
  Object.freeze({ id: "desktop-tauri-dist", platform: "desktop", label: "Tauri frontend dist", relativeDir: "dist/sounds/hyperfocus" }),
  Object.freeze({ id: "desktop-tauri-macos-app", platform: "desktop", label: "Tauri macOS App.app embedded asset index", kind: "binary-string-index", artifactPath: "src-tauri/target/release/bundle/macos/ZenFlow.app", binaryPath: "src-tauri/target/release/bundle/macos/ZenFlow.app/Contents/MacOS/zenflow-desktop", entryDir: "sounds/hyperfocus" }),
]);


const PROMPT_POLICY_REQUIREMENTS = Object.freeze([
  Object.freeze({ key: "duration", label: "30-second", pattern: /\b30[- ]second\b|\b30s\b/i }),
  Object.freeze({ key: "seamless", label: "seamless", pattern: /\bseamless\b/i }),
  Object.freeze({ key: "nonMusical", label: "non-musical", pattern: /\bnon[- ]musical\b|\bno music\b|\bno song\b/i }),
  Object.freeze({ key: "loop", label: "loop", pattern: /\bloop\b/i }),
  Object.freeze({ key: "noVoices", label: "no voices, speech, or vocals", pattern: /\bno (?:vocals?|voices?|speech|intelligible speech|intelligible words|clear words)\b|\bno intelligible\b/i }),
  Object.freeze({ key: "noMelody", label: "no melody", pattern: /\bno (?:melody|music|song structure|song)\b|\bnon[- ]musical\b/i }),
  Object.freeze({ key: "noBeat", label: "no beat or rhythm", pattern: /\bno (?:beat|rhythm|music|song structure|song)\b|\bnon[- ]musical\b/i }),
  Object.freeze({ key: "noForegroundAlarm", label: "no foreground alarm, danger, panic, or harsh transient", pattern: /\bno (?:alerts?|alarms?|sirens?|sudden|abrupt|harsh|loud|foreground|panic|danger(?:ous)?|horror|scary|shock|emergency|intelligible|clear words|dominating|spike|cracks?|crashes?|clatter|monster|creature)\b|\bno [^,.]*(?:foreground|dominating|close|shock|spike|cracks?|crashes?|clatter)\b|\bnot dangerous\b|\bsafe\b/i }),
]);

const REJECT_IF_POLICY_REQUIREMENTS = Object.freeze([
  Object.freeze({ key: "musicalRejection", label: "music, melody, beat, rhythm, song, vocal, or voice rejection", pattern: /\b(music|melody|beat|rhythm|song|vocals?|voices?|speech)\b/i }),
  Object.freeze({ key: "foregroundSafetyRejection", label: "foreground, alarm, danger, panic, or harsh transient rejection", pattern: /\b(alarm|siren|danger|panic|loud|sharp|foreground|jumpscare|horn|shouting|screaming|clear words|words|machine|spike|crack|crash|scrape|clatter|horror|creature|beeping|dominating)\b/i }),
]);

const AUDIBLE_REVIEW_REQUIRED_TRUE_FIELDS = Object.freeze([
  "noVocals",
  "noSpeech",
  "noMelody",
  "noBeat",
  "noForegroundDistractions",
  "noSafetyAlarmCues",
  "loopAudiblyClean",
  "matchesPromptFamily",
  "matchesIntensityLevel",
]);

const LIMITS = Object.freeze({
  minDurationSeconds: 27,
  maxDurationSeconds: 33,
  sampleRate: 48000,
  channels: 2,
  minFileBytes: 250000,
  maxFileBytes: 2000000,
  minRmsDbfs: -34,
  maxRmsDbfs: -12,
  maxPeakDbfs: -1,
  maxClippedSamples: 0,
  maxStartEndRmsDeltaDb: 6,
  maxSeamMeanAbsDiff: 0.05,
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function toPosixPath(value) {
  return String(value).split(path.sep).join(path.posix.sep);
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32Buffer(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

function parseZipEntryPath(value) {
  const entryPath = String(value || "");
  const parts = entryPath.split("/");
  if (!entryPath || entryPath.includes("\\") || entryPath.startsWith("/") || parts.includes("..")) {
    throw new Error("ZIP entry path is not a safe relative path: " + entryPath);
  }
  return entryPath;
}


function readZipCentralDirectoryEntries(file) {
  return readZipCentralDirectoryEntriesFromBuffer(fs.readFileSync(file));
}

function readZipCentralDirectoryEntriesFromBuffer(buffer) {
  const endOfCentralDirectorySignature = 0x06054b50;
  const centralDirectorySignature = 0x02014b50;
  const minimumEndSize = 22;
  if (buffer.length < minimumEndSize) throw new Error("ZIP artifact is too small to contain an end-of-central-directory record");

  const searchStart = Math.max(0, buffer.length - minimumEndSize - 65535);
  let endOffset = -1;
  for (let offset = buffer.length - minimumEndSize; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === endOfCentralDirectorySignature) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("ZIP artifact is missing an end-of-central-directory record");

  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(endOffset + 6);
  if (diskNumber !== 0 || centralDirectoryDisk !== 0) throw new Error("Multi-disk ZIP artifacts are not supported");

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryOffset < 0 || centralDirectoryEnd > buffer.length) throw new Error("ZIP central directory points outside the artifact");

  const entries = new Map();
  let cursor = centralDirectoryOffset;
  for (let index = 0; index < entryCount && cursor < centralDirectoryEnd; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== centralDirectorySignature) {
      throw new Error("ZIP central directory entry " + index + " is malformed");
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const crc32 = buffer.readUInt32LE(cursor + 16).toString(16).padStart(8, "0");
    const compressedBytes = buffer.readUInt32LE(cursor + 20);
    const bytes = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > buffer.length) throw new Error("ZIP central directory entry " + index + " has an invalid file name length");

    const archiveEntryPath = parseZipEntryPath(buffer.toString("utf8", fileNameStart, fileNameEnd));
    entries.set(archiveEntryPath, {
      archiveEntryPath,
      bytes,
      compressedBytes,
      crc32,
      compressionMethod,
      localHeaderOffset,
    });

    cursor = fileNameEnd + extraLength + commentLength;
  }

  return entries;
}

function readZipEntryBytes(buffer, entry) {
  const localFileHeaderSignature = 0x04034b50;
  const offset = entry.localHeaderOffset;
  const maxEntryBytes = LIMITS.maxFileBytes;
  const maxCompressedBytes = LIMITS.maxFileBytes + 65536;
  if (!Number.isInteger(offset) || offset < 0 || offset + 30 > buffer.length) {
    throw new Error("ZIP local header for " + entry.archiveEntryPath + " points outside the artifact");
  }
  if (entry.bytes > maxEntryBytes) {
    throw new Error("ZIP entry " + entry.archiveEntryPath + " declares " + entry.bytes + " bytes; maximum Hyperfocus asset size is " + maxEntryBytes);
  }
  if (entry.compressedBytes > maxCompressedBytes) {
    throw new Error("ZIP entry " + entry.archiveEntryPath + " declares " + entry.compressedBytes + " compressed bytes; maximum allowed is " + maxCompressedBytes);
  }
  if (buffer.readUInt32LE(offset) !== localFileHeaderSignature) {
    throw new Error("ZIP local header for " + entry.archiveEntryPath + " is malformed");
  }
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const localFileNameStart = offset + 30;
  const localFileNameEnd = localFileNameStart + fileNameLength;
  if (localFileNameEnd > buffer.length) {
    throw new Error("ZIP local header for " + entry.archiveEntryPath + " has an invalid file name length");
  }
  const localEntryPath = parseZipEntryPath(buffer.toString("utf8", localFileNameStart, localFileNameEnd));
  if (localEntryPath !== entry.archiveEntryPath) {
    throw new Error("ZIP local header path " + localEntryPath + " does not match central directory path " + entry.archiveEntryPath);
  }
  const dataStart = localFileNameEnd + extraLength;
  const dataEnd = dataStart + entry.compressedBytes;
  if (dataStart < 0 || dataEnd > buffer.length) {
    throw new Error("ZIP entry bytes for " + entry.archiveEntryPath + " point outside the artifact");
  }
  const compressed = buffer.subarray(dataStart, dataEnd);
  let bytes;
  if (entry.compressionMethod === 0) {
    bytes = compressed;
  } else if (entry.compressionMethod === 8) {
    bytes = zlib.inflateRawSync(compressed, { maxOutputLength: maxEntryBytes + 1 });
  } else {
    throw new Error("Unsupported ZIP compression method " + entry.compressionMethod + " for " + entry.archiveEntryPath);
  }
  if (bytes.length !== entry.bytes) {
    throw new Error("ZIP entry " + entry.archiveEntryPath + " expands to " + bytes.length + " bytes; expected " + entry.bytes);
  }
  const actualCrc32 = crc32Buffer(bytes);
  if (actualCrc32 !== entry.crc32) {
    throw new Error("ZIP entry " + entry.archiveEntryPath + " CRC32 " + actualCrc32 + " does not match central directory CRC32 " + entry.crc32);
  }
  return bytes;
}

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function getSpec(rootDir = DEFAULT_ROOT) {
  return readJson(path.join(rootDir, SPEC_PATH));
}

function getExpectedHyperfocusAssets({ rootDir = DEFAULT_ROOT } = {}) {
  const spec = getSpec(rootDir);
  const assets = [];

  for (const family of spec.families || []) {
    for (const level of family.levels || []) {
      assets.push({
        familyId: family.id,
        levelId: level.id,
        fileName: level.fileName,
        publicPath: path.posix.join("sounds/hyperfocus", level.fileName),
        relativePath: path.join(PUBLIC_ASSET_DIR, level.fileName),
      });
    }
  }

  return assets;
}

function getOriginalFocusAudioAssets({ rootDir = DEFAULT_ROOT } = {}) {
  const rootManifestFile = path.join(rootDir, "src/lib/appAudioAssets.ts");
  const defaultManifestFile = path.join(DEFAULT_ROOT, "src/lib/appAudioAssets.ts");
  const manifestFile = fs.existsSync(rootManifestFile) ? rootManifestFile : defaultManifestFile;
  const sourceRootDir = fs.existsSync(rootManifestFile) ? rootDir : DEFAULT_ROOT;
  if (!fs.existsSync(manifestFile)) return [];

  const source = fs.readFileSync(manifestFile, "utf8");
  const assets = [];
  const pattern = new RegExp('makeAsset\\("focus-([^\\"]+)",\\s*"focus",\\s*"([^\\"]+)",\\s*"([^\\"]+)"', "g");
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const familyId = match[1];
    if (familyId === "cafe") continue;

    assets.push({
      familyId,
      assetId: "focus-" + familyId,
      publicPath: toPosixPath(match[2]),
      sourcePath: path.posix.join("public", toPosixPath(match[2])),
      sourceRootDir,
      manifestPath: toPosixPath(path.relative(rootDir, manifestFile)),
      label: match[3],
    });
  }
  return assets;
}

function buildOriginalSourceCoverageReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString() } = {}) {
  const spec = getSpec(rootDir);
  const specFamilies = Array.isArray(spec.families) ? spec.families : [];
  const focusAssets = getOriginalFocusAudioAssets({ rootDir });
  const expectedLevelIds = ["soft", "deep", "intense"];
  const issues = [];
  const assets = [];

  if (focusAssets.length === 0) {
    issues.push(issue("missing-focus-audio-assets", "No first-party focus audio assets were found in src/lib/appAudioAssets.ts."));
  }

  const focusFamilyIds = new Set(focusAssets.map((asset) => asset.familyId));

  for (const sourceAsset of focusAssets) {
    const assetIssues = [];
    const family = specFamilies.find((candidate) => candidate && candidate.id === sourceAsset.familyId);
    const levels = Array.isArray(family?.levels) ? family.levels : [];
    const levelIds = levels.map((level) => String(level.id || ""));
    const specCurrentFile = family?.currentFile ? toPosixPath(family.currentFile) : undefined;

    if (!fs.existsSync(path.join(sourceAsset.sourceRootDir || rootDir, sourceAsset.sourcePath))) {
      assetIssues.push(issue("source-file-missing", "Original V1 focus audio file is missing: " + sourceAsset.sourcePath + ".", { assetId: sourceAsset.assetId, familyId: sourceAsset.familyId }));
    }
    if (!family) {
      assetIssues.push(issue("missing-spec-family", "Generation spec is missing family " + sourceAsset.familyId + " for " + sourceAsset.assetId + ".", { assetId: sourceAsset.assetId, familyId: sourceAsset.familyId }));
    } else if (specCurrentFile !== sourceAsset.sourcePath) {
      assetIssues.push(issue("source-file-mismatch", "Spec currentFile for " + sourceAsset.familyId + " must match " + sourceAsset.sourcePath + ".", { assetId: sourceAsset.assetId, familyId: sourceAsset.familyId }));
    }

    if (family && levels.length !== expectedLevelIds.length) {
      assetIssues.push(issue("level-count-mismatch", "Spec family " + sourceAsset.familyId + " must have exactly 3 levels; got " + levels.length + ".", { assetId: sourceAsset.assetId, familyId: sourceAsset.familyId }));
    }

    for (const expectedLevelId of expectedLevelIds) {
      if (!levelIds.includes(expectedLevelId)) {
        assetIssues.push(issue("missing-level-id", "Spec family " + sourceAsset.familyId + " is missing level " + expectedLevelId + ".", { assetId: sourceAsset.assetId, familyId: sourceAsset.familyId }));
      }
    }

    if (new Set(levelIds).size !== levelIds.length) {
      assetIssues.push(issue("duplicate-level-id", "Spec family " + sourceAsset.familyId + " has duplicate level ids.", { assetId: sourceAsset.assetId, familyId: sourceAsset.familyId }));
    }

    for (const level of levels) {
      const levelId = String(level.id || "");
      const expectedFileName = "hyperfocus-" + sourceAsset.familyId + "-" + levelId + ".mp3";
      if (levelId && level.fileName !== expectedFileName) {
        assetIssues.push(issue("generated-file-name-mismatch", "Spec level " + sourceAsset.familyId + ":" + levelId + " must write " + expectedFileName + ".", { assetId: sourceAsset.assetId, familyId: sourceAsset.familyId }));
      }
      if (!String(level.prompt || "").trim()) {
        assetIssues.push(issue("missing-generation-prompt", "Spec level " + sourceAsset.familyId + ":" + levelId + " is missing a generation prompt.", { assetId: sourceAsset.assetId, familyId: sourceAsset.familyId }));
      }
      if (!Array.isArray(level.rejectIf) || level.rejectIf.length === 0) {
        assetIssues.push(issue("missing-rejection-criteria", "Spec level " + sourceAsset.familyId + ":" + levelId + " is missing rejectIf criteria.", { assetId: sourceAsset.assetId, familyId: sourceAsset.familyId }));
      }
    }

    issues.push(...assetIssues);
    assets.push({
      assetId: sourceAsset.assetId,
      familyId: sourceAsset.familyId,
      publicPath: sourceAsset.publicPath,
      sourcePath: sourceAsset.sourcePath,
      label: sourceAsset.label,
      ...(specCurrentFile ? { specCurrentFile } : {}),
      levelIds,
      plannedLevelCount: levels.length,
      status: assetIssues.length === 0 ? "covered" : "invalid",
      issues: assetIssues,
    });
  }

  for (const family of specFamilies) {
    if (!focusFamilyIds.has(String(family.id || ""))) {
      issues.push(issue("orphan-spec-family", "Generation spec family " + family.id + " does not map to a first-party focus audio asset.", { familyId: family.id }));
    }
  }

  return {
    ok: issues.length === 0,
    generatedAt,
    focusAssetCount: focusAssets.length,
    specFamilyCount: specFamilies.length,
    coveredFamilyCount: assets.filter((asset) => asset.status === "covered").length,
    expectedLevelCount: focusAssets.length * expectedLevelIds.length,
    plannedLevelCount: specFamilies.reduce((count, family) => count + (Array.isArray(family.levels) ? family.levels.length : 0), 0),
    assets,
    issueCount: issues.length,
    issues,
  };
}

function writeOriginalSourceCoverageReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, SOURCE_COVERAGE_PATH), generatedAt } = {}) {
  const report = buildOriginalSourceCoverageReport({ rootDir, generatedAt });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ok, outputFile, report };
}

function buildPromptPolicyReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString() } = {}) {
  const spec = getSpec(rootDir);
  const specFamilies = Array.isArray(spec.families) ? spec.families : [];
  const issues = [];
  const assets = [];
  const requiredProvider = spec.modelPolicy?.requiredProvider || null;
  const allowedCurrentCandidate = spec.modelPolicy?.allowedCurrentCandidate || null;

  if (requiredProvider !== "Google Gemini family only") {
    issues.push(issue("provider-policy-drift", "Hyperfocus prompt policy must remain Google Gemini family only."));
  }

  const modelPolicyIssue = getGoogleAudioModelPolicyIssue(allowedCurrentCandidate);
  if (modelPolicyIssue) {
    issues.push(issue(modelPolicyIssue.code, modelPolicyIssue.message));
  }

  if (specFamilies.length !== 6) {
    issues.push(issue("family-count-mismatch", "Hyperfocus prompt policy must cover exactly 6 sound families; got " + specFamilies.length + "."));
  }

  const familyIds = new Set();
  for (const family of specFamilies) {
    const familyId = String(family?.id || "").trim();
    const levels = Array.isArray(family?.levels) ? family.levels : [];
    if (!familyId) {
      issues.push(issue("missing-family-id", "Every Hyperfocus prompt-policy family requires an id."));
    } else if (familyIds.has(familyId)) {
      issues.push(issue("duplicate-family-id", "Duplicate Hyperfocus prompt-policy family id " + familyId + ".", { familyId }));
    }
    if (familyId) familyIds.add(familyId);

    const levelIds = levels.map((level) => String(level?.id || "").trim());
    if (levels.length !== EXPECTED_HYPERFOCUS_LEVEL_IDS.length) {
      issues.push(issue("level-count-mismatch", "Prompt-policy family " + (familyId || "missing") + " must have exactly 3 levels; got " + levels.length + ".", { familyId }));
    }
    for (const expectedLevelId of EXPECTED_HYPERFOCUS_LEVEL_IDS) {
      if (!levelIds.includes(expectedLevelId)) {
        issues.push(issue("missing-level-id", "Prompt-policy family " + (familyId || "missing") + " is missing level " + expectedLevelId + ".", { familyId, levelId: expectedLevelId }));
      }
    }

    for (const level of levels) {
      const levelId = String(level?.id || "").trim();
      const variantId = familyId + ":" + levelId;
      const fileName = String(level?.fileName || "").trim();
      const expectedFileName = familyId && levelId ? "hyperfocus-" + familyId + "-" + levelId + ".mp3" : "";
      const prompt = String(level?.prompt || "").trim();
      const rejectIf = Array.isArray(level?.rejectIf) ? level.rejectIf.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
      const promptRequirements = {};
      const rejectIfRequirements = {};
      const assetIssues = [];

      if (!familyId || !levelId) {
        assetIssues.push(issue("missing-variant-id", "Each prompt-policy row requires family and level ids.", { familyId, levelId, fileName }));
      }
      if (expectedFileName && fileName !== expectedFileName) {
        assetIssues.push(issue("generated-file-name-mismatch", "Prompt-policy variant " + variantId + " must write " + expectedFileName + ".", { variantId, familyId, levelId, fileName }));
      }
      if (!prompt) {
        assetIssues.push(issue("missing-generation-prompt", "Prompt-policy variant " + variantId + " is missing prompt text.", { variantId, familyId, levelId, fileName }));
      }

      for (const requirement of PROMPT_POLICY_REQUIREMENTS) {
        const passed = requirement.pattern.test(prompt);
        promptRequirements[requirement.key] = passed;
        if (!passed) {
          assetIssues.push(issue("prompt-policy-missing-" + requirement.key, "Prompt for " + variantId + " must include " + requirement.label + " guidance.", { variantId, familyId, levelId, fileName }));
        }
      }

      const rejectText = rejectIf.join(" | ");
      if (rejectIf.length === 0) {
        assetIssues.push(issue("missing-rejection-criteria", "Prompt-policy variant " + variantId + " must include rejectIf criteria.", { variantId, familyId, levelId, fileName }));
      }
      for (const requirement of REJECT_IF_POLICY_REQUIREMENTS) {
        const passed = requirement.pattern.test(rejectText);
        rejectIfRequirements[requirement.key] = passed;
        if (!passed) {
          assetIssues.push(issue("reject-if-policy-missing-" + requirement.key, "rejectIf for " + variantId + " must include " + requirement.label + ".", { variantId, familyId, levelId, fileName }));
        }
      }

      issues.push(...assetIssues);
      assets.push({
        variantId,
        familyId,
        levelId,
        label: String(level?.label || ""),
        fileName,
        prompt,
        rejectIf,
        promptRequirements,
        rejectIfRequirements,
        status: assetIssues.length === 0 ? "pass" : "fail",
        issues: assetIssues,
      });
    }
  }

  if (assets.length !== 18) {
    issues.push(issue("prompt-count-mismatch", "Hyperfocus prompt policy must cover exactly 18 variants; got " + assets.length + "."));
  }

  return {
    ok: issues.length === 0,
    generatedAt,
    familyCount: specFamilies.length,
    levelCount: assets.length,
    promptCount: assets.filter((asset) => asset.prompt).length,
    policy: {
      requiredProvider,
      allowedCurrentCandidate,
      requiredDurationSeconds: Number(spec.assetPolicy?.targetDurationSeconds || 0),
      promptRequirements: PROMPT_POLICY_REQUIREMENTS.map((requirement) => requirement.key),
      rejectIfRequirements: REJECT_IF_POLICY_REQUIREMENTS.map((requirement) => requirement.key),
    },
    assets,
    issueCount: issues.length,
    issues,
  };
}

function writePromptPolicyReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, PROMPT_POLICY_PATH), generatedAt } = {}) {
  const report = buildPromptPolicyReport({ rootDir, generatedAt });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ok, outputFile, report };
}


function getProviderInventoryItems(inventory) {
  if (Array.isArray(inventory)) return inventory;
  if (!inventory || typeof inventory !== "object") return [];
  for (const key of ["items", "models", "data", "results"]) {
    if (Array.isArray(inventory[key])) return inventory[key];
  }
  return [];
}

function normalizeProviderModel(entry) {
  const raw = entry && typeof entry === "object" ? entry : {};
  const id = String(raw.id || raw.model || raw.modelId || raw.name || "").trim();
  const name = String(raw.name || raw.label || id).trim();
  const provider = String(raw.provider || raw.providerName || (/^(gemini|lyria)-/i.test(id) ? "Google" : "")).trim();
  const mode = String(raw.mode || raw.modality || raw.type || "audio").trim().toLowerCase();
  let inputType = String(raw.inputType || raw.input_type || raw.input || raw.category || "").trim().toLowerCase();
  const description = String(raw.description || raw.summary || "").trim();
  const searchable = [id, name, inputType, description].join(" ").toLowerCase();

  if (!inputType && /tts|text[-_ ]?to[-_ ]?speech/.test(searchable)) inputType = "tts";
  if (!inputType && /lyria|music/.test(searchable)) inputType = "music";
  if (!inputType && /sfx|sound ?effect|soundscape|ambien/.test(searchable)) inputType = "sfx";

  return { id, name, provider, mode, inputType, description };
}

function classifyProviderModel(model) {
  const provider = String(model.provider || "");
  const providerIsGoogle = provider.toLowerCase() === "google" || /^(gemini|lyria)-/i.test(model.id);
  const mode = String(model.mode || "audio").toLowerCase();
  const modeIsAudio = !mode || mode === "audio" || mode === "music" || mode === "tts" || mode === "sfx";
  const inputType = String(model.inputType || "").toLowerCase();
  const searchable = [model.id, model.name, inputType, model.description].join(" ").toLowerCase();
  const isTts = inputType === "tts" || /tts|text[-_ ]?to[-_ ]?speech/.test(searchable);
  const isSfxOrSoundscape = inputType === "sfx" || inputType === "soundscape" || /sfx|sound ?effect|soundscape/.test(searchable);
  const isMusic = inputType === "music" || /^lyria-/i.test(model.id);

  if (!providerIsGoogle || !modeIsAudio) {
    return { status: "ignored", reason: "not-google-audio-model", isTts, isMusic, isSfxOrSoundscape };
  }
  if (isTts) {
    return { status: "disallowed", reason: "tts-model-not-ambience", isTts, isMusic, isSfxOrSoundscape };
  }
  if (isSfxOrSoundscape) {
    return { status: "pilot-candidate", reason: "google-sfx-soundscape-model-requires-strict-qc", isTts, isMusic, isSfxOrSoundscape };
  }

  const policyIssue = getGoogleAudioModelPolicyIssue(model.id);
  if (policyIssue) {
    return { status: "disallowed", reason: policyIssue.code, isTts, isMusic, isSfxOrSoundscape };
  }

  return { status: "pilot-candidate", reason: "google-lyria-music-model-requires-strict-ambience-qc", isTts, isMusic, isSfxOrSoundscape };
}

function buildProviderCapabilityReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString(), inventory, inventoryFile } = {}) {
  const issues = [];
  const warnings = [];
  let loadedInventory = inventory;
  let inventoryPath = null;

  if (!loadedInventory && inventoryFile) {
    inventoryPath = path.resolve(rootDir, inventoryFile);
    try {
      loadedInventory = readJson(inventoryPath);
    } catch (error) {
      issues.push(issue("invalid-model-inventory-json", "Could not read model inventory JSON: " + (error instanceof Error ? error.message : String(error)) + "."));
    }
  }

  const rawItems = issues.length === 0 ? getProviderInventoryItems(loadedInventory) : [];
  if (issues.length === 0 && rawItems.length === 0) {
    issues.push(issue("missing-model-inventory", "Provider capability report requires a model inventory with audio model entries."));
  }

  const models = rawItems
    .map(normalizeProviderModel)
    .filter((model) => model.id)
    .map((model) => {
      const classification = classifyProviderModel(model);
      return {
        id: model.id,
        name: model.name,
        provider: model.provider || (/^(gemini|lyria)-/i.test(model.id) ? "Google" : ""),
        mode: model.mode || "audio",
        inputType: model.inputType || "unknown",
        status: classification.status,
        reason: classification.reason,
      };
    });

  const googleAudioModels = models.filter((model) => {
    const providerIsGoogle = String(model.provider || "").toLowerCase() === "google" || /^(gemini|lyria)-/i.test(model.id);
    const mode = String(model.mode || "audio").toLowerCase();
    return providerIsGoogle && (!mode || mode === "audio" || mode === "music" || mode === "tts" || mode === "sfx");
  });
  const ttsModels = googleAudioModels.filter((model) => model.inputType === "tts" || model.reason === "tts-model-not-ambience");
  const musicModels = googleAudioModels.filter((model) => model.inputType === "music" || /^lyria-/i.test(model.id));
  const sfxModels = googleAudioModels.filter((model) => model.inputType === "sfx" || model.inputType === "soundscape" || /sfx|sound ?effect|soundscape/i.test(model.name + " " + model.id));
  const pilotCandidateModels = googleAudioModels.filter((model) => model.status === "pilot-candidate").map((model) => ({ id: model.id, name: model.name, inputType: model.inputType, reason: model.reason }));
  const disallowedModels = googleAudioModels.filter((model) => model.status === "disallowed").map((model) => ({ id: model.id, name: model.name, inputType: model.inputType, reason: model.reason }));

  if (issues.length === 0 && googleAudioModels.length === 0) {
    issues.push(issue("no-google-audio-models", "No Google audio models were present in the provider inventory."));
  }
  if (issues.length === 0 && pilotCandidateModels.length === 0) {
    issues.push(issue("no-allowed-google-audio-pilot-model", "No Google Gemini/Lyria audio model is usable for a strict ambience pilot."));
  }
  if (googleAudioModels.length > 0 && sfxModels.length === 0) {
    warnings.push(issue("no-google-sfx-or-soundscape-model", "Current Google audio inventory exposes no SFX/soundscape-specific model; Lyria music candidates require pilot-only strict QC."));
  }

  const soundscapeOrSfxModelAvailable = sfxModels.length > 0;
  const allowedPilotModelAvailable = pilotCandidateModels.length > 0;
  const recommendedAction = issues.length > 0
    ? "refresh-model-inventory"
    : soundscapeOrSfxModelAvailable
      ? "use-sfx-soundscape-model-with-strict-qc"
      : allowedPilotModelAvailable
        ? "pilot-only-with-strict-qc"
        : "wait-for-gemini-soundscape-model";

  return {
    ok: issues.length === 0 && allowedPilotModelAvailable,
    generatedAt,
    provider: "Google",
    mode: "audio",
    ...(inventoryPath ? { inventoryFile: toPosixPath(path.relative(rootDir, inventoryPath)) } : {}),
    googleAudioModelCount: googleAudioModels.length,
    ttsModelCount: ttsModels.length,
    musicModelCount: musicModels.length,
    sfxModelCount: sfxModels.length,
    soundscapeOrSfxModelAvailable,
    allowedPilotModelAvailable,
    recommendedAction,
    models,
    pilotCandidateModels,
    disallowedModels,
    warningCount: warnings.length,
    warnings,
    issueCount: issues.length,
    issues,
  };
}

function writeProviderCapabilityReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, PROVIDER_CAPABILITY_PATH), generatedAt, inventory, inventoryFile } = {}) {
  const report = buildProviderCapabilityReport({ rootDir, generatedAt, inventory, inventoryFile });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ok, outputFile, report };
}

function readProviderCapabilityEvidence(rootDir = DEFAULT_ROOT) {
  const file = path.join(rootDir, PROVIDER_CAPABILITY_PATH);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  try {
    return readJson(file);
  } catch {
    return { ok: false, invalid: true, issueCount: 1, warningCount: 0 };
  }
}

function buildGeminiGenerationQueue({ rootDir = DEFAULT_ROOT, model, phase = "full" } = {}) {
  const spec = getSpec(rootDir);
  const selectedModel = String(model || spec.modelPolicy?.allowedCurrentCandidate || "");
  const requestedPhase = String(phase || "full").trim().toLowerCase();
  const pilotVariantId = String(spec.modelPolicy?.pilotVariantId || PILOT_VARIANT_ID);

  if (!["pilot", "full"].includes(requestedPhase)) {
    return {
      ok: false,
      phase: requestedPhase,
      requiresAcceptedPilot: requestedPhase !== "pilot",
      pilotVariantId,
      jobs: [],
      issues: [issue("invalid-generation-phase", "Generation phase must be pilot or full; got " + requestedPhase + ".")],
    };
  }

  const modelPolicyIssue = getGoogleAudioModelPolicyIssue(selectedModel);
  if (modelPolicyIssue) {
    return {
      ok: false,
      phase: requestedPhase === "pilot" ? "pilot" : "full-pack-after-pilot",
      requiresAcceptedPilot: requestedPhase !== "pilot",
      pilotVariantId,
      jobs: [],
      issues: [modelPolicyIssue],
    };
  }

  if (spec.modelPolicy?.requiredProvider !== "Google Gemini family only") {
    return {
      ok: false,
      phase: requestedPhase === "pilot" ? "pilot" : "full-pack-after-pilot",
      requiresAcceptedPilot: requestedPhase !== "pilot",
      pilotVariantId,
      jobs: [],
      issues: [issue("provider-policy-drift", "Generation spec provider policy must remain Google Gemini family only.")],
    };
  }

  const promptPolicy = buildPromptPolicyReport({ rootDir });
  if (!promptPolicy.ok) {
    return {
      ok: false,
      phase: requestedPhase === "pilot" ? "pilot" : "full-pack-after-pilot",
      requiresAcceptedPilot: requestedPhase !== "pilot",
      pilotVariantId,
      provider: "Google",
      model: selectedModel,
      jobs: [],
      issues: [issue("prompt-policy-invalid", "Generation queue export requires all 18 Gemini/Lyria prompts to pass the non-musical seamless ambience policy before handoff.", { issueCount: promptPolicy.issueCount })],
    };
  }

  const jobs = [];
  for (const family of spec.families || []) {
    for (const level of family.levels || []) {
      const rawFileName = level.fileName.replace(/\.mp3$/i, "-raw.mp3");
      const acceptedFileName = level.fileName.replace(/\.mp3$/i, "-accepted.mp3");
      const quarantinePath = path.posix.join("output/audio-quarantine", rawFileName);
      const acceptedPath = path.posix.join("output/audio-quarantine", acceptedFileName);
      const audibleReviewPath = getAudibleReviewTemplatePath(level.fileName);

      jobs.push({
        variantId: family.id + ":" + level.id,
        familyId: family.id,
        levelId: level.id,
        label: level.label,
        fileName: level.fileName,
        publicPath: path.posix.join("sounds/hyperfocus", level.fileName),
        quarantinePath,
        provider: "Google",
        model: selectedModel,
        prompt: level.prompt,
        rejectIf: Array.isArray(level.rejectIf) ? [...level.rejectIf] : [],
        promotionCommand: [
          "node scripts/check-hyperfocus-audio-assets.cjs",
          "--promote " + acceptedPath,
          "--file-name " + level.fileName,
          "--model " + selectedModel,
          "--generation-id <generation-id>",
          "--source picsart",
          "--approved-by operator-qc",
          "--audible-review " + audibleReviewPath,
          "--write-manifest",
        ].join(" "),
      });
    }
  }

  const selectedJobs = requestedPhase === "pilot" ? jobs.filter((job) => job.variantId === pilotVariantId) : jobs;
  if (requestedPhase === "pilot" && selectedJobs.length !== 1) {
    return {
      ok: false,
      phase: "pilot",
      requiresAcceptedPilot: false,
      pilotVariantId,
      provider: "Google",
      model: selectedModel,
      jobs: [],
      issues: [issue("missing-pilot-generation-job", "Pilot generation queue must contain exactly one " + pilotVariantId + " job.")],
    };
  }

  return {
    ok: true,
    phase: requestedPhase === "pilot" ? "pilot" : "full-pack-after-pilot",
    requiresAcceptedPilot: requestedPhase !== "pilot",
    pilotVariantId,
    provider: "Google",
    model: selectedModel,
    jobs: selectedJobs,
    issues: [],
  };
}


function safeFileSegment(value) {
  return String(value || "unknown").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function generationQueueDefaultOutputFile({ rootDir = DEFAULT_ROOT, model, phase = "full" } = {}) {
  const spec = getSpec(rootDir);
  const selectedModel = safeFileSegment(model || spec.modelPolicy?.allowedCurrentCandidate || "model");
  const normalizedPhase = String(phase || "full").trim().toLowerCase();
  const suffix = normalizedPhase === "pilot" ? "-pilot-generation-queue.json" : "-generation-queue.json";
  return path.join(rootDir, "output/audio-qc/hyperfocus-" + selectedModel + suffix);
}

function buildGeminiGenerationQueueReport({ rootDir = DEFAULT_ROOT, model, phase = "full", generatedAt = new Date().toISOString() } = {}) {
  const queue = buildGeminiGenerationQueue({ rootDir, model, phase });
  return {
    ok: queue.ok,
    generatedAt,
    provider: queue.provider || "Google",
    model: queue.model || String(model || getSpec(rootDir).modelPolicy?.allowedCurrentCandidate || ""),
    phase: queue.phase,
    requiresAcceptedPilot: queue.requiresAcceptedPilot === true,
    pilotVariantId: queue.pilotVariantId || PILOT_VARIANT_ID,
    jobCount: queue.jobs.length,
    jobs: queue.jobs,
    issueCount: queue.issues.length,
    issues: queue.issues,
  };
}

function writeGeminiGenerationQueue({ rootDir = DEFAULT_ROOT, outputFile, model, phase = "full", generatedAt } = {}) {
  const report = buildGeminiGenerationQueueReport({ rootDir, model, phase, generatedAt });
  const resolvedOutputFile = outputFile || generationQueueDefaultOutputFile({ rootDir, model: report.model || model, phase });
  fs.mkdirSync(path.dirname(resolvedOutputFile), { recursive: true });
  fs.writeFileSync(resolvedOutputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ok, outputFile: resolvedOutputFile, report };
}

function getAcceptedCandidatePath(fileName) {
  return path.posix.join("output/audio-quarantine", String(fileName).replace(/\.mp3$/i, "-accepted.mp3"));
}

function buildPromotionBatchTemplate({ rootDir = DEFAULT_ROOT, model, phase = "full" } = {}) {
  const queue = buildGeminiGenerationQueue({ rootDir, model, phase });
  if (!queue.ok) return { ok: false, batch: null, issues: queue.issues };

  return {
    ok: true,
    batch: {
      version: "2026-06-19",
      phase: queue.phase,
      requiresAcceptedPilot: queue.requiresAcceptedPilot,
      pilotVariantId: queue.pilotVariantId,
      purpose: queue.phase === "pilot"
        ? "Hyperfocus Gemini/Lyria pilot promotion batch. Fill generationId after the pilot generation, complete its audible review file, then run --promote-batch."
        : "Hyperfocus Gemini/Lyria all-or-nothing promotion batch. Fill generationId values after generation, complete audible review files, then run --promote-batch.",
      defaults: {
        provider: "Google",
        model: queue.model,
        source: "picsart",
        approvedBy: "operator-qc",
      },
      assets: queue.jobs.map((job) => ({
        variantId: job.variantId,
        fileName: job.fileName,
        candidateFile: getAcceptedCandidatePath(job.fileName),
        generationId: "<generation-id:" + job.variantId + ">",
        audibleReviewFile: getAudibleReviewTemplatePath(job.fileName),
      })),
    },
    issues: [],
  };
}

function writePromotionBatchTemplate({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, "output/audio-qc/hyperfocus-gemini-batch-template.json"), model, phase = "full" } = {}) {
  const result = buildPromotionBatchTemplate({ rootDir, model, phase });
  if (!result.ok) return { ...result, outputFile };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(result.batch, null, 2) + "\n");
  return { ...result, outputFile };
}


function buildCandidateUrlIntakeTemplate({ rootDir = DEFAULT_ROOT, model, phase = "full" } = {}) {
  const queue = buildGeminiGenerationQueue({ rootDir, model, phase });
  if (!queue.ok) return { ok: false, batch: null, issues: queue.issues };

  return {
    ok: true,
    batch: {
      version: "2026-06-19",
      phase: queue.phase,
      requiresAcceptedPilot: queue.requiresAcceptedPilot,
      pilotVariantId: queue.pilotVariantId,
      purpose: queue.phase === "pilot"
        ? "Hyperfocus Gemini/Lyria pilot URL intake batch. Replace the pilot url placeholder with the generated MP3 URL, then run --download-candidate-urls before QC promotion."
        : "Hyperfocus Gemini/Lyria URL intake batch. Replace url placeholders with generated MP3 URLs, then run --download-candidate-urls before QC promotion.",
      defaults: {
        provider: "Google",
        model: queue.model,
        source: "picsart",
      },
      assets: queue.jobs.map((job) => ({
        variantId: job.variantId,
        fileName: job.fileName,
        url: "<generated-audio-url:" + job.variantId + ">",
        destinationFile: getAcceptedCandidatePath(job.fileName),
        generationId: "<generation-id:" + job.variantId + ">",
      })),
    },
    issues: [],
  };
}

function writeCandidateUrlIntakeTemplate({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, "output/audio-qc/hyperfocus-candidate-url-intake-template.json"), model, phase = "full" } = {}) {
  const result = buildCandidateUrlIntakeTemplate({ rootDir, model, phase });
  if (!result.ok) return { ...result, outputFile };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(result.batch, null, 2) + "\n");
  return { ...result, outputFile };
}

function normalizeCandidateUrlBatchEntries({ rootDir = DEFAULT_ROOT, batch, batchFile } = {}) {
  let payload = batch;
  if (!payload && batchFile) payload = readJson(batchFile);
  if (!payload || typeof payload !== "object") {
    return { ok: false, entries: [], issues: [issue("missing-candidate-url-batch", "Candidate URL batch JSON is required.")] };
  }

  const rawEntries = Array.isArray(payload) ? payload : payload.assets;
  if (!Array.isArray(rawEntries)) {
    return { ok: false, entries: [], issues: [issue("invalid-candidate-url-batch", "Candidate URL batch JSON must contain an assets array.")] };
  }

  const defaults = payload.defaults && typeof payload.defaults === "object" ? payload.defaults : {};
  const phase = Array.isArray(payload) ? "full" : String(payload.phase || payload.generationPhase || "full").trim().toLowerCase();
  const pilotVariantId = Array.isArray(payload) ? PILOT_VARIANT_ID : String(payload.pilotVariantId || PILOT_VARIANT_ID);
  const entries = rawEntries.map((entry, index) => {
    const rawEntry = entry && typeof entry === "object" ? entry : {};
    const fileName = String(rawEntry.fileName || "");
    return {
      index,
      variantId: String(rawEntry.variantId || ""),
      fileName,
      url: String(rawEntry.url || rawEntry.audioUrl || rawEntry.generatedUrl || "").trim(),
      destinationFile: fileName ? path.join(rootDir, getAcceptedCandidatePath(fileName)) : "",
      generationId: String(rawEntry.generationId || ""),
      provider: String(rawEntry.provider || defaults.provider || "Google"),
      model: String(rawEntry.model || defaults.model || ""),
      source: String(rawEntry.source || defaults.source || "picsart"),
    };
  });

  return { ok: true, entries, phase, pilotVariantId, issues: [] };
}

function getCandidateUrlProtocol(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol;
  } catch (_error) {
    return "";
  }
}

function isFilledCandidateGenerationId(value) {
  const normalized = String(value || "").trim();
  return Boolean(normalized) && !/^<generation-id(?::[^>]+)?>$/i.test(normalized);
}

function validateCandidateUrlBatchShape({ rootDir = DEFAULT_ROOT, entries, phase = "full", pilotVariantId = PILOT_VARIANT_ID } = {}) {
  const shape = validatePromotionBatchShape({ rootDir, entries, phase, pilotVariantId });
  const issues = [...shape.issues];

  for (const entry of entries || []) {
    if (!entry.fileName) continue;

    if (String(entry.provider || "").toLowerCase() !== "google") {
      issues.push(issue("non-google-candidate-url-provider", "Candidate URL batch entry for " + entry.fileName + " must use provider Google before download.", { fileName: entry.fileName }));
    }

    const modelPolicyIssue = getGoogleAudioModelPolicyIssue(entry.model, { fileName: entry.fileName });
    if (modelPolicyIssue) issues.push(modelPolicyIssue);

    if (!isFilledCandidateGenerationId(entry.generationId)) {
      issues.push(issue("missing-generation-id", "Candidate URL batch entry for " + entry.fileName + " must include a real generationId before download.", { fileName: entry.fileName }));
    }

    if (!entry.url) {
      issues.push(issue("missing-candidate-url", "Candidate URL batch entry is missing url for " + entry.fileName + ".", { fileName: entry.fileName }));
      continue;
    }
    const protocol = getCandidateUrlProtocol(entry.url);
    if (!protocol || (protocol !== "https:" && protocol !== "http:")) {
      issues.push(issue("invalid-candidate-url", "Candidate URL for " + entry.fileName + " must be an HTTPS URL.", { fileName: entry.fileName }));
    } else if (protocol === "http:") {
      issues.push(issue("cleartext-candidate-url", "Candidate URL for " + entry.fileName + " must use HTTPS before download.", { fileName: entry.fileName }));
    }
  }

  return { ok: issues.length === 0, issues };
}

function isFullPackBatchPhase(phase) {
  const normalizedPhase = String(phase || "full").trim().toLowerCase();
  return normalizedPhase === "full" || normalizedPhase === "full-pack-after-pilot";
}

function validateFullPackPilotGate({ rootDir = DEFAULT_ROOT, phase = "full", probeAudioFile: probe = probeAudioFile, skipAudioProbe = false } = {}) {
  if (!isFullPackBatchPhase(phase)) return { ok: true, issues: [] };

  const pilotGate = buildPilotGateReport({ rootDir, skipAudioProbe, probeAudioFile: probe });
  if (pilotGate.ok) return { ok: true, issues: [] };

  return {
    ok: false,
    issues: [
      issue("pilot-gate-not-accepted", "Full Hyperfocus generated-pack workflow requires an accepted fireplace:soft pilot before processing the 18-file pack.", {
        fileName: pilotGate.fileName || "hyperfocus-fireplace-soft.mp3",
        pilotVariantId: pilotGate.pilotVariantId || PILOT_VARIANT_ID,
        issueCount: pilotGate.issueCount,
      }),
    ],
  };
}


function downloadFileFromUrl(url, destinationFile) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(error);
      return;
    }
    if (parsed.protocol !== "https:") {
      reject(new Error("Candidate downloads must use HTTPS URLs."));
      return;
    }

    fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
    const request = https.get(parsed, { headers: { "User-Agent": "ZenFlow-Hyperfocus-Audio-QC/1.0" } }, (response) => {
      const statusCode = response.statusCode || 0;
      const redirectLocation = response.headers.location;
      if (statusCode >= 300 && statusCode < 400 && redirectLocation) {
        response.resume();
        downloadFileFromUrl(new URL(redirectLocation, parsed).toString(), destinationFile).then(resolve, reject);
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error("Download returned HTTP " + statusCode));
        return;
      }

      const output = fs.createWriteStream(destinationFile);
      response.pipe(output);
      output.on("finish", () => output.close(resolve));
      output.on("error", (error) => {
        fs.rmSync(destinationFile, { force: true });
        reject(error);
      });
    });

    request.setTimeout(60000, () => request.destroy(new Error("Download timed out after 60000ms")));
    request.on("error", (error) => {
      fs.rmSync(destinationFile, { force: true });
      reject(error);
    });
  });
}

async function downloadCandidateUrlBatch({ rootDir = DEFAULT_ROOT, batch, batchFile, downloadFile = downloadFileFromUrl, probeAudioFile: probe = probeAudioFile, skipAudioProbe = false } = {}) {
  const normalized = normalizeCandidateUrlBatchEntries({ rootDir, batch, batchFile });
  if (!normalized.ok) return { ok: false, downloadedCount: 0, issues: normalized.issues };

  const shape = validateCandidateUrlBatchShape({ rootDir, entries: normalized.entries, phase: normalized.phase, pilotVariantId: normalized.pilotVariantId });
  if (!shape.ok) return { ok: false, downloadedCount: 0, issues: shape.issues };

  const pilotGate = validateFullPackPilotGate({ rootDir, phase: normalized.phase, probeAudioFile: probe, skipAudioProbe });
  if (!pilotGate.ok) return { ok: false, downloadedCount: 0, issues: pilotGate.issues };

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "hyperfocus-candidate-url-intake-"));
  const staged = [];
  try {
    for (const entry of normalized.entries) {
      const stagedFile = path.join(stagingDir, entry.fileName);
      try {
        await downloadFile(entry.url, stagedFile);
      } catch (error) {
        return {
          ok: false,
          downloadedCount: 0,
          issues: [issue("candidate-url-download-failed", "Could not download " + entry.fileName + ": " + (error instanceof Error ? error.message : String(error)), { fileName: entry.fileName })],
        };
      }

      if (!fs.existsSync(stagedFile) || !fs.statSync(stagedFile).isFile() || fs.statSync(stagedFile).size <= 0) {
        return {
          ok: false,
          downloadedCount: 0,
          issues: [issue("empty-candidate-download", "Downloaded candidate for " + entry.fileName + " is missing or empty.", { fileName: entry.fileName })],
        };
      }
      staged.push({ entry, stagedFile });
    }

    const destinations = [];
    for (const item of staged) {
      fs.mkdirSync(path.dirname(item.entry.destinationFile), { recursive: true });
      fs.copyFileSync(item.stagedFile, item.entry.destinationFile);
      destinations.push(item.entry.destinationFile);
    }

    return { ok: true, downloadedCount: destinations.length, destinations, issues: [] };
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

function issue(code, message, extra = {}) {
  return { code, message, ...extra };
}

function getVariantId(asset) {
  return asset.familyId + ":" + asset.levelId;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function findSpecLevelForAsset({ rootDir = DEFAULT_ROOT, asset } = {}) {
  const spec = getSpec(rootDir);
  for (const family of spec.families || []) {
    for (const level of family.levels || []) {
      if ((family.id === asset.familyId && level.id === asset.levelId) || level.fileName === asset.fileName) {
        return { family, level };
      }
    }
  }
  return { family: null, level: null };
}

function getProvenanceLedger(rootDir = DEFAULT_ROOT) {
  const file = path.join(rootDir, PROVENANCE_PATH);
  if (!fs.existsSync(file)) return { version: "2026-06-19", assets: {} };
  const ledger = readJson(file);
  return {
    version: String(ledger.version || "2026-06-19"),
    assets: ledger.assets && typeof ledger.assets === "object" ? ledger.assets : {},
  };
}

function getGoogleAudioModelPolicyIssue(model, extra = {}) {
  const normalizedModel = String(model || "").trim();
  if (!/^gemini-/i.test(normalizedModel) && !/^lyria-/i.test(normalizedModel)) {
    return issue("non-gemini-family-model", "Model must be a Gemini/Lyria-family Google audio model for Hyperfocus ambience; got " + (normalizedModel || "missing") + ".", extra);
  }
  if (/(^|[-_])tts($|[-_])/i.test(normalizedModel) || /text[-_ ]?to[-_ ]?speech/i.test(normalizedModel)) {
    return issue("tts-model-not-ambience", "Gemini TTS models are speech generators and cannot satisfy Hyperfocus ambience generation; use a Google/Lyria ambience-capable audio model.", extra);
  }
  return null;
}

function isAllowedGoogleAudioModel(model) {
  return getGoogleAudioModelPolicyIssue(model) === null;
}

function getAudibleReviewTemplatePath(fileName) {
  return path.posix.join("output/audio-qc/reviews", fileName.replace(/\.mp3$/i, "-audible-review.json"));
}

function buildAudibleReviewTemplate({ asset, family, level } = {}) {
  const template = {
    variantId: getVariantId(asset),
    familyId: asset.familyId,
    levelId: asset.levelId,
    fileName: asset.fileName,
    label: level?.label || "",
    prompt: level?.prompt || "",
    promptSha256: sha256Text(level?.prompt || ""),
    rejectIf: Array.isArray(level?.rejectIf) ? [...level.rejectIf] : [],
    reviewer: "",
    reviewedAt: "",
  };

  for (const field of AUDIBLE_REVIEW_REQUIRED_TRUE_FIELDS) template[field] = false;
  template.notes = "Set every boolean to true only after listening to the accepted candidate end-to-end and across the loop seam.";
  return template;
}

function buildAudibleReviewTemplates({ rootDir = DEFAULT_ROOT } = {}) {
  const spec = getSpec(rootDir);
  const templates = [];

  for (const family of spec.families || []) {
    for (const level of family.levels || []) {
      const asset = {
        familyId: family.id,
        levelId: level.id,
        fileName: level.fileName,
        publicPath: path.posix.join("sounds/hyperfocus", level.fileName),
        relativePath: path.join(PUBLIC_ASSET_DIR, level.fileName),
      };
      templates.push({
        variantId: getVariantId(asset),
        fileName: level.fileName,
        relativePath: getAudibleReviewTemplatePath(level.fileName),
        template: buildAudibleReviewTemplate({ asset, family, level }),
      });
    }
  }

  return templates;
}

function writeAudibleReviewTemplates({ rootDir = DEFAULT_ROOT, outputDir = path.join(rootDir, "output/audio-qc/reviews") } = {}) {
  const templates = buildAudibleReviewTemplates({ rootDir });
  fs.mkdirSync(outputDir, { recursive: true });

  for (const entry of templates) {
    const outputFile = path.join(outputDir, path.basename(entry.relativePath));
    fs.writeFileSync(outputFile, JSON.stringify(entry.template, null, 2) + "\n");
  }

  return { ok: true, outputDir, count: templates.length, templates };
}

function validateAudibleReviewPayload({ rootDir = DEFAULT_ROOT, asset, review } = {}) {
  if (!review || typeof review !== "object" || Array.isArray(review)) {
    return {
      ok: false,
      issue: issue("missing-audible-review", "Gemini/Lyria Hyperfocus promotion for " + asset.fileName + " requires a structured audibleReview object.", { fileName: asset.fileName }),
    };
  }

  const variantId = getVariantId(asset);
  if (review.variantId && String(review.variantId) !== variantId) {
    return {
      ok: false,
      issue: issue("audible-review-variant-mismatch", "audibleReview.variantId " + review.variantId + " does not match " + variantId + ".", { fileName: asset.fileName }),
    };
  }

  const reviewer = String(review.reviewer || review.reviewedBy || "").trim();
  if (!reviewer) {
    return {
      ok: false,
      issue: issue("missing-audible-reviewer", "audibleReview for " + asset.fileName + " must include reviewer.", { fileName: asset.fileName }),
    };
  }

  const reviewedAt = String(review.reviewedAt || "").trim();
  if (!reviewedAt || Number.isNaN(Date.parse(reviewedAt))) {
    return {
      ok: false,
      issue: issue("invalid-audible-review-date", "audibleReview for " + asset.fileName + " must include an ISO reviewedAt timestamp.", { fileName: asset.fileName }),
    };
  }

  const { level } = findSpecLevelForAsset({ rootDir, asset });
  const expectedPromptSha256 = sha256Text(level?.prompt || "");
  const reviewPromptSha256 = String(review.promptSha256 || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(reviewPromptSha256)) {
    return {
      ok: false,
      issue: issue("missing-audible-review-prompt-sha", "audibleReview for " + asset.fileName + " must include promptSha256 for the reviewed generation prompt.", { fileName: asset.fileName }),
    };
  }
  if (reviewPromptSha256 !== expectedPromptSha256) {
    return {
      ok: false,
      issue: issue("audible-review-prompt-mismatch", "audibleReview.promptSha256 for " + asset.fileName + " does not match the current generation prompt.", { fileName: asset.fileName, expectedPromptSha256, reviewPromptSha256 }),
    };
  }

  for (const field of AUDIBLE_REVIEW_REQUIRED_TRUE_FIELDS) {
    if (review[field] !== true) {
      return {
        ok: false,
        issue: issue("audible-review-failed", "audibleReview." + field + " must be true for " + asset.fileName + ".", { fileName: asset.fileName, field }),
      };
    }
  }

  const entry = {
    variantId,
    reviewer,
    reviewedAt,
    promptSha256: reviewPromptSha256,
  };
  for (const field of AUDIBLE_REVIEW_REQUIRED_TRUE_FIELDS) entry[field] = true;
  if (review.notes) entry.notes = String(review.notes);

  return { ok: true, entry };
}

function validateGeminiProvenancePayload({ rootDir = DEFAULT_ROOT, asset, provenance } = {}) {
  const provider = String(provenance?.provider || "");
  const model = String(provenance?.model || "");
  const generationId = String(provenance?.generationId || "");
  const source = provenance?.source ? String(provenance.source) : undefined;
  const sourceLicense = provenance?.sourceLicense ? String(provenance.sourceLicense) : undefined;
  const postProcessing = provenance?.postProcessing && typeof provenance.postProcessing === "object" ? provenance.postProcessing : null;
  const isRealSource =
    model.startsWith("real-source-") ||
    ["mixkit", "bundled-source"].includes(provider.toLowerCase());

  if (isRealSource) {
    if (!source || !sourceLicense) {
      return {
        ok: false,
        issue: issue("missing-real-source-provenance", "Real-source Hyperfocus audio provenance for " + asset.fileName + " must include source and sourceLicense.", { fileName: asset.fileName }),
      };
    }
    if (postProcessing && postProcessing.objectiveResult !== "PASS") {
      return {
        ok: false,
        issue: issue("real-source-post-processing-not-passing", "Real-source Hyperfocus audio postProcessing.objectiveResult must be PASS for " + asset.fileName + ".", { fileName: asset.fileName }),
      };
    }

    return {
      ok: true,
      entry: {
        provider,
        model,
        generationId,
        source,
        sourceLicense,
        generatedAt: provenance?.generatedAt ? String(provenance.generatedAt) : undefined,
        approvedBy: provenance?.approvedBy ? String(provenance.approvedBy) : undefined,
        audibleReview: provenance?.audibleReview,
        postProcessing: postProcessing || undefined,
      },
    };
  }

  if (provider.toLowerCase() !== "google") {
    return {
      ok: false,
      issue: issue("non-google-provenance", "Provider must be Google for Gemini-only Hyperfocus audio; got " + (provider || "missing") + ".", { fileName: asset.fileName }),
    };
  }
  const modelPolicyIssue = getGoogleAudioModelPolicyIssue(model, { fileName: asset.fileName });
  if (modelPolicyIssue) {
    return {
      ok: false,
      issue: modelPolicyIssue,
    };
  }
  if (!generationId.trim()) {
    return {
      ok: false,
      issue: issue("missing-generation-id", "Google/Gemini provenance for " + asset.fileName + " must include generationId.", { fileName: asset.fileName }),
    };
  }

  const audibleReview = validateAudibleReviewPayload({ rootDir, asset, review: provenance?.audibleReview });
  if (!audibleReview.ok) return audibleReview;

  return {
    ok: true,
    entry: {
      provider,
      model,
      generationId,
      source: provenance?.source ? String(provenance.source) : undefined,
      generatedAt: provenance?.generatedAt ? String(provenance.generatedAt) : undefined,
      approvedBy: provenance?.approvedBy ? String(provenance.approvedBy) : undefined,
      audibleReview: audibleReview.entry,
    },
  };
}

function validateGeminiProvenanceForAsset({ rootDir = DEFAULT_ROOT, asset } = {}) {
  const variantId = getVariantId(asset);
  const entry = getProvenanceLedger(rootDir).assets[variantId] || getProvenanceLedger(rootDir).assets[asset.fileName];

  if (!entry || typeof entry !== "object") {
    return {
      ok: false,
      issue: issue("missing-provenance", "Missing Google/Gemini provenance for " + asset.fileName + ".", { fileName: asset.fileName }),
    };
  }

  if (entry.fileName && entry.fileName !== asset.fileName) {
    return {
      ok: false,
      issue: issue("provenance-file-mismatch", "Provenance fileName " + entry.fileName + " does not match " + asset.fileName + ".", { fileName: asset.fileName }),
    };
  }

  const validation = validateGeminiProvenancePayload({ rootDir, asset, provenance: entry });
  if (!validation.ok) return validation;

  const expectedPublicSha256 = String(entry.publicSha256 || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedPublicSha256)) {
    return {
      ok: false,
      issue: issue("missing-provenance-public-sha", "Google/Gemini provenance for " + asset.fileName + " must include a 64-character publicSha256 for the promoted file.", { fileName: asset.fileName }),
    };
  }

  const publicFile = path.join(rootDir, asset.relativePath);
  if (!fs.existsSync(publicFile) || !fs.statSync(publicFile).isFile()) {
    return {
      ok: false,
      issue: issue("missing-file", "Missing generated Hyperfocus asset " + asset.relativePath + ".", { fileName: asset.fileName }),
    };
  }

  const actualPublicSha256 = sha256File(publicFile);
  if (actualPublicSha256 !== expectedPublicSha256) {
    return {
      ok: false,
      issue: issue("provenance-public-sha-mismatch", "Provenance publicSha256 for " + asset.fileName + " does not match the current public file.", {
        fileName: asset.fileName,
        expectedSha256: expectedPublicSha256,
        actualSha256: actualPublicSha256,
      }),
    };
  }

  return { ok: true, entry: { ...validation.entry, publicSha256: expectedPublicSha256 } };
}

function findOriginalSourceAudioReuse({ rootDir = DEFAULT_ROOT, candidateFile } = {}) {
  const candidateSha256 = sha256File(candidateFile);
  const matches = [];

  for (const family of getSpec(rootDir).families || []) {
    const currentFile = family.currentFile ? String(family.currentFile) : "";
    if (!currentFile) continue;

    const sourceFile = path.join(rootDir, currentFile);
    if (!fs.existsSync(sourceFile) || !fs.statSync(sourceFile).isFile()) continue;

    if (sha256File(sourceFile) === candidateSha256) {
      matches.push({ familyId: family.id, currentFile: toPosixPath(currentFile), sha256: candidateSha256 });
    }
  }

  return matches;
}

function dbfsFromMeanSquare(meanSquare) {
  if (meanSquare <= 0) return -Infinity;
  return 20 * Math.log10(Math.sqrt(meanSquare));
}

function parseAfinfo(sourceText) {
  const durationMatch = sourceText.match(/estimated duration:\s*([0-9.]+) sec/i);
  const dataFormatMatch = sourceText.match(/Data format:\s*(\d+) ch,\s*([0-9.]+) Hz,\s*\.([a-z0-9]+)/i);
  const audioBytesMatch = sourceText.match(/audio bytes:\s*(\d+)/i);
  const bitrateMatch = sourceText.match(/bit rate:\s*(\d+)/i);

  return {
    durationSeconds: durationMatch ? Number(durationMatch[1]) : NaN,
    channels: dataFormatMatch ? Number(dataFormatMatch[1]) : NaN,
    sampleRate: dataFormatMatch ? Number(dataFormatMatch[2]) : NaN,
    format: dataFormatMatch ? dataFormatMatch[3].toLowerCase() : "unknown",
    audioBytes: audioBytesMatch ? Number(audioBytesMatch[1]) : NaN,
    bitrate: bitrateMatch ? Number(bitrateMatch[1]) : NaN,
  };
}

function readWavPcm16Metrics(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Decoded file is not a RIFF/WAVE file");
  }

  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (id === "fmt ") {
      const audioFormat = buffer.readUInt16LE(chunkStart);
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      const bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
      if (audioFormat !== 1 || bitsPerSample !== 16) {
        throw new Error("Decoded WAV must be PCM 16-bit");
      }
    } else if (id === "data") {
      dataOffset = chunkStart;
      dataSize = size;
      break;
    }

    offset = chunkStart + size + (size % 2);
  }

  if (dataOffset < 0 || dataSize <= 0) throw new Error("Decoded WAV is missing data chunk");

  const sampleCount = Math.floor(dataSize / 2);
  let sumSquares = 0;
  let maxAbs = 0;
  let clippedSamples = 0;
  const samples = new Float64Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const value = buffer.readInt16LE(dataOffset + index * 2) / 32768;
    const abs = Math.abs(value);
    samples[index] = value;
    sumSquares += value * value;
    if (abs > maxAbs) maxAbs = abs;
    if (abs >= 0.999) clippedSamples += 1;
  }

  const windowSamples = Math.min(sampleCount, Math.max(channels, Math.floor(sampleRate * channels * 0.5)));
  let startSquares = 0;
  let endSquares = 0;
  for (let index = 0; index < windowSamples; index += 1) {
    startSquares += samples[index] * samples[index];
    const endValue = samples[sampleCount - windowSamples + index];
    endSquares += endValue * endValue;
  }

  const seamSamples = Math.min(Math.floor(sampleCount / 2), Math.max(channels, Math.floor(sampleRate * channels * 0.05)));
  let seamDiff = 0;
  for (let index = 0; index < seamSamples; index += 1) {
    seamDiff += Math.abs(samples[index] - samples[sampleCount - seamSamples + index]);
  }

  return {
    sampleRate,
    channels,
    rmsDbfs: dbfsFromMeanSquare(sumSquares / sampleCount),
    peakDbfs: maxAbs > 0 ? 20 * Math.log10(maxAbs) : -Infinity,
    clippedSamples,
    startRmsDbfs: dbfsFromMeanSquare(startSquares / windowSamples),
    endRmsDbfs: dbfsFromMeanSquare(endSquares / windowSamples),
    seamMeanAbsDiff: seamDiff / seamSamples,
  };
}

function probeAudioFile(file) {
  const afinfoOutput = execFileSync("afinfo", [file], { encoding: "utf8" });
  const afinfo = parseAfinfo(afinfoOutput);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hyperfocus-audio-qc-"));
  const wavPath = path.join(tempDir, "decoded.wav");

  try {
    execFileSync("afconvert", [file, wavPath, "-f", "WAVE", "-d", "LEI16@48000"], { stdio: "pipe" });
    const decodedMetrics = readWavPcm16Metrics(wavPath);
    const stat = fs.statSync(file);

    return {
      ...afinfo,
      ...decodedMetrics,
      fileBytes: stat.size,
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup only; validation result should not depend on tmp removal.
    }
  }
}

function evaluateHyperfocusAudioMetrics(metrics) {
  const issues = [];

  if (metrics.fileBytes < LIMITS.minFileBytes) {
    issues.push(issue("file-too-small", "File is " + metrics.fileBytes + " bytes; expected at least " + LIMITS.minFileBytes + "."));
  }
  if (metrics.fileBytes > LIMITS.maxFileBytes) {
    issues.push(issue("file-too-large", "File is " + metrics.fileBytes + " bytes; expected at most " + LIMITS.maxFileBytes + "."));
  }
  if (metrics.durationSeconds < LIMITS.minDurationSeconds || metrics.durationSeconds > LIMITS.maxDurationSeconds) {
    issues.push(issue("bad-duration", "Duration is " + metrics.durationSeconds.toFixed(3) + "s; expected " + LIMITS.minDurationSeconds + "-" + LIMITS.maxDurationSeconds + "s."));
  }
  if (metrics.sampleRate !== LIMITS.sampleRate) {
    issues.push(issue("bad-sample-rate", "Sample rate is " + metrics.sampleRate + "; expected " + LIMITS.sampleRate + "."));
  }
  if (metrics.channels !== LIMITS.channels) {
    issues.push(issue("bad-channel-count", "Channel count is " + metrics.channels + "; expected " + LIMITS.channels + "."));
  }
  if (metrics.rmsDbfs < LIMITS.minRmsDbfs || metrics.rmsDbfs > LIMITS.maxRmsDbfs) {
    issues.push(issue("bad-rms", "RMS is " + metrics.rmsDbfs.toFixed(2) + " dBFS; expected " + LIMITS.minRmsDbfs + " to " + LIMITS.maxRmsDbfs + " dBFS."));
  }
  if (metrics.peakDbfs > LIMITS.maxPeakDbfs) {
    issues.push(issue("peak-too-hot", "Peak is " + metrics.peakDbfs.toFixed(2) + " dBFS; expected <= " + LIMITS.maxPeakDbfs + " dBFS."));
  }
  if (metrics.clippedSamples > LIMITS.maxClippedSamples) {
    issues.push(issue("clipped-samples", "Found " + metrics.clippedSamples + " clipped samples; expected 0."));
  }
  if (Math.abs(metrics.startRmsDbfs - metrics.endRmsDbfs) > LIMITS.maxStartEndRmsDeltaDb) {
    issues.push(issue("end-fade", "Start/end RMS differs by " + Math.abs(metrics.startRmsDbfs - metrics.endRmsDbfs).toFixed(2) + " dB; expected <= " + LIMITS.maxStartEndRmsDeltaDb + " dB."));
  }
  if (metrics.seamMeanAbsDiff > LIMITS.maxSeamMeanAbsDiff) {
    issues.push(issue("bad-loop-seam", "Loop seam mean abs diff is " + metrics.seamMeanAbsDiff.toFixed(6) + "; expected <= " + LIMITS.maxSeamMeanAbsDiff + "."));
  }

  return issues;
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function writeGeneratedAudioProvenanceEntry({ rootDir = DEFAULT_ROOT, asset, candidateFile, destinationPath, provenance } = {}) {
  const validation = validateGeminiProvenancePayload({ rootDir, asset, provenance });
  if (!validation.ok) return validation;

  const ledger = getProvenanceLedger(rootDir);
  const variantId = getVariantId(asset);
  ledger.assets[variantId] = {
    fileName: asset.fileName,
    provider: validation.entry.provider,
    model: validation.entry.model,
    generationId: validation.entry.generationId,
    generatedAt: validation.entry.generatedAt || new Date().toISOString(),
    source: validation.entry.source,
    approvedBy: validation.entry.approvedBy,
    audibleReview: validation.entry.audibleReview,
    candidateSha256: sha256File(candidateFile),
    publicSha256: sha256File(destinationPath),
    promotedAt: new Date().toISOString(),
  };

  const file = path.join(rootDir, PROVENANCE_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + "\n");
  return { ok: true, entry: ledger.assets[variantId] };
}

function renderGeneratedAudioManifest(entries) {
  const sortedEntries = [...entries].sort((a, b) => a.variantId.localeCompare(b.variantId));
  const lines = [
    "export interface HyperfocusGeneratedAudioManifestEntry {",
    "  publicPath: string;",
    "  sha256: string;",
    "  bytes: number;",
    "  generatedAt: string;",
    "  provider?: string;",
    "  model?: string;",
    "  generationId?: string;",
    "  source?: string;",
    "}",
    "",
    "export const HYPERFOCUS_GENERATED_AUDIO_MANIFEST: Readonly<Record<string, HyperfocusGeneratedAudioManifestEntry>> = {",
  ];

  for (const entry of sortedEntries) {
    lines.push("  " + JSON.stringify(entry.variantId) + ": {");
    lines.push("    publicPath: " + JSON.stringify(entry.publicPath) + ",");
    lines.push("    sha256: " + JSON.stringify(entry.sha256) + ",");
    lines.push("    bytes: " + entry.bytes + ",");
    lines.push("    generatedAt: " + JSON.stringify(entry.generatedAt) + ",");
    if (entry.provider) lines.push("    provider: " + JSON.stringify(entry.provider) + ",");
    if (entry.model) lines.push("    model: " + JSON.stringify(entry.model) + ",");
    if (entry.generationId) lines.push("    generationId: " + JSON.stringify(entry.generationId) + ",");
    if (entry.source) lines.push("    source: " + JSON.stringify(entry.source) + ",");
    lines.push("  },");
  }

  lines.push("};");
  lines.push("");
  return lines.join("\n");
}

function collectGeneratedAudioManifestEntries({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString(), probeAudioFile: probe = probeAudioFile } = {}) {
  const entries = [];
  const issues = [];

  for (const asset of getExpectedHyperfocusAssets({ rootDir })) {
    const file = path.join(rootDir, asset.relativePath);
    if (!fs.existsSync(file)) continue;

    let metrics;
    try {
      metrics = probe(file);
    } catch (error) {
      issues.push(issue("probe-failed", "Could not probe " + asset.relativePath + ": " + (error instanceof Error ? error.message : String(error)), { fileName: asset.fileName }));
      continue;
    }

    const metricIssues = evaluateHyperfocusAudioMetrics(metrics);
    if (metricIssues.length > 0) {
      for (const metricIssue of metricIssues) issues.push({ ...metricIssue, fileName: asset.fileName });
      continue;
    }

    const provenance = validateGeminiProvenanceForAsset({ rootDir, asset });
    if (!provenance.ok) {
      issues.push(provenance.issue);
      continue;
    }

    entries.push({
      variantId: getVariantId(asset),
      publicPath: asset.publicPath,
      sha256: sha256File(file),
      bytes: fs.statSync(file).size,
      generatedAt: provenance.entry.generatedAt || generatedAt,
      provider: provenance.entry.provider,
      model: provenance.entry.model,
      generationId: provenance.entry.generationId,
      source: provenance.entry.source,
    });
  }

  return { ok: issues.length === 0, entries, issues };
}

function writeGeneratedAudioManifest({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, "src/lib/hyperfocusGeneratedAudioManifest.ts"), generatedAt, probeAudioFile: probe } = {}) {
  const result = collectGeneratedAudioManifestEntries({ rootDir, generatedAt, probeAudioFile: probe });
  if (!result.ok) return { ...result, outputFile };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, renderGeneratedAudioManifest(result.entries));
  return { ...result, outputFile };
}

function validateHyperfocusAssetSet({ rootDir = DEFAULT_ROOT, skipAudioProbe = false } = {}) {
  const issues = [];
  const assets = getExpectedHyperfocusAssets({ rootDir });

  for (const asset of assets) {
    const file = path.join(rootDir, asset.relativePath);
    if (!fs.existsSync(file)) {
      issues.push(issue("missing-file", "Missing generated Hyperfocus asset " + asset.relativePath + ".", { fileName: asset.fileName }));
      continue;
    }

    if (!/\.mp3$/i.test(asset.fileName)) {
      issues.push(issue("bad-extension", "Expected MP3 file name for " + asset.fileName + ".", { fileName: asset.fileName }));
    }

    const stat = fs.statSync(file);
    if (!stat.isFile()) {
      issues.push(issue("not-file", asset.relativePath + " is not a regular file.", { fileName: asset.fileName }));
      continue;
    }

    if (skipAudioProbe) continue;

    try {
      const metrics = probeAudioFile(file);
      for (const metricIssue of evaluateHyperfocusAudioMetrics(metrics)) {
        issues.push({ ...metricIssue, fileName: asset.fileName });
      }
    } catch (error) {
      issues.push(issue("probe-failed", "Could not probe " + asset.relativePath + ": " + (error instanceof Error ? error.message : String(error)), { fileName: asset.fileName }));
    }
  }

  return { ok: issues.length === 0, issues };
}

function buildHyperfocusAudioQcReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString(), skipAudioProbe = false, probeAudioFile: probe = probeAudioFile } = {}) {
  const assets = [];
  const issues = [];
  let passedCount = 0;
  let missingCount = 0;
  let failedCount = 0;

  for (const asset of getExpectedHyperfocusAssets({ rootDir })) {
    const file = path.join(rootDir, asset.relativePath);
    const baseEntry = {
      variantId: getVariantId(asset),
      familyId: asset.familyId,
      levelId: asset.levelId,
      fileName: asset.fileName,
      publicPath: asset.publicPath,
      relativePath: asset.relativePath.split(path.sep).join(path.posix.sep),
      issues: [],
    };

    if (!fs.existsSync(file)) {
      const foundIssue = issue("missing-file", "Missing generated Hyperfocus asset " + asset.relativePath + ".");
      missingCount += 1;
      issues.push({ ...foundIssue, fileName: asset.fileName });
      assets.push({ ...baseEntry, status: "missing", issues: [foundIssue] });
      continue;
    }

    const stat = fs.statSync(file);
    if (!stat.isFile()) {
      const foundIssue = issue("not-file", asset.relativePath + " is not a regular file.");
      failedCount += 1;
      issues.push({ ...foundIssue, fileName: asset.fileName });
      assets.push({ ...baseEntry, status: "fail", issues: [foundIssue] });
      continue;
    }

    const bytes = stat.size;
    const sha256 = sha256File(file);

    if (skipAudioProbe) {
      const foundIssue = issue("audio-probe-skipped", "Audio probe was skipped for " + asset.relativePath + ".");
      failedCount += 1;
      issues.push({ ...foundIssue, fileName: asset.fileName });
      assets.push({ ...baseEntry, status: "unchecked", bytes, sha256, issues: [foundIssue] });
      continue;
    }

    let metrics;
    try {
      metrics = probe(file);
    } catch (error) {
      const foundIssue = issue("probe-failed", "Could not probe " + asset.relativePath + ": " + (error instanceof Error ? error.message : String(error)));
      failedCount += 1;
      issues.push({ ...foundIssue, fileName: asset.fileName });
      assets.push({ ...baseEntry, status: "probe-failed", bytes, sha256, issues: [foundIssue] });
      continue;
    }

    const metricIssues = evaluateHyperfocusAudioMetrics(metrics);
    if (metricIssues.length > 0) {
      failedCount += 1;
      for (const metricIssue of metricIssues) issues.push({ ...metricIssue, fileName: asset.fileName });
      assets.push({ ...baseEntry, status: "fail", bytes, sha256, metrics, issues: metricIssues });
      continue;
    }

    passedCount += 1;
    assets.push({ ...baseEntry, status: "pass", bytes, sha256, metrics, issues: [] });
  }

  const expectedCount = assets.length;
  return {
    ok: passedCount === expectedCount && missingCount === 0 && failedCount === 0,
    generatedAt,
    expectedCount,
    passedCount,
    missingCount,
    failedCount,
    limits: LIMITS,
    assets,
    issues,
  };
}

function writeHyperfocusAudioQcReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, "output/audio-qc/hyperfocus-current.json"), generatedAt, skipAudioProbe = false, probeAudioFile: probe } = {}) {
  const report = buildHyperfocusAudioQcReport({ rootDir, generatedAt, skipAudioProbe, probeAudioFile: probe });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ok, outputFile, report };
}



function buildAcceptedCandidateReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString(), skipAudioProbe = false, probeAudioFile: probe = probeAudioFile } = {}) {
  const assets = [];
  const issues = [];
  let presentCount = 0;
  let missingCount = 0;
  let passedCount = 0;
  let failedCount = 0;
  let invalidCount = 0;

  for (const asset of getExpectedHyperfocusAssets({ rootDir })) {
    const candidatePath = getAcceptedCandidatePath(asset.fileName);
    const file = path.join(rootDir, candidatePath);
    const baseEntry = {
      variantId: getVariantId(asset),
      familyId: asset.familyId,
      levelId: asset.levelId,
      fileName: asset.fileName,
      publicPath: asset.publicPath,
      candidatePath,
      issues: [],
    };

    if (!fs.existsSync(file)) {
      const foundIssue = issue("missing-candidate", "Missing accepted generated candidate " + candidatePath + ".");
      missingCount += 1;
      issues.push({ ...foundIssue, fileName: asset.fileName });
      assets.push({ ...baseEntry, status: "missing", issues: [foundIssue] });
      continue;
    }

    const stat = fs.statSync(file);
    if (!stat.isFile()) {
      const foundIssue = issue("candidate-not-file", candidatePath + " is not a regular file.");
      invalidCount += 1;
      issues.push({ ...foundIssue, fileName: asset.fileName });
      assets.push({ ...baseEntry, status: "fail", issues: [foundIssue] });
      continue;
    }

    presentCount += 1;
    const bytes = stat.size;
    const sha256 = sha256File(file);

    if (skipAudioProbe) {
      const foundIssue = issue("audio-probe-skipped", "Audio probe was skipped for accepted candidate " + candidatePath + ".");
      failedCount += 1;
      issues.push({ ...foundIssue, fileName: asset.fileName });
      assets.push({ ...baseEntry, status: "unchecked", bytes, sha256, issues: [foundIssue] });
      continue;
    }

    let metrics;
    try {
      metrics = probe(file);
    } catch (error) {
      const foundIssue = issue("probe-failed", "Could not probe accepted candidate " + candidatePath + ": " + (error instanceof Error ? error.message : String(error)));
      invalidCount += 1;
      issues.push({ ...foundIssue, fileName: asset.fileName });
      assets.push({ ...baseEntry, status: "probe-failed", bytes, sha256, issues: [foundIssue] });
      continue;
    }

    const metricIssues = evaluateHyperfocusAudioMetrics(metrics);
    if (metricIssues.length > 0) {
      failedCount += 1;
      for (const metricIssue of metricIssues) issues.push({ ...metricIssue, fileName: asset.fileName });
      assets.push({ ...baseEntry, status: "fail", bytes, sha256, metrics, issues: metricIssues });
      continue;
    }

    passedCount += 1;
    assets.push({ ...baseEntry, status: "pass", bytes, sha256, metrics, issues: [] });
  }

  const expectedCount = assets.length;
  return {
    ok: passedCount === expectedCount && presentCount === expectedCount && missingCount === 0 && failedCount === 0 && invalidCount === 0,
    generatedAt,
    expectedCount,
    presentCount,
    missingCount,
    passedCount,
    failedCount,
    invalidCount,
    issueCount: issues.length,
    limits: LIMITS,
    assets,
    issues,
  };
}

function writeAcceptedCandidateReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, "output/audio-qc/hyperfocus-candidates-current.json"), generatedAt, skipAudioProbe = false, probeAudioFile: probe } = {}) {
  const report = buildAcceptedCandidateReport({ rootDir, generatedAt, skipAudioProbe, probeAudioFile: probe });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ok, outputFile, report };
}

function getRawCandidateAuditFiles({ rootDir = DEFAULT_ROOT, expectedAssets = getExpectedHyperfocusAssets({ rootDir }) } = {}) {
  const quarantineDir = path.join(rootDir, "output/audio-quarantine");
  if (!fs.existsSync(quarantineDir)) return [];

  const candidateNames = fs.readdirSync(quarantineDir).filter((name) => /\.mp3$/i.test(name));
  const entries = [];
  for (const asset of expectedAssets) {
    const baseName = asset.fileName.replace(/\.mp3$/i, "");
    for (const candidateName of candidateNames) {
      if (!isRawCandidateFileName(baseName, candidateName)) continue;
      entries.push({
        asset,
        candidatePath: toPosixPath(path.join("output/audio-quarantine", candidateName)),
      });
    }
  }

  return entries.sort((left, right) => left.candidatePath.localeCompare(right.candidatePath));
}

function isRawCandidateFileName(baseName, candidateName) {
  const normalizedBase = String(baseName || "").toLowerCase();
  const normalizedName = String(candidateName || "").toLowerCase();
  const suffix = "-raw.mp3";
  if (!normalizedBase || !normalizedName.startsWith(normalizedBase) || !normalizedName.endsWith(suffix)) return false;
  const middle = normalizedName.slice(normalizedBase.length, -suffix.length);
  if (!middle) return true;
  if (!middle.startsWith("-")) return false;
  return middle.slice(1).split("-").every((segment) => /^[a-z0-9]+$/.test(segment));
}

function buildRawCandidateAuditReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString(), skipAudioProbe = false, probeAudioFile: probe = probeAudioFile } = {}) {
  const candidates = [];
  const issues = [];
  let rejectedCount = 0;
  let needsReviewCount = 0;
  let invalidCount = 0;
  let uncheckedCount = 0;

  for (const entry of getRawCandidateAuditFiles({ rootDir })) {
    const asset = entry.asset;
    const file = path.join(rootDir, entry.candidatePath);
    const baseEntry = {
      variantId: getVariantId(asset),
      familyId: asset.familyId,
      levelId: asset.levelId,
      fileName: asset.fileName,
      publicPath: asset.publicPath,
      candidatePath: entry.candidatePath,
      issues: [],
    };

    if (!fs.existsSync(file)) {
      const foundIssue = issue("raw-candidate-missing", "Raw quarantine candidate is missing: " + entry.candidatePath + ".", { fileName: asset.fileName, candidatePath: entry.candidatePath });
      invalidCount += 1;
      issues.push(foundIssue);
      candidates.push({ ...baseEntry, status: "missing", issues: [foundIssue] });
      continue;
    }

    const stat = fs.statSync(file);
    if (!stat.isFile()) {
      const foundIssue = issue("raw-candidate-not-file", entry.candidatePath + " is not a regular file.", { fileName: asset.fileName, candidatePath: entry.candidatePath });
      invalidCount += 1;
      issues.push(foundIssue);
      candidates.push({ ...baseEntry, status: "invalid", issues: [foundIssue] });
      continue;
    }

    const bytes = stat.size;
    const sha256 = sha256File(file);

    if (skipAudioProbe) {
      const foundIssue = issue("audio-probe-skipped", "Audio probe was skipped for raw quarantine candidate " + entry.candidatePath + ".", { fileName: asset.fileName, candidatePath: entry.candidatePath });
      uncheckedCount += 1;
      issues.push(foundIssue);
      candidates.push({ ...baseEntry, status: "unchecked", bytes, sha256, issues: [foundIssue] });
      continue;
    }

    let metrics;
    try {
      metrics = probe(file);
    } catch (error) {
      const foundIssue = issue("probe-failed", "Could not probe raw quarantine candidate " + entry.candidatePath + ": " + (error instanceof Error ? error.message : String(error)), { fileName: asset.fileName, candidatePath: entry.candidatePath });
      invalidCount += 1;
      issues.push(foundIssue);
      candidates.push({ ...baseEntry, status: "probe-failed", bytes, sha256, issues: [foundIssue] });
      continue;
    }

    const metricIssues = evaluateHyperfocusAudioMetrics(metrics).map((metricIssue) => ({
      ...metricIssue,
      fileName: asset.fileName,
      candidatePath: entry.candidatePath,
    }));
    if (metricIssues.length > 0) {
      rejectedCount += 1;
      issues.push(...metricIssues);
      candidates.push({ ...baseEntry, status: "rejected", bytes, sha256, metrics, issues: metricIssues });
      continue;
    }

    const foundIssue = issue(
      "raw-candidate-not-accepted",
      "Raw quarantine candidate " + entry.candidatePath + " passed objective metrics but still requires accepted-candidate promotion with provenance and audible review.",
      { fileName: asset.fileName, candidatePath: entry.candidatePath },
    );
    needsReviewCount += 1;
    issues.push(foundIssue);
    candidates.push({ ...baseEntry, status: "needs-audible-review", bytes, sha256, metrics, issues: [foundIssue] });
  }

  return {
    ok: candidates.length === 0,
    generatedAt,
    candidateCount: candidates.length,
    rejectedCount,
    needsReviewCount,
    invalidCount,
    uncheckedCount,
    issueCount: issues.length,
    limits: LIMITS,
    candidates,
    issues,
  };
}

function writeRawCandidateAuditReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, "output/audio-qc/hyperfocus-raw-candidates-current.json"), generatedAt, skipAudioProbe = false, probeAudioFile: probe } = {}) {
  const report = buildRawCandidateAuditReport({ rootDir, generatedAt, skipAudioProbe, probeAudioFile: probe });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ok, outputFile, report };
}

function buildHyperfocusPackagedAssetReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString(), targets = PACKAGED_ASSET_TARGETS } = {}) {
  const expectedAssets = getExpectedHyperfocusAssets({ rootDir });
  const reportTargets = [];
  const issues = [];

  for (const target of targets) {
    const targetAssets = [];
    const targetKind = target.kind || "directory";
    const artifactPath = target.archivePath || target.artifactPath ? toPosixPath(target.archivePath || target.artifactPath) : undefined;
    const targetRelativeDir = targetKind === "zip"
      ? artifactPath + "!/" + toPosixPath(target.entryDir || "")
      : targetKind === "binary-string-index"
        ? toPosixPath(target.binaryPath) + "#embedded/" + toPosixPath(target.entryDir || "")
        : toPosixPath(target.relativeDir);
    let presentCount = 0;
    let missingCount = 0;
    let failedCount = 0;
    let archiveEntries = null;
    let archiveBuffer = null;
    let archiveIssue = null;
    let binaryBuffer = null;
    let binarySha256 = null;
    let binaryIssue = null;

    if (targetKind === "zip") {
      const archiveFile = path.join(rootDir, target.archivePath);
      if (!fs.existsSync(archiveFile)) {
        archiveIssue = issue("missing-package-artifact", "Missing package artifact " + artifactPath + " for target " + target.id + ".", {
          targetId: target.id,
          platform: target.platform,
        });
      } else if (!fs.statSync(archiveFile).isFile()) {
        archiveIssue = issue("package-artifact-not-file", artifactPath + " is not a regular file for target " + target.id + ".", {
          targetId: target.id,
          platform: target.platform,
        });
      } else {
        try {
          archiveBuffer = fs.readFileSync(archiveFile);
          archiveEntries = readZipCentralDirectoryEntriesFromBuffer(archiveBuffer);
        } catch (error) {
          archiveIssue = issue("package-artifact-unreadable", "Could not read package artifact " + artifactPath + ": " + (error instanceof Error ? error.message : String(error)), {
            targetId: target.id,
            platform: target.platform,
          });
        }
      }
    }

    if (targetKind === "binary-string-index") {
      const appPath = path.join(rootDir, target.artifactPath);
      const binaryPath = path.join(rootDir, target.binaryPath);
      if (!fs.existsSync(appPath)) {
        binaryIssue = issue("missing-package-artifact", "Missing package artifact " + artifactPath + " for target " + target.id + ".", {
          targetId: target.id,
          platform: target.platform,
        });
      } else if (!fs.statSync(appPath).isDirectory()) {
        binaryIssue = issue("package-artifact-not-directory", artifactPath + " is not a directory for target " + target.id + ".", {
          targetId: target.id,
          platform: target.platform,
        });
      } else if (!fs.existsSync(binaryPath)) {
        binaryIssue = issue("missing-package-artifact", "Missing package binary " + toPosixPath(target.binaryPath) + " for target " + target.id + ".", {
          targetId: target.id,
          platform: target.platform,
        });
      } else if (!fs.statSync(binaryPath).isFile()) {
        binaryIssue = issue("package-artifact-not-file", toPosixPath(target.binaryPath) + " is not a regular file for target " + target.id + ".", {
          targetId: target.id,
          platform: target.platform,
        });
      } else {
        binaryBuffer = fs.readFileSync(binaryPath);
        binarySha256 = sha256File(binaryPath);
      }
    }

    for (const asset of expectedAssets) {
      const entryPath = targetKind === "zip" || targetKind === "binary-string-index" ? path.posix.join(toPosixPath(target.entryDir || ""), asset.fileName) : "";
      const relativePath = targetKind === "zip"
        ? artifactPath + "!/" + entryPath
        : targetKind === "binary-string-index"
          ? toPosixPath(target.binaryPath) + "#embedded/" + entryPath
          : path.join(target.relativeDir, asset.fileName);
      const displayPath = toPosixPath(relativePath);
      const file = targetKind === "zip" || targetKind === "binary-string-index" ? "" : path.join(rootDir, relativePath);
      const baseEntry = {
        variantId: getVariantId(asset),
        familyId: asset.familyId,
        levelId: asset.levelId,
        fileName: asset.fileName,
        publicPath: asset.publicPath,
        relativePath: displayPath,
        ...(targetKind === "zip" ? { archiveEntryPath: entryPath } : {}),
        ...(targetKind === "binary-string-index" ? { embeddedPath: entryPath, binaryPath: toPosixPath(target.binaryPath) } : {}),
        issues: [],
      };

      if (archiveIssue) {
        const foundIssue = { ...archiveIssue, fileName: asset.fileName };
        if (archiveIssue.code === "missing-package-artifact") missingCount += 1;
        else failedCount += 1;
        issues.push(foundIssue);
        targetAssets.push({ ...baseEntry, status: archiveIssue.code === "missing-package-artifact" ? "missing" : "fail", issues: [foundIssue] });
        continue;
      }

      if (binaryIssue) {
        const foundIssue = { ...binaryIssue, fileName: asset.fileName };
        if (binaryIssue.code === "missing-package-artifact") missingCount += 1;
        else failedCount += 1;
        issues.push(foundIssue);
        targetAssets.push({ ...baseEntry, status: binaryIssue.code === "missing-package-artifact" ? "missing" : "fail", issues: [foundIssue] });
        continue;
      }

      if (targetKind === "binary-string-index") {
        const embeddedPath = path.posix.join(toPosixPath(target.entryDir || ""), asset.fileName);
        const slashPrefixedPath = "/" + embeddedPath;
        const hasEmbeddedAssetPath = binaryBuffer.indexOf(Buffer.from(slashPrefixedPath, "utf8")) >= 0 || binaryBuffer.indexOf(Buffer.from(embeddedPath, "utf8")) >= 0;
        if (!hasEmbeddedAssetPath) {
          const foundIssue = issue("missing-packaged-file", "Missing embedded Hyperfocus asset index entry " + embeddedPath + " in " + toPosixPath(target.binaryPath) + " for target " + target.id + ".", {
            targetId: target.id,
            platform: target.platform,
            fileName: asset.fileName,
          });
          missingCount += 1;
          issues.push(foundIssue);
          targetAssets.push({ ...baseEntry, status: "missing", issues: [foundIssue] });
          continue;
        }

        presentCount += 1;
        targetAssets.push({
          ...baseEntry,
          status: "present",
          sha256: binarySha256,
          issues: [],
        });
        continue;
      }

      if (targetKind === "zip") {
        const archiveEntry = archiveEntries.get(entryPath);
        if (!archiveEntry) {
          const foundIssue = issue("missing-packaged-file", "Missing packaged Hyperfocus asset " + displayPath + " for target " + target.id + ".", {
            targetId: target.id,
            platform: target.platform,
            fileName: asset.fileName,
          });
          missingCount += 1;
          issues.push(foundIssue);
          targetAssets.push({ ...baseEntry, status: "missing", issues: [foundIssue] });
          continue;
        }

        let archiveEntrySha256 = null;
        try {
          archiveEntrySha256 = sha256Buffer(readZipEntryBytes(archiveBuffer, archiveEntry));
        } catch (error) {
          const foundIssue = issue("package-entry-unreadable", "Could not read packaged Hyperfocus asset " + displayPath + " for target " + target.id + ": " + (error instanceof Error ? error.message : String(error)), {
            targetId: target.id,
            platform: target.platform,
            fileName: asset.fileName,
          });
          failedCount += 1;
          issues.push(foundIssue);
          targetAssets.push({
            ...baseEntry,
            status: "fail",
            bytes: archiveEntry.bytes,
            compressedBytes: archiveEntry.compressedBytes,
            crc32: archiveEntry.crc32,
            issues: [foundIssue],
          });
          continue;
        }

        const sourceFile = path.join(rootDir, PUBLIC_ASSET_DIR, asset.fileName);
        if (fs.existsSync(sourceFile) && fs.statSync(sourceFile).isFile()) {
          const sourceSha256 = sha256File(sourceFile);
          if (archiveEntrySha256 !== sourceSha256) {
            const foundIssue = issue("packaged-asset-sha-mismatch", "Packaged Hyperfocus asset " + displayPath + " does not match source public asset " + toPosixPath(path.relative(rootDir, sourceFile)) + ".", {
              targetId: target.id,
              platform: target.platform,
              fileName: asset.fileName,
              expectedSha256: sourceSha256,
              actualSha256: archiveEntrySha256,
            });
            failedCount += 1;
            issues.push(foundIssue);
            targetAssets.push({
              ...baseEntry,
              status: "fail",
              bytes: archiveEntry.bytes,
              compressedBytes: archiveEntry.compressedBytes,
              crc32: archiveEntry.crc32,
              sha256: archiveEntrySha256,
              issues: [foundIssue],
            });
            continue;
          }
        }

        presentCount += 1;
        targetAssets.push({
          ...baseEntry,
          status: "present",
          bytes: archiveEntry.bytes,
          compressedBytes: archiveEntry.compressedBytes,
          crc32: archiveEntry.crc32,
          sha256: archiveEntrySha256,
          issues: [],
        });
        continue;
      }

      if (!fs.existsSync(file)) {
        const foundIssue = issue("missing-packaged-file", "Missing packaged Hyperfocus asset " + displayPath + " for target " + target.id + ".", {
          targetId: target.id,
          platform: target.platform,
          fileName: asset.fileName,
        });
        missingCount += 1;
        issues.push(foundIssue);
        targetAssets.push({ ...baseEntry, status: "missing", issues: [foundIssue] });
        continue;
      }

      const stat = fs.statSync(file);
      if (!stat.isFile()) {
        const foundIssue = issue("packaged-asset-not-file", displayPath + " is not a regular file for target " + target.id + ".", {
          targetId: target.id,
          platform: target.platform,
          fileName: asset.fileName,
        });
        failedCount += 1;
        issues.push(foundIssue);
        targetAssets.push({ ...baseEntry, status: "fail", issues: [foundIssue] });
        continue;
      }

      presentCount += 1;
      targetAssets.push({
        ...baseEntry,
        status: "present",
        bytes: stat.size,
        sha256: sha256File(file),
      });
    }

    reportTargets.push({
      id: target.id,
      platform: target.platform,
      label: target.label,
      relativeDir: targetRelativeDir,
      ...(artifactPath ? { artifactPath } : {}),
      ...(target.binaryPath ? { binaryPath: toPosixPath(target.binaryPath) } : {}),
      expectedCount: expectedAssets.length,
      presentCount,
      missingCount,
      failedCount,
      ok: presentCount === expectedAssets.length && missingCount === 0 && failedCount === 0,
      assets: targetAssets,
    });
  }

  return {
    ok: reportTargets.every((target) => target.ok),
    generatedAt,
    expectedCount: expectedAssets.length,
    targetCount: reportTargets.length,
    targets: reportTargets,
    issues,
  };
}

function writeHyperfocusPackagedAssetReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, "output/audio-qc/hyperfocus-package-current.json"), generatedAt, targets } = {}) {
  const report = buildHyperfocusPackagedAssetReport({ rootDir, generatedAt, targets });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ok, outputFile, report };
}

function buildGenerationCreditsReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString(), model, creditBalance, pilotCreditCost, nextResetDate } = {}) {
  const spec = getSpec(rootDir);
  const selectedModel = String(model || spec.modelPolicy?.allowedCurrentCandidate || "");
  const balance = Number(creditBalance);
  const cost = Number(pilotCreditCost);
  const hasValidNumbers = Number.isFinite(balance) && Number.isFinite(cost) && balance >= 0 && cost >= 0;
  const sufficientForPilot = hasValidNumbers && balance >= cost;

  return {
    ok: sufficientForPilot,
    generatedAt,
    provider: "Picsart",
    model: selectedModel,
    creditBalance: Number.isFinite(balance) ? balance : null,
    pilotCreditCost: Number.isFinite(cost) ? cost : null,
    sufficientForPilot,
    ...(nextResetDate ? { nextResetDate: String(nextResetDate) } : {}),
  };
}

function writeGenerationCreditsReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, GENERATION_CREDITS_PATH), generatedAt, model, creditBalance, pilotCreditCost, nextResetDate } = {}) {
  const report = buildGenerationCreditsReport({ rootDir, generatedAt, model, creditBalance, pilotCreditCost, nextResetDate });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ok, outputFile, report };
}

function readGenerationCreditsEvidence(rootDir = DEFAULT_ROOT) {
  const file = path.join(rootDir, GENERATION_CREDITS_PATH);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  try {
    return readJson(file);
  } catch {
    return { ok: false, invalid: true };
  }
}

function normalizeNonNegativeNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
}

function buildGenerationAuthorizationReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString(), model, phase = "pilot", creditBalance, creditCostPerJob, pilotCreditCost, nextResetDate, skipAudioProbe = false, probeAudioFile: probe = probeAudioFile } = {}) {
  const requestedPhase = String(phase || "pilot").trim().toLowerCase();
  const queue = buildGeminiGenerationQueue({ rootDir, model, phase: requestedPhase });
  const provider = queue.provider || "Google";
  const spec = getSpec(rootDir);
  const selectedModel = queue.model || String(model || spec.modelPolicy?.allowedCurrentCandidate || "");
  const normalizedPhase = queue.phase || (requestedPhase === "pilot" ? "pilot" : "full-pack-after-pilot");
  const promptPolicy = buildPromptPolicyReport({ rootDir, generatedAt });
  const promptPolicyBlocking = !promptPolicy.ok;
  const blockers = [];

  if (promptPolicyBlocking) {
    blockers.push(issue("prompt-policy-invalid", "Hyperfocus Gemini/Lyria generation prompts must satisfy the non-musical seamless ambience policy before spending credits."));
  }

  if (!queue.ok && !promptPolicyBlocking) {
    blockers.push(issue("generation-queue-invalid", "Gemini/Lyria generation queue is invalid for phase " + requestedPhase + "."));
  }

  const balance = normalizeNonNegativeNumber(creditBalance);
  const perJobCost = normalizeNonNegativeNumber(creditCostPerJob ?? pilotCreditCost);
  const requiredCreditCost = queue.ok && perJobCost !== null ? queue.jobs.length * perJobCost : null;
  const sufficientCredits = balance !== null && perJobCost !== null && requiredCreditCost !== null && balance >= requiredCreditCost;
  if (queue.ok && !sufficientCredits) {
    blockers.push(issue("generation-credits-insufficient", "Available generation credits are below the " + normalizedPhase + " generation cost."));
  }

  let pilotGate = {
    required: queue.requiresAcceptedPilot === true,
    ok: true,
    blocking: false,
    pilotVariantId: queue.pilotVariantId || PILOT_VARIANT_ID,
  };

  if (queue.requiresAcceptedPilot === true) {
    const gateReport = buildPilotGateReport({ rootDir, generatedAt, skipAudioProbe, probeAudioFile: probe });
    pilotGate = {
      required: true,
      ok: gateReport.ok,
      blocking: !gateReport.ok,
      pilotVariantId: gateReport.pilotVariantId || queue.pilotVariantId || PILOT_VARIANT_ID,
      fileName: gateReport.fileName,
      candidateStatus: gateReport.candidateStatus,
      audibleReviewStatus: gateReport.audibleReviewStatus,
      issueCount: gateReport.issueCount,
    };
    if (!gateReport.ok) {
      blockers.push(issue("pilot-gate-not-accepted", "Full-pack generation requires an accepted fireplace:soft pilot before spending credits."));
    }
  }

  const authorized = blockers.length === 0;
  return {
    ok: authorized,
    authorized,
    generatedAt,
    provider,
    model: selectedModel,
    phase: normalizedPhase,
    pilotVariantId: queue.pilotVariantId || PILOT_VARIANT_ID,
    queue: {
      ok: queue.ok,
      phase: normalizedPhase,
      jobCount: queue.jobs.length,
      issueCount: queue.issues.length,
      requiresAcceptedPilot: queue.requiresAcceptedPilot === true,
      pilotVariantId: queue.pilotVariantId || PILOT_VARIANT_ID,
      creditCostPerJob: perJobCost,
      requiredCreditCost,
    },
    promptPolicy: {
      ok: promptPolicy.ok,
      familyCount: promptPolicy.familyCount,
      levelCount: promptPolicy.levelCount,
      promptCount: promptPolicy.promptCount,
      providerPolicy: promptPolicy.policy.requiredProvider,
      model: promptPolicy.policy.allowedCurrentCandidate,
      issueCount: promptPolicy.issueCount,
      blocking: promptPolicyBlocking,
    },
    credits: {
      ok: sufficientCredits,
      creditBalance: balance,
      creditCostPerJob: perJobCost,
      requiredCreditCost,
      sufficient: sufficientCredits,
      ...(nextResetDate ? { nextResetDate: String(nextResetDate) } : {}),
    },
    pilotGate,
    blockers,
  };
}

function writeGenerationAuthorizationReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, GENERATION_AUTHORIZATION_PATH), generatedAt, model, phase, creditBalance, creditCostPerJob, pilotCreditCost, nextResetDate, skipAudioProbe = false, probeAudioFile: probe = probeAudioFile } = {}) {
  const report = buildGenerationAuthorizationReport({ rootDir, generatedAt, model, phase, creditBalance, creditCostPerJob, pilotCreditCost, nextResetDate, skipAudioProbe, probeAudioFile: probe });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ok, outputFile, report };
}


function pickDecisionCreditValue(explicitValue, evidenceValue) {
  const explicitNumber = normalizeNonNegativeNumber(explicitValue);
  if (explicitNumber !== null) return explicitNumber;
  return normalizeNonNegativeNumber(evidenceValue);
}

function generationCommandForPhase({ model, phase } = {}) {
  const normalizedPhase = String(phase || "pilot").trim().toLowerCase();
  if (normalizedPhase === "pilot") {
    return "node scripts/check-hyperfocus-audio-assets.cjs --print-generation-queue --model " + model + " --phase pilot";
  }
  return "node scripts/check-hyperfocus-audio-assets.cjs --print-generation-queue --model " + model + " --phase full";
}

function buildGenerationDecisionReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString(), model, creditBalance, creditCostPerJob, pilotCreditCost, nextResetDate, skipAudioProbe = false, probeAudioFile: probe = probeAudioFile } = {}) {
  const spec = getSpec(rootDir);
  const selectedModel = String(model || spec.modelPolicy?.allowedCurrentCandidate || "");
  const generationCreditsEvidence = readGenerationCreditsEvidence(rootDir) || {};
  const providerCapabilityEvidence = readProviderCapabilityEvidence(rootDir);
  const resolvedCreditBalance = pickDecisionCreditValue(creditBalance, generationCreditsEvidence.creditBalance);
  const resolvedCreditCostPerJob = pickDecisionCreditValue(creditCostPerJob ?? pilotCreditCost, generationCreditsEvidence.pilotCreditCost);
  const resolvedNextResetDate = nextResetDate || generationCreditsEvidence.nextResetDate;

  const pilotAuthorization = buildGenerationAuthorizationReport({
    rootDir,
    generatedAt,
    model: selectedModel,
    phase: "pilot",
    creditBalance: resolvedCreditBalance,
    creditCostPerJob: resolvedCreditCostPerJob,
    nextResetDate: resolvedNextResetDate,
    skipAudioProbe,
    probeAudioFile: probe,
  });
  const fullAuthorization = buildGenerationAuthorizationReport({
    rootDir,
    generatedAt,
    model: selectedModel,
    phase: "full",
    creditBalance: resolvedCreditBalance,
    creditCostPerJob: resolvedCreditCostPerJob,
    nextResetDate: resolvedNextResetDate,
    skipAudioProbe,
    probeAudioFile: probe,
  });
  const readiness = buildHyperfocusReadinessReport({ rootDir, generatedAt, model: selectedModel, skipAudioProbe, probeAudioFile: probe });

  const pilotBlockerCodes = new Set((pilotAuthorization.blockers || []).map((blocker) => blocker.code));
  const fullBlockerCodes = new Set((fullAuthorization.blockers || []).map((blocker) => blocker.code));
  const readinessBlockerCodes = new Set((readiness.blockers || []).map((blocker) => blocker.code));
  const allBlockerCodes = new Set([...pilotBlockerCodes, ...fullBlockerCodes, ...readinessBlockerCodes]);

  let nextAction = "resolve-qc-blockers";
  let phase = "blocked";
  let shouldGenerate = false;
  let reason = "Resolve remaining QC blockers before generation.";

  if (readiness.ready) {
    nextAction = "ready-for-release";
    phase = "complete";
    reason = "All readiness gates are satisfied; no generation decision is required.";
  } else if (providerCapabilityEvidence && providerCapabilityEvidence.ok === false) {
    nextAction = "wait-for-provider-capability";
    phase = "blocked";
    reason = "Provider capability evidence does not show an allowed Google/Gemini-family pilot model.";
  } else if (pilotBlockerCodes.has("generation-credits-insufficient")) {
    nextAction = "wait-for-credits";
    phase = "pilot";
    reason = "Pilot generation is not authorized because the current credit balance is below the pilot cost.";
  } else if (pilotAuthorization.authorized && readiness.checks?.pilotGate?.ok !== true) {
    nextAction = "run-pilot-generation";
    phase = "pilot";
    shouldGenerate = true;
    reason = "Credits and prompt policy allow exactly one pilot; run only fireplace:soft and keep full-pack generation blocked.";
  } else if (readiness.checks?.pilotGate?.ok !== true || fullBlockerCodes.has("pilot-gate-not-accepted")) {
    nextAction = "wait-for-pilot-acceptance";
    phase = "full-pack-after-pilot";
    reason = "Full-pack generation requires an accepted fireplace:soft pilot with objective QC and audible review.";
  } else if (fullBlockerCodes.has("generation-credits-insufficient")) {
    nextAction = "wait-for-full-pack-credits";
    phase = "full-pack-after-pilot";
    reason = "Pilot gate is satisfied, but current credits are below the full-pack generation cost.";
  } else if (fullAuthorization.authorized) {
    nextAction = "ready-for-full-pack-generation";
    phase = "full-pack-after-pilot";
    shouldGenerate = true;
    reason = "Pilot gate and full-pack authorization are satisfied; generate the full pack and promote only after QC.";
  }

  return {
    ok: shouldGenerate || nextAction === "ready-for-release",
    shouldGenerate,
    generatedAt,
    provider: "Google",
    model: selectedModel,
    phase,
    nextAction,
    reason,
    blockerCodes: Array.from(allBlockerCodes),
    credits: {
      ok: generationCreditsEvidence.ok === true,
      creditBalance: resolvedCreditBalance,
      pilotCreditCost: resolvedCreditCostPerJob,
      sufficientForPilot: resolvedCreditBalance !== null && resolvedCreditCostPerJob !== null && resolvedCreditBalance >= resolvedCreditCostPerJob,
      ...(resolvedNextResetDate ? { nextResetDate: String(resolvedNextResetDate) } : {}),
    },
    providerCapability: providerCapabilityEvidence
      ? {
          ok: providerCapabilityEvidence.ok === true,
          googleAudioModelCount: providerCapabilityEvidence.googleAudioModelCount ?? null,
          ttsModelCount: providerCapabilityEvidence.ttsModelCount ?? null,
          musicModelCount: providerCapabilityEvidence.musicModelCount ?? null,
          sfxModelCount: providerCapabilityEvidence.sfxModelCount ?? null,
          soundscapeOrSfxModelAvailable: providerCapabilityEvidence.soundscapeOrSfxModelAvailable === true,
          allowedPilotModelAvailable: providerCapabilityEvidence.allowedPilotModelAvailable === true,
          recommendedAction: providerCapabilityEvidence.recommendedAction || null,
          issueCount: providerCapabilityEvidence.issueCount ?? 0,
          warningCount: providerCapabilityEvidence.warningCount ?? 0,
        }
      : { ok: null, status: "missing" },
    pilotAuthorization: {
      authorized: pilotAuthorization.authorized,
      phase: pilotAuthorization.phase,
      requiredCreditCost: pilotAuthorization.queue.requiredCreditCost,
      blockerCodes: (pilotAuthorization.blockers || []).map((blocker) => blocker.code),
    },
    fullAuthorization: {
      authorized: fullAuthorization.authorized,
      phase: fullAuthorization.phase,
      requiredCreditCost: fullAuthorization.queue.requiredCreditCost,
      requiresAcceptedPilot: fullAuthorization.queue.requiresAcceptedPilot,
      blockerCodes: (fullAuthorization.blockers || []).map((blocker) => blocker.code),
    },
    readiness: {
      ready: readiness.ready,
      blockerCodes: (readiness.blockers || []).map((blocker) => blocker.code),
      publicAssetsOk: readiness.checks?.publicAssets?.ok === true,
      pilotGateOk: readiness.checks?.pilotGate?.ok === true,
      generatedManifestOk: readiness.checks?.generatedManifest?.ok === true,
    },
    commands: {
      generationQueue: shouldGenerate ? generationCommandForPhase({ model: selectedModel, phase }) : null,
      refreshAuthorization: "node scripts/check-hyperfocus-audio-assets.cjs --write-generation-authorization-report output/audio-qc/hyperfocus-generation-authorization-" + (phase === "pilot" ? "pilot" : "full") + "-current.json --model " + selectedModel + " --phase " + (phase === "pilot" ? "pilot" : "full"),
      refreshReadiness: "node scripts/check-hyperfocus-audio-assets.cjs --write-readiness-report output/audio-qc/hyperfocus-readiness-current.json --model " + selectedModel + " --skip-audio-probe",
    },
  };
}

function writeGenerationDecisionReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, GENERATION_DECISION_PATH), generatedAt, model, creditBalance, creditCostPerJob, pilotCreditCost, nextResetDate, skipAudioProbe = false, probeAudioFile: probe = probeAudioFile } = {}) {
  const report = buildGenerationDecisionReport({ rootDir, generatedAt, model, creditBalance, creditCostPerJob, pilotCreditCost, nextResetDate, skipAudioProbe, probeAudioFile: probe });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ok, outputFile, report };
}

function buildAudibleReviewApprovalReport({ rootDir = DEFAULT_ROOT, expectedAssets = getExpectedHyperfocusAssets({ rootDir }) } = {}) {
  const assets = [];
  const issues = [];
  let presentCount = 0;
  let approvedCount = 0;
  let missingCount = 0;
  let invalidCount = 0;
  let failedCount = 0;

  for (const asset of expectedAssets) {
    const relativePath = getAudibleReviewTemplatePath(asset.fileName);
    const reviewFile = path.join(rootDir, relativePath);
    const baseEntry = {
      variantId: getVariantId(asset),
      familyId: asset.familyId,
      levelId: asset.levelId,
      fileName: asset.fileName,
      relativePath,
      issues: [],
    };

    if (!fs.existsSync(reviewFile)) {
      const foundIssue = issue("missing-audible-review-approval", "Missing audible review approval file " + relativePath + " for " + asset.fileName + ".", {
        fileName: asset.fileName,
      });
      missingCount += 1;
      issues.push(foundIssue);
      assets.push({ ...baseEntry, status: "missing", issues: [foundIssue] });
      continue;
    }

    presentCount += 1;
    const stat = fs.statSync(reviewFile);
    if (!stat.isFile()) {
      const foundIssue = issue("audible-review-approval-not-file", relativePath + " is not a regular file for " + asset.fileName + ".", {
        fileName: asset.fileName,
      });
      invalidCount += 1;
      issues.push(foundIssue);
      assets.push({ ...baseEntry, status: "invalid", issues: [foundIssue] });
      continue;
    }

    let review;
    try {
      review = readJson(reviewFile);
    } catch (error) {
      const foundIssue = issue("invalid-audible-review-approval-json", "Could not parse audible review approval " + relativePath + ": " + (error instanceof Error ? error.message : String(error)), {
        fileName: asset.fileName,
      });
      invalidCount += 1;
      issues.push(foundIssue);
      assets.push({ ...baseEntry, status: "invalid", issues: [foundIssue] });
      continue;
    }

    const validation = validateAudibleReviewPayload({ rootDir, asset, review });
    if (!validation.ok) {
      failedCount += 1;
      issues.push(validation.issue);
      assets.push({ ...baseEntry, status: "fail", issues: [validation.issue] });
      continue;
    }

    approvedCount += 1;
    assets.push({ ...baseEntry, status: "approved", reviewer: validation.entry.reviewer, reviewedAt: validation.entry.reviewedAt, issues: [] });
  }

  return {
    ok: approvedCount === expectedAssets.length && missingCount === 0 && invalidCount === 0 && failedCount === 0,
    expectedCount: expectedAssets.length,
    presentCount,
    approvedCount,
    missingCount,
    invalidCount,
    failedCount,
    issueCount: issues.length,
    assets,
    issues,
  };
}

function getPilotAsset({ rootDir = DEFAULT_ROOT } = {}) {
  const spec = getSpec(rootDir);
  const pilotVariantId = String(spec.modelPolicy?.pilotVariantId || PILOT_VARIANT_ID);
  const asset = getExpectedHyperfocusAssets({ rootDir }).find((candidate) => getVariantId(candidate) === pilotVariantId);
  return { pilotVariantId, asset };
}

function buildPilotGateReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString(), skipAudioProbe = false, probeAudioFile: probe = probeAudioFile } = {}) {
  const { pilotVariantId, asset } = getPilotAsset({ rootDir });
  const issues = [];

  if (!asset) {
    const foundIssue = issue("missing-pilot-asset", "Pilot variant " + pilotVariantId + " is not present in the Hyperfocus generation spec.");
    return {
      ok: false,
      generatedAt,
      pilotVariantId,
      fileName: null,
      candidatePath: null,
      audibleReviewPath: null,
      candidateStatus: "missing-spec-asset",
      audibleReviewStatus: "not-checked",
      issueCount: 1,
      issues: [foundIssue],
    };
  }

  const candidatePath = getAcceptedCandidatePath(asset.fileName);
  const candidateFile = path.join(rootDir, candidatePath);
  const audibleReviewPath = getAudibleReviewTemplatePath(asset.fileName);
  const reviewFile = path.join(rootDir, audibleReviewPath);
  let candidateStatus = "missing";
  let audibleReviewStatus = "missing";
  let bytes = null;
  let sha256 = null;
  let metrics = null;
  let reviewer = null;
  let reviewedAt = null;

  if (!fs.existsSync(candidateFile)) {
    issues.push(issue("missing-pilot-candidate", "Missing accepted pilot candidate " + candidatePath + ".", { fileName: asset.fileName }));
  } else {
    const stat = fs.statSync(candidateFile);
    if (!stat.isFile()) {
      candidateStatus = "invalid";
      issues.push(issue("pilot-candidate-not-file", candidatePath + " is not a regular file.", { fileName: asset.fileName }));
    } else {
      bytes = stat.size;
      sha256 = sha256File(candidateFile);
      if (skipAudioProbe) {
        candidateStatus = "unchecked";
        issues.push(issue("pilot-audio-probe-skipped", "Audio probe was skipped for accepted pilot candidate " + candidatePath + ".", { fileName: asset.fileName }));
      } else {
        try {
          metrics = probe(candidateFile);
          const metricIssues = evaluateHyperfocusAudioMetrics(metrics);
          if (metricIssues.length > 0) {
            candidateStatus = "fail";
            for (const metricIssue of metricIssues) issues.push({ ...metricIssue, fileName: asset.fileName });
          } else {
            candidateStatus = "pass";
          }
        } catch (error) {
          candidateStatus = "probe-failed";
          issues.push(issue("pilot-probe-failed", "Could not probe accepted pilot candidate " + candidatePath + ": " + (error instanceof Error ? error.message : String(error)), { fileName: asset.fileName }));
        }
      }
    }
  }

  if (!fs.existsSync(reviewFile)) {
    issues.push(issue("missing-pilot-audible-review", "Missing pilot audible review approval " + audibleReviewPath + ".", { fileName: asset.fileName }));
  } else if (!fs.statSync(reviewFile).isFile()) {
    audibleReviewStatus = "invalid";
    issues.push(issue("pilot-audible-review-not-file", audibleReviewPath + " is not a regular file.", { fileName: asset.fileName }));
  } else {
    try {
      const review = readJson(reviewFile);
      const validation = validateAudibleReviewPayload({ rootDir, asset, review });
      if (!validation.ok) {
        audibleReviewStatus = "fail";
        issues.push(validation.issue);
      } else {
        audibleReviewStatus = "approved";
        reviewer = validation.entry.reviewer;
        reviewedAt = validation.entry.reviewedAt;
      }
    } catch (error) {
      audibleReviewStatus = "invalid";
      issues.push(issue("invalid-pilot-audible-review-json", "Could not parse pilot audible review " + audibleReviewPath + ": " + (error instanceof Error ? error.message : String(error)), { fileName: asset.fileName }));
    }
  }

  return {
    ok: candidateStatus === "pass" && audibleReviewStatus === "approved",
    generatedAt,
    pilotVariantId,
    fileName: asset.fileName,
    candidatePath,
    audibleReviewPath,
    candidateStatus,
    audibleReviewStatus,
    ...(bytes !== null ? { bytes } : {}),
    ...(sha256 ? { sha256 } : {}),
    ...(metrics ? { metrics } : {}),
    ...(reviewer ? { reviewer } : {}),
    ...(reviewedAt ? { reviewedAt } : {}),
    issueCount: issues.length,
    issues,
  };
}

function writePilotGateReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, "output/audio-qc/hyperfocus-pilot-gate-current.json"), generatedAt, skipAudioProbe = false, probeAudioFile: probe } = {}) {
  const report = buildPilotGateReport({ rootDir, generatedAt, skipAudioProbe, probeAudioFile: probe });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ok, outputFile, report };
}

function buildHyperfocusReadinessReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString(), model, skipAudioProbe = false, probeAudioFile: probe = probeAudioFile } = {}) {
  const expectedAssets = getExpectedHyperfocusAssets({ rootDir });
  const spec = getSpec(rootDir);
  const originalSourceCoverage = buildOriginalSourceCoverageReport({ rootDir, generatedAt });
  const promptPolicy = buildPromptPolicyReport({ rootDir, generatedAt });
  const providerCapabilityEvidence = readProviderCapabilityEvidence(rootDir);
  const variantCount = expectedAssets.length;
  const familyCount = Array.isArray(spec.families) ? spec.families.length : 0;
  const blockers = [];

  const specOk = spec.modelPolicy?.requiredProvider === "Google Gemini family only" && familyCount === 6 && variantCount === 18;
  if (!specOk) {
    blockers.push(issue("spec-incomplete", "Hyperfocus generation spec must contain 6 families, 18 variants, and the Google Gemini-only provider policy."));
  }
  if (!originalSourceCoverage.ok) {
    blockers.push(issue("original-source-coverage-invalid", "Hyperfocus generation spec must cover every first-party V1 focus sound with exactly three levels."));
  }
  if (!promptPolicy.ok) {
    blockers.push(issue("prompt-policy-invalid", "Hyperfocus generation prompts must satisfy the Gemini-only non-musical seamless ambience policy for all 18 variants."));
  }

  const generationQueue = buildGeminiGenerationQueue({ rootDir, model, phase: "full" });
  if (!generationQueue.ok) {
    blockers.push(issue("generation-queue-invalid", "Gemini generation queue is invalid."));
  }

  const pilotGenerationQueue = buildGeminiGenerationQueue({ rootDir, model, phase: "pilot" });
  const pilotGenerationQueueOk = pilotGenerationQueue.ok && pilotGenerationQueue.jobs.length === 1 && pilotGenerationQueue.jobs[0]?.variantId === pilotGenerationQueue.pilotVariantId;
  if (!pilotGenerationQueueOk) {
    blockers.push(issue("pilot-generation-queue-invalid", "Pilot generation queue must contain exactly the fireplace:soft pilot job."));
  }

  const batchTemplate = buildPromotionBatchTemplate({ rootDir, model, phase: "full" });
  if (!batchTemplate.ok) {
    blockers.push(issue("batch-template-invalid", "Promotion batch template cannot be built."));
  }

  const pilotBatchTemplate = buildPromotionBatchTemplate({ rootDir, model, phase: "pilot" });
  const pilotBatchTemplateOk = pilotBatchTemplate.ok && Boolean(pilotBatchTemplate.batch) && pilotBatchTemplate.batch.assets.length === 1 && pilotBatchTemplate.batch.assets[0]?.variantId === pilotGenerationQueue.pilotVariantId;
  if (!pilotBatchTemplateOk) {
    blockers.push(issue("pilot-batch-template-invalid", "Pilot promotion batch template must contain exactly the fireplace:soft asset."));
  }

  const candidateUrlIntakeTemplate = buildCandidateUrlIntakeTemplate({ rootDir, model, phase: "full" });
  if (!candidateUrlIntakeTemplate.ok) {
    blockers.push(issue("candidate-url-intake-template-invalid", "Candidate URL intake template cannot be built."));
  }

  const pilotCandidateUrlIntakeTemplate = buildCandidateUrlIntakeTemplate({ rootDir, model, phase: "pilot" });
  const pilotCandidateUrlIntakeTemplateOk = pilotCandidateUrlIntakeTemplate.ok && Boolean(pilotCandidateUrlIntakeTemplate.batch) && pilotCandidateUrlIntakeTemplate.batch.assets.length === 1 && pilotCandidateUrlIntakeTemplate.batch.assets[0]?.variantId === pilotGenerationQueue.pilotVariantId;
  if (!pilotCandidateUrlIntakeTemplateOk) {
    blockers.push(issue("pilot-candidate-url-intake-template-invalid", "Pilot candidate URL intake template must contain exactly the fireplace:soft asset."));
  }

  let audibleReviewTemplatePresentCount = 0;
  let audibleReviewTemplateInvalidCount = 0;
  for (const asset of expectedAssets) {
    const reviewTemplateFile = path.join(rootDir, getAudibleReviewTemplatePath(asset.fileName));
    if (!fs.existsSync(reviewTemplateFile) || !fs.statSync(reviewTemplateFile).isFile()) continue;
    try {
      readJson(reviewTemplateFile);
      audibleReviewTemplatePresentCount += 1;
    } catch {
      audibleReviewTemplateInvalidCount += 1;
    }
  }
  const audibleReviewTemplateMissingCount = expectedAssets.length - audibleReviewTemplatePresentCount - audibleReviewTemplateInvalidCount;
  const audibleReviewTemplatesOk = audibleReviewTemplateMissingCount === 0 && audibleReviewTemplateInvalidCount === 0;
  if (!audibleReviewTemplatesOk) {
    blockers.push(issue("audible-review-templates-missing", "Audible review templates are missing or invalid for the generated Hyperfocus pack."));
  }

  const acceptedCandidateReport = buildAcceptedCandidateReport({ rootDir, generatedAt, skipAudioProbe, probeAudioFile: probe });
  const rawCandidateAuditReport = buildRawCandidateAuditReport({ rootDir, generatedAt, skipAudioProbe, probeAudioFile: probe });
  const audibleReviewApprovalReport = buildAudibleReviewApprovalReport({ rootDir, expectedAssets });
  const pilotGateReport = buildPilotGateReport({ rootDir, generatedAt, skipAudioProbe, probeAudioFile: probe });

  const publicAssets = buildHyperfocusAudioQcReport({ rootDir, generatedAt, skipAudioProbe });
  const generationCreditsEvidence = readGenerationCreditsEvidence(rootDir);
  const generationCreditsBlocking = !publicAssets.ok && Boolean(generationCreditsEvidence) && generationCreditsEvidence.ok !== true;
  const pilotGateBlocking = !publicAssets.ok && !pilotGateReport.ok;
  const acceptedCandidatesBlocking = !publicAssets.ok && !acceptedCandidateReport.ok;
  const audibleReviewApprovalsBlocking = !publicAssets.ok && acceptedCandidateReport.presentCount > 0 && !audibleReviewApprovalReport.ok;
  if (generationCreditsBlocking) {
    blockers.push(issue("generation-credits-insufficient", "Available generation credits are below the pilot generation cost."));
  }
  if (pilotGateBlocking) {
    blockers.push(issue("pilot-gate-not-accepted", "The fireplace:soft pilot must pass objective QC and audible review before full-pack generation/promotion."));
  }
  if (acceptedCandidatesBlocking) {
    blockers.push(
      acceptedCandidateReport.missingCount > 0
        ? issue("accepted-candidates-missing", "Accepted generated candidate files are missing before public asset promotion.")
        : issue("accepted-candidates-invalid", "Accepted generated candidate files must pass objective audio QC before public asset promotion."),
    );
  }
  if (audibleReviewApprovalsBlocking) {
    blockers.push(issue("audible-review-approvals-incomplete", "Accepted generated candidates require completed audible review approvals before public asset promotion."));
  }
  if (!publicAssets.ok) {
    blockers.push(issue("public-assets-missing", "Generated public Hyperfocus assets are not complete or do not pass QC."));
  }

  const packageTargets = buildHyperfocusPackagedAssetReport({ rootDir, generatedAt });
  if (!packageTargets.ok) {
    blockers.push(issue("package-targets-missing", "Generated Hyperfocus assets are not present across all package targets."));
  }

  const manifest = collectGeneratedAudioManifestEntries({ rootDir, generatedAt });
  const manifestComplete = manifest.ok && manifest.entries.length === expectedAssets.length;
  if (!manifestComplete) {
    blockers.push(issue("generated-manifest-incomplete", "Generated Hyperfocus manifest does not contain all " + expectedAssets.length + " variants."));
  }

  const checks = {
    spec: {
      ok: specOk,
      familyCount,
      variantCount,
      providerPolicy: spec.modelPolicy?.requiredProvider || null,
    },
    originalSourceCoverage: {
      ok: originalSourceCoverage.ok,
      focusAssetCount: originalSourceCoverage.focusAssetCount,
      specFamilyCount: originalSourceCoverage.specFamilyCount,
      coveredFamilyCount: originalSourceCoverage.coveredFamilyCount,
      expectedLevelCount: originalSourceCoverage.expectedLevelCount,
      plannedLevelCount: originalSourceCoverage.plannedLevelCount,
      issueCount: originalSourceCoverage.issueCount,
    },
    promptPolicy: {
      ok: promptPolicy.ok,
      familyCount: promptPolicy.familyCount,
      levelCount: promptPolicy.levelCount,
      promptCount: promptPolicy.promptCount,
      providerPolicy: promptPolicy.policy.requiredProvider,
      model: promptPolicy.policy.allowedCurrentCandidate,
      issueCount: promptPolicy.issueCount,
    },
    providerCapability: providerCapabilityEvidence
      ? {
          ok: providerCapabilityEvidence.ok === true,
          provider: providerCapabilityEvidence.provider || "Google",
          mode: providerCapabilityEvidence.mode || "audio",
          googleAudioModelCount: providerCapabilityEvidence.googleAudioModelCount ?? null,
          ttsModelCount: providerCapabilityEvidence.ttsModelCount ?? null,
          musicModelCount: providerCapabilityEvidence.musicModelCount ?? null,
          sfxModelCount: providerCapabilityEvidence.sfxModelCount ?? null,
          soundscapeOrSfxModelAvailable: providerCapabilityEvidence.soundscapeOrSfxModelAvailable === true,
          allowedPilotModelAvailable: providerCapabilityEvidence.allowedPilotModelAvailable === true,
          recommendedAction: providerCapabilityEvidence.recommendedAction || null,
          issueCount: providerCapabilityEvidence.issueCount ?? (providerCapabilityEvidence.invalid ? 1 : 0),
          warningCount: providerCapabilityEvidence.warningCount ?? 0,
          blocking: false,
        }
      : {
          ok: null,
          status: "missing",
          blocking: false,
        },
    generationQueue: {
      ok: generationQueue.ok,
      phase: generationQueue.phase || "full-pack-after-pilot",
      requiresAcceptedPilot: generationQueue.requiresAcceptedPilot === true,
      pilotVariantId: generationQueue.pilotVariantId || PILOT_VARIANT_ID,
      provider: generationQueue.provider || "Google",
      model: generationQueue.model || String(model || spec.modelPolicy?.allowedCurrentCandidate || ""),
      jobCount: generationQueue.jobs.length,
      issueCount: generationQueue.issues.length,
    },
    pilotGenerationQueue: {
      ok: pilotGenerationQueueOk,
      phase: pilotGenerationQueue.phase || "pilot",
      requiresAcceptedPilot: pilotGenerationQueue.requiresAcceptedPilot === true,
      pilotVariantId: pilotGenerationQueue.pilotVariantId || PILOT_VARIANT_ID,
      provider: pilotGenerationQueue.provider || "Google",
      model: pilotGenerationQueue.model || String(model || spec.modelPolicy?.allowedCurrentCandidate || ""),
      jobCount: pilotGenerationQueue.jobs.length,
      firstVariantId: pilotGenerationQueue.jobs[0]?.variantId || null,
      issueCount: pilotGenerationQueue.issues.length,
    },
    batchTemplate: {
      ok: batchTemplate.ok && Boolean(batchTemplate.batch) && batchTemplate.batch.assets.length === expectedAssets.length,
      phase: batchTemplate.batch?.phase || "full-pack-after-pilot",
      assetCount: batchTemplate.batch?.assets?.length || 0,
      issueCount: batchTemplate.issues.length,
    },
    pilotBatchTemplate: {
      ok: pilotBatchTemplateOk,
      phase: pilotBatchTemplate.batch?.phase || "pilot",
      assetCount: pilotBatchTemplate.batch?.assets?.length || 0,
      firstVariantId: pilotBatchTemplate.batch?.assets?.[0]?.variantId || null,
      issueCount: pilotBatchTemplate.issues.length,
    },
    candidateUrlIntakeTemplate: {
      ok: candidateUrlIntakeTemplate.ok && Boolean(candidateUrlIntakeTemplate.batch) && candidateUrlIntakeTemplate.batch.assets.length === expectedAssets.length,
      phase: candidateUrlIntakeTemplate.batch?.phase || "full-pack-after-pilot",
      assetCount: candidateUrlIntakeTemplate.batch?.assets?.length || 0,
      issueCount: candidateUrlIntakeTemplate.issues.length,
    },
    pilotCandidateUrlIntakeTemplate: {
      ok: pilotCandidateUrlIntakeTemplateOk,
      phase: pilotCandidateUrlIntakeTemplate.batch?.phase || "pilot",
      assetCount: pilotCandidateUrlIntakeTemplate.batch?.assets?.length || 0,
      firstVariantId: pilotCandidateUrlIntakeTemplate.batch?.assets?.[0]?.variantId || null,
      issueCount: pilotCandidateUrlIntakeTemplate.issues.length,
    },
    audibleReviewTemplates: {
      ok: audibleReviewTemplatesOk,
      expectedCount: expectedAssets.length,
      presentCount: audibleReviewTemplatePresentCount,
      missingCount: audibleReviewTemplateMissingCount,
      invalidCount: audibleReviewTemplateInvalidCount,
    },
    pilotGate: {
      ok: pilotGateReport.ok || publicAssets.ok,
      pilotVariantId: pilotGateReport.pilotVariantId,
      fileName: pilotGateReport.fileName,
      candidatePath: pilotGateReport.candidatePath,
      audibleReviewPath: pilotGateReport.audibleReviewPath,
      candidateStatus: pilotGateReport.candidateStatus,
      audibleReviewStatus: pilotGateReport.audibleReviewStatus,
      issueCount: pilotGateReport.issueCount,
      blocking: pilotGateBlocking,
      satisfiedByPublicAssets: publicAssets.ok,
    },
    audibleReviewApprovals: {
      ok: audibleReviewApprovalReport.ok,
      expectedCount: expectedAssets.length,
      presentCount: audibleReviewApprovalReport.presentCount,
      approvedCount: audibleReviewApprovalReport.approvedCount,
      missingCount: audibleReviewApprovalReport.missingCount,
      invalidCount: audibleReviewApprovalReport.invalidCount,
      failedCount: audibleReviewApprovalReport.failedCount,
      issueCount: audibleReviewApprovalReport.issueCount,
      blocking: audibleReviewApprovalsBlocking,
      satisfiedByPublicAssets: publicAssets.ok,
    },
    generationCredits: generationCreditsEvidence
      ? {
          ok: generationCreditsEvidence.ok === true,
          provider: generationCreditsEvidence.provider || "Picsart",
          model: generationCreditsEvidence.model || String(model || spec.modelPolicy?.allowedCurrentCandidate || ""),
          creditBalance: generationCreditsEvidence.creditBalance ?? null,
          pilotCreditCost: generationCreditsEvidence.pilotCreditCost ?? null,
          sufficientForPilot: generationCreditsEvidence.sufficientForPilot === true,
          blocking: generationCreditsBlocking,
          ...(generationCreditsEvidence.nextResetDate ? { nextResetDate: generationCreditsEvidence.nextResetDate } : {}),
        }
      : {
          ok: null,
          blocking: false,
          status: "missing",
        },
    rawQuarantineCandidates: {
      ok: rawCandidateAuditReport.ok,
      candidateCount: rawCandidateAuditReport.candidateCount,
      rejectedCount: rawCandidateAuditReport.rejectedCount,
      needsReviewCount: rawCandidateAuditReport.needsReviewCount,
      invalidCount: rawCandidateAuditReport.invalidCount,
      uncheckedCount: rawCandidateAuditReport.uncheckedCount,
      issueCount: rawCandidateAuditReport.issueCount,
      blocking: false,
    },
    acceptedCandidates: {
      ok: !acceptedCandidatesBlocking,
      expectedCount: expectedAssets.length,
      presentCount: acceptedCandidateReport.presentCount,
      missingCount: acceptedCandidateReport.missingCount,
      invalidCount: acceptedCandidateReport.invalidCount,
      failedCount: acceptedCandidateReport.failedCount,
      issueCount: acceptedCandidateReport.issueCount,
      blocking: acceptedCandidatesBlocking,
      satisfiedByPublicAssets: publicAssets.ok,
    },
    publicAssets: {
      ok: publicAssets.ok,
      expectedCount: publicAssets.expectedCount,
      passedCount: publicAssets.passedCount,
      missingCount: publicAssets.missingCount,
      failedCount: publicAssets.failedCount,
      issueCount: publicAssets.issues.length,
    },
    packageTargets: {
      ok: packageTargets.ok,
      expectedCount: packageTargets.expectedCount,
      targetCount: packageTargets.targetCount,
      issueCount: packageTargets.issues.length,
    },
    generatedManifest: {
      ok: manifestComplete,
      entryCount: manifest.entries.length,
      expectedCount: expectedAssets.length,
      issueCount: manifest.issues.length,
    },
  };

  return {
    ready: blockers.length === 0,
    generatedAt,
    expectedCount: expectedAssets.length,
    checks,
    blockers,
  };
}

function buildHyperfocusCompletionAuditReport({ rootDir = DEFAULT_ROOT, generatedAt = new Date().toISOString(), model, skipAudioProbe = false, probeAudioFile: probe = probeAudioFile } = {}) {
  const readiness = buildHyperfocusReadinessReport({ rootDir, generatedAt, model, skipAudioProbe, probeAudioFile: probe });
  const packageTargets = buildHyperfocusPackagedAssetReport({ rootDir, generatedAt });
  const checks = readiness.checks || {};
  const blockerCodes = new Set((readiness.blockers || []).map((blocker) => blocker.code));
  const packageTargetById = new Map((packageTargets.targets || []).map((target) => [target.id, target]));
  const desktopTargets = ["desktop-tauri-dist", "desktop-tauri-macos-app"].map((id) => packageTargetById.get(id)).filter(Boolean);
  const nativeTargets = ["ios-capacitor", "ios-simulator-app", "android-capacitor", "android-debug-apk"].map((id) => packageTargetById.get(id)).filter(Boolean);

  function requirement({ id, title, ok, status, evidence = {}, blockers = [] }) {
    const normalizedStatus = ok ? "pass" : status || (blockers.length > 0 ? "blocked" : "pending");
    return {
      id,
      title,
      ok: ok === true,
      status: normalizedStatus,
      evidence,
      blockers,
    };
  }

  const publicAssetsOk = checks.publicAssets?.ok === true;
  const requirements = [
    requirement({
      id: "three-level-spec",
      title: "Six Hyperfocus families with three generated levels each",
      ok: checks.spec?.ok === true,
      evidence: {
        familyCount: checks.spec?.familyCount ?? null,
        variantCount: checks.spec?.variantCount ?? null,
        providerPolicy: checks.spec?.providerPolicy || null,
      },
    }),
    requirement({
      id: "original-v1-source-coverage",
      title: "All original V1 Hyperfocus sounds are mapped into the three-level plan",
      ok: checks.originalSourceCoverage?.ok === true,
      evidence: checks.originalSourceCoverage || {},
    }),
    requirement({
      id: "gemini-only-policy",
      title: "Generation policy is restricted to Google Gemini-family audio and rejects TTS/non-Google handoff",
      ok: checks.promptPolicy?.ok === true && checks.generationQueue?.provider === "Google",
      evidence: {
        providerPolicy: checks.promptPolicy?.providerPolicy || null,
        model: checks.promptPolicy?.model || checks.generationQueue?.model || null,
        generationQueueProvider: checks.generationQueue?.provider || null,
        providerCapability: checks.providerCapability || {},
      },
    }),
    requirement({
      id: "prompt-policy",
      title: "All prompts require 30-second seamless non-musical ambience with foreground safety exclusions",
      ok: checks.promptPolicy?.ok === true,
      evidence: checks.promptPolicy || {},
    }),
    requirement({
      id: "generation-queue",
      title: "Pilot and full-pack Gemini generation queues are deterministic and phase-gated",
      ok: checks.generationQueue?.ok === true && checks.pilotGenerationQueue?.ok === true,
      evidence: {
        full: checks.generationQueue || {},
        pilot: checks.pilotGenerationQueue || {},
      },
    }),
    requirement({
      id: "promotion-handoff",
      title: "Promotion, candidate URL intake, and audible review handoff templates exist for pilot and full pack",
      ok: checks.batchTemplate?.ok === true && checks.pilotBatchTemplate?.ok === true && checks.candidateUrlIntakeTemplate?.ok === true && checks.pilotCandidateUrlIntakeTemplate?.ok === true,
      evidence: {
        batchTemplate: checks.batchTemplate || {},
        pilotBatchTemplate: checks.pilotBatchTemplate || {},
        candidateUrlIntakeTemplate: checks.candidateUrlIntakeTemplate || {},
        pilotCandidateUrlIntakeTemplate: checks.pilotCandidateUrlIntakeTemplate || {},
        audibleReviewTemplates: checks.audibleReviewTemplates || {},
      },
    }),
    requirement({
      id: "generation-credits",
      title: "Credit authorization is sufficient before spending on the Gemini/Lyria pilot",
      ok: checks.generationCredits?.ok === true || publicAssetsOk,
      status: blockerCodes.has("generation-credits-insufficient") && !publicAssetsOk ? "blocked" : "pending",
      evidence: checks.generationCredits || {},
      blockers: blockerCodes.has("generation-credits-insufficient") && !publicAssetsOk ? ["generation-credits-insufficient"] : [],
    }),
    requirement({
      id: "accepted-pilot-gate",
      title: "The fireplace:soft pilot passes objective QC and audible review before full-pack generation",
      ok: checks.pilotGate?.ok === true || publicAssetsOk,
      status: blockerCodes.has("pilot-gate-not-accepted") && !publicAssetsOk ? "blocked" : "pending",
      evidence: checks.pilotGate || {},
      blockers: blockerCodes.has("pilot-gate-not-accepted") && !publicAssetsOk ? ["pilot-gate-not-accepted"] : [],
    }),
    requirement({
      id: "accepted-candidates",
      title: "All 18 Gemini-family accepted candidates pass objective QC before promotion",
      ok: checks.acceptedCandidates?.ok === true || publicAssetsOk,
      status: "pending",
      evidence: checks.acceptedCandidates || {},
      blockers: blockerCodes.has("accepted-candidates-missing") ? ["accepted-candidates-missing"] : blockerCodes.has("accepted-candidates-invalid") ? ["accepted-candidates-invalid"] : [],
    }),
    requirement({
      id: "generated-public-assets",
      title: "All 18 generated public MP3 assets and generated manifest entries are present and QC-passing",
      ok: checks.publicAssets?.ok === true && checks.generatedManifest?.ok === true,
      status: "pending",
      evidence: {
        publicAssets: checks.publicAssets || {},
        generatedManifest: checks.generatedManifest || {},
      },
      blockers: [
        ...(blockerCodes.has("public-assets-missing") ? ["public-assets-missing"] : []),
        ...(blockerCodes.has("generated-manifest-incomplete") ? ["generated-manifest-incomplete"] : []),
      ],
    }),
    requirement({
      id: "native-generated-packaging",
      title: "Generated Hyperfocus MP3 pack is present in iOS and Android package targets after emulator-capable builds",
      ok: nativeTargets.length === 4 && nativeTargets.every((target) => target.ok === true),
      status: "pending",
      evidence: {
        targets: nativeTargets.map((target) => ({ id: target.id, presentCount: target.presentCount, missingCount: target.missingCount, ok: target.ok })),
      },
      blockers: blockerCodes.has("package-targets-missing") ? ["package-targets-missing"] : [],
    }),
    requirement({
      id: "desktop-generated-packaging",
      title: "Generated Hyperfocus MP3 pack is present in Desktop/Tauri dist and macOS app bundle targets",
      ok: desktopTargets.length === 2 && desktopTargets.every((target) => target.ok === true),
      status: "pending",
      evidence: {
        targets: desktopTargets.map((target) => ({ id: target.id, presentCount: target.presentCount, missingCount: target.missingCount, ok: target.ok })),
      },
      blockers: blockerCodes.has("package-targets-missing") ? ["package-targets-missing"] : [],
    }),
  ];

  const passedCount = requirements.filter((item) => item.status === "pass").length;
  const blockedCount = requirements.filter((item) => item.status === "blocked").length;
  const pendingCount = requirements.filter((item) => item.status === "pending").length;

  return {
    complete: requirements.every((item) => item.ok),
    generatedAt,
    model: String(model || getSpec(rootDir).modelPolicy?.allowedCurrentCandidate || ""),
    requirementCount: requirements.length,
    passedCount,
    blockedCount,
    pendingCount,
    readiness: {
      ready: readiness.ready,
      blockerCodes: Array.from(blockerCodes),
    },
    requirements,
  };
}

function writeHyperfocusCompletionAuditReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, "output/audio-qc/hyperfocus-completion-audit-current.json"), generatedAt, model, skipAudioProbe = false, probeAudioFile: probe } = {}) {
  const report = buildHyperfocusCompletionAuditReport({ rootDir, generatedAt, model, skipAudioProbe, probeAudioFile: probe });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.complete, outputFile, report };
}

function writeHyperfocusReadinessReport({ rootDir = DEFAULT_ROOT, outputFile = path.join(rootDir, "output/audio-qc/hyperfocus-readiness-current.json"), generatedAt, model, skipAudioProbe = false, probeAudioFile: probe } = {}) {
  const report = buildHyperfocusReadinessReport({ rootDir, generatedAt, model, skipAudioProbe, probeAudioFile: probe });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n");
  return { ok: report.ready, outputFile, report };
}

function resolveRootRelativePath(rootDir, value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  return path.isAbsolute(rawValue) ? rawValue : path.resolve(rootDir, rawValue);
}

function validateCandidateAudioPromotion({ rootDir = DEFAULT_ROOT, candidateFile, fileName, probeAudioFile: probe = probeAudioFile, provenance } = {}) {
  const issues = [];
  if (!candidateFile) {
    return { ok: false, issues: [issue("missing-candidate", "Candidate file path is required.", { fileName })] };
  }
  if (!fileName) {
    return { ok: false, issues: [issue("missing-file-name", "Target Hyperfocus file name is required.")] };
  }

  const asset = getExpectedHyperfocusAssets({ rootDir }).find((candidate) => candidate.fileName === fileName);
  if (!asset) {
    return {
      ok: false,
      issues: [issue("unknown-asset", "Target file name is not present in the Hyperfocus audio spec: " + fileName + ".", { fileName })],
    };
  }

  if (!fs.existsSync(candidateFile)) {
    return {
      ok: false,
      issues: [issue("missing-candidate", "Candidate file does not exist: " + candidateFile + ".", { fileName })],
    };
  }

  const stat = fs.statSync(candidateFile);
  if (!stat.isFile()) {
    return {
      ok: false,
      issues: [issue("candidate-not-file", "Candidate is not a regular file: " + candidateFile + ".", { fileName })],
    };
  }

  const sourceReuseMatches = findOriginalSourceAudioReuse({ rootDir, candidateFile });
  if (sourceReuseMatches.length > 0) {
    return {
      ok: false,
      issues: [
        issue(
          "source-audio-reuse",
          "Candidate " + fileName + " exactly matches original Hyperfocus source audio " + sourceReuseMatches.map((match) => match.currentFile).join(", ") + "; generated replacements must be remade through the approved Google/Gemini-family pipeline.",
          { fileName, matches: sourceReuseMatches },
        ),
      ],
    };
  }

  if (provenance) {
    const provenanceValidation = validateGeminiProvenancePayload({ rootDir, asset, provenance });
    if (!provenanceValidation.ok) return { ok: false, issues: [provenanceValidation.issue] };
  }

  let metrics;
  try {
    metrics = probe(candidateFile);
  } catch (error) {
    return {
      ok: false,
      issues: [issue("probe-failed", "Could not probe candidate " + candidateFile + ": " + (error instanceof Error ? error.message : String(error)), { fileName })],
    };
  }

  for (const metricIssue of evaluateHyperfocusAudioMetrics(metrics)) {
    issues.push({ ...metricIssue, fileName });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    asset,
    candidateFile,
    destinationPath: path.join(rootDir, asset.relativePath),
    provenance,
    issues: [],
  };
}

function promoteCandidateAudioAsset({ rootDir = DEFAULT_ROOT, candidateFile, fileName, probeAudioFile: probe = probeAudioFile, provenance } = {}) {
  const validation = validateCandidateAudioPromotion({ rootDir, candidateFile, fileName, probeAudioFile: probe, provenance });
  if (!validation.ok) return { ok: false, issues: validation.issues };

  fs.mkdirSync(path.dirname(validation.destinationPath), { recursive: true });
  fs.copyFileSync(validation.candidateFile, validation.destinationPath);

  if (validation.provenance) {
    const provenanceResult = writeGeneratedAudioProvenanceEntry({
      rootDir,
      asset: validation.asset,
      candidateFile: validation.candidateFile,
      destinationPath: validation.destinationPath,
      provenance: validation.provenance,
    });
    if (!provenanceResult.ok) return { ok: false, issues: [provenanceResult.issue] };
  }

  return { ok: true, destinationPath: validation.destinationPath, issues: [] };
}

function normalizePromotionBatchEntries({ rootDir = DEFAULT_ROOT, batch, batchFile } = {}) {
  let payload = batch;
  if (!payload && batchFile) payload = readJson(batchFile);
  if (!payload || typeof payload !== "object") {
    return { ok: false, entries: [], issues: [issue("missing-batch", "Batch promotion JSON is required.")] };
  }

  const rawEntries = Array.isArray(payload) ? payload : payload.assets;
  if (!Array.isArray(rawEntries)) {
    return { ok: false, entries: [], issues: [issue("invalid-batch", "Batch promotion JSON must contain an assets array.")] };
  }

  const defaults = payload.defaults && typeof payload.defaults === "object" ? payload.defaults : {};
  const phase = Array.isArray(payload) ? "full" : String(payload.phase || payload.generationPhase || "full").trim().toLowerCase();
  const pilotVariantId = Array.isArray(payload) ? PILOT_VARIANT_ID : String(payload.pilotVariantId || PILOT_VARIANT_ID);
  const issues = [];
  const entries = rawEntries.map((entry, index) => {
    const rawEntry = entry && typeof entry === "object" ? entry : {};
    const fileName = String(rawEntry.fileName || "");
    const candidateFile = resolveRootRelativePath(rootDir, rawEntry.candidateFile || rawEntry.candidatePath || rawEntry.path);
    let audibleReview = rawEntry.audibleReview;
    const audibleReviewFile = rawEntry.audibleReviewFile || rawEntry.audibleReviewPath;

    if (!audibleReview && audibleReviewFile) {
      const reviewPath = resolveRootRelativePath(rootDir, audibleReviewFile);
      try {
        audibleReview = readJson(reviewPath);
      } catch (error) {
        issues.push(issue("audible-review-read-failed", "Could not read audible review for " + (fileName || "entry " + index) + ": " + (error instanceof Error ? error.message : String(error)), { fileName }));
      }
    }

    return {
      index,
      fileName,
      candidateFile,
      provenance: {
        provider: rawEntry.provider || defaults.provider || "Google",
        model: rawEntry.model || defaults.model || "",
        generationId: rawEntry.generationId || "",
        source: rawEntry.source || defaults.source || "picsart",
        approvedBy: rawEntry.approvedBy || defaults.approvedBy || "operator-qc",
        generatedAt: rawEntry.generatedAt || defaults.generatedAt,
        audibleReview,
      },
    };
  });

  return { ok: issues.length === 0, entries, phase, pilotVariantId, issues };
}

function getExpectedAssetsForBatchPhase({ rootDir = DEFAULT_ROOT, phase = "full", pilotVariantId = PILOT_VARIANT_ID } = {}) {
  const expectedAssets = getExpectedHyperfocusAssets({ rootDir });
  const normalizedPhase = String(phase || "full").trim().toLowerCase();

  if (normalizedPhase === "pilot") {
    const selectedAssets = expectedAssets.filter((asset) => getVariantId(asset) === pilotVariantId);
    if (selectedAssets.length !== 1) {
      return {
        ok: false,
        phase: "pilot",
        expectedAssets: selectedAssets,
        issues: [issue("missing-pilot-batch-asset", "Pilot batch phase must target exactly one " + pilotVariantId + " asset.")],
      };
    }
    return { ok: true, phase: "pilot", expectedAssets: selectedAssets, issues: [] };
  }

  if (normalizedPhase === "full" || normalizedPhase === "full-pack-after-pilot") {
    return { ok: true, phase: "full-pack-after-pilot", expectedAssets, issues: [] };
  }

  return {
    ok: false,
    phase: normalizedPhase,
    expectedAssets,
    issues: [issue("invalid-batch-phase", "Batch phase must be pilot, full, or full-pack-after-pilot; got " + normalizedPhase + ".")],
  };
}

function validatePromotionBatchShape({ rootDir = DEFAULT_ROOT, entries, phase = "full", pilotVariantId = PILOT_VARIANT_ID } = {}) {
  const issues = [];
  const expectedPhase = getExpectedAssetsForBatchPhase({ rootDir, phase, pilotVariantId });
  if (!expectedPhase.ok) return { ok: false, issues: expectedPhase.issues };

  const expectedAssets = expectedPhase.expectedAssets;
  const expectedFileNames = new Set(expectedAssets.map((asset) => asset.fileName));
  const seenFileNames = new Set();

  if (entries.length !== expectedAssets.length) {
    issues.push(issue("batch-size-mismatch", "Batch promotion must contain exactly " + expectedAssets.length + " " + expectedPhase.phase + " asset(s); got " + entries.length + "."));
  }

  for (const entry of entries) {
    if (!entry.fileName) {
      issues.push(issue("missing-file-name", "Batch entry " + entry.index + " is missing fileName."));
      continue;
    }
    if (!expectedFileNames.has(entry.fileName)) {
      issues.push(issue("unknown-asset", "Batch entry fileName is not present in the Hyperfocus audio spec: " + entry.fileName + ".", { fileName: entry.fileName }));
      continue;
    }
    if (seenFileNames.has(entry.fileName)) {
      issues.push(issue("duplicate-batch-asset", "Batch entry duplicates " + entry.fileName + ".", { fileName: entry.fileName }));
      continue;
    }
    seenFileNames.add(entry.fileName);
  }

  for (const expectedFileName of expectedFileNames) {
    if (!seenFileNames.has(expectedFileName)) {
      issues.push(issue("missing-batch-asset", "Batch promotion is missing " + expectedFileName + ".", { fileName: expectedFileName }));
    }
  }

  return { ok: issues.length === 0, issues };
}

function promoteCandidateAudioBatch({ rootDir = DEFAULT_ROOT, batch, batchFile, probeAudioFile: probe = probeAudioFile } = {}) {
  const normalized = normalizePromotionBatchEntries({ rootDir, batch, batchFile });
  if (!normalized.ok) return { ok: false, promotedCount: 0, issues: normalized.issues };

  const shape = validatePromotionBatchShape({ rootDir, entries: normalized.entries, phase: normalized.phase, pilotVariantId: normalized.pilotVariantId });
  if (!shape.ok) return { ok: false, promotedCount: 0, issues: shape.issues };

  const pilotGate = validateFullPackPilotGate({ rootDir, phase: normalized.phase, probeAudioFile: probe });
  if (!pilotGate.ok) return { ok: false, promotedCount: 0, issues: pilotGate.issues };

  const validations = [];
  const issues = [];
  for (const entry of normalized.entries) {
    const validation = validateCandidateAudioPromotion({
      rootDir,
      candidateFile: entry.candidateFile,
      fileName: entry.fileName,
      probeAudioFile: probe,
      provenance: entry.provenance,
    });
    if (!validation.ok) {
      issues.push(...validation.issues);
      continue;
    }
    validations.push(validation);
  }

  if (issues.length > 0) return { ok: false, promotedCount: 0, issues };

  const destinations = [];
  for (const validation of validations) {
    fs.mkdirSync(path.dirname(validation.destinationPath), { recursive: true });
    fs.copyFileSync(validation.candidateFile, validation.destinationPath);
    const provenanceResult = writeGeneratedAudioProvenanceEntry({
      rootDir,
      asset: validation.asset,
      candidateFile: validation.candidateFile,
      destinationPath: validation.destinationPath,
      provenance: validation.provenance,
    });
    if (!provenanceResult.ok) return { ok: false, promotedCount: destinations.length, issues: [provenanceResult.issue], destinations };
    destinations.push(validation.destinationPath);
  }

  return { ok: true, promotedCount: destinations.length, destinations, issues: [] };
}

function getArgValues(args, flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(flag + " requires a value");
    }
    values.push(value);
  }
  return values;
}

function resolvePackagedAssetTargets(targetIds = []) {
  if (!Array.isArray(targetIds) || targetIds.length === 0) return PACKAGED_ASSET_TARGETS;
  const byId = new Map(PACKAGED_ASSET_TARGETS.map((target) => [target.id, target]));
  return Object.freeze(targetIds.map((targetId) => {
    const target = byId.get(targetId);
    if (!target) {
      throw new Error("Unknown Hyperfocus package target " + targetId + "; expected one of " + Array.from(byId.keys()).join(", "));
    }
    return target;
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf("--root");
  const rootDir = rootIndex >= 0 ? path.resolve(args[rootIndex + 1]) : DEFAULT_ROOT;
  const skipAudioProbe = args.includes("--skip-audio-probe");
  const printExpected = args.includes("--print-expected");
  const printGenerationQueue = args.includes("--print-generation-queue");
  const writeGenerationQueueIndex = args.indexOf("--write-generation-queue");
  const writeManifest = args.includes("--write-manifest");
  const writeAudibleReviewTemplatesIndex = args.indexOf("--write-audible-review-templates");
  const writePromotionBatchTemplateIndex = args.indexOf("--write-promotion-batch-template");
  const writeCandidateUrlIntakeTemplateIndex = args.indexOf("--write-candidate-url-intake-template");
  const downloadCandidateUrlsIndex = args.indexOf("--download-candidate-urls");
  const writeQcReportIndex = args.indexOf("--write-qc-report");
  const writePackageReportIndex = args.indexOf("--write-package-report");
  const writeCandidateReportIndex = args.indexOf("--write-candidate-report");
  const writeRawCandidateReportIndex = args.indexOf("--write-raw-candidate-report");
  const writeReadinessReportIndex = args.indexOf("--write-readiness-report");
  const writeCompletionAuditReportIndex = args.indexOf("--write-completion-audit-report");
  const writePilotGateReportIndex = args.indexOf("--write-pilot-gate-report");
  const writeGenerationCreditsReportIndex = args.indexOf("--write-generation-credits-report");
  const writeGenerationAuthorizationReportIndex = args.indexOf("--write-generation-authorization-report");
  const writeGenerationDecisionReportIndex = args.indexOf("--write-generation-decision-report");
  const writeSourceCoverageReportIndex = args.indexOf("--write-source-coverage-report");
  const writePromptPolicyReportIndex = args.indexOf("--write-prompt-policy-report");
  const writeProviderCapabilityReportIndex = args.indexOf("--write-provider-capability-report");
  const packageTargetIds = getArgValues(args, "--package-target");
  const promoteIndex = args.indexOf("--promote");
  const promoteBatchIndex = args.indexOf("--promote-batch");
  const fileNameIndex = args.indexOf("--file-name");
  const modelIndex = args.indexOf("--model");
  const phaseIndex = args.indexOf("--phase");
  const generationPhase = phaseIndex >= 0 && args[phaseIndex + 1] && !args[phaseIndex + 1].startsWith("--") ? args[phaseIndex + 1] : "full";
  const generationIdIndex = args.indexOf("--generation-id");
  const providerIndex = args.indexOf("--provider");
  const sourceIndex = args.indexOf("--source");
  const approvedByIndex = args.indexOf("--approved-by");
  const audibleReviewIndex = args.indexOf("--audible-review");
  const generatedAtIndex = args.indexOf("--generated-at");
  const qcReportOutputFile = writeQcReportIndex >= 0 && args[writeQcReportIndex + 1] && !args[writeQcReportIndex + 1].startsWith("--") ? path.resolve(args[writeQcReportIndex + 1]) : path.join(rootDir, "output/audio-qc/hyperfocus-current.json");
  const packageReportOutputFile = writePackageReportIndex >= 0 && args[writePackageReportIndex + 1] && !args[writePackageReportIndex + 1].startsWith("--") ? path.resolve(args[writePackageReportIndex + 1]) : path.join(rootDir, "output/audio-qc/hyperfocus-package-current.json");
  const candidateReportOutputFile = writeCandidateReportIndex >= 0 && args[writeCandidateReportIndex + 1] && !args[writeCandidateReportIndex + 1].startsWith("--") ? path.resolve(args[writeCandidateReportIndex + 1]) : path.join(rootDir, "output/audio-qc/hyperfocus-candidates-current.json");
  const rawCandidateReportOutputFile = writeRawCandidateReportIndex >= 0 && args[writeRawCandidateReportIndex + 1] && !args[writeRawCandidateReportIndex + 1].startsWith("--") ? path.resolve(args[writeRawCandidateReportIndex + 1]) : path.join(rootDir, "output/audio-qc/hyperfocus-raw-candidates-current.json");
  const generationQueueOutputFile = writeGenerationQueueIndex >= 0 && args[writeGenerationQueueIndex + 1] && !args[writeGenerationQueueIndex + 1].startsWith("--") ? path.resolve(args[writeGenerationQueueIndex + 1]) : null;
  const promotionBatchTemplateOutputFile = writePromotionBatchTemplateIndex >= 0 && args[writePromotionBatchTemplateIndex + 1] && !args[writePromotionBatchTemplateIndex + 1].startsWith("--") ? path.resolve(args[writePromotionBatchTemplateIndex + 1]) : path.join(rootDir, "output/audio-qc/hyperfocus-gemini-batch-template.json");
  const candidateUrlIntakeTemplateOutputFile = writeCandidateUrlIntakeTemplateIndex >= 0 && args[writeCandidateUrlIntakeTemplateIndex + 1] && !args[writeCandidateUrlIntakeTemplateIndex + 1].startsWith("--") ? path.resolve(args[writeCandidateUrlIntakeTemplateIndex + 1]) : path.join(rootDir, "output/audio-qc/hyperfocus-candidate-url-intake-template.json");
  const readinessReportOutputFile = writeReadinessReportIndex >= 0 && args[writeReadinessReportIndex + 1] && !args[writeReadinessReportIndex + 1].startsWith("--") ? path.resolve(args[writeReadinessReportIndex + 1]) : path.join(rootDir, "output/audio-qc/hyperfocus-readiness-current.json");
  const completionAuditReportOutputFile = writeCompletionAuditReportIndex >= 0 && args[writeCompletionAuditReportIndex + 1] && !args[writeCompletionAuditReportIndex + 1].startsWith("--") ? path.resolve(args[writeCompletionAuditReportIndex + 1]) : path.join(rootDir, "output/audio-qc/hyperfocus-completion-audit-current.json");
  const pilotGateReportOutputFile = writePilotGateReportIndex >= 0 && args[writePilotGateReportIndex + 1] && !args[writePilotGateReportIndex + 1].startsWith("--") ? path.resolve(args[writePilotGateReportIndex + 1]) : path.join(rootDir, "output/audio-qc/hyperfocus-pilot-gate-current.json");
  const generationCreditsReportOutputFile = writeGenerationCreditsReportIndex >= 0 && args[writeGenerationCreditsReportIndex + 1] && !args[writeGenerationCreditsReportIndex + 1].startsWith("--") ? path.resolve(args[writeGenerationCreditsReportIndex + 1]) : path.join(rootDir, GENERATION_CREDITS_PATH);
  const generationAuthorizationReportOutputFile = writeGenerationAuthorizationReportIndex >= 0 && args[writeGenerationAuthorizationReportIndex + 1] && !args[writeGenerationAuthorizationReportIndex + 1].startsWith("--") ? path.resolve(args[writeGenerationAuthorizationReportIndex + 1]) : path.join(rootDir, GENERATION_AUTHORIZATION_PATH);
  const generationDecisionReportOutputFile = writeGenerationDecisionReportIndex >= 0 && args[writeGenerationDecisionReportIndex + 1] && !args[writeGenerationDecisionReportIndex + 1].startsWith("--") ? path.resolve(args[writeGenerationDecisionReportIndex + 1]) : path.join(rootDir, GENERATION_DECISION_PATH);
  const sourceCoverageReportOutputFile = writeSourceCoverageReportIndex >= 0 && args[writeSourceCoverageReportIndex + 1] && !args[writeSourceCoverageReportIndex + 1].startsWith("--") ? path.resolve(args[writeSourceCoverageReportIndex + 1]) : path.join(rootDir, SOURCE_COVERAGE_PATH);
  const promptPolicyReportOutputFile = writePromptPolicyReportIndex >= 0 && args[writePromptPolicyReportIndex + 1] && !args[writePromptPolicyReportIndex + 1].startsWith("--") ? path.resolve(args[writePromptPolicyReportIndex + 1]) : path.join(rootDir, PROMPT_POLICY_PATH);
  const providerCapabilityReportOutputFile = writeProviderCapabilityReportIndex >= 0 && args[writeProviderCapabilityReportIndex + 1] && !args[writeProviderCapabilityReportIndex + 1].startsWith("--") ? path.resolve(args[writeProviderCapabilityReportIndex + 1]) : path.join(rootDir, PROVIDER_CAPABILITY_PATH);
  const creditBalanceIndex = args.indexOf("--credit-balance");
  const pilotCreditCostIndex = args.indexOf("--pilot-credit-cost");
  const creditCostPerJobIndex = args.indexOf("--credit-cost-per-job");
  const nextCreditResetIndex = args.indexOf("--next-credit-reset");
  const modelInventoryIndex = args.indexOf("--model-inventory");
  const promoteCandidateFile = promoteIndex >= 0 ? args[promoteIndex + 1] : "";
  const promoteFileName = fileNameIndex >= 0 ? args[fileNameIndex + 1] : "";
  const promoteProvenance = {
    provider: providerIndex >= 0 ? args[providerIndex + 1] : "Google",
    model: modelIndex >= 0 ? args[modelIndex + 1] : "",
    generationId: generationIdIndex >= 0 ? args[generationIdIndex + 1] : "",
    source: sourceIndex >= 0 ? args[sourceIndex + 1] : "picsart",
    approvedBy: approvedByIndex >= 0 ? args[approvedByIndex + 1] : "operator-qc",
    generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
  };

  if (audibleReviewIndex >= 0) {
    const audibleReviewPath = args[audibleReviewIndex + 1];
    if (!audibleReviewPath || audibleReviewPath.startsWith("--")) {
      console.error("[hyperfocus-audio-promote] FAIL - --audible-review requires a JSON file path.");
      process.exitCode = 1;
      return;
    }
    promoteProvenance.audibleReview = readJson(path.resolve(rootDir, audibleReviewPath));
  }

  if (printExpected) {
    console.log(JSON.stringify(getExpectedHyperfocusAssets({ rootDir }), null, 2));
    return;
  }

  if (writeAudibleReviewTemplatesIndex >= 0) {
    const templateOutputDir = args[writeAudibleReviewTemplatesIndex + 1] && !args[writeAudibleReviewTemplatesIndex + 1].startsWith("--")
      ? path.resolve(args[writeAudibleReviewTemplatesIndex + 1])
      : path.join(rootDir, "output/audio-qc/reviews");
    const result = writeAudibleReviewTemplates({ rootDir, outputDir: templateOutputDir });
    console.log("[hyperfocus-audible-review-templates] PASS - wrote " + result.count + " template(s) to " + path.relative(rootDir, result.outputDir) + ".");
    return;
  }

  if (writeSourceCoverageReportIndex >= 0) {
    const result = writeOriginalSourceCoverageReport({
      rootDir,
      outputFile: sourceCoverageReportOutputFile,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
    });
    const relativeOutput = path.relative(rootDir, result.outputFile);
    if (result.ok) {
      console.log("[hyperfocus-source-coverage] PASS - covered " + result.report.coveredFamilyCount + "/" + result.report.focusAssetCount + " original focus sounds in " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-source-coverage] FAIL - wrote " + relativeOutput + " with " + result.report.issueCount + " issue(s).");
    for (const foundIssue of result.report.issues) {
      console.error("- " + foundIssue.code + (foundIssue.familyId ? " " + foundIssue.familyId : "") + ": " + foundIssue.message);
    }
    process.exitCode = 1;
    return;
  }

  if (writePromptPolicyReportIndex >= 0) {
    const result = writePromptPolicyReport({
      rootDir,
      outputFile: promptPolicyReportOutputFile,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
    });
    const relativeOutput = path.relative(rootDir, result.outputFile);
    if (result.ok) {
      console.log("[hyperfocus-prompt-policy] PASS - validated " + result.report.promptCount + "/" + result.report.levelCount + " Gemini prompt(s) in " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-prompt-policy] FAIL - wrote " + relativeOutput + " with " + result.report.issueCount + " issue(s).");
    for (const foundIssue of result.report.issues) {
      console.error("- " + foundIssue.code + (foundIssue.variantId ? " " + foundIssue.variantId : "") + ": " + foundIssue.message);
    }
    process.exitCode = 1;
    return;
  }


  if (writeProviderCapabilityReportIndex >= 0) {
    const inventoryFile = modelInventoryIndex >= 0 && args[modelInventoryIndex + 1] && !args[modelInventoryIndex + 1].startsWith("--")
      ? args[modelInventoryIndex + 1]
      : undefined;
    const result = writeProviderCapabilityReport({
      rootDir,
      outputFile: providerCapabilityReportOutputFile,
      inventoryFile,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
    });
    const relativeOutput = path.relative(rootDir, result.outputFile);
    if (result.ok) {
      console.log("[hyperfocus-provider-capability] PASS - classified " + result.report.googleAudioModelCount + " Google audio model(s) in " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-provider-capability] FAIL - wrote " + relativeOutput + " with " + result.report.issueCount + " issue(s).");
    for (const foundIssue of result.report.issues) {
      console.error("- " + foundIssue.code + ": " + foundIssue.message);
    }
    process.exitCode = 1;
    return;
  }

  if (writePromotionBatchTemplateIndex >= 0) {
    const result = writePromotionBatchTemplate({ rootDir, outputFile: promotionBatchTemplateOutputFile, model: promoteProvenance.model, phase: generationPhase });
    const relativeOutput = path.relative(rootDir, result.outputFile);
    if (!result.ok) {
      console.error("[hyperfocus-promotion-batch-template] FAIL - " + result.issues.length + " issue(s).");
      for (const foundIssue of result.issues) {
        console.error("- " + foundIssue.code + ": " + foundIssue.message);
      }
      process.exitCode = 1;
      return;
    }
    console.log("[hyperfocus-promotion-batch-template] PASS - wrote " + result.batch.assets.length + " assets to " + relativeOutput + ".");
    return;
  }

  if (writeCandidateUrlIntakeTemplateIndex >= 0) {
    const result = writeCandidateUrlIntakeTemplate({ rootDir, outputFile: candidateUrlIntakeTemplateOutputFile, model: promoteProvenance.model, phase: generationPhase });
    const relativeOutput = path.relative(rootDir, result.outputFile);
    if (!result.ok) {
      console.error("[hyperfocus-candidate-url-intake-template] FAIL - " + result.issues.length + " issue(s).");
      for (const foundIssue of result.issues) {
        console.error("- " + foundIssue.code + ": " + foundIssue.message);
      }
      process.exitCode = 1;
      return;
    }
    console.log("[hyperfocus-candidate-url-intake-template] PASS - wrote " + result.batch.assets.length + " assets to " + relativeOutput + ".");
    return;
  }


  if (writeGenerationQueueIndex >= 0) {
    const result = writeGeminiGenerationQueue({
      rootDir,
      outputFile: generationQueueOutputFile || undefined,
      model: promoteProvenance.model,
      phase: generationPhase,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
    });
    const relativeOutput = path.relative(rootDir, result.outputFile);
    if (result.ok) {
      const jobLabel = result.report.jobCount === 1 ? "job" : "jobs";
      console.log("[hyperfocus-generation-queue] PASS - wrote " + result.report.jobCount + " " + result.report.phase + " " + jobLabel + " to " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-generation-queue] FAIL - wrote " + relativeOutput + " with " + result.report.issueCount + " issue(s).");
    for (const foundIssue of result.report.issues) {
      console.error("- " + foundIssue.code + ": " + foundIssue.message);
    }
    process.exitCode = 1;
    return;
  }

  if (printGenerationQueue) {
    const queue = buildGeminiGenerationQueue({ rootDir, model: promoteProvenance.model, phase: generationPhase });
    if (!queue.ok) {
      console.error("[hyperfocus-generation-queue] FAIL - " + queue.issues.length + " issue(s).");
      for (const foundIssue of queue.issues) {
        console.error("- " + foundIssue.code + ": " + foundIssue.message);
      }
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify({
      provider: queue.provider,
      model: queue.model,
      phase: queue.phase,
      requiresAcceptedPilot: queue.requiresAcceptedPilot,
      pilotVariantId: queue.pilotVariantId,
      jobs: queue.jobs,
    }, null, 2));
    return;
  }

  if (writePilotGateReportIndex >= 0) {
    const result = writePilotGateReport({ rootDir, outputFile: pilotGateReportOutputFile, skipAudioProbe });
    const relativeOutput = path.relative(rootDir, result.outputFile);
    if (result.ok) {
      console.log("[hyperfocus-pilot-gate] PASS - wrote accepted pilot evidence to " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-pilot-gate] FAIL - wrote " + relativeOutput + " with " + result.report.issueCount + " issue(s).");
    for (const foundIssue of result.report.issues) {
      console.error("- " + foundIssue.code + (foundIssue.fileName ? " " + foundIssue.fileName : "") + ": " + foundIssue.message);
    }
    process.exitCode = 1;
    return;
  }

  if (writeGenerationCreditsReportIndex >= 0) {
    const creditsResult = writeGenerationCreditsReport({
      rootDir,
      outputFile: generationCreditsReportOutputFile,
      model: promoteProvenance.model,
      creditBalance: creditBalanceIndex >= 0 ? args[creditBalanceIndex + 1] : undefined,
      pilotCreditCost: pilotCreditCostIndex >= 0 ? args[pilotCreditCostIndex + 1] : undefined,
      nextResetDate: nextCreditResetIndex >= 0 ? args[nextCreditResetIndex + 1] : undefined,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
    });
    const relativeOutput = path.relative(rootDir, creditsResult.outputFile);
    if (creditsResult.ok) {
      console.log("[hyperfocus-generation-credits] PASS - wrote sufficient credit evidence to " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-generation-credits] FAIL - wrote insufficient credit evidence to " + relativeOutput + ".");
    process.exitCode = 1;
    return;
  }

  if (writeGenerationAuthorizationReportIndex >= 0) {
    const authorizationResult = writeGenerationAuthorizationReport({
      rootDir,
      outputFile: generationAuthorizationReportOutputFile,
      model: promoteProvenance.model,
      phase: generationPhase,
      creditBalance: creditBalanceIndex >= 0 ? args[creditBalanceIndex + 1] : undefined,
      creditCostPerJob: creditCostPerJobIndex >= 0 ? args[creditCostPerJobIndex + 1] : undefined,
      pilotCreditCost: pilotCreditCostIndex >= 0 ? args[pilotCreditCostIndex + 1] : undefined,
      nextResetDate: nextCreditResetIndex >= 0 ? args[nextCreditResetIndex + 1] : undefined,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
      skipAudioProbe,
    });
    const relativeOutput = path.relative(rootDir, authorizationResult.outputFile);
    if (authorizationResult.ok) {
      console.log("[hyperfocus-generation-authorization] PASS - authorized " + authorizationResult.report.phase + " generation in " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-generation-authorization] FAIL - wrote " + relativeOutput + " with " + authorizationResult.report.blockers.length + " blocker(s).");
    for (const blocker of authorizationResult.report.blockers) {
      console.error("- " + blocker.code + ": " + blocker.message);
    }
    process.exitCode = 1;
    return;
  }


  if (writeGenerationDecisionReportIndex >= 0) {
    const decisionResult = writeGenerationDecisionReport({
      rootDir,
      outputFile: generationDecisionReportOutputFile,
      model: promoteProvenance.model,
      creditBalance: creditBalanceIndex >= 0 ? args[creditBalanceIndex + 1] : undefined,
      creditCostPerJob: creditCostPerJobIndex >= 0 ? args[creditCostPerJobIndex + 1] : undefined,
      pilotCreditCost: pilotCreditCostIndex >= 0 ? args[pilotCreditCostIndex + 1] : undefined,
      nextResetDate: nextCreditResetIndex >= 0 ? args[nextCreditResetIndex + 1] : undefined,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
      skipAudioProbe,
    });
    const relativeOutput = path.relative(rootDir, decisionResult.outputFile);
    if (decisionResult.ok) {
      console.log("[hyperfocus-generation-decision] PASS - " + decisionResult.report.nextAction + " in " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-generation-decision] WAIT - " + decisionResult.report.nextAction + " in " + relativeOutput + ".");
    console.error("- " + decisionResult.report.reason);
    process.exitCode = 1;
    return;
  }

  if (writeCompletionAuditReportIndex >= 0) {
    const auditResult = writeHyperfocusCompletionAuditReport({
      rootDir,
      outputFile: completionAuditReportOutputFile,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
      model: promoteProvenance.model,
      skipAudioProbe,
    });
    const relativeOutput = path.relative(rootDir, auditResult.outputFile);
    if (auditResult.ok) {
      console.log("[hyperfocus-completion-audit] PASS - full objective complete in " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-completion-audit] FAIL - wrote " + relativeOutput + " with " + auditResult.report.blockedCount + " blocked and " + auditResult.report.pendingCount + " pending requirement(s).");
    process.exitCode = 1;
    return;
  }

  if (writeReadinessReportIndex >= 0) {
    const readinessResult = writeHyperfocusReadinessReport({
      rootDir,
      outputFile: readinessReportOutputFile,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
      model: promoteProvenance.model,
      skipAudioProbe,
    });
    const relativeOutput = path.relative(rootDir, readinessResult.outputFile);
    if (readinessResult.ok) {
      console.log("[hyperfocus-readiness] PASS - wrote ready report to " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-readiness] FAIL - wrote " + relativeOutput + " with " + readinessResult.report.blockers.length + " blocker(s).");
    for (const blocker of readinessResult.report.blockers) {
      console.error("- " + blocker.code + ": " + blocker.message);
    }
    process.exitCode = 1;
    return;
  }

  if (writeRawCandidateReportIndex >= 0) {
    const reportResult = writeRawCandidateAuditReport({
      rootDir,
      outputFile: rawCandidateReportOutputFile,
      skipAudioProbe,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
    });
    const relativeOutput = path.relative(rootDir, reportResult.outputFile);
    if (reportResult.ok) {
      console.log("[hyperfocus-raw-candidate-report] PASS - no raw quarantine candidates found in " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-raw-candidate-report] FAIL - wrote " + relativeOutput + " with " + reportResult.report.issueCount + " issue(s).");
    process.exitCode = 1;
    return;
  }

  if (writeCandidateReportIndex >= 0) {
    const reportResult = writeAcceptedCandidateReport({
      rootDir,
      outputFile: candidateReportOutputFile,
      skipAudioProbe,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
    });
    const relativeOutput = path.relative(rootDir, reportResult.outputFile);
    if (reportResult.ok) {
      console.log("[hyperfocus-candidate-report] PASS - wrote " + reportResult.report.passedCount + "/" + reportResult.report.expectedCount + " accepted candidates to " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-candidate-report] FAIL - wrote " + relativeOutput + " with " + reportResult.report.issueCount + " issue(s).");
    process.exitCode = 1;
    return;
  }

  if (writePackageReportIndex >= 0) {
    let packageTargets;
    try {
      packageTargets = resolvePackagedAssetTargets(packageTargetIds);
    } catch (error) {
      console.error("[hyperfocus-audio-package] FAIL - " + (error instanceof Error ? error.message : String(error)) + ".");
      process.exitCode = 1;
      return;
    }
    const reportResult = writeHyperfocusPackagedAssetReport({
      rootDir,
      outputFile: packageReportOutputFile,
      targets: packageTargets,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
    });
    const relativeOutput = path.relative(rootDir, reportResult.outputFile);
    if (reportResult.ok) {
      console.log("[hyperfocus-audio-package] PASS - wrote " + reportResult.report.targetCount + " target(s) to " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-audio-package] FAIL - wrote " + relativeOutput + " with " + reportResult.report.issues.length + " issue(s).");
    process.exitCode = 1;
    return;
  }

  if (writeQcReportIndex >= 0) {
    const reportResult = writeHyperfocusAudioQcReport({
      rootDir,
      outputFile: qcReportOutputFile,
      skipAudioProbe,
      generatedAt: generatedAtIndex >= 0 ? args[generatedAtIndex + 1] : undefined,
    });
    const relativeOutput = path.relative(rootDir, reportResult.outputFile);
    if (reportResult.ok) {
      console.log("[hyperfocus-audio-report] PASS - wrote " + reportResult.report.passedCount + "/" + reportResult.report.expectedCount + " assets to " + relativeOutput + ".");
      return;
    }
    console.error("[hyperfocus-audio-report] FAIL - wrote " + relativeOutput + " with " + reportResult.report.issues.length + " issue(s).");
    process.exitCode = 1;
    return;
  }

  if (downloadCandidateUrlsIndex >= 0) {
    const batchFileArg = args[downloadCandidateUrlsIndex + 1];
    if (!batchFileArg || batchFileArg.startsWith("--")) {
      console.error("[hyperfocus-candidate-url-download] FAIL - --download-candidate-urls requires a JSON file path.");
      process.exitCode = 1;
      return;
    }

    const downloadResult = await downloadCandidateUrlBatch({
      rootDir,
      batchFile: resolveRootRelativePath(rootDir, batchFileArg),
    });

    if (!downloadResult.ok) {
      console.error("[hyperfocus-candidate-url-download] FAIL - " + downloadResult.issues.length + " issue(s).");
      for (const foundIssue of downloadResult.issues) {
        console.error("- " + foundIssue.code + (foundIssue.fileName ? " " + foundIssue.fileName : "") + ": " + foundIssue.message);
      }
      process.exitCode = 1;
      return;
    }

    console.log("[hyperfocus-candidate-url-download] PASS - downloaded " + downloadResult.downloadedCount + " accepted candidate assets.");
    return;
  }

  if (promoteBatchIndex >= 0) {
    const batchFileArg = args[promoteBatchIndex + 1];
    if (!batchFileArg || batchFileArg.startsWith("--")) {
      console.error("[hyperfocus-audio-promote-batch] FAIL - --promote-batch requires a JSON file path.");
      process.exitCode = 1;
      return;
    }

    const batchResult = promoteCandidateAudioBatch({
      rootDir,
      batchFile: resolveRootRelativePath(rootDir, batchFileArg),
    });

    if (!batchResult.ok) {
      console.error("[hyperfocus-audio-promote-batch] FAIL - " + batchResult.issues.length + " issue(s).");
      for (const foundIssue of batchResult.issues) {
        console.error("- " + foundIssue.code + (foundIssue.fileName ? " " + foundIssue.fileName : "") + ": " + foundIssue.message);
      }
      process.exitCode = 1;
      return;
    }

    console.log("[hyperfocus-audio-promote-batch] PASS - promoted " + batchResult.promotedCount + " assets.");
    if (!writeManifest) return;
  }

  if (promoteIndex >= 0) {
    const promoteResult = promoteCandidateAudioAsset({
      rootDir,
      candidateFile: promoteCandidateFile ? path.resolve(promoteCandidateFile) : promoteCandidateFile,
      fileName: promoteFileName,
      provenance: promoteProvenance,
    });

    if (!promoteResult.ok) {
      console.error("[hyperfocus-audio-promote] FAIL - " + promoteResult.issues.length + " issue(s).");
      for (const foundIssue of promoteResult.issues) {
        console.error("- " + foundIssue.code + (foundIssue.fileName ? " " + foundIssue.fileName : "") + ": " + foundIssue.message);
      }
      process.exitCode = 1;
      return;
    }

    console.log("[hyperfocus-audio-promote] PASS - promoted " + promoteFileName + " to " + path.relative(rootDir, promoteResult.destinationPath) + ".");
    if (!writeManifest) return;
  }

  if (writeManifest) {
    const manifestResult = writeGeneratedAudioManifest({ rootDir });
    if (manifestResult.ok) {
      console.log("[hyperfocus-audio-manifest] PASS - wrote " + manifestResult.entries.length + " generated entries to " + path.relative(rootDir, manifestResult.outputFile) + ".");
      return;
    }
    console.error("[hyperfocus-audio-manifest] FAIL - " + manifestResult.issues.length + " issue(s).");
    for (const foundIssue of manifestResult.issues) {
      console.error("- " + foundIssue.code + (foundIssue.fileName ? " " + foundIssue.fileName : "") + ": " + foundIssue.message);
    }
    process.exitCode = 1;
    return;
  }

  const result = validateHyperfocusAssetSet({ rootDir, skipAudioProbe });
  if (result.ok) {
    console.log("[hyperfocus-audio-qc] PASS - " + getExpectedHyperfocusAssets({ rootDir }).length + " generated assets passed.");
    return;
  }

  console.error("[hyperfocus-audio-qc] FAIL - " + result.issues.length + " issue(s).");
  for (const foundIssue of result.issues) {
    console.error("- " + foundIssue.code + (foundIssue.fileName ? " " + foundIssue.fileName : "") + ": " + foundIssue.message);
  }
  process.exitCode = 1;
}

module.exports = {
  LIMITS,
  PACKAGED_ASSET_TARGETS,
  evaluateHyperfocusAudioMetrics,
  getExpectedHyperfocusAssets,
  parseAfinfo,
  validateGeminiProvenanceForAsset,
  writeGeneratedAudioProvenanceEntry,
  promoteCandidateAudioAsset,
  promoteCandidateAudioBatch,
  buildGeminiGenerationQueue,
  buildGeminiGenerationQueueReport,
  writeGeminiGenerationQueue,
  buildPromotionBatchTemplate,
  writePromotionBatchTemplate,
  buildCandidateUrlIntakeTemplate,
  writeCandidateUrlIntakeTemplate,
  downloadCandidateUrlBatch,
  buildHyperfocusAudioQcReport,
  writeHyperfocusAudioQcReport,
  buildAcceptedCandidateReport,
  buildOriginalSourceCoverageReport,
  writeOriginalSourceCoverageReport,
  buildPromptPolicyReport,
  writePromptPolicyReport,
  buildProviderCapabilityReport,
  writeProviderCapabilityReport,
  writeAcceptedCandidateReport,
  buildRawCandidateAuditReport,
  writeRawCandidateAuditReport,
  buildAudibleReviewApprovalReport,
  buildPilotGateReport,
  writePilotGateReport,
  buildHyperfocusPackagedAssetReport,
  writeHyperfocusPackagedAssetReport,
  buildHyperfocusReadinessReport,
  writeHyperfocusReadinessReport,
  buildHyperfocusCompletionAuditReport,
  writeHyperfocusCompletionAuditReport,
  buildGenerationCreditsReport,
  writeGenerationCreditsReport,
  buildGenerationAuthorizationReport,
  writeGenerationAuthorizationReport,
  buildGenerationDecisionReport,
  writeGenerationDecisionReport,
  collectGeneratedAudioManifestEntries,
  renderGeneratedAudioManifest,
  writeGeneratedAudioManifest,
  probeAudioFile,
  validateHyperfocusAssetSet,
};

if (require.main === module) {
  main().catch((error) => {
    console.error("[hyperfocus-audio-qc] FAIL - " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
