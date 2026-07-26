import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

export const SOURCE_REGISTRY_RELATIVE_PATH = "config/product-coherence-source-registry.json";
export const SOURCE_REGISTRY_LIMITS = Object.freeze({
  maxBytes: 256 * 1024,
  maxSourceAgeDays: 30,
  maxArrayItems: 8,
  maxTextLength: 2_000,
});

export const REQUIRED_SOURCE_IDS = Object.freeze([
  "iso-iec-25010-2023",
  "iso-iec-25019-2023",
  "iso-9241-11-2018",
  "iso-9241-110-2020",
  "iso-9241-210-2019",
  "w3c-wcag-22",
  "w3c-coga-usable-2021",
  "w3c-involving-users",
  "apple-hig-settings",
  "apple-hig-notifications",
  "android-notification-channels",
  "android-post-notifications-permission",
  "nist-ai-rmf-1-0",
  "nist-ai-rmf-revision-status",
  "nist-ai-rmf-genai-profile",
  "owasp-llm-top-10-2025",
  "apple-app-review-guidelines",
  "google-play-health-declaration",
  "google-play-ai-generated-content-policy",
]);

const APPROVED_SOURCE_URLS = Object.freeze({
  "iso-iec-25010-2023": "https://www.iso.org/standard/78176.html",
  "iso-iec-25019-2023": "https://www.iso.org/standard/78177.html",
  "iso-9241-11-2018": "https://www.iso.org/standard/63500.html",
  "iso-9241-110-2020": "https://www.iso.org/standard/75258.html",
  "iso-9241-210-2019": "https://www.iso.org/standard/77520.html",
  "w3c-wcag-22": "https://www.w3.org/TR/WCAG22/",
  "w3c-coga-usable-2021": "https://www.w3.org/TR/coga-usable/",
  "w3c-involving-users": "https://www.w3.org/WAI/planning/involving-users/",
  "apple-hig-settings": "https://developer.apple.com/design/human-interface-guidelines/settings",
  "apple-hig-notifications":
    "https://developer.apple.com/design/human-interface-guidelines/notifications/",
  "android-notification-channels":
    "https://developer.android.com/develop/ui/compose/notifications/channels",
  "android-post-notifications-permission":
    "https://developer.android.com/develop/ui/compose/notifications/notification-permission",
  "nist-ai-rmf-1-0": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf",
  "nist-ai-rmf-revision-status": "https://www.nist.gov/itl/ai-risk-management-framework",
  "nist-ai-rmf-genai-profile": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf",
  "owasp-llm-top-10-2025": "https://genai.owasp.org/llm-top-10/",
  "apple-app-review-guidelines": "https://developer.apple.com/app-store/review/guidelines/",
  "google-play-health-declaration":
    "https://support.google.com/googleplay/android-developer/answer/14738291?hl=en",
  "google-play-ai-generated-content-policy":
    "https://support.google.com/googleplay/android-developer/answer/13985936?hl=en",
});

const OFFICIAL_HOSTS = new Set([
  "www.iso.org",
  "www.w3.org",
  "developer.apple.com",
  "developer.android.com",
  "www.nist.gov",
  "nvlpubs.nist.gov",
  "genai.owasp.org",
  "support.google.com",
]);
const CLASSIFICATIONS = new Set(["normative", "informative", "metadata-only"]);
const CONTENT_ACCESS_LEVELS = new Set(["FULL_PUBLIC", "PUBLIC_GUIDANCE", "METADATA_ONLY"]);
const CONFIRMATION_STATES = new Set([
  "PUBLISHED",
  "PUBLISHED_AND_CONFIRMED",
  "W3C_RECOMMENDATION",
  "W3C_WORKING_GROUP_NOTE",
  "CURRENT_OFFICIAL_GUIDANCE",
  "REVISION_IN_PROGRESS",
  "CURRENT_PROJECT",
  "CURRENT_STORE_POLICY",
]);
const TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "registryId",
  "registryVersion",
  "checkedAt",
  "sources",
]);
const SOURCE_FIELDS = new Set([
  "id",
  "authority",
  "publisher",
  "title",
  "version",
  "edition",
  "status",
  "url",
  "retrievedAt",
  "checkedAt",
  "confirmation",
  "classification",
  "contentAccess",
  "applicability",
  "tradeoffsAndLimits",
  "doesNotProve",
  "sourceMetadataSha256",
]);
const CONFIRMATION_FIELDS = new Set(["state", "asOf", "basis"]);
const REQUIRED_DISCLAIMER =
  "This source record cannot prove ZenFlow local behavior, conformance, human acceptance, legal compliance, or Apple/Google store status.";
