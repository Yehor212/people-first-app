import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const syncState = vi.hoisted(() => ({
  currentUserId: "account-a",
  localOwnerUserId: "account-a",
  pendingImportedBackupClaim: false,
  events: [] as string[],
}));

const mocks = vi.hoisted(() => ({
  broadcastChange: vi.fn(),
  exportBackup: vi.fn(),
  fetchAndMergeServerTombstones: vi.fn(async () => ({
    mood: new Set(),
    habit: new Set(),
    focus: new Set(),
    gratitude: new Set(),
    journal: new Set(),
  })),
  importBackup: vi.fn(),
  syncOrchestrator: vi.fn(),
  suspendOrchestrator: vi.fn(async () => undefined),
  resumeOrchestrator: vi.fn(),
  triggerDataRefresh: vi.fn(async () => undefined),
  upsert: vi.fn(async (value: { user_id: string }) => {
    syncState.events.push(`upsert:${value.user_id}`);
    return { error: null };
  }),
}));

const REMOTE_BY_USER = {
  "account-a": {
    schemaVersion: 1,
    exportedAt: "2026-07-10T00:00:00.000Z",
    data: {
      moods: [{ id: "remote-a" }],
      habits: [],
      focusSessions: [],
      gratitudeEntries: [],
      journalEntries: [],
    },
  },
  "account-b": {
    schemaVersion: 1,
    exportedAt: "2026-07-10T00:00:00.000Z",
    data: {
      moods: [],
      habits: [{ id: "remote-b" }],
      focusSessions: [],
      gratitudeEntries: [],
      journalEntries: [],
    },
  },
} as const;

vi.mock("@/lib/syncBroadcast", () => ({
  broadcastChange: mocks.broadcastChange,
}));

vi.mock("@/storage/backup", () => ({
  exportBackup: mocks.exportBackup,
  importBackup: mocks.importBackup,
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: vi.fn(async () => syncState.localOwnerUserId),
}));

vi.mock("@/storage/accountBoundaryRuntime", () => ({
  readPendingLocalBackupAccountClaim: vi.fn(() =>
    syncState.pendingImportedBackupClaim
      ? { status: "pending", generation: "claim-generation" }
      : { status: "none" }
  ),
}));

vi.mock("@/features/journal/journalVaultEpoch", () => ({
  readDurableJournalVaultRevision: vi.fn(async () => ({
    protected: false,
    vaultRevision: null,
  })),
  validateJournalBackupVaultEpoch: vi.fn(),
}));

vi.mock("@/storage/sync/serverTombstones", () => ({
  fetchAndMergeServerTombstones: mocks.fetchAndMergeServerTombstones,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: mocks.triggerDataRefresh,
  runWithDataWriteBarrier: vi.fn(async (mutation: () => Promise<unknown>) => mutation()),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    sync: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/syncOrchestrator", () => ({
  syncOrchestrator: {
    sync: mocks.syncOrchestrator,
    suspendForAccountBoundary: mocks.suspendOrchestrator,
    resumeAfterAccountBoundary: mocks.resumeOrchestrator,
  },
}));

vi.mock("@/lib/validation", () => ({
  generateSecureRandom: vi.fn(() => "test-operation"),
  isAbortError: vi.fn(
    (error: unknown) => error instanceof DOMException && error.name === "AbortError"
  ),
}));

vi.mock("@/lib/sentry", () => ({
  addCategorizedBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => {
        const userId = syncState.currentUserId;
        syncState.events.push(`session:${userId}`);
        return {
          data: {
            session: {
              user: { id: userId },
            },
          },
        };
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((_column: string, userId: keyof typeof REMOTE_BY_USER) => ({
          maybeSingle: vi.fn(async () => ({
            data: {
              payload: REMOTE_BY_USER[userId],
              updated_at: "2026-07-10T00:00:00.000Z",
            },
            error: null,
          })),
        })),
      })),
      upsert: mocks.upsert,
    })),
  },
}));

import { destroyCloudSync, syncWithCloud } from "@/storage/cloudSync";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

const LOCAL_A = {
  schemaVersion: 1,
  exportedAt: "2026-07-10T00:00:00.000Z",
  data: {
    moods: [{ id: "local-a" }],
    habits: [],
    focusSessions: [],
    gratitudeEntries: [],
    journalEntries: [],
  },
};

const MERGED_A = {
  ...LOCAL_A,
  data: {
    ...LOCAL_A.data,
    moods: [{ id: "local-a" }, { id: "remote-a" }],
  },
};

