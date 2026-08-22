#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { brotliDecompressSync, gunzipSync } = require("node:zlib");
const { verifyNoDuplicateArtifacts } = require("./prune-duplicate-artifacts.cjs");
const { pwaInstallIconRevision } = require("../config/brand-logo-assets.json");

const DEFAULT_BASE_PREFIX = "/people-first-app/";
const REQUIRED_PWA_FILES = ["index.html", "manifest.webmanifest", "registerSW.js", "sw.js"];
const STAGED_RELEASE_ARTIFACT = "output/pages-artifact.nosync";
const INTERNAL_BUILD_MANIFEST_PATH = ".zenflow-ratchet-production-web-manifest.json";
const PREPARED_PAGES_MANIFEST_PATH = ".zenflow-prepared-pages-artifact-manifest.json";
const PREPARED_PAGES_MANIFEST_PRODUCER = "zenflow-prepared-pages-artifact-v1";
const PREPARED_PAGES_MANIFEST_HASH_DOMAIN = "zenflow-prepared-pages-artifact-files-v1\0";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REQUIRED_DIRECT_ROUTES = ["orb", "habits", "diary", "planning", "settings", "desktop"];
const ALLOWED_HIDDEN_ARTIFACT_PATHS = new Set([".nojekyll", ".well-known"]);
const ALLOWED_WELL_KNOWN_ARTIFACT_PATHS = new Set([".well-known/assetlinks.json"]);
const SECRET_LIKE_CONTENT_PATTERNS = [
  /ghp_[A-Za-z0-9_]+/i,
  /github_pat_[A-Za-z0-9_]+/i,
  /sk-[A-Za-z0-9_-]{20,}/i,
  /sbp_[A-Za-z0-9_-]+/i,
  /Authorization\s*:\s*["']?Bearer\s+[A-Za-z0-9._-]+/i,
  /(?:access|refresh)_token\s*[=:]\s*["']?(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|[A-Za-z0-9_-]{32,})/i,
  /BEGIN [A-Z ]*PRIVATE KEY/i,
];

// Workbox injectManifest revisions are MD5 content identifiers. This digest is
// used only for cache-manifest byte compatibility, never for security or trust.
function computeWorkboxRevision(content) {
  return createHash("md5").update(content).digest("hex");
}

function computeSha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function stableReadArtifactFile(filePath) {
  const before = fs.lstatSync(filePath, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error(`Prepared Pages artifact expected a regular file: ${filePath}`);
  }
  const bytes = fs.readFileSync(filePath);
  const after = fs.lstatSync(filePath, { bigint: true });
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mode !== after.mode ||
    before.mtimeNs !== after.mtimeNs ||
    before.ctimeNs !== after.ctimeNs ||
    BigInt(bytes.byteLength) !== after.size
  ) {
    throw new Error(`Prepared Pages artifact changed while being read: ${filePath}`);
  }
  return { bytes, stat: after };
}

function compareArtifactPaths(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function collectPreparedArtifactFiles(root, directory = root, records = []) {
  const safeDirectory =
    path.resolve(directory) === path.resolve(root)
      ? path.resolve(root)
      : resolveInsideRoot(root, path.relative(root, directory));
  const entries = fs
    .readdirSync(safeDirectory, { withFileTypes: true })
    .sort((left, right) => compareArtifactPaths(left.name, right.name));

  for (const entry of entries) {
    const entryPath = path.join(safeDirectory, entry.name);
    const relPath = toArtifactPath(root, entryPath);
    if (relPath === INTERNAL_BUILD_MANIFEST_PATH || relPath === PREPARED_PAGES_MANIFEST_PATH) {
      continue;
    }
    if (entry.isSymbolicLink()) {
      throw new Error(`Prepared Pages artifact contains a symlink: ${relPath}`);
    }
    if (entry.isDirectory()) {
      collectPreparedArtifactFiles(root, entryPath, records);
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Prepared Pages artifact contains an unsupported entry: ${relPath}`);
    }
    const { bytes, stat } = stableReadArtifactFile(entryPath);
    records.push({
      path: relPath,
      sizeBytes: bytes.byteLength,
      mode: Number(stat.mode & 0o111n) === 0 ? "100644" : "100755",
      sha256: computeSha256(bytes),
    });
  }

  return records.sort((left, right) => compareArtifactPaths(left.path, right.path));
}

function computePreparedArtifactFilesSha256(files) {
  const digest = createHash("sha256");
  digest.update(PREPARED_PAGES_MANIFEST_HASH_DOMAIN);
  for (const file of files) {
    const pathBytes = Buffer.from(file.path, "utf8");
    digest.update(`${pathBytes.byteLength}\0`);
    digest.update(pathBytes);
    digest.update(`\0${file.sizeBytes}\0${file.mode}\0${file.sha256}\n`);
  }
  return digest.digest("hex");
}

function buildPreparedPagesArtifactManifest(root) {
  const files = collectPreparedArtifactFiles(root);
  return {
    schemaVersion: 1,
    producer: PREPARED_PAGES_MANIFEST_PRODUCER,
    artifactRoot: "dist",
    hashAlgorithm: "sha256",
    fileCount: files.length,
    artifactFilesSha256: computePreparedArtifactFilesSha256(files),
    files,
  };
}

function writePreparedPagesArtifactManifest(root, options = {}) {
  const resolvedRoot = resolveArtifactRoot(root, options.allowedRoot || process.cwd());
  const manifest = buildPreparedPagesArtifactManifest(resolvedRoot);
  const manifestPath = resolveInsideRoot(resolvedRoot, PREPARED_PAGES_MANIFEST_PATH);
  const temporaryPath = `${manifestPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    fs.renameSync(temporaryPath, manifestPath);
    fs.chmodSync(manifestPath, 0o600);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
  return manifest;
}

function parsePreparedPagesArtifactManifest(bytes) {
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Prepared Pages artifact manifest is not valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Prepared Pages artifact manifest must be an object");
  }
  const expectedKeys = [
    "artifactFilesSha256",
    "artifactRoot",
    "fileCount",
    "files",
    "hashAlgorithm",
    "producer",
    "schemaVersion",
  ];
  const actualKeys = Object.keys(value).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error("Prepared Pages artifact manifest has an unexpected schema");
  }
  if (
    value.schemaVersion !== 1 ||
    value.producer !== PREPARED_PAGES_MANIFEST_PRODUCER ||
    value.artifactRoot !== "dist" ||
    value.hashAlgorithm !== "sha256" ||
    !Number.isSafeInteger(value.fileCount) ||
    value.fileCount < 1 ||
    !SHA256_PATTERN.test(value.artifactFilesSha256) ||
    !Array.isArray(value.files) ||
    value.files.length !== value.fileCount
  ) {
    throw new Error("Prepared Pages artifact manifest has an invalid header");
  }

  const files = value.files.map((file, index) => {
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      throw new Error(`Prepared Pages artifact manifest file ${index} is invalid`);
    }
    const keys = Object.keys(file).sort();
    if (JSON.stringify(keys) !== JSON.stringify(["mode", "path", "sha256", "sizeBytes"])) {
      throw new Error(`Prepared Pages artifact manifest file ${index} has an unexpected schema`);
    }
    if (
      typeof file.path !== "string" ||
      file.path.length === 0 ||
      path.isAbsolute(file.path) ||
      file.path.includes("\\") ||
      file.path.split("/").some((segment) => segment === "" || segment === "..") ||
      file.path === INTERNAL_BUILD_MANIFEST_PATH ||
      file.path === PREPARED_PAGES_MANIFEST_PATH ||
      !Number.isSafeInteger(file.sizeBytes) ||
      file.sizeBytes < 0 ||
      (file.mode !== "100644" && file.mode !== "100755") ||
      typeof file.sha256 !== "string" ||
      !SHA256_PATTERN.test(file.sha256)
    ) {
      throw new Error(`Prepared Pages artifact manifest file ${index} is invalid`);
    }
    return {
      path: file.path,
      sizeBytes: file.sizeBytes,
      mode: file.mode,
      sha256: file.sha256,
    };
  });

  const sortedPaths = files
    .map((file) => file.path)
    .slice()
    .sort(compareArtifactPaths);
  if (
    new Set(sortedPaths).size !== sortedPaths.length ||
    JSON.stringify(files.map((file) => file.path)) !== JSON.stringify(sortedPaths)
  ) {
    throw new Error("Prepared Pages artifact manifest files must be unique and byte-sorted");
  }
  const computedFingerprint = computePreparedArtifactFilesSha256(files);
  if (computedFingerprint !== value.artifactFilesSha256) {
    throw new Error("Prepared Pages artifact manifest fingerprint is invalid");
  }
  return { ...value, files };
}

function verifyArtifactFilesAgainstPreparedManifest(root, manifest) {
  const actualFiles = collectPreparedArtifactFiles(root);
  const expectedByPath = new Map(manifest.files.map((file) => [file.path, file]));
  const actualByPath = new Map(actualFiles.map((file) => [file.path, file]));
  const missing = manifest.files
    .filter((file) => !actualByPath.has(file.path))
    .map((file) => file.path);
  const unexpected = actualFiles
    .filter((file) => !expectedByPath.has(file.path))
    .map((file) => file.path);
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Prepared Pages artifact manifest does not match current artifact files` +
        `${missing.length > 0 ? `; missing: ${missing.slice(0, 10).join(", ")}` : ""}` +
        `${unexpected.length > 0 ? `; unexpected: ${unexpected.slice(0, 10).join(", ")}` : ""}`
    );
  }
  for (const actual of actualFiles) {
    const expected = expectedByPath.get(actual.path);
    if (actual.sizeBytes !== expected.sizeBytes || actual.sha256 !== expected.sha256) {
      throw new Error(`Prepared Pages artifact byte mismatch: ${actual.path}`);
    }
    if (actual.mode !== expected.mode) {
      throw new Error(`Prepared Pages artifact mode mismatch: ${actual.path}`);
    }
  }
  const actualFingerprint = computePreparedArtifactFilesSha256(actualFiles);
  if (actualFingerprint !== manifest.artifactFilesSha256) {
    throw new Error("Prepared Pages artifact aggregate fingerprint mismatch");
  }
  return { checkedFiles: actualFiles.length, artifactFilesSha256: actualFingerprint };
}

function verifyPreparedPagesArtifactManifest(root) {
  const manifestPath = resolveInsideRoot(root, PREPARED_PAGES_MANIFEST_PATH);
  if (!fs.existsSync(manifestPath)) {
    throw new Error("Prepared Pages artifact manifest is missing");
  }
  const { bytes } = stableReadArtifactFile(manifestPath);
  const manifest = parsePreparedPagesArtifactManifest(bytes);
  const result = verifyArtifactFilesAgainstPreparedManifest(root, manifest);
  return { manifest, ...result };
}

function extractServiceWorkerPrecacheEntries(source) {
  const entries = [];
  for (const objectMatch of source.matchAll(/\{[^{}]*\}/g)) {
    const objectLiteral = objectMatch[0];
    const urlMatch = objectLiteral.match(/(?:["']?url["']?)\s*:\s*(["'])(.*?)\1/);
    if (!urlMatch) continue;
    const revisionMatch = objectLiteral.match(/(?:["']?revision["']?)\s*:\s*(["'])(.*?)\1/);
    const nullRevision = /(?:["']?revision["']?)\s*:\s*null(?:\s*[,}])/.test(objectLiteral);
    entries.push({
      url: urlMatch[2],
      revision: revisionMatch ? revisionMatch[2] : nullRevision ? null : undefined,
    });
  }
  return entries;
}

function extractServiceWorkerPrecacheUrls(source) {
  return extractServiceWorkerPrecacheEntries(source).map((entry) => entry.url);
}

function normalizePrecacheUrl(url, basePrefix = DEFAULT_BASE_PREFIX) {
  let pathname = String(url || "")
    .split("#")[0]
    .split("?")[0];
  if (!pathname) return "index.html";

  if (/^[a-z][a-z0-9+.-]*:/i.test(pathname) || pathname.startsWith("//")) return null;

  if (pathname.startsWith(basePrefix)) {
    pathname = pathname.slice(basePrefix.length);
  } else if (pathname.startsWith("/")) {
    pathname = pathname.slice(1);
  }

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (pathname.includes("\\") || pathname.includes("\0")) return null;
  if (!pathname || pathname.endsWith("/")) pathname = `${pathname}index.html`;
  return pathname;
}

function canonicalPrecacheUrlIdentity(url, basePrefix = DEFAULT_BASE_PREFIX) {
  const withoutFragment = String(url || "").split("#")[0];
  const queryIndex = withoutFragment.indexOf("?");
  const pathname = queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : withoutFragment.slice(queryIndex);
  const normalizedPath = normalizePrecacheUrl(pathname, basePrefix);
  return normalizedPath === null ? null : `${normalizedPath}${query}`;
}

function resolveInsideRoot(root, relPath) {
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, relPath);
  const relative = path.relative(resolvedRoot, candidate);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Service worker precache path escapes artifact root: ${relPath}`);
  }
  return candidate;
}

