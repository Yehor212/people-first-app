"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const SOURCE_CONFIG_RELATIVE_PATH = "config/audio/cloudlight-evening-r3-source.json";
const SOURCE_PACK_RELATIVE_ROOT = "output/private/cloudlight-evening-r3/source";
const GARAGEBAND_RELATIVE_ROOT = "output/private/cloudlight-evening-r3/garageband";
const RENDERS_RELATIVE_ROOT = "output/private/cloudlight-evening-r3/renders";
const RECEIPTS_RELATIVE_ROOT = "output/private/cloudlight-evening-r3/receipts";
const VISUAL_EVIDENCE_RELATIVE_ROOT = "output/private/cloudlight-evening-r3/evidence/garageband";
const INTERNAL_RECEIPT_WRITE_FLAG = "--cloudlight-r3-internal-receipt-write";
const RECEIPT_COORDINATION_TIMEOUT_MS = 5000;
const RECEIPT_COORDINATION_POLL_MS = 5;
const RECEIPT_COORDINATION_PREFIX = "cloudlight-r3-receipt-";
const RECEIPT_COORDINATION_FILES = Object.freeze({
  input: "input.bin",
  published: "published.json",
  decision: "decision.json",
  result: "result.json",
});
const RECEIPT_COORDINATION_SLEEP = new Int32Array(new SharedArrayBuffer(4));

const EXPECTED_SOURCE_HASHES = Object.freeze({
  config: "61839d7a72a18fe7b632396db56d2b4fb70ee087a814819a77ac83d6dde1a8ff",
  midi: "6187d20bdd9ece8b6694b96028f5621deb19597f70ed8025790da8fdeb7f8697",
  automation: "c45551d77487ce9aea7881d67a760bf83e834ab3a28a6638264b292f83398187",
  manifest: "840c6ed88666461077054aff032b9e45ccc75a14e20de89ea1996357ba763d80",
});

const EXPECTED_GARAGEBAND_VERSION = "10.4.14";
const EXPECTED_GARAGEBAND_BUILD = "6648";
const EXPECTED_ARCHITECTURE = "arm64";

const PROJECT_NAMES = Object.freeze({
  "candidate-01": "Cloudlight Evening R3 Candidate 01.band",
  "candidate-02": "Cloudlight Evening R3 Candidate 02.band",
  "candidate-03": "Cloudlight Evening R3 Candidate 03.band",
});

const RENDER_NAMES = Object.freeze({
  "candidate-01": Object.freeze(["candidate-01-linear.wav", "candidate-01-linear-rerender.wav"]),
  "candidate-02": Object.freeze(["candidate-02-linear.wav"]),
  "candidate-03": Object.freeze(["candidate-03-linear.wav"]),
});

const COMMON_VISUAL_EVIDENCE = Object.freeze([
  Object.freeze(["export-settings", "export-settings.png"]),
  Object.freeze(["project-overview-0-00", "project-overview-0-00.png"]),
  Object.freeze(["track-inventory", "track-inventory.png"]),
  Object.freeze(["instrument-identities", "instrument-identities.png"]),
  Object.freeze(["reverb-controls", "reverb-controls.png"]),
  Object.freeze(["no-audio-regions", "no-audio-regions.png"]),
  Object.freeze(["piano-2-05", "piano-2-05.png"]),
  Object.freeze(["fade-2-30-to-2-46", "fade-2-30-to-2-46.png"]),
]);

const ALLOWED_RECEIPT_NAMES = new Set([
  "candidate-01-linear-session-receipt.json",
  "candidate-01-linear-rerender-session-receipt.json",
  "candidate-02-linear-session-receipt.json",
  "candidate-03-linear-session-receipt.json",
]);

const SOURCE_PACK_INVENTORY = Object.freeze([
  "README.md",
  "automation.json",
  "cloudlight-evening-r3.mid",
  "source-manifest.json",
]);

const MODULE_REPOSITORY_REAL_ROOT = fs.realpathSync.native(path.join(__dirname, ".."));
const SYSTEM_TEMPORARY_REAL_ROOT = fs.realpathSync.native(os.tmpdir());

const canonicalSource = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", SOURCE_CONFIG_RELATIVE_PATH), "utf8")
);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const DEFAULT_GARAGEBAND_PATHS = deepFreeze({
  infoPlistPath: "/Applications/GarageBand.app/Contents/Info.plist",
  licensePath: "/Applications/GarageBand.app/Contents/Resources/GarageBand License Agreement.pdf",
  pianoInstrumentPath: canonicalSource.garageBand.pianoInstrument,
  pianoSamplesPath: canonicalSource.garageBand.pianoSamples,
  padPresetPath: canonicalSource.garageBand.padPreset,
  dronePresetPath: canonicalSource.garageBand.dronePreset,
  shimmerPresetPath: canonicalSource.garageBand.shimmerPreset,
  reverbPresetPath: canonicalSource.garageBand.reverbPreset,
});

const ENVIRONMENT_PATH_KEYS = Object.freeze([
  "infoPlistPath",
  "licensePath",
  "pianoInstrumentPath",
  "pianoSamplesPath",
  "padPresetPath",
  "dronePresetPath",
  "shimmerPresetPath",
  "reverbPresetPath",
]);

const ENVIRONMENT_FILES = Object.freeze([
  Object.freeze(["garageband-license", "licensePath"]),
  Object.freeze(["steinway-instrument", "pianoInstrumentPath"]),
  Object.freeze(["steinway-samples", "pianoSamplesPath"]),
  Object.freeze(["pad-preset", "padPresetPath"]),
  Object.freeze(["drone-preset", "dronePresetPath"]),
  Object.freeze(["shimmer-preset", "shimmerPresetPath"]),
  Object.freeze(["reverb-preset", "reverbPresetPath"]),
]);

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  throw error;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sameStringSet(actual, expected) {
  if (actual.length !== expected.length) return false;
  const left = [...actual].sort();
  const right = [...expected].sort();
  return left.every((value, index) => value === right[index]);
}

