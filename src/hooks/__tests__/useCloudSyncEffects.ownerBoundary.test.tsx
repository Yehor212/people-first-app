import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSessionUserId: vi.fn<() => Promise<string | null>>(),
  getSession: vi.fn(),
  syncReminderSettings: vi.fn(),
  syncChallengesWithCloud: vi.fn(),
  syncBadgesWithCloud: vi.fn(),
  syncTasks: vi.fn(),
  syncQuests: vi.fn(),
  setActiveTab: vi.fn(),
  onQuickAction: vi.fn(),
  reminders: {
    enabled: true,
    moodTimeMorning: "09:00",
    moodTimeAfternoon: "14:00",
    moodTimeEvening: "20:00",
    habitTime: "08:00",
    focusTime: "15:00",
    days: [1, 2, 3, 4, 5],
    habitIds: ["habit-a"],
  },
}));

vi.mock("@/stores", () => ({
  useUserDataStore: (selector: (state: { reminders: typeof mocks.reminders }) => unknown) =>
    selector({ reminders: mocks.reminders }),
  useAppStore: (selector: (state: { setActiveTab: typeof mocks.setActiveTab }) => unknown) =>
    selector({ setActiveTab: mocks.setActiveTab }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/hooks/useQuickActions", () => ({
  useQuickActions: () => ({ onAction: mocks.onQuickAction }),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({ isFeatureEnabled: () => false }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/storage/reminderSync", () => ({
  syncReminderSettings: mocks.syncReminderSettings,
}));

vi.mock("@/storage/challengeCloudSync", () => ({
  syncChallengesWithCloud: mocks.syncChallengesWithCloud,
  syncBadgesWithCloud: mocks.syncBadgesWithCloud,
  subscribeToChallengeUpdates: vi.fn(() => () => undefined),
  subscribeToBadgeUpdates: vi.fn(() => () => undefined),
}));

vi.mock("@/storage/tasksCloudSync", () => ({
  syncTasks: mocks.syncTasks,
  syncQuests: mocks.syncQuests,
  subscribeToTaskUpdates: vi.fn(() => () => undefined),
  subscribeToQuestUpdates: vi.fn(() => () => undefined),
}));

vi.mock("@/lib/syncBroadcast", () => ({
  initSyncBroadcast: vi.fn(),
  onRemoteChange: vi.fn(() => () => undefined),
  destroySyncBroadcast: vi.fn(),
}));

vi.mock("@/storage/realtimeSync", () => ({
  pullMoodsFromCloud: vi.fn(),
  pullFocusFromCloud: vi.fn(),
  pullGratitudeFromCloud: vi.fn(),
}));

vi.mock("@/storage/cloudSync", () => ({ silentSync: vi.fn() }));
vi.mock("@/lib/syncIntegrity", () => ({ verifySyncIntegrity: vi.fn() }));
vi.mock("@/lib/platform", () => ({ isNative: false }));
vi.mock("@capacitor/app", () => ({ App: { addListener: vi.fn() } }));
vi.mock("@/lib/cloudSyncResumePolicy", () => ({
  shouldRunLegacyBackupSyncOnNativeResume: vi.fn(() => false),
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    sync: vi.fn(),
    warn: vi.fn(),
  },
}));

import { useCloudSyncEffects } from "../useCloudSyncEffects";

describe("useCloudSyncEffects reminder ownership", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.getCurrentSessionUserId.mockResolvedValue("account-a");
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.syncReminderSettings.mockResolvedValue(undefined);
    mocks.syncChallengesWithCloud.mockResolvedValue({ challenges: null });
    mocks.syncBadgesWithCloud.mockResolvedValue({ badges: null });
    mocks.syncTasks.mockResolvedValue([]);
    mocks.syncQuests.mockResolvedValue({ daily: null, weekly: null, bonus: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps account A on reminder settings captured before the delayed write", async () => {
    const params = {
      setChallenges: vi.fn(),
      setBadges: vi.fn(),
      handleNavigateToSection: vi.fn(),
      quickActionTimeoutRef: { current: null },
    };

    const { unmount } = renderHook(() => useCloudSyncEffects(params));

    await act(async () => {
      await Promise.resolve();
    });

    mocks.getCurrentSessionUserId.mockResolvedValue("account-b");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mocks.syncReminderSettings).toHaveBeenCalledWith(
      mocks.reminders,
      "en",
      "account-a"
    );

    unmount();
  });

  it("threads the authenticated mount owner through task and quest sync", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "account-a" } } },
      error: null,
    });
    const params = {
      setChallenges: vi.fn(),
      setBadges: vi.fn(),
      handleNavigateToSection: vi.fn(),
      quickActionTimeoutRef: { current: null },
    };

    const { unmount } = renderHook(() => useCloudSyncEffects(params));

    await act(async () => {
      for (let index = 0; index < 8; index += 1) {
        await Promise.resolve();
      }
    });

    expect(mocks.syncTasks).toHaveBeenCalledWith("account-a");
    expect(mocks.syncQuests).toHaveBeenCalledWith("account-a");

    unmount();
  });
});
