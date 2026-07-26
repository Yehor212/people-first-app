import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

const SUBJECT_SCHEMA_VERSION = "1.0.0";
const PRODUCTION_SUBJECT_ID = "production-baseline";
const CANDIDATE_SUBJECT_ID = "candidate";
const PRODUCTION_KIND = "PRODUCTION_BASELINE";
const CANDIDATE_KIND = "CANDIDATE_WORKTREE";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const OID_PATTERNS = Object.freeze({
  sha1: /^[a-f0-9]{40}$/,
  sha256: /^[a-f0-9]{64}$/,
});
const SAFE_SCANNER_METADATA = /^[a-z0-9][a-z0-9._+-]{0,63}$/i;
const EXCLUSION_REASONS = new Set([
  "PRIVACY_FINDING",
  "PRIVACY_UNKNOWN",
  "SENSITIVE_PATH",
  "UNKNOWN_FILE_TYPE",
  "UNSAFE_PATH",
]);
const SENSITIVE_PATH_PATTERN =
  /(?:^|[._/ -])(?:account|auth|contact|credential|device|diary|email|habit|journal|key|mood|password|phone|private|profile|secret|session|token|user)(?:$|[._/ -])/i;
const SENSITIVE_VALUE_PATTERNS = Object.freeze([
  /\bBearer[._ -]+[a-z0-9._-]{8,}/i,
  /\bsk-[a-z0-9_-]{8,}/i,
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,
  /(?<!\d)(?:\+\d[\d ()-]{7,14}\d|\d{3}[ ()-]\d{3}[ -]\d{4})(?!\d)/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  /\b[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/i,
]);
const KNOWN_REVIEWABLE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cjs",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".h",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".kts",
  ".lock",
  ".md",
  ".mjs",
  ".mm",
  ".plist",
  ".properties",
  ".rs",
  ".sh",
  ".sql",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

export const PROVENANCE_LIMITS = Object.freeze({
  maxUntrackedFiles: 50_000,
  maxFilesystemEntries: 100_000,
  maxFileBytes: 16 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024,
  maxGitOutputBytes: 256 * 1024 * 1024,
  maxPathBytes: 4_096,
});

const ERROR_MESSAGES = Object.freeze({
  INVALID_OPTIONS: "provenance options are invalid",
  INVALID_ROOT: "provenance root must be a real Git worktree directory",
  INVALID_LOCK_PATH: "dependency lock path must be a normalized repository-relative path",
  GIT_INSPECTION_FAILED: "read-only Git inspection failed",
  GIT_ROOT_MISMATCH: "provenance root must be the Git worktree top level",
  GIT_OBJECT_FORMAT_UNSUPPORTED: "Git object format is unsupported",
  GIT_IDENTITY_INVALID: "Git returned an invalid repository identity",
  SUBJECT_MUTATED: "subject changed during provenance capture",
  PRODUCTION_DIRTY: "production baseline must have clean tracked and untracked state",
  LOCK_NOT_TRACKED: "dependency lock file must be tracked by Git",
  FILE_UNSAFE: "provenance input must be a stable regular file under the subject root",
  FILE_LIMIT_EXCEEDED: "provenance file byte limit exceeded",
  TOTAL_LIMIT_EXCEEDED: "provenance total byte limit exceeded",
  FILE_COUNT_LIMIT_EXCEEDED: "provenance file count limit exceeded",
  PATH_LIMIT_EXCEEDED: "provenance path byte limit exceeded",
  INVALID_MANIFEST: "provenance manifest is invalid",
  DIGEST_MISMATCH: "provenance snapshot digest does not match the manifest",
  WRONG_SUBJECT: "provenance manifest has the wrong subject",
  PRIVACY_SCANNER_REQUIRED: "candidate capture requires an active privacy scanner",
  PRIVACY_SCANNER_INVALID: "privacy scanner contract is invalid",
  ARTIFACT_ROOT_REQUIRED: "candidate verification requires a separate artifact root",
  ARTIFACT_MISMATCH: "candidate artifact does not match the captured manifest",
});

export class ProvenanceError extends Error {
  constructor(code) {
    super(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INVALID_MANIFEST);
    this.name = "ProvenanceError";
    this.code = ERROR_MESSAGES[code] ? code : "INVALID_MANIFEST";
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message };
  }
}

export async function captureProductionProvenance(options = {}) {
  return withSafeErrors(async () => {
    const root = await resolveRepositoryRoot(options.root);
    const limits = resolveLimits(options.limits);
    const dependencyLockPath = normalizeDependencyLockPath(
      options.dependencyLockPath ?? "package-lock.json",
      limits,
    );
    await assertTrackedPath(root, dependencyLockPath, limits);

    await assertSafeWorktreeNodes(root, await readIgnoredPrefixes(root, limits), limits);
    const before = await readGitState(root, limits, options.testingHooks, "production-before");
    const dependencyLockBefore = await readStableRelativeFile(
      root,
      dependencyLockPath,
      limits.maxFileBytes,
      options.testingHooks,
      "production-lock-before",
    );
    const middle = await readGitState(root, limits, options.testingHooks, "production-middle");
    const dependencyLockAfter = await readStableRelativeFile(
      root,
      dependencyLockPath,
      limits.maxFileBytes,
      options.testingHooks,
      "production-lock-after",
    );
    const after = await readGitState(root, limits, options.testingHooks, "production-after");
    await assertSafeWorktreeNodes(root, await readIgnoredPrefixes(root, limits), limits);
    assertSameGitState(before, middle);
    assertSameGitState(middle, after);
    if (
      dependencyLockBefore.contentSha256 !== dependencyLockAfter.contentSha256 ||
      dependencyLockBefore.size !== dependencyLockAfter.size
    ) {
      throw new ProvenanceError("SUBJECT_MUTATED");
    }
    if (
      before.statusBytes.length !== 0 ||
      before.diffBytes.length !== 0 ||
      before.untrackedPaths.length !== 0
    ) {
      throw new ProvenanceError("PRODUCTION_DIRTY");
    }

    const unsignedManifest = {
      schemaVersion: SUBJECT_SCHEMA_VERSION,
      subjectId: PRODUCTION_SUBJECT_ID,
      subjectKind: PRODUCTION_KIND,
      repository: {
        oidAlgorithm: before.oidAlgorithm,
        commitOid: before.commitOid,
        treeOid: before.treeOid,
        dependencyLockPath,
        dependencyLockSha256: dependencyLockBefore.contentSha256,
        gitStatusSha256: sha256(before.statusBytes),
        trackedDiffSha256: sha256(before.diffBytes),
        untrackedFileCount: 0,
      },
      state: "CLEAN",
    };
    return {
      ...unsignedManifest,
      snapshotSha256: sha256(canonicalJson(unsignedManifest)),
    };
  });
}

