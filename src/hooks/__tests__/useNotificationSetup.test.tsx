import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PushRevocationResult } from "@/lib/pushNotifications";
import { ar } from "@/i18n/languages/ar";
import { de } from "@/i18n/languages/de";
import { en } from "@/i18n/languages/en";
import { es } from "@/i18n/languages/es";
import { fr } from "@/i18n/languages/fr";
import { he } from "@/i18n/languages/he";
import { ja } from "@/i18n/languages/ja";
import { uk } from "@/i18n/languages/uk";
import type { Habit } from "@/types";

type ReconcileReminderNotifications =
  typeof import("@/lib/localNotifications").reconcileReminderNotifications;
type ReconcilePersistedMasterReminders =
  typeof import("@/lib/persistedReminderReconciliation").reconcilePersistedMasterReminders;
type ReadVerifiedNotificationRealm =
  typeof import("@/storage/notificationRealm").readVerifiedNotificationRealm;
type AssertVerifiedNotificationRealmCurrent =
  typeof import("@/storage/notificationRealm").assertVerifiedNotificationRealmCurrent;

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

const platformMock = vi.hoisted(() => ({ isNative: true }));
const localNotificationMocks = vi.hoisted(() => ({
  initializeNotificationChannel: vi.fn(() => Promise.resolve()),
  reconcileReminderNotifications: vi.fn<ReconcileReminderNotifications>(() =>
    Promise.resolve({ status: "scheduled" as const, scheduledCount: 1 }),
  ),
  scheduleLocalReminders: vi.fn(() => Promise.resolve()),
  scheduleHabitReminders: vi.fn(() => Promise.resolve()),
  registerMoodNotificationActions: vi.fn(() => Promise.resolve()),
  setupNotificationActionListener: vi.fn(() => Promise.resolve(vi.fn())),
  setMoodActionCallback: vi.fn(),
  clearMoodActionCallback: vi.fn(),
  scheduleMoodQuickLogNotification: vi.fn(() => Promise.resolve()),
  cancelMoodQuickLogNotification: vi.fn(() => Promise.resolve()),
  resumeAccountNotifications: vi.fn(),
}));
const pushNotificationMocks = vi.hoisted(() => ({
  initializePushNotifications: vi.fn(() => Promise.resolve()),
  readPushRegistrationEvidence: vi.fn<() => "absent" | "present" | "unknown">(
    () => "absent",
  ),
  removePushToken: vi.fn<() => Promise<PushRevocationResult>>(() => Promise.resolve({
    status: "revoked" as const,
    remote: "not-registered" as const,
    native: "unregistered" as const,
  })),
}));
const loggerMocks = vi.hoisted(() => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
const journalReminderMocks = vi.hoisted(() => ({
  reconcileJournalReminderAtStartup: vi.fn(() => Promise.resolve()),
}));
const reminderPersistenceMocks = vi.hoisted(() => ({
  readPersistedReminderSnapshot: vi.fn(),
}));
const persistedReconcileMocks = vi.hoisted(() => ({
  revision: 0,
  reconcilePersistedMasterReminders: vi.fn<ReconcilePersistedMasterReminders>(),
}));
const notificationRealmMocks = vi.hoisted(() => ({
  readVerifiedNotificationRealm: vi.fn<ReadVerifiedNotificationRealm>(() =>
    Promise.resolve({
      kind: "account" as const,
      ownerUserId: "user-a",
      generation: "generation-a",
    }),
  ),
  assertVerifiedNotificationRealmCurrent:
    vi.fn<AssertVerifiedNotificationRealmCurrent>(() => Promise.resolve()),
}));
const languageMock = vi.hoisted(() => ({
  t: {},
}));

const defaultLanguageCopy = {
  reminderMoodTitle: "Mood",
  reminderMoodBody: "Check in",
  reminderHabitTitle: "Habit reminder",
  reminderHabitBody: "Check your habits.",
  reminderFocusTitle: "Focus",
  reminderFocusBody: "Focus time.",
  journalReminderNotifTitle: "Time to write",
  journalReminderNotifBody: "Take a moment to write.",
  howAreYouNow: "How are you feeling?",
  privacyPushNotifications: "Remote push notifications",
  pushRevocationIncomplete:
    "ZenFlow could not fully disconnect remote notifications from this device.",
  pushPermissionDenied: "Turn on notifications for ZenFlow in your device settings.",
  reminderReconcileRestored:
    "ZenFlow couldn't apply the latest reminder change. Your previous schedule is still active.",
  reminderReconcileUncertain:
    "ZenFlow couldn't finish updating reminders. Some reminders may be missing or duplicated.",
  settingsGroupReminders: "Reminder settings",
  errorBoundaryTitle: "Something went wrong",
  retry: "Retry",
  viewDetails: "View details",
};

vi.mock("@/lib/platform", () => platformMock);
vi.mock("@/lib/logger", () => ({ logger: loggerMocks }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: languageMock.t,
  }),
}));
vi.mock("@/lib/localNotifications", () => localNotificationMocks);
vi.mock("@/lib/pushNotifications", () => pushNotificationMocks);
vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: vi.fn(() => Promise.resolve("user-a")),
}));
vi.mock("@/features/journal/useJournalReminder", () => journalReminderMocks);
vi.mock("@/storage/reminderPersistence", () => reminderPersistenceMocks);
vi.mock("@/lib/persistedReminderReconciliation", () => persistedReconcileMocks);
vi.mock("@/storage/notificationRealm", () => notificationRealmMocks);

