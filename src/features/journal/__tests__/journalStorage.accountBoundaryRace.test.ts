import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getJournalVaultKeyForWrite: vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)),
  generateId: vi.fn(() => "account-a-entry"),
}));

vi.mock("@/lib/cloudSyncSettings", () => ({ isCloudSyncEnabled: () => false }));
vi.mock("@/lib/utils", () => ({ generateId: mocks.generateId }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), log: vi.fn() },
}));
vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: () => Promise.resolve(null),
  getCurrentUserId: () => Promise.resolve(null),
}));
vi.mock("@/storage/realtimeSync", () => ({
  syncJournalEntry: vi.fn(() => Promise.resolve()),
  deleteJournalEntryFromCloud: vi.fn(() => Promise.resolve()),
  syncJournalPhoto: vi.fn(() => Promise.resolve()),
  syncJournalAudio: vi.fn(() => Promise.resolve()),
  deleteJournalPhotoFromCloud: vi.fn(() => Promise.resolve()),
  deleteJournalAudioFromCloud: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/storage/cloudSync", () => ({ triggerSync: vi.fn() }));
vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: { enqueue: vi.fn(() => Promise.resolve()) },
}));
vi.mock("@/storage/deletionTracker", () => ({
  DELETION_TRACKER_KEYS: {
    habit: "zenflow-deleted-habit-ids",
    journal: "zenflow-deleted-journal-entry-ids",
    mood: "zenflow-deleted-mood-ids",
    focus: "zenflow-deleted-focus-session-ids",
    gratitude: "zenflow-deleted-gratitude-ids",
  },
  trackDeletedJournalEntryId: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/storage/journalStorageService", () => ({
  uploadPhoto: vi.fn(() => Promise.resolve(null)),
  uploadEncryptedPhoto: vi.fn(() => Promise.resolve(null)),
  uploadAudio: vi.fn(() => Promise.resolve(null)),
  uploadEncryptedAudio: vi.fn(() => Promise.resolve(null)),
  deletePhotoFromStorage: vi.fn(() => Promise.resolve()),
  deleteAudioFromStorage: vi.fn(() => Promise.resolve()),
  deleteEntryMediaFromStorage: vi.fn(() => Promise.resolve()),
  deleteJournalMediaStoragePath: vi.fn(() => Promise.resolve()),
  downloadAsBase64: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("../journalWriteSecurity", () => ({
  getJournalVaultKeyForWrite: mocks.getJournalVaultKeyForWrite,
}));

import {
  clearLocalUserData,
  db,
  getLocalDataOwnerId,
  setLocalDataOwnerId,
} from "@/storage/db";
import { saveEntry } from "../journalStorage";

const DATA_WRITE_BARRIER_LOCK = "zenflow:data-write-barrier";
const JOURNAL_SECURITY_WRITE_LOCK = "zenflow:journal-security-write";

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

class FifoWebLockManager {
  private readonly tails = new Map<string, Promise<void>>();
  private readonly held = new Set<string>();
  private readonly requests = new Map<string, number>();
  private readonly requestOrder: string[] = [];
  private readonly requestWaiters = new Set<() => void>();

  request<T>(
    name: string,
    _options: { mode: "exclusive" },
    callback: (lock: unknown) => T | Promise<T>
  ): Promise<T> {
    this.requestOrder.push(name);
    this.requests.set(name, (this.requests.get(name) ?? 0) + 1);
    for (const notify of this.requestWaiters) notify();

    const previous = this.tails.get(name) ?? Promise.resolve();
    const release = deferred();
    const ready = previous.catch(() => undefined);
    const tail = ready.then(() => release.promise);
    this.tails.set(name, tail);

    return ready.then(async () => {
      this.held.add(name);
      try {
        return await callback({ name, mode: "exclusive" });
      } finally {
        this.held.delete(name);
        release.resolve();
        if (this.tails.get(name) === tail) {
          void tail.finally(() => this.tails.delete(name));
        }
      }
    });
  }

  isHeld(name: string): boolean {
    return this.held.has(name);
  }

  requestCount(name: string): number {
    return this.requests.get(name) ?? 0;
  }

  requestedLocks(): string[] {
    return [...this.requestOrder];
  }

  async waitForRequestCount(name: string, expected: number): Promise<void> {
    if (this.requestCount(name) >= expected) return;
    await new Promise<void>((resolve) => {
      const notify = () => {
        if (this.requestCount(name) < expected) return;
        this.requestWaiters.delete(notify);
        resolve();
      };
      this.requestWaiters.add(notify);
    });
  }
}

async function settledWithin(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  return Promise.race([
    promise.then(() => true),
    new Promise<boolean>((resolve) => {
      window.setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
}

function accountAEntry(content: string) {
  return {
    date: "2026-07-11",
    title: "Account A private entry",
    content,
    stickers: [],
    photoIds: [],
    tags: [],
  };
}

describe("journal writes at an origin-wide account boundary", () => {
  let originalLocks: PropertyDescriptor | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.getJournalVaultKeyForWrite.mockResolvedValue(null);
    mocks.generateId
      .mockReturnValueOnce("account-a-delayed-entry")
      .mockReturnValue("account-a-post-purge-entry");
    originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");
    localStorage.clear();
    db.close();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    if (originalLocks) {
      Object.defineProperty(navigator, "locks", originalLocks);
    } else {
      Reflect.deleteProperty(navigator, "locks");
    }
    localStorage.clear();
    db.close();
    await db.delete();
  });

  it("uses DATA then JOURNAL coordination so an old tab cannot save after account B is bound", async () => {
    const locks = new FifoWebLockManager();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: locks,
    });
    await setLocalDataOwnerId("account-a");

    const delayedSaveEntered = deferred();
    const releaseDelayedSave = deferred();
    mocks.getJournalVaultKeyForWrite.mockImplementationOnce(async () => {
      delayedSaveEntered.resolve();
      await releaseDelayedSave.promise;
      return null;
    });

    const delayedAccountASave = saveEntry(accountAEntry("delayed account A content"));
    await delayedSaveEntered.promise;
    expect(locks.isHeld(JOURNAL_SECURITY_WRITE_LOCK)).toBe(true);

    // Resetting the module graph models tab B. Its realm-local journal tail is
    // distinct, while the mocked Web Locks manager and IndexedDB origin remain shared.
    vi.resetModules();
    const { runWithDataWriteBarrier: runTabBBoundary } = await import(
      "@/hooks/useIndexedDB"
    );
    const expectedDataRequestCount = locks.requestCount(DATA_WRITE_BARRIER_LOCK) + 1;
    const accountBoundary = runTabBBoundary(
      async () => {
        await clearLocalUserData();
        await setLocalDataOwnerId("account-b");
      },
      { deferredWrites: "discard" }
    );
    await locks.waitForRequestCount(DATA_WRITE_BARRIER_LOCK, expectedDataRequestCount);
    const purgeFinishedBeforeJournalSave = await settledWithin(accountBoundary, 250);

    releaseDelayedSave.resolve();
    await delayedAccountASave;
    await accountBoundary;

    expect(locks.requestedLocks().slice(0, 3)).toEqual([
      JOURNAL_SECURITY_WRITE_LOCK,
      DATA_WRITE_BARRIER_LOCK,
      JOURNAL_SECURITY_WRITE_LOCK,
    ]);

    // A save initiated from the still-mounted account A realm after the purge
    // must fail closed instead of creating a row under account B's local owner.
    const stalePostPurgeSave = saveEntry(accountAEntry("post-purge account A content"));
    await expect(stalePostPurgeSave).rejects.toThrow(/account boundary/i);

    expect(purgeFinishedBeforeJournalSave).toBe(false);
    expect(await getLocalDataOwnerId()).toBe("account-b");
    expect(await db.journalEntries.toArray()).toEqual([]);
  });
});
