import { logger } from "@/lib/logger";
import { safeJsonParse, storageGetRaw, storageRemove, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

type LockMode = "exclusive" | "shared";

interface BrowserLock {
  name: string;
  mode: LockMode;
}

interface BrowserLocks {
  request<T>(
    name: string,
    options: { mode?: LockMode; ifAvailable?: boolean; signal?: AbortSignal },
    callback: (lock: BrowserLock | null) => T | Promise<T>
  ): Promise<T>;
}

type NavigatorWithLocks = Navigator & {
  locks?: BrowserLocks;
};

interface SyncLeaderLease {
  ownerId: string;
  token: string;
  expiresAt: number;
}

export interface SyncLeaderRunResult<T> {
  acquired: boolean;
  value?: T;
}

export const SYNC_LEADER_LOCK_NAME = "zenflow:sync-delta-owner";
const SYNC_LEADER_TTL_MS = 60_000;
const SKIPPED: SyncLeaderRunResult<never> = { acquired: false };

const makeId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

let tabOwnerId = makeId();

function getLocksApi(): BrowserLocks | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as NavigatorWithLocks).locks ?? null;
}

function readLease(): SyncLeaderLease | null {
  const raw = storageGetRaw(SK.SYNC_LEADER_LOCK, "");
  if (!raw) return null;

  const parsed = safeJsonParse<Partial<SyncLeaderLease> | null>(raw, null);
  if (
    !parsed ||
    typeof parsed.ownerId !== "string" ||
    typeof parsed.token !== "string" ||
    typeof parsed.expiresAt !== "number"
  ) {
    return null;
  }

  return parsed as SyncLeaderLease;
}

function writeLease(lease: SyncLeaderLease): void {
  storageSetRaw(SK.SYNC_LEADER_LOCK, JSON.stringify(lease));
}

function tryAcquireStorageLease(now: number, ttlMs: number): SyncLeaderLease | null {
  const current = readLease();
  if (current && current.expiresAt > now) {
    return null;
  }

  const lease: SyncLeaderLease = {
    ownerId: tabOwnerId,
    token: makeId(),
    expiresAt: now + ttlMs,
  };
  writeLease(lease);

  const confirmed = readLease();
  if (
    confirmed?.ownerId === lease.ownerId &&
    confirmed.token === lease.token &&
    confirmed.expiresAt === lease.expiresAt
  ) {
    return lease;
  }

  return null;
}

function releaseStorageLease(lease: SyncLeaderLease): void {
  const current = readLease();
  if (current?.ownerId === lease.ownerId && current.token === lease.token) {
    storageRemove(SK.SYNC_LEADER_LOCK);
  }
}

async function runWithStorageLease<T>(
  taskName: string,
  fn: () => Promise<T>,
  ttlMs: number
): Promise<SyncLeaderRunResult<T>> {
  let lease: SyncLeaderLease | null = null;
  try {
    lease = tryAcquireStorageLease(Date.now(), ttlMs);
  } catch (err) {
    logger.warn("[SyncLeader] Storage lease failed; running sync without cross-tab lock", {
      taskName,
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return { acquired: true, value: await fn() };
  }

  if (!lease) {
    logger.sync(`[SyncLeader] Skipped ${taskName}; another tab owns delta sync`);
    return { acquired: false };
  }

  try {
    return { acquired: true, value: await fn() };
  } finally {
    try {
      releaseStorageLease(lease);
    } catch (err) {
      logger.warn("[SyncLeader] Storage lease release failed", {
        taskName,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
}

/**
 * Runs exactly one pull/apply loop per browser profile where the platform allows it.
 *
 * Telegram-grade sync is cursor-driven: Broadcast and app-resume events wake the
 * client, but only one owner should advance the local delta cursor at a time.
 * Web Locks provide the strongest browser primitive. The storage lease covers
 * older Chrome/WebView/WKWebView contexts; storage-disabled environments fall
 * back to running the task so native single-webview users are not stranded.
 */
export async function runWithSyncLeaderLock<T>(
  taskName: string,
  fn: () => Promise<T>,
  options: { ttlMs?: number } = {}
): Promise<SyncLeaderRunResult<T>> {
  const locks = getLocksApi();
  const ttlMs = options.ttlMs ?? SYNC_LEADER_TTL_MS;

  if (locks) {
    return locks.request<SyncLeaderRunResult<T>>(
      SYNC_LEADER_LOCK_NAME,
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        if (!lock) {
          logger.sync(`[SyncLeader] Skipped ${taskName}; Web Locks owner is active`);
          return SKIPPED;
        }
        return { acquired: true, value: await fn() };
      }
    );
  }

  return runWithStorageLease(taskName, fn, ttlMs);
}

export function resetSyncLeaderForTests(): void {
  tabOwnerId = makeId();
  storageRemove(SK.SYNC_LEADER_LOCK);
}
