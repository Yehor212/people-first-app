import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn<() => Promise<string | null>>(),
  getSession: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
  sync: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    from: mocks.from,
  },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/syncOrchestrator", () => ({
  syncOrchestrator: {
    sync: mocks.sync,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

import { syncReminderSettings } from "../reminderSync";
import type { ReminderSettings } from "@/types";

describe("reminderSync account ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserId.mockResolvedValue("account-b");
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "account-b" } } },
      error: null,
    });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.sync.mockImplementation(
      async (_type: string, operation: () => Promise<void>) => operation()
    );
  });

  it("refuses delayed account-A reminders after account B becomes active", async () => {
    mocks.getCurrentUserId.mockResolvedValueOnce("account-a");
    const reminders = {
      enabled: true,
      moodTimeMorning: "09:00",
      moodTimeAfternoon: "14:00",
      moodTimeEvening: "20:00",
      habitTime: "08:00",
      focusTime: "15:00",
      days: [1, 2, 3, 4, 5],
      habitIds: ["habit-a"],
    } as ReminderSettings;

    await expect(
      syncReminderSettings(reminders, "en", "account-a")
    ).rejects.toThrow("account boundary");

    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("uses the immutable account-A owner for a legitimate reminder write", async () => {
    mocks.getCurrentUserId.mockResolvedValue("account-a");
    const reminders = {
      enabled: true,
      moodTimeMorning: "09:00",
      moodTimeAfternoon: "14:00",
      moodTimeEvening: "20:00",
      habitTime: "08:00",
      focusTime: "15:00",
      days: [1, 2, 3, 4, 5],
      habitIds: ["habit-a"],
    } as ReminderSettings;

    await syncReminderSettings(reminders, "en", "account-a");

    expect(mocks.sync).toHaveBeenCalledWith(
      "reminders",
      expect.any(Function),
      expect.objectContaining({ expectedOwnerUserId: "account-a" })
    );
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "account-a", language: "en" }),
      { onConflict: "user_id" }
    );
  });
});