const EMPTY_B = {
  schemaVersion: 1,
  exportedAt: "2026-07-10T00:00:00.000Z",
  data: {
    moods: [],
    habits: [],
    focusSessions: [],
    gratitudeEntries: [],
    journalEntries: [],
  },
};

const MERGED_B = {
  ...EMPTY_B,
  data: {
    ...EMPTY_B.data,
    habits: [{ id: "remote-b" }],
  },
};

describe("cloud sync account-boundary serialization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    destroyCloudSync();
    vi.clearAllMocks();
    syncState.currentUserId = "account-a";
    syncState.localOwnerUserId = "account-a";
    syncState.pendingImportedBackupClaim = false;
    syncState.events.splice(0);
  });

  afterEach(() => {
    destroyCloudSync();
    vi.useRealTimers();
  });

  it("performs no cloud work while an imported backup awaits an account choice", async () => {
    syncState.pendingImportedBackupClaim = true;

    await expect(syncWithCloud("merge", "account-a")).rejects.toThrow(
      "imported backup awaits an account choice"
    );

    expect(mocks.fetchAndMergeServerTombstones).not.toHaveBeenCalled();
    expect(mocks.exportBackup).not.toHaveBeenCalled();
    expect(mocks.importBackup).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("aborts user-a after an auth switch, then runs user-b replace", async () => {
    const importAStarted = deferred<void>();
    const releaseImportA = deferred<void>();
    mocks.exportBackup
      .mockResolvedValueOnce(LOCAL_A)
      .mockResolvedValueOnce(MERGED_A)
      .mockResolvedValueOnce(EMPTY_B)
      .mockResolvedValueOnce(MERGED_B);
    mocks.importBackup
      .mockImplementationOnce(async () => {
        syncState.events.push("import:account-a:merge:start");
        importAStarted.resolve(undefined);
        await releaseImportA.promise;
        syncState.events.push("import:account-a:merge:finish");
      })
      .mockImplementationOnce(async () => {
        syncState.events.push("import:account-b:replace");
      });

    const userAMerge = syncWithCloud("merge").catch((error: unknown) => error);
    await importAStarted.promise;

    syncState.currentUserId = "account-b";
    syncState.localOwnerUserId = "account-b";
    let userBSettled = false;
    const userBReplace = syncWithCloud("replace").then((result) => {
      userBSettled = true;
      return result;
    });
    await Promise.resolve();

    expect(userBSettled).toBe(false);
    const earlySessionEvents = syncState.events.filter((event) => event.startsWith("session:"));
    expect(earlySessionEvents.length).toBeGreaterThan(0);
    expect(earlySessionEvents.every((event) => event === "session:account-a")).toBe(true);

    releaseImportA.resolve(undefined);
    const userAResult = await userAMerge;
    const userBResult = await userBReplace;

    expect.soft(userAResult).toBeInstanceOf(Error);
    expect.soft((userAResult as Error).message).toContain("Authenticated account changed");
    expect.soft(userBResult).toEqual({ status: "pulled" });
    expect
      .soft(mocks.importBackup)
      .toHaveBeenNthCalledWith(1, REMOTE_BY_USER["account-a"], "merge", {
        expectedOwnerUserId: "account-a",
      });
    expect
      .soft(mocks.importBackup)
      .toHaveBeenNthCalledWith(2, REMOTE_BY_USER["account-b"], "replace", {
        expectedOwnerUserId: "account-b",
      });

    const userBSessionIndex = syncState.events.indexOf("session:account-b");
    expect.soft(syncState.events).not.toContain("upsert:account-a");
    expect
      .soft(userBSessionIndex)
      .toBeGreaterThan(syncState.events.indexOf("import:account-a:merge:finish"));
    expect.soft(syncState.events).toContain("import:account-b:replace");
  });

  it("refuses to export account A local data under an authenticated account B", async () => {
    syncState.currentUserId = "account-b";
    syncState.localOwnerUserId = "account-a";

    await expect(syncWithCloud("merge", "account-b")).rejects.toThrow(
      "Local data owner changed during cloud sync"
    );

    expect(mocks.exportBackup).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects the backup before any upload when local ownership changes during export", async () => {
    mocks.exportBackup.mockReset();
    mocks.exportBackup.mockImplementationOnce(async () => {
      syncState.events.push("export:account-a");
      syncState.localOwnerUserId = "account-b";
      return LOCAL_A;
    });

    await expect(syncWithCloud("merge", "account-a")).rejects.toThrow(
      "Local data owner changed during cloud sync"
    );

    expect(mocks.exportBackup).toHaveBeenCalledTimes(1);
    expect(syncState.events).toContain("export:account-a");
    expect(mocks.importBackup).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
