import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyDelta: vi.fn(),
  fetchAllDeltas: vi.fn(),
  getLastSeq: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  getServerMaxSeq: vi.fn(),
  getCurrentUserId: vi.fn(),
  saveLastSeq: vi.fn(),
  pullFromCloud: vi.fn(),
  needsAutomationHistoryBootstrap: vi.fn(),
  bootstrapAutomationHistoryOnce: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/storage/eventSync", () => ({
  applyDelta: mocks.applyDelta,
  fetchAllDeltas: mocks.fetchAllDeltas,
  getLastSeq: mocks.getLastSeq,
  getPersistentDeviceId: mocks.getPersistentDeviceId,
  getServerMaxSeq: mocks.getServerMaxSeq,
  saveLastSeq: mocks.saveLastSeq,
}));

vi.mock("@/storage/realtimeSync", () => ({
  pullFromCloud: mocks.pullFromCloud,
}));

vi.mock("@/features/automation/automationBootstrap", () => ({
  needsAutomationHistoryBootstrap: mocks.needsAutomationHistoryBootstrap,
  bootstrapAutomationHistoryOnce: mocks.bootstrapAutomationHistoryOnce,
}));

import { bootstrapSnapshotThenDelta } from "@/storage/initialDeltaSync";

describe("bootstrapSnapshotThenDelta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLastSeq.mockResolvedValue(0);
    mocks.getServerMaxSeq.mockResolvedValue(50);
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.pullFromCloud.mockResolvedValue(true);
    mocks.fetchAllDeltas.mockResolvedValue([]);
    mocks.getPersistentDeviceId.mockResolvedValue("device-current");
    mocks.applyDelta.mockResolvedValue(0);
    mocks.saveLastSeq.mockResolvedValue(undefined);
    mocks.needsAutomationHistoryBootstrap.mockResolvedValue(false);
    mocks.bootstrapAutomationHistoryOnce.mockResolvedValue(null);
  });

  it("takes a snapshot baseline before fetching the delta tail for a fresh cursor", async () => {
    const tailEvents = [
      {
        id: "event-51",
        seq: 51,
        entity_type: "habit",
        entity_id: "habit-1",
        op: "upsert",
        payload: { id: "habit-1" },
        device_id: "remote-device",
        created_at: "2026-05-16T00:00:00.000Z",
      },
    ];
    mocks.fetchAllDeltas.mockResolvedValueOnce(tailEvents);
    mocks.applyDelta.mockResolvedValueOnce(1);

    const result = await bootstrapSnapshotThenDelta();

    expect(mocks.getServerMaxSeq).toHaveBeenCalledBefore(mocks.pullFromCloud);
    expect(mocks.pullFromCloud).toHaveBeenCalledOnce();
    expect(mocks.fetchAllDeltas).toHaveBeenCalledWith(50, undefined);
    expect(mocks.applyDelta).toHaveBeenCalledWith(
      tailEvents,
      "device-current",
      expect.objectContaining({
        expectedOwnerUserId: "user-1",
        assertOwnerCurrent: expect.any(Function),
      }),
    );
    expect(mocks.saveLastSeq).not.toHaveBeenCalled();
    expect(result).toEqual({ fetched: 1, applied: 1, lastSeq: 51 });
  });

  it("saves the snapshot baseline when no tail events arrive", async () => {
    const result = await bootstrapSnapshotThenDelta();

    expect(mocks.saveLastSeq).toHaveBeenCalledWith(
      50,
      expect.objectContaining({
        expectedOwnerUserId: "user-1",
        assertOwnerCurrent: expect.any(Function),
      }),
    );
    expect(mocks.applyDelta).not.toHaveBeenCalled();
    expect(result).toEqual({ fetched: 0, applied: 0, lastSeq: 50 });
  });

  it("does not advance the cursor when the snapshot bootstrap fails", async () => {
    mocks.pullFromCloud.mockResolvedValueOnce(false);

    await expect(bootstrapSnapshotThenDelta()).rejects.toThrow("Snapshot bootstrap failed");

    expect(mocks.fetchAllDeltas).not.toHaveBeenCalled();
    expect(mocks.saveLastSeq).not.toHaveBeenCalled();
  });

  it("does not apply a delayed account A delta after the active owner becomes account B", async () => {
    const accountAEvents = [
      {
        id: "event-a-11",
        seq: 11,
        entity_type: "habit",
        entity_id: "habit-a",
        op: "upsert",
        payload: { id: "habit-a" },
        device_id: "device-a",
        created_at: "2026-07-10T00:00:00.000Z",
      },
    ];
    mocks.getLastSeq.mockResolvedValue(10);
    mocks.fetchAllDeltas.mockResolvedValue(accountAEvents);
    mocks.getCurrentUserId
      .mockResolvedValueOnce("account-a")
      .mockResolvedValueOnce("account-a")
      .mockResolvedValue("account-b");

    await expect(
      bootstrapSnapshotThenDelta(undefined, "account-a")
    ).rejects.toThrow("account boundary");

    expect(mocks.applyDelta).not.toHaveBeenCalled();
  });

  it("bootstraps 2.1 automation history after domain catch-up even when the legacy cursor is advanced", async () => {
    mocks.getLastSeq.mockResolvedValue(10);
    mocks.needsAutomationHistoryBootstrap.mockResolvedValue(true);
    mocks.fetchAllDeltas.mockResolvedValue([]);

    await expect(
      bootstrapSnapshotThenDelta(undefined, "user-1"),
    ).resolves.toEqual({ fetched: 0, applied: 0, lastSeq: 10 });

    expect(mocks.pullFromCloud).toHaveBeenCalledWith("user-1");
    expect(mocks.fetchAllDeltas).toHaveBeenCalledWith(10, undefined);
    expect(mocks.bootstrapAutomationHistoryOnce).toHaveBeenCalledWith("user-1");
    expect(mocks.pullFromCloud).toHaveBeenCalledBefore(mocks.fetchAllDeltas);
    expect(mocks.fetchAllDeltas).toHaveBeenCalledBefore(
      mocks.bootstrapAutomationHistoryOnce,
    );
  });
});
