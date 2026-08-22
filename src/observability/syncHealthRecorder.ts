import { storageGetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import {
  sanitizeDiagnosticErrorName,
  sanitizeDiagnosticRoute,
} from "@/lib/diagnosticPrivacy";
import { registerAccountBoundaryRuntimeReset } from "@/storage/accountBoundaryRuntime";
import { subscribeDiagnosticRouteChange } from "./diagnosticRouteObserver";

const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const DISABLED_VALUES = new Set(["0", "false", "no", "off"]);
const MAX_RECEIPTS = 30;
const MAX_FUTURE_TIMESTAMP_SKEW_MS = 60_000;
const RECEIPT_KINDS = new Set<SyncHealthReceipt["kind"]>([
  "startup", "queued", "processed", "failed", "offline", "session-missing",
  "leader-skipped", "queue-draining", "queue-drained", "queue-blocked",
  "delta-empty", "delta-applied", "snapshot-applied", "gap-recovered", "error",
]);
const RECEIPT_SOURCES = new Set<SyncHealthReceipt["source"]>([
  "runtime", "delta", "queue", "resume",
]);
const ACTION_TYPES = new Set([
  "CREATE_MOOD", "UPDATE_MOOD", "DELETE_MOOD", "CREATE_HABIT", "UPDATE_HABIT",
  "DELETE_HABIT", "TOGGLE_HABIT", "CREATE_FOCUS_SESSION", "CREATE_GRATITUDE",
  "DELETE_GRATITUDE", "UPDATE_SETTINGS", "DELETE_SETTINGS", "SYNC_JOURNAL_ENTRY",
  "DELETE_JOURNAL_ENTRY", "UPLOAD_JOURNAL_PHOTO_STORAGE",
  "UPLOAD_JOURNAL_AUDIO_STORAGE", "DELETE_JOURNAL_PHOTO_STORAGE",
  "DELETE_JOURNAL_AUDIO_STORAGE", "MIGRATE_JOURNAL_SECURITY", "WRITE_SYNC_EVENT",
  "offline-queue",
]);
const PRIORITIES = new Set(["critical", "high", "normal", "low"]);

export const SYNC_HEALTH_RECEIPT_EVENT = "zenflow:sync-health-receipt";
export const SYNC_HEALTH_RESET_EVENT = "zenflow:sync-health-reset";

// Debug-only support surface: never store payload, entity ids, journal text, or
// habit names here. Keep it safe to inspect on public GitHub Pages sessions.
export type SyncHealthAuthState = "authenticated" | "anonymous" | "unknown";

export interface SyncHealthQueueSnapshot {
  pending: number;
  criticalPending: number;
  processing: boolean;
  lastProcessedAt: number | null;
}

export interface SyncHealthReceipt {
  kind:
    | "startup"
    | "queued"
    | "processed"
    | "failed"
    | "offline"
    | "session-missing"
    | "leader-skipped"
    | "queue-draining"
    | "queue-drained"
    | "queue-blocked"
    | "delta-empty"
    | "delta-applied"
    | "snapshot-applied"
    | "gap-recovered"
    | "error";
  source: "runtime" | "delta" | "queue" | "resume";
  at: number;
  route?: string;
  seq?: number;
  fetched?: number;
  applied?: number;
  actionType?: string;
  priority?: string;
  errorName?: string;
}

export interface SyncHealthSnapshot {
  version: 1;
  enabled: true;
  startedAt: number;
  updatedAt: number;
  route: string;
  online: boolean;
  auth: SyncHealthAuthState;
  lastSeq: number;
  queue: SyncHealthQueueSnapshot;
  lastReceipt: SyncHealthReceipt | null;
  receipts: SyncHealthReceipt[];
}

export interface SyncHealthUpdate {
  route?: string;
  online?: boolean;
  auth?: SyncHealthAuthState;
  lastSeq?: number;
  queue?: SyncHealthQueueSnapshot;
}

interface SyncHealthRecorder {
  enabled: true;
  snapshot: () => SyncHealthSnapshot;
  update: (patch: SyncHealthUpdate) => void;
  record: (receipt: Omit<SyncHealthReceipt, "at" | "route"> & { at?: number; route?: string }) => void;
}

let activeRecorderDispose: (() => void) | null = null;
let activeRecorderReset: (() => void) | null = null;

declare global {
  interface Window {
    __zenflowSyncHealth?: SyncHealthRecorder;
  }
}

function normalizeFlag(value: string | null | undefined): boolean {
  return ENABLED_VALUES.has((value || "").trim().toLowerCase());
}

function currentRoute(): string {
  return sanitizeDiagnosticRoute(window.location.href);
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function boundedCount(value: unknown): number | undefined {
  const numeric = finiteNonNegative(value);
  return numeric !== undefined && Number.isInteger(numeric) && numeric <= 1_000_000
    ? numeric
    : undefined;
}

function boundedTimestamp(value: unknown): number {
  const numeric = finiteNonNegative(value);
  const now = Date.now();
  return numeric !== undefined && numeric <= now + MAX_FUTURE_TIMESTAMP_SKEW_MS
    ? numeric
    : now;
}

function sanitizeQueueSnapshot(value: unknown): SyncHealthQueueSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Partial<SyncHealthQueueSnapshot>;
  const pending = boundedCount(input.pending);
  const criticalPending = boundedCount(input.criticalPending);
  if (
    pending === undefined ||
    criticalPending === undefined ||
    criticalPending > pending ||
    typeof input.processing !== "boolean"
  ) return null;
  const lastProcessedAt = input.lastProcessedAt === null
    ? null
    : finiteNonNegative(input.lastProcessedAt);
  if (lastProcessedAt === undefined) return null;
  return { pending, criticalPending, processing: input.processing, lastProcessedAt };
}

export function sanitizeSyncHealthReceipt(
  receipt: Partial<SyncHealthReceipt>,
): SyncHealthReceipt | null {
  if (!RECEIPT_KINDS.has(receipt.kind as SyncHealthReceipt["kind"])) return null;
  if (!RECEIPT_SOURCES.has(receipt.source as SyncHealthReceipt["source"])) return null;
  const at = boundedTimestamp(receipt.at);
  return {
    kind: receipt.kind as SyncHealthReceipt["kind"],
    source: receipt.source as SyncHealthReceipt["source"],
    at,
    route: sanitizeDiagnosticRoute(receipt.route ?? currentRoute()),
    ...(boundedCount(receipt.seq) === undefined ? {} : { seq: boundedCount(receipt.seq) }),
    ...(boundedCount(receipt.fetched) === undefined ? {} : { fetched: boundedCount(receipt.fetched) }),
    ...(boundedCount(receipt.applied) === undefined ? {} : { applied: boundedCount(receipt.applied) }),
    ...(typeof receipt.actionType === "string" && ACTION_TYPES.has(receipt.actionType)
      ? { actionType: receipt.actionType }
      : {}),
    ...(typeof receipt.priority === "string" && PRIORITIES.has(receipt.priority)
      ? { priority: receipt.priority }
      : {}),
    ...(receipt.errorName === undefined
      ? {}
      : { errorName: sanitizeDiagnosticErrorName(receipt.errorName) }),
  };
}

function clearSyncHealthRuntimeState(): void {
  if (typeof window === "undefined") return;
  activeRecorderReset?.();
  activeRecorderDispose?.();
  activeRecorderReset = null;
  activeRecorderDispose = null;
  delete window.__zenflowSyncHealth;
  window.dispatchEvent(new Event(SYNC_HEALTH_RESET_EVENT));
}

registerAccountBoundaryRuntimeReset(clearSyncHealthRuntimeState);

function defaultQueueSnapshot(): SyncHealthQueueSnapshot {
  return {
    pending: 0,
    criticalPending: 0,
    processing: false,
    lastProcessedAt: null,
  };
}

export function shouldEnableSyncHealthRecorder(
  search: string,
  storedFlag: string,
  devMode: boolean,
): boolean {
  const params = new URLSearchParams(search);
  const explicit =
    params.get("syncHealth") ??
    params.get("syncDebug") ??
    params.get("runtimeSync");

  if (explicit !== null) {
    const normalized = explicit.trim().toLowerCase();
    if (DISABLED_VALUES.has(normalized)) return false;
    return normalizeFlag(explicit);
  }

  return devMode || normalizeFlag(storedFlag);
}

export function installSyncHealthRecorder(
  search = typeof window !== "undefined" ? window.location.search : "",
  storedFlag =
    typeof window !== "undefined" ? storageGetRaw(SK.SYNC_HEALTH_RECORDER, "") : "",
  devMode = false,
): boolean {
  if (typeof window === "undefined") return false;

  if (window.__zenflowSyncHealth) {
    return true;
  }

  if (!shouldEnableSyncHealthRecorder(search, storedFlag, devMode)) {
    return false;
  }

  let snapshot: SyncHealthSnapshot = {
    version: 1,
    enabled: true,
    startedAt: performance.now(),
    updatedAt: Date.now(),
    route: currentRoute(),
    online: navigator.onLine,
    auth: "unknown",
    lastSeq: 0,
    queue: defaultQueueSnapshot(),
    lastReceipt: null,
    receipts: [],
  };

  const recorder: SyncHealthRecorder = {
    enabled: true,
    snapshot: () => ({
      ...snapshot,
      queue: { ...snapshot.queue },
      lastReceipt: snapshot.lastReceipt ? { ...snapshot.lastReceipt } : null,
      receipts: snapshot.receipts.map((receipt) => ({ ...receipt })),
    }),
    update: (patch) => {
      const route = patch.route === undefined ? snapshot.route : sanitizeDiagnosticRoute(patch.route);
      const queue = patch.queue === undefined
        ? snapshot.queue
        : (sanitizeQueueSnapshot(patch.queue) ?? snapshot.queue);
      const auth = patch.auth === "authenticated" || patch.auth === "anonymous" || patch.auth === "unknown"
        ? patch.auth
        : snapshot.auth;
      const lastSeq = boundedCount(patch.lastSeq) ?? snapshot.lastSeq;
      const online = typeof patch.online === "boolean" ? patch.online : snapshot.online;
      snapshot = {
        version: 1,
        enabled: true,
        startedAt: snapshot.startedAt,
        updatedAt: Date.now(),
        route,
        online,
        auth,
        lastSeq,
        queue,
        lastReceipt: snapshot.lastReceipt,
        receipts: snapshot.receipts,
      };
    },
    record: (receipt) => {
      const entry = sanitizeSyncHealthReceipt(receipt);
      if (!entry) return;
      const receipts = [...snapshot.receipts, entry].slice(-MAX_RECEIPTS);
      snapshot = {
        ...snapshot,
        updatedAt: entry.at,
        route: entry.route || snapshot.route,
        lastReceipt: entry,
        receipts,
      };
    },
  };

  activeRecorderReset = () => {
    snapshot = {
      version: 1,
      enabled: true,
      startedAt: performance.now(),
      updatedAt: Date.now(),
      route: currentRoute(),
      online: navigator.onLine,
      auth: "unknown",
      lastSeq: 0,
      queue: defaultQueueSnapshot(),
      lastReceipt: null,
      receipts: [],
    };
  };

  window.__zenflowSyncHealth = recorder;
  activeRecorderDispose = subscribeDiagnosticRouteChange(() => {
    recorder.update({ route: currentRoute() });
  });
  recorder.record({ kind: "startup", source: "runtime" });

  return true;
}

export function updateSyncHealthSnapshot(patch: SyncHealthUpdate): void {
  window.__zenflowSyncHealth?.update(patch);
}

export function recordSyncHealthReceipt(
  receipt: Omit<SyncHealthReceipt, "at" | "route"> & { at?: number; route?: string },
): void {
  if (typeof window !== "undefined") {
    const safeReceipt = sanitizeSyncHealthReceipt(receipt);
    if (!safeReceipt) return;
    window.__zenflowSyncHealth?.record(safeReceipt);
    window.dispatchEvent(
      new CustomEvent(SYNC_HEALTH_RECEIPT_EVENT, {
        detail: safeReceipt,
      }),
    );
  }
}
