import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchAndApplyDeltasInPages: vi.fn(),
  getLastSeq: vi.fn(),
  getServerMaxSeq: vi.fn(),
  getCurrentUserId: vi.fn(),
  saveLastSeq: vi.fn(),
  pullFromCloud: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/storage/eventSync", () => ({
  fetchAndApplyDeltasInPages: mocks.fetchAndApplyDeltasInPages,
  getLastSeq: mocks.getLastSeq,
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
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.pullFromCloud.mockResolvedValue(true);
    mocks.fetchAndApplyDeltasInPages.mockImplementation(
      async (lastSeq: number, options: { assertOwnerCurrent?: () => Promise<void> }) => {
        await options.assertOwnerCurrent?.();
        return { fetched: 0, applied: 0, lastSeq };
      }
    );
    mocks.saveLastSeq.mockResolvedValue(undefined);
  });

  it("takes a snapshot baseline before fetching the delta tail for a fresh cursor", async () => {
    mocks.fetchAndApplyDeltasInPages.mockResolvedValueOnce({
      fetched: 1,
      applied: 1,
      lastSeq: 51,
    });

    const result = await bootstrapSnapshotThenDelta();

    expect(mocks.getServerMaxSeq).toHaveBeenCalledBefore(mocks.pullFromCloud);
    expect(mocks.pullFromCloud).toHaveBeenCalledOnce();
    expect(mocks.fetchAndApplyDeltasInPages).toHaveBeenCalledWith(
      50,
      expect.objectContaining({
        signal: undefined,
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
    expect(mocks.fetchAndApplyDeltasInPages).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ fetched: 0, applied: 0, lastSeq: 50 });
  });

  it("does not advance the cursor when the snapshot bootstrap fails", async () => {
    mocks.pullFromCloud.mockResolvedValueOnce(false);

    await expect(bootstrapSnapshotThenDelta()).rejects.toThrow("Snapshot bootstrap failed");

    expect(mocks.fetchAndApplyDeltasInPages).not.toHaveBeenCalled();
    expect(mocks.saveLastSeq).not.toHaveBeenCalled();
  });

  it("does not apply a delayed account A delta after the active owner becomes account B", async () => {
    mocks.getLastSeq.mockResolvedValue(10);
    mocks.getCurrentUserId
      .mockResolvedValueOnce("account-a")
      .mockResolvedValueOnce("account-a")
      .mockResolvedValue("account-b");

    await expect(
      bootstrapSnapshotThenDelta(undefined, "account-a")
    ).rejects.toThrow("account boundary");

    expect(mocks.fetchAndApplyDeltasInPages).toHaveBeenCalledTimes(1);
  });
});
