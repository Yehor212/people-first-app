import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyDelta: vi.fn(),
  fetchAllDeltas: vi.fn(),
  getLastSeq: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  getServerMaxSeq: vi.fn(),
  saveLastSeq: vi.fn(),
  pullFromCloud: vi.fn(),
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

import { bootstrapSnapshotThenDelta } from "@/storage/initialDeltaSync";

describe("bootstrapSnapshotThenDelta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLastSeq.mockResolvedValue(0);
    mocks.getServerMaxSeq.mockResolvedValue(50);
    mocks.pullFromCloud.mockResolvedValue(true);
    mocks.fetchAllDeltas.mockResolvedValue([]);
    mocks.getPersistentDeviceId.mockResolvedValue("device-current");
    mocks.applyDelta.mockResolvedValue(0);
    mocks.saveLastSeq.mockResolvedValue(undefined);
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
    expect(mocks.applyDelta).toHaveBeenCalledWith(tailEvents, "device-current");
    expect(mocks.saveLastSeq).not.toHaveBeenCalled();
    expect(result).toEqual({ fetched: 1, applied: 1, lastSeq: 51 });
  });

  it("saves the snapshot baseline when no tail events arrive", async () => {
    const result = await bootstrapSnapshotThenDelta();

    expect(mocks.saveLastSeq).toHaveBeenCalledWith(50);
    expect(mocks.applyDelta).not.toHaveBeenCalled();
    expect(result).toEqual({ fetched: 0, applied: 0, lastSeq: 50 });
  });

  it("does not advance the cursor when the snapshot bootstrap fails", async () => {
    mocks.pullFromCloud.mockResolvedValueOnce(false);

    await expect(bootstrapSnapshotThenDelta()).rejects.toThrow("Snapshot bootstrap failed");

    expect(mocks.fetchAllDeltas).not.toHaveBeenCalled();
    expect(mocks.saveLastSeq).not.toHaveBeenCalled();
  });
});
