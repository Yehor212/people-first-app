import { storageGetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import type { OfflineActionPriority, OfflineActionType } from "@/lib/offlineQueue";

const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const DISABLED_VALUES = new Set(["0", "false", "no", "off"]);
const MAX_RECEIPTS = 30;
const RECEIPT_KINDS = new Set<SyncHealthReceipt["kind"]>([
  "startup",
  "queued",
  "processed",
  "failed",
  "offline",
  "session-missing",
  "leader-skipped",
  "queue-draining",
  "queue-drained",
  "queue-blocked",
  "delta-empty",
  "delta-applied",
  "snapshot-applied",
  "gap-recovered",
  "error",
]);
const RECEIPT_SOURCES = new Set<SyncHealthReceipt["source"]>([
  "runtime",
  "delta",
  "queue",
  "resume",
]);
const SAFE_ACTION_TYPES = new Set<OfflineActionType | "offline-queue">([
  "CREATE_MOOD",
  "UPDATE_MOOD",
  "DELETE_MOOD",
  "CREATE_HABIT",
  "UPDATE_HABIT",
  "DELETE_HABIT",
  "TOGGLE_HABIT",
  "CREATE_FOCUS_SESSION",
  "CREATE_GRATITUDE",
  "DELETE_GRATITUDE",
  "UPDATE_SETTINGS",
  "DELETE_SETTINGS",
  "SYNC_JOURNAL_ENTRY",
  "DELETE_JOURNAL_ENTRY",
  "UPLOAD_JOURNAL_PHOTO_STORAGE",
  "UPLOAD_JOURNAL_AUDIO_STORAGE",
  "DELETE_JOURNAL_PHOTO_STORAGE",
  "DELETE_JOURNAL_AUDIO_STORAGE",
  "MIGRATE_JOURNAL_SECURITY",
  "WRITE_SYNC_EVENT",
  "offline-queue",
]);
const SAFE_PRIORITIES = new Set<OfflineActionPriority>([
  "critical",
  "high",
  "normal",
  "low",
]);
const SAFE_ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "EvalError",
  "AggregateError",
  "AbortError",
  "QuotaExceededError",
  "NotAllowedError",
  "NotFoundError",
  "InvalidStateError",
  "NetworkError",
  "TimeoutError",
  "OfflineQueueLifecycleError",
  "DeviceSessionError",
  "UnknownError",
]);

export const SYNC_HEALTH_RECEIPT_EVENT = "zenflow:sync-health-receipt";

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

declare global {
  interface Window {
    __zenflowSyncHealth?: SyncHealthRecorder;
  }
}

function normalizeFlag(value: string | null | undefined): boolean {
  return ENABLED_VALUES.has((value || "").trim().toLowerCase());
}

function currentRoute(): string {
  return sanitizeRoute(`${window.location.pathname}${window.location.search}`);
}

function sanitizeRoute(route: unknown): string {
  if (typeof route !== "string") return "/";
  try {
    const url = new URL(route, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/")
      ? url.pathname
      : "/";
  } catch {
    return "/";
  }
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function sanitizeReceipt(
  receipt: Omit<SyncHealthReceipt, "at" | "route"> & { at?: number; route?: string },
): SyncHealthReceipt {
  const kind = RECEIPT_KINDS.has(receipt.kind) ? receipt.kind : "error";
  const source = RECEIPT_SOURCES.has(receipt.source) ? receipt.source : "runtime";
  const entry: SyncHealthReceipt = {
    kind,
    source,
    at: finiteNonNegative(receipt.at) ?? Date.now(),
    route: sanitizeRoute(receipt.route ?? currentRoute()),
  };

  const seq = finiteNonNegative(receipt.seq);
  const fetched = finiteNonNegative(receipt.fetched);
  const applied = finiteNonNegative(receipt.applied);
  if (seq !== undefined) entry.seq = seq;
  if (fetched !== undefined) entry.fetched = fetched;
  if (applied !== undefined) entry.applied = applied;
  if (
    receipt.actionType &&
    SAFE_ACTION_TYPES.has(receipt.actionType as OfflineActionType | "offline-queue")
  ) {
    entry.actionType = receipt.actionType;
  }
  if (receipt.priority && SAFE_PRIORITIES.has(receipt.priority as OfflineActionPriority)) {
    entry.priority = receipt.priority;
  }
  if (receipt.errorName && SAFE_ERROR_NAMES.has(receipt.errorName)) {
    entry.errorName = receipt.errorName;
  }
  return entry;
}

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

function patchHistory(recorder: SyncHealthRecorder): void {
  const patchMethod = <T extends "pushState" | "replaceState">(method: T) => {
    const original = window.history[method];
    window.history[method] = function patchedHistoryMethod(
      this: History,
      ...args: Parameters<History[T]>
    ) {
      const result = original.apply(this, args);
      queueMicrotask(() => recorder.update({ route: currentRoute() }));
      return result;
    } as History[T];
  };

  patchMethod("pushState");
  patchMethod("replaceState");
  window.addEventListener(
    "popstate",
    () => recorder.update({ route: currentRoute() }),
    { passive: true },
  );
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
      // Construct from known fields so a forged caller cannot persist extra
      // private payload through object spread.
      const next: SyncHealthSnapshot = { ...snapshot, updatedAt: Date.now() };
      if (patch.route !== undefined) next.route = sanitizeRoute(patch.route);
      if (typeof patch.online === "boolean") next.online = patch.online;
      if (["authenticated", "anonymous", "unknown"].includes(patch.auth ?? "")) {
        next.auth = patch.auth!;
      }
      const lastSeq = finiteNonNegative(patch.lastSeq);
      if (lastSeq !== undefined) next.lastSeq = lastSeq;
      if (patch.queue) {
        next.queue = {
          pending: finiteNonNegative(patch.queue.pending) ?? snapshot.queue.pending,
          criticalPending:
            finiteNonNegative(patch.queue.criticalPending) ?? snapshot.queue.criticalPending,
          processing:
            typeof patch.queue.processing === "boolean"
              ? patch.queue.processing
              : snapshot.queue.processing,
          lastProcessedAt:
            patch.queue.lastProcessedAt === null
              ? null
              : finiteNonNegative(patch.queue.lastProcessedAt) ?? snapshot.queue.lastProcessedAt,
        };
      }
      snapshot = next;
    },
    record: (receipt) => {
      // FR-031: construct from an allowlist. A forged object cannot smuggle
      // journal, mood, habit, auth, or PII fields into debug evidence.
      const entry = sanitizeReceipt(receipt);
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

  window.__zenflowSyncHealth = recorder;
  patchHistory(recorder);
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
    const safeReceipt = sanitizeReceipt(receipt);
    window.__zenflowSyncHealth?.record(safeReceipt);
    window.dispatchEvent(
      new CustomEvent(SYNC_HEALTH_RECEIPT_EVENT, {
        detail: safeReceipt,
      }),
    );
  }
}
