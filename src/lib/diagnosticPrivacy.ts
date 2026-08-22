import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

/**
 * Privacy boundary for every local or external diagnostic sink.
 *
 * Callers may supply arbitrary Errors and context, so this module never tries
 * to redact content heuristically. It emits only fixed codes plus a small set
 * of bounded values whose vocabulary is owned here.
 */

export const DIAGNOSTIC_CODES = {
  log: "ZF_DIAG_LOG",
  info: "ZF_DIAG_INFO",
  warning: "ZF_DIAG_WARNING",
  error: "ZF_DIAG_ERROR",
  sync: "ZF_DIAG_SYNC",
  auth: "ZF_DIAG_AUTH",
  crash: "ZF_DIAG_CRASH",
  boundary: "ZF_DIAG_BOUNDARY",
  breadcrumb: "ZF_DIAG_BREADCRUMB",
  message: "ZF_DIAG_MESSAGE",
} as const;

export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES];

export type ExternalDiagnosticSinkState =
  | "disabled-by-default"
  | "unconfigured"
  | "enabled-with-explicit-choice";

export interface SafeDiagnosticMetadata {
  buffered?: boolean;
  category?:
    | "audio"
    | "cache"
    | "version-mismatch"
    | "storage"
    | "network"
    | "sync"
    | "general";
  count?: number;
  native?: boolean;
  phase?: "boot" | "runtime" | "render" | "recovery" | "storage" | "sync";
  platform?: "android" | "ios" | "web" | "pwa" | "desktop" | "unknown";
  retryable?: boolean;
  status?: "failed" | "blocked" | "deferred" | "recovered" | "completed";
}

export interface LocalDiagnosticRecord {
  schemaVersion: 1;
  code: DiagnosticCode;
  time: string;
  metadata?: SafeDiagnosticMetadata;
}

const CATEGORY_VALUES = new Set<NonNullable<SafeDiagnosticMetadata["category"]>>([
  "audio",
  "cache",
  "version-mismatch",
  "storage",
  "network",
  "sync",
  "general",
]);
const PHASE_VALUES = new Set<NonNullable<SafeDiagnosticMetadata["phase"]>>([
  "boot",
  "runtime",
  "render",
  "recovery",
  "storage",
  "sync",
]);
const PLATFORM_VALUES = new Set<NonNullable<SafeDiagnosticMetadata["platform"]>>([
  "android",
  "ios",
  "web",
  "pwa",
  "desktop",
  "unknown",
]);
const STATUS_VALUES = new Set<NonNullable<SafeDiagnosticMetadata["status"]>>([
  "failed",
  "blocked",
  "deferred",
  "recovered",
  "completed",
]);
const DIAGNOSTIC_CODE_VALUES = new Set<DiagnosticCode>(Object.values(DIAGNOSTIC_CODES));

export const LOCAL_CRASH_RECORD_LIMIT = 20;
export const LOCAL_ERROR_RECORD_LIMIT = 10;

let externalSinkState: ExternalDiagnosticSinkState = "disabled-by-default";

function boundedCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(10_000, Math.trunc(value)));
}

export function sanitizeDiagnosticMetadata(
  value: Record<string, unknown> | undefined
): SafeDiagnosticMetadata | undefined {
  if (!value) return undefined;

  const safe: SafeDiagnosticMetadata = {};
  if (typeof value.buffered === "boolean") safe.buffered = value.buffered;
  if (typeof value.retryable === "boolean") safe.retryable = value.retryable;
  if (typeof value.native === "boolean") safe.native = value.native;

  const count = boundedCount(value.count);
  if (count !== undefined) safe.count = count;

  if (typeof value.category === "string" && CATEGORY_VALUES.has(value.category as never)) {
    safe.category = value.category as SafeDiagnosticMetadata["category"];
  }
  if (typeof value.phase === "string" && PHASE_VALUES.has(value.phase as never)) {
    safe.phase = value.phase as SafeDiagnosticMetadata["phase"];
  }
  if (typeof value.platform === "string" && PLATFORM_VALUES.has(value.platform as never)) {
    safe.platform = value.platform as SafeDiagnosticMetadata["platform"];
  }
  if (typeof value.status === "string" && STATUS_VALUES.has(value.status as never)) {
    safe.status = value.status as SafeDiagnosticMetadata["status"];
  }

  return Object.keys(safe).length > 0 ? safe : undefined;
}

export function createDiagnosticError(code: DiagnosticCode): Error {
  const error = new Error(code);
  error.name = "ZenFlowDiagnosticError";
  // A caller-owned stack can contain journal text, route fragments, local
  // paths, or arbitrary thrown values. Fixed-code diagnostics do not retain it.
  error.stack = undefined;
  return error;
}

function isLocalDiagnosticRecord(value: unknown): value is LocalDiagnosticRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LocalDiagnosticRecord>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.code === "string" &&
    DIAGNOSTIC_CODE_VALUES.has(candidate.code) &&
    typeof candidate.time === "string" &&
    candidate.time.length <= 32
  );
}

export function persistLocalDiagnosticRecord(
  storageKey: typeof SK.CRASH_LOG | typeof SK.ERROR_LOG,
  code: DiagnosticCode,
  metadata: Record<string, unknown> | undefined,
  limit: number
): void {
  try {
    const existing = safeLocalStorageGet<unknown[]>(storageKey, []);
    // Legacy entries contained raw messages/stacks. They are intentionally
    // discarded instead of migrated into the new privacy-safe record format.
    const retained = Array.isArray(existing) ? existing.filter(isLocalDiagnosticRecord) : [];
    const safeMetadata = sanitizeDiagnosticMetadata(metadata);
    const entry: LocalDiagnosticRecord = {
      schemaVersion: 1,
      code,
      time: new Date().toISOString(),
      ...(safeMetadata ? { metadata: safeMetadata } : {}),
    };
    safeLocalStorageSet(storageKey, [...retained, entry].slice(-Math.max(1, limit)));
  } catch {
    // Diagnostics must never mask the original failure.
  }
}

export function clearLocalDiagnosticRecords(): void {
  safeLocalStorageSet(SK.ERROR_LOG, []);
  safeLocalStorageSet(SK.CRASH_LOG, []);
}

export function getExternalDiagnosticSinkState(): ExternalDiagnosticSinkState {
  return externalSinkState;
}

export function setExternalDiagnosticSinkState(state: ExternalDiagnosticSinkState): void {
  externalSinkState = state;
}

export function resetExternalDiagnosticSinkStateForTests(): void {
  externalSinkState = "disabled-by-default";
}
