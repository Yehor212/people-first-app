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
  pullFromCloud: vi.fn(),
  runWithSyncLeaderLock: vi.fn(),
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
  });

  it("does not start cloud delta or snapshot sync without an authenticated session", async () => {
    mocks.getCurrentSessionUserId.mockResolvedValue(null);

    const { unmount } = renderHook(() => useDeltaSyncEffects());

    await waitFor(() => {
      expect(mocks.getCurrentSessionUserId).toHaveBeenCalled();
    });

    expect(mocks.runWithSyncLeaderLock).not.toHaveBeenCalled();
    expect(mocks.fetchAllDeltas).not.toHaveBeenCalled();
    expect(mocks.bootstrapSnapshotThenDelta).not.toHaveBeenCalled();
    expect(mocks.pullFromCloud).not.toHaveBeenCalled();
    expect(mocks.loggerSync).toHaveBeenCalledWith("[DeltaSync] Skipped; no authenticated session");

    unmount();
  });
});