export async function captureCandidateProvenance(options = {}) {
  return withSafeErrors(async () => {
    const privacyScanner = validatePrivacyScanner(options.privacyScanner);
    const root = await resolveRepositoryRoot(options.root);
    const limits = resolveLimits(options.limits);
    const dependencyLockPath = normalizeDependencyLockPath(
      options.dependencyLockPath ?? "package-lock.json",
      limits,
    );
    await assertTrackedPath(root, dependencyLockPath, limits);

    await assertSafeWorktreeNodes(root, await readIgnoredPrefixes(root, limits), limits);
    const before = await readGitState(root, limits, options.testingHooks, "candidate-before");
    const dependencyLockBefore = await readStableRelativeFile(
      root,
      dependencyLockPath,
      limits.maxFileBytes,
      options.testingHooks,
      "candidate-lock-before",
    );
    const initialUntracked = await readUntrackedSnapshot({
      root,
      relativePaths: before.untrackedPaths,
      limits,
      privacyScanner,
      testingHooks: options.testingHooks,
      phase: "candidate-initial",
    });
    await options.testingHooks?.afterInitialUntrackedSnapshot?.({
      fileCount: initialUntracked.records.length,
    });

    const middle = await readGitState(root, limits, options.testingHooks, "candidate-middle");
    const finalUntracked = await readUntrackedSnapshot({
      root,
      relativePaths: middle.untrackedPaths,
      limits,
      privacyScanner: null,
      testingHooks: options.testingHooks,
      phase: "candidate-final",
    });
    const dependencyLockAfter = await readStableRelativeFile(
      root,
      dependencyLockPath,
      limits.maxFileBytes,
      options.testingHooks,
      "candidate-lock-after",
    );
    const after = await readGitState(root, limits, options.testingHooks, "candidate-after");
    await assertSafeWorktreeNodes(root, await readIgnoredPrefixes(root, limits), limits);

    assertSameGitState(before, middle);
    assertSameGitState(middle, after);
    if (
      dependencyLockBefore.contentSha256 !== dependencyLockAfter.contentSha256 ||
      dependencyLockBefore.size !== dependencyLockAfter.size ||
      initialUntracked.contentManifestSha256 !== finalUntracked.contentManifestSha256 ||
      initialUntracked.totalBytes !== finalUntracked.totalBytes ||
      initialUntracked.records.length !== finalUntracked.records.length
    ) {
      throw new ProvenanceError("SUBJECT_MUTATED");
    }

    const { sanitizedManifest, privacyScanReceipt, runtimeCopy } =
      buildSanitizedCandidateState(initialUntracked, privacyScanner);
    const sanitizedUntrackedManifestSha256 = sha256(canonicalJson(sanitizedManifest));
    const privacyScanReceiptSha256 = sha256(canonicalJson(privacyScanReceipt));
    const unsignedManifest = {
      schemaVersion: SUBJECT_SCHEMA_VERSION,
      subjectId: CANDIDATE_SUBJECT_ID,
      subjectKind: CANDIDATE_KIND,
      repository: {
        oidAlgorithm: before.oidAlgorithm,
        commitOid: before.commitOid,
        treeOid: before.treeOid,
        dependencyLockPath,
        dependencyLockSha256: dependencyLockBefore.contentSha256,
        gitStatusSha256: sha256(before.statusBytes),
        trackedDiffSha256: sha256(before.diffBytes),
        untrackedPathSetSha256: before.untrackedPathSetSha256,
        untrackedContentManifestSha256: initialUntracked.contentManifestSha256,
        sanitizedUntrackedManifestSha256,
        privacyScanReceiptSha256,
        untrackedFileCount: initialUntracked.records.length,
      },
      sanitizedUntrackedManifest: sanitizedManifest,
      privacyScanReceipt,
      runtimeCopy,
    };
    return {
      ...unsignedManifest,
      snapshotSha256: sha256(canonicalJson(unsignedManifest)),
    };
  });
}

export async function verifyProductionProvenance(manifest, options = {}) {
  return withSafeErrors(async () => {
    assertManifestDigest(manifest);
    if (
      manifest.subjectId !== PRODUCTION_SUBJECT_ID ||
      manifest.subjectKind !== PRODUCTION_KIND
    ) {
      throw new ProvenanceError("WRONG_SUBJECT");
    }
    validateProductionManifest(manifest);
    const current = await captureProductionProvenance({
      root: options.root,
      dependencyLockPath: manifest.repository.dependencyLockPath,
      limits: options.limits,
      testingHooks: options.testingHooks,
    });
    if (canonicalJson(current) !== canonicalJson(manifest)) {
      throw new ProvenanceError("SUBJECT_MUTATED");
    }
    return {
      subjectId: PRODUCTION_SUBJECT_ID,
      snapshotIntegrity: "VERIFIED",
      snapshotSha256: manifest.snapshotSha256,
      closure: "PASS",
    };
  });
}