const ISO_WEB_METADATA_LIMIT =
  "Only official ISO catalogue web metadata was reviewed; the copyrighted full text and numbered clauses were not accessed or reproduced.";

export function validateSourceRegistry(registry, { now = new Date() } = {}) {
  assertPlainObject(registry, "source registry");
  assertExactFields(registry, TOP_LEVEL_FIELDS, "source registry");
  assertExactString(registry.schemaVersion, "1.0.0", "source registry schemaVersion");
  assertExactString(
    registry.registryId,
    "zenflow-product-coherence-authoritative-sources",
    "source registry registryId"
  );
  assertText(registry.registryVersion, "source registry registryVersion");
  const registryCheckedAt = assertFreshDate(registry.checkedAt, "source registry checkedAt", now);
  if (!registry.registryVersion.startsWith(`${registry.checkedAt}.`)) {
    throw new Error("source registry registryVersion must be versioned from checkedAt");
  }
  if (!Array.isArray(registry.sources) || registry.sources.length !== REQUIRED_SOURCE_IDS.length) {
    throw new Error(`source registry must contain exactly ${REQUIRED_SOURCE_IDS.length} sources`);
  }

  const seenIds = new Set();
  const seenUrls = new Set();
  for (const [index, source] of registry.sources.entries()) {
    const label = `source registry sources[${index}]`;
    assertPlainObject(source, label);
    assertExactFields(source, SOURCE_FIELDS, label);
    for (const field of [
      "id",
      "authority",
      "publisher",
      "title",
      "version",
      "edition",
      "status",
      "url",
      "doesNotProve",
      "sourceMetadataSha256",
    ]) {
      assertText(source[field], `${label}.${field}`);
    }
    if (seenIds.has(source.id)) throw new Error(`duplicate source id: ${source.id}`);
    seenIds.add(source.id);
    if (!(source.id in APPROVED_SOURCE_URLS)) {
      throw new Error(`unapproved source id: ${source.id}`);
    }

    const parsedUrl = assertOfficialUrl(source.url, `${label}.url`);
    if (seenUrls.has(parsedUrl.href)) throw new Error(`duplicate source url: ${parsedUrl.href}`);
    seenUrls.add(parsedUrl.href);
    if (source.url !== APPROVED_SOURCE_URLS[source.id]) {
      throw new Error(`${source.id} must use its exact approved URL`);
    }

    assertStrictDate(source.retrievedAt, `${source.id}.retrievedAt`, now);
    const checkedAt = assertFreshDate(source.checkedAt, `${source.id}.checkedAt`, now);
    if (checkedAt !== registryCheckedAt || source.checkedAt !== registry.checkedAt) {
      throw new Error(`${source.id}.checkedAt must match source registry checkedAt`);
    }
    if (dateToUtc(source.retrievedAt) > checkedAt) {
      throw new Error(`${source.id}.retrievedAt cannot be after checkedAt`);
    }

    assertPlainObject(source.confirmation, `${source.id}.confirmation`);
    assertExactFields(source.confirmation, CONFIRMATION_FIELDS, `${source.id}.confirmation`);
    if (!CONFIRMATION_STATES.has(source.confirmation.state)) {
      throw new Error(`${source.id}.confirmation.state is not allowed`);
    }
    assertText(source.confirmation.basis, `${source.id}.confirmation.basis`);
    assertStrictDate(source.confirmation.asOf, `${source.id}.confirmation.asOf`, now);
    if (source.confirmation.asOf !== source.checkedAt) {
      throw new Error(`${source.id}.confirmation.asOf must match checkedAt`);
    }
    if (!CLASSIFICATIONS.has(source.classification)) {
      throw new Error(`${source.id}.classification is not allowed`);
    }
    if (!CONTENT_ACCESS_LEVELS.has(source.contentAccess)) {
      throw new Error(`${source.id}.contentAccess is not allowed`);
    }
    assertTextArray(source.applicability, `${source.id}.applicability`);
    assertTextArray(source.tradeoffsAndLimits, `${source.id}.tradeoffsAndLimits`);
    assertExactString(source.doesNotProve, REQUIRED_DISCLAIMER, `${source.id}.doesNotProve`);

    enforceSourceSpecificBoundaries(source);
    if (/\bPASS\b/.test(narrativeText(source))) {
      throw new Error(`${source.id} contains a forbidden generic PASS claim`);
    }
    if (containsLocalProofClaim(source.applicability.join(" "))) {
      throw new Error(`${source.id} contains local proof or conformance laundering`);
    }

    if (!/^[a-f0-9]{64}$/.test(source.sourceMetadataSha256)) {
      throw new Error(`${source.id}.sourceMetadataSha256 must be a lowercase SHA-256`);
    }
    const expectedSourceHash = sourceMetadataSha256(source);
    if (source.sourceMetadataSha256 !== expectedSourceHash) {
      throw new Error(`${source.id} source metadata SHA256 mismatch`);
    }
  }

  for (const requiredId of REQUIRED_SOURCE_IDS) {
    if (!seenIds.has(requiredId)) throw new Error(`required source is missing: ${requiredId}`);
  }

  return { registry, digest: canonicalSha256(registry) };
}

