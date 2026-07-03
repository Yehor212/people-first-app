import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const platformMock = vi.hoisted(() => ({ isNative: true }));
const localNotificationMocks = vi.hoisted(() => ({
  initializeNotificationChannel: vi.fn(() => Promise.resolve()),
  scheduleLocalReminders: vi.fn(() => Promise.resolve()),
  scheduleHabitReminders: vi.fn(() => Promise.resolve()),
  registerMoodNotificationActions: vi.fn(() => Promise.resolve()),
  setupNotificationActionListener: vi.fn(() => Promise.resolve(vi.fn())),
  setMoodActionCallback: vi.fn(),
  scheduleMoodQuickLogNotification: vi.fn(() => Promise.resolve()),
}));
const pushNotificationMocks = vi.hoisted(() => ({
  initializePushNotifications: vi.fn(() => Promise.resolve()),
  removePushToken: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/platform", () => platformMock);
vi.mock("@/lib/logger", () => ({ logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      reminderMoodTitle: "Mood",
      reminderMoodBody: "Check in",
      reminderHabitTitle: "Habit",
      reminderHabitBody: "Check your habits.",
      reminderFocusTitle: "Focus",
      reminderFocusBody: "Focus time.",
      howAreYouNow: "How are you feeling?",
    },
  }),
}));
vi.mock("@/lib/localNotifications", () => localNotificationMocks);
vi.mock("@/lib/pushNotifications", () => pushNotificationMocks);

import { useNotificationSetup } from "@/hooks/useNotificationSetup";
import { useUserDataStore } from "@/stores/userDataStore";
import { defaultReminderSettings } from "@/lib/reminders";

describe("useNotificationSetup push consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformMock.isNative = true;
    useUserDataStore.setState({
      reminders: { ...defaultReminderSettings, enabled: true },
      habits: [],
      privacy: { noTracking: false, analytics: false, consentShown: true, pushNotifications: false },
    });
  });

  it("keeps local native reminders active without registering remote push", async () => {
    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() => expect(localNotificationMocks.scheduleLocalReminders).toHaveBeenCalled());
    expect(pushNotificationMocks.initializePushNotifications).not.toHaveBeenCalled();
  });

  it("registers remote push only after explicit privacy consent", async () => {
    useUserDataStore.setState({
      privacy: { noTracking: false, analytics: false, consentShown: true, pushNotifications: true },
    });

    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() => expect(pushNotificationMocks.initializePushNotifications).toHaveBeenCalledTimes(1));
    expect(pushNotificationMocks.removePushToken).not.toHaveBeenCalled();
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
  });
});
