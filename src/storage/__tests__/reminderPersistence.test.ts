import { beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeDataRefresh } from "@/hooks/useIndexedDB";
import { defaultReminderSettings } from "@/lib/reminders";
import { db } from "@/storage/db";
import { DELETION_TRACKER_KEYS } from "@/storage/deletionTracker";
import { captureOriginAccountBoundaryGeneration } from "@/storage/accountBoundaryRuntime";
import {
  commitReminderSettingsUpdate,
  readPersistedReminderSnapshot,
} from "@/storage/reminderPersistence";
import type { Habit, ReminderSettings } from "@/types";

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: loggerMocks,
}));

const reminderKey = "zenflow-reminders";

const createHabit = (id: string): Habit => ({
  id,
  name: `Habit ${id}`,
  icon: "circle",
  color: 1,
  createdAt: 1,
  habitType: "boolean",
  reminders: [{ enabled: true, time: "08:30", days: [1] }],
  frequency: { numerator: 1, denominator: 1 },
  entries: {},
  question: "Done?",
  description: "",
  isArchived: false,
  position: 0,
  targetValue: 1,
  targetType: "atLeast",
  unit: "",
});

describe("reminderPersistence", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all([db.settings.clear(), db.habits.clear()]);
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("serializes rapid functional updates from the latest durable reminder record", async () => {
    await db.settings.put({
      key: reminderKey,
      value: { ...defaultReminderSettings, enabled: false, focusReminderEnabled: false },
    });

    const first = commitReminderSettingsUpdate((previous) => ({
      ...previous,
      enabled: true,
    }));
    const second = commitReminderSettingsUpdate((previous) => ({
      ...previous,
      focusReminderEnabled: true,
    }));

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ enabled: true, focusReminderEnabled: false }),
      expect.objectContaining({ enabled: true, focusReminderEnabled: true }),
    ]);
    await expect(db.settings.get(reminderKey)).resolves.toEqual(
      expect.objectContaining({
        value: expect.objectContaining({ enabled: true, focusReminderEnabled: true }),
      })
    );
  });

  it("rejects a failed durable commit without replacing the previous record", async () => {
    const previous: ReminderSettings = {
      ...defaultReminderSettings,
      enabled: false,
    };
    await db.settings.put({ key: reminderKey, value: previous });
    localStorage.setItem(reminderKey, JSON.stringify(previous));
    const put = vi
      .spyOn(db.settings, "put")
      .mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    try {
      await expect(
        commitReminderSettingsUpdate((current) => ({ ...current, enabled: true }))
      ).rejects.toThrow("IndexedDB unavailable");
    } finally {
      put.mockRestore();
    }

    await expect(db.settings.get(reminderKey)).resolves.toEqual({
      key: reminderKey,
      value: previous,
    });
    expect(localStorage.getItem(reminderKey)).toBe(JSON.stringify(previous));
  });

  it("updates the recovery copy only after the durable reminder commit succeeds", async () => {
    const previous: ReminderSettings = {
      ...defaultReminderSettings,
      enabled: false,
    };
    await db.settings.put({ key: reminderKey, value: previous });
    localStorage.setItem(reminderKey, JSON.stringify(previous));

    const next = await commitReminderSettingsUpdate((current) => ({
      ...current,
      enabled: true,
    }));

    await expect(db.settings.get(reminderKey)).resolves.toEqual({
      key: reminderKey,
      value: next,
    });
    expect(localStorage.getItem(reminderKey)).toBe(JSON.stringify(next));
  });

  it("does not accept a forged same-code reminder post-commit error", async () => {
    const forgedCommitted = { ...defaultReminderSettings, enabled: true };
    const forgedError = Object.assign(new Error("forged reminder result"), {
      code: "DATA_WRITE_BARRIER_POST_COMMIT",
      committedValue: forgedCommitted,
      capturedOriginGeneration: captureOriginAccountBoundaryGeneration(),
      issueKinds: ["mounted-refresh"],
    });
    const get = vi.spyOn(db.settings, "get").mockRejectedValueOnce(forgedError);
    const incident = vi.fn();
    window.addEventListener("zenflow:settings-post-commit-incident", incident);

    try {
      await expect(
        commitReminderSettingsUpdate((previous) => ({ ...previous, enabled: true })),
      ).rejects.toBe(forgedError);
      expect(incident).not.toHaveBeenCalled();
    } finally {
      get.mockRestore();
      window.removeEventListener("zenflow:settings-post-commit-incident", incident);
    }
  });

  it("returns a committed reminder update and exposes only a generation-guarded refresh retry", async () => {
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("mounted refresh failed"))
      .mockResolvedValue(undefined);
    const unsubscribe = subscribeDataRefresh(refresh);
    type IncidentDetail = {
      issueKinds?: string[];
      retry?: () => void;
      committedValue?: unknown;
      error?: unknown;
    };
    let incidentDetail: IncidentDetail | null = null;
    const captureIncident = (event: Event) => {
      incidentDetail = (event as CustomEvent<IncidentDetail>).detail;
    };
    window.addEventListener("zenflow:settings-post-commit-incident", captureIncident);

    try {
      const update = commitReminderSettingsUpdate((current) => ({
        ...current,
        enabled: true,
      }));
      await expect(update).resolves.toEqual(expect.objectContaining({ enabled: true }));
      const next = await update;

      await expect(db.settings.get(reminderKey)).resolves.toEqual({
        key: reminderKey,
        value: next,
      });
      expect(incidentDetail).toMatchObject({
        issueKinds: ["mounted-refresh"],
        retry: expect.any(Function),
      });
      const capturedIncident = incidentDetail as IncidentDetail | null;
      expect(capturedIncident?.committedValue).toBeUndefined();
      expect(capturedIncident?.error).toBeUndefined();

      capturedIncident?.retry?.();
      await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    } finally {
      window.removeEventListener("zenflow:settings-post-commit-incident", captureIncident);
      unsubscribe();
    }
  });

  it("reads one validated reminder-and-habit snapshot and excludes tombstoned habits", async () => {
    const liveHabit = createHabit("live-habit");
    const deletedHabit = createHabit("deleted-habit");
    await db.settings.bulkPut([
      {
        key: reminderKey,
        value: { ...defaultReminderSettings, enabled: true },
      },
      {
        key: DELETION_TRACKER_KEYS.habit,
        value: [deletedHabit.id],
      },
    ]);
    await db.habits.bulkPut([liveHabit, deletedHabit]);

    await expect(readPersistedReminderSnapshot()).resolves.toEqual({
      reminders: expect.objectContaining({ enabled: true }),
      habits: [expect.objectContaining({ id: liveHabit.id })],
    });
  });

  it("fails closed when the authoritative reminder record cannot be read", async () => {
    const get = vi
      .spyOn(db.settings, "get")
      .mockRejectedValueOnce(new Error("reminder read failed"));

    try {
      await expect(readPersistedReminderSnapshot()).rejects.toThrow("reminder read failed");
    } finally {
      get.mockRestore();
    }
  });
});