import { useNotificationSetup } from "@/hooks/useNotificationSetup";
import { useUserDataStore } from "@/stores/userDataStore";
import { useAppStore } from "@/stores/appStore";
import { defaultReminderSettings } from "@/lib/reminders";

describe("useNotificationSetup push consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    languageMock.t = { ...defaultLanguageCopy };
    platformMock.isNative = true;
    journalReminderMocks.reconcileJournalReminderAtStartup.mockReset().mockResolvedValue(undefined);
    notificationRealmMocks.readVerifiedNotificationRealm.mockReset().mockResolvedValue({
      kind: "account",
      ownerUserId: "user-a",
      generation: "generation-a",
    });
    notificationRealmMocks.assertVerifiedNotificationRealmCurrent
      .mockReset()
      .mockResolvedValue(undefined);
    pushNotificationMocks.removePushToken.mockResolvedValue({
      status: "revoked",
      remote: "not-registered",
      native: "unregistered",
    });
    pushNotificationMocks.readPushRegistrationEvidence.mockReturnValue("absent");
    useUserDataStore.setState({
      reminders: { ...defaultReminderSettings, enabled: true },
      habits: [],
      privacy: { noTracking: false, analytics: false, consentShown: true, pushNotifications: false },
      isLoading: false,
    });
    useAppStore.setState({
      hasValidSession: true,
      isAccountBoundaryInProgress: false,
    });
    reminderPersistenceMocks.readPersistedReminderSnapshot.mockImplementation(
      async () => {
        const state = useUserDataStore.getState();
        return { reminders: state.reminders, habits: state.habits };
      }
    );
    persistedReconcileMocks.revision = 0;
    persistedReconcileMocks.reconcilePersistedMasterReminders
      .mockReset()
      .mockImplementation(async (copy, options = {}) => {
        const revision = ++persistedReconcileMocks.revision;
        const isCurrent = () => revision === persistedReconcileMocks.revision;
        const assertRequestCurrent = async () => {
          if (!isCurrent()) throw new Error("Persisted reminder reconciliation was superseded");
          await options.assertRequestCurrent?.();
          if (!isCurrent()) throw new Error("Persisted reminder reconciliation was superseded");
        };
        await assertRequestCurrent();
        const realm = await notificationRealmMocks.readVerifiedNotificationRealm();
        if (!isCurrent()) return { status: "superseded", scheduledCount: 0 };
        const snapshot = await reminderPersistenceMocks.readPersistedReminderSnapshot();
        if (!isCurrent()) return { status: "superseded", scheduledCount: 0 };
        const assertRealmCurrent = async () => {
          await assertRequestCurrent();
          await notificationRealmMocks.assertVerifiedNotificationRealmCurrent(realm);
          await assertRequestCurrent();
        };
        await assertRealmCurrent();
        if (!isCurrent()) return { status: "superseded", scheduledCount: 0 };
        return localNotificationMocks.reconcileReminderNotifications(
          snapshot.reminders,
          snapshot.reminders.enabled ? snapshot.habits : [],
          copy,
          {
            ...(options.rollbackChannelId
              ? { rollbackChannelId: options.rollbackChannelId }
              : {}),
            ownerUserId: realm.ownerUserId,
            moodActionsEnabled: realm.kind === "account",
            assertRealmCurrent,
          },
        );
      });
  });

  it("keeps local native reminders active without registering remote push", async () => {
    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(1),
    );
    expect(pushNotificationMocks.initializePushNotifications).not.toHaveBeenCalled();
    expect(pushNotificationMocks.removePushToken).not.toHaveBeenCalled();
  });

  it("retries cleanup for a known registration when hydrated consent starts disabled", async () => {
    pushNotificationMocks.readPushRegistrationEvidence.mockReturnValue("present");

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() =>
      expect(pushNotificationMocks.removePushToken).toHaveBeenCalledTimes(1),
    );
  });

  it("waits for hydrated user data before reconciling native reminder state", async () => {
    useUserDataStore.setState({ isLoading: true });
    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await act(async () => Promise.resolve());
    expect(localNotificationMocks.reconcileReminderNotifications).not.toHaveBeenCalled();
    expect(journalReminderMocks.reconcileJournalReminderAtStartup).not.toHaveBeenCalled();

    act(() => useUserDataStore.setState({ isLoading: false }));

    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(1),
    );
    expect(journalReminderMocks.reconcileJournalReminderAtStartup).toHaveBeenCalledTimes(1);
  });

  it("does not inspect durable reminders or mutate native schedules while auth is unresolved", async () => {
    useAppStore.setState({ hasValidSession: null });

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await act(async () => Promise.resolve());

    expect(reminderPersistenceMocks.readPersistedReminderSnapshot).not.toHaveBeenCalled();
    expect(localNotificationMocks.reconcileReminderNotifications).not.toHaveBeenCalled();
    expect(journalReminderMocks.reconcileJournalReminderAtStartup).not.toHaveBeenCalled();
    expect(localNotificationMocks.registerMoodNotificationActions).not.toHaveBeenCalled();
  });

  it("does not mutate native schedules while an account boundary is in progress", async () => {
    useAppStore.setState({ isAccountBoundaryInProgress: true });

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await act(async () => Promise.resolve());

    expect(reminderPersistenceMocks.readPersistedReminderSnapshot).not.toHaveBeenCalled();
    expect(localNotificationMocks.reconcileReminderNotifications).not.toHaveBeenCalled();
    expect(journalReminderMocks.reconcileJournalReminderAtStartup).not.toHaveBeenCalled();
    expect(localNotificationMocks.registerMoodNotificationActions).not.toHaveBeenCalled();
  });

  it("waits for one durable reminder snapshot before mutating native schedules", async () => {
    const snapshot = createDeferred<{
      reminders: typeof defaultReminderSettings;
      habits: Habit[];
    }>();
    reminderPersistenceMocks.readPersistedReminderSnapshot.mockReturnValueOnce(
      snapshot.promise
    );

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await waitFor(() =>
      expect(reminderPersistenceMocks.readPersistedReminderSnapshot).toHaveBeenCalledTimes(1)
    );
    expect(localNotificationMocks.reconcileReminderNotifications).not.toHaveBeenCalled();

    snapshot.resolve({
      reminders: { ...defaultReminderSettings, enabled: true },
      habits: [],
    });

    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true }),
        [],
        expect.any(Object),
        expect.any(Object),
      )
    );
  });

  it("does not mutate native schedules when the durable snapshot cannot be read", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    reminderPersistenceMocks.readPersistedReminderSnapshot.mockRejectedValueOnce(
      new Error("IndexedDB read failed")
    );

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() =>
      expect(dispatch.mock.calls.some(([event]) =>
        event.type === "zenflow:reminder-reconcile-failed"
      )).toBe(true)
    );
    expect(localNotificationMocks.reconcileReminderNotifications).not.toHaveBeenCalled();
    dispatch.mockRestore();
  });

  it("fails closed before durable or native work when the notification realm is unresolved", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    notificationRealmMocks.readVerifiedNotificationRealm.mockRejectedValue(
      new Error("pending account cleanup"),
    );

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() =>
      expect(dispatch.mock.calls.some(([event]) =>
        event.type === "zenflow:reminder-reconcile-failed"
      )).toBe(true),
    );
    expect(reminderPersistenceMocks.readPersistedReminderSnapshot).not.toHaveBeenCalled();
    expect(localNotificationMocks.reconcileReminderNotifications).not.toHaveBeenCalled();
    expect(journalReminderMocks.reconcileJournalReminderAtStartup).not.toHaveBeenCalled();
    expect(localNotificationMocks.registerMoodNotificationActions).not.toHaveBeenCalled();
    dispatch.mockRestore();
  });

  it("still reconciles the independent journal reminder when the master snapshot read fails", async () => {
    reminderPersistenceMocks.readPersistedReminderSnapshot.mockRejectedValueOnce(
      new Error("master reminder snapshot failed"),
    );

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() =>
      expect(journalReminderMocks.reconcileJournalReminderAtStartup).toHaveBeenCalledTimes(1),
    );
    expect(localNotificationMocks.reconcileReminderNotifications).not.toHaveBeenCalled();
  });

  it("discards a durable snapshot that resolves after its effect was superseded", async () => {
    const staleSnapshot = createDeferred<{
      reminders: typeof defaultReminderSettings;
      habits: Habit[];
    }>();
    const latestReminders = {
      ...defaultReminderSettings,
      enabled: false,
      focusReminderEnabled: false,
    };
    reminderPersistenceMocks.readPersistedReminderSnapshot
      .mockReturnValueOnce(staleSnapshot.promise)
      .mockResolvedValueOnce({ reminders: latestReminders, habits: [] });

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await waitFor(() =>
      expect(reminderPersistenceMocks.readPersistedReminderSnapshot).toHaveBeenCalledTimes(1)
    );

    act(() => useUserDataStore.setState({ reminders: latestReminders }));
    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledWith(
        latestReminders,
        [],
        expect.any(Object),
        expect.any(Object),
      )
    );

    staleSnapshot.resolve({
      reminders: { ...defaultReminderSettings, enabled: true },
      habits: [],
    });
    await act(async () => Promise.resolve());

    expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(1);
  });

  it("keeps device-local reminders available while signed out", async () => {
    useAppStore.setState({ hasValidSession: false });

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(1)
    );
    expect(pushNotificationMocks.initializePushNotifications).not.toHaveBeenCalled();
    expect(localNotificationMocks.resumeAccountNotifications).not.toHaveBeenCalled();
  });

  it("disables quick-mood actions when reconciling a verified signed-out local realm", async () => {
    useAppStore.setState({ hasValidSession: false });
    notificationRealmMocks.readVerifiedNotificationRealm.mockResolvedValue({
      kind: "local",
      ownerUserId: null,
      generation: "generation-local",
    });

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          ownerUserId: null,
          moodActionsEnabled: false,
          assertRealmCurrent: expect.any(Function),
        }),
      ),
    );
    expect(localNotificationMocks.registerMoodNotificationActions).not.toHaveBeenCalled();
  });

  it("passes an explicit realm guard and action policy into the master reconciler", async () => {
    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          ownerUserId: "user-a",
          moodActionsEnabled: true,
          assertRealmCurrent: expect.any(Function),
        }),
      ),
    );
  });

  it("reconciles local reminders after account notifications resume", async () => {
    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(1),
    );

    act(() => useAppStore.setState({ hasValidSession: false }));
    await act(async () => Promise.resolve());
    act(() => useAppStore.setState({ hasValidSession: true }));

    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(3),
    );
    expect(localNotificationMocks.resumeAccountNotifications).toHaveBeenCalledTimes(2);
    expect(
      localNotificationMocks.resumeAccountNotifications.mock.invocationCallOrder.at(-1),
    ).toBeLessThan(
      localNotificationMocks.reconcileReminderNotifications.mock.invocationCallOrder.at(-1) ?? 0,
    );
  });

  it("reconciles the journal reminder from the app root without opening the diary route", async () => {
    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() =>
      expect(journalReminderMocks.reconcileJournalReminderAtStartup).toHaveBeenCalledWith({
        reminderTitle: "Time to write",
        reminderBody: "Take a moment to write.",
      }),
    );
  });

  it("does not rebuild the independent journal reminder for master-only changes", async () => {
    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await waitFor(() =>
      expect(journalReminderMocks.reconcileJournalReminderAtStartup).toHaveBeenCalledTimes(1),
    );

    for (let index = 0; index < 7; index += 1) {
      act(() => {
        useUserDataStore.setState({
          reminders: {
            ...useUserDataStore.getState().reminders,
            focusTime: `${10 + index}:00`,
          },
        });
      });
      await act(async () => Promise.resolve());
    }

    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications.mock.calls.length).toBeGreaterThan(1),
    );
    expect(journalReminderMocks.reconcileJournalReminderAtStartup).toHaveBeenCalledTimes(1);
  });

  it.each(Object.entries({ en, uk, es, de, fr, ja, ar, he }))(
    "passes the complete %s locale payload to native reminder reconcilers",
    async (language, translations) => {
      languageMock.t = translations;
      const habit = {
        id: "habit-mixed-direction",
        name: "הליכה Walk",
        reminders: [{ enabled: true, time: "08:30", days: [1] }],
      } as Habit;
      useUserDataStore.setState({
        reminders: {
          ...defaultReminderSettings,
          enabled: true,
          habitIds: [habit.id],
        },
        habits: [habit],
      });

      renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

      await waitFor(() =>
        expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(1),
      );

      const reminderCalls = localNotificationMocks.reconcileReminderNotifications.mock
        .calls as unknown as Array<
        [
          unknown,
          unknown,
          {
            mood: { title: string; body: string };
            habit: { title: string; body: string };
            focus: { title: string; body: string };
            quickMoodBody: string;
          },
        ]
      >;
      const payload = reminderCalls.at(-1)?.[2];
      expect(payload, language).toMatchObject({
        mood: {
          title: translations.reminderMoodTitle,
          body: translations.reminderMoodBody,
        },
        focus: {
          title: translations.reminderFocusTitle,
          body: translations.reminderFocusBody,
        },
        quickMoodBody: translations.howAreYouNow,
      });
      expect(payload?.habit, language).toEqual({
        title: translations.reminderHabitTitle,
        body: translations.reminderHabitBody,
      });

      const journalCalls = journalReminderMocks.reconcileJournalReminderAtStartup.mock
        .calls as unknown as Array<
        [{ reminderTitle: string; reminderBody: string }]
      >;
      expect(journalCalls.at(-1)?.[0], language).toEqual({
        reminderTitle: translations.journalReminderNotifTitle,
        reminderBody: translations.journalReminderNotifBody,
      });
    },
  );

  it("exposes root journal reminder reconciliation failure through the shared retry event", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    journalReminderMocks.reconcileJournalReminderAtStartup
      .mockRejectedValueOnce(new Error("journal schedule failed"))
      .mockResolvedValueOnce(undefined);

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    let failureEvent: CustomEvent<{ retry: () => void }> | undefined;
    await waitFor(() => {
      failureEvent = dispatch.mock.calls
        .map(([event]) => event)
        .find((event) => event.type === "zenflow:reminder-reconcile-failed") as
        | CustomEvent<{ retry: () => void }>
        | undefined;
      expect(failureEvent).toBeDefined();
    });

    failureEvent?.detail.retry();
    await waitFor(() =>
      expect(journalReminderMocks.reconcileJournalReminderAtStartup).toHaveBeenCalledTimes(2),
    );
    dispatch.mockRestore();
  });

  it("publishes a retryable user-visible event when native reminder reconciliation fails", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    localNotificationMocks.reconcileReminderNotifications
      .mockRejectedValueOnce(new Error("schedule failed"))
      .mockResolvedValueOnce({ status: "scheduled", scheduledCount: 1 });

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    let failureEvent: CustomEvent<{ retry: () => void }> | undefined;
    await waitFor(() => {
      failureEvent = dispatch.mock.calls
        .map(([event]) => event)
        .find((event) => event.type === "zenflow:reminder-reconcile-failed") as
        | CustomEvent<{ retry: () => void }>
        | undefined;
      expect(failureEvent).toBeDefined();
    });

    failureEvent?.detail.retry();
    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(2),
    );
    dispatch.mockRestore();
  });

  it("publishes permission guidance instead of a blind retry when native permission is required", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    localNotificationMocks.reconcileReminderNotifications.mockResolvedValueOnce({
      status: "permission-required",
      scheduledCount: 0,
    });

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    let failureEvent: CustomEvent<{
      reason: string;
      message: string;
      retryLabel: string;
      retry: () => void;
    }> | undefined;
    await waitFor(() => {
      failureEvent = dispatch.mock.calls
        .map(([event]) => event)
        .find((event) => event.type === "zenflow:reminder-reconcile-failed") as
        | typeof failureEvent
        | undefined;
      expect(failureEvent).toBeDefined();
    });

    expect(failureEvent?.detail).toMatchObject({
      reason: "permission-required",
      message: "Turn on notifications for ZenFlow in your device settings.",
      retryLabel: "Reminder settings",
    });
    const callsBeforeAction = localNotificationMocks.reconcileReminderNotifications.mock.calls.length;
    failureEvent?.detail.retry();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "zenflow:open-reminder-settings",
        detail: { reason: "permission-required" },
      }),
    );
    expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(
      callsBeforeAction,
    );
    dispatch.mockRestore();
  });

  it("announces one permission incident per denied-state transition across repeated resumes", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const permissionRequired = {
      status: "permission-required" as const,
      scheduledCount: 0 as const,
    };
    localNotificationMocks.reconcileReminderNotifications.mockResolvedValue(permissionRequired);

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() => {
      const incidents = dispatch.mock.calls
        .map(([event]) => event)
        .filter((event) => event.type === "zenflow:reminder-reconcile-failed");
      expect(incidents).toHaveLength(1);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("zenflow:native-reminder-reconcile", {
        detail: { reason: "app-resume" },
      }));
    });
    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(2),
    );
    expect(
      dispatch.mock.calls
        .map(([event]) => event)
        .filter((event) => event.type === "zenflow:reminder-reconcile-failed"),
    ).toHaveLength(1);

    localNotificationMocks.reconcileReminderNotifications.mockResolvedValueOnce({
      status: "scheduled",
      scheduledCount: 1,
    });
    act(() => {
      window.dispatchEvent(new CustomEvent("zenflow:native-reminder-reconcile", {
        detail: { reason: "app-resume" },
      }));
    });
    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(3),
    );

    localNotificationMocks.reconcileReminderNotifications.mockResolvedValueOnce(permissionRequired);
    act(() => {
      window.dispatchEvent(new CustomEvent("zenflow:native-reminder-reconcile", {
        detail: { reason: "app-resume" },
      }));
    });
    await waitFor(() => {
      const incidents = dispatch.mock.calls
        .map(([event]) => event)
        .filter((event) => event.type === "zenflow:reminder-reconcile-failed");
      expect(incidents).toHaveLength(2);
    });
    dispatch.mockRestore();
  });

  it.each([
    [
      "native-restored",
      "previous-restored",
      "ZenFlow couldn't apply the latest reminder change. Your previous schedule is still active.",
      "Retry",
    ],
    [
      "native-uncertain",
      "schedule-uncertain",
      "ZenFlow couldn't finish updating reminders. Some reminders may be missing or duplicated.",
      "Reminder settings",
    ],
  ] as const)(
    "publishes a distinct %s recovery outcome",
    async (status, reason, message, actionLabel) => {
      const dispatch = vi.spyOn(window, "dispatchEvent");
      localNotificationMocks.reconcileReminderNotifications.mockResolvedValueOnce({
        status,
        scheduledCount: 0,
        error: new Error("replacement failed"),
      } as never);

      renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

      let failureEvent: CustomEvent<{
        reason: string;
        message: string;
        retryLabel: string;
      }> | undefined;
      await waitFor(() => {
        failureEvent = dispatch.mock.calls
          .map(([event]) => event)
          .find((event) => event.type === "zenflow:reminder-reconcile-failed") as
          | typeof failureEvent
          | undefined;
        expect(failureEvent).toBeDefined();
      });
      expect(failureEvent?.detail).toMatchObject({ reason, message, retryLabel: actionLabel });
      dispatch.mockRestore();
    },
  );

  it("reconciles from durable state after the central app-resume wake", async () => {
    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await waitFor(() =>
      expect(reminderPersistenceMocks.readPersistedReminderSnapshot).toHaveBeenCalledTimes(1),
    );

    act(() => {
      window.dispatchEvent(new CustomEvent("zenflow:native-reminder-reconcile", {
        detail: { reason: "app-resume" },
      }));
    });

    await waitFor(() =>
      expect(reminderPersistenceMocks.readPersistedReminderSnapshot).toHaveBeenCalledTimes(2),
    );
    expect(journalReminderMocks.reconcileJournalReminderAtStartup).toHaveBeenCalledTimes(2);
  });

  it("enters the persisted reconciliation owner immediately for overlapping lifecycle wakes", async () => {
    const first = createDeferred<{ status: "scheduled"; scheduledCount: number }>();
    persistedReconcileMocks.reconcilePersistedMasterReminders
      .mockReset()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ status: "scheduled", scheduledCount: 1 });

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await waitFor(() =>
      expect(persistedReconcileMocks.reconcilePersistedMasterReminders).toHaveBeenCalledTimes(1),
    );

    act(() => {
      window.dispatchEvent(new CustomEvent("zenflow:native-reminder-reconcile", {
        detail: { reason: "app-resume" },
      }));
    });

    await waitFor(() =>
      expect(persistedReconcileMocks.reconcilePersistedMasterReminders).toHaveBeenCalledTimes(2),
    );
    first.resolve({ status: "scheduled", scheduledCount: 1 });
  });

  it("cancels quick mood actions when the master reminder setting is disabled", async () => {
    const hook = renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(1),
    );

    act(() => {
      useUserDataStore.setState({
        reminders: { ...defaultReminderSettings, enabled: false },
      });
    });

    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: false }),
        [],
        expect.objectContaining({ quickMoodBody: "How are you feeling?" }),
        expect.any(Object),
      ),
    );
    hook.unmount();
  });

  it("registers remote push only after explicit privacy consent", async () => {
    useUserDataStore.setState({
      privacy: { noTracking: false, analytics: false, consentShown: true, pushNotifications: true },
    });

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() => expect(pushNotificationMocks.initializePushNotifications).toHaveBeenCalledTimes(1));
    expect(pushNotificationMocks.removePushToken).not.toHaveBeenCalled();
  });

  it("re-registers a consented device after signing out and signing in again", async () => {
    useUserDataStore.setState({
      privacy: { noTracking: false, analytics: false, consentShown: true, pushNotifications: true },
    });

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await waitFor(() =>
      expect(pushNotificationMocks.initializePushNotifications).toHaveBeenCalledTimes(1),
    );

    act(() => useAppStore.setState({ hasValidSession: false }));
    act(() => useAppStore.setState({ hasValidSession: true }));

    await waitFor(() =>
      expect(pushNotificationMocks.initializePushNotifications).toHaveBeenCalledTimes(2),
    );
  });

  it("removes the remote push token when consent is revoked", async () => {
    useUserDataStore.setState({
      privacy: { noTracking: false, analytics: false, consentShown: true, pushNotifications: true },
    });
    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await waitFor(() => expect(pushNotificationMocks.initializePushNotifications).toHaveBeenCalledTimes(1));

    act(() => {
      useUserDataStore.setState({
        privacy: { noTracking: true, analytics: false, consentShown: true, pushNotifications: false },
      });
    });

    await waitFor(() => expect(pushNotificationMocks.removePushToken).toHaveBeenCalledTimes(1));
    expect(loggerMocks.warn).not.toHaveBeenCalledWith(
      "[Push] Registration cleanup is incomplete after consent was disabled",
      expect.anything(),
    );
  });

  it("reports remote cleanup failure and retries without restoring consent", async () => {
    const retryAttempt = createDeferred<PushRevocationResult>();
    pushNotificationMocks.removePushToken
      .mockResolvedValueOnce({
        status: "partial",
        remote: "failed",
        native: "unregistered",
      })
      .mockReturnValueOnce(retryAttempt.promise);
    useUserDataStore.setState({
      privacy: { noTracking: false, analytics: false, consentShown: true, pushNotifications: true },
    });
    const revocationEvents: Array<{
      status: string;
      remote: string;
      native: string;
      retryable: boolean;
      message: string;
      retryLabel: string;
      retry: () => void | Promise<void>;
    }> = [];
    const handleRevocationIssue = (event: Event) => {
      revocationEvents.push((event as CustomEvent).detail);
    };
    window.addEventListener("zenflow:push-revocation-incomplete", handleRevocationIssue);

    const hook = renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await waitFor(() => expect(pushNotificationMocks.initializePushNotifications).toHaveBeenCalledTimes(1));

    act(() => {
      useUserDataStore.setState({
        privacy: { noTracking: true, analytics: false, consentShown: true, pushNotifications: false },
      });
    });

    await waitFor(() => expect(revocationEvents).toEqual([expect.objectContaining({
      status: "partial",
      remote: "failed",
      native: "unregistered",
      retryable: true,
      message: "ZenFlow could not fully disconnect remote notifications from this device.",
      retryLabel: "Retry",
      retry: expect.any(Function),
    })]));
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      "[Push] Registration cleanup is incomplete after consent was disabled",
      {
        status: "partial",
        remote: "failed",
        native: "unregistered",
      },
    );
    expect(useUserDataStore.getState().privacy.pushNotifications).toBe(false);

    let retryResult: void | Promise<void>;
    act(() => {
      retryResult = revocationEvents[0].retry();
    });

    await waitFor(() => expect(pushNotificationMocks.removePushToken).toHaveBeenCalledTimes(2));
    expect(retryResult!).toBeInstanceOf(Promise);
    retryAttempt.resolve({
      status: "revoked",
      remote: "deleted",
      native: "unregistered",
    });
    await act(async () => {
      await retryResult;
    });
    expect(pushNotificationMocks.initializePushNotifications).toHaveBeenCalledTimes(1);
    expect(useUserDataStore.getState().privacy.pushNotifications).toBe(false);

    hook.unmount();
    window.removeEventListener("zenflow:push-revocation-incomplete", handleRevocationIssue);
  });

  it("reports native cleanup failure while keeping remote push consent disabled", async () => {
    pushNotificationMocks.removePushToken.mockResolvedValueOnce({
      status: "partial",
      remote: "deleted",
      native: "failed",
    });
    useUserDataStore.setState({
      privacy: { noTracking: false, analytics: false, consentShown: true, pushNotifications: true },
    });
    const revocationEvents: unknown[] = [];
    const handleRevocationIssue = (event: Event) => {
      revocationEvents.push((event as CustomEvent).detail);
    };
    window.addEventListener("zenflow:push-revocation-incomplete", handleRevocationIssue);

    const hook = renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));
    await waitFor(() => expect(pushNotificationMocks.initializePushNotifications).toHaveBeenCalledTimes(1));

    act(() => {
      useUserDataStore.setState({
        privacy: { noTracking: true, analytics: false, consentShown: true, pushNotifications: false },
      });
    });

    await waitFor(() => expect(revocationEvents).toEqual([expect.objectContaining({
      status: "partial",
      remote: "deleted",
      native: "failed",
      retryable: true,
      retry: expect.any(Function),
    })]));
    expect(useUserDataStore.getState().privacy.pushNotifications).toBe(false);

    hook.unmount();
    window.removeEventListener("zenflow:push-revocation-incomplete", handleRevocationIssue);
  });
});
