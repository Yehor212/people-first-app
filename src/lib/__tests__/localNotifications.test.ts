import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalNotifications, type LocalNotificationSchema, type ScheduleOn } from "@capacitor/local-notifications";
import {
  initializeNotificationChannel,
  scheduleHabitReminders,
  scheduleLocalReminders,
  scheduleMoodQuickLogNotification,
} from "../localNotifications";
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

const requireScheduleOn = (notification: LocalNotificationSchema): ScheduleOn => {
  const on = notification.schedule?.on;
  if (!on) {
    throw new Error(`Expected notification ${notification.id} to use schedule.on`);
  }
  return on;
};

const requireNumber = (value: number | undefined, label: string): number => {
  if (typeof value !== "number") {
    throw new Error(`Expected ${label} to be a number`);
  }
  return value;
};

const makeHabit = (overrides: Partial<Habit> = {}): Habit => ({
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
  ...overrides,
});

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

  it("schedules global reminders only on the selected weekdays", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });

    await scheduleLocalReminders(
      {
        ...reminders,
        days: [1, 3],
      },
      copy,
    );

    const scheduled = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];

    expect(scheduled).toHaveLength(10);
    expect(scheduled.every((notification) => notification.schedule && !("every" in notification.schedule))).toBe(true);
    expect(
      scheduled
        .map((notification) =>
          requireNumber(requireScheduleOn(notification).weekday, `weekday for ${notification.id}`),
        )
        .sort((a, b) => a - b),
    ).toEqual([2, 2, 2, 2, 2, 4, 4, 4, 4, 4]);
  });

  it("maps ZenFlow weekday values to Capacitor weekday values", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });

    await scheduleLocalReminders(
      {
        ...reminders,
        days: [0, 6],
      },
      copy,
    );

    const scheduled = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];

    expect(
      scheduled
        .map((notification) =>
          requireNumber(requireScheduleOn(notification).weekday, `weekday for ${notification.id}`),
        )
        .sort((a, b) => a - b),
    ).toEqual([1, 1, 1, 1, 1, 7, 7, 7, 7, 7]);
  });

  it("cancels only global reminder notifications before rescheduling", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: [
        { id: 1, title: "Mood", body: "Old", schedule: { on: { hour: 9, minute: 0 } } },
        { id: 102, title: "Mood", body: "Old weekday", schedule: { on: { hour: 9, minute: 0 } } },
        { id: 10, title: "Journal", body: "Keep", schedule: { on: { hour: 19, minute: 0 } } },
        { id: 150, title: "Quick mood", body: "Keep", schedule: { on: { hour: 9, minute: 0 } } },
        { id: 1000, title: "Habit", body: "Keep", schedule: { on: { hour: 8, minute: 0 } } },
      ],
    });

    await scheduleLocalReminders(reminders, copy);

    expect(LocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({ id: 1 }),
        expect.objectContaining({ id: 102 }),
      ],
    });
  });

  it("does not schedule global reminder times that fall inside quiet hours", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });

    await scheduleLocalReminders(
      {
        ...reminders,
        moodTimeMorning: "06:30",
        moodTimeAfternoon: "14:00",
        moodTimeEvening: "23:00",
        habitTime: "22:30",
        focusTime: "10:00",
        days: [1],
        quietHours: { start: "22:00", end: "07:00" },
      },
      copy,
    );

    const scheduled = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];

    expect(scheduled).toHaveLength(2);
    expect(
      scheduled
        .map((notification) =>
          requireNumber(requireScheduleOn(notification).hour, `hour for ${notification.id}`),
        )
        .sort((a, b) => a - b),
    ).toEqual([10, 14]);
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
    const habit = makeHabit();

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

  it("maps habit reminder weekdays to Capacitor weekday values", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });
    const habit = makeHabit({
      reminders: [{ enabled: true, time: "08:30", days: [0, 6] }],
    });

    await scheduleHabitReminders([habit], {
      reminderTitle: "Habit",
      reminderBody: "Do {habit}",
    });

    const scheduled = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];

    expect(
      scheduled
        .map((notification) =>
          requireNumber(requireScheduleOn(notification).weekday, `weekday for ${notification.id}`),
        )
        .sort((a, b) => a - b),
    ).toEqual([1, 7]);
  });

  it("does not cancel quick mood weekday notifications when rescheduling habit reminders", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: [
        { id: 1000, title: "Old habit", body: "Old", schedule: { on: { hour: 8, minute: 0 } } },
        { id: 8999, title: "Old habit high", body: "Old", schedule: { on: { hour: 9, minute: 0 } } },
        { id: 9001, title: "Quick mood", body: "Keep", schedule: { on: { hour: 8, minute: 15 } } },
        { id: 150, title: "Quick mood daily", body: "Keep", schedule: { on: { hour: 8, minute: 15 } } },
        { id: 10, title: "Journal", body: "Keep", schedule: { on: { hour: 19, minute: 0 } } },
      ],
    });

    await scheduleHabitReminders([makeHabit()], {
      reminderTitle: "Habit",
      reminderBody: "Do {habit}",
    });

    const cancelled = vi.mocked(LocalNotifications.cancel).mock.calls[0]?.[0].notifications ?? [];

    expect(cancelled.map((notification) => notification.id).sort((a, b) => a - b)).toEqual([1000, 8999]);
  });

  it("does not schedule habit reminder IDs outside the habit-owned range", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });
    const manyHabits = Array.from({ length: 8001 }, (_, index) =>
      makeHabit({ id: `habit-${index}`, name: `Read ${index}` }),
    );

    await scheduleHabitReminders(manyHabits, {
      reminderTitle: "Habit",
      reminderBody: "Do {habit}",
    });

    const scheduled = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];
    const ids = scheduled.map((notification) => notification.id).sort((a, b) => a - b);

    expect(scheduled).toHaveLength(8000);
    expect(ids[0]).toBe(1000);
    expect(ids.at(-1)).toBe(8999);
    expect(ids).not.toContain(9000);
  });
});

describe("scheduleMoodQuickLogNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({ notifications: [] });
    vi.mocked(LocalNotifications.schedule).mockResolvedValue({ notifications: [] });
    vi.mocked(LocalNotifications.cancel).mockResolvedValue(undefined);
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });
  });

  it("schedules quick mood actions on the selected reminder weekdays", async () => {
    await scheduleMoodQuickLogNotification({ hour: 8, minute: 15 }, "How are you?", {
      days: [1, 3],
      quietHours: { start: "22:00", end: "07:00" },
    });

    expect(LocalNotifications.schedule).toHaveBeenCalledWith({
      notifications: expect.arrayContaining([
        expect.objectContaining({
          id: 9001,
          actionTypeId: "MOOD_QUICK_LOG",
          schedule: expect.objectContaining({ on: expect.objectContaining({ weekday: 2 }) }),
        }),
        expect.objectContaining({
          id: 9003,
          actionTypeId: "MOOD_QUICK_LOG",
          schedule: expect.objectContaining({ on: expect.objectContaining({ weekday: 4 }) }),
        }),
      ]),
    });
  });

  it("does not schedule quick mood actions inside quiet hours", async () => {
    await scheduleMoodQuickLogNotification({ hour: 6, minute: 30 }, "How are you?", {
      days: [1],
      quietHours: { start: "22:00", end: "07:00" },
    });

    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });
});