export async function loadSourceRegistry({
  repositoryRoot,
  registryPath = SOURCE_REGISTRY_RELATIVE_PATH,
  now = new Date(),
  testingHooks = {},
} = {}) {
  assertText(repositoryRoot, "repositoryRoot");
  const rootInput = path.resolve(repositoryRoot);
  const rootStat = await lstat(rootInput);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("source registry repository root must be a real directory, not a symlink");
  }
  const root = await realpath(rootInput);
  const segments = safeRelativeSegments(registryPath);
  const absolute = path.resolve(root, ...segments);
  assertBelowRoot(root, absolute, "source registry path");
  await assertRealAncestors(root, segments.slice(0, -1));

  const before = await lstat(absolute);
  assertRegularBoundedFile(before, absolute);
  const realBefore = await realpath(absolute);
  assertBelowRoot(root, realBefore, "source registry real path");
  if (realBefore !== absolute) throw new Error("source registry path resolution changed");

  const noFollow = typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0;
  const handle = await open(absolute, fsConstants.O_RDONLY | noFollow);
  try {
    const descriptorBefore = await handle.stat();
    assertRegularBoundedFile(descriptorBefore, absolute);
    if (!sameFileIdentity(before, descriptorBefore)) {
      throw new Error("source registry changed before no-follow open completed");
    }

    await testingHooks.afterFileOpen?.(absolute);
    await assertPathStillMatches({ absolute, root, expected: descriptorBefore });
    const bytes = await readBounded(handle, SOURCE_REGISTRY_LIMITS.maxBytes);
    const descriptorAfter = await handle.stat();
    if (
      !sameFileIdentity(descriptorBefore, descriptorAfter) ||
      descriptorAfter.size !== bytes.length
    ) {
      throw new Error("source registry changed while being read");
    }
    await assertPathStillMatches({ absolute, root, expected: descriptorAfter });

    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("source registry must contain valid UTF-8");
    }
    let registry;
    try {
      registry = JSON.parse(text);
    } catch (error) {
      throw new Error(`source registry contains invalid JSON: ${error.message}`);
    }
    const validated = validateSourceRegistry(registry, { now });
    return { ...validated, registryPath: absolute };
  } finally {
    await handle.close();
  }
}

export function sourceMetadataSha256(source) {
  const projection = {
    id: source.id,
    authority: source.authority,
    publisher: source.publisher,
    title: source.title,
    version: source.version,
    edition: source.edition,
    status: source.status,
    url: source.url,
    retrievedAt: source.retrievedAt,
    checkedAt: source.checkedAt,
    confirmation: source.confirmation,
  };
  return canonicalSha256(projection);
}

export function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function enforceSourceSpecificBoundaries(source) {
  if (source.id.startsWith("iso-")) {
    if (source.classification !== "metadata-only" || source.contentAccess !== "METADATA_ONLY") {
      throw new Error(`${source.id}: ISO sources must remain metadata-only`);
    }
    if (!source.tradeoffsAndLimits.includes(ISO_WEB_METADATA_LIMIT)) {
      throw new Error(`${source.id}: ISO web-metadata limitation is required`);
    }
  }
  if (source.id === "w3c-coga-usable-2021") {
    if (source.classification !== "informative") {
      throw new Error("COGA usable must remain informative");
    }
    if (!/not required for WCAG conformance/i.test(source.tradeoffsAndLimits.join(" "))) {
      throw new Error("COGA usable must state that it is not required for WCAG conformance");
    }
  }
  if (source.id.startsWith("nist-") && !/\bvoluntary\b/i.test(narrativeText(source))) {
    throw new Error(`${source.id}: NIST AI RMF applicability must remain voluntary`);
  }
}

