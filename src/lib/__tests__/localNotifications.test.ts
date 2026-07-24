import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LocalNotifications,
  type ActionPerformed,
  type LocalNotificationSchema,
  type ScheduleOn,
} from "@capacitor/local-notifications";
import {
  initializeNotificationChannel,
  reconcileReminderNotifications,
  scheduleHabitReminders,
  scheduleLocalReminders,
  scheduleMoodQuickLogNotification,
  clearAccountNotificationsForBoundary,
  resumeAccountNotifications,
  setMoodActionCallback,
  setupNotificationActionListener,
} from "../localNotifications";
import { initializeNotificationChannels } from "../notificationSounds";
import { logger } from "../logger";
import type { Habit, ReminderSettings } from "@/types";
import { SK } from "@/lib/storageKeys";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

const platformMocks = vi.hoisted<{ current: "android" | "ios" }>(() => ({ current: "android" }));

vi.mock("@/lib/platform", () => ({
  isNative: true,
  get platform() {
    return platformMocks.current;
  },
}));

const ownerMocks = vi.hoisted(() => ({
  getCurrentSessionUserId: vi.fn(() => Promise.resolve<string | null>("user-a")),
}));

const notificationRealmMocks = vi.hoisted(() => ({
  readVerifiedNotificationRealm: vi.fn(() =>
    Promise.resolve({
      kind: "account" as const,
      ownerUserId: "user-a",
      generation: "generation-a",
    }),
  ),
  assertVerifiedNotificationRealmCurrent: vi.fn<
    (realm: { ownerUserId: string | null }) => Promise<void>
  >(() => Promise.resolve()),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: ownerMocks.getCurrentSessionUserId,
}));

vi.mock("@/storage/notificationRealm", () => notificationRealmMocks);

vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../notificationSounds", () => ({
  getCurrentChannelId: () => "zenflow_default_v4",
  getCurrentSoundOption: () => ({ sound: "default" }),
  NOTIFICATION_SOUNDS: [
    { channelId: "zenflow_default_v4", sound: "default" },
    { channelId: "zenflow_gentle_v4", sound: undefined },
    { channelId: "zenflow_silent_v4", sound: undefined },
  ],
  initializeNotificationChannels: vi.fn(),
  isCurrentNotificationSoundChannelId: (channelId: string | undefined) =>
    typeof channelId === "string" && channelId.endsWith("_v4"),
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    getPending: vi.fn(),
    getDeliveredNotifications: vi.fn(),
    cancel: vi.fn(),
    removeDeliveredNotifications: vi.fn(),
    schedule: vi.fn(),
    createChannel: vi.fn(),
    listChannels: vi.fn(),
    registerActionTypes: vi.fn(),
    addListener: vi.fn(),
    removeAllDeliveredNotifications: vi.fn(),
  },
}));

const pushMocks = vi.hoisted(() => ({
  removeAllDeliveredNotifications: vi.fn(),
}));

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    removeAllDeliveredNotifications: pushMocks.removeAllDeliveredNotifications,
  },
}));

const reminders: ReminderSettings = {
  enabled: true,
  moodCheckInsEnabled: true,
  focusReminderEnabled: true,
  moodTimeMorning: "09:00",
  moodTimeAfternoon: "14:00",
  moodTimeEvening: "20:00",
  habitTime: "21:00",
  focusTime: "10:00",
  days: [1],
  quietHours: {
    start: "22:00",
    end: "07:00",
  },
  habitIds: [],
};

const copy = {
  mood: { title: "Mood", body: "Check in" },
  habit: { title: "Habit reminder", body: "Keep going" },
  focus: { title: "Focus", body: "Take a focus break" },
};

const reconcileCopy = {
  ...copy,
  quickMoodBody: "How are you?",
  channelCopy: {
    default: { name: "ZenFlow — Default", description: "System sound" },
    gentle: { name: "ZenFlow — Gentle", description: "Vibration only" },
    chime: { name: "ZenFlow — Chime", description: "Short tone" },
    silent: { name: "ZenFlow — Silent", description: "No sound or vibration" },
  },
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
  reminders: [{ enabled: true, time: "08:30", days: [1] }],
  ...overrides,
});