function compareUtf8Bytes(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function readFileHash(filePath, prefix, options = {}) {
  const { allowEmpty = false, captureContents = false, requireSingleLink = true } = options;
  let initial;
  try {
    initial = fs.lstatSync(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT") fail(`${prefix}_MISSING`, filePath);
    fail(`${prefix}_READ_FAILED`, filePath);
  }
  if (initial.isSymbolicLink()) fail(`${prefix}_SYMLINK`, filePath);
  if (!initial.isFile()) fail(`${prefix}_NOT_REGULAR`, filePath);
  if (!allowEmpty && initial.size === 0) fail(`${prefix}_EMPTY`, filePath);
  if (requireSingleLink && initial.nlink !== 1) fail(`${prefix}_HARDLINK`, filePath);
  if (captureContents && initial.size > 1024 * 1024) {
    fail(`${prefix}_CAPTURE_TOO_LARGE`, filePath);
  }

  let descriptor;
  try {
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch {
    fail(`${prefix}_OPEN_FAILED`, filePath);
  }

  const hash = crypto.createHash("sha256");
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  const capturedChunks = [];
  let bytesReadTotal = 0;
  try {
    const opened = fs.fstatSync(descriptor);
    if (
      !opened.isFile() ||
      opened.dev !== initial.dev ||
      opened.ino !== initial.ino ||
      (requireSingleLink && opened.nlink !== 1)
    ) {
      fail(`${prefix}_CHANGED`, filePath);
    }
    while (true) {
      const bytesRead = fs.readSync(descriptor, chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;
      hash.update(chunk.subarray(0, bytesRead));
      if (captureContents) capturedChunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
      bytesReadTotal += bytesRead;
    }
    const after = fs.fstatSync(descriptor);
    if (
      after.dev !== initial.dev ||
      after.ino !== initial.ino ||
      after.size !== initial.size ||
      after.mtimeMs !== initial.mtimeMs ||
      bytesReadTotal !== initial.size
    ) {
      fail(`${prefix}_CHANGED`, filePath);
    }
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch {
      fail(`${prefix}_CLOSE_FAILED`, filePath);
    }
  }

  const record = {
    path: filePath,
    bytes: bytesReadTotal,
    sha256: hash.digest("hex"),
  };
  if (captureContents) record.contents = Buffer.concat(capturedChunks);
  return record;
}

function readStableSmallFile(filePath, record, prefix) {
  let contents;
  try {
    contents = fs.readFileSync(filePath);
  } catch {
    fail(`${prefix}_READ_FAILED`, filePath);
  }
  const digest = crypto.createHash("sha256").update(contents).digest("hex");
  if (contents.length !== record.bytes || digest !== record.sha256) {
    fail(`${prefix}_CHANGED`, filePath);
  }
  return contents;
}

function extractXmlPlistString(contents, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = contents.match(
    new RegExp(`<key>\\s*${escapedKey}\\s*</key>\\s*<string>([^<]+)</string>`)
  );
  return match ? match[1].trim() : null;
}

function runFixedCommand(executable, args, code, input) {
  const result = spawnSync(executable, args, {
    input,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0 || typeof result.stdout !== "string") {
    fail(code, executable);
  }
  const value = result.stdout.trim();
  if (!value) fail(code, executable);
  return value;
}

function readPlistString(bytes, key) {
  if (!bytes.subarray(0, 8).toString("ascii").startsWith("bplist")) {
    const value = extractXmlPlistString(bytes.toString("utf8"), key);
    if (!value) fail("INFO_PLIST_VALUE_MISSING", key);
    return value;
  }
  return runFixedCommand(
    "/usr/bin/plutil",
    ["-extract", key, "raw", "-o", "-", "-"],
    "INFO_PLIST_PARSE_FAILED",
    bytes
  );
}

function validateFixtureSystemIdentity(paths, identity) {
  const keys = ["architecture", "macOSVersion", "macOSBuild"];
  if (!isPlainObject(identity) || !sameStringSet(Object.keys(identity), keys)) {
    fail("FIXTURE_SYSTEM_IDENTITY_INVALID", "identity keys");
  }
  for (const key of keys) {
    if (typeof identity[key] !== "string" || !identity[key].trim()) {
      fail("FIXTURE_SYSTEM_IDENTITY_INVALID", key);
    }
  }
  let realTemporaryRoot;
  try {
    realTemporaryRoot = fs.realpathSync.native(os.tmpdir());
  } catch {
    fail("FIXTURE_SYSTEM_IDENTITY_NOT_ALLOWED", paths.infoPlistPath);
  }
  for (const key of ENVIRONMENT_PATH_KEYS) {
    let realResourcePath;
    try {
      realResourcePath = fs.realpathSync.native(paths[key]);
    } catch {
      fail("FIXTURE_SYSTEM_IDENTITY_NOT_ALLOWED", paths[key]);
    }
    if (!isStrictDescendant(realTemporaryRoot, realResourcePath)) {
      fail("FIXTURE_SYSTEM_IDENTITY_NOT_ALLOWED", paths[key]);
    }
  }
  return {
    architecture: identity.architecture,
    macOSVersion: identity.macOSVersion,
    macOSBuild: identity.macOSBuild,
    identitySource: "UNIT_TEST_FIXTURE",
  };
}

function inspectSystemIdentity(paths) {
  if (Object.prototype.hasOwnProperty.call(paths, "systemIdentity")) {
    return validateFixtureSystemIdentity(paths, paths.systemIdentity);
  }
  return {
    architecture: process.arch,
    macOSVersion: runFixedCommand("/usr/bin/sw_vers", ["-productVersion"], "MACOS_VERSION_FAILED"),
    macOSBuild: runFixedCommand("/usr/bin/sw_vers", ["-buildVersion"], "MACOS_BUILD_FAILED"),
    identitySource: "LOCAL_SYSTEM",
  };
}

function inspectGarageBandEnvironment(paths) {
  if (!isPlainObject(paths)) fail("ENVIRONMENT_PATHS_INVALID", "paths must be an object");
  const allowedKeys = [...ENVIRONMENT_PATH_KEYS, "systemIdentity"];
  if (!Object.keys(paths).every((key) => allowedKeys.includes(key))) {
    fail("ENVIRONMENT_PATHS_INVALID", "unexpected key");
  }
  for (const key of ENVIRONMENT_PATH_KEYS) {
    if (typeof paths[key] !== "string" || !path.isAbsolute(paths[key])) {
      fail("ENVIRONMENT_PATHS_INVALID", key);
    }
  }

  const usesFixtureIdentity = Object.prototype.hasOwnProperty.call(paths, "systemIdentity");
  if (
    !usesFixtureIdentity &&
    ENVIRONMENT_PATH_KEYS.some((key) => paths[key] !== DEFAULT_GARAGEBAND_PATHS[key])
  ) {
    fail("ENVIRONMENT_PATHS_NOT_CANONICAL", "live inspection requires canonical paths");
  }

  const infoPlistInspection = readFileHash(paths.infoPlistPath, "ENVIRONMENT_FILE", {
    captureContents: true,
  });
  const { contents: infoPlistBytes, ...infoPlistRecord } = infoPlistInspection;
  const garageBandVersion = readPlistString(infoPlistBytes, "CFBundleShortVersionString");
  const garageBandBuild = readPlistString(infoPlistBytes, "CFBundleVersion");
  const files = ENVIRONMENT_FILES.map(([role, key]) => ({
    role,
    ...readFileHash(paths[key], "ENVIRONMENT_FILE"),
  }));
  const systemIdentity = inspectSystemIdentity(paths);

  if (garageBandVersion !== EXPECTED_GARAGEBAND_VERSION) {
    fail("GARAGEBAND_VERSION_MISMATCH", garageBandVersion);
  }
  if (garageBandBuild !== EXPECTED_GARAGEBAND_BUILD) {
    fail("GARAGEBAND_BUILD_MISMATCH", garageBandBuild);
  }
  if (systemIdentity.architecture !== EXPECTED_ARCHITECTURE) {
    fail("ARCHITECTURE_MISMATCH", systemIdentity.architecture);
  }

  return {
    garageBandVersion,
    garageBandBuild,
    architecture: systemIdentity.architecture,
    macOSVersion: systemIdentity.macOSVersion,
    macOSBuild: systemIdentity.macOSBuild,
    identitySource: systemIdentity.identitySource,
    infoPlist: infoPlistRecord,
    files,
  };
}

function inspectRoot(rootDir) {
  if (typeof rootDir !== "string" || !rootDir.trim()) fail("ROOT_INVALID", "rootDir");
  const resolvedRoot = path.resolve(rootDir);
  let stats;
  try {
    stats = fs.lstatSync(resolvedRoot);
  } catch (error) {
    if (error && error.code === "ENOENT") fail("ROOT_MISSING", resolvedRoot);
    fail("ROOT_READ_FAILED", resolvedRoot);
  }
  if (stats.isSymbolicLink()) fail("ROOT_SYMLINK", resolvedRoot);
  if (!stats.isDirectory()) fail("ROOT_NOT_DIRECTORY", resolvedRoot);
  return {
    resolvedRoot,
    realRoot: fs.realpathSync.native(resolvedRoot),
  };
}

function isStrictDescendant(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return Boolean(
    relative &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function assertDirectoryChain(root, directoryPath, prefix = "PRIVATE_ANCESTOR") {
  const resolvedDirectory = path.resolve(directoryPath);
  if (
    resolvedDirectory !== root.resolvedRoot &&
    !isStrictDescendant(root.resolvedRoot, resolvedDirectory)
  ) {
    fail(`${prefix}_PATH_ESCAPE`, resolvedDirectory);
  }
  const relative = path.relative(root.resolvedRoot, resolvedDirectory);
  let current = root.resolvedRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let stats;
    try {
      stats = fs.lstatSync(current);
    } catch (error) {
      if (error && error.code === "ENOENT") fail(`${prefix}_MISSING`, current);
      fail(`${prefix}_READ_FAILED`, current);
    }
    if (stats.isSymbolicLink()) fail(`${prefix}_SYMLINK`, current);
    if (!stats.isDirectory()) fail(`${prefix}_NOT_DIRECTORY`, current);
  }
  const realDirectory = fs.realpathSync.native(resolvedDirectory);
  if (realDirectory !== root.realRoot && !isStrictDescendant(root.realRoot, realDirectory)) {
    fail(`${prefix}_PATH_ESCAPE`, resolvedDirectory);
  }
  return { resolvedDirectory, realDirectory };
}

function toRootRelative(root, absolutePath) {
  return path.relative(root.resolvedRoot, absolutePath).split(path.sep).join("/");
}

function parseJsonRecord(filePath, record, prefix) {
  const contents = readStableSmallFile(filePath, record, prefix);
  try {
    return JSON.parse(contents.toString("utf8"));
  } catch {
    fail(`${prefix}_INVALID_JSON`, filePath);
  }
}

function inspectSourcePack(root) {
  const sourceDirectory = path.join(root.resolvedRoot, SOURCE_PACK_RELATIVE_ROOT);
  assertDirectoryChain(root, sourceDirectory);

  const inventory = fs.readdirSync(sourceDirectory, { withFileTypes: true });
  const inventoryNames = inventory.map((entry) => entry.name);
  if (SOURCE_PACK_INVENTORY.some((name) => !inventoryNames.includes(name))) {
    fail("SOURCE_FILE_MISSING", sourceDirectory);
  }
  if (!sameStringSet(inventoryNames, SOURCE_PACK_INVENTORY)) {
    fail("SOURCE_INVENTORY_MISMATCH", sourceDirectory);
  }
  for (const entry of inventory) {
    const stats = fs.lstatSync(path.join(sourceDirectory, entry.name));
    if (stats.isSymbolicLink() || !stats.isFile() || stats.nlink !== 1 || stats.size === 0) {
      fail("SOURCE_INVENTORY_UNSAFE", path.join(sourceDirectory, entry.name));
    }
  }

  const configPath = path.join(root.resolvedRoot, SOURCE_CONFIG_RELATIVE_PATH);
  assertDirectoryChain(root, path.dirname(configPath), "SOURCE_ANCESTOR");
  const configRecord = readFileHash(configPath, "SOURCE_FILE");

  const manifestPath = path.join(sourceDirectory, "source-manifest.json");
  const manifestRecord = readFileHash(manifestPath, "SOURCE_FILE");
  const manifest = parseJsonRecord(manifestPath, manifestRecord, "SOURCE_MANIFEST");
  const requiredManifestHashes = ["sourceConfigSha256", "midiSha256", "automationSha256"];
  if (
    !isPlainObject(manifest) ||
    requiredManifestHashes.some(
      (key) => typeof manifest[key] !== "string" || !/^[a-f0-9]{64}$/.test(manifest[key])
    )
  ) {
    fail("SOURCE_MANIFEST_MISSING_HASH", manifestPath);
  }

  const midiPath = path.join(sourceDirectory, "cloudlight-evening-r3.mid");
  const automationPath = path.join(sourceDirectory, "automation.json");
  const readmePath = path.join(sourceDirectory, "README.md");
  const midiRecord = readFileHash(midiPath, "SOURCE_FILE");
  const automationRecord = readFileHash(automationPath, "SOURCE_FILE");
  const readmeRecord = readFileHash(readmePath, "SOURCE_FILE");

  if (
    configRecord.sha256 !== manifest.sourceConfigSha256 ||
    midiRecord.sha256 !== manifest.midiSha256 ||
    automationRecord.sha256 !== manifest.automationSha256 ||
    configRecord.sha256 !== EXPECTED_SOURCE_HASHES.config ||
    midiRecord.sha256 !== EXPECTED_SOURCE_HASHES.midi ||
    automationRecord.sha256 !== EXPECTED_SOURCE_HASHES.automation
  ) {
    fail("SOURCE_FILE_HASH_MISMATCH", sourceDirectory);
  }
  if (manifestRecord.sha256 !== EXPECTED_SOURCE_HASHES.manifest) {
    fail("SOURCE_MANIFEST_HASH_MISMATCH", manifestPath);
  }
  if (
    manifest.sourceId !== "cloudlight-evening-r3" ||
    manifest.sourceConfigPath !== SOURCE_CONFIG_RELATIVE_PATH ||
    manifest.sourceConfigBytes !== configRecord.bytes ||
    manifest.midiBytes !== midiRecord.bytes ||
    manifest.automationBytes !== automationRecord.bytes ||
    manifest.appleLoopsUsed !== false ||
    !Array.isArray(manifest.sourceAudioInputs) ||
    manifest.sourceAudioInputs.length !== 0
  ) {
    fail("SOURCE_MANIFEST_CONTRACT_MISMATCH", manifestPath);
  }

  const source = parseJsonRecord(configPath, configRecord, "SOURCE_CONFIG");
  if (
    !isPlainObject(source) ||
    source.id !== "cloudlight-evening-r3" ||
    source.appleLoopsUsed !== false ||
    !Array.isArray(source.sourceAudioInputs) ||
    source.sourceAudioInputs.length !== 0 ||
    !Array.isArray(source.candidates)
  ) {
    fail("SOURCE_CONFIG_CONTRACT_MISMATCH", configPath);
  }

  function sourceReceipt(record) {
    return {
      path: toRootRelative(root, record.path),
      bytes: record.bytes,
      sha256: record.sha256,
    };
  }

  return {
    source,
    receipt: {
      config: sourceReceipt(configRecord),
      midi: sourceReceipt(midiRecord),
      automation: sourceReceipt(automationRecord),
      manifest: sourceReceipt(manifestRecord),
      readme: sourceReceipt(readmeRecord),
    },
  };
}

function inspectProject(root, projectPath, candidateId) {
  const garageBandDirectory = path.join(root.resolvedRoot, GARAGEBAND_RELATIVE_ROOT);
  const { realDirectory: realGarageBandDirectory } = assertDirectoryChain(
    root,
    garageBandDirectory
  );
  const resolvedProject = path.resolve(projectPath);
  if (!isStrictDescendant(garageBandDirectory, resolvedProject)) {
    fail("PROJECT_PATH_ESCAPE", resolvedProject);
  }
  const expectedProjectName = PROJECT_NAMES[candidateId];
  if (
    path.basename(resolvedProject) !== expectedProjectName ||
    path.extname(resolvedProject) !== ".band"
  ) {
    fail("PROJECT_NAME_MISMATCH", resolvedProject);
  }
  if (resolvedProject !== path.join(garageBandDirectory, expectedProjectName)) {
    fail("PROJECT_PATH_NOT_DIRECT", resolvedProject);
  }

  let projectStats;
  try {
    projectStats = fs.lstatSync(resolvedProject);
  } catch (error) {
    if (error && error.code === "ENOENT") fail("PROJECT_MISSING", resolvedProject);
    fail("PROJECT_READ_FAILED", resolvedProject);
  }
  if (projectStats.isSymbolicLink()) fail("PROJECT_SYMLINK", resolvedProject);
  if (!projectStats.isDirectory()) fail("PROJECT_NOT_DIRECTORY", resolvedProject);
  const realProject = fs.realpathSync.native(resolvedProject);
  if (!isStrictDescendant(realGarageBandDirectory, realProject)) {
    fail("PROJECT_PATH_ESCAPE", resolvedProject);
  }

  const audioFilesPath = path.join(resolvedProject, "Media", "Audio Files");
  if (fs.existsSync(audioFilesPath)) {
    const audioStats = fs.lstatSync(audioFilesPath);
    if (audioStats.isSymbolicLink()) fail("PROJECT_ENTRY_SYMLINK", audioFilesPath);
    if (!audioStats.isDirectory()) fail("PROJECT_AUDIO_FILES_INVALID", audioFilesPath);
    if (fs.readdirSync(audioFilesPath).length > 0) {
      fail("PROJECT_AUDIO_FILES_POPULATED", audioFilesPath);
    }
  }

  const inventory = [];
  let totalBytes = 0;

  function visit(directoryPath, relativeDirectory) {
    const names = fs.readdirSync(directoryPath).sort(compareUtf8Bytes);
    for (const name of names) {
      const absoluteEntry = path.join(directoryPath, name);
      const relativeEntry = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      const stats = fs.lstatSync(absoluteEntry);
      if (stats.isSymbolicLink()) fail("PROJECT_ENTRY_SYMLINK", absoluteEntry);
      const realEntry = fs.realpathSync.native(absoluteEntry);
      if (!isStrictDescendant(realProject, realEntry)) fail("PROJECT_PATH_ESCAPE", absoluteEntry);
      if (stats.isDirectory()) {
        inventory.push({ path: relativeEntry, type: "directory" });
        visit(absoluteEntry, relativeEntry);
      } else if (stats.isFile()) {
        const record = readFileHash(absoluteEntry, "PROJECT_FILE");
        inventory.push({
          path: relativeEntry,
          type: "file",
          bytes: record.bytes,
          sha256: record.sha256,
        });
        totalBytes += record.bytes;
      } else {
        fail("PROJECT_ENTRY_NOT_REGULAR", absoluteEntry);
      }
    }
  }

  visit(resolvedProject, "");
  inventory.sort((left, right) => compareUtf8Bytes(left.path, right.path));
  if (totalBytes === 0) fail("PROJECT_EMPTY", resolvedProject);
  const treeBytes = Buffer.from(`${JSON.stringify(inventory)}\n`);
  return {
    path: toRootRelative(root, resolvedProject),
    treeSha256: crypto.createHash("sha256").update(treeBytes).digest("hex"),
    bytes: totalBytes,
    inventory,
  };
}

function inspectRenders(root, renderPaths, candidateId) {
  if (!Array.isArray(renderPaths) || renderPaths.length !== 1) {
    fail("RENDER_COUNT_INVALID", "exactly one render path is required");
  }
  if (
    !Object.prototype.hasOwnProperty.call(renderPaths, 0) ||
    typeof renderPaths[0] !== "string" ||
    !renderPaths[0].trim() ||
    !path.isAbsolute(renderPaths[0])
  ) {
    fail("RENDER_PATH_INVALID", "renderPaths[0]");
  }
  const allowedNames = RENDER_NAMES[candidateId];
  const rendersDirectory = path.join(root.resolvedRoot, RENDERS_RELATIVE_ROOT);
  const { realDirectory: realRendersDirectory } = assertDirectoryChain(root, rendersDirectory);
  const resolvedPaths = renderPaths.map((filePath) => path.resolve(filePath));
  if (new Set(resolvedPaths).size !== resolvedPaths.length) {
    fail("RENDER_DUPLICATE", "duplicate render path");
  }

  const names = resolvedPaths.map((filePath) => path.basename(filePath));
  if (new Set(names).size !== names.length) fail("RENDER_DUPLICATE", "duplicate render name");
  if (names.some((name) => !allowedNames.includes(name))) {
    fail("RENDER_NAME_MISMATCH", names.join(","));
  }
  const records = resolvedPaths.map((resolvedPath) => {
    if (!isStrictDescendant(rendersDirectory, resolvedPath)) {
      fail("RENDER_PATH_ESCAPE", resolvedPath);
    }
    if (resolvedPath !== path.join(rendersDirectory, path.basename(resolvedPath))) {
      fail("RENDER_PATH_NOT_DIRECT", resolvedPath);
    }
    const record = readFileHash(resolvedPath, "RENDER");
    const realRender = fs.realpathSync.native(resolvedPath);
    if (!isStrictDescendant(realRendersDirectory, realRender)) {
      fail("RENDER_PATH_ESCAPE", resolvedPath);
    }
    return {
      path: toRootRelative(root, resolvedPath),
      bytes: record.bytes,
      sha256: record.sha256,
    };
  });

  return records.sort(
    (left, right) =>
      allowedNames.indexOf(path.basename(left.path)) -
      allowedNames.indexOf(path.basename(right.path))
  );
}

function requiredVisualEvidence(candidateId) {
  return [
    ...COMMON_VISUAL_EVIDENCE,
    Object.freeze(["candidate-mixer", `${candidateId}-mixer.png`]),
  ];
}

function inspectVisualEvidence(root, visualEvidencePaths, candidateId) {
  const requiredEvidence = requiredVisualEvidence(candidateId);
  if (
    !Array.isArray(visualEvidencePaths) ||
    visualEvidencePaths.length !== requiredEvidence.length
  ) {
    fail(
      "VISUAL_EVIDENCE_COUNT_INVALID",
      `exactly ${requiredEvidence.length} evidence paths are required`
    );
  }
  for (let index = 0; index < visualEvidencePaths.length; index += 1) {
    if (
      !Object.prototype.hasOwnProperty.call(visualEvidencePaths, index) ||
      typeof visualEvidencePaths[index] !== "string" ||
      !visualEvidencePaths[index].trim() ||
      !path.isAbsolute(visualEvidencePaths[index])
    ) {
      fail("VISUAL_EVIDENCE_PATH_INVALID", `visualEvidencePaths[${index}]`);
    }
  }

  const evidenceDirectory = path.join(root.resolvedRoot, VISUAL_EVIDENCE_RELATIVE_ROOT);
  const { realDirectory: realEvidenceDirectory } = assertDirectoryChain(
    root,
    evidenceDirectory,
    "VISUAL_EVIDENCE_ANCESTOR"
  );
  const requiredNames = requiredEvidence.map(([, name]) => name);
  const recordsByName = new Map();
  for (const filePath of visualEvidencePaths) {
    const resolvedPath = path.resolve(filePath);
    if (!isStrictDescendant(evidenceDirectory, resolvedPath)) {
      fail("VISUAL_EVIDENCE_PATH_ESCAPE", resolvedPath);
    }
    const evidenceName = path.basename(resolvedPath);
    if (!requiredNames.includes(evidenceName)) {
      fail("VISUAL_EVIDENCE_NAME_MISMATCH", evidenceName);
    }
    if (resolvedPath !== path.join(evidenceDirectory, evidenceName)) {
      fail("VISUAL_EVIDENCE_PATH_NOT_DIRECT", resolvedPath);
    }
    if (recordsByName.has(evidenceName)) {
      fail("VISUAL_EVIDENCE_DUPLICATE", evidenceName);
    }
    const record = readFileHash(resolvedPath, "VISUAL_EVIDENCE");
    const realEvidencePath = fs.realpathSync.native(resolvedPath);
    if (!isStrictDescendant(realEvidenceDirectory, realEvidencePath)) {
      fail("VISUAL_EVIDENCE_PATH_ESCAPE", resolvedPath);
    }
    recordsByName.set(evidenceName, record);
  }

  if (!sameStringSet([...recordsByName.keys()], requiredNames)) {
    fail("VISUAL_EVIDENCE_NAME_MISMATCH", evidenceDirectory);
  }
  return requiredEvidence.map(([role, name]) => {
    const record = recordsByName.get(name);
    return {
      role,
      path: toRootRelative(root, record.path),
      bytes: record.bytes,
      sha256: record.sha256,
    };
  });
}

function directoryIdentity(directoryPath) {
  const stats = fs.lstatSync(directoryPath);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    fail("RECEIPT_DIRECTORY_UNSAFE", directoryPath);
  }
  return { dev: stats.dev, ino: stats.ino };
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function receiptWriteError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function receiptWriteErrorCode(error, fallback) {
  return error && typeof error.code === "string" && error.code.startsWith("RECEIPT_")
    ? error.code
    : fallback;
}

function relativeLeafExists(leafName) {
  try {
    fs.lstatSync(leafName);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

function receiptAnchorPathMatches(expectedDev, expectedIno, anchorPath) {
  try {
    const stats = fs.lstatSync(anchorPath);
    return (
      stats.isDirectory() &&
      !stats.isSymbolicLink() &&
      String(stats.dev) === expectedDev &&
      String(stats.ino) === expectedIno
    );
  } catch {
    return false;
  }
}

function assertReceiptCoordinationDirectory(directoryPath) {
  if (typeof directoryPath !== "string" || !path.isAbsolute(directoryPath)) {
    throw receiptWriteError("RECEIPT_COORDINATION_DIRECTORY_INVALID");
  }
  let stats;
  let realDirectory;
  try {
    stats = fs.lstatSync(directoryPath);
    realDirectory = fs.realpathSync.native(directoryPath);
  } catch {
    throw receiptWriteError("RECEIPT_COORDINATION_DIRECTORY_INVALID");
  }
  const currentUid = typeof process.getuid === "function" ? process.getuid() : null;
  if (
    stats.isSymbolicLink() ||
    !stats.isDirectory() ||
    currentUid === null ||
    stats.uid !== currentUid ||
    (stats.mode & 0o777) !== 0o700 ||
    !isStrictDescendant(SYSTEM_TEMPORARY_REAL_ROOT, realDirectory)
  ) {
    throw receiptWriteError("RECEIPT_COORDINATION_DIRECTORY_INVALID");
  }
  return realDirectory;
}

function coordinationFilePath(directoryPath, fileName) {
  if (!Object.values(RECEIPT_COORDINATION_FILES).includes(fileName)) {
    throw receiptWriteError("RECEIPT_COORDINATION_FILE_INVALID");
  }
  return path.join(directoryPath, fileName);
}

function writePrivateCoordinationFile(directoryPath, fileName, contents) {
  assertReceiptCoordinationDirectory(directoryPath);
  const targetPath = coordinationFilePath(directoryPath, fileName);
  const stagePath = path.join(
    directoryPath,
    `.${fileName}.${process.pid}-${crypto.randomBytes(12).toString("hex")}.stage`
  );
  let descriptor = null;
  let stageExists = false;
  try {
    try {
      fs.lstatSync(targetPath);
      throw receiptWriteError("RECEIPT_COORDINATION_FILE_EXISTS");
    } catch (error) {
      if (!error || error.code !== "ENOENT") throw error;
    }
    descriptor = fs.openSync(
      stagePath,
      fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        fs.constants.O_WRONLY |
        (fs.constants.O_NOFOLLOW ?? 0),
      0o600
    );
    stageExists = true;
    fs.writeFileSync(descriptor, contents);
    fs.fsyncSync(descriptor);
    const stageStats = fs.fstatSync(descriptor);
    const currentUid = typeof process.getuid === "function" ? process.getuid() : null;
    if (
      !stageStats.isFile() ||
      stageStats.nlink !== 1 ||
      currentUid === null ||
      stageStats.uid !== currentUid ||
      (stageStats.mode & 0o777) !== 0o600
    ) {
      throw receiptWriteError("RECEIPT_COORDINATION_FILE_INVALID");
    }
    fs.closeSync(descriptor);
    descriptor = null;
    fs.linkSync(stagePath, targetPath);
    fs.unlinkSync(stagePath);
    stageExists = false;
  } catch (error) {
    if (error && typeof error.code === "string" && error.code.startsWith("RECEIPT_")) {
      throw error;
    }
    throw receiptWriteError("RECEIPT_COORDINATION_WRITE_FAILED");
  } finally {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // The named write failure below remains fail-closed.
      }
    }
    if (stageExists) {
      try {
        fs.unlinkSync(stagePath);
      } catch {
        // The private coordination directory is removed by the parent cleanup path.
      }
    }
  }
}

function readPrivateCoordinationFile(directoryPath, fileName, { required = false } = {}) {
  assertReceiptCoordinationDirectory(directoryPath);
  const filePath = coordinationFilePath(directoryPath, fileName);
  let initial;
  try {
    initial = fs.lstatSync(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT" && !required) return null;
    throw receiptWriteError("RECEIPT_COORDINATION_READ_FAILED");
  }
  const currentUid = typeof process.getuid === "function" ? process.getuid() : null;
  if (
    initial.isSymbolicLink() ||
    !initial.isFile() ||
    initial.nlink !== 1 ||
    initial.size <= 0 ||
    initial.size > 1024 * 1024 ||
    currentUid === null ||
    initial.uid !== currentUid ||
    (initial.mode & 0o777) !== 0o600
  ) {
    throw receiptWriteError("RECEIPT_COORDINATION_FILE_INVALID");
  }
  let descriptor = null;
  try {
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(descriptor);
    if (
      !opened.isFile() ||
      opened.dev !== initial.dev ||
      opened.ino !== initial.ino ||
      opened.size !== initial.size ||
      opened.nlink !== 1
    ) {
      throw receiptWriteError("RECEIPT_COORDINATION_FILE_CHANGED");
    }
    const contents = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor);
    if (
      after.dev !== initial.dev ||
      after.ino !== initial.ino ||
      after.size !== initial.size ||
      contents.length !== initial.size
    ) {
      throw receiptWriteError("RECEIPT_COORDINATION_FILE_CHANGED");
    }
    return contents;
  } catch (error) {
    if (error && typeof error.code === "string" && error.code.startsWith("RECEIPT_")) {
      throw error;
    }
    throw receiptWriteError("RECEIPT_COORDINATION_READ_FAILED");
  } finally {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch {
        throw receiptWriteError("RECEIPT_COORDINATION_CLOSE_FAILED");
      }
    }
  }
}

function writeCoordinationJson(directoryPath, fileName, value) {
  writePrivateCoordinationFile(
    directoryPath,
    fileName,
    Buffer.from(`${JSON.stringify(value)}\n`, "utf8")
  );
}

function readCoordinationJson(directoryPath, fileName, options) {
  const contents = readPrivateCoordinationFile(directoryPath, fileName, options);
  if (contents === null) return null;
  try {
    const value = JSON.parse(contents.toString("utf8"));
    if (!isPlainObject(value)) throw new Error("not an object");
    return value;
  } catch {
    throw receiptWriteError("RECEIPT_COORDINATION_JSON_INVALID");
  }
}

function waitForCoordinationRecord(directoryPath, fileNames, deadline) {
  while (Date.now() <= deadline) {
    for (const fileName of fileNames) {
      const value = readCoordinationJson(directoryPath, fileName);
      if (value !== null) return { fileName, value };
    }
    Atomics.wait(RECEIPT_COORDINATION_SLEEP, 0, 0, RECEIPT_COORDINATION_POLL_MS);
  }
  return null;
}

function cleanupReceiptCoordinationDirectory(directoryPath) {
  try {
    assertReceiptCoordinationDirectory(directoryPath);
    for (const entryName of fs.readdirSync(directoryPath)) {
      const entryPath = path.join(directoryPath, entryName);
      const stats = fs.lstatSync(entryPath);
      if (stats.isDirectory()) throw new Error("nested directory");
      fs.unlinkSync(entryPath);
    }
    fs.rmdirSync(directoryPath);
  } catch {
    throw receiptWriteError("RECEIPT_COORDINATION_CLEANUP_FAILED");
  }
}

function writeAnchoredReceiptChild({
  targetName,
  expectedDev,
  expectedIno,
  anchorPath,
  fault,
  contentsOverride,
  afterPublish,
}) {
  let descriptor = null;
  let stageName = null;
  let targetCreated = false;
  let primaryError = null;
  let cleanupError = null;
  try {
    if (
      !ALLOWED_RECEIPT_NAMES.has(targetName) ||
      path.basename(targetName) !== targetName ||
      !path.isAbsolute(anchorPath) ||
      !/^\d+$/.test(expectedDev) ||
      !/^\d+$/.test(expectedIno) ||
      !["", "write", "close", "cleanup", "handshake"].includes(fault)
    ) {
      throw receiptWriteError("RECEIPT_WRITE_INVALID_TARGET");
    }
    const anchor = fs.statSync(".");
    if (
      !anchor.isDirectory() ||
      String(anchor.dev) !== expectedDev ||
      String(anchor.ino) !== expectedIno
    ) {
      throw receiptWriteError("RECEIPT_WRITE_ANCHOR_MISMATCH");
    }
    if (relativeLeafExists(targetName)) {
      throw receiptWriteError("RECEIPT_LEAF_UNSAFE");
    }
    if (fault === "handshake") {
      process.stdout.write(`${JSON.stringify({ ok: true, status: "READY" })}\n`);
    }
    const contents = Buffer.isBuffer(contentsOverride) ? contentsOverride : fs.readFileSync(0);
    if (contents.length === 0 || contents.length > 1024 * 1024) {
      throw receiptWriteError("RECEIPT_WRITE_CONTENTS_INVALID");
    }
    stageName = `.${targetName}.${process.pid}-${crypto.randomBytes(12).toString("hex")}.stage`;
    descriptor = fs.openSync(
      stageName,
      fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        fs.constants.O_WRONLY |
        (fs.constants.O_NOFOLLOW ?? 0),
      0o600
    );
    const stageStats = fs.fstatSync(descriptor);
    if (!stageStats.isFile() || stageStats.nlink !== 1) {
      throw receiptWriteError("RECEIPT_WRITE_STAGE_UNSAFE");
    }
    if (fault === "write" || fault === "cleanup") {
      throw receiptWriteError("RECEIPT_WRITE_FAILED");
    }
    fs.writeFileSync(descriptor, contents);
    fs.fsyncSync(descriptor);
    if (fault === "close") throw receiptWriteError("RECEIPT_WRITE_CLOSE_FAILED");
    fs.closeSync(descriptor);
    descriptor = null;
    if (relativeLeafExists(targetName)) {
      throw receiptWriteError("RECEIPT_LEAF_UNSAFE");
    }
    try {
      fs.linkSync(stageName, targetName);
      targetCreated = true;
    } catch (error) {
      if (error && error.code === "EEXIST") {
        throw receiptWriteError("RECEIPT_LEAF_UNSAFE");
      }
      throw receiptWriteError("RECEIPT_WRITE_LINK_FAILED");
    }
    fs.unlinkSync(stageName);
    stageName = null;
    const finalStats = fs.lstatSync(targetName);
    if (
      finalStats.isSymbolicLink() ||
      !finalStats.isFile() ||
      finalStats.nlink !== 1 ||
      finalStats.size !== contents.length
    ) {
      throw receiptWriteError("RECEIPT_WRITE_FINAL_LEAF_UNSAFE");
    }
    if (!receiptAnchorPathMatches(expectedDev, expectedIno, anchorPath)) {
      fs.rmSync(targetName, { force: true });
      if (relativeLeafExists(targetName)) {
        throw receiptWriteError("RECEIPT_WRITE_CLEANUP_FAILED");
      }
      targetCreated = false;
      throw receiptWriteError("RECEIPT_WRITE_ANCHOR_MOVED");
    }
    if (typeof afterPublish === "function") afterPublish();
    targetCreated = false;
    return { ok: true, targetName };
  } catch (error) {
    primaryError = error;
  } finally {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch {
        cleanupError = receiptWriteError("RECEIPT_WRITE_CLOSE_FAILED");
      }
    }
    if (targetCreated) {
      try {
        fs.rmSync(targetName, { force: true });
        if (relativeLeafExists(targetName)) {
          throw receiptWriteError("RECEIPT_WRITE_CLEANUP_FAILED");
        }
      } catch {
        cleanupError = receiptWriteError("RECEIPT_WRITE_CLEANUP_FAILED");
      }
    }
    if (stageName !== null) {
      try {
        if (fault === "cleanup") {
          throw receiptWriteError("RECEIPT_WRITE_CLEANUP_FAILED");
        }
        fs.rmSync(stageName, { force: true });
        if (relativeLeafExists(stageName)) {
          throw receiptWriteError("RECEIPT_WRITE_CLEANUP_FAILED");
        }
      } catch {
        cleanupError = receiptWriteError("RECEIPT_WRITE_CLEANUP_FAILED");
      }
    }
  }
  const error = cleanupError ?? primaryError ?? receiptWriteError("RECEIPT_WRITE_FAILED");
  return { ok: false, error: receiptWriteErrorCode(error, "RECEIPT_WRITE_FAILED") };
}

function runCoordinatedReceiptChild({
  targetName,
  expectedDev,
  expectedIno,
  anchorPath,
  fault,
  coordinationDirectory,
  nonce,
}) {
  if (!/^[a-f0-9]{64}$/.test(nonce)) {
    return { ok: false, error: "RECEIPT_COORDINATION_NONCE_INVALID" };
  }
  try {
    assertReceiptCoordinationDirectory(coordinationDirectory);
    const contents = readPrivateCoordinationFile(
      coordinationDirectory,
      RECEIPT_COORDINATION_FILES.input,
      { required: true }
    );
    return writeAnchoredReceiptChild({
      targetName,
      expectedDev,
      expectedIno,
      anchorPath,
      fault,
      contentsOverride: contents,
      afterPublish() {
        writeCoordinationJson(coordinationDirectory, RECEIPT_COORDINATION_FILES.published, {
          nonce,
          status: "PUBLISHED",
          targetName,
        });
        const decisionRecord = waitForCoordinationRecord(
          coordinationDirectory,
          [RECEIPT_COORDINATION_FILES.decision],
          Date.now() + RECEIPT_COORDINATION_TIMEOUT_MS
        );
        if (!decisionRecord) {
          throw receiptWriteError("RECEIPT_WRITE_DECISION_TIMEOUT");
        }
        const decision = decisionRecord.value;
        if (
          decision.nonce !== nonce ||
          decision.targetName !== targetName ||
          !["ACK", "NACK"].includes(decision.decision)
        ) {
          throw receiptWriteError("RECEIPT_COORDINATION_DECISION_INVALID");
        }
        if (decision.decision === "NACK") {
          throw receiptWriteError("RECEIPT_WRITE_ANCHOR_MOVED");
        }
        if (!receiptAnchorPathMatches(expectedDev, expectedIno, anchorPath)) {
          throw receiptWriteError("RECEIPT_WRITE_ANCHOR_MOVED");
        }
      },
    });
  } catch (error) {
    return {
      ok: false,
      error: receiptWriteErrorCode(error, "RECEIPT_WRITE_CHILD_FAILED"),
    };
  }
}

function runAnchoredReceiptChild() {
  const [
    ,
    targetName,
    expectedDev,
    expectedIno,
    anchorPath,
    fault = "",
    coordinationDirectory = "",
    nonce = "",
  ] = process.argv.slice(2);
  const coordinated = Boolean(coordinationDirectory || nonce);
  const receipt = coordinated
    ? runCoordinatedReceiptChild({
        targetName,
        expectedDev,
        expectedIno,
        anchorPath,
        fault,
        coordinationDirectory,
        nonce,
      })
    : writeAnchoredReceiptChild({
        targetName,
        expectedDev,
        expectedIno,
        anchorPath,
        fault,
      });
  if (coordinated) {
    try {
      writeCoordinationJson(coordinationDirectory, RECEIPT_COORDINATION_FILES.result, {
        nonce,
        ...receipt,
      });
    } catch (error) {
      receipt.ok = false;
      receipt.error = receiptWriteErrorCode(error, "RECEIPT_COORDINATION_WRITE_FAILED");
    }
  }
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
  process.exitCode = receipt.ok ? 0 : 1;
}

function ensureReceiptDirectory(root, targetLeafName) {
  const receiptDirectory = path.join(root.resolvedRoot, RECEIPTS_RELATIVE_ROOT);
  let stats = null;
  try {
    stats = fs.lstatSync(receiptDirectory);
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      fail("RECEIPT_DIRECTORY_READ_FAILED", receiptDirectory);
    }
  }
  if (stats) {
    if (stats.isSymbolicLink()) fail("RECEIPT_DIRECTORY_SYMLINK", receiptDirectory);
    if (!stats.isDirectory()) fail("RECEIPT_DIRECTORY_NOT_DIRECTORY", receiptDirectory);
  } else {
    const parentDirectory = path.dirname(receiptDirectory);
    assertDirectoryChain(root, parentDirectory);
    try {
      fs.mkdirSync(receiptDirectory, { mode: 0o700 });
    } catch {
      fail("RECEIPT_DIRECTORY_CREATE_FAILED", receiptDirectory);
    }
  }
  const realReceiptDirectory = fs.realpathSync.native(receiptDirectory);
  if (!isStrictDescendant(root.realRoot, realReceiptDirectory)) {
    fail("RECEIPT_DIRECTORY_PATH_ESCAPE", receiptDirectory);
  }
  for (const entryName of fs.readdirSync(receiptDirectory)) {
    const entryPath = path.join(receiptDirectory, entryName);
    if (entryName === targetLeafName) fail("RECEIPT_LEAF_UNSAFE", entryPath);
    if (!ALLOWED_RECEIPT_NAMES.has(entryName)) {
      fail("RECEIPT_DIRECTORY_INVENTORY_UNSAFE", entryPath);
    }
    const entryStats = fs.lstatSync(entryPath);
    if (
      entryStats.isSymbolicLink() ||
      !entryStats.isFile() ||
      entryStats.nlink !== 1 ||
      entryStats.size === 0
    ) {
      fail("RECEIPT_DIRECTORY_INVENTORY_UNSAFE", entryPath);
    }
  }
  return receiptDirectory;
}

function createReceiptCoordination(contents) {
  let coordinationDirectory = null;
  try {
    coordinationDirectory = fs.mkdtempSync(
      path.join(SYSTEM_TEMPORARY_REAL_ROOT, RECEIPT_COORDINATION_PREFIX)
    );
    fs.chmodSync(coordinationDirectory, 0o700);
    assertReceiptCoordinationDirectory(coordinationDirectory);
    const nonce = crypto.randomBytes(32).toString("hex");
    writePrivateCoordinationFile(coordinationDirectory, RECEIPT_COORDINATION_FILES.input, contents);
    return { coordinationDirectory, nonce };
  } catch (error) {
    if (coordinationDirectory !== null) {
      try {
        cleanupReceiptCoordinationDirectory(coordinationDirectory);
      } catch {
        // Preserve the primary creation failure.
      }
    }
    if (error && typeof error.code === "string" && error.code.startsWith("RECEIPT_")) {
      throw error;
    }
    throw receiptWriteError("RECEIPT_COORDINATION_CREATE_FAILED");
  }
}

function validateCoordinationMessage(value, nonce, expected) {
  if (!isPlainObject(value) || value.nonce !== nonce) {
    fail("RECEIPT_COORDINATION_MESSAGE_INVALID", expected);
  }
  return value;
}

function runCoordinatedReceiptWrite(receiptDirectory, leafName, beforeDirectory, contents) {
  const { coordinationDirectory, nonce } = createReceiptCoordination(contents);
  let child = null;
  let protocolComplete = false;
  try {
    child = spawn(
      process.execPath,
      [
        __filename,
        INTERNAL_RECEIPT_WRITE_FLAG,
        leafName,
        String(beforeDirectory.dev),
        String(beforeDirectory.ino),
        receiptDirectory,
        "",
        coordinationDirectory,
        nonce,
      ],
      {
        cwd: receiptDirectory,
        shell: false,
        stdio: "ignore",
      }
    );
    child.on("error", () => {});
    if (!Number.isInteger(child.pid) || child.pid <= 0) {
      fail("RECEIPT_WRITE_CHILD_FAILED", receiptDirectory);
    }

    const deadline = Date.now() + RECEIPT_COORDINATION_TIMEOUT_MS;
    const firstRecord = waitForCoordinationRecord(
      coordinationDirectory,
      [RECEIPT_COORDINATION_FILES.result, RECEIPT_COORDINATION_FILES.published],
      deadline
    );
    if (!firstRecord) fail("RECEIPT_WRITE_CHILD_TIMEOUT", receiptDirectory);

    if (firstRecord.fileName === RECEIPT_COORDINATION_FILES.result) {
      const earlyResult = validateCoordinationMessage(firstRecord.value, nonce, "early result");
      protocolComplete = true;
      const code =
        typeof earlyResult.error === "string" ? earlyResult.error : "RECEIPT_WRITE_CHILD_FAILED";
      fail(code, receiptDirectory);
    }

    const published = validateCoordinationMessage(firstRecord.value, nonce, "published");
    if (published.status !== "PUBLISHED" || published.targetName !== leafName) {
      fail("RECEIPT_COORDINATION_MESSAGE_INVALID", "published");
    }

    let directoryUnchanged = false;
    try {
      directoryUnchanged = sameIdentity(directoryIdentity(receiptDirectory), beforeDirectory);
    } catch {
      directoryUnchanged = false;
    }
    writeCoordinationJson(coordinationDirectory, RECEIPT_COORDINATION_FILES.decision, {
      nonce,
      targetName: leafName,
      decision: directoryUnchanged ? "ACK" : "NACK",
    });

    const resultRecord = waitForCoordinationRecord(
      coordinationDirectory,
      [RECEIPT_COORDINATION_FILES.result],
      Date.now() + RECEIPT_COORDINATION_TIMEOUT_MS
    );
    if (!resultRecord) fail("RECEIPT_WRITE_CHILD_TIMEOUT", receiptDirectory);
    const result = validateCoordinationMessage(resultRecord.value, nonce, "result");
    protocolComplete = true;
    if (!directoryUnchanged) {
      if (result.ok !== false || result.error !== "RECEIPT_WRITE_ANCHOR_MOVED") {
        fail("RECEIPT_COORDINATION_RESULT_INVALID", receiptDirectory);
      }
      fail("RECEIPT_WRITE_ANCHOR_MOVED", receiptDirectory);
    }
    if (result.ok !== true || result.targetName !== leafName) {
      const code = typeof result.error === "string" ? result.error : "RECEIPT_WRITE_FAILED";
      fail(code, receiptDirectory);
    }
    return result;
  } finally {
    if (!protocolComplete && child !== null && child.exitCode === null) {
      try {
        child.kill("SIGKILL");
      } catch {
        // Cleanup below remains mandatory and named.
      }
    }
    cleanupReceiptCoordinationDirectory(coordinationDirectory);
  }
}

function writeReceiptAtomically(root, leafName, contents) {
  if (!ALLOWED_RECEIPT_NAMES.has(leafName) || path.basename(leafName) !== leafName) {
    fail("RECEIPT_WRITE_INVALID_TARGET", leafName);
  }
  const receiptDirectory = ensureReceiptDirectory(root, leafName);
  const receiptPath = path.join(receiptDirectory, leafName);
  const beforeDirectory = directoryIdentity(receiptDirectory);
  try {
    fs.lstatSync(receiptPath);
    fail("RECEIPT_LEAF_UNSAFE", receiptPath);
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
  }

  runCoordinatedReceiptWrite(receiptDirectory, leafName, beforeDirectory, contents);

  const finalStats = fs.lstatSync(receiptPath);
  if (
    finalStats.isSymbolicLink() ||
    !finalStats.isFile() ||
    finalStats.nlink !== 1 ||
    finalStats.size !== contents.length
  ) {
    fail("RECEIPT_LEAF_UNSAFE", receiptPath);
  }

  return receiptPath;
}

function selectCandidate(source, candidateId) {
  if (!Object.prototype.hasOwnProperty.call(PROJECT_NAMES, candidateId)) {
    fail("CANDIDATE_ID_INVALID", candidateId);
  }
  const candidate = source.candidates.find((row) => row && row.id === candidateId);
  if (!candidate || !isPlainObject(candidate.mix)) fail("CANDIDATE_SOURCE_MISSING", candidateId);
  return candidate;
}

function receiptLeafName(renders) {
  return `${path.basename(renders[0].path, ".wav")}-session-receipt.json`;
}

function inspectAdmittedEnvironment(root, input) {
  const hasExplicitPaths = Object.prototype.hasOwnProperty.call(input, "garageBandPaths");
  if (!hasExplicitPaths) {
    if (root.realRoot !== MODULE_REPOSITORY_REAL_ROOT) {
      fail("TASK4_ROOT_NOT_CANONICAL", root.realRoot);
    }
    const environment = inspectGarageBandEnvironment(DEFAULT_GARAGEBAND_PATHS);
    if (environment.identitySource !== "LOCAL_SYSTEM") {
      fail("TASK4_ENVIRONMENT_NOT_LOCAL", environment.identitySource);
    }
    return {
      environment,
      receiptKind: "TASK4_LOCAL_EVIDENCE",
      environmentAdmissionStatus: "LOCAL_CANONICAL_HASH_BOUND",
    };
  }

  if (!isStrictDescendant(SYSTEM_TEMPORARY_REAL_ROOT, root.realRoot)) {
    fail("FIXTURE_ROOT_NOT_TEMP", root.realRoot);
  }
  if (
    !isPlainObject(input.garageBandPaths) ||
    !Object.prototype.hasOwnProperty.call(input.garageBandPaths, "systemIdentity")
  ) {
    fail("ENVIRONMENT_OVERRIDE_NOT_TEST_FIXTURE", "systemIdentity");
  }
  const environment = inspectGarageBandEnvironment(input.garageBandPaths);
  if (environment.identitySource !== "UNIT_TEST_FIXTURE") {
    fail("ENVIRONMENT_OVERRIDE_NOT_TEST_FIXTURE", environment.identitySource);
  }
  for (const key of ENVIRONMENT_PATH_KEYS) {
    const realResourcePath = fs.realpathSync.native(input.garageBandPaths[key]);
    if (!isStrictDescendant(root.realRoot, realResourcePath)) {
      fail("FIXTURE_RESOURCE_OUTSIDE_ROOT", input.garageBandPaths[key]);
    }
  }
  return {
    environment,
    receiptKind: "TEST_ONLY_NOT_ADMITTED",
    environmentAdmissionStatus: "TEST_ONLY_NOT_ADMITTED",
  };
}

function writeGarageBandSessionReceipt(input) {
  if (!isPlainObject(input)) fail("SESSION_INPUT_INVALID", "input");
  const allowedKeys = [
    "rootDir",
    "projectPath",
    "renderPaths",
    "visualEvidencePaths",
    "candidateId",
    "garageBandPaths",
  ];
  if (!Object.keys(input).every((key) => allowedKeys.includes(key))) {
    fail("SESSION_INPUT_INVALID", "unexpected key");
  }

  const root = inspectRoot(input.rootDir);
  if (typeof input.candidateId !== "string" || !PROJECT_NAMES[input.candidateId]) {
    fail("CANDIDATE_ID_INVALID", String(input.candidateId));
  }
  if (typeof input.projectPath !== "string" || !path.isAbsolute(input.projectPath)) {
    fail("PROJECT_PATH_INVALID", String(input.projectPath));
  }

  const admission = inspectAdmittedEnvironment(root, input);
  const sourcePack = inspectSourcePack(root);
  const candidate = selectCandidate(sourcePack.source, input.candidateId);
  const project = inspectProject(root, input.projectPath, input.candidateId);
  const renders = inspectRenders(root, input.renderPaths, input.candidateId);
  const visualEvidence = inspectVisualEvidence(root, input.visualEvidencePaths, input.candidateId);

  const serializableReceipt = {
    schemaVersion: 1,
    receiptKind: admission.receiptKind,
    environmentAdmissionStatus: admission.environmentAdmissionStatus,
    sourceId: sourcePack.source.id,
    candidateId: input.candidateId,
    mixId: candidate.id,
    mix: { ...candidate.mix },
    appleLoopsUsed: false,
    externalAudioRegions: [],
    runtimePromotionStatus: "NOT_ALLOWED",
    ownerArtisticStatus: "UNVERIFIED",
    projectSemanticVerificationStatus: "UNVERIFIED",
    mixApplicationVerificationStatus: "UNVERIFIED",
    visualEvidenceStatus: "HASH_BOUND_NOT_SEMANTICALLY_VERIFIED",
    claimBasis: {
      declaredValues: "CANONICAL_SOURCE_DECLARATION_HASH_BOUND",
      bundleInspection: "STRUCTURAL_INVENTORY_AND_EMPTY_MEDIA_AUDIO_FILES_ONLY",
      garageBandUiState: "UNVERIFIED_REQUIRES_HUMAN_CONTROLLER_REVIEW",
    },
    environment: admission.environment,
    source: sourcePack.receipt,
    project,
    renders,
    visualEvidence,
  };
  const receiptBytes = Buffer.from(`${JSON.stringify(serializableReceipt, null, 2)}\n`);
  const receiptPath = writeReceiptAtomically(root, receiptLeafName(renders), receiptBytes);
  return {
    ...serializableReceipt,
    receiptPath,
    receiptBytes: receiptBytes.length,
    receiptSha256: crypto.createHash("sha256").update(receiptBytes).digest("hex"),
  };
}

if (require.main === module && process.argv[2] === INTERNAL_RECEIPT_WRITE_FLAG) {
  runAnchoredReceiptChild();
} else {
  module.exports = {
    DEFAULT_GARAGEBAND_PATHS,
    inspectGarageBandEnvironment,
    writeGarageBandSessionReceipt,
  };
}