export async function verifyCandidateArtifactSnapshot(manifest, options = {}) {
  return withSafeErrors(async () => {
    assertManifestDigest(manifest);
    if (
      manifest.subjectId !== CANDIDATE_SUBJECT_ID ||
      manifest.subjectKind !== CANDIDATE_KIND
    ) {
      throw new ProvenanceError("WRONG_SUBJECT");
    }
    validateCandidateManifest(manifest);
    const limits = resolveLimits(options.limits);
    const artifactRoot = await resolveArtifactRoot(options.artifactRoot);
    const clearedEntries = manifest.sanitizedUntrackedManifest.entries.filter(
      (entry) => entry.status === "CLEARED",
    );
    const actualArtifactPaths = await enumerateArtifactPaths(artifactRoot, limits);
    const expectedArtifactPaths = clearedEntries.map((entry) => entry.path).sort(compareText);
    if (
      actualArtifactPaths.length !== expectedArtifactPaths.length ||
      actualArtifactPaths.some((entry, index) => entry !== expectedArtifactPaths[index])
    ) {
      throw new ProvenanceError("ARTIFACT_MISMATCH");
    }

    let totalBytes = 0;
    for (const entry of clearedEntries) {
      const artifact = await readStableRelativeFile(
        artifactRoot,
        entry.path,
        limits.maxFileBytes,
        options.testingHooks,
        "candidate-artifact",
      );
      totalBytes += artifact.size;
      if (
        totalBytes > limits.maxTotalBytes ||
        artifact.size !== entry.size ||
        artifact.contentSha256 !== entry.contentSha256
      ) {
        throw new ProvenanceError("ARTIFACT_MISMATCH");
      }
    }

    const excludedFileCount = manifest.sanitizedUntrackedManifest.excludedCount;
    return {
      subjectId: CANDIDATE_SUBJECT_ID,
      snapshotIntegrity: "VERIFIED",
      snapshotSha256: manifest.snapshotSha256,
      verifiedClearedFileCount: clearedEntries.length,
      excludedFileCount,
      runtimeCopyComplete: excludedFileCount === 0,
      closure: excludedFileCount === 0 ? "PASS" : "BLOCKED",
    };
  });
}

export function recomputeSnapshotSha256(manifest) {
  return withSafeErrorsSync(() => {
    if (!isPlainObject(manifest) || typeof manifest.snapshotSha256 !== "string") {
      throw new ProvenanceError("INVALID_MANIFEST");
    }
    const { snapshotSha256: _snapshotSha256, ...unsignedManifest } = manifest;
    return sha256(canonicalJson(unsignedManifest));
  });
}

function validatePrivacyScanner(scanner) {
  if (!isPlainObject(scanner) || typeof scanner.scanFile !== "function") {
    throw new ProvenanceError("PRIVACY_SCANNER_REQUIRED");
  }
  if (
    typeof scanner.tool !== "string" ||
    !isSafeScannerMetadata(scanner.tool) ||
    typeof scanner.version !== "string" ||
    !isSafeScannerMetadata(scanner.version) ||
    typeof scanner.configSha256 !== "string" ||
    !SHA256_PATTERN.test(scanner.configSha256)
  ) {
    throw new ProvenanceError("PRIVACY_SCANNER_INVALID");
  }
  return {
    tool: scanner.tool,
    version: scanner.version,
    configSha256: scanner.configSha256,
    scanFile: scanner.scanFile.bind(scanner),
  };
}

async function readUntrackedSnapshot({
  root,
  relativePaths,
  limits,
  privacyScanner,
  testingHooks,
  phase,
}) {
  if (relativePaths.length > limits.maxUntrackedFiles) {
    throw new ProvenanceError("FILE_COUNT_LIMIT_EXCEEDED");
  }
  const records = [];
  let totalBytes = 0;
  for (const relativePath of relativePaths) {
    const file = await readStableRelativeFile(
      root,
      relativePath,
      limits.maxFileBytes,
      testingHooks,
      phase,
    );
    totalBytes += file.size;
    if (totalBytes > limits.maxTotalBytes) {
      throw new ProvenanceError("TOTAL_LIMIT_EXCEEDED");
    }
    let scannerStatus;
    if (privacyScanner) {
      scannerStatus = await scanPrivacyFile(privacyScanner, {
        pathSha256: sha256(relativePath),
        bytes: file.bytes,
        contentSha256: file.contentSha256,
        size: file.size,
      });
    }
    records.push({
      relativePath,
      pathSha256: sha256(relativePath),
      contentSha256: file.contentSha256,
      size: file.size,
      ...(scannerStatus ? { scannerStatus } : {}),
    });
  }
  const contentManifest = records.map(({ pathSha256, contentSha256, size }) => ({
    pathSha256,
    contentSha256,
    size,
  })).sort((left, right) => compareText(left.pathSha256, right.pathSha256));
  return {
    records,
    totalBytes,
    contentManifestSha256: sha256(canonicalJson(contentManifest)),
  };
}

