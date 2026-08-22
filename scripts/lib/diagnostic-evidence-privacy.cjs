"use strict";

const SAFE_ROUTE_LABELS = new Set([
  "auth",
  "desktop",
  "diary",
  "focus",
  "habits",
  "home",
  "orb",
  "planning",
  "settings",
  "stats",
]);
const SAFE_EVIDENCE_STATUSES = new Set(["FAIL", "PARTIAL", "PASS", "SUMMARY", "UNVERIFIED"]);
const SAFE_AUTH_PROVIDERS = new Set(["apple", "facebook", "google", "telegram"]);
const SAFE_AUTH_REASONS = new Set([
  "facebook_invalid_scope",
  "facebook_invalid_scope_email",
  "facebook_redirect_reachable",
  "fetch_unavailable",
  "interactive_auth_timeout",
  "missing_redirect_location",
  "playwright_unavailable",
  "provider_invalid_scope",
  "provider_not_visible",
  "unexpected_redirect_host",
  "unparseable_redirect_location",
  "unparseable_redirect_url",
]);

/** Map any URL or path to a finite route label. Query, hash, host, ids, and userinfo are dropped. */
function sanitizeEvidenceRoute(value) {
  if (typeof value !== "string") return "unknown";
  try {
    const parsed = new URL(value, "https://diagnostic.invalid/");
    const segments = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.toLowerCase());
    if (segments.length === 0) return "home";
    const first = segments[0] === "people-first-app" ? segments[1] : segments[0];
    if (!first && segments[0] === "people-first-app") return "home";
    return first && SAFE_ROUTE_LABELS.has(first) && segments.length <= (segments[0] === "people-first-app" ? 2 : 1)
      ? first
      : "unknown";
  } catch {
    return "unknown";
  }
}

function sanitizeEvidenceUrl(value) {
  return `route:${sanitizeEvidenceRoute(value)}`;
}

/** Total boundary: arbitrary Errors, causes, proxies, and strings become one fixed code. */
function evidenceFailureCode(_value) {
  return "ZF_EVIDENCE_FAILURE";
}

function sanitizeEvidenceStatus(value, fallback = "UNVERIFIED") {
  return typeof value === "string" && SAFE_EVIDENCE_STATUSES.has(value)
    ? value
    : fallback;
}

function sanitizeEvidenceProvider(value) {
  return typeof value === "string" && SAFE_AUTH_PROVIDERS.has(value) ? value : "unknown";
}

function sanitizeEvidenceReason(value) {
  return typeof value === "string" && SAFE_AUTH_REASONS.has(value) ? value : "unknown";
}

const SAFE_HTTP_METHODS = new Set(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]);
const SAFE_RESOURCE_TYPES = new Set([
  "document", "fetch", "font", "image", "media", "script", "stylesheet", "websocket", "xhr",
]);
const SAFE_SYNC_AUTH = new Set(["authenticated", "anonymous", "unknown"]);
const SAFE_SYNC_KINDS = new Set([
  "startup", "queued", "processed", "failed", "offline", "session-missing",
  "leader-skipped", "queue-draining", "queue-drained", "queue-blocked",
  "delta-empty", "delta-applied", "snapshot-applied", "gap-recovered", "error",
]);
const SAFE_SYNC_SOURCES = new Set(["runtime", "delta", "queue", "resume"]);
const SAFE_SYNC_PRIORITIES = new Set(["critical", "high", "normal", "low"]);

function sanitizeEvidenceMethod(value) {
  const method = typeof value === "string" ? value.toUpperCase() : "";
  return SAFE_HTTP_METHODS.has(method) ? method : "OTHER";
}

function sanitizeEvidenceResourceType(value) {
  return typeof value === "string" && SAFE_RESOURCE_TYPES.has(value) ? value : "other";
}

function sanitizeEvidenceFailureClass(value) {
  if (typeof value !== "string") return "unknown";
  if (/timed?\s*out/i.test(value)) return "timeout";
  if (/abort|cancel/i.test(value)) return "aborted";
  if (/dns|name.*resolved/i.test(value)) return "dns";
  if (/refused|connection|network/i.test(value)) return "connection";
  if (/block/i.test(value)) return "blocked";
  return "unknown";
}

function boundedCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= 1_000_000 ? value : 0;
}

function sanitizeEvidenceCount(value) {
  return boundedCount(value);
}

function finiteTimestamp(value) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= Date.now() + 60_000
    ? value
    : 0;
}

function sanitizeSyncReceipt(value) {
  try {
    if (!value || typeof value !== "object") return null;
    if (!SAFE_SYNC_KINDS.has(value.kind) || !SAFE_SYNC_SOURCES.has(value.source)) return null;
    return {
      kind: value.kind,
      source: value.source,
      at: finiteTimestamp(value.at),
      route: sanitizeEvidenceRoute(value.route),
      ...(typeof value.seq === "number" ? { seq: boundedCount(value.seq) } : {}),
      ...(typeof value.fetched === "number" ? { fetched: boundedCount(value.fetched) } : {}),
      ...(typeof value.applied === "number" ? { applied: boundedCount(value.applied) } : {}),
      ...(SAFE_SYNC_PRIORITIES.has(value.priority) ? { priority: value.priority } : {}),
      ...(typeof value.actionType === "string" && /^[A-Z_]{3,48}$|^offline-queue$/.test(value.actionType)
        ? { actionType: value.actionType }
        : {}),
      ...(typeof value.errorName === "string" && /^(?:Error|TypeError|RangeError|ReferenceError|SyntaxError|URIError|AggregateError|AbortError|DOMException|UnknownError)$/.test(value.errorName)
        ? { errorName: value.errorName }
        : {}),
    };
  } catch {
    return null;
  }
}

function sanitizeSyncHealthEvidenceSnapshot(value) {
  try {
    const queue = value && typeof value.queue === "object" && value.queue ? value.queue : {};
    const receipts = Array.isArray(value?.receipts)
      ? value.receipts.map(sanitizeSyncReceipt).filter(Boolean).slice(-30)
      : [];
    return {
      route: sanitizeEvidenceRoute(value?.route),
      auth: SAFE_SYNC_AUTH.has(value?.auth) ? value.auth : "unknown",
      online: value?.online === true,
      lastSeq: boundedCount(value?.lastSeq),
      queue: {
        pending: boundedCount(queue.pending),
        criticalPending: boundedCount(queue.criticalPending),
        processing: queue.processing === true,
        lastProcessedAt: queue.lastProcessedAt === null ? null : finiteTimestamp(queue.lastProcessedAt),
      },
      receipts,
      lastReceipt: sanitizeSyncReceipt(value?.lastReceipt),
    };
  } catch {
    return {
      route: "unknown", auth: "unknown", online: false, lastSeq: 0,
      queue: { pending: 0, criticalPending: 0, processing: false, lastProcessedAt: null },
      receipts: [], lastReceipt: null,
    };
  }
}

module.exports = {
  evidenceFailureCode,
  sanitizeEvidenceCount,
  sanitizeEvidenceFailureClass,
  sanitizeEvidenceMethod,
  sanitizeEvidenceProvider,
  sanitizeEvidenceReason,
  sanitizeEvidenceResourceType,
  sanitizeEvidenceRoute,
  sanitizeEvidenceStatus,
  sanitizeEvidenceUrl,
  sanitizeSyncHealthEvidenceSnapshot,
};
