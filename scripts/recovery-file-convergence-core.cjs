"use strict";

const path = require("node:path");

const CLOSED_DISPOSITIONS = new Set([
  "MERGED",
  "ALREADY_CURRENT",
  "SUPERSEDED_WITH_EVIDENCE",
  "EXCLUDED_KIMI",
  "EXCLUDED_SECRET_PRIVATE",
  "EXCLUDED_GENERATED_CACHE",
  "EXCLUDED_DUPLICATE_COPY",
  "EXCLUDED_RIGHTS",
  "EXCLUDED_OBSOLETE_CONFLICT",
]);

const EVIDENCE_REQUIRED = new Set([
  "MERGED",
  "SUPERSEDED_WITH_EVIDENCE",
  "EXCLUDED_RIGHTS",
  "EXCLUDED_OBSOLETE_CONFLICT",
]);

function classifyMechanicalPolicy(record) {
  const packet = String(record?.packet || "");
  const sourceId = String(record?.sourceId || "");
  const relativePath = normalizeRelativePath(record?.path);
  const searchable = `${packet}\n${sourceId}\n${relativePath}`;

  if (/(^|[^a-z])kimi([^a-z]|$)/i.test(searchable)) return "EXCLUDED_KIMI";
  if (isSecretPath(relativePath) || Number(record?.secretMatches || 0) > 0) {
    return "EXCLUDED_SECRET_PRIVATE";
  }
  if (isGeneratedPath(relativePath)) return "EXCLUDED_GENERATED_CACHE";
  if (isDuplicateCopyPath(relativePath)) return "EXCLUDED_DUPLICATE_COPY";

  if (record?.sourceKind === "deletion-intent" && record?.mainSha256 == null) {
    return "ALREADY_CURRENT";
  }

  const sourceSha256 = String(record?.sourceSha256 || "");
  const mainSha256 = record?.mainSha256 == null ? null : String(record.mainSha256);
  if (isSha256(sourceSha256) && mainSha256 === sourceSha256) return "ALREADY_CURRENT";
  return "REVIEW_REQUIRED";
}

function collectPacketRecords(manifest, mainHashes = {}) {
  const records = [];
  const packetReports = Array.isArray(manifest?.packetReports) ? manifest.packetReports : [];
  for (const packetReport of packetReports) {
    const packet = String(packetReport?.packet || "");
    const entries = Array.isArray(packetReport?.entries) ? packetReport.entries : [];
    for (const entry of entries) {
      const entryDisposition = String(entry?.disposition || "");
      if (
        !["exported-non-main-variant", "deleted-in-working-variant"].includes(entryDisposition)
      ) {
        continue;
      }
      const relativePath = normalizeRelativePath(entry?.path);
      const mainSha256 = Object.hasOwn(mainHashes, relativePath)
        ? mainHashes[relativePath]
        : null;
      if (entryDisposition === "deleted-in-working-variant") {
        const record = {
          sourceId: `deletion-intent:${packet}:${relativePath}`,
          sourceKind: "deletion-intent",
          packet,
          path: relativePath,
          mainSha256,
          changeKind: "delete",
        };
        records.push({ ...record, disposition: classifyMechanicalPolicy(record) });
        continue;
      }

      const sourceSha256 = String(entry?.sha256 || "");
      if (!isSha256(sourceSha256)) {
        throw new Error(`exported file requires sha256: ${packet}:${relativePath}`);
      }
      const record = {
        sourceId: `dirty-file:${packet}:${relativePath}:${sourceSha256.slice(0, 12)}`,
        sourceKind: "dirty-file",
        packet,
        path: relativePath,
        sourceSha256,
        mainSha256,
        changeKind: "file-variant",
      };
      records.push({ ...record, disposition: classifyMechanicalPolicy(record) });
    }
  }
  return records.sort((left, right) =>
    left.packet.localeCompare(right.packet) ||
    left.path.localeCompare(right.path) ||
    left.sourceId.localeCompare(right.sourceId),
  );
}

