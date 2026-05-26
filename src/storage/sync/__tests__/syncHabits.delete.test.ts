import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  from: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  enqueue: vi.fn(),
  trackDeletedHabitId: vi.fn(),
  getDeletedHabitIds: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  writeEventAndBroadcast: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.from },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: { enqueue: mocks.enqueue },
}));

vi.mock("@/storage/deletionTracker", () => ({
  trackDeletedHabitId: mocks.trackDeletedHabitId,
  getDeletedHabitIds: mocks.getDeletedHabitIds,
}));

vi.mock("@/storage/eventSync", () => ({
  getPersistentDeviceId: mocks.getPersistentDeviceId,
  writeEventAndBroadcast: mocks.writeEventAndBroadcast,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/validation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/validation")>("@/lib/validation");
  return {
    ...actual,
    isAbortError: vi.fn(() => false),
  };
});

import { deleteHabitFromCloud, syncHabit } from "../syncHabits";

describe("deleteHabitFromCloud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.getDeletedHabitIds.mockResolvedValue(new Set());
    mocks.getPersistentDeviceId.mockResolvedValue("device-1");
    const deleteQuery = {
      eq: mocks.eq,
      then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
    };
    mocks.eq.mockReturnValue(deleteQuery);
    mocks.delete.mockReturnValue(deleteQuery);
    mocks.from.mockReturnValue({ delete: mocks.delete });
  });

  it("writes a delete event for legacy non-UUID habits instead of skipping cross-device sync", async () => {
    await deleteHabitFromCloud("legacy-habit-id");

    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.trackDeletedHabitId).toHaveBeenCalledWith("legacy-habit-id");
    expect(mocks.writeEventAndBroadcast).toHaveBeenCalledWith(
      "habit",
      "legacy-habit-id",
      "delete",
      null,
      "device-1"
    );
  });

  it("queues legacy habit deletes while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await deleteHabitFromCloud("legacy-habit-id");

    expect(mocks.enqueue).toHaveBeenCalledWith("DELETE_HABIT", "legacy-habit-id", {
      id: "legacy-habit-id",
    });
    expect(mocks.trackDeletedHabitId).toHaveBeenCalledWith("legacy-habit-id");
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("deletes UUID habits from the cloud and then writes the ordered delete event", async () => {
    const habitId = "11111111-1111-4111-8111-111111111111";

    await deleteHabitFromCloud(habitId);

    expect(mocks.from).toHaveBeenCalledWith("habits");
    expect(mocks.eq).toHaveBeenCalledWith("id", habitId);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.trackDeletedHabitId).toHaveBeenCalledWith(habitId);
    expect(mocks.writeEventAndBroadcast).toHaveBeenCalledWith(
      "habit",
      habitId,
      "delete",
      null,
      "device-1"
    );
  });

  it("does not upsert a habit that already has a local tombstone", async () => {
    const habitId = "11111111-1111-4111-8111-111111111111";
    mocks.getDeletedHabitIds.mockResolvedValue(new Set([habitId]));

    await syncHabit({
      id: habitId,
      name: "Deleted",
      icon: "sparkles",
      color: "blue",
      frequency: { numerator: 1, denominator: 1 },
      entries: {},
      createdAt: "2026-05-25T10:00:00.000Z",
      updatedAt: "2026-05-25T10:00:00.000Z",
    } as any);

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });
});
