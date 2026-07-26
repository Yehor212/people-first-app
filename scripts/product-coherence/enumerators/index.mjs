import path from "node:path";

import { SUBJECT_IDS } from "../schemas.mjs";
import {
  compareText,
  inspectTrackedPath,
  isPlainObject,
  listTrackedPaths,
  resolveExactGitRoot,
  resolveInventoryLimits,
  sha256,
} from "./safe-files.mjs";
import {
  ASSET_EXTENSIONS,
  isSensitiveTrackedPath,
  LEXICAL_RULES,
  PATH_RULES,
  TEXT_EXTENSIONS,
} from "./rules.mjs";

const CODE_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/u;
const TRANSLATION_KEY_PATTERN =
  /[{,]\s*(?:([A-Za-z_$][A-Za-z0-9_$]*)|["']([A-Za-z_$][A-Za-z0-9_$]*)["'])\s*:/gu;
const ALLOWED_OPTIONS = new Set(["limits", "sanitizedUntrackedManifest", "testingHooks"]);

export async function enumerateProductCoherenceCandidates(rootDirectory, subjectId, options = {}) {
  validateInvocation(subjectId, options);
  if (Object.hasOwn(options, "sanitizedUntrackedManifest")) {
    throw new Error(
      "self-declared sanitized manifest rejected: verified provenance adapter is unavailable"
    );
  }

  const limits = resolveInventoryLimits(options.limits);
  const root = await resolveExactGitRoot(rootDirectory);
  const trackedPaths = await listTrackedPaths(root, limits);
  const budget = { filesRead: 0, totalBytes: 0 };
  const candidates = new Map();

  for (const locator of trackedPaths) {
    if (isSensitiveTrackedPath(locator)) {
      const inspected = await inspectTrackedPath(
        root,
        locator,
        limits,
        budget,
        options.testingHooks,
        "METADATA_ONLY"
      );
      addCandidate(candidates, limits, {
        subjectId,
        enumerator: "sensitive-tracked-paths",
        kind: "SENSITIVE_FILE_NOT_READ",
        locator,
        evidenceSeed: `metadata-only:${inspected.status}:${sha256(locator)}`,
        tags: {
          domains: ["privacy-blocker"],
          platforms: ["SECURITY_PRIVACY"],
          parser: "PATH_ONLY",
        },
      });
      continue;
    }

    const inspected = await inspectTrackedPath(root, locator, limits, budget, options.testingHooks);
    if (inspected.status !== "FILE") {
      addNonFileCandidate(candidates, limits, subjectId, locator, inspected.status);
      continue;
    }

    for (const rule of PATH_RULES) {
      const match = new RegExp(rule.pattern.source, rule.pattern.flags).exec(locator);
      if (!match) continue;
      const symbol = validatedIdentifier(rule.symbolFromPath?.(locator, match));
      addCandidate(candidates, limits, {
        subjectId,
        enumerator: rule.id,
        kind: rule.kind,
        locator,
        symbol,
        evidenceSeed: `${inspected.contentSha256}:${rule.id}`,
        tags: ruleTags(rule, "PATH"),
      });
    }

    const extension = path.posix.extname(locator).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) {
      if (!ASSET_EXTENSIONS.has(extension) && isProductSurfacePath(locator)) {
        addCandidate(candidates, limits, {
          subjectId,
          enumerator: "unsupported-surface-files",
          kind: "PARSER_UNCERTAINTY",
          locator,
          key: sha256(`unsupported-extension\u0000${extension}`),
          evidenceSeed: `${inspected.contentSha256}:unsupported-extension`,
          tags: {
            domains: ["parser-uncertainty"],
            platforms: ["TESTING"],
            parser: "UNSUPPORTED_FORMAT",
          },
        });
      }
      continue;
    }

    let source;
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(inspected.bytes);
    } catch {
      addCandidate(candidates, limits, {
        subjectId,
        enumerator: "invalid-utf8-surface-files",
        kind: "PARSER_UNCERTAINTY",
        locator,
        key: sha256(`invalid-utf8\u0000${inspected.contentSha256}`),
        evidenceSeed: `${inspected.contentSha256}:invalid-utf8`,
        tags: {
          domains: ["parser-uncertainty"],
          platforms: ["TESTING"],
          parser: "INVALID_UTF8",
        },
      });
      continue;
    }

    enumerateLexicalRules(candidates, limits, subjectId, locator, source, inspected.contentSha256);
    enumerateTranslationKeys(
      candidates,
      limits,
      subjectId,
      locator,
      source,
      inspected.contentSha256
    );
  }

  const rows = [...candidates.values()].sort(compareCandidates);
  return {
    schemaVersion: "1.0.0",
    subjectId,
    candidates: rows,
    stats: {
      trackedPaths: trackedPaths.length,
      filesRead: budget.filesRead,
      totalBytes: budget.totalBytes,
    },
    untracked: {
      status: "BLOCKED_UNAVAILABLE",
      enumerated: 0,
      reasonCode: "SANITIZED_UNTRACKED_MANIFEST_REQUIRED",
    },
  };
}

function enumerateLexicalRules(candidates, limits, subjectId, locator, source, contentSha256) {
  for (const rule of LEXICAL_RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const match of source.matchAll(pattern)) {
      const captured = rule.identifierCapture ? match[rule.identifierCapture] : undefined;
      const symbol = validatedIdentifier(captured);
      const key = symbol ? undefined : sha256(`lexical-key-v1\u0000${rule.id}\u0000${match[0]}`);
      addCandidate(candidates, limits, {
        subjectId,
        enumerator: rule.id,
        kind: rule.kind,
        locator,
        symbol,
        key,
        evidenceSeed: `${contentSha256}:${rule.id}:${match.index}:${sha256(match[0])}`,
        tags: ruleTags(rule, "LEXICAL"),
      });
    }
  }
}

