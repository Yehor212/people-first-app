import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalNotifications } from "@capacitor/local-notifications";
import { initializeNotificationChannel, scheduleHabitReminders, scheduleLocalReminders } from "../localNotifications";
import { initializeNotificationChannels } from "../notificationSounds";
import type { Habit, ReminderSettings } from "@/types";

vi.mock("@/lib/platform", () => ({
  isNative: true,
}));

vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../notificationSounds", () => ({
  getCurrentChannelId: () => "zenflow_gentle_v2",
  initializeNotificationChannels: vi.fn(),
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    getPending: vi.fn(),
    cancel: vi.fn(),
    schedule: vi.fn(),
    createChannel: vi.fn(),
    listChannels: vi.fn(),
    registerActionTypes: vi.fn(),
    addListener: vi.fn(),
  },
}));

const reminders: ReminderSettings = {
  enabled: true,
  moodTimeMorning: "09:00",
  moodTimeAfternoon: "14:00",
  moodTimeEvening: "20:00",
  habitTime: "21:00",
  focusTime: "10:00",
  days: [],
  quietHours: {
    start: "22:00",
    end: "07:00",
  },
  habitIds: [],
};

const copy = {
  mood: { title: "Mood", body: "Check in" },
  habit: { title: "Habit", body: "Keep going" },
  focus: { title: "Focus", body: "Take a focus break" },
};

describe("scheduleLocalReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({ notifications: [] });
    vi.mocked(LocalNotifications.schedule).mockResolvedValue({ notifications: [] });
    vi.mocked(LocalNotifications.cancel).mockResolvedValue(undefined);
  });

  it("does not show the native permission prompt while scheduling reminders", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "prompt" });
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({ display: "denied" });

    await scheduleLocalReminders(reminders, copy);

    expect(LocalNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(LocalNotifications.getPending).not.toHaveBeenCalled();
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("does not recreate the old high-interruption reminder channel", async () => {
    await initializeNotificationChannel();

    expect(LocalNotifications.createChannel).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "zenflow_reminders" }),
    );
  });

  it("schedules reminders when notification permission is already granted", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });

    await scheduleLocalReminders(reminders, copy);

    expect(LocalNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(LocalNotifications.schedule).toHaveBeenCalledWith({
      notifications: expect.arrayContaining([
        expect.objectContaining({ id: 1, title: "Mood" }),
        expect.objectContaining({ id: 4, title: "Habit" }),
        expect.objectContaining({ id: 5, title: "Focus" }),
      ]),
    });
    const scheduled = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];
    expect(scheduled.every((notification) => notification.channelId === "zenflow_gentle_v2")).toBe(true);
    expect(scheduled.some((notification) => notification.channelId === "zenflow_reminders")).toBe(false);
    expect(LocalNotifications.schedule).toHaveBeenCalledWith({
      notifications: expect.arrayContaining([
        expect.objectContaining({ id: 1, title: "Mood" }),
        expect.objectContaining({ id: 4, title: "Habit" }),
        expect.objectContaining({ id: 5, title: "Focus" }),
      ]),
    });
  });

  it("initializes the active sound channels before scheduling local reminders", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });

    await scheduleLocalReminders(reminders, copy);

    expect(initializeNotificationChannels).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(initializeNotificationChannels).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(LocalNotifications.checkPermissions).mock.invocationCallOrder[0]);
  });

  it("initializes the active sound channels before scheduling habit reminders", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });
    const habit = {
      id: "habit-1",
      name: "Read",
      icon: "R",
      color: 1,
      position: 0,
      createdAt: Date.now(),
      habitType: "boolean",
      frequency: { numerator: 1, denominator: 1 },
      question: "Read today?",
      description: "Read a few pages",
      isArchived: false,
      targetValue: 1,
      targetType: "atLeast",
      unit: "",
      entries: {},
      reminders: [{ enabled: true, time: "08:30", days: [] }],
    } satisfies Habit;

    await scheduleHabitReminders([habit], {
      reminderTitle: "Habit",
      reminderBody: "Do {habit}",
    });

    expect(initializeNotificationChannels).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(initializeNotificationChannels).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(LocalNotifications.checkPermissions).mock.invocationCallOrder[0]);
    expect(LocalNotifications.schedule).toHaveBeenCalledWith({
      notifications: expect.arrayContaining([
        expect.objectContaining({ channelId: "zenflow_gentle_v2" }),
      ]),
    });
  });
});
