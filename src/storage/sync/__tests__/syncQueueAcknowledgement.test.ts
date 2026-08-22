import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validateSyncOwner: vi.fn(),
  getDeletedMoodIds: vi.fn(),
  getDeletedGratitudeIds: vi.fn(),
  isEntityTombstonedOnServer: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
  enqueue: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  writeEventAndBroadcast: vi.fn(),
  commitManualSyncEvent: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  loggerLog: vi.fn(),
  addCategorizedBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.from },
  getCurrentUserId: vi.fn(async () => "owner-a"),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: mocks.validateSyncOwner,
}));

vi.mock("@/storage/deletionTracker", () => ({
  getDeletedMoodIds: mocks.getDeletedMoodIds,
  getDeletedGratitudeIds: mocks.getDeletedGratitudeIds,
  trackDeletedMoodId: vi.fn(),
  trackDeletedGratitudeId: vi.fn(),
}));

vi.mock("@/storage/sync/serverTombstones", () => ({
  isEntityTombstonedOnServer: mocks.isEntityTombstonedOnServer,
}));

vi.mock("@/storage/eventSync", () => ({
  getPersistentDeviceId: mocks.getPersistentDeviceId,
  writeEventAndBroadcast: mocks.writeEventAndBroadcast,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: { enqueue: mocks.enqueue },
}));

vi.mock("@/storage/sync/manualSyncAcceptance", () => ({
  commitManualSyncEvent: mocks.commitManualSyncEvent,
}));

vi.mock("@/hooks/useIndexedDB", () => ({ triggerDataRefresh: vi.fn() }));
vi.mock("@/storage/db", () => ({ db: {} }));
vi.mock("@/lib/sentry", () => ({ addCategorizedBreadcrumb: mocks.addCategorizedBreadcrumb }));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
    log: mocks.loggerLog,
  },
}));

import { syncMood } from "../syncMoods";
import { syncGratitude } from "../syncGratitude";

const PRIVATE_ID = "11111111-1111-4111-8111-111111111111";

describe("durable queue sync acknowledgement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    mocks.validateSyncOwner.mockResolvedValue("owner-a");
    mocks.getDeletedMoodIds.mockResolvedValue(new Set<string>());
    mocks.getDeletedGratitudeIds.mockResolvedValue(new Set<string>());
    mocks.isEntityTombstonedOnServer.mockResolvedValue(false);
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.getPersistentDeviceId.mockResolvedValue("device-a");
    mocks.writeEventAndBroadcast.mockResolvedValue({ seq: 1 });
    mocks.commitManualSyncEvent.mockResolvedValue({ seq: 1 });
  });

  it("does not acknowledge a legacy mood identifier as a durable remote commit", async () => {
    await expect(
      syncMood(
        {
          id: "legacy-mood-id",
          mood: "good",
          date: "2026-08-08",
          timestamp: 1,
          updatedAt: 1,
        },
        "owner-a",
        "22222222-2222-4222-8222-222222222222",
      ),
    ).rejects.toThrow("Mood remote identity is unsupported");

    expect(mocks.commitManualSyncEvent).not.toHaveBeenCalled();
  });

  it.each([
    [
      "mood",
      () =>
        syncMood(
          {
            id: PRIVATE_ID,
            mood: "good",
            note: "PRIVATE_MOOD_CANARY",
            date: "2026-08-08",
            timestamp: 1,
            updatedAt: 1,
          },
          "owner-a",
          "22222222-2222-4222-8222-222222222222"
        ),
    ],
    [
      "gratitude",
      () =>
        syncGratitude(
          {
            id: PRIVATE_ID,
            text: "PRIVATE_GRATITUDE_CANARY",
            date: "2026-08-08",
            timestamp: 1,
            updatedAt: 1,
          },
          "owner-a",
          "33333333-3333-4333-8333-333333333333"
        ),
    ],
  ])("keeps an aborted %s delivery retryable without private diagnostics", async (kind, run) => {
    const abort = new DOMException("PRIVATE_ABORT_CANARY", "AbortError");
    if (kind === "mood") {
      mocks.commitManualSyncEvent.mockRejectedValueOnce(abort);
    } else {
      mocks.upsert.mockRejectedValueOnce(abort);
    }

    await expect(run()).rejects.toBe(abort);

    const diagnostics = JSON.stringify([
      ...mocks.loggerWarn.mock.calls,
      ...mocks.loggerError.mock.calls,
      ...mocks.loggerLog.mock.calls,
    ]);
    expect(diagnostics).not.toContain(PRIVATE_ID);
    expect(diagnostics).not.toContain("PRIVATE_ABORT_CANARY");
    expect(diagnostics).not.toContain("PRIVATE_MOOD_CANARY");
    expect(diagnostics).not.toContain("PRIVATE_GRATITUDE_CANARY");
    await vi.waitFor(() => {
      expect(JSON.stringify(mocks.addCategorizedBreadcrumb.mock.calls)).not.toContain(PRIVATE_ID);
      expect(JSON.stringify(mocks.addCategorizedBreadcrumb.mock.calls)).not.toContain(
        "PRIVATE_ABORT_CANARY"
      );
    });
  });
});