function realpathForCandidate(candidate, mustExist = false) {
  let current = path.resolve(candidate);
  if (mustExist) return fs.realpathSync.native(current);

  const suffix = [];
  while (!fs.existsSync(current)) {
    suffix.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.join(fs.realpathSync.native(current), ...suffix);
}

function resolveArtifactRoot(root, allowedRoot = process.cwd()) {
  const resolvedAllowedRoot = realpathForCandidate(allowedRoot, true);
  const resolvedRoot = path.resolve(root);
  if (!fs.existsSync(resolvedRoot)) {
    throw new Error(`Release artifact root does not exist: ${resolvedRoot}`);
  }
  const realRoot = realpathForCandidate(resolvedRoot, true);
  const relative = path.relative(resolvedAllowedRoot, realRoot);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Release artifact root escapes allowed root ${resolvedAllowedRoot}: ${root}`);
  }
  return realRoot;
}

function verifyServiceWorkerPrecacheReferences(root) {
  const swPath = resolveInsideRoot(root, "sw.js");
  const source = fs.readFileSync(swPath, "utf8");
  const entries = extractServiceWorkerPrecacheEntries(source);
  const urls = entries.map((entry) => entry.url);
  if (urls.length === 0) {
    throw new Error("Service worker precache contains no URLs: sw.js");
  }

  const seenUrls = new Set();
  const duplicateUrls = new Set();
  for (const url of urls) {
    if (seenUrls.has(url)) duplicateUrls.add(url);
    seenUrls.add(url);
  }
  if (duplicateUrls.size > 0) {
    throw new Error(
      `Service worker precache contains duplicate URL(s): ${Array.from(duplicateUrls)
        .slice(0, 20)
        .join(", ")}`
    );
  }

  const normalizedEntries = entries.map((entry) => ({
    entry,
    normalized: normalizePrecacheUrl(entry.url),
  }));
  const unsupportedUrls = normalizedEntries
    .filter(({ normalized }) => normalized === null)
    .map(({ entry }) => entry.url);
  if (unsupportedUrls.length > 0) {
    throw new Error(
      `Service worker precache URL must be local: ${unsupportedUrls.slice(0, 20).join(", ")}`
    );
  }

  const firstUrlByIdentity = new Map();
  for (const url of urls) {
    const identity = canonicalPrecacheUrlIdentity(url);
    if (identity === null) continue;
    const firstUrl = firstUrlByIdentity.get(identity);
    if (firstUrl !== undefined) {
      throw new Error(
        `Service worker precache contains duplicate URL identity: ${identity} (${firstUrl}, ${url})`
      );
    }
    firstUrlByIdentity.set(identity, url);
  }

  const missing = [];
  const invalidTargets = [];
  for (const { entry, normalized } of normalizedEntries) {
    if (!normalized) continue;
    const filePath = resolveInsideRoot(root, normalized);
    if (!fs.existsSync(filePath)) {
      missing.push(`${entry.url} -> ${normalized}`);
      continue;
    }
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) invalidTargets.push(normalized);
  }

  if (missing.length > 0) {
    throw new Error(
      `Service worker precache references missing artifact(s): ${missing.length}\n - ${missing
        .slice(0, 20)
        .join("\n - ")}`
    );
  }
  if (invalidTargets.length > 0) {
    throw new Error(
      `Service worker precache target is not a regular file: ${invalidTargets.slice(0, 20).join(", ")}`
    );
  }

  const appShellEntries = entries.filter(
    (entry) => canonicalPrecacheUrlIdentity(entry.url) === "index.html"
  );
  if (appShellEntries.length !== 1) {
    throw new Error(
      `Service worker precache must contain exactly one app-shell index entry; found ${appShellEntries.length}`
    );
  }

  for (const entry of entries) {
    if (entry.revision === null) continue;
    const normalized = normalizePrecacheUrl(entry.url);
    if (!normalized) continue;
    if (typeof entry.revision !== "string" || !/^[a-f0-9]{32}$/i.test(entry.revision)) {
      throw new Error(`Service worker precache revision is not an MD5 digest: ${entry.url}`);
    }
    const filePath = resolveInsideRoot(root, normalized);
    const actualRevision = computeWorkboxRevision(fs.readFileSync(filePath));
    if (entry.revision.toLowerCase() !== actualRevision) {
      throw new Error(
        `Service worker precache revision mismatch: ${entry.url} (expected ${actualRevision}, found ${entry.revision})`
      );
    }
  }

  return { checkedPrecacheUrls: urls.length };
}

function verifyCompressedIndexRepresentations(root) {
  const indexBytes = fs.readFileSync(resolveInsideRoot(root, "index.html"));
  for (const [relativePath, decompress] of [
    ["index.html.gz", gunzipSync],
    ["index.html.br", brotliDecompressSync],
  ]) {
    const compressedPath = resolveInsideRoot(root, relativePath);
    if (!fs.existsSync(compressedPath)) continue;
    let expanded;
    try {
      expanded = decompress(fs.readFileSync(compressedPath));
    } catch {
      throw new Error(`Compressed index representation is invalid: ${relativePath}`);
    }
    if (!expanded.equals(indexBytes)) {
      throw new Error(`Compressed index representation does not match index.html: ${relativePath}`);
    }
  }
}

function verifyPreparedPagesEntrypoints(root) {
  const indexPath = resolveInsideRoot(root, "index.html");
  const indexBytes = fs.readFileSync(indexPath);
  const indexHtml = indexBytes.toString("utf8");
  const manifestLinks = (indexHtml.match(/<link\b[^>]*>/gi) ?? []).filter((tag) =>
    /\brel\s*=\s*["']manifest["']/i.test(tag)
  );
  const expectedManifestHref = `/people-first-app/manifest.webmanifest?v=${pwaInstallIconRevision}`;
  const exactManifestLink =
    manifestLinks.length === 1 &&
    new RegExp(
      `\\bhref\\s*=\\s*["']${expectedManifestHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
      "i"
    ).test(manifestLinks[0]);
  if (!exactManifestLink) {
    throw new Error(
      `Pages artifact index must contain exactly one cache-busted manifest link for ${pwaInstallIconRevision}`
    );
  }

  for (const route of REQUIRED_DIRECT_ROUTES) {
    const relativePath = `${route}/index.html`;
    const routePath = resolveInsideRoot(root, relativePath);
    if (!fs.existsSync(routePath)) {
      throw new Error(`Pages artifact is missing direct-route entrypoint: ${relativePath}`);
    }
    if (!fs.readFileSync(routePath).equals(indexBytes)) {
      throw new Error(
        `Pages artifact direct-route entrypoint does not match index.html: ${relativePath}`
      );
    }
  }
}

function verifyRequiredPwaFiles(root) {
  const missing = REQUIRED_PWA_FILES.filter(
    (relPath) => !fs.existsSync(resolveInsideRoot(root, relPath))
  );
  if (missing.length > 0) {
    throw new Error(`Release artifact missing required PWA file(s): ${missing.join(", ")}`);
  }
  return { missing };
}

function findSymlinks(root, directory = root, symlinks = []) {
  const safeDirectory =
    path.resolve(directory) === path.resolve(root)
      ? path.resolve(root)
      : resolveInsideRoot(root, path.relative(root, directory));
  for (const entry of fs.readdirSync(safeDirectory, { withFileTypes: true })) {
    const entryPath = path.join(safeDirectory, entry.name);
    if (entry.isSymbolicLink()) {
      symlinks.push(path.relative(root, entryPath) || entry.name);
      continue;
    }
    if (entry.isDirectory()) {
      findSymlinks(root, entryPath, symlinks);
    }
  }
  return symlinks;
}

function verifyNoSymlinks(root) {
  const symlinks = findSymlinks(root);
  if (symlinks.length > 0) {
    throw new Error(
      `Release artifact contains symlink(s): ${symlinks.length}\n - ${symlinks.slice(0, 20).join("\n - ")}`
    );
  }
  return { symlinks };
}

function toArtifactPath(root, entryPath) {
  return path.relative(root, entryPath).split(path.sep).join("/");
}

function findUnexpectedHiddenFiles(
  root,
  directory = root,
  hiddenFiles = [],
  allowedHiddenPaths = ALLOWED_HIDDEN_ARTIFACT_PATHS
) {
  const safeDirectory =
    path.resolve(directory) === path.resolve(root)
      ? path.resolve(root)
      : resolveInsideRoot(root, path.relative(root, directory));
  for (const entry of fs.readdirSync(safeDirectory, { withFileTypes: true })) {
    const entryPath = path.join(safeDirectory, entry.name);
    const relPath = toArtifactPath(root, entryPath);
    if (relPath.startsWith(".well-known/") && !ALLOWED_WELL_KNOWN_ARTIFACT_PATHS.has(relPath)) {
      hiddenFiles.push(relPath);
      continue;
    }
    if (entry.name.startsWith(".") && !allowedHiddenPaths.has(relPath)) {
      hiddenFiles.push(relPath);
      continue;
    }
    if (entry.isDirectory()) {
      findUnexpectedHiddenFiles(root, entryPath, hiddenFiles, allowedHiddenPaths);
    }
  }
  return hiddenFiles;
}

function verifyNoUnexpectedHiddenFiles(root, options = {}) {
  const allowedHiddenPaths = new Set(ALLOWED_HIDDEN_ARTIFACT_PATHS);
  if (options.allowInternalBuildManifest === true) {
    allowedHiddenPaths.add(INTERNAL_BUILD_MANIFEST_PATH);
  }
  if (options.allowPreparedPagesManifest === true) {
    allowedHiddenPaths.add(PREPARED_PAGES_MANIFEST_PATH);
  }
  const hiddenFiles = findUnexpectedHiddenFiles(root, root, [], allowedHiddenPaths);
  if (hiddenFiles.length > 0) {
    throw new Error(
      `Release artifact contains unexpected hidden file(s): ${hiddenFiles.length}\n - ${hiddenFiles.slice(0, 20).join("\n - ")}`
    );
  }
  return { hiddenFiles };
}

function isProbablyText(buffer) {
  return !buffer.includes(0);
}

function findSecretLikeContent(root, directory = root, findings = []) {
  const safeDirectory =
    path.resolve(directory) === path.resolve(root)
      ? path.resolve(root)
      : resolveInsideRoot(root, path.relative(root, directory));
  for (const entry of fs.readdirSync(safeDirectory, { withFileTypes: true })) {
    const entryPath = path.join(safeDirectory, entry.name);
    if (entry.isDirectory()) {
      findSecretLikeContent(root, entryPath, findings);
      continue;
    }
    if (!entry.isFile()) continue;
    const buffer = fs.readFileSync(entryPath);
    if (!isProbablyText(buffer)) continue;
    const text = buffer.toString("utf8");
    if (SECRET_LIKE_CONTENT_PATTERNS.some((pattern) => pattern.test(text))) {
      findings.push(toArtifactPath(root, entryPath));
    }
  }
  return findings;
}

function verifyNoSecretLikeContent(root) {
  const findings = findSecretLikeContent(root);
  if (findings.length > 0) {
    throw new Error(
      `Release artifact contains secret-like content: ${findings.length} file(s)\n - ${findings.slice(0, 20).join("\n - ")}`
    );
  }
  return { findings };
}
function verifyReleaseArtifactIntegrity(root, options = {}) {
  const allowedRoot = options.allowedRoot || process.cwd();
  const resolvedRoot = resolveArtifactRoot(root, allowedRoot);
  verifyNoSymlinks(resolvedRoot);
  verifyNoDuplicateArtifacts(resolvedRoot, { allowedRoot });
  verifyNoUnexpectedHiddenFiles(resolvedRoot, {
    allowInternalBuildManifest: options.allowInternalBuildManifest === true,
    allowPreparedPagesManifest: options.allowPreparedPagesManifest === true,
  });
  verifyNoSecretLikeContent(resolvedRoot);
  verifyRequiredPwaFiles(resolvedRoot);
  verifyCompressedIndexRepresentations(resolvedRoot);
  verifyPreparedPagesEntrypoints(resolvedRoot);
  return verifyServiceWorkerPrecacheReferences(resolvedRoot);
}

function resolveCliTarget(argv = process.argv.slice(2)) {
  if (argv.length > 0) {
    throw new Error(
      "check-release-artifact-integrity does not accept path arguments; use the canonical staged artifact."
    );
  }
  const cwd = process.cwd();
  return path.resolve(cwd, STAGED_RELEASE_ARTIFACT);
}

function runCli(argv = process.argv.slice(2)) {
  const root = resolveCliTarget(argv);
  const result = verifyReleaseArtifactIntegrity(root);
  console.log(
    `[release-artifact-integrity] ${path.relative(process.cwd(), root) || "."}: checked ${result.checkedPrecacheUrls} service worker precache URL(s)`
  );
  return result;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  INTERNAL_BUILD_MANIFEST_PATH,
  PREPARED_PAGES_MANIFEST_PATH,
  REQUIRED_DIRECT_ROUTES,
  buildPreparedPagesArtifactManifest,
  canonicalPrecacheUrlIdentity,
  computeWorkboxRevision,
  extractServiceWorkerPrecacheEntries,
  extractServiceWorkerPrecacheUrls,
  normalizePrecacheUrl,
  resolveArtifactRoot,
  runCli,
  verifyReleaseArtifactIntegrity,
  verifyNoSymlinks,
  verifyRequiredPwaFiles,
  verifyServiceWorkerPrecacheReferences,
  verifyNoSecretLikeContent,
  verifyNoUnexpectedHiddenFiles,
  verifyArtifactFilesAgainstPreparedManifest,
  verifyPreparedPagesArtifactManifest,
  writePreparedPagesArtifactManifest,
};