function collectUniqueHeadShas(inventory) {
  const refs = Array.isArray(inventory?.refs) ? inventory.refs : [];
  return [
    ...new Set(
      refs
        .filter((entry) => entry?.classification === "UNIQUE_COMMITS")
        .map((entry) => String(entry?.head || ""))
        .filter((head) => /^[0-9a-f]{40,64}$/i.test(head)),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function buildVariantGroups(records) {
  const groups = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const relativePath = normalizeRelativePath(record?.path);
    const sha256 = String(record?.sourceSha256 || "");
    const sourceId = String(record?.sourceId || "");
    if (!relativePath || !isSha256(sha256) || !sourceId) {
      throw new Error("variant records require path, sourceId, and sha256");
    }
    if (!groups.has(relativePath)) groups.set(relativePath, new Map());
    const variants = groups.get(relativePath);
    if (!variants.has(sha256)) variants.set(sha256, new Set());
    variants.get(sha256).add(sourceId);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([relativePath, variants]) => {
      const normalizedVariants = [...variants.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([sha256, sourceIds]) => ({
          sha256,
          sourceIds: [...sourceIds].sort((left, right) => left.localeCompare(right)),
        }));
      return {
        path: relativePath,
        conflict: normalizedVariants.length > 1,
        variants: normalizedVariants,
      };
    });
}

function validateDecision(record) {
  const disposition = String(record?.disposition || "");
  if (disposition !== "REVIEW_REQUIRED" && !CLOSED_DISPOSITIONS.has(disposition)) {
    throw new Error(`unknown convergence disposition: ${disposition || "EMPTY"}`);
  }
  if (EVIDENCE_REQUIRED.has(disposition)) {
    const evidence = Array.isArray(record?.evidence)
      ? record.evidence.filter((entry) => String(entry || "").trim())
      : [];
    if (evidence.length === 0) {
      throw new Error(`${disposition} requires concrete evidence`);
    }
  }
}

function sanitizeLedgerRecord(record) {
  const cloned = JSON.parse(JSON.stringify(record || {}));
  visitStrings(cloned, (value) => {
    if (isAbsoluteLocator(value)) {
      throw new Error("durable ledger records cannot contain absolute paths");
    }
  });
  if (cloned.path != null) cloned.path = normalizeRelativePath(cloned.path);
  return cloned;
}

function summarizeLedger(records) {
  const counts = new Map();
  let open = 0;
  for (const record of Array.isArray(records) ? records : []) {
    const disposition = String(record?.disposition || "REVIEW_REQUIRED");
    counts.set(disposition, (counts.get(disposition) || 0) + 1);
    if (!CLOSED_DISPOSITIONS.has(disposition)) open += 1;
  }
  const byDisposition = Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
  return { total: Array.isArray(records) ? records.length : 0, byDisposition, open };
}

function isSecretPath(relativePath) {
  const lower = relativePath.toLowerCase();
  const base = path.posix.basename(lower);
  return (
    /^\.env(?:\.|$)/.test(base) ||
    base === "key.properties" ||
    /\.(?:jks|keystore|p12|pfx|pem|key)$/.test(base) ||
    /(?:^|[-_.])service[-_.]?account(?:[-_.]|$)/.test(base) ||
    /(?:^|[-_.])credentials?(?:[-_.]|$)/.test(base) ||
    /(?:^|\/)private(?:\/|$)/.test(lower)
  );
}

function isGeneratedPath(relativePath) {
  const components = relativePath.toLowerCase().split("/").filter(Boolean);
  return components.some(
    (component) =>
      component === "node_modules" ||
      component.startsWith("node_modules.") ||
      component === "build" ||
      component === "dist" ||
      component === "output" ||
      component === "coverage" ||
      component === ".cache" ||
      component === ".dccache" ||
      component === ".gradle" ||
      component === "deriveddata" ||
      component === ".codex-recovery",
  );
}

function isDuplicateCopyPath(relativePath) {
  const base = path.posix.basename(relativePath);
  return /\s+[2-9](?=\.[^.]+$|$)/.test(base);
}

function normalizeRelativePath(value) {
  const normalized = String(value || "").replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized) return "";
  if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
    throw new Error("recovery path must be repository-relative");
  }
  return path.posix.normalize(normalized);
}

function isSha256(value) {
  return /^[0-9a-f]{64}$/i.test(String(value || ""));
}

function isAbsoluteLocator(value) {
  const text = String(value || "");
  return path.isAbsolute(text) || /^[a-z]:[\\/]/i.test(text) || /^file:\/\//i.test(text);
}

function visitStrings(value, visitor) {
  if (typeof value === "string") {
    visitor(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visitStrings(item, visitor);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) visitStrings(item, visitor);
  }
}

module.exports = {
  buildVariantGroups,
  classifyMechanicalPolicy,
  collectPacketRecords,
  collectUniqueHeadShas,
  sanitizeLedgerRecord,
  summarizeLedger,
  validateDecision,
};
