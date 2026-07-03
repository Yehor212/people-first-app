#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { verifyNoDuplicateArtifacts } = require("./prune-duplicate-artifacts.cjs");

const DEFAULT_BASE_PREFIX = "/people-first-app/";
const REQUIRED_PWA_FILES = ["index.html", "manifest.webmanifest", "registerSW.js", "sw.js"];
const STAGED_RELEASE_ARTIFACT = "output/pages-artifact.nosync";
const URL_PROPERTY_PATTERN = /["']?url["']?\s*:\s*(["'])(.*?)\1/g;
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

function extractServiceWorkerPrecacheUrls(source) {
  const urls = [];
  for (const match of source.matchAll(URL_PROPERTY_PATTERN)) {
    urls.push(match[2]);
  }
  return urls;
}

function normalizePrecacheUrl(url, basePrefix = DEFAULT_BASE_PREFIX) {
  let pathname = String(url || "").split("#")[0].split("?")[0];
  if (!pathname) return "index.html";

  if (/^[a-z][a-z0-9+.-]*:/i.test(pathname)) {
    const parsed = new URL(pathname);
    if (parsed.origin !== "https://example.invalid") return null;
    pathname = parsed.pathname;
  }

  if (pathname.startsWith(basePrefix)) {
    pathname = pathname.slice(basePrefix.length);
  } else if (pathname.startsWith("/")) {
    pathname = pathname.slice(1);
  }

  pathname = decodeURIComponent(pathname);
  if (!pathname || pathname.endsWith("/")) pathname = `${pathname}index.html`;
  return pathname;
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
  const urls = extractServiceWorkerPrecacheUrls(source);
  if (urls.length === 0) {
    throw new Error("Service worker precache contains no URLs: sw.js");
  }

  const missing = [];
  for (const url of urls) {
    const normalized = normalizePrecacheUrl(url);
    if (!normalized) continue;
    const filePath = resolveInsideRoot(root, normalized);
    if (!fs.existsSync(filePath)) missing.push(`${url} -> ${normalized}`);
  }

  if (missing.length > 0) {
    throw new Error(
      `Service worker precache references missing artifact(s): ${missing.length}\n - ${missing
        .slice(0, 20)
        .join("\n - ")}`,
    );
  }

  return { checkedPrecacheUrls: urls.length };
}

function verifyRequiredPwaFiles(root) {
  const missing = REQUIRED_PWA_FILES.filter((relPath) => !fs.existsSync(resolveInsideRoot(root, relPath)));
  if (missing.length > 0) {
    throw new Error(
      `Release artifact missing required PWA file(s): ${missing.join(", ")}`,
    );
  }
  return { missing };
}

function findSymlinks(root, directory = root, symlinks = []) {
  const safeDirectory = path.resolve(directory) === path.resolve(root)
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
      `Release artifact contains symlink(s): ${symlinks.length}\n - ${symlinks.slice(0, 20).join("\n - ")}`,
    );
  }
  return { symlinks };
}

function toArtifactPath(root, entryPath) {
  return path.relative(root, entryPath).split(path.sep).join("/");
}

function findUnexpectedHiddenFiles(root, directory = root, hiddenFiles = []) {
  const safeDirectory = path.resolve(directory) === path.resolve(root)
    ? path.resolve(root)
    : resolveInsideRoot(root, path.relative(root, directory));
  for (const entry of fs.readdirSync(safeDirectory, { withFileTypes: true })) {
    const entryPath = path.join(safeDirectory, entry.name);
    const relPath = toArtifactPath(root, entryPath);
    if (relPath.startsWith(".well-known/") && !ALLOWED_WELL_KNOWN_ARTIFACT_PATHS.has(relPath)) {
      hiddenFiles.push(relPath);
      continue;
    }
    if (entry.name.startsWith(".") && !ALLOWED_HIDDEN_ARTIFACT_PATHS.has(relPath)) {
      hiddenFiles.push(relPath);
      continue;
    }
    if (entry.isDirectory()) {
      findUnexpectedHiddenFiles(root, entryPath, hiddenFiles);
    }
  }
  return hiddenFiles;
}

function verifyNoUnexpectedHiddenFiles(root) {
  const hiddenFiles = findUnexpectedHiddenFiles(root);
  if (hiddenFiles.length > 0) {
    throw new Error(
      `Release artifact contains unexpected hidden file(s): ${hiddenFiles.length}\n - ${hiddenFiles.slice(0, 20).join("\n - ")}`,
    );
  }
  return { hiddenFiles };
}

function isProbablyText(buffer) {
  return !buffer.includes(0);
}

function findSecretLikeContent(root, directory = root, findings = []) {
  const safeDirectory = path.resolve(directory) === path.resolve(root)
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
      `Release artifact contains secret-like content: ${findings.length} file(s)\n - ${findings.slice(0, 20).join("\n - ")}`,
    );
  }
  return { findings };
}
function verifyReleaseArtifactIntegrity(root, options = {}) {
  const resolvedRoot = resolveArtifactRoot(root, options.allowedRoot || process.cwd());
  verifyNoDuplicateArtifacts(resolvedRoot);
  verifyNoSymlinks(resolvedRoot);
  verifyNoUnexpectedHiddenFiles(resolvedRoot);
  verifyNoSecretLikeContent(resolvedRoot);
  verifyRequiredPwaFiles(resolvedRoot);
  return verifyServiceWorkerPrecacheReferences(resolvedRoot);
}

function resolveCliTarget(argv = process.argv.slice(2)) {
  if (argv.length > 0) {
    throw new Error("check-release-artifact-integrity does not accept path arguments; use the canonical staged artifact.");
  }
  const cwd = process.cwd();
  return path.resolve(cwd, STAGED_RELEASE_ARTIFACT);
}

function runCli(argv = process.argv.slice(2)) {
  const root = resolveCliTarget(argv);
  const result = verifyReleaseArtifactIntegrity(root);
  console.log(
    `[release-artifact-integrity] ${path.relative(process.cwd(), root) || "."}: checked ${result.checkedPrecacheUrls} service worker precache URL(s)`,
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
};
