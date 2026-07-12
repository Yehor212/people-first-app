import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PushRevocationResult } from "@/lib/pushNotifications";

const platformMock = vi.hoisted(() => ({ isNative: true }));
const localNotificationMocks = vi.hoisted(() => ({
  initializeNotificationChannel: vi.fn(() => Promise.resolve()),
  reconcileReminderNotifications: vi.fn(() =>
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

vi.mock("@/lib/platform", () => platformMock);
vi.mock("@/lib/logger", () => ({ logger: loggerMocks }));
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
      privacyPushNotifications: "Remote push notifications",
      pushRevocationIncomplete:
        "ZenFlow could not fully disconnect remote notifications from this device.",
      errorBoundaryTitle: "Something went wrong",
      retry: "Retry",
    },
  }),
}));
vi.mock("@/lib/localNotifications", () => localNotificationMocks);
vi.mock("@/lib/pushNotifications", () => pushNotificationMocks);
vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: vi.fn(() => Promise.resolve("user-a")),
}));

import { useNotificationSetup } from "@/hooks/useNotificationSetup";
import { useUserDataStore } from "@/stores/userDataStore";
import { useAppStore } from "@/stores/appStore";
import { defaultReminderSettings } from "@/lib/reminders";

describe("useNotificationSetup push consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformMock.isNative = true;
    pushNotificationMocks.removePushToken.mockResolvedValue({
      status: "revoked",
      remote: "not-registered",
      native: "unregistered",
    });
    useUserDataStore.setState({
      reminders: { ...defaultReminderSettings, enabled: true },
      habits: [],
      privacy: { noTracking: false, analytics: false, consentShown: true, pushNotifications: false },
    });
    useAppStore.setState({ hasValidSession: true });
  });

  it("keeps local native reminders active without registering remote push", async () => {
    renderHook(() => useNotificationSetup({ handleQuickMood: vi.fn() }));

    await waitFor(() =>
      expect(localNotificationMocks.reconcileReminderNotifications).toHaveBeenCalledTimes(1),
    );
    expect(pushNotificationMocks.initializePushNotifications).not.toHaveBeenCalled();
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
    pushNotificationMocks.removePushToken
      .mockResolvedValueOnce({
        status: "partial",
        remote: "failed",
        native: "unregistered",
      })
      .mockResolvedValueOnce({
        status: "revoked",
        remote: "deleted",
        native: "unregistered",
      });
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
      retry: () => void;
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

    act(() => revocationEvents[0].retry());

    await waitFor(() => expect(pushNotificationMocks.removePushToken).toHaveBeenCalledTimes(2));
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
