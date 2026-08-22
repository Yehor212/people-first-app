import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bootstrapSnapshotThenDelta: vi.fn(),
  fetchAndApplyDeltasInPages: vi.fn(),
  getCurrentSessionUserId: vi.fn<() => Promise<string | null>>(),
  getLastSeq: vi.fn(),
  saveLastSeq: vi.fn(),
  getServerMaxSeq: vi.fn(),
  authChangeCallback: null as
    | ((event: string, session: { user: { id: string } } | null) => void)
    | null,
  loggerSync: vi.fn(),
  offlineActions: [] as Array<{
    id: string;
    type: string;
    entityId: string;
    ownerUserId?: string;
    payload: unknown;
    timestamp: number;
    retries: number;
    maxRetries: number;
    priority?: string;
  }>,
  processQueue: vi.fn<() => Promise<void>>(),
  waitForQueueInit: vi.fn<() => Promise<void>>(),
  pullFromCloud: vi.fn(),
  recordSyncHealthReceipt: vi.fn(),
  remoteChangeCallback: null as
    | ((signal: { eventSeq?: number }) => void)
    | null,
  runWithSyncLeaderLock: vi.fn(),
  scheduleIdleCallbacks: [] as Array<() => void>,
  cancelIdle: vi.fn(),
  syncActions: [] as Array<{ type: string }>,
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    isFeatureVisible: (flag: string) => flag === "deltaSync",
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    sync: mocks.loggerSync,
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/syncBroadcast", () => ({
  onRemoteChange: vi.fn((callback: (signal: { eventSeq?: number }) => void) => {
    mocks.remoteChangeCallback = callback;
    return vi.fn();
  }),
}));

vi.mock("@/lib/syncLeader", () => ({
  runWithSyncLeaderLock: mocks.runWithSyncLeaderLock,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    getState: vi.fn(() => ({ actions: mocks.offlineActions })),
    processQueue: mocks.processQueue,
    waitForInit: mocks.waitForQueueInit,
  },
}));

vi.mock("@/lib/syncStateMachine", async () => {
  const actual = await vi.importActual<typeof import("@/lib/syncStateMachine")>(
    "@/lib/syncStateMachine"
  );
  return {
    ...actual,
    syncReducer: (state: Parameters<typeof actual.syncReducer>[0], action: Parameters<typeof actual.syncReducer>[1]) => {
      mocks.syncActions.push(action);
      return actual.syncReducer(state, action);
    },
  };
});

vi.mock("@/lib/scheduleIdle", () => ({
  scheduleIdle: vi.fn((callback: () => void) => {
    mocks.scheduleIdleCallbacks.push(callback);
    return { cancel: mocks.cancelIdle };
  }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(
        (callback: (event: string, session: { user: { id: string } } | null) => void) => {
          mocks.authChangeCallback = callback;
          return {
            data: {
              subscription: {
                unsubscribe: vi.fn(),
              },
            },
          };
        }
      ),
    },
  },
}));

vi.mock("@/storage/eventSync", () => ({
  fetchAndApplyDeltasInPages: mocks.fetchAndApplyDeltasInPages,
  getLastSeq: mocks.getLastSeq,
  getServerMaxSeq: mocks.getServerMaxSeq,
  saveLastSeq: mocks.saveLastSeq,
}));

vi.mock("@/storage/initialDeltaSync", () => ({
  bootstrapSnapshotThenDelta: mocks.bootstrapSnapshotThenDelta,
}));

vi.mock("@/storage/realtimeSync", () => ({
  pullFromCloud: mocks.pullFromCloud,
}));

vi.mock("@/observability/syncHealthRecorder", () => ({
  recordSyncHealthReceipt: mocks.recordSyncHealthReceipt,
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(async () => ({
      remove: vi.fn(),
    })),
  },
}));

import { useDeltaSyncEffects } from "../useDeltaSyncEffects";

