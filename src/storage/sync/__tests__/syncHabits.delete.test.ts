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
  isEntityTombstonedOnServer: vi.fn(),
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

vi.mock("@/storage/sync/serverTombstones", () => ({
  isEntityTombstonedOnServer: mocks.isEntityTombstonedOnServer,
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

import { deleteHabitFromCloud, syncHabit, syncHabitCompletion } from "../syncHabits";
import type { Habit } from "@/types";

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
    mocks.isEntityTombstonedOnServer.mockResolvedValue(false);
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

  it("does not upsert a stale habit when the server already has a tombstone", async () => {
    const habitId = "11111111-1111-4111-8111-111111111111";
    mocks.isEntityTombstonedOnServer.mockResolvedValue(true);

    await syncHabit({
      id: habitId,
      name: "Deleted on phone",
      icon: "sparkles",
      color: "blue",
      frequency: { numerator: 1, denominator: 1 },
      entries: {},
      createdAt: "2026-05-25T10:00:00.000Z",
      updatedAt: "2026-05-25T10:00:00.000Z",
    } as any);

    expect(mocks.isEntityTombstonedOnServer).toHaveBeenCalledWith("habit", habitId);
    expect(mocks.trackDeletedHabitId).toHaveBeenCalledWith(habitId);
    expect(mocks.from).not.toHaveBeenCalledWith("habits");
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("persists archive state and updated_at when syncing a habit", async () => {
    const habitId = "11111111-1111-4111-8111-111111111111";
    const habitUpsert = vi.fn().mockResolvedValue({ error: null });
    const reminderEq = vi.fn().mockResolvedValue({ error: null });
    const reminderDelete = vi.fn(() => ({ eq: reminderEq }));

    mocks.from.mockImplementation((table: string) => {
      if (table === "habits") return { upsert: habitUpsert };
      if (table === "habit_reminders") return { delete: reminderDelete };
      throw new Error(`Unexpected table: ${table}`);
    });

    const archivedHabit: Habit = {
      id: habitId,
      name: "Archived across devices",
      icon: "sparkles",
      color: 1,
      position: 0,
      habitType: "boolean",
      frequency: { numerator: 1, denominator: 1 },
      question: "Did you archive this habit?",
      description: "",
      entries: {},
      reminders: [],
      isArchived: true,
      targetValue: 1,
      targetType: "atLeast",
      unit: "",
      createdAt: 1760000000000,
      updatedAt: "2026-05-25T12:00:00.000Z",
    };

    await syncHabit(archivedHabit);

    expect(habitUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: habitId,
        is_archived: true,
        updated_at: "2026-05-25T12:00:00.000Z",
      }),
      { onConflict: "id" }
    );
    expect(mocks.writeEventAndBroadcast).toHaveBeenCalledWith(
      "habit",
      habitId,
      "upsert",
      expect.objectContaining({ id: habitId, isArchived: true }),
      "device-1"
    );
  });

  it("does not sync habit completions after a local habit tombstone", async () => {
    const habitId = "11111111-1111-4111-8111-111111111111";
    mocks.getDeletedHabitIds.mockResolvedValue(new Set([habitId]));

    await syncHabitCompletion(habitId, "2026-05-25", true, 1, undefined, {
      habitType: "boolean",
      entryValue: 2,
    });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("does not sync habit completions after a server habit tombstone", async () => {
    const habitId = "11111111-1111-4111-8111-111111111111";
    mocks.isEntityTombstonedOnServer.mockResolvedValue(true);

    await syncHabitCompletion(habitId, "2026-05-25", true, 1, undefined, {
      habitType: "boolean",
      entryValue: 2,
    });

    expect(mocks.isEntityTombstonedOnServer).toHaveBeenCalledWith("habit", habitId);
    expect(mocks.trackDeletedHabitId).toHaveBeenCalledWith(habitId);
    expect(mocks.from).not.toHaveBeenCalledWith("habit_completions");
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });
});