async function scanPrivacyFile(scanner, file) {
  try {
    const result = await scanner.scanFile(
      Object.freeze({
        pathSha256: file.pathSha256,
        bytes: Buffer.from(file.bytes),
        contentSha256: file.contentSha256,
        size: file.size,
      }),
    );
    assertExactKeys(result, [
      "configSha256",
      "findingCount",
      "scannedFileCount",
      "status",
      "tool",
      "version",
    ]);
    if (
      result.tool !== scanner.tool ||
      result.version !== scanner.version ||
      result.configSha256 !== scanner.configSha256 ||
      result.scannedFileCount !== 1 ||
      !Number.isSafeInteger(result.findingCount) ||
      result.findingCount < 0 ||
      result.findingCount > 1
    ) {
      return "UNKNOWN";
    }
    if (result.status === "PASS" && result.findingCount === 0) return "CLEARED";
    if (result.status === "FINDINGS" && result.findingCount === 1) return "FINDING";
    if (result.status === "UNKNOWN" && result.findingCount === 0) return "UNKNOWN";
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

function buildSanitizedCandidateState(snapshot, scanner) {
  let findingCount = 0;
  let unknownFileCount = 0;
  const entries = snapshot.records.map((record) => {
    if (record.scannerStatus === "FINDING") findingCount += 1;
    if (record.scannerStatus === "UNKNOWN") unknownFileCount += 1;
    const reason = exclusionReason(record);
    if (reason) {
      return {
        status: "EXCLUDED",
        pathSha256: record.pathSha256,
        contentSha256: record.contentSha256,
        size: record.size,
        reason,
      };
    }
    return {
      status: "CLEARED",
      path: record.relativePath,
      contentSha256: record.contentSha256,
      size: record.size,
    };
  });
  entries.sort((left, right) =>
    compareText(left.path ?? left.pathSha256, right.path ?? right.pathSha256),
  );
  const excludedReasons = [
    ...new Set(entries.filter((entry) => entry.status === "EXCLUDED").map((entry) => entry.reason)),
  ].sort(compareText);
  const clearedCount = entries.filter((entry) => entry.status === "CLEARED").length;
  const excludedCount = entries.length - clearedCount;
  const privacyScanReceipt = {
    tool: scanner.tool,
    version: scanner.version,
    configSha256: scanner.configSha256,
    scannedFileCount: entries.length,
    findingCount,
    status: unknownFileCount > 0 ? "UNKNOWN" : findingCount > 0 ? "FINDINGS" : "PASS",
  };
  return {
    sanitizedManifest: {
      schemaVersion: SUBJECT_SCHEMA_VERSION,
      entryCount: entries.length,
      totalBytes: snapshot.totalBytes,
      clearedCount,
      excludedCount,
      entries,
    },
    privacyScanReceipt,
    runtimeCopy: {
      complete: excludedCount === 0,
      closure: excludedCount === 0 ? "PASS" : "BLOCKED",
      reasons: excludedReasons,
    },
  };
}

function exclusionReason(record) {
  if (record.scannerStatus === "FINDING") return "PRIVACY_FINDING";
  if (record.scannerStatus === "UNKNOWN") return "PRIVACY_UNKNOWN";
  if (/[\u0000-\u001f\u007f]/u.test(record.relativePath)) return "UNSAFE_PATH";
  if (isSensitivePath(record.relativePath)) return "SENSITIVE_PATH";
  if (!KNOWN_REVIEWABLE_EXTENSIONS.has(path.posix.extname(record.relativePath).toLowerCase())) {
    return "UNKNOWN_FILE_TYPE";
  }
  return null;
}

function assertManifestDigest(manifest) {
  if (
    !isPlainObject(manifest) ||
    typeof manifest.snapshotSha256 !== "string" ||
    !SHA256_PATTERN.test(manifest.snapshotSha256)
  ) {
    throw new ProvenanceError("INVALID_MANIFEST");
  }
  if (recomputeSnapshotSha256(manifest) !== manifest.snapshotSha256) {
    throw new ProvenanceError("DIGEST_MISMATCH");
  }
}

function validateProductionManifest(manifest) {
  assertExactKeys(manifest, [
    "repository",
    "schemaVersion",
    "snapshotSha256",
    "state",
    "subjectId",
    "subjectKind",
  ]);
  if (
    manifest.schemaVersion !== SUBJECT_SCHEMA_VERSION ||
    manifest.state !== "CLEAN" ||
    !isPlainObject(manifest.repository)
  ) {
    throw new ProvenanceError("INVALID_MANIFEST");
  }
  assertExactKeys(manifest.repository, [
    "commitOid",
    "dependencyLockPath",
    "dependencyLockSha256",
    "gitStatusSha256",
    "oidAlgorithm",
    "trackedDiffSha256",
    "treeOid",
    "untrackedFileCount",
  ]);
  validateRepositoryIdentity(manifest.repository);
  if (
    manifest.repository.untrackedFileCount !== 0 ||
    manifest.repository.gitStatusSha256 !== sha256(Buffer.alloc(0)) ||
    manifest.repository.trackedDiffSha256 !== sha256(Buffer.alloc(0))
  ) {
    throw new ProvenanceError("INVALID_MANIFEST");
  }
}

function validateCandidateManifest(manifest) {
  assertExactKeys(manifest, [
    "privacyScanReceipt",
    "repository",
    "runtimeCopy",
    "sanitizedUntrackedManifest",
    "schemaVersion",
    "snapshotSha256",
    "subjectId",
    "subjectKind",
  ]);
  if (
    manifest.schemaVersion !== SUBJECT_SCHEMA_VERSION ||
    !isPlainObject(manifest.repository) ||
    !isPlainObject(manifest.sanitizedUntrackedManifest) ||
    !isPlainObject(manifest.privacyScanReceipt) ||
    !isPlainObject(manifest.runtimeCopy)
  ) {
    throw new ProvenanceError("INVALID_MANIFEST");
  }
  assertExactKeys(manifest.repository, [
    "commitOid",
    "dependencyLockPath",
    "dependencyLockSha256",
    "gitStatusSha256",
    "oidAlgorithm",
    "privacyScanReceiptSha256",
    "sanitizedUntrackedManifestSha256",
    "trackedDiffSha256",
    "treeOid",
    "untrackedContentManifestSha256",
    "untrackedFileCount",
    "untrackedPathSetSha256",
  ]);
  validateRepositoryIdentity(manifest.repository);
  for (const field of [
    "privacyScanReceiptSha256",
    "sanitizedUntrackedManifestSha256",
    "untrackedContentManifestSha256",
    "untrackedPathSetSha256",
  ]) {
    if (!SHA256_PATTERN.test(manifest.repository[field] ?? "")) {
      throw new ProvenanceError("INVALID_MANIFEST");
    }
  }
  validateSanitizedManifest(manifest.sanitizedUntrackedManifest);
  validatePrivacyReceipt(manifest.privacyScanReceipt);
  validateRuntimeCopy(manifest.runtimeCopy, manifest.sanitizedUntrackedManifest);
  const findingEntryCount = manifest.sanitizedUntrackedManifest.entries.filter(
    (entry) => entry.status === "EXCLUDED" && entry.reason === "PRIVACY_FINDING",
  ).length;
  const unknownEntryCount = manifest.sanitizedUntrackedManifest.entries.filter(
    (entry) => entry.status === "EXCLUDED" && entry.reason === "PRIVACY_UNKNOWN",
  ).length;
  const expectedReceiptStatus =
    unknownEntryCount > 0 ? "UNKNOWN" : findingEntryCount > 0 ? "FINDINGS" : "PASS";
  if (
    manifest.repository.sanitizedUntrackedManifestSha256 !==
      sha256(canonicalJson(manifest.sanitizedUntrackedManifest)) ||
    manifest.repository.privacyScanReceiptSha256 !==
      sha256(canonicalJson(manifest.privacyScanReceipt)) ||
    manifest.repository.untrackedPathSetSha256 !==
      sha256(
        canonicalJson(
          manifest.sanitizedUntrackedManifest.entries
            .map((entry) => entry.pathSha256 ?? sha256(entry.path))
            .sort(compareText),
        ),
      ) ||
    manifest.repository.untrackedContentManifestSha256 !==
      sha256(
        canonicalJson(
          manifest.sanitizedUntrackedManifest.entries
            .map((entry) => ({
              pathSha256: entry.pathSha256 ?? sha256(entry.path),
              contentSha256: entry.contentSha256,
              size: entry.size,
            }))
            .sort((left, right) => compareText(left.pathSha256, right.pathSha256)),
        ),
      ) ||
    manifest.repository.untrackedFileCount !== manifest.sanitizedUntrackedManifest.entryCount ||
    manifest.privacyScanReceipt.scannedFileCount !== manifest.sanitizedUntrackedManifest.entryCount ||
    manifest.privacyScanReceipt.findingCount !== findingEntryCount ||
    manifest.privacyScanReceipt.status !== expectedReceiptStatus
  ) {
    throw new ProvenanceError("INVALID_MANIFEST");
  }
}

function validateRepositoryIdentity(repository) {
  if (
    !(repository.oidAlgorithm in OID_PATTERNS) ||
    !OID_PATTERNS[repository.oidAlgorithm].test(repository.commitOid ?? "") ||
    !OID_PATTERNS[repository.oidAlgorithm].test(repository.treeOid ?? "") ||
    !SHA256_PATTERN.test(repository.dependencyLockSha256 ?? "") ||
    !SHA256_PATTERN.test(repository.gitStatusSha256 ?? "") ||
    !SHA256_PATTERN.test(repository.trackedDiffSha256 ?? "") ||
    !Number.isSafeInteger(repository.untrackedFileCount) ||
    repository.untrackedFileCount < 0
  ) {
    throw new ProvenanceError("INVALID_MANIFEST");
  }
  normalizeDependencyLockPath(repository.dependencyLockPath, PROVENANCE_LIMITS, "INVALID_MANIFEST");
}

function validateSanitizedManifest(manifest) {
  assertExactKeys(manifest, [
    "clearedCount",
    "entries",
    "entryCount",
    "excludedCount",
    "schemaVersion",
    "totalBytes",
  ]);
  if (
    manifest.schemaVersion !== SUBJECT_SCHEMA_VERSION ||
    !Array.isArray(manifest.entries) ||
    !Number.isSafeInteger(manifest.entryCount) ||
    !Number.isSafeInteger(manifest.clearedCount) ||
    !Number.isSafeInteger(manifest.excludedCount) ||
    !Number.isSafeInteger(manifest.totalBytes) ||
    manifest.entryCount < 0 ||
    manifest.clearedCount < 0 ||
    manifest.excludedCount < 0 ||
    manifest.totalBytes < 0 ||
    manifest.entryCount !== manifest.entries.length ||
    manifest.clearedCount + manifest.excludedCount !== manifest.entryCount
  ) {
    throw new ProvenanceError("INVALID_MANIFEST");
  }
  let totalBytes = 0;
  let clearedCount = 0;
  const stableKeys = [];
  for (const entry of manifest.entries) {
    if (!isPlainObject(entry) || !["CLEARED", "EXCLUDED"].includes(entry.status)) {
      throw new ProvenanceError("INVALID_MANIFEST");
    }
    if (
      !SHA256_PATTERN.test(entry.contentSha256 ?? "") ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0
    ) {
      throw new ProvenanceError("INVALID_MANIFEST");
    }
    totalBytes += entry.size;
    if (entry.status === "CLEARED") {
      assertExactKeys(entry, ["contentSha256", "path", "size", "status"]);
      normalizeRelativePath(entry.path, PROVENANCE_LIMITS, "INVALID_MANIFEST");
      if (
        isSensitivePath(entry.path) ||
        /[\u0000-\u001f\u007f]/u.test(entry.path) ||
        !KNOWN_REVIEWABLE_EXTENSIONS.has(path.posix.extname(entry.path).toLowerCase())
      ) {
        throw new ProvenanceError("INVALID_MANIFEST");
      }
      stableKeys.push(entry.path);
      clearedCount += 1;
    } else {
      assertExactKeys(entry, ["contentSha256", "pathSha256", "reason", "size", "status"]);
      if (
        !SHA256_PATTERN.test(entry.pathSha256 ?? "") ||
        !EXCLUSION_REASONS.has(entry.reason)
      ) {
        throw new ProvenanceError("INVALID_MANIFEST");
      }
      stableKeys.push(entry.pathSha256);
    }
  }
  if (
    totalBytes !== manifest.totalBytes ||
    clearedCount !== manifest.clearedCount ||
    manifest.entryCount - clearedCount !== manifest.excludedCount ||
    stableKeys.some((key, index) => index > 0 && compareText(stableKeys[index - 1], key) >= 0)
  ) {
    throw new ProvenanceError("INVALID_MANIFEST");
  }
}

function validatePrivacyReceipt(receipt) {
  assertExactKeys(receipt, [
    "configSha256",
    "findingCount",
    "scannedFileCount",
    "status",
    "tool",
    "version",
  ]);
  if (
    !isSafeScannerMetadata(receipt.tool) ||
    !isSafeScannerMetadata(receipt.version) ||
    !SHA256_PATTERN.test(receipt.configSha256 ?? "") ||
    !Number.isSafeInteger(receipt.scannedFileCount) ||
    !Number.isSafeInteger(receipt.findingCount) ||
    receipt.scannedFileCount < 0 ||
    receipt.findingCount < 0 ||
    receipt.findingCount > receipt.scannedFileCount ||
    !["PASS", "FINDINGS", "UNKNOWN"].includes(receipt.status) ||
    (receipt.findingCount > 0 && receipt.status === "PASS") ||
    (receipt.findingCount === 0 && receipt.status === "FINDINGS")
  ) {
    throw new ProvenanceError("INVALID_MANIFEST");
  }
}

function validateRuntimeCopy(runtimeCopy, manifest) {
  assertExactKeys(runtimeCopy, ["closure", "complete", "reasons"]);
  const expectedReasons = [
    ...new Set(
      manifest.entries
        .filter((entry) => entry.status === "EXCLUDED")
        .map((entry) => entry.reason),
    ),
  ].sort(compareText);
  if (
    typeof runtimeCopy.complete !== "boolean" ||
    !["PASS", "BLOCKED"].includes(runtimeCopy.closure) ||
    !Array.isArray(runtimeCopy.reasons) ||
    runtimeCopy.reasons.some((reason) => !EXCLUSION_REASONS.has(reason)) ||
    canonicalJson(runtimeCopy.reasons) !== canonicalJson(expectedReasons) ||
    runtimeCopy.complete !== (manifest.excludedCount === 0) ||
    runtimeCopy.closure !== (manifest.excludedCount === 0 ? "PASS" : "BLOCKED")
  ) {
    throw new ProvenanceError("INVALID_MANIFEST");
  }
}

function assertExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) throw new ProvenanceError("INVALID_MANIFEST");
  const actual = Object.keys(value).sort(compareText);
  const expected = [...expectedKeys].sort(compareText);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ProvenanceError("INVALID_MANIFEST");
  }
}

