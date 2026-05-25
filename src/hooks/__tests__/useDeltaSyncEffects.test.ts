import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyDelta: vi.fn(),
  bootstrapSnapshotThenDelta: vi.fn(),
  fetchAllDeltas: vi.fn(),
  getCurrentSessionUserId: vi.fn<() => Promise<string | null>>(),
  getLastSeq: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  getServerMaxSeq: vi.fn(),
  loggerSync: vi.fn(),
  offlineActions: [] as Array<{
    id: string;
    type: string;
    entityId: string;
    payload: unknown;
    timestamp: number;
    retries: number;
    maxRetries: number;
    priority?: string;
  }>,
  processQueue: vi.fn<() => Promise<void>>(),
  pullFromCloud: vi.fn(),
  recordSyncHealthReceipt: vi.fn(),
  runWithSyncLeaderLock: vi.fn(),
  scheduleIdleCallbacks: [] as Array<() => void>,
  cancelIdle: vi.fn(),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: (flag: string) => flag === "deltaSync",
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
  onRemoteChange: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/syncLeader", () => ({
  runWithSyncLeaderLock: mocks.runWithSyncLeaderLock,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    getState: vi.fn(() => ({ actions: mocks.offlineActions })),
    processQueue: mocks.processQueue,
  },
}));

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
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
  },
}));

vi.mock("@/storage/eventSync", () => ({
  applyDelta: mocks.applyDelta,
  fetchAllDeltas: mocks.fetchAllDeltas,
  getLastSeq: mocks.getLastSeq,
  getPersistentDeviceId: mocks.getPersistentDeviceId,
  getServerMaxSeq: mocks.getServerMaxSeq,
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
  afterEach(() => {
    vi.clearAllMocks();
    mocks.offlineActions = [];
    mocks.processQueue.mockResolvedValue(undefined);
    mocks.scheduleIdleCallbacks.length = 0;
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
    expect(mocks.fetchAllDeltas).not.toHaveBeenCalled();
    expect(mocks.bootstrapSnapshotThenDelta).not.toHaveBeenCalled();
    expect(mocks.pullFromCloud).not.toHaveBeenCalled();
    expect(mocks.loggerSync).toHaveBeenCalledWith("[DeltaSync] Skipped; no authenticated session");

    unmount();
    expect(mocks.cancelIdle).toHaveBeenCalled();
  });

  it("drains queued local actions before fetching remote deltas", async () => {
    mocks.getCurrentSessionUserId.mockResolvedValue("user-1");
    mocks.getLastSeq.mockResolvedValue(10);
    mocks.fetchAllDeltas.mockResolvedValue([]);
    mocks.runWithSyncLeaderLock.mockImplementation(async (_name, task) => ({
      acquired: true,
      value: await task(),
    }));
    mocks.offlineActions = [
      {
        id: "queued-event",
        type: "WRITE_SYNC_EVENT",
        entityId: "sync-event:habit:habit-1:upsert",
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
      expect(mocks.fetchAllDeltas).toHaveBeenCalledWith(10, expect.any(AbortSignal));
    });

    expect(mocks.processQueue.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.fetchAllDeltas.mock.invocationCallOrder[0]
    );
    expect(mocks.recordSyncHealthReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "queue-draining", actionType: "WRITE_SYNC_EVENT" })
    );
    expect(mocks.recordSyncHealthReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "queue-drained", actionType: "WRITE_SYNC_EVENT" })
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

    expect(mocks.fetchAllDeltas).not.toHaveBeenCalled();
    expect(mocks.applyDelta).not.toHaveBeenCalled();

    unmount();
  });
});
