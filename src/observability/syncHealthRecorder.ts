import { storageGetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const DISABLED_VALUES = new Set(["0", "false", "no", "off"]);
const MAX_RECEIPTS = 30;

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
  return `${window.location.pathname}${window.location.search}`;
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
      snapshot = {
        ...snapshot,
        ...patch,
        queue: patch.queue ? { ...patch.queue } : snapshot.queue,
        route: patch.route || snapshot.route,
        updatedAt: Date.now(),
      };
    },
    record: (receipt) => {
      const entry: SyncHealthReceipt = {
        ...receipt,
        at: receipt.at ?? Date.now(),
        route: receipt.route ?? currentRoute(),
      };
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
    window.__zenflowSyncHealth?.record(receipt);
    window.dispatchEvent(
      new CustomEvent(SYNC_HEALTH_RECEIPT_EVENT, {
        detail: receipt,
      }),
    );
  }
}