async function resolveRepositoryRoot(rootInput) {
  if (typeof rootInput !== "string" || rootInput.length === 0) {
    throw new ProvenanceError("INVALID_OPTIONS");
  }
  const requested = path.resolve(rootInput);
  let requestedStat;
  try {
    requestedStat = await lstat(requested);
  } catch {
    throw new ProvenanceError("INVALID_ROOT");
  }
  if (requestedStat.isSymbolicLink() || !requestedStat.isDirectory()) {
    throw new ProvenanceError("INVALID_ROOT");
  }
  let root;
  try {
    root = await realpath(requested);
  } catch {
    throw new ProvenanceError("INVALID_ROOT");
  }
  let gitControlStat;
  try {
    gitControlStat = await lstat(path.join(root, ".git"));
  } catch {
    throw new ProvenanceError("INVALID_ROOT");
  }
  if (
    gitControlStat.isSymbolicLink() ||
    (!gitControlStat.isDirectory() && !gitControlStat.isFile())
  ) {
    throw new ProvenanceError("INVALID_ROOT");
  }
  const topLevelBytes = await runGit(root, ["rev-parse", "--show-toplevel"], PROVENANCE_LIMITS);
  let topLevel;
  try {
    topLevel = await realpath(decodeTrimmed(topLevelBytes));
  } catch {
    throw new ProvenanceError("GIT_INSPECTION_FAILED");
  }
  if (topLevel !== root) throw new ProvenanceError("GIT_ROOT_MISMATCH");
  return root;
}

