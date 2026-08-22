import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validateSyncOwner: vi.fn(),
  getDeletedFocusSessionIds: vi.fn(),
  isEntityTombstonedOnServer: vi.fn(),
  upsert: vi.fn(),
  from: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  writeEventAndBroadcast: vi.fn(),
  commitManualSyncEvent: vi.fn(),
  enqueue: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  loggerLog: vi.fn(),
  supabase: null as { from: ReturnType<typeof vi.fn> } | null,
}));

vi.mock("@/lib/supabaseClient", () => ({
  get supabase() {
    return mocks.supabase;
  },
  getCurrentUserId: vi.fn(async () => "owner-a"),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: mocks.validateSyncOwner,
}));

vi.mock("@/storage/deletionTracker", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/storage/deletionTracker")>()),
  getDeletedFocusSessionIds: mocks.getDeletedFocusSessionIds,
}));

vi.mock("@/storage/db", () => ({
  db: {
    focusSessions: {},
    transaction: vi.fn(),
  },
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: vi.fn(),
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

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
    log: mocks.loggerLog,
  },
}));

import { syncFocusSession } from "../syncFocus";
import type { FocusSession } from "@/types";

const session: FocusSession = {
  id: "11111111-1111-4111-8111-111111111111",
  duration: 25,
  completedAt: 1_786_190_400_000,
  date: "2026-08-08",
  label: "PRIVATE_FOCUS_LABEL",
  status: "completed",
  updatedAt: 1_786_190_400_000,
};

describe("syncFocusSession durable queue acknowledgement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    mocks.validateSyncOwner.mockResolvedValue("owner-a");
    mocks.getDeletedFocusSessionIds.mockResolvedValue(new Set<string>());
    mocks.isEntityTombstonedOnServer.mockResolvedValue(false);
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.supabase = { from: mocks.from };
    mocks.getPersistentDeviceId.mockResolvedValue("device-a");
    mocks.writeEventAndBroadcast.mockResolvedValue({ seq: 7 });
    mocks.commitManualSyncEvent.mockResolvedValue({ seq: 7 });
  });

  it("delivers a UUID focus row and binds its event to the durable operation identity", async () => {
    const operationId = "22222222-2222-4222-8222-222222222222";

    await syncFocusSession(session, "owner-a", operationId);

    expect(mocks.commitManualSyncEvent).toHaveBeenCalledWith({
      ownerUserId: "owner-a",
      operationId,
      entityType: "focus",
      entityId: session.id,
      op: "upsert",
      projection: {
        id: session.id,
        duration: 25,
        label: "PRIVATE_FOCUS_LABEL",
        status: "completed",
        reflection: null,
        date: "2026-08-08",
        completed_at: 1_786_190_400_000,
        updated_at: "2026-08-08T12:00:00.000Z",
      },
      deviceId: "device-a",
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("keeps an aborted network delivery retryable and logs no private value", async () => {
    const abort = new DOMException("PRIVATE_ABORT_DETAIL", "AbortError");
    mocks.commitManualSyncEvent.mockRejectedValueOnce(abort);

    await expect(
      syncFocusSession(
        session,
        "owner-a",
        "33333333-3333-4333-8333-333333333333"
      )
    ).rejects.toBe(abort);

    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
    const diagnostics = JSON.stringify([
      ...mocks.loggerWarn.mock.calls,
      ...mocks.loggerError.mock.calls,
      ...mocks.loggerLog.mock.calls,
    ]);
    expect(diagnostics).not.toContain(session.id);
    expect(diagnostics).not.toContain(session.label);
    expect(diagnostics).not.toContain("PRIVATE_ABORT_DETAIL");
  });

  it("does not acknowledge a durable focus row when its ordered event is deferred", async () => {
    mocks.commitManualSyncEvent.mockRejectedValueOnce(
      new Error("Focus ordered event was not committed")
    );

    await expect(
      syncFocusSession(
        session,
        "owner-a",
        "55555555-5555-4555-8555-555555555555"
      )
    ).rejects.toThrow("ordered event");
  });

  it("does not re-enqueue or re-key an active durable delivery when connectivity drops", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const operationId = "44444444-4444-4444-8444-444444444444";

    await expect(syncFocusSession(session, "owner-a", operationId)).rejects.toMatchObject({
      name: "AbortError",
    });

    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.commitManualSyncEvent).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });
});
