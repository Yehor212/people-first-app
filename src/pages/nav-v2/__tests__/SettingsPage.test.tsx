import type React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../SettingsPage";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Settings: "Settings",
      navV2Theme: "Theme",
      navV2SettingsPlaceholder: "Prepare your controls.",
      themeLight: "Light",
      themeDark: "Dark",
      theme: "Theme",
      appearance: "Appearance",
      settingsGroupProfile: "Profile",
      yourName: "Your name",
      settingsGroupModules: "Modules",
      settingsModulesDescription: "Choose modules.",
      notifications: "Notifications",
      remindersDescription: "Reminder controls.",
      language: "Language",
      selectLanguage: "Choose language.",
      privacy: "Privacy",
      settingsGroupSecurity: "Security",
      settingsSecurityDesc: "Protect your space.",
      settingsSectionData: "Data",
      settingsExportDescription: "Backup and export.",
      settingsGroupAccount: "Account",
      settingsAccountDesc: "Account controls.",
      settingsGroupAbout: "About",
      settingsCloudSyncTitle: "Automatic sync",
      settingsCloudSyncEnabled: "Automatic sync active",
      settingsCloudSyncDescription: "Signed-in data stays synced across devices.",
      settingsCloudSyncDisabledByUser: "Sync paused",
      cloudSyncDisabled: "Cloud sync disabled",
      sessionExpiredSettings: "Your session has expired",
      localDataSafe: "Your local data is safe.",
      syncing: "Syncing...",
      settingsGroupData: "Data & Privacy",
      moodReminder: "Mood",
      habitReminder: "Habit",
      notificationsComingSoon: "Off",
      moodEntries: "Mood entries",
      habits: "Habits",
      focus: "Focus",
      privacyTitle: "Privacy",
      privacyDescription: "Your data stays on device.",
      privacyNoTracking: "No tracking",
      privacyAnalytics: "Analytics",
    },
  }),
}));

vi.mock("@/lib/motion", () => ({
  Bloom: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/motion/choreography", () => ({
  staggerDelay: () => ({}),
}));

vi.mock("@/components/navigation-v2/ThemeToggleV2", () => ({
  ThemeToggleV2: ({ testId }: { testId?: string }) => (
    <button type="button" data-testid={testId}>
      Theme toggle
    </button>
  ),
}));

vi.mock("@/components/sync/SyncHealthCard", () => ({
  SyncHealthCard: ({ allowManualRetry }: { allowManualRetry?: boolean }) => (
    <section
      data-testid="sync-health-card"
      data-allow-manual-retry={String(allowManualRetry ?? true)}
    >
      Sync health
    </section>
  ),
}));

vi.mock("@/components/sync/DeviceSessionsCard", () => ({
  DeviceSessionsCard: () => <section data-testid="device-sessions-card">Device sessions</section>,
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (s: { appliedTheme: string }) => unknown) =>
    selector({ appliedTheme: "paper" }),
}));

vi.mock("@/stores", () => ({
  useAppStore: (selector: (s: { hasValidSession: boolean }) => unknown) =>
    selector({ hasValidSession: true }),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    flags: {
      focusTimer: true,
      breathingExercise: true,
      gratitudeJournal: true,
      quests: true,
      tasks: true,
      challenges: false,
      aiCoach: false,
      innerWorld: true,
      deltaSync: true,
    },
  }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {},
}));

vi.mock("@/components/SettingsPanel", () => ({
  SettingsPanel: ({
    userName,
    initialOpenSection,
    showHeading,
    showSyncCards,
  }: {
    userName: string;
    initialOpenSection?: string;
    showHeading?: boolean;
    showSyncCards?: boolean;
  }) => (
    <section
      data-testid="settings-panel"
      data-user-name={userName}
      data-open-section={initialOpenSection || ""}
      data-show-heading={showHeading ? "true" : "false"}
      data-show-sync-cards={showSyncCards ? "true" : "false"}
    >
      Settings controls
    </section>
  ),
}));

function createSettingsControls() {
  return {
    userName: "Avery",
    onNameChange: vi.fn(),
    onResetData: vi.fn(),
    reminders: {
      enabled: true,
      moodTimeMorning: "09:00",
      moodTimeAfternoon: "14:00",
      moodTimeEvening: "20:00",
      habitTime: "08:00",
      focusTime: "10:00",
      days: [1, 2, 3, 4, 5],
      quietHours: { start: "22:00", end: "07:00" },
      habitIds: [],
    },
    onRemindersChange: vi.fn(),
    habits: [],
    moods: [],
    focusSessions: [],
    gratitudeEntries: [],
    privacy: { noTracking: false, analytics: false, consentShown: true },
    onPrivacyChange: vi.fn(),
    onOpenWidgetSettings: vi.fn(),
  };
}

describe("SettingsPage", () => {
  it("renders a paper-native V2 settings control surface", () => {
    render(<SettingsPage />);

    expect(screen.getByTestId("settings-page")).toHaveAttribute(
      "data-visual-role",
      "settings",
    );
    expect(screen.getByTestId("settings-page-control-card")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-theme-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("sync-health-card")).toHaveAttribute(
      "data-allow-manual-retry",
      "false",
    );
    expect(screen.getByTestId("device-sessions-card")).toBeInTheDocument();
    expect(screen.getByTestId("settings-cockpit")).toBeInTheDocument();
    expect(screen.getByTestId("settings-cockpit-card-account")).toHaveTextContent(
      "Automatic sync active",
    );
    expect(screen.getByTestId("settings-cockpit-card-modules")).toHaveTextContent("8/9");
    expect(screen.getByText("Appearance").closest("[data-visual-role]")).toHaveAttribute(
      "data-visual-role",
      "mind",
    );
    expect(screen.getByText("Notifications").closest("[data-visual-role]")).toHaveAttribute(
      "data-visual-role",
      "focus",
    );
    expect(screen.getByText("Security").closest("[data-visual-role]")).toHaveAttribute(
      "data-visual-role",
      "rest",
    );
    expect(screen.getByTestId("settings-page")).toHaveAttribute("data-controls-wired", "false");
  });

  it("wires the real SettingsPanel control deck when V2 receives settings controls", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    expect(screen.getByTestId("settings-page")).toHaveAttribute("data-controls-wired", "true");
    expect(screen.getByTestId("settings-page-control-deck")).toBeInTheDocument();
    expect(screen.getByTestId("settings-page-control-deck-header")).toHaveTextContent("Profile");
    expect(screen.getByTestId("settings-panel")).toHaveAttribute("data-user-name", "Avery");
    expect(screen.getByTestId("settings-panel")).toHaveAttribute("data-show-heading", "false");
    expect(screen.getByTestId("settings-panel")).toHaveAttribute("data-show-sync-cards", "false");
  });

  it("opens the matching real settings section from the V2 section cards", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-section-data"));

    expect(screen.getByTestId("settings-panel")).toHaveAttribute("data-open-section", "data");
    expect(screen.getByTestId("settings-section-data")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("settings-page-control-deck-header")).toHaveTextContent("Data");
  });

  it("opens detail sections from the V2 cockpit without exposing a manual sync action", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-cockpit-card-account"));

    expect(screen.getByTestId("settings-panel")).toHaveAttribute("data-open-section", "account");
    expect(screen.getByTestId("settings-cockpit-card-account")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("sync-health-card")).toHaveAttribute(
      "data-allow-manual-retry",
      "false",
    );
  });
});