async function resolveArtifactRoot(rootInput) {
  if (typeof rootInput !== "string" || rootInput.length === 0) {
    throw new ProvenanceError("ARTIFACT_ROOT_REQUIRED");
  }
  const requested = path.resolve(rootInput);
  let stat;
  try {
    stat = await lstat(requested);
  } catch {
    throw new ProvenanceError("ARTIFACT_ROOT_REQUIRED");
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new ProvenanceError("ARTIFACT_ROOT_REQUIRED");
  }
  try {
    return await realpath(requested);
  } catch {
    throw new ProvenanceError("ARTIFACT_ROOT_REQUIRED");
  }
}

async function readIgnoredPrefixes(root, limits) {
  const bytes = await runGit(
    root,
    ["status", "--porcelain=v1", "-z", "--ignored=matching", "--untracked-files=all"],
    limits,
  );
  if (bytes.length === 0) return [];
  if (bytes.at(-1) !== 0) throw new ProvenanceError("GIT_INSPECTION_FAILED");
  const prefixes = [];
  let start = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== 0) continue;
    const record = bytes.subarray(start, index);
    start = index + 1;
    if (record.length < 4 || record[0] !== 0x21 || record[1] !== 0x21 || record[2] !== 0x20) {
      continue;
    }
    let decoded;
    try {
      decoded = utf8Decoder.decode(record.subarray(3));
    } catch {
      throw new ProvenanceError("FILE_UNSAFE");
    }
    const withoutDirectoryMarker = decoded.endsWith("/") ? decoded.slice(0, -1) : decoded;
    prefixes.push(normalizeRelativePath(withoutDirectoryMarker, limits));
  }
  prefixes.sort(compareText);
  return prefixes;
}