function containsLocalProofClaim(value) {
  return (
    /\b(?:proves?|establishes?|demonstrates?|certifies?)\b.{0,100}\bZenFlow\b/i.test(value) ||
    /\bZenFlow\b.{0,100}\b(?:conforms?|conformant|complies|compliant|certified|safe)\b/i.test(value)
  );
}

function narrativeText(source) {
  return [...source.applicability, ...source.tradeoffsAndLimits, source.doesNotProve].join(" ");
}

function assertOfficialUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    !OFFICIAL_HOSTS.has(parsed.hostname)
  ) {
    throw new Error(
      `${label} must use an allowlisted HTTPS official host without credentials or fragment`
    );
  }
  return parsed;
}

function assertFreshDate(value, label, now) {
  const date = assertStrictDate(value, label, now);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ageDays = Math.floor((today - date) / 86_400_000);
  if (ageDays > SOURCE_REGISTRY_LIMITS.maxSourceAgeDays) {
    throw new Error(`${label} is stale; refresh authoritative source metadata`);
  }
  return date;
}

function assertStrictDate(value, label, now) {
  assertText(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD`);
  const date = dateToUtc(value);
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a valid calendar date`);
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("source registry validation clock must be a valid Date");
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (date > today) throw new Error(`${label} cannot be in the future`);
  return date;
}

function dateToUtc(value) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function assertTextArray(value, label) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > SOURCE_REGISTRY_LIMITS.maxArrayItems
  ) {
    throw new Error(`${label} must be a non-empty bounded array`);
  }
  for (const [index, item] of value.entries()) assertText(item, `${label}[${index}]`);
}

function assertExactString(value, expected, label) {
  if (value !== expected) throw new Error(`${label} must equal ${JSON.stringify(expected)}`);
}

function assertText(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > SOURCE_REGISTRY_LIMITS.maxTextLength
  ) {
    throw new Error(`${label} must be a non-empty trimmed bounded string`);
  }
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be a plain object`);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactFields(value, expected, label) {
  const keys = Object.keys(value);
  const unknown = keys.filter((key) => !expected.has(key));
  const missing = [...expected].filter((key) => !Object.hasOwn(value, key));
  if (unknown.length || missing.length) {
    throw new Error(
      `${label} must use exact fields; unknown fields: ${unknown.join(", ") || "none"}; missing fields: ${
        missing.join(", ") || "none"
      }`
    );
  }
}

function safeRelativeSegments(value) {
  assertText(value, "source registry path");
  if (value.includes("\0") || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw new Error("source registry path must be a safe repository-relative path");
  }
  const segments = value.replaceAll("\\", "/").split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("source registry path traversal is forbidden");
  }
  return segments;
}

async function assertRealAncestors(root, segments) {
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`source registry ancestor must be a real directory: ${segment}`);
    }
  }
}

function assertBelowRoot(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must remain below the repository root`);
  }
}

function assertRegularBoundedFile(stat, filePath) {
  if (stat.isSymbolicLink()) throw new Error(`source registry symlink is forbidden: ${filePath}`);
  if (!stat.isFile()) throw new Error(`source registry must be a regular file: ${filePath}`);
  if (stat.size <= 0 || stat.size > SOURCE_REGISTRY_LIMITS.maxBytes) {
    throw new Error(`source registry exceeds the allowed byte bounds: ${filePath}`);
  }
}

async function assertPathStillMatches({ absolute, root, expected }) {
  const current = await lstat(absolute);
  if (current.isSymbolicLink()) throw new Error("source registry symlink/path race detected");
  const currentRealPath = await realpath(absolute);
  assertBelowRoot(root, currentRealPath, "source registry real path");
  if (currentRealPath !== absolute || !sameFileIdentity(current, expected)) {
    throw new Error("source registry changed during validation");
  }
}

function sameFileIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs
  );
}

async function readBounded(handle, maxBytes) {
  const buffer = Buffer.alloc(maxBytes + 1);
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  if (offset > maxBytes) throw new Error("source registry exceeds the maximum byte limit");
  return buffer.subarray(0, offset);
}