describe("useDeltaSyncEffects", () => {
  beforeEach(() => {
    mocks.fetchAndApplyDeltasInPages.mockResolvedValue({
      fetched: 0,
      applied: 0,
      lastSeq: 10,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    mocks.offlineActions = [];
    mocks.processQueue.mockResolvedValue(undefined);
    mocks.waitForQueueInit.mockResolvedValue(undefined);
    mocks.scheduleIdleCallbacks.length = 0;
    mocks.syncActions.length = 0;
    mocks.authChangeCallback = null;
    mocks.remoteChangeCallback = null;
  });

  it("defers startup delta sync and does not start cloud sync without an authenticated session", async () => {
    mocks.getCurrentSessionUserId.mockResolvedValue(null);

    const { unmount } = renderHook(() => useDeltaSyncEffects());

    expect(mocks.getCurrentSessionUserId).not.toHaveBeenCalled();
    expect(mocks.scheduleIdleCallbacks).toHaveLength(1);

    mocks.scheduleIdleCallbacks[0]();

    await waitFor(() => {
      expect(mocks.getCurrentSessionUserId).toHaveBeenCalled();
    });

    expect(mocks.runWithSyncLeaderLock).not.toHaveBeenCalled();
    expect(mocks.fetchAndApplyDeltasInPages).not.toHaveBeenCalled();
    expect(mocks.bootstrapSnapshotThenDelta).not.toHaveBeenCalled();
    expect(mocks.pullFromCloud).not.toHaveBeenCalled();
    expect(mocks.loggerSync).toHaveBeenCalledWith("[DeltaSync] Skipped; no authenticated session");

    unmount();
    expect(mocks.cancelIdle).toHaveBeenCalled();
  });

  it("drains queued local actions before fetching remote deltas", async () => {
    mocks.getCurrentSessionUserId.mockResolvedValue("user-1");
    mocks.getLastSeq.mockResolvedValue(10);
    mocks.fetchAndApplyDeltasInPages.mockResolvedValue({
      fetched: 0,
      applied: 0,
      lastSeq: 10,
    });
    mocks.runWithSyncLeaderLock.mockImplementation(async (_name, task) => ({
      acquired: true,
      value: await task(),
    }));
    mocks.offlineActions = [
      {
        id: "queued-event",
        type: "WRITE_SYNC_EVENT",
        entityId: "sync-event:habit:habit-1:upsert",
        ownerUserId: "user-1",
        payload: {},
        timestamp: 1,
        retries: 0,
        maxRetries: 20,
        priority: "critical",
      },
    ];
    mocks.processQueue.mockImplementation(async () => {
      mocks.offlineActions = [];
    });

    const { unmount } = renderHook(() => useDeltaSyncEffects());
    mocks.scheduleIdleCallbacks[0]();

    await waitFor(() => {
      expect(mocks.fetchAndApplyDeltasInPages).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    expect(mocks.processQueue.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.fetchAndApplyDeltasInPages.mock.invocationCallOrder[0]
    );
    expect(mocks.recordSyncHealthReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "queue-draining", actionType: "WRITE_SYNC_EVENT" })
    );
    expect(mocks.recordSyncHealthReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "queue-drained", actionType: "WRITE_SYNC_EVENT" })
    );

    unmount();
  });

  it("waits for cold-start queue hydration and drain before an auth-triggered delta pull", async () => {
    let releaseQueueInit: () => void = () => undefined;
    const queueInit = new Promise<void>((resolve) => {
      releaseQueueInit = resolve;
    });
    mocks.waitForQueueInit.mockReturnValue(queueInit);
    mocks.getCurrentSessionUserId.mockResolvedValue("account-a");
    mocks.getLastSeq.mockResolvedValue(10);
    mocks.fetchAndApplyDeltasInPages.mockResolvedValue({
      fetched: 0,
      applied: 0,
      lastSeq: 10,
    });
    mocks.runWithSyncLeaderLock.mockImplementation(async (_name, task) => ({
      acquired: true,
      value: await task(),
    }));
    mocks.processQueue.mockImplementation(async () => {
      mocks.offlineActions = [];
    });

    const { unmount } = renderHook(() => useDeltaSyncEffects());
    mocks.authChangeCallback?.("SIGNED_IN", { user: { id: "account-a" } });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const fetchedBeforeHydration =
      mocks.fetchAndApplyDeltasInPages.mock.calls.length > 0;

    mocks.offlineActions = [
      {
        id: "persisted-current-owner-event",
        type: "WRITE_SYNC_EVENT",
        entityId: "sync-event:setting:privacy:upsert",
        ownerUserId: "account-a",
        payload: {},
        timestamp: 1,
        retries: 0,
        maxRetries: 20,
        priority: "critical",
      },
    ];
    releaseQueueInit();

    expect(fetchedBeforeHydration).toBe(false);
    await waitFor(() => {
      expect(mocks.fetchAndApplyDeltasInPages).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
    expect(mocks.processQueue).toHaveBeenCalledTimes(1);
    expect(mocks.processQueue.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.fetchAndApplyDeltasInPages.mock.invocationCallOrder[0]
    );

    unmount();
  });

  it("blocks delta pulls while saved local actions remain unsent", async () => {
    mocks.getCurrentSessionUserId.mockResolvedValue("user-1");
    mocks.getLastSeq.mockResolvedValue(10);
    mocks.runWithSyncLeaderLock.mockImplementation(async (_name, task) => ({
      acquired: true,
      value: await task(),
    }));
    mocks.offlineActions = [
      {
        id: "blocked-event",
        type: "WRITE_SYNC_EVENT",
        entityId: "sync-event:journal:journal-1:upsert",
        ownerUserId: "user-1",
        payload: {},
        timestamp: 1,
        retries: 20,
        maxRetries: 20,
        priority: "critical",
      },
    ];

    const { unmount } = renderHook(() => useDeltaSyncEffects());
    mocks.scheduleIdleCallbacks[0]();

    await waitFor(() => {
      expect(mocks.recordSyncHealthReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "queue-blocked", actionType: "WRITE_SYNC_EVENT" })
      );
    });

    expect(mocks.fetchAndApplyDeltasInPages).not.toHaveBeenCalled();
    expect(mocks.syncActions).not.toContainEqual(
      expect.objectContaining({ type: "QUEUE_DRAINED" })
    );

    unmount();
  });

  it("reports priority-critical cleanup telemetry while the exhausted row blocks delta", async () => {
    mocks.getCurrentSessionUserId.mockResolvedValue("user-1");
    mocks.getLastSeq.mockResolvedValue(10);
    mocks.runWithSyncLeaderLock.mockImplementation(async (_name, task) => ({
      acquired: true,
      value: await task(),
    }));
    mocks.offlineActions = [
      {
        id: "blocked-critical-cleanup",
        type: "DELETE_JOURNAL_PHOTO_STORAGE",
        entityId: "journal-photo-delete:photo-1",
        ownerUserId: "user-1",
        payload: { id: "photo-1" },
        timestamp: 1,
        retries: 1,
        maxRetries: 1,
        priority: "critical",
      },
    ];

    const { unmount } = renderHook(() => useDeltaSyncEffects());
    mocks.scheduleIdleCallbacks[0]();

    await waitFor(() => {
      expect(mocks.recordSyncHealthReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "queue-blocked", priority: "critical" })
      );
    });

    expect(mocks.fetchAndApplyDeltasInPages).not.toHaveBeenCalled();

    unmount();
  });

  it("lets the current owner pull deltas while legacy and other-owner actions stay quarantined", async () => {
    mocks.getCurrentSessionUserId.mockResolvedValue("account-a");
    mocks.getLastSeq.mockResolvedValue(10);
    mocks.fetchAndApplyDeltasInPages.mockResolvedValue({
      fetched: 0,
      applied: 0,
      lastSeq: 10,
    });
    mocks.runWithSyncLeaderLock.mockImplementation(async (_name, task) => ({
      acquired: true,
      value: await task(),
    }));
    mocks.offlineActions = [
      {
        id: "legacy-ownerless-event",
        type: "WRITE_SYNC_EVENT",
        entityId: "sync-event:habit:legacy-habit:upsert",
        payload: {},
        timestamp: 1,
        retries: 0,
        maxRetries: 20,
        priority: "critical",
      },
      {
        id: "account-b-event",
        type: "WRITE_SYNC_EVENT",
        entityId: "sync-event:habit:account-b-habit:upsert",
        ownerUserId: "account-b",
        payload: {},
        timestamp: 2,
        retries: 20,
        maxRetries: 20,
        priority: "critical",
      },
    ];
    const quarantinedActions = mocks.offlineActions.map((action) => ({ ...action }));

    const { unmount } = renderHook(() => useDeltaSyncEffects());
    mocks.scheduleIdleCallbacks[0]();

    await waitFor(() => {
      expect(mocks.fetchAndApplyDeltasInPages).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    expect(mocks.processQueue).not.toHaveBeenCalled();
    expect(mocks.offlineActions).toEqual(quarantinedActions);
    expect(mocks.recordSyncHealthReceipt).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "queue-blocked" })
    );

    unmount();
  });

  it("aborts and discards a delayed account A delta after a non-null switch to account B", async () => {
    let activeOwner = "account-a";
    let resolveAccountADelta!: (result: {
      fetched: number;
      applied: number;
      lastSeq: number;
    }) => void;
    const accountADelta = new Promise<{
      fetched: number;
      applied: number;
      lastSeq: number;
    }>((resolve) => {
      resolveAccountADelta = resolve;
    });

    mocks.getCurrentSessionUserId.mockImplementation(async () => activeOwner);
    mocks.getLastSeq.mockResolvedValue(10);
    mocks.fetchAndApplyDeltasInPages
      .mockImplementationOnce(() => accountADelta)
      .mockResolvedValueOnce({ fetched: 0, applied: 0, lastSeq: 10 });
    mocks.runWithSyncLeaderLock.mockImplementation(async (_name, task) => ({
      acquired: true,
      value: await task(),
    }));

    const { unmount } = renderHook(() => useDeltaSyncEffects());
    mocks.scheduleIdleCallbacks[0]();

    await waitFor(() => {
      expect(mocks.fetchAndApplyDeltasInPages).toHaveBeenCalledTimes(1);
    });
    const accountASignal = (
      mocks.fetchAndApplyDeltasInPages.mock.calls[0][1] as {
        signal: AbortSignal;
      }
    ).signal;

    activeOwner = "account-b";
    mocks.authChangeCallback?.("SIGNED_IN", { user: { id: "account-b" } });

    expect(accountASignal.aborted).toBe(true);

    resolveAccountADelta({ fetched: 1, applied: 1, lastSeq: 11 });

    await waitFor(() => {
      expect(mocks.fetchAndApplyDeltasInPages).toHaveBeenCalledTimes(2);
    });

    unmount();
  });

  it("discards a delayed account A snapshot fallback before reading account B server sequence", async () => {
    let activeOwner = "account-a";
    let resolveAccountASnapshot!: (applied: boolean) => void;
    const accountASnapshot = new Promise<boolean>((resolve) => {
      resolveAccountASnapshot = resolve;
    });

    mocks.getCurrentSessionUserId.mockImplementation(async () => activeOwner);
    mocks.getLastSeq.mockResolvedValue(10);
    mocks.fetchAndApplyDeltasInPages.mockResolvedValue({
      fetched: 0,
      applied: 0,
      lastSeq: 50,
    });
    mocks.pullFromCloud.mockImplementationOnce(() => accountASnapshot);
    mocks.runWithSyncLeaderLock.mockImplementation(async (_name, task) => ({
      acquired: true,
      value: await task(),
    }));

    const { unmount } = renderHook(() => useDeltaSyncEffects());
    mocks.remoteChangeCallback?.({ eventSeq: 2002 });

    await waitFor(() => {
      expect(mocks.pullFromCloud).toHaveBeenCalledTimes(1);
    });

    activeOwner = "account-b";
    mocks.authChangeCallback?.("TOKEN_REFRESHED", { user: { id: "account-b" } });
    resolveAccountASnapshot(true);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(mocks.getServerMaxSeq).toHaveBeenCalledTimes(1);
    expect(mocks.getServerMaxSeq).toHaveBeenCalledWith("account-a");
    expect(mocks.fetchAndApplyDeltasInPages).not.toHaveBeenCalledWith(
      50,
      expect.anything()
    );

    unmount();
  });

  it("applies a vault-removal event that lands during a gap-fallback snapshot before advancing the cursor", async () => {
    let finishSnapshot!: (applied: boolean) => void;
    const snapshot = new Promise<boolean>((resolve) => {
      finishSnapshot = resolve;
    });
    mocks.getCurrentSessionUserId.mockResolvedValue("account-a");
    mocks.getServerMaxSeq.mockResolvedValue(50);
    mocks.pullFromCloud.mockReturnValue(snapshot);
    mocks.fetchAndApplyDeltasInPages.mockResolvedValue({
      fetched: 1,
      applied: 1,
      lastSeq: 51,
    });

    const { unmount } = renderHook(() => useDeltaSyncEffects());
    mocks.remoteChangeCallback?.({ eventSeq: 2002 });

    await waitFor(() => {
      expect(mocks.pullFromCloud).toHaveBeenCalledWith("account-a");
    });
    expect(mocks.getServerMaxSeq).toHaveBeenCalledBefore(mocks.pullFromCloud);

    finishSnapshot(true);

    await waitFor(() => {
      expect(mocks.fetchAndApplyDeltasInPages).toHaveBeenCalledWith(
        50,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          expectedOwnerUserId: "account-a",
        }),
      );
    });
    expect(mocks.pullFromCloud).toHaveBeenCalledBefore(
      mocks.fetchAndApplyDeltasInPages
    );
    expect(mocks.syncActions).toContainEqual({ type: "SNAPSHOT_SUCCESS", lastSeq: 51 });

    unmount();
  });

  it("aborts and discards delayed account A gap recovery after switching to account B", async () => {
    let activeOwner = "account-a";
    let resolveAccountAGap!: (result: {
      fetched: number;
      applied: number;
      lastSeq: number;
    }) => void;
    const accountAGap = new Promise<{
      fetched: number;
      applied: number;
      lastSeq: number;
    }>((resolve) => {
      resolveAccountAGap = resolve;
    });

    mocks.getCurrentSessionUserId.mockImplementation(async () => activeOwner);
    mocks.getLastSeq.mockResolvedValue(10);
    mocks.fetchAndApplyDeltasInPages
      .mockImplementationOnce(() => accountAGap)
      .mockResolvedValueOnce({ fetched: 0, applied: 0, lastSeq: 10 });
    mocks.runWithSyncLeaderLock.mockImplementation(async (_name, task) => ({
      acquired: true,
      value: await task(),
    }));

    const { unmount } = renderHook(() => useDeltaSyncEffects());
    mocks.remoteChangeCallback?.({ eventSeq: 5 });

    await waitFor(
      () => {
        expect(mocks.fetchAndApplyDeltasInPages).toHaveBeenCalledTimes(1);
      },
      { timeout: 1500 }
    );
    const accountAGapSignal = (
      mocks.fetchAndApplyDeltasInPages.mock.calls[0][1] as {
        signal: AbortSignal;
      }
    ).signal;

    activeOwner = "account-b";
    mocks.authChangeCallback?.("SIGNED_IN", { user: { id: "account-b" } });

    expect(accountAGapSignal.aborted).toBe(true);

    resolveAccountAGap({ fetched: 1, applied: 1, lastSeq: 11 });

    await waitFor(() => {
      expect(mocks.fetchAndApplyDeltasInPages).toHaveBeenCalledTimes(2);
    });

    unmount();
  });
});