async function assertSafeWorktreeNodes(root, ignoredPrefixes, limits) {
  let visitedEntries = 0;
  async function walk(directory, relativeDirectory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      throw new ProvenanceError("FILE_UNSAFE");
    }
    entries.sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      if (relativePath === ".git" || isIgnoredPath(relativePath, ignoredPrefixes)) continue;
      normalizeRelativePath(relativePath, limits);
      visitedEntries += 1;
      if (visitedEntries > limits.maxFilesystemEntries) {
        throw new ProvenanceError("FILE_COUNT_LIMIT_EXCEEDED");
      }
      const absolutePath = path.join(directory, entry.name);
      let stat;
      try {
        stat = await lstat(absolutePath);
      } catch {
        throw new ProvenanceError("FILE_UNSAFE");
      }
      if (stat.isSymbolicLink()) throw new ProvenanceError("FILE_UNSAFE");
      if (stat.isDirectory()) {
        await walk(absolutePath, relativePath);
      } else if (!stat.isFile()) {
        throw new ProvenanceError("FILE_UNSAFE");
      }
    }
  }
  await walk(root, "");
}

function isIgnoredPath(relativePath, ignoredPrefixes) {
  return ignoredPrefixes.some(
    (prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`),
  );
}

async function enumerateArtifactPaths(root, limits) {
  const paths = [];
  let totalBytes = 0;
  async function walk(directory, relativeDirectory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      throw new ProvenanceError("FILE_UNSAFE");
    }
    entries.sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      normalizeRelativePath(relativePath, limits);
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new ProvenanceError("FILE_UNSAFE");
      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) throw new ProvenanceError("FILE_UNSAFE");
      paths.push(relativePath);
      if (paths.length > limits.maxUntrackedFiles) {
        throw new ProvenanceError("FILE_COUNT_LIMIT_EXCEEDED");
      }
      const stat = await lstat(absolutePath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new ProvenanceError("FILE_UNSAFE");
      if (stat.size > limits.maxFileBytes) throw new ProvenanceError("FILE_LIMIT_EXCEEDED");
      totalBytes += stat.size;
      if (totalBytes > limits.maxTotalBytes) {
        throw new ProvenanceError("TOTAL_LIMIT_EXCEEDED");
      }
    }
  }
  await walk(root, "");
  paths.sort(compareText);
  return paths;
}

function resolveLimits(overrides) {
  if (overrides === undefined) return PROVENANCE_LIMITS;
  if (!isPlainObject(overrides)) throw new ProvenanceError("INVALID_OPTIONS");
  const limits = { ...PROVENANCE_LIMITS };
  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in PROVENANCE_LIMITS)) throw new ProvenanceError("INVALID_OPTIONS");
    if (!Number.isSafeInteger(value) || value <= 0 || value > PROVENANCE_LIMITS[key]) {
      throw new ProvenanceError("INVALID_OPTIONS");
    }
    limits[key] = value;
  }
  return Object.freeze(limits);
}

async function assertTrackedPath(root, relativePath, limits) {
  await runGit(
    root,
    ["ls-files", "--error-unmatch", "--", relativePath],
    limits,
    "LOCK_NOT_TRACKED",
  );
}

async function readGitState(root, limits, testingHooks, phase) {
  const oidAlgorithm = decodeTrimmed(
    await runGit(root, ["rev-parse", "--show-object-format"], limits),
  );
  if (!(oidAlgorithm in OID_PATTERNS)) {
    throw new ProvenanceError("GIT_OBJECT_FORMAT_UNSUPPORTED");
  }
  await testingHooks?.afterGitRead?.({ phase, view: "object-format" });

  const commitOid = decodeTrimmed(
    await runGit(root, ["rev-parse", "HEAD^{commit}"], limits),
  );
  await testingHooks?.afterGitRead?.({ phase, view: "commit" });
  const treeOid = decodeTrimmed(
    await runGit(root, ["rev-parse", "HEAD^{tree}"], limits),
  );
  await testingHooks?.afterGitRead?.({ phase, view: "tree" });
  if (!OID_PATTERNS[oidAlgorithm].test(commitOid) || !OID_PATTERNS[oidAlgorithm].test(treeOid)) {
    throw new ProvenanceError("GIT_IDENTITY_INVALID");
  }

  const statusBytes = await runGit(
    root,
    ["status", "--porcelain=v1", "--untracked-files=all"],
    limits,
  );
  await testingHooks?.afterGitRead?.({ phase, view: "status" });
  const diffBytes = await runGit(
    root,
    ["diff", "--binary", "--no-ext-diff", "--no-textconv", "HEAD", "--"],
    limits,
  );
  await testingHooks?.afterGitRead?.({ phase, view: "diff" });
  const untrackedBytes = await runGit(
    root,
    ["ls-files", "--others", "--exclude-standard", "-z"],
    limits,
  );
  await testingHooks?.afterGitRead?.({ phase, view: "untracked" });
  const untrackedPaths = parseNulPaths(untrackedBytes, limits);

  return {
    oidAlgorithm,
    commitOid,
    treeOid,
    statusBytes,
    diffBytes,
    untrackedPaths,
    untrackedPathSetSha256: sha256(
      canonicalJson(untrackedPaths.map((entry) => sha256(entry)).sort(compareText)),
    ),
  };
}

async function runGit(root, args, limits, failureCode = "GIT_INSPECTION_FAILED") {
  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "--no-optional-locks",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.untrackedCache=false",
        "-c",
        "core.quotePath=true",
        "-C",
        root,
        ...args,
      ],
      {
        encoding: "buffer",
        maxBuffer: limits.maxGitOutputBytes,
        env: gitEnvironment(),
      },
    );
    return Buffer.from(stdout);
  } catch {
    throw new ProvenanceError(failureCode);
  }
}

function gitEnvironment() {
  const environment = {
    ...process.env,
    GIT_OPTIONAL_LOCKS: "0",
    GIT_PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
    LANG: "C",
  };
  for (const key of Object.keys(environment)) {
    if (
      [
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_COMMON_DIR",
        "GIT_CONFIG",
        "GIT_CONFIG_COUNT",
        "GIT_CONFIG_PARAMETERS",
        "GIT_DIR",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_WORK_TREE",
      ].includes(key) ||
      /^GIT_CONFIG_(?:KEY|VALUE)_\d+$/.test(key)
    ) {
      delete environment[key];
    }
  }
  return environment;
}

function assertSameGitState(before, after) {
  if (
    before.oidAlgorithm !== after.oidAlgorithm ||
    before.commitOid !== after.commitOid ||
    before.treeOid !== after.treeOid ||
    !before.statusBytes.equals(after.statusBytes) ||
    !before.diffBytes.equals(after.diffBytes) ||
    before.untrackedPaths.length !== after.untrackedPaths.length ||
    before.untrackedPathSetSha256 !== after.untrackedPathSetSha256
  ) {
    throw new ProvenanceError("SUBJECT_MUTATED");
  }
}

async function readStableRelativeFile(root, relativePath, maxBytes, testingHooks, phase) {
  const target = resolveInsideRoot(root, relativePath);
  let descriptor;
  try {
    await assertNoSymlinkComponents(root, relativePath);
    const pathBefore = await lstat(target);
    if (pathBefore.isSymbolicLink() || !pathBefore.isFile()) {
      throw new ProvenanceError("FILE_UNSAFE");
    }
    if (!Number.isInteger(constants.O_NOFOLLOW)) {
      throw new ProvenanceError("FILE_UNSAFE");
    }
    descriptor = await open(
      target,
      constants.O_RDONLY | constants.O_NOFOLLOW | (constants.O_CLOEXEC ?? 0),
    );
    const before = await descriptor.stat();
    if (!before.isFile() || !sameFileIdentity(pathBefore, before)) {
      throw new ProvenanceError("FILE_UNSAFE");
    }
    if (before.size > maxBytes) throw new ProvenanceError("FILE_LIMIT_EXCEEDED");
    await testingHooks?.afterFileOpen?.({ phase, relativePath });
    const bytes = await descriptor.readFile();
    const after = await descriptor.stat();
    if (!sameFileIdentity(before, after) || bytes.length !== before.size) {
      throw new ProvenanceError("FILE_UNSAFE");
    }
    const current = await lstat(target);
    if (current.isSymbolicLink() || !sameFileIdentity(before, current)) {
      throw new ProvenanceError("FILE_UNSAFE");
    }
    const canonical = await realpath(target);
    if (!isInsideRoot(root, canonical)) throw new ProvenanceError("FILE_UNSAFE");
    return { bytes, contentSha256: sha256(bytes), size: bytes.length };
  } catch (error) {
    if (error instanceof ProvenanceError) throw error;
    throw new ProvenanceError("FILE_UNSAFE");
  } finally {
    if (descriptor) await descriptor.close();
  }
}

async function assertNoSymlinkComponents(root, relativePath) {
  const segments = relativePath.split("/");
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = await lstat(current);
    } catch {
      throw new ProvenanceError("FILE_UNSAFE");
    }
    if (stat.isSymbolicLink()) throw new ProvenanceError("FILE_UNSAFE");
  }
}

function normalizeDependencyLockPath(value, limits, errorCode = "INVALID_LOCK_PATH") {
  const normalized = normalizeRelativePath(value, limits, errorCode);
  if (/[\u0000-\u001f\u007f]/u.test(normalized) || isSensitivePath(normalized)) {
    throw new ProvenanceError(errorCode);
  }
  return normalized;
}

function normalizeRelativePath(value, limits, errorCode = "FILE_UNSAFE") {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.normalize("NFC") ||
    value.startsWith("/") ||
    value.startsWith("\\") ||
    /^[a-z]:/i.test(value) ||
    value.includes("\\") ||
    value.includes("\u0000")
  ) {
    throw new ProvenanceError(errorCode);
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new ProvenanceError(errorCode);
  }
  if (Buffer.byteLength(value, "utf8") > limits.maxPathBytes) {
    throw new ProvenanceError("PATH_LIMIT_EXCEEDED");
  }
  return value;
}

function isSensitivePath(value) {
  return (
    typeof value !== "string" ||
    SENSITIVE_PATH_PATTERN.test(value) ||
    SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value))
  );
}

function isSafeScannerMetadata(value) {
  return (
    typeof value === "string" &&
    SAFE_SCANNER_METADATA.test(value) &&
    !isSensitivePath(value)
  );
}

function parseNulPaths(bytes, limits) {
  if (bytes.length === 0) return [];
  if (bytes.at(-1) !== 0) throw new ProvenanceError("GIT_INSPECTION_FAILED");
  const rawEntries = [];
  let start = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== 0) continue;
    try {
      rawEntries.push(utf8Decoder.decode(bytes.subarray(start, index)));
    } catch {
      throw new ProvenanceError("FILE_UNSAFE");
    }
    start = index + 1;
  }
  if (rawEntries.length > limits.maxUntrackedFiles) {
    throw new ProvenanceError("FILE_COUNT_LIMIT_EXCEEDED");
  }
  const entries = rawEntries.map((entry) => normalizeRelativePath(entry, limits));
  entries.sort(compareText);
  if (new Set(entries).size !== entries.length) throw new ProvenanceError("FILE_UNSAFE");
  return entries;
}

function resolveInsideRoot(root, relativePath) {
  const target = path.resolve(root, relativePath);
  if (!isInsideRoot(root, target)) throw new ProvenanceError("FILE_UNSAFE");
  return target;
}

function isInsideRoot(root, target) {
  return target !== root && target.startsWith(`${root}${path.sep}`);
}

function sameFileIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

function decodeTrimmed(bytes) {
  try {
    return utf8Decoder.decode(bytes).trim();
  } catch {
    throw new ProvenanceError("GIT_INSPECTION_FAILED");
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) throw new ProvenanceError("INVALID_MANIFEST");
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareText)
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareText(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

async function withSafeErrors(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ProvenanceError) throw error;
    throw new ProvenanceError("INVALID_MANIFEST");
  }
}

function withSafeErrorsSync(operation) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof ProvenanceError) throw error;
    throw new ProvenanceError("INVALID_MANIFEST");
  }
}
