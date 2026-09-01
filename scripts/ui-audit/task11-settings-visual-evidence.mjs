import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

export const TASK11_SUBJECT_HEAD = "e5016f156497a9d3e55578b773294bf56adce58e";

export const TASK11_CANONICAL_RUNNER_ID =
  "darwin-25.5.0-arm64-node-v22.22.0-playwright-1.59.1-chromium-147.0.7727.15";

export const TASK11_FIXED_CLOCK = "2026-07-29T14:00:00.000Z";

export const TASK11_OUTPUT_ROOT = [
  "output",
  "ui-system-audit",
  TASK11_SUBJECT_HEAD,
  "after",
  "task11-settings-matrix",
].join("/");

export const TASK11_BUILD_MANIFEST_EVIDENCE_PATH = `${TASK11_OUTPUT_ROOT}/production-build-manifest.json`;

export const TASK11_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "T11-01-320-de-paper-text-200-overview",
    viewport: Object.freeze({ width: 320, height: 800 }),
    locale: "de",
    direction: "ltr",
    theme: "paper",
    layout: "phone",
    view: "overview",
    selectedSection: "appearance",
    rootFontScale: 2,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: false,
    hoverEvidence: false,
  }),
  Object.freeze({
    id: "T11-02-360-en-ink-keyboard-detail",
    viewport: Object.freeze({ width: 360, height: 800 }),
    locale: "en",
    direction: "ltr",
    theme: "ink",
    layout: "phone",
    view: "detail",
    selectedSection: "account",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: true,
    hoverEvidence: false,
  }),
  Object.freeze({
    id: "T11-03-390-uk-oled-hover-overview",
    viewport: Object.freeze({ width: 390, height: 844 }),
    locale: "uk",
    direction: "ltr",
    theme: "oled",
    layout: "phone",
    view: "overview",
    selectedSection: "privacy",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: false,
    hoverEvidence: true,
  }),
  Object.freeze({
    id: "T11-04-393-ar-paper-high-contrast-detail",
    viewport: Object.freeze({ width: 393, height: 852 }),
    locale: "ar",
    direction: "rtl",
    theme: "paper",
    layout: "phone",
    view: "detail",
    selectedSection: "appearance",
    rootFontScale: 1,
    highContrast: true,
    forcedColors: false,
    offline: false,
    focusEvidence: true,
    hoverEvidence: false,
  }),
  Object.freeze({
    id: "T11-05-430-he-ink-detail",
    viewport: Object.freeze({ width: 430, height: 932 }),
    locale: "he",
    direction: "rtl",
    theme: "ink",
    layout: "phone",
    view: "detail",
    selectedSection: "privacy",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: false,
    hoverEvidence: false,
  }),
  Object.freeze({
    id: "T11-06-600-es-oled-short-landscape-offline",
    viewport: Object.freeze({ width: 600, height: 360 }),
    locale: "es",
    direction: "ltr",
    theme: "oled",
    layout: "phone",
    view: "detail",
    selectedSection: "sound",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: true,
    focusEvidence: false,
    hoverEvidence: false,
  }),
  Object.freeze({
    id: "T11-07-768-fr-paper-overview",
    viewport: Object.freeze({ width: 768, height: 1024 }),
    locale: "fr",
    direction: "ltr",
    theme: "paper",
    layout: "phone",
    view: "overview",
    selectedSection: "appearance",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: false,
    hoverEvidence: false,
  }),
  Object.freeze({
    id: "T11-08-1024-ja-ink-list-detail-focus",
    viewport: Object.freeze({ width: 1024, height: 768 }),
    locale: "ja",
    direction: "ltr",
    theme: "ink",
    layout: "desktop",
    view: "list-detail",
    selectedSection: "appearance",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: true,
    hoverEvidence: false,
  }),
  Object.freeze({
    id: "T11-09-1280-en-oled-list-detail-hover",
    viewport: Object.freeze({ width: 1280, height: 900 }),
    locale: "en",
    direction: "ltr",
    theme: "oled",
    layout: "desktop",
    view: "list-detail",
    selectedSection: "privacy",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: false,
    hoverEvidence: true,
  }),
  Object.freeze({
    id: "T11-10-1440-uk-paper-high-contrast-list-detail",
    viewport: Object.freeze({ width: 1440, height: 900 }),
    locale: "uk",
    direction: "ltr",
    theme: "paper",
    layout: "desktop",
    view: "list-detail",
    selectedSection: "sound",
    rootFontScale: 1,
    highContrast: true,
    forcedColors: false,
    offline: false,
    focusEvidence: false,
    hoverEvidence: false,
  }),
  Object.freeze({
    id: "T11-11-1536-de-ink-forced-colors-list-detail",
    viewport: Object.freeze({ width: 1536, height: 864 }),
    locale: "de",
    direction: "ltr",
    theme: "ink",
    layout: "desktop",
    view: "list-detail",
    selectedSection: "account",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: true,
    offline: false,
    focusEvidence: true,
    hoverEvidence: false,
  }),
]);

const EXPECTED_SOURCE_PATHS = Object.freeze([
  "e2e/ui-system-settings-visual.spec.ts",
  "scripts/ui-audit/task11-settings-visual-evidence.mjs",
  "playwright.config.ts",
  "package.json",
]);

const EXPECTED_UNVERIFIED_IDS = Object.freeze([
  "approved-visual-reference-baseline",
  "canonical-linux-approval-baseline",
  "browser-chrome-zoom-200",
  "loading",
  "error",
  "disabled",
  "destructive-confirmation",
  "offline-first-load-installed-pwa",
  "native-and-assistive-runtime",
  "native-ads-consent-settings",
  "full-surface-scroll-state-visuals",
]);

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CANONICAL_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const EXPECTED_FIXTURE_SOURCE = "e2e/ui-system-settings-visual.spec.ts#primeTask11Settings";
const EXPECTED_ROUTE_PATH = "/people-first-app/settings";
const ONLINE_NETWORK_OBSERVATION = "isolated local production preview; external requests blocked";
const OFFLINE_NETWORK_OBSERVATION = "offline after local production page load";
const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