function enumerateTranslationKeys(candidates, limits, subjectId, locator, source, contentSha256) {
  const localeMatch = /^src\/i18n\/languages\/(en|uk|es|de|fr|ja|ar|he)\.(?:js|ts)$/u.exec(locator);
  if (!localeMatch) return;

  const translationKeyPattern = new RegExp(
    TRANSLATION_KEY_PATTERN.source,
    TRANSLATION_KEY_PATTERN.flags
  );
  for (const match of source.matchAll(translationKeyPattern)) {
    const symbol = validatedIdentifier(match[1] ?? match[2]);
    if (!symbol) continue;
    addCandidate(candidates, limits, {
      subjectId,
      enumerator: "translation-keys",
      kind: "TRANSLATION_KEY",
      locator,
      symbol,
      evidenceSeed: `${contentSha256}:translation-key:${symbol}`,
      tags: {
        domains: ["i18n"],
        platforms: ["WEB", "PWA", "ANDROID", "IOS", "DESKTOP", "STORE_RELEASE"],
        parser: "LEXICAL_IDENTIFIER",
      },
    });
  }
}

function addNonFileCandidate(candidates, limits, subjectId, locator, status) {
  const isMissing = status === "MISSING";
  addCandidate(candidates, limits, {
    subjectId,
    enumerator: isMissing ? "tracked-worktree-deletions" : "unreadable-tracked-paths",
    kind: isMissing ? "LEGACY_GENERATED" : "PARSER_UNCERTAINTY",
    locator,
    key: sha256(`tracked-path-status\u0000${status}`),
    evidenceSeed: `${sha256(locator)}:${status}`,
    tags: {
      domains: [isMissing ? "worktree-deletion" : "parser-uncertainty"],
      platforms: ["TESTING"],
      parser: "PATH_ONLY",
    },
  });
}

function addCandidate(candidates, limits, input) {
  const discriminator = input.symbol
    ? `symbol:${input.symbol}`
    : input.key
      ? `key:${input.key}`
      : "none";
  const candidateId = `inventory:${sha256(
    [
      "product-coherence-candidate-v2",
      input.subjectId,
      input.enumerator,
      input.locator,
      discriminator,
    ].join("\u0000")
  )}`;
  if (candidates.has(candidateId)) return;
  if (candidates.size >= limits.maxRows) {
    throw new Error("inventory candidate row limit exceeded");
  }

  const candidate = {
    candidateId,
    subjectId: input.subjectId,
    enumerator: input.enumerator,
    kind: input.kind,
    locator: input.locator,
    ...(input.symbol ? { symbol: input.symbol } : {}),
    ...(input.key ? { key: input.key } : {}),
    evidenceSha256: sha256(
      [
        "product-coherence-evidence-v2",
        input.subjectId,
        input.enumerator,
        input.locator,
        discriminator,
        input.evidenceSeed,
      ].join("\u0000")
    ),
    tags: {
      domains: [...input.tags.domains],
      platforms: [...input.tags.platforms],
      parser: input.tags.parser,
    },
  };
  candidates.set(candidateId, candidate);
}

function validateInvocation(subjectId, options) {
  if (!SUBJECT_IDS.includes(subjectId)) {
    throw new Error(`subjectId must be one of ${SUBJECT_IDS.join(", ")}`);
  }
  if (!isPlainObject(options)) throw new Error("inventory options must be a plain object");
  const unknown = Object.keys(options).filter((key) => !ALLOWED_OPTIONS.has(key));
  if (unknown.length > 0)
    throw new Error(`unknown inventory option ${unknown.sort(compareText)[0]}`);
  if (options.testingHooks !== undefined && !isPlainObject(options.testingHooks)) {
    throw new Error("testingHooks must be a plain object");
  }
}

function ruleTags(rule, parser) {
  return {
    domains: rule.domains,
    platforms: rule.platforms,
    parser,
  };
}

function validatedIdentifier(value) {
  return typeof value === "string" && CODE_IDENTIFIER.test(value) ? value : undefined;
}

function isProductSurfacePath(locator) {
  return /^(?:android|docs|ios|public|scripts|src|src-tauri)\//u.test(locator);
}

function compareCandidates(left, right) {
  for (const field of ["locator", "enumerator", "kind", "symbol", "key", "candidateId"]) {
    const comparison = compareText(left[field] ?? "", right[field] ?? "");
    if (comparison !== 0) return comparison;
  }
  return 0;
}