describe("reconcileReminderNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    platformMocks.current = "android";
    resumeAccountNotifications();
    ownerMocks.getCurrentSessionUserId.mockResolvedValue("user-a");
    notificationRealmMocks.readVerifiedNotificationRealm.mockResolvedValue({
      kind: "account",
      ownerUserId: "user-a",
      generation: "generation-a",
    });
    notificationRealmMocks.assertVerifiedNotificationRealmCurrent.mockImplementation(
      async (realm: { ownerUserId: string | null }) => {
        if ((await ownerMocks.getCurrentSessionUserId()) !== realm.ownerUserId) {
          throw new Error("notification realm changed");
        }
      },
    );
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({ notifications: [] });
    vi.mocked(LocalNotifications.getDeliveredNotifications).mockResolvedValue({ notifications: [] });
    vi.mocked(LocalNotifications.cancel).mockResolvedValue(undefined);
    vi.mocked(LocalNotifications.removeDeliveredNotifications).mockResolvedValue(undefined);
    vi.mocked(LocalNotifications.schedule).mockResolvedValue({ notifications: [] });
    localStorage.setItem("zenflow_notification_generic_habit_copy_migration_v1", "complete");
  });

  it("verifies the notification realm before reading or mutating native schedules", async () => {
    const realmError = new Error("notification realm is not safe");
    const assertRealmCurrent = vi.fn(() => Promise.reject(realmError));

    await expect(
      reconcileReminderNotifications(reminders, [makeHabit()], reconcileCopy, {
        ownerUserId: "user-a",
        moodActionsEnabled: true,
        assertRealmCurrent,
      }),
    ).rejects.toBe(realmError);

    expect(assertRealmCurrent).toHaveBeenCalledTimes(1);
    expect(LocalNotifications.getPending).not.toHaveBeenCalled();
    expect(LocalNotifications.cancel).not.toHaveBeenCalled();
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("omits inert quick-mood actions in the verified local-only realm", async () => {
    await reconcileReminderNotifications(reminders, [], reconcileCopy, {
      ownerUserId: null,
      moodActionsEnabled: false,
      assertRealmCurrent: vi.fn(() => Promise.resolve()),
    });

    const scheduled = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];
    const quickMood = scheduled.find(({ id }) => id === 9001);
    expect(quickMood).toBeDefined();
    expect(quickMood).not.toHaveProperty("actionTypeId");
    expect(quickMood).not.toHaveProperty("extra");
  });

  it("does not recreate quick-mood actions while rolling back a local-only schedule", async () => {
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: [
        {
          id: 9001,
          title: "ZenFlow",
          body: "Previous local reminder",
          schedule: { on: { hour: 9, minute: 0, weekday: 2 } },
        },
      ],
    });
    const replacementError = new Error("local replacement failed");
    vi.mocked(LocalNotifications.schedule)
      .mockRejectedValueOnce(replacementError)
      .mockResolvedValueOnce({ notifications: [] });

    const result = await reconcileReminderNotifications(reminders, [], reconcileCopy, {
      ownerUserId: null,
      moodActionsEnabled: false,
      assertRealmCurrent: vi.fn(() => Promise.resolve()),
    });

    expect(result).toEqual({
      status: "native-restored",
      scheduledCount: 0,
      error: replacementError,
    });

    const restored = vi.mocked(LocalNotifications.schedule).mock.calls[1]?.[0].notifications ?? [];
    expect(restored.find(({ id }) => id === 9001)).not.toHaveProperty("actionTypeId");
    expect(restored.find(({ id }) => id === 9001)).not.toHaveProperty("extra");
  });

  it("removes legacy personalized habit requests before a denied permission can preserve them", async () => {
    localStorage.removeItem("zenflow_notification_generic_habit_copy_migration_v1");
    localStorage.setItem(SK.NOTIFICATION_PRIVATE_CHANNEL_MIGRATION, "complete");
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "denied" });
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: [
        { id: 1000, title: "💊 Medication", body: "Old", schedule: { on: { hour: 8, minute: 0 } } },
        { id: 10, title: "Journal", body: "Keep", schedule: { on: { hour: 20, minute: 0 } } },
      ],
    });
    vi.mocked(LocalNotifications.getDeliveredNotifications).mockResolvedValue({
      notifications: [
        { id: 1000, title: "💊 Medication", body: "Old" },
        { id: 10, title: "Journal", body: "Keep" },
      ],
    });

    const result = await reconcileReminderNotifications(reminders, [makeHabit()], reconcileCopy);

    expect(result).toEqual({ status: "permission-required", scheduledCount: 0 });
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [expect.objectContaining({ id: 1000 })],
    });
    expect(LocalNotifications.removeDeliveredNotifications).toHaveBeenCalledWith({
      notifications: [expect.objectContaining({ id: 1000 })],
    });
    expect(localStorage.getItem("zenflow_notification_generic_habit_copy_migration_v1")).toBe(
      "complete",
    );
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("retries legacy habit-copy cleanup when delivered notification removal fails", async () => {
    localStorage.removeItem("zenflow_notification_generic_habit_copy_migration_v1");
    vi.mocked(LocalNotifications.getDeliveredNotifications).mockResolvedValue({
      notifications: [{ id: 1000, title: "Private habit", body: "Old" }],
    });
    vi.mocked(LocalNotifications.removeDeliveredNotifications).mockRejectedValueOnce(
      new Error("native delivered cleanup failed"),
    );

    await expect(
      reconcileReminderNotifications(reminders, [makeHabit()], reconcileCopy),
    ).rejects.toThrow("native delivered cleanup failed");
    expect(localStorage.getItem("zenflow_notification_generic_habit_copy_migration_v1")).toBeNull();
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("cancels every reminder-owned ID in one pass when reminders are disabled", async () => {
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: [
        { id: 2, title: "Mood", body: "Old" },
        { id: 1000, title: "Habit", body: "Old" },
        { id: 9001, title: "Quick mood", body: "Old" },
        { id: 10, title: "Journal", body: "Keep" },
        { id: 8888, title: "Quick actions", body: "Keep" },
      ],
    });

    const result = await reconcileReminderNotifications(
      { ...reminders, enabled: false },
      [makeHabit()],
      reconcileCopy,
    );

    expect(result).toEqual({ status: "disabled", scheduledCount: 0 });
    expect(LocalNotifications.cancel).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(LocalNotifications.cancel).mock.calls[0]?.[0].notifications.map(({ id }) => id),
    ).toEqual([2, 1000, 9001]);
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    expect(LocalNotifications.checkPermissions).not.toHaveBeenCalled();
  });

  it("builds one final schedule with one morning quick-log and no generic morning duplicate", async () => {
    const result = await reconcileReminderNotifications(
      { ...reminders, days: [1] },
      [makeHabit()],
      reconcileCopy,
    );

    expect(result.status).toBe("scheduled");
    expect(initializeNotificationChannels).toHaveBeenCalledWith(reconcileCopy.channelCopy);
    expect(LocalNotifications.checkPermissions).toHaveBeenCalledTimes(1);
    expect(LocalNotifications.getPending).toHaveBeenCalledTimes(1);
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
    const scheduled = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];
    expect(scheduled.map(({ id }) => id)).toEqual([201, 301, 501, 1000, 9001]);
    expect(scheduled.filter(({ id }) => id === 9001)).toHaveLength(1);
    expect(scheduled.map(({ id }) => id)).not.toContain(101);
  });

  it("keeps the generic habit title and body stable without exposing user-authored content", async () => {
    const habit = makeHabit({ name: "הליכה Walk", icon: "W" });

    await reconcileReminderNotifications(reminders, [habit], reconcileCopy);
    await reconcileReminderNotifications(reminders, [habit], reconcileCopy);

    const scheduledPasses = vi.mocked(LocalNotifications.schedule).mock.calls.map(
      ([payload]) => payload.notifications,
    );
    const habitPayloads = scheduledPasses.map((scheduled) =>
      scheduled.find(({ id }) => id === 1000),
    );

    expect(habitPayloads).toEqual([
      expect.objectContaining({ title: reconcileCopy.habit.title, body: reconcileCopy.habit.body }),
      expect.objectContaining({ title: reconcileCopy.habit.title, body: reconcileCopy.habit.body }),
    ]);
    expect(habitPayloads).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ title: expect.stringContaining(habit.name) })]),
    );
  });

  it("treats canonical habit body copy as opaque instead of interpolating user content", async () => {
    const habit = makeHabit({ name: "הליכה Walk", icon: "W" });
    const opaqueCopy = {
      ...reconcileCopy,
      habit: { title: "Habit reminder", body: "Literal {habit} copy contract" },
    };

    await reconcileReminderNotifications(reminders, [habit], opaqueCopy);

    const scheduled = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];
    expect(scheduled.find(({ id }) => id === 1000)).toEqual(
      expect.objectContaining({
        title: "Habit reminder",
        body: "Literal {habit} copy contract",
      }),
    );
  });

  it("treats an empty global day selection as no mood or focus delivery", async () => {
    const result = await reconcileReminderNotifications(
      { ...reminders, days: [] },
      [],
      reconcileCopy,
    );

    expect(result).toEqual({ status: "scheduled", scheduledCount: 0 });
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("keeps an active habit reminder independent from empty mood and focus days", async () => {
    const result = await reconcileReminderNotifications(
      { ...reminders, days: [] },
      [makeHabit()],
      reconcileCopy,
    );

    expect(result).toEqual({ status: "scheduled", scheduledCount: 1 });
    expect(LocalNotifications.schedule).toHaveBeenCalledWith({
      notifications: [expect.objectContaining({ id: 1000, title: "Habit reminder" })],
    });
  });

  it("does not schedule reminders for archived habits", async () => {
    const result = await reconcileReminderNotifications(
      {
        ...reminders,
        days: [],
        moodCheckInsEnabled: false,
        focusReminderEnabled: false,
      },
      [makeHabit({ isArchived: true })],
      reconcileCopy,
    );

    expect(result).toEqual({ status: "scheduled", scheduledCount: 0 });
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("preserves the legacy daily meaning of an enabled habit reminder with no stored days", async () => {
    const result = await reconcileReminderNotifications(
      {
        ...reminders,
        days: [],
        moodCheckInsEnabled: false,
        focusReminderEnabled: false,
      },
      [
        makeHabit({
          reminders: [{ enabled: true, time: "08:30", days: [] }],
        }),
      ],
      reconcileCopy,
    );

    expect(result).toEqual({ status: "scheduled", scheduledCount: 7 });
    expect(LocalNotifications.schedule).toHaveBeenCalledWith({
      notifications: expect.arrayContaining([
        expect.objectContaining({ id: 1000, title: "Habit reminder" }),
        expect.objectContaining({ id: 1006, title: "Habit reminder" }),
      ]),
    });
  });

  it("cancels obsolete categories before returning when notification permission is denied", async () => {
    localStorage.setItem(SK.NOTIFICATION_PRIVATE_CHANNEL_MIGRATION, "complete");
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "denied" });
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: [
        { id: 201, title: "Mood", body: "Old" },
        { id: 501, title: "Focus", body: "Keep" },
        { id: 9001, title: "Quick mood", body: "Old" },
        { id: 10, title: "Journal", body: "Keep" },
      ],
    });

    const result = await reconcileReminderNotifications(
      { ...reminders, moodCheckInsEnabled: false, focusReminderEnabled: true },
      [],
      reconcileCopy,
    );

    expect(result).toEqual({ status: "permission-required", scheduledCount: 0 });
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({ id: 201 }),
        expect.objectContaining({ id: 9001 }),
      ],
    });
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("cancels every owned reminder when no delivery day remains even if permission is denied", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "denied" });
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: [
        { id: 201, title: "Mood", body: "Old" },
        { id: 501, title: "Focus", body: "Old" },
        { id: 9001, title: "Quick mood", body: "Old" },
      ],
    });

    const result = await reconcileReminderNotifications(
      { ...reminders, days: [] },
      [],
      reconcileCopy,
    );

    expect(result).toEqual({ status: "permission-required", scheduledCount: 0 });
    expect(
      vi.mocked(LocalNotifications.cancel).mock.calls[0]?.[0].notifications.map(({ id }) => id),
    ).toEqual([201, 501, 9001]);
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("removes pre-v3 pending reminders before returning on denied permission", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "denied" });
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: [
        { id: 501, title: "Focus", body: "Old" },
        { id: 10, title: "Journal", body: "Keep" },
      ],
    });

    const result = await reconcileReminderNotifications(reminders, [], reconcileCopy);

    expect(result).toEqual({ status: "permission-required", scheduledCount: 0 });
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [expect.objectContaining({ id: 501 })],
    });
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("rehydrates only still-desired reminders onto v3 when first-migration replacement fails", async () => {
    let nativePending: LocalNotificationSchema[] = [
      {
        id: 201,
        title: "Old mood",
        body: "Do not restore",
        schedule: { on: { hour: 14, minute: 0, weekday: 2 }, allowWhileIdle: true },
      },
      {
        id: 501,
        title: "Old focus",
        body: "Restore me",
        schedule: { on: { hour: 10, minute: 30, weekday: 2 }, allowWhileIdle: true },
      },
      {
        id: 9001,
        title: "Old mood action",
        body: "Do not restore",
        schedule: { on: { hour: 9, minute: 0, weekday: 2 }, allowWhileIdle: true },
      },
    ];
    vi.mocked(LocalNotifications.getPending).mockImplementation(async () => ({
      notifications: [...nativePending],
    }));
    vi.mocked(LocalNotifications.cancel).mockImplementation(async ({ notifications }) => {
      const cancelledIds = new Set(notifications.map(({ id }) => id));
      nativePending = nativePending.filter(({ id }) => !cancelledIds.has(id));
    });
    let scheduleAttempt = 0;
    vi.mocked(LocalNotifications.schedule).mockImplementation(async ({ notifications }) => {
      scheduleAttempt += 1;
      if (scheduleAttempt === 1) throw new Error("replacement failed");
      nativePending = [...notifications];
      return { notifications };
    });

    const result = await reconcileReminderNotifications(
      { ...reminders, moodCheckInsEnabled: false, focusReminderEnabled: true },
      [],
      reconcileCopy,
    );

    expect(result).toEqual({
      status: "native-restored",
      scheduledCount: 0,
      error: expect.objectContaining({ message: "replacement failed" }),
    });

    expect(LocalNotifications.getPending).toHaveBeenCalledTimes(1);
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(2);
    expect(LocalNotifications.schedule).toHaveBeenNthCalledWith(2, {
      notifications: [
        expect.objectContaining({
          id: 501,
          body: "Restore me",
          channelId: "zenflow_default_v4",
          sound: "default",
          schedule: expect.objectContaining({
            on: expect.objectContaining({ hour: 10, minute: 30, weekday: 2 }),
          }),
        }),
      ],
    });
    expect(nativePending.map(({ id }) => id)).toEqual([501]);
    expect(localStorage.getItem(SK.NOTIFICATION_PRIVATE_CHANNEL_MIGRATION)).toBe("complete");
  });

  it("schedules only reminder categories the user explicitly enabled", async () => {
    const result = await reconcileReminderNotifications(
      {
        ...reminders,
        days: [1],
        moodCheckInsEnabled: false,
        focusReminderEnabled: true,
      },
      [],
      reconcileCopy,
    );

    expect(result).toEqual({ status: "scheduled", scheduledCount: 1 });
    const scheduled = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];
    expect(scheduled.map(({ id }) => id)).toEqual([501]);
  });

  it("preserves the existing schedule and rejects when notification channels cannot be prepared", async () => {
    localStorage.setItem(SK.NOTIFICATION_PRIVATE_CHANNEL_MIGRATION, "complete");
    vi.mocked(initializeNotificationChannels).mockRejectedValueOnce(
      new Error("channel creation failed"),
    );
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: [
        { id: 201, title: "Mood", body: "Existing reminder" },
      ],
    });

    await expect(
      reconcileReminderNotifications(
        { ...reminders, days: [1] },
        [makeHabit()],
        reconcileCopy,
      ),
    ).rejects.toThrow("channel creation failed");

    expect(LocalNotifications.cancel).not.toHaveBeenCalled();
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("prepares Android private channels before first-migration cancellation and keeps the marker pending on failure", async () => {
    const existingSchedule: LocalNotificationSchema[] = [
      { id: 201, title: "Mood", body: "Existing private-channel reminder" },
    ];
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: existingSchedule,
    });
    vi.mocked(initializeNotificationChannels).mockRejectedValueOnce(
      new Error("private channel creation failed"),
    );

    await expect(
      reconcileReminderNotifications(
        { ...reminders, days: [1] },
        [makeHabit()],
        reconcileCopy,
      ),
    ).rejects.toThrow("private channel creation failed");

    expect(LocalNotifications.cancel).not.toHaveBeenCalled();
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    expect(localStorage.getItem(SK.NOTIFICATION_PRIVATE_CHANNEL_MIGRATION)).toBeNull();
  });

  it("waits for the exact iOS reminder IDs before reporting the replacement as scheduled", async () => {
    platformMocks.current = "ios";
    let replacementSubmitted = false;
    let confirmationReads = 0;
    vi.mocked(LocalNotifications.getPending).mockImplementation(async () => {
      if (!replacementSubmitted) {
        return {
          notifications: [{ id: 201, title: "Old mood", body: "Old reminder" }],
        };
      }
      confirmationReads += 1;
      if (confirmationReads === 1) {
        return {
          notifications: [{ id: 201, title: "Old mood", body: "Still settling" }],
        };
      }
      return {
        notifications: [
          { id: 501, title: "Focus", body: "New reminder" },
          { id: 10, title: "Journal", body: "Unrelated notification" },
        ],
      };
    });
    vi.mocked(LocalNotifications.schedule).mockImplementation(async ({ notifications }) => {
      replacementSubmitted = true;
      return { notifications };
    });

    const result = await reconcileReminderNotifications(
      {
        ...reminders,
        moodCheckInsEnabled: false,
        focusReminderEnabled: true,
        days: [1],
      },
      [],
      reconcileCopy,
    );

    expect(result).toEqual({ status: "scheduled", scheduledCount: 1 });
    expect(confirmationReads).toBe(2);
    expect(LocalNotifications.getPending).toHaveBeenCalledTimes(3);
  });

  it("reports iOS restoration only after the exact previous reminder IDs are pending again", async () => {
    platformMocks.current = "ios";
    const previousNotifications: LocalNotificationSchema[] = [
      { id: 501, title: "Previous focus", body: "Previous reminder" },
    ];
    let phase: "initial" | "replacement" | "rollback" = "initial";
    let scheduleAttempt = 0;
    vi.mocked(LocalNotifications.getPending).mockImplementation(async () => {
      if (phase === "initial" || phase === "rollback") {
        return { notifications: previousNotifications };
      }
      return { notifications: [] };
    });
    vi.mocked(LocalNotifications.schedule).mockImplementation(async ({ notifications }) => {
      scheduleAttempt += 1;
      phase = scheduleAttempt === 1 ? "replacement" : "rollback";
      return { notifications };
    });

    const result = await reconcileReminderNotifications(
      {
        ...reminders,
        moodCheckInsEnabled: false,
        focusReminderEnabled: true,
        days: [1],
      },
      [],
      reconcileCopy,
    );

    expect(result).toEqual({
      status: "native-restored",
      scheduledCount: 0,
      error: expect.objectContaining({ message: expect.stringContaining("pending IDs") }),
    });
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(2);
    expect(LocalNotifications.getPending).toHaveBeenCalledTimes(6);
  });

  it("reports native uncertainty when iOS resolves rollback without restoring the previous IDs", async () => {
    platformMocks.current = "ios";
    const previousNotifications: LocalNotificationSchema[] = [
      { id: 501, title: "Previous focus", body: "Previous reminder" },
    ];
    let initialRead = true;
    vi.mocked(LocalNotifications.getPending).mockImplementation(async () => {
      if (initialRead) {
        initialRead = false;
        return { notifications: previousNotifications };
      }
      return { notifications: [] };
    });
    vi.mocked(LocalNotifications.schedule).mockImplementation(async ({ notifications }) => ({
      notifications,
    }));

    const result = await reconcileReminderNotifications(
      {
        ...reminders,
        moodCheckInsEnabled: false,
        focusReminderEnabled: true,
        days: [1],
      },
      [],
      reconcileCopy,
    );

    expect(result).toEqual({
      status: "native-uncertain",
      scheduledCount: 0,
      error: expect.objectContaining({ message: expect.stringContaining("pending IDs") }),
    });
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(2);
    expect(LocalNotifications.getPending).toHaveBeenCalledTimes(9);
  });

  it("does not report an iOS schedule as applied after a newer reconcile request supersedes confirmation", async () => {
    platformMocks.current = "ios";
    const firstConfirmation = createDeferred<{ notifications: LocalNotificationSchema[] }>();
    let getPendingCall = 0;
    vi.mocked(LocalNotifications.getPending).mockImplementation(async () => {
      getPendingCall += 1;
      if (getPendingCall === 2) return firstConfirmation.promise;
      return { notifications: [] };
    });

    const first = reconcileReminderNotifications(
      {
        ...reminders,
        moodCheckInsEnabled: false,
        focusReminderEnabled: true,
        days: [1],
      },
      [],
      reconcileCopy,
    );
    await vi.waitFor(() => expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(LocalNotifications.getPending).toHaveBeenCalledTimes(2));

    const latest = reconcileReminderNotifications(
      { ...reminders, enabled: false },
      [],
      reconcileCopy,
    );
    firstConfirmation.resolve({
      notifications: [{ id: 501, title: "Focus", body: "Stale request" }],
    });

    await expect(first).resolves.toEqual({ status: "superseded", scheduledCount: 0 });
    await expect(latest).resolves.toEqual({ status: "disabled", scheduledCount: 0 });
  });

  it("rechecks the verified realm after every iOS pending read before reporting scheduled", async () => {
    platformMocks.current = "ios";
    let realmCurrent = true;
    let pendingRead = 0;
    const assertRealmCurrent = vi.fn(async () => {
      if (!realmCurrent) throw new Error("realm changed during iOS confirmation");
    });
    vi.mocked(LocalNotifications.getPending).mockImplementation(async () => {
      pendingRead += 1;
      if (pendingRead === 1) return { notifications: [] };
      realmCurrent = false;
      return {
        notifications: [{ id: 501, title: "Focus", body: "Wrong realm" }],
      };
    });

    const result = await reconcileReminderNotifications(
      {
        ...reminders,
        moodCheckInsEnabled: false,
        focusReminderEnabled: true,
        days: [1],
      },
      [],
      reconcileCopy,
      {
        ownerUserId: "user-a",
        moodActionsEnabled: true,
        assertRealmCurrent,
      },
    );

    expect(result).toEqual({
      status: "native-uncertain",
      scheduledCount: 0,
      error: expect.objectContaining({ message: "realm changed during iOS confirmation" }),
    });
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
    expect(assertRealmCurrent).toHaveBeenCalled();
  });

  it("restores the previous schedule when native scheduling rejects after cancellation", async () => {
    const previousNotifications: LocalNotificationSchema[] = [
      {
        id: 201,
        title: "Previous mood",
        body: "Previous check-in",
        channelId: "zenflow_default_v4",
        sound: "default",
        schedule: {
          on: { hour: 12, minute: 30, weekday: 2 },
          allowWhileIdle: true,
        },
      },
      {
        id: 9001,
        title: "Previous quick mood",
        body: "Previous quick check-in",
        channelId: "zenflow_default_v4",
        sound: "default",
        schedule: {
          on: { hour: 8, minute: 15, weekday: 2 },
          allowWhileIdle: true,
        },
        actionTypeId: "MOOD_QUICK_LOG",
      },
    ];
    const scheduleError = new Error("native scheduling failed");
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: previousNotifications,
    });
    let scheduleAttempts = 0;
    vi.mocked(LocalNotifications.schedule).mockImplementation(async () => {
      scheduleAttempts += 1;
      if (scheduleAttempts === 1) throw scheduleError;
      return { notifications: previousNotifications };
    });

    const result = await reconcileReminderNotifications(
      { ...reminders, days: [1] },
      [makeHabit()],
      reconcileCopy,
    );

    expect(result).toEqual({
      status: "native-restored",
      scheduledCount: 0,
      error: scheduleError,
    });

    expect(LocalNotifications.cancel).toHaveBeenNthCalledWith(1, {
      notifications: previousNotifications,
    });
    const attemptedNotifications =
      vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];
    expect(LocalNotifications.cancel).toHaveBeenNthCalledWith(2, {
      notifications: attemptedNotifications,
    });
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(2);
    expect(LocalNotifications.schedule).toHaveBeenNthCalledWith(2, {
      notifications: previousNotifications,
    });
    expect(vi.mocked(LocalNotifications.cancel).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(LocalNotifications.schedule).mock.invocationCallOrder[0] ?? 0,
    );
    expect(vi.mocked(LocalNotifications.schedule).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(LocalNotifications.cancel).mock.invocationCallOrder[1] ?? 0,
    );
    expect(vi.mocked(LocalNotifications.cancel).mock.invocationCallOrder[1]).toBeLessThan(
      vi.mocked(LocalNotifications.schedule).mock.invocationCallOrder[1] ?? 0,
    );
  });

  it("restores the exact last successful schedule when pending metadata is incomplete", async () => {
    await reconcileReminderNotifications(
      { ...reminders, days: [1] },
      [makeHabit()],
      reconcileCopy,
    );
    const lastSuccessfulNotifications =
      vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];
    const nativePendingSnapshot = lastSuccessfulNotifications.map(
      ({ id, title, body, schedule, extra }) => ({ id, title, body, schedule, extra }),
    );
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: nativePendingSnapshot,
    });

    const scheduleError = new Error("replacement schedule failed");
    let replacementAttempts = 0;
    vi.mocked(LocalNotifications.schedule).mockImplementation(async () => {
      replacementAttempts += 1;
      if (replacementAttempts === 1) throw scheduleError;
      return { notifications: lastSuccessfulNotifications };
    });

    const result = await reconcileReminderNotifications(
      { ...reminders, moodTimeAfternoon: "16:45", days: [1] },
      [makeHabit()],
      {
        ...reconcileCopy,
        mood: { ...reconcileCopy.mood, body: "Updated check-in" },
      },
    );

    expect(result).toEqual({
      status: "native-restored",
      scheduledCount: 0,
      error: scheduleError,
    });

    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(3);
    expect(LocalNotifications.schedule).toHaveBeenNthCalledWith(3, {
      notifications: lastSuccessfulNotifications,
    });
  });

  it("uses the explicit previous channel when cold-start pending metadata omits it", async () => {
    const nativePendingSnapshot = [
      {
        id: 201,
        title: "Previous mood",
        body: "Previous check-in",
        schedule: {
          on: { hour: 12, minute: 30, weekday: 2 },
          allowWhileIdle: true,
        },
      },
    ];
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: nativePendingSnapshot,
    });
    const scheduleError = new Error("gentle replacement schedule failed");
    let scheduleAttempts = 0;
    vi.mocked(LocalNotifications.schedule).mockImplementation(async () => {
      scheduleAttempts += 1;
      if (scheduleAttempts === 1) throw scheduleError;
      return { notifications: nativePendingSnapshot };
    });

    const result = await reconcileReminderNotifications(
      { ...reminders, days: [1] },
      [makeHabit()],
      reconcileCopy,
      { rollbackChannelId: "zenflow_default_v4" },
    );

    expect(result).toEqual({
      status: "native-restored",
      scheduledCount: 0,
      error: scheduleError,
    });

    const restoredNotifications =
      vi.mocked(LocalNotifications.schedule).mock.calls[1]?.[0].notifications ?? [];
    expect(restoredNotifications).toEqual([
      expect.objectContaining({
        id: 201,
        channelId: "zenflow_default_v4",
        sound: "default",
      }),
    ]);
  });

  it("preserves the replacement error when native restoration also rejects", async () => {
    const previousNotifications: LocalNotificationSchema[] = [
      {
        id: 201,
        title: "Previous mood",
        body: "Previous check-in",
        schedule: {
          on: { hour: 12, minute: 30, weekday: 2 },
          allowWhileIdle: true,
        },
      },
    ];
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: previousNotifications,
    });
    const replacementError = new Error("replacement schedule failed");
    const restorationError = new Error("restoration schedule failed");
    let scheduleAttempts = 0;
    vi.mocked(LocalNotifications.schedule).mockImplementation(async () => {
      scheduleAttempts += 1;
      throw scheduleAttempts === 1 ? replacementError : restorationError;
    });

    const result = await reconcileReminderNotifications(
      { ...reminders, days: [1] },
      [makeHabit()],
      reconcileCopy,
    );

    expect(result).toEqual({
      status: "native-uncertain",
      scheduledCount: 0,
      error: replacementError,
    });

    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(2);
  });

  it("reports native uncertainty when a partial replacement cannot be cleared", async () => {
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: [
        {
          id: 201,
          title: "Previous mood",
          body: "Previous check-in",
          schedule: { on: { hour: 14, minute: 0, weekday: 2 } },
        },
      ],
    });
    const replacementError = new Error("replacement schedule failed");
    vi.mocked(LocalNotifications.schedule)
      .mockRejectedValueOnce(replacementError)
      .mockResolvedValueOnce({ notifications: [] });
    vi.mocked(LocalNotifications.cancel)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("partial replacement cleanup failed"));

    const result = await reconcileReminderNotifications(
      { ...reminders, days: [1] },
      [],
      reconcileCopy,
    );

    expect(result).toEqual({
      status: "native-uncertain",
      scheduledCount: 0,
      error: replacementError,
    });
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(2);
  });

  it("does not restore an old owner's schedule after the active owner changes", async () => {
    const previousNotifications: LocalNotificationSchema[] = [
      {
        id: 201,
        title: "Account A mood",
        body: "Account A check-in",
        channelId: "zenflow_default_v4",
        sound: "default",
        schedule: {
          on: { hour: 12, minute: 30, weekday: 2 },
          allowWhileIdle: true,
        },
      },
    ];
    const scheduleError = new Error("native scheduling failed during account change");
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: previousNotifications,
    });
    vi.mocked(LocalNotifications.schedule).mockImplementation(async () => {
      ownerMocks.getCurrentSessionUserId.mockResolvedValue("user-b");
      throw scheduleError;
    });

    const result = await reconcileReminderNotifications(
      { ...reminders, days: [1] },
      [makeHabit()],
      reconcileCopy,
    );

    expect(result).toEqual({
      status: "native-uncertain",
      scheduledCount: 0,
      error: scheduleError,
    });

    expect(LocalNotifications.cancel).toHaveBeenCalledTimes(1);
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
  });

  it("rechecks the realm before rollback cancellation after a failed native schedule", async () => {
    let realmCurrent = true;
    const assertRealmCurrent = vi.fn(async () => {
      if (!realmCurrent) throw new Error("realm changed during schedule");
    });
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: [
        {
          id: 201,
          title: "Previous mood",
          body: "Previous check-in",
          schedule: { on: { hour: 14, minute: 0, weekday: 2 } },
        },
      ],
    });
    const replacementError = new Error("replacement schedule failed");
    vi.mocked(LocalNotifications.schedule).mockImplementationOnce(async () => {
      realmCurrent = false;
      throw replacementError;
    });

    const result = await reconcileReminderNotifications(reminders, [], reconcileCopy, {
      ownerUserId: "user-a",
      moodActionsEnabled: true,
      assertRealmCurrent,
    });

    expect(result).toEqual({
      status: "native-uncertain",
      scheduledCount: 0,
      error: replacementError,
    });

    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
    expect(LocalNotifications.cancel).toHaveBeenCalledTimes(1);
    expect(assertRealmCurrent).toHaveBeenCalled();
  });

  it("coalesces a rapid burst to one active pass plus the latest pending pass", async () => {
    const firstPendingRead = createDeferred<{ notifications: LocalNotificationSchema[] }>();
    vi.mocked(LocalNotifications.getPending)
      .mockReturnValueOnce(firstPendingRead.promise)
      .mockResolvedValue({ notifications: [] });

    const first = reconcileReminderNotifications(reminders, [], reconcileCopy);
    await vi.waitFor(() => expect(LocalNotifications.getPending).toHaveBeenCalledTimes(1));
    const intermediate = reconcileReminderNotifications(
      { ...reminders, focusReminderEnabled: false },
      [],
      reconcileCopy,
    );
    const latest = reconcileReminderNotifications(
      { ...reminders, moodCheckInsEnabled: false },
      [],
      reconcileCopy,
    );

    firstPendingRead.resolve({ notifications: [] });

    await expect(first).resolves.toMatchObject({ status: expect.any(String) });
    await expect(intermediate).resolves.toEqual({ status: "superseded", scheduledCount: 0 });
    await expect(latest).resolves.toMatchObject({ status: "scheduled" });
    expect(LocalNotifications.getPending).toHaveBeenCalledTimes(2);
  });

  it("serializes rapid enabled-to-disabled changes so the disabled pass wins", async () => {
    vi.mocked(LocalNotifications.getPending)
      .mockResolvedValueOnce({ notifications: [] })
      .mockResolvedValueOnce({
        notifications: [
          { id: 201, title: "Mood", body: "Scheduled by the older pass" },
          { id: 9001, title: "Quick mood", body: "Scheduled by the older pass" },
        ],
      });

    const enabled = reconcileReminderNotifications(
      { ...reminders, days: [1] },
      [],
      reconcileCopy,
    );
    await vi.waitFor(() => expect(LocalNotifications.getPending).toHaveBeenCalledTimes(1));
    const disabled = reconcileReminderNotifications(
      { ...reminders, enabled: false, days: [1] },
      [],
      reconcileCopy,
    );

    await expect(enabled).resolves.toMatchObject({ status: "scheduled" });
    await expect(disabled).resolves.toEqual({ status: "disabled", scheduledCount: 0 });
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
    expect(LocalNotifications.cancel).toHaveBeenLastCalledWith({
      notifications: [
        expect.objectContaining({ id: 201 }),
        expect.objectContaining({ id: 9001 }),
      ],
    });
  });
});