function normalizeRelativePath(value) {
  return String(value ?? "")
    .split(path.sep)
    .join("/")
    .replace(/^\.\//u, "");
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function isCanonicalUtcTimestamp(value) {
  if (typeof value !== "string" || !CANONICAL_UTC_PATTERN.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function expectedLocalBaseURL(env) {
  const rawPort = String(env?.ZENFLOW_PLAYWRIGHT_LOCAL_PORT ?? "").trim();
  if (!/^\d+$/u.test(rawPort)) return null;
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return `http://127.0.0.1:${port}/people-first-app/`;
}

function resolveSecureEvidencePath({
  repositoryRoot,
  relativePath,
  label,
  errors,
  expectedKind = "file",
}) {
  const repositoryPath = path.resolve(repositoryRoot);
  try {
    const repositoryStat = lstatSync(repositoryPath);
    if (repositoryStat.isSymbolicLink() || !repositoryStat.isDirectory()) {
      errors.push(`${label}: repository root must be a real directory`);
      return null;
    }
  } catch (error) {
    errors.push(
      `${label}: repository root cannot be inspected: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }

  const normalizedPath = normalizeRelativePath(relativePath);
  if (
    normalizedPath.length === 0 ||
    path.isAbsolute(normalizedPath) ||
    normalizedPath.includes("\\")
  ) {
    errors.push(`${label}: evidence path must be a normalized relative path`);
    return null;
  }
  const absolutePath = path.resolve(repositoryPath, normalizedPath);
  const relativeToRepository = path.relative(repositoryPath, absolutePath);
  if (
    relativeToRepository === ".." ||
    relativeToRepository.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRepository)
  ) {
    errors.push(`${label}: path escapes the repository root`);
    return null;
  }

  const segments = normalizedPath.split("/");
  let cursor = repositoryPath;
  try {
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (!segment || segment === "." || segment === "..") {
        errors.push(`${label}: evidence path contains an invalid segment`);
        return null;
      }
      cursor = path.join(cursor, segment);
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink()) {
        errors.push(`${label}: evidence path must not traverse a symbolic link`);
        return null;
      }
      const isFinal = index === segments.length - 1;
      if (!isFinal && !stat.isDirectory()) {
        errors.push(`${label}: evidence path ancestor must be a directory`);
        return null;
      }
      if (
        isFinal &&
        ((expectedKind === "file" && !stat.isFile()) ||
          (expectedKind === "directory" && !stat.isDirectory()))
      ) {
        errors.push(`${label}: evidence must be a regular ${expectedKind}`);
        return null;
      }
    }
    return {
      absolutePath,
      stat: lstatSync(absolutePath),
    };
  } catch (error) {
    errors.push(
      `${label}: evidence path cannot be inspected: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

function inspectRegularEvidenceFile({
  repositoryRoot,
  relativePath,
  expectedSize,
  expectedSha256,
  label,
  errors,
}) {
  const resolved = resolveSecureEvidencePath({
    repositoryRoot,
    relativePath,
    label,
    errors,
  });
  if (!resolved) return null;
  try {
    if (resolved.stat.size <= 0) {
      errors.push(`${label}: evidence file must not be empty`);
    }
    if (expectedSize !== undefined && expectedSize !== resolved.stat.size) {
      errors.push(`${label}: size does not match the evidence file`);
    }
    if (expectedSha256 !== undefined && expectedSha256 !== sha256File(resolved.absolutePath)) {
      errors.push(`${label}: sha256 does not match the evidence file`);
    }
    return {
      ...resolved,
      bytes: readFileSync(resolved.absolutePath),
    };
  } catch (error) {
    errors.push(
      `${label}: evidence file cannot be inspected: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

function inventoryRegularFiles({ repositoryRoot, relativeRoot, label, errors }) {
  const resolvedRoot = resolveSecureEvidencePath({
    repositoryRoot,
    relativePath: relativeRoot,
    label,
    errors,
    expectedKind: "directory",
  });
  if (!resolvedRoot) return null;

  const inventory = [];
  const visit = (absoluteDirectory, relativeDirectory) => {
    const entries = readdirSync(absoluteDirectory, {
      encoding: "utf8",
      withFileTypes: true,
    }).sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativeEntry = `${relativeDirectory}/${entry.name}`;
      const absoluteEntry = path.join(absoluteDirectory, entry.name);
      const stat = lstatSync(absoluteEntry);
      if (entry.isSymbolicLink() || stat.isSymbolicLink()) {
        errors.push(
          `${label}: evidence inventory must not contain symbolic links: ${relativeEntry}`
        );
        continue;
      }
      if (entry.isDirectory() && stat.isDirectory()) {
        visit(absoluteEntry, relativeEntry);
        continue;
      }
      if (!entry.isFile() || !stat.isFile()) {
        errors.push(`${label}: evidence inventory contains a non-regular entry: ${relativeEntry}`);
        continue;
      }
      inventory.push({
        path: relativeEntry,
        sizeBytes: stat.size,
        sha256: sha256File(absoluteEntry),
      });
    }
  };

  try {
    visit(resolvedRoot.absolutePath, normalizeRelativePath(relativeRoot));
  } catch (error) {
    errors.push(
      `${label}: evidence inventory cannot be inspected: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
  return inventory.sort((left, right) => left.path.localeCompare(right.path));
}

function validatePngEvidence(bytes, expectedWidth, expectedHeight, label, errors) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 57) {
    errors.push(`${label}: PNG file is truncated`);
    return;
  }
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    errors.push(`${label}: PNG signature is invalid`);
    return;
  }

  let offset = PNG_SIGNATURE.length;
  let ihdr = null;
  let sawIdat = false;
  let sawIend = false;
  const compressedParts = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) {
      errors.push(`${label}: PNG chunk header is truncated`);
      return;
    }
    const length = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) {
      errors.push(`${label}: PNG chunk payload is truncated`);
      return;
    }
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const declaredCrc = bytes.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(Buffer.concat([typeBytes, data]));
    if (declaredCrc !== actualCrc) {
      errors.push(`${label}: PNG chunk CRC is invalid for ${type}`);
      return;
    }

    if (offset === PNG_SIGNATURE.length && (type !== "IHDR" || length !== 13)) {
      errors.push(`${label}: PNG must start with a 13-byte IHDR chunk`);
      return;
    }
    if (type === "IHDR") {
      if (ihdr !== null || length !== 13) {
        errors.push(`${label}: PNG IHDR structure is invalid`);
        return;
      }
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      sawIdat = true;
      compressedParts.push(data);
    } else if (type === "IEND") {
      if (length !== 0) {
        errors.push(`${label}: PNG IEND chunk must be empty`);
        return;
      }
      sawIend = true;
      offset = chunkEnd;
      if (offset !== bytes.length) {
        errors.push(`${label}: PNG contains trailing bytes after IEND`);
      }
      break;
    }
    offset = chunkEnd;
  }

  if (!ihdr || !sawIdat || !sawIend) {
    errors.push(`${label}: PNG must contain IHDR, IDAT, and IEND chunks`);
    return;
  }
  if (ihdr.width !== expectedWidth || ihdr.height !== expectedHeight) {
    errors.push(`${label}: PNG IHDR dimensions must be ${expectedWidth}x${expectedHeight}`);
  }
  const allowedBitDepths = {
    0: new Set([1, 2, 4, 8, 16]),
    2: new Set([8, 16]),
    3: new Set([1, 2, 4, 8]),
    4: new Set([8, 16]),
    6: new Set([8, 16]),
  };
  if (
    !allowedBitDepths[ihdr.colorType]?.has(ihdr.bitDepth) ||
    ihdr.compression !== 0 ||
    ihdr.filter !== 0 ||
    ihdr.interlace !== 0
  ) {
    errors.push(`${label}: PNG IHDR encoding is unsupported or invalid`);
    return;
  }
  try {
    inflateSync(Buffer.concat(compressedParts));
  } catch (error) {
    errors.push(
      `${label}: PNG compressed payload is invalid: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function artifactSnapshotSha256(files) {
  return createHash("sha256")
    .update(files.map((file) => `${file.path}\0${file.sizeBytes}\0${file.sha256}\n`).join(""))
    .digest("hex");
}

function validateProductionBuildReceipt({
  repositoryRoot,
  relativePath,
  errors,
  label,
  verifyArtifactsOnDisk = true,
}) {
  const inspected = inspectRegularEvidenceFile({
    repositoryRoot,
    relativePath,
    label,
    errors,
  });
  if (!inspected) return null;
  let receipt;
  try {
    receipt = JSON.parse(inspected.bytes.toString("utf8"));
  } catch (error) {
    errors.push(
      `${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    errors.push(`${label} must be a JSON object`);
    return null;
  }
  if (receipt.schemaVersion !== 1) errors.push(`${label} schemaVersion must be 1`);
  if (receipt.producer !== "zenflow-ratchet-production-web-v1") {
    errors.push(`${label} producer must be zenflow-ratchet-production-web-v1`);
  }
  if (receipt.target !== "web") errors.push(`${label} target must be web`);
  if (receipt.mode !== "production") errors.push(`${label} mode must be production`);
  if (receipt.distRoot !== "dist") errors.push(`${label} distRoot must be dist`);
  if (receipt.completed !== true) errors.push(`${label} completed must be true`);
  if (
    typeof receipt.buildId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(
      receipt.buildId
    )
  ) {
    errors.push(`${label} buildId must be a UUID`);
  }
  if (!isCanonicalUtcTimestamp(receipt.startedAt)) {
    errors.push(`${label} startedAt must be canonical UTC`);
  }
  if (!isCanonicalUtcTimestamp(receipt.completedAt)) {
    errors.push(`${label} completedAt must be canonical UTC`);
  }
  if (
    isCanonicalUtcTimestamp(receipt.startedAt) &&
    isCanonicalUtcTimestamp(receipt.completedAt) &&
    Date.parse(receipt.completedAt) < Date.parse(receipt.startedAt)
  ) {
    errors.push(`${label} completedAt precedes startedAt`);
  }
  if (!SHA256_PATTERN.test(String(receipt.buildInputsSha256 ?? ""))) {
    errors.push(`${label} buildInputsSha256 must be SHA-256`);
  }
  if (!SHA256_PATTERN.test(String(receipt.artifactsSha256 ?? ""))) {
    errors.push(`${label} artifactsSha256 must be SHA-256`);
  }
  if (!Number.isSafeInteger(receipt.bundleSizeBytes) || receipt.bundleSizeBytes <= 0) {
    errors.push(`${label} bundleSizeBytes must be a positive safe integer`);
  }
  if (!Array.isArray(receipt.files) || receipt.files.length === 0) {
    errors.push(`${label} files must be a non-empty array`);
    return {
      receipt,
      receiptSha256: createHash("sha256").update(inspected.bytes).digest("hex"),
      receiptSizeBytes: inspected.bytes.length,
    };
  }

  const normalizedFiles = [];
  for (const [index, file] of receipt.files.entries()) {
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      errors.push(`${label} files[${index}] must be an object`);
      continue;
    }
    if (
      typeof file.path !== "string" ||
      !/^assets\/.+\.js$/u.test(file.path) ||
      file.path.includes("\\") ||
      file.path.split("/").includes("..")
    ) {
      errors.push(`${label} artifact path is invalid at files[${index}]`);
      continue;
    }
    if (!Number.isSafeInteger(file.sizeBytes) || file.sizeBytes <= 0) {
      errors.push(`${label} artifact size is invalid: ${file.path}`);
    }
    if (!SHA256_PATTERN.test(String(file.sha256 ?? ""))) {
      errors.push(`${label} artifact hash is invalid: ${file.path}`);
    }
    if (verifyArtifactsOnDisk) {
      inspectRegularEvidenceFile({
        repositoryRoot,
        relativePath: `dist/${file.path}`,
        expectedSize: file.sizeBytes,
        expectedSha256: file.sha256,
        label: `${label} artifact ${file.path}`,
        errors,
      });
    }
    normalizedFiles.push({
      path: file.path,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
    });
  }

  const paths = normalizedFiles.map((file) => file.path);
  const sortedPaths = [...paths].sort((left, right) => left.localeCompare(right));
  if (new Set(paths).size !== paths.length) {
    errors.push(`${label} files contain duplicate artifact paths`);
  }
  if (JSON.stringify(paths) !== JSON.stringify(sortedPaths)) {
    errors.push(`${label} files must be sorted by path`);
  }
  const actualBundleSize = normalizedFiles.reduce((total, file) => total + file.sizeBytes, 0);
  if (receipt.bundleSizeBytes !== actualBundleSize) {
    errors.push(`${label} bundleSizeBytes does not match declared files`);
  }
  if (receipt.artifactsSha256 !== artifactSnapshotSha256(normalizedFiles)) {
    errors.push(`${label} artifactsSha256 does not match declared files`);
  }
  return {
    receipt,
    receiptSha256: createHash("sha256").update(inspected.bytes).digest("hex"),
    receiptSizeBytes: inspected.bytes.length,
  };
}

export function validateTask11ProductionContext({
  env = {},
  baseURL,
  configuredBaseURL,
  subjectHead,
  runnerId,
} = {}) {
  const errors = [];
  if (!/^(?:1|true)$/iu.test(String(env.CI ?? ""))) {
    errors.push("CI must be explicitly true for a production-dist Task 11 capture");
  }
  if (env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER !== "true") {
    errors.push("local Playwright server must be explicitly enabled");
  }
  if (env.ZENFLOW_PLAYWRIGHT_PREVIEW_DIR !== "dist") {
    errors.push("preview directory must be exactly dist");
  }

  const expectedBaseURL = expectedLocalBaseURL(env);
  if (!expectedBaseURL) {
    errors.push("local preview port must be an explicit valid TCP port");
  } else {
    if (baseURL !== expectedBaseURL) {
      errors.push(`baseURL must match the isolated local preview: ${expectedBaseURL}`);
    }
    if (configuredBaseURL !== expectedBaseURL) {
      errors.push(`project baseURL must match the isolated local preview: ${expectedBaseURL}`);
    }
  }

  if (subjectHead !== TASK11_SUBJECT_HEAD) {
    errors.push(`subject HEAD must be ${TASK11_SUBJECT_HEAD}`);
  }
  if (runnerId !== TASK11_CANONICAL_RUNNER_ID) {
    errors.push(`local diagnostic runner must be ${TASK11_CANONICAL_RUNNER_ID}`);
  }
  return errors;
}

export function validateTask11CaptureSet({
  captures,
  outputRoot,
  repositoryRoot,
  buildReceiptPath,
} = {}) {
  const errors = [];
  if (!Array.isArray(captures)) return ["captures must be an array"];
  if (typeof repositoryRoot !== "string" || repositoryRoot.length === 0) {
    return ["repositoryRoot must be a non-empty string"];
  }

  const normalizedOutputRoot = normalizeRelativePath(outputRoot).replace(/\/+$/u, "");
  if (normalizedOutputRoot !== TASK11_OUTPUT_ROOT) {
    errors.push(`output root must be exactly ${TASK11_OUTPUT_ROOT}`);
  }

  const normalizedBuildReceiptPath = normalizeRelativePath(buildReceiptPath);
  const buildReceiptIsSource =
    normalizedBuildReceiptPath === "dist/.zenflow-ratchet-production-web-manifest.json";
  const buildReceiptIsImmutableEvidence =
    normalizedBuildReceiptPath === TASK11_BUILD_MANIFEST_EVIDENCE_PATH;
  if (!buildReceiptIsSource && !buildReceiptIsImmutableEvidence) {
    errors.push(
      `build receipt path must be dist/.zenflow-ratchet-production-web-manifest.json or ${TASK11_BUILD_MANIFEST_EVIDENCE_PATH}`
    );
  }
  const validatedBuild = validateProductionBuildReceipt({
    repositoryRoot,
    relativePath: normalizedBuildReceiptPath,
    errors,
    label: "production build receipt",
    verifyArtifactsOnDisk: buildReceiptIsSource,
  });
  const buildReceipt = validatedBuild?.receipt ?? null;
  const buildReceiptSha256 = validatedBuild?.receiptSha256 ?? null;

  const expectedById = new Map(TASK11_SCENARIOS.map((scenario) => [scenario.id, scenario]));
  const observedIds = new Set();

  for (const capture of captures) {
    if (!capture || typeof capture !== "object") {
      errors.push("capture entry must be an object");
      continue;
    }
    const id = String(capture.id ?? "");
    if (observedIds.has(id)) errors.push(`duplicate capture ID: ${id}`);
    observedIds.add(id);
    const expected = expectedById.get(id);
    if (!expected) {
      errors.push(`unexpected capture ID: ${id}`);
      continue;
    }

    const expectedPath = `${TASK11_OUTPUT_ROOT}/${id}.png`;
    if (capture.path !== expectedPath) {
      errors.push(`${id}: path must be ${expectedPath}`);
    } else {
      const inspectedPng = inspectRegularEvidenceFile({
        repositoryRoot,
        relativePath: capture.path,
        expectedSize: capture.sizeBytes,
        expectedSha256: capture.sha256,
        label: id,
        errors,
      });
      if (inspectedPng) {
        validatePngEvidence(
          inspectedPng.bytes,
          expected.viewport.width,
          expected.viewport.height,
          id,
          errors
        );
      }
    }

    const expectedViewport = expected.viewport;
    if (
      capture.viewport?.width !== expectedViewport.width ||
      capture.viewport?.height !== expectedViewport.height
    ) {
      errors.push(`${id}: viewport must be ${expectedViewport.width}x${expectedViewport.height}`);
    }

    for (const field of [
      "locale",
      "direction",
      "theme",
      "layout",
      "view",
      "selectedSection",
      "rootFontScale",
      "highContrast",
      "forcedColors",
      "offline",
      "focusEvidence",
      "hoverEvidence",
    ]) {
      if (capture[field] !== expected[field]) {
        errors.push(`${id}: ${field} must be ${String(expected[field])}`);
      }
    }

    if (capture.subjectHead !== TASK11_SUBJECT_HEAD) {
      errors.push(`${id}: subject HEAD does not match the immutable audit subject`);
    }
    if (capture.runnerId !== TASK11_CANONICAL_RUNNER_ID) {
      errors.push(`${id}: local diagnostic runner identity is invalid`);
    }
    if (capture.runnerScope !== "LOCAL_DIAGNOSTIC_ONLY") {
      errors.push(`${id}: capture runner scope must be local diagnostic only`);
    }
    if (capture.platformProof !== "WEB_BROWSER_ONLY" || capture.nativeProof !== "UNVERIFIED") {
      errors.push(`${id}: platform proof boundary is incomplete`);
    }
    if (
      capture.host?.os !== "darwin" ||
      capture.host?.osRelease !== "25.5.0" ||
      capture.host?.architecture !== "arm64" ||
      capture.host?.nodeVersion !== "v22.22.0"
    ) {
      errors.push(`${id}: host metadata does not match the local diagnostic runner`);
    }
    if (
      capture.browser?.name !== "chromium" ||
      capture.browser?.version !== "147.0.7727.15" ||
      capture.browser?.playwrightVersion !== "1.59.1"
    ) {
      errors.push(`${id}: browser metadata does not match the local diagnostic runner`);
    }
    if (capture.dpr !== 1) {
      errors.push(`${id}: DPR must be exactly 1 for pixel-bound Task 11 evidence`);
    }
    if (
      typeof capture.fontProvenance !== "string" ||
      !capture.fontProvenance.includes("document.fonts.status=loaded")
    ) {
      errors.push(`${id}: font provenance must confirm loaded document fonts`);
    }
    if (capture.timezone !== "UTC" || capture.fixedClock !== TASK11_FIXED_CLOCK) {
      errors.push(`${id}: time evidence must use the Task 11 fixed UTC clock`);
    }
    if (!isCanonicalUtcTimestamp(capture.capturedAt)) {
      errors.push(`${id}: capture timestamp must be canonical UTC`);
    }
    if (capture.reducedMotion !== true) {
      errors.push(`${id}: reduced-motion evidence must be active`);
    }
    if (
      capture.fixtureProvenance?.kind !== "ISOLATED_TEST_FIXTURE" ||
      capture.fixtureProvenance?.source !== EXPECTED_FIXTURE_SOURCE ||
      capture.fixtureProvenance?.productionReachable !== false ||
      capture.fixtureProvenance?.containsUserData !== false
    ) {
      errors.push(`${id}: fixture provenance is not the isolated no-user-data contract`);
    }
    if (capture.visualReferenceDisposition !== "missing-state") {
      errors.push(`${id}: visual reference disposition must be missing-state`);
    }
    if (capture.sameRunRepeatSha256Match !== true) {
      errors.push(`${id}: same-run repeat screenshot hash must match`);
    }

    let routeValid = false;
    try {
      const route = new URL(String(capture.route ?? ""), "http://task11.invalid");
      routeValid =
        route.pathname === EXPECTED_ROUTE_PATH &&
        route.searchParams.get("dev") === "true" &&
        route.searchParams.get("nav") === "v2" &&
        route.hash === "";
    } catch {
      routeValid = false;
    }
    if (!routeValid) errors.push(`${id}: route observation is invalid`);
    const expectedState = expected.offline ? "loaded-page-offline" : "local-no-account-data";
    if (capture.state !== expectedState) {
      errors.push(`${id}: state observation must be ${expectedState}`);
    }
    const expectedNetwork = expected.offline
      ? OFFLINE_NETWORK_OBSERVATION
      : ONLINE_NETWORK_OBSERVATION;
    if (capture.network !== expectedNetwork) {
      errors.push(`${id}: network observation is invalid`);
    }

    if (buildReceipt) {
      if (capture.buildId !== buildReceipt.buildId) {
        errors.push(`${id}: build ID does not match the production build receipt`);
      }
      if (capture.buildArtifactsSha256 !== buildReceipt.artifactsSha256) {
        errors.push(`${id}: production build artifacts hash does not match`);
      }
      if (capture.buildReceiptSha256 !== buildReceiptSha256) {
        errors.push(`${id}: production build receipt hash does not match`);
      }
    }

    const observations = capture.observations;
    if (!observations || typeof observations !== "object") {
      errors.push(`${id}: observations are missing`);
      continue;
    }
    if (observations.documentOverflowPx !== 0) {
      errors.push(`${id}: horizontal overflow must be zero`);
    }
    if (observations.clippedTextCount !== 0) {
      errors.push(`${id}: clipped visible text count must be zero`);
    }
    if (observations.motionReductionActive !== true) {
      errors.push(`${id}: reduced-motion runtime observation is incomplete`);
    }
    if (
      typeof observations.minMeasuredTargetWidth !== "number" ||
      observations.minMeasuredTargetWidth < 44
    ) {
      errors.push(`${id}: measured target width must be at least 44`);
    }
    if (
      typeof observations.minMeasuredTargetHeight !== "number" ||
      observations.minMeasuredTargetHeight < 44
    ) {
      errors.push(`${id}: measured target height must be at least 44`);
    }
    const expectedObservedSection =
      expected.view === "overview" ? "appearance" : expected.selectedSection;
    if (observations.selectedSection !== expectedObservedSection) {
      errors.push(`${id}: active selected-section observation is incomplete`);
    }
    if (observations.requestedRootFontScale !== expected.rootFontScale) {
      errors.push(`${id}: requested root font scale observation is incomplete`);
    }
    const expectedRootFontSize = expected.rootFontScale * 16;
    if (
      typeof observations.observedRootFontSize !== "number" ||
      !Number.isFinite(observations.observedRootFontSize) ||
      Math.abs(observations.observedRootFontSize - expectedRootFontSize) > 0.01
    ) {
      errors.push(`${id}: observed root font size must be ${expectedRootFontSize}px`);
    }
    if (observations.groupedSurfaceContract !== true) {
      errors.push(`${id}: grouped-surface observation is incomplete`);
    }
    const expectedVisiblePanelCount =
      expected.view === "overview"
        ? 0
        : expected.selectedSection === "sound" || expected.selectedSection === "privacy"
          ? 1
          : 2;
    if (observations.visiblePanelCount !== expectedVisiblePanelCount) {
      errors.push(`${id}: visible panel count must be ${expectedVisiblePanelCount}`);
    }
    if (observations.visibleGroupCount !== expectedVisiblePanelCount) {
      errors.push(
        `${id}: visible settings-group count must equal the ${expectedVisiblePanelCount} visible panels`
      );
    }
    if (observations.focusClipRisk !== false) {
      errors.push(`${id}: focus clipping observation is incomplete`);
    }
    if (observations.captureCoverage !== "INITIAL_VIEWPORT_ONLY") {
      errors.push(`${id}: capture coverage must be INITIAL_VIEWPORT_ONLY`);
    }
    if (
      typeof observations.documentScrollHeight !== "number" ||
      !Number.isFinite(observations.documentScrollHeight) ||
      observations.documentScrollHeight < expected.viewport.height
    ) {
      errors.push(
        `${id}: document scroll height must be positive and at least the viewport height`
      );
    }

    const germanHeadingKeys = [
      "germanHeadingNormalizedText",
      "germanHeadingHyphens",
      "germanHeadingSoftHyphenOffset",
      "germanHeadingSoftHyphenGlyphWidth",
      "germanHeadingRenderedBreakOffset",
      "germanHeadingRenderedLineCount",
      "germanHeadingFirstLineCharacterCount",
      "germanHeadingLastLineCharacterCount",
      "germanHeadingUsesAuthoredBreak",
      "germanHeadingEmergencyTailAbsent",
      "germanHeadingOverflowPx",
    ];
    if (id === "T11-01-320-de-paper-text-200-overview") {
      if (observations.germanHeadingNormalizedText !== "Einstellungen") {
        errors.push(`${id}: normalized German heading must be Einstellungen`);
      }
      if (observations.germanHeadingHyphens !== "manual") {
        errors.push(`${id}: German heading must use manual hyphenation`);
      }
      if (observations.germanHeadingSoftHyphenOffset !== 3) {
        errors.push(`${id}: translator-authored soft-hyphen offset must be 3`);
      }
      if (
        typeof observations.germanHeadingSoftHyphenGlyphWidth !== "number" ||
        !Number.isFinite(observations.germanHeadingSoftHyphenGlyphWidth) ||
        observations.germanHeadingSoftHyphenGlyphWidth <= 0
      ) {
        errors.push(`${id}: soft-hyphen glyph must be rendered`);
      }
      if (
        observations.germanHeadingRenderedBreakOffset !== observations.germanHeadingSoftHyphenOffset
      ) {
        errors.push(`${id}: rendered break must match the authored soft-hyphen offset`);
      }
      if (observations.germanHeadingRenderedLineCount !== 2) {
        errors.push(`${id}: German heading must render on exactly two lines`);
      }
      if (
        observations.germanHeadingFirstLineCharacterCount !==
        observations.germanHeadingSoftHyphenOffset
      ) {
        errors.push(`${id}: first rendered line must end at the authored break`);
      }
      if (
        observations.germanHeadingLastLineCharacterCount !== 10 ||
        observations.germanHeadingLastLineCharacterCount <= 2
      ) {
        errors.push(`${id}: last rendered line must not be a two-character emergency tail`);
      }
      if (observations.germanHeadingUsesAuthoredBreak !== true) {
        errors.push(`${id}: authored German break opportunity is not in use`);
      }
      if (observations.germanHeadingEmergencyTailAbsent !== true) {
        errors.push(`${id}: German heading emergency-tail evidence is incomplete`);
      }
      if (observations.germanHeadingOverflowPx !== 0) {
        errors.push(`${id}: German heading horizontal overflow must be zero`);
      }
    } else if (germanHeadingKeys.some((key) => observations[key] !== null)) {
      errors.push(`${id}: German 200% heading evidence is not applicable`);
    }

    const expectedLayoutFlags =
      expected.view === "overview"
        ? [true, false, false, false]
        : expected.view === "detail"
          ? [false, true, false, false]
          : [false, false, true, true];
    const actualLayoutFlags = [
      observations.compactOverviewVisible,
      observations.compactDetailVisible,
      observations.desktopListVisible,
      observations.desktopDetailVisible,
    ];
    if (actualLayoutFlags.some((value, index) => value !== expectedLayoutFlags[index])) {
      errors.push(`${id}: layout visibility flags are contradictory or incomplete`);
    }
    if (expected.view === "list-detail" && observations.desktopColumnsNonOverlapping !== true) {
      errors.push(`${id}: desktop column geometry observation is incomplete`);
    }
    const profileGeometryKeys = [
      "profileNameRowWidth",
      "profileNameInputWidth",
      "profileNameSaveActionWidth",
      "profileNameInputWidthShare",
    ];
    if (id === "T11-11-1536-de-ink-forced-colors-list-detail") {
      const profileNameRowWidth = observations.profileNameRowWidth;
      const profileNameInputWidth = observations.profileNameInputWidth;
      const profileNameSaveActionWidth = observations.profileNameSaveActionWidth;
      const profileNameInputWidthShare = observations.profileNameInputWidthShare;
      const profileGeometryValues = [
        profileNameRowWidth,
        profileNameInputWidth,
        profileNameSaveActionWidth,
        profileNameInputWidthShare,
      ];
      if (
        profileGeometryValues.some(
          (value) => typeof value !== "number" || !Number.isFinite(value) || value <= 0
        )
      ) {
        errors.push(`${id}: profile name row geometry observation is incomplete`);
      } else {
        if (profileNameInputWidth <= profileNameSaveActionWidth) {
          errors.push(`${id}: profile name input must be wider than its inline save action`);
        }
        const measuredShare = profileNameInputWidth / profileNameRowWidth;
        if (measuredShare < 0.5) {
          errors.push(`${id}: profile name input must occupy at least half of its row`);
        }
        if (Math.abs(profileNameInputWidthShare - measuredShare) > 0.002) {
          errors.push(`${id}: profile name input width share is inconsistent`);
        }
      }
    } else if (profileGeometryKeys.some((key) => observations[key] !== null)) {
      errors.push(`${id}: profile name row geometry is not applicable`);
    }
    if (
      expected.focusEvidence &&
      (observations.focusVisible !== true || observations.focusIndicatorVisible !== true)
    ) {
      errors.push(`${id}: focus-visible evidence is incomplete`);
    }
    if (id === "T11-02-360-en-ink-keyboard-detail" && observations.focusRestored !== true) {
      errors.push(`${id}: focus restoration evidence is incomplete`);
    }
    if (
      expected.hoverEvidence &&
      (typeof observations.hoveredTarget !== "string" ||
        observations.hoveredTarget.length === 0 ||
        observations.hoverVisualChange !== true)
    ) {
      errors.push(`${id}: pointer-hover evidence is incomplete`);
    }
    if (expected.highContrast && observations.themeContrast !== "high") {
      errors.push(`${id}: high-contrast evidence is incomplete`);
    }
    if (expected.forcedColors && observations.forcedColorsActive !== true) {
      errors.push(`${id}: forced-colors evidence is incomplete`);
    }
    if (
      expected.offline &&
      (observations.navigatorOnLine !== false || observations.offlineBannerVisible !== true)
    ) {
      errors.push(`${id}: loaded-page offline evidence is incomplete`);
    }
    if (expected.rootFontScale === 2 && observations.browserZoomControlVerified !== false) {
      errors.push(`${id}: 200% text evidence must not claim browser chrome zoom proof`);
    }
  }

  for (const expected of TASK11_SCENARIOS) {
    if (!observedIds.has(expected.id)) errors.push(`missing expected capture: ${expected.id}`);
  }
  if (captures.length !== TASK11_SCENARIOS.length) {
    errors.push(
      `capture count must be exactly ${TASK11_SCENARIOS.length}; received ${captures.length}`
    );
  }
  const captureInventory = inventoryRegularFiles({
    repositoryRoot,
    relativeRoot: TASK11_OUTPUT_ROOT,
    label: "capture evidence inventory",
    errors,
  });
  if (captureInventory) {
    const allowedPaths = new Set([
      ...TASK11_SCENARIOS.map((scenario) => `${TASK11_OUTPUT_ROOT}/${scenario.id}.png`),
      TASK11_BUILD_MANIFEST_EVIDENCE_PATH,
      `${TASK11_OUTPUT_ROOT}/runtime-capture.json`,
    ]);
    const orphanPaths = captureInventory
      .map((entry) => entry.path)
      .filter((entryPath) => !allowedPaths.has(entryPath));
    if (orphanPaths.length > 0) {
      errors.push(`capture evidence inventory contains orphan entries: ${orphanPaths.join(", ")}`);
    }
    const actualPngPaths = new Set(
      captureInventory.map((entry) => entry.path).filter((entryPath) => entryPath.endsWith(".png"))
    );
    const missingPngPaths = TASK11_SCENARIOS.map(
      (scenario) => `${TASK11_OUTPUT_ROOT}/${scenario.id}.png`
    ).filter((entryPath) => !actualPngPaths.has(entryPath));
    if (missingPngPaths.length > 0) {
      errors.push(`capture evidence inventory is missing entries: ${missingPngPaths.join(", ")}`);
    }
  }
  return errors;
}

export function validateTask11RuntimeReceipt({ receipt, repositoryRoot } = {}) {
  const errors = [];
  if (!receipt || typeof receipt !== "object") return ["runtime receipt must be an object"];
  if (receipt.schemaVersion !== 2) errors.push("runtime receipt schemaVersion must be 2");
  if (receipt.task !== "Task 11 Settings bounded factor matrix") {
    errors.push("runtime receipt task identity is invalid");
  }
  if (receipt.subjectHead !== TASK11_SUBJECT_HEAD) {
    errors.push("runtime receipt subject HEAD is invalid");
  }
  if (!isCanonicalUtcTimestamp(receipt.runStartedAtUtc)) {
    errors.push("runtime receipt runStartedAtUtc must be canonical UTC");
  }
  if (!isCanonicalUtcTimestamp(receipt.runCompletedAtUtc)) {
    errors.push("runtime receipt runCompletedAtUtc must be canonical UTC");
  }
  if (
    isCanonicalUtcTimestamp(receipt.runStartedAtUtc) &&
    isCanonicalUtcTimestamp(receipt.runCompletedAtUtc) &&
    Date.parse(receipt.runCompletedAtUtc) < Date.parse(receipt.runStartedAtUtc)
  ) {
    errors.push("runtime receipt runCompletedAtUtc precedes runStartedAtUtc");
  }
  if (receipt.fixedClock !== TASK11_FIXED_CLOCK) {
    errors.push("runtime receipt fixed clock is invalid");
  }
  if (receipt.outputRoot !== TASK11_OUTPUT_ROOT) {
    errors.push(`runtime receipt output root must be ${TASK11_OUTPUT_ROOT}`);
  }

  const runner = receipt.runner;
  if (
    runner?.id !== TASK11_CANONICAL_RUNNER_ID ||
    runner?.os !== "darwin" ||
    runner?.osRelease !== "25.5.0" ||
    runner?.architecture !== "arm64" ||
    runner?.nodeVersion !== "v22.22.0" ||
    runner?.playwrightVersion !== "1.59.1" ||
    runner?.browser !== "chromium" ||
    runner?.browserVersion !== "147.0.7727.15" ||
    runner?.scope !== "LOCAL_DIAGNOSTIC_ONLY" ||
    runner?.approvalBaseline !== false
  ) {
    errors.push("runtime receipt runner must be local diagnostic only");
  }

  const productionBuild = receipt.productionBuild;
  const buildReceiptSourcePath = normalizeRelativePath(productionBuild?.sourcePath);
  if (buildReceiptSourcePath !== "dist/.zenflow-ratchet-production-web-manifest.json") {
    errors.push("runtime receipt production build source path is invalid");
  }
  const buildReceiptEvidencePath = normalizeRelativePath(productionBuild?.evidencePath);
  if (buildReceiptEvidencePath !== TASK11_BUILD_MANIFEST_EVIDENCE_PATH) {
    errors.push("runtime receipt immutable production build evidence path is invalid");
  }
  const validatedBuild = validateProductionBuildReceipt({
    repositoryRoot,
    relativePath: buildReceiptEvidencePath,
    errors,
    label: "runtime receipt immutable production build",
    verifyArtifactsOnDisk: false,
  });
  const buildReceipt = validatedBuild?.receipt ?? null;
  if (buildReceipt) {
    if (productionBuild.receiptSha256 !== validatedBuild.receiptSha256) {
      errors.push("production build receipt sha256 does not match");
    }
    if (productionBuild.buildId !== buildReceipt.buildId) {
      errors.push("production build ID does not match");
    }
    if (productionBuild.artifactsSha256 !== buildReceipt.artifactsSha256) {
      errors.push("production build artifacts hash does not match");
    }
    if (productionBuild.buildInputsSha256 !== buildReceipt.buildInputsSha256) {
      errors.push("production build inputs hash does not match");
    }
  }

  const servedDist = receipt.servedDist;
  if (servedDist?.root !== "dist") {
    errors.push("served dist root must be exactly dist");
  }
  if (servedDist?.stableAcrossRun !== true) {
    errors.push("served dist must be proven stable across the run");
  }
  const declaredDistInventory = Array.isArray(servedDist?.files) ? servedDist.files : [];
  const normalizedDistInventory = [];
  for (const [index, entry] of declaredDistInventory.entries()) {
    const normalizedPath = normalizeRelativePath(entry?.path);
    if (
      normalizedPath !== entry?.path ||
      !normalizedPath.startsWith("dist/") ||
      normalizedPath.split("/").includes("..")
    ) {
      errors.push(`served dist inventory path is invalid at files[${index}]`);
      continue;
    }
    if (!Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 0) {
      errors.push(`served dist inventory size is invalid: ${normalizedPath}`);
    }
    if (!SHA256_PATTERN.test(String(entry.sha256 ?? ""))) {
      errors.push(`served dist inventory hash is invalid: ${normalizedPath}`);
    }
    normalizedDistInventory.push({
      path: normalizedPath,
      sizeBytes: entry.sizeBytes,
      sha256: entry.sha256,
    });
  }
  const declaredDistPaths = normalizedDistInventory.map((entry) => entry.path);
  const sortedDistPaths = [...declaredDistPaths].sort((left, right) => left.localeCompare(right));
  if (new Set(declaredDistPaths).size !== declaredDistPaths.length) {
    errors.push("served dist inventory contains duplicate paths");
  }
  if (JSON.stringify(declaredDistPaths) !== JSON.stringify(sortedDistPaths)) {
    errors.push("served dist inventory must be sorted by path");
  }
  if (
    !SHA256_PATTERN.test(String(servedDist?.inventorySha256 ?? "")) ||
    servedDist.inventorySha256 !== artifactSnapshotSha256(normalizedDistInventory)
  ) {
    errors.push("served dist inventory sha256 does not match declared files");
  }
  if (buildReceipt && validatedBuild && Array.isArray(buildReceipt.files)) {
    const declaredDistByPath = new Map(normalizedDistInventory.map((entry) => [entry.path, entry]));
    const expectedManifestEntry = {
      path: buildReceiptSourcePath,
      sizeBytes: validatedBuild.receiptSizeBytes,
      sha256: validatedBuild.receiptSha256,
    };
    const declaredManifestEntry = declaredDistByPath.get(buildReceiptSourcePath);
    if (
      declaredManifestEntry?.sizeBytes !== expectedManifestEntry.sizeBytes ||
      declaredManifestEntry?.sha256 !== expectedManifestEntry.sha256
    ) {
      errors.push("served dist inventory does not contain the immutable build manifest");
    }
    for (const file of buildReceipt.files) {
      const declared = declaredDistByPath.get(`dist/${file.path}`);
      if (declared?.sizeBytes !== file.sizeBytes || declared?.sha256 !== file.sha256) {
        errors.push(`served dist inventory does not match immutable build artifact: ${file.path}`);
      }
    }
  }

  const sources = Array.isArray(receipt.evidenceSources) ? receipt.evidenceSources : [];
  const sourceByPath = new Map(sources.map((source) => [source?.path, source]));
  for (const expectedPath of EXPECTED_SOURCE_PATHS) {
    const source = sourceByPath.get(expectedPath);
    if (!source) {
      errors.push(`missing evidence source: ${expectedPath}`);
      continue;
    }
    inspectRegularEvidenceFile({
      repositoryRoot,
      relativePath: expectedPath,
      expectedSize: source.sizeBytes,
      expectedSha256: source.sha256,
      label: `${expectedPath}: evidence source`,
      errors,
    });
  }
  if (sources.length !== EXPECTED_SOURCE_PATHS.length) {
    errors.push(`evidence source count must be exactly ${EXPECTED_SOURCE_PATHS.length}`);
  }

  errors.push(
    ...validateTask11CaptureSet({
      captures: receipt.captures,
      outputRoot: receipt.outputRoot,
      repositoryRoot,
      buildReceiptPath: buildReceiptEvidencePath,
    })
  );

  if ("diffPolicy" in receipt) {
    errors.push("legacy visual diff policy is unsupported without an approved reference baseline");
  }
  const candidateBaselinePolicy = receipt.candidateBaselinePolicy;
  if (candidateBaselinePolicy?.approvedReferenceAvailable !== false) {
    errors.push("approved visual reference must remain unavailable");
  }
  if (candidateBaselinePolicy?.automaticBaselineUpdate !== false) {
    errors.push("automatic baseline updates must be disabled");
  }
  if (candidateBaselinePolicy?.sameRunExactRepeatRequired !== true) {
    errors.push("same-run exact repeat must be required");
  }
  if (candidateBaselinePolicy?.sameRunAllowedByteMismatch !== 0) {
    errors.push("same-run byte mismatch must be exactly zero");
  }
  if (candidateBaselinePolicy?.requiredDisposition !== "missing-state") {
    errors.push("candidate baseline disposition must be missing-state");
  }
  if (receipt.negativeControls?.visibleMutationRejected !== true) {
    errors.push("visible-mutation negative control must reject a changed capture");
  }

  const unverified = Array.isArray(receipt.unverified) ? receipt.unverified : [];
  const unverifiedById = new Map(unverified.map((entry) => [entry?.id, entry]));
  const missingUnverified = EXPECTED_UNVERIFIED_IDS.filter((id) => {
    const entry = unverifiedById.get(id);
    return (
      !entry ||
      typeof entry.blocker !== "string" ||
      entry.blocker.trim().length === 0 ||
      typeof entry.evidenceNeeded !== "string" ||
      entry.evidenceNeeded.trim().length === 0
    );
  });
  if (missingUnverified.length > 0 || unverified.length !== EXPECTED_UNVERIFIED_IDS.length) {
    errors.push(
      `UNVERIFIED ledger is incomplete${
        missingUnverified.length > 0 ? `: ${missingUnverified.join(", ")}` : ""
      }`
    );
  }
  return errors;
}