describe("scheduleLocalReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resumeAccountNotifications();
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({ notifications: [] });
    vi.mocked(LocalNotifications.schedule).mockResolvedValue({ notifications: [] });
    vi.mocked(LocalNotifications.cancel).mockResolvedValue(undefined);
    vi.mocked(LocalNotifications.removeAllDeliveredNotifications).mockResolvedValue(undefined);
    pushMocks.removeAllDeliveredNotifications.mockResolvedValue(undefined);
  });

  it("invalidates a delayed account-A schedule and clears pending and delivered OS copy", async () => {
    let resolvePermission!: (value: { display: "granted" }) => void;
    vi.mocked(LocalNotifications.checkPermissions).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePermission = resolve;
      }),
    );

    const delayedSchedule = scheduleLocalReminders(reminders, copy);
    await vi.waitFor(() => expect(LocalNotifications.checkPermissions).toHaveBeenCalled());
    const boundaryCleanup = clearAccountNotificationsForBoundary();
    resolvePermission({ display: "granted" });
    await Promise.all([delayedSchedule, boundaryCleanup]);

    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    expect(LocalNotifications.removeAllDeliveredNotifications).toHaveBeenCalledTimes(1);
    expect(pushMocks.removeAllDeliveredNotifications).toHaveBeenCalledTimes(1);
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
        expect.objectContaining({ id: 201, title: "Mood" }),
        expect.objectContaining({ id: 301, title: "Mood" }),
        expect.objectContaining({ id: 501, title: "Focus" }),
      ]),
    });
    const scheduled = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];
    expect(scheduled.every((notification) => notification.channelId === "zenflow_default_v4")).toBe(true);
    expect(scheduled.every((notification) => notification.sound === "default")).toBe(true);
    expect(scheduled.some((notification) => notification.channelId === "zenflow_reminders")).toBe(false);
    expect(LocalNotifications.schedule).toHaveBeenCalledWith({
      notifications: expect.arrayContaining([
        expect.objectContaining({ id: 201, title: "Mood" }),
        expect.objectContaining({ id: 301, title: "Mood" }),
        expect.objectContaining({ id: 501, title: "Focus" }),
      ]),
    });
    expect(scheduled.map((notification) => notification.id)).not.toContain(1);
    expect(scheduled.map((notification) => notification.id)).not.toContain(4);
  });

  it("does not turn an empty global day selection into daily reminders", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });

    await scheduleLocalReminders({ ...reminders, days: [] }, copy);

    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
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

    expect(scheduled).toHaveLength(6);
    expect(scheduled.every((notification) => notification.schedule && !("every" in notification.schedule))).toBe(true);
    expect(
      scheduled
        .map((notification) =>
          requireNumber(requireScheduleOn(notification).weekday, `weekday for ${notification.id}`),
        )
        .sort((a, b) => a - b),
    ).toEqual([2, 2, 2, 4, 4, 4]);
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
    ).toEqual([1, 1, 1, 7, 7, 7]);
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
      reminderTitle: "Habit reminder",
      reminderBody: "Take the next step",
    });

    expect(initializeNotificationChannels).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(initializeNotificationChannels).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(LocalNotifications.checkPermissions).mock.invocationCallOrder[0]);
    expect(LocalNotifications.schedule).toHaveBeenCalledWith({
      notifications: expect.arrayContaining([
        expect.objectContaining({ channelId: "zenflow_default_v4", sound: "default" }),
      ]),
    });
  });

  it("maps habit reminder weekdays to Capacitor weekday values", async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: "granted" });
    const habit = makeHabit({
      reminders: [{ enabled: true, time: "08:30", days: [0, 6] }],
    });

    await scheduleHabitReminders([habit], {
      reminderTitle: "Habit reminder",
      reminderBody: "Take the next step",
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
        { id: 8888, title: "Quick actions", body: "Keep", schedule: { on: { hour: 9, minute: 0 } } },
        { id: 9001, title: "Quick mood", body: "Keep", schedule: { on: { hour: 8, minute: 15 } } },
        { id: 150, title: "Quick mood daily", body: "Keep", schedule: { on: { hour: 8, minute: 15 } } },
        { id: 10, title: "Journal", body: "Keep", schedule: { on: { hour: 19, minute: 0 } } },
      ],
    });

    await scheduleHabitReminders([makeHabit()], {
      reminderTitle: "Habit reminder",
      reminderBody: "Take the next step",
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
      reminderTitle: "Habit reminder",
      reminderBody: "Take the next step",
    });

    const scheduled = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0].notifications ?? [];
    const ids = scheduled.map((notification) => notification.id).sort((a, b) => a - b);

    expect(scheduled).toHaveLength(7999);
    expect(ids[0]).toBe(1000);
    expect(ids.at(-1)).toBe(8999);
    expect(ids).not.toContain(8888);
    expect(ids).not.toContain(9000);
  });
});

describe("scheduleMoodQuickLogNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resumeAccountNotifications();
    ownerMocks.getCurrentSessionUserId.mockResolvedValue("user-a");
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

  it("does not turn an empty selected-day policy into a daily quick mood reminder", async () => {
    await scheduleMoodQuickLogNotification({ hour: 8, minute: 15 }, "How are you?", {
      days: [],
      quietHours: { start: "22:00", end: "07:00" },
    });

    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("does not schedule quick mood actions inside quiet hours", async () => {
    await scheduleMoodQuickLogNotification({ hour: 6, minute: 30 }, "How are you?", {
      days: [1],
      quietHours: { start: "22:00", end: "07:00" },
    });

    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("drops a delayed account-A action after the boundary resumes for account B", async () => {
    let actionHandler: (action: ActionPerformed) => void | Promise<void> = () => {
      throw new Error("Quick-mood action listener was not registered");
    };
    vi.mocked(LocalNotifications.addListener).mockImplementationOnce(
      async (_eventName, handler) => {
        actionHandler = handler;
        return { remove: vi.fn(() => Promise.resolve()) };
      },
    );
    const accountACallback = vi.fn();
    const accountBCallback = vi.fn();
    const cleanupListener = await setupNotificationActionListener();
    setMoodActionCallback(accountACallback, "user-a");

    await scheduleMoodQuickLogNotification(
      { hour: 8, minute: 15 },
      "How are you?",
    );
    const accountANotification = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0]
      .notifications[0];
    expect(accountANotification?.extra).toEqual(
      expect.objectContaining({
        zenflowAccountOwnerId: "user-a",
        zenflowAccountGeneration: expect.any(Number),
      }),
    );

    await clearAccountNotificationsForBoundary();
    ownerMocks.getCurrentSessionUserId.mockResolvedValue("user-b");
    resumeAccountNotifications();
    setMoodActionCallback(accountBCallback, "user-b");

    if (!accountANotification) {
      throw new Error("Expected a scheduled quick-mood notification");
    }
    await actionHandler({
      actionId: "mood_great",
      notification: accountANotification,
    });

    expect(accountACallback).not.toHaveBeenCalled();
    expect(accountBCallback).not.toHaveBeenCalled();
    await cleanupListener();
  });

  it("clears the quick-mood callback when its listener is unmounted", async () => {
    let actionHandler: (action: ActionPerformed) => void | Promise<void> = () => {
      throw new Error("Quick-mood action listener was not registered");
    };
    vi.mocked(LocalNotifications.addListener).mockImplementationOnce(
      async (_eventName, handler) => {
        actionHandler = handler;
        return { remove: vi.fn(() => Promise.resolve()) };
      },
    );
    const callback = vi.fn();
    const cleanupListener = await setupNotificationActionListener();
    setMoodActionCallback(callback, "user-a");
    await scheduleMoodQuickLogNotification(
      { hour: 8, minute: 15 },
      "How are you?",
    );
    const notification = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0]
      .notifications[0];

    await cleanupListener();
    if (!notification) {
      throw new Error("Expected a scheduled quick-mood notification");
    }
    await actionHandler({ actionId: "mood_good", notification });

    expect(callback).not.toHaveBeenCalled();
  });

  it("does not write the selected mood value to diagnostic logs", async () => {
    let actionHandler: (action: ActionPerformed) => void | Promise<void> = () => {
      throw new Error("Quick-mood action listener was not registered");
    };
    vi.mocked(LocalNotifications.addListener).mockImplementationOnce(
      async (_eventName, handler) => {
        actionHandler = handler;
        return { remove: vi.fn(() => Promise.resolve()) };
      },
    );
    const callback = vi.fn();
    const cleanupListener = await setupNotificationActionListener();
    setMoodActionCallback(callback, "user-a");
    await scheduleMoodQuickLogNotification({ hour: 8, minute: 15 }, "How are you?");
    const notification = vi.mocked(LocalNotifications.schedule).mock.calls[0]?.[0]
      .notifications[0];

    if (!notification) {
      throw new Error("Expected a scheduled quick-mood notification");
    }
    await actionHandler({ actionId: "mood_bad", notification });

    expect(callback).toHaveBeenCalledWith("bad");
    expect(logger.log).not.toHaveBeenCalledWith("Quick mood logged:", "bad");
    await cleanupListener();
  });
});
