import type React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../SettingsPage";

function expectDocumentOrder(first: HTMLElement, second: HTMLElement) {
  expect(Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
    true
  );
}

function installScrollIntoViewSpy() {
  const scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
  const rafDescriptor = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame");
  const scrollIntoView = vi.fn();

  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    },
  });

  return {
    scrollIntoView,
    restore: () => {
      if (scrollDescriptor) {
        Object.defineProperty(Element.prototype, "scrollIntoView", scrollDescriptor);
      } else {
        Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      }
      if (rafDescriptor) {
        Object.defineProperty(window, "requestAnimationFrame", rafDescriptor);
      } else {
        Reflect.deleteProperty(window, "requestAnimationFrame");
      }
    },
  };
}

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
  SyncHealthCard: ({
    allowManualRetry,
    compact,
  }: {
    allowManualRetry?: boolean;
    compact?: boolean;
  }) => (
    <section
      data-testid="sync-health-card"
      data-compact={String(compact ?? false)}
      data-allow-manual-retry={String(allowManualRetry ?? true)}
    >
      Sync health
    </section>
  ),
}));

vi.mock("@/components/sync/DeviceSessionsCard", () => ({
  DeviceSessionsCard: () => <section data-testid="device-sessions-card">Device sessions</section>,
}));

vi.mock("@/components/auth/AuthProviderButton", () => ({
  AuthProviderButton: ({ label }: { label: string }) => (
    <button type="button" data-testid="auth-provider-button">
      {label}
    </button>
  ),
}));

vi.mock("@/components/SmartRemindersCard", () => ({
  SmartRemindersCard: () => <section data-testid="smart-reminders-card">Smart reminders</section>,
}));

vi.mock("@/components/DopamineSettings", () => ({
  DopamineSettingsComponent: () => <section data-testid="dopamine-settings-modal" />,
}));

vi.mock("@/components/FeedbackForm", () => ({
  FeedbackForm: () => null,
}));

vi.mock("@/components/ChangelogPanel", () => ({
  ChangelogPanel: () => null,
}));

vi.mock("@/components/LegalModal", () => ({
  LegalModal: () => null,
}));

vi.mock("@/components/ThemeToggle", () => ({
  useTheme: () => ({
    theme: "system",
    effectiveTheme: "light",
    changeTheme: vi.fn(),
    mounted: true,
  }),
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

vi.mock("@/components/settings/account-section/useAccountAuth", () => ({
  useAccountAuth: () => ({
    authStatus: null,
    setAuthStatus: vi.fn(),
    sessionUserId: "user-1",
    sessionAccountLabel: "avery@example.com",
    sessionDisplayName: "Avery",
    linkedProviderIds: [],
    enabledProviders: [],
    hasSession: true,
    signingInProvider: null,
    linkingProvider: null,
    isSigningIn: false,
    isSigningOut: false,
    handleProvider: vi.fn(),
    handleLinkProvider: vi.fn(),
    handleSignOut: vi.fn(),
  }),
}));

vi.mock("@/components/settings/account-section/useAccountSync", () => ({
  useAccountSync: () => ({
    cloudSyncEnabled: true,
    weeklyDigestEnabled: false,
    setWeeklyDigestEnabled: vi.fn(),
    weeklyDigestLoading: false,
    weeklyDigestTouchedRef: { current: false },
    handleWeeklyDigestToggle: vi.fn(),
  }),
}));

vi.mock("@/components/settings/account-section/useDeleteAccount", () => ({
  useDeleteAccount: () => ({
    showDeleteConfirm: false,
    setShowDeleteConfirm: vi.fn(),
    deleteStatus: null,
    deleteConfirmInput: "",
    setDeleteConfirmInput: vi.fn(),
    isDeletingAccount: false,
    handleDeleteAccount: vi.fn(),
  }),
}));

vi.mock("@/components/settings/data-section/useDataExport", () => ({
  useDataExport: () => ({
    isExporting: false,
    isExportingCSV: false,
    isExportingPDF: false,
    handleExport: vi.fn(),
    handleExportCSV: vi.fn(),
    handleExportPDF: vi.fn(),
  }),
}));

vi.mock("@/components/settings/data-section/useDataImport", () => ({
  useDataImport: () => ({
    importMode: "merge",
    setImportMode: vi.fn(),
    isImporting: false,
    showImportConfirm: false,
    pendingImportFile: null,
    fileInputRef: { current: null },
    handleImportClick: vi.fn(),
    handleImportFile: vi.fn(),
    handleImportCancel: vi.fn(),
    handleImportConfirm: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePwaInstall", () => ({
  usePwaInstall: () => ({ canInstall: false, isInstalled: false, promptInstall: vi.fn() }),
}));

vi.mock("@/hooks/useQuickActions", () => ({
  useQuickActions: () => ({
    isEnabled: false,
    isAndroid: false,
    toggle: vi.fn(),
    onAction: vi.fn(),
  }),
}));

vi.mock("@/hooks/useFontScale", () => ({
  FONT_SCALE_LEVELS: [0.85, 0.9, 1, 1.1, 1.2, 1.3, 1.5],
  useFontScale: () => ({ scale: 1, setFontScale: vi.fn() }),
}));

vi.mock("@/hooks/useDemoMode", () => ({
  useDemoMode: () => ({ toggleDemoMode: vi.fn() }),
}));

vi.mock("@/features/journal", () => ({
  LOCK_TIMEOUT_OPTIONS: [{ ms: 300000, label: "5 minutes" }],
  setAutoLockMs: vi.fn(),
}));

vi.mock("@/lib/platform", () => ({
  isNative: false,
  isAndroid: false,
}));

vi.mock("@/lib/env", () => ({
  IS_DEV: false,
  MODE: "test",
  BASE_URL: "https://example.test/",
  FORCE_NAV_V2: true,
  IS_DESKTOP_RUNTIME: false,
  CLASSIC_BASE_URL: "https://example.test/",
  SUPABASE_URL: undefined,
  SUPABASE_ANON_KEY: undefined,
  SENTRY_DSN: undefined,
  SPOTIFY_CLIENT_ID: "",
  GOOGLE_WEB_CLIENT_ID: "",
  ENABLE_FACEBOOK_AUTH: false,
  ENABLE_TELEGRAM_AUTH: false,
  ADMOB_APP_ID_ANDROID: "",
  ADMOB_REWARDED_ID_ANDROID: "",
  ADMOB_BANNER_ID_ANDROID: "",
  ADMOB_REWARDED_ID_IOS: "",
  ADMOB_BANNER_ID_IOS: "",
}));

vi.mock("@/lib/notificationSounds", () => ({
  NOTIFICATION_SOUNDS: [],
  getNotificationSound: () => "default",
  setNotificationSound: vi.fn(),
}));

vi.mock("@/lib/appUpdateManager", () => ({
  checkForAppUpdate: vi.fn(),
  openGooglePlayStore: vi.fn(),
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
  it("renders one unified V2 settings module list", () => {
    render(<SettingsPage />);

    expect(screen.getByTestId("settings-page")).toHaveAttribute("data-visual-role", "settings");
    expect(screen.getByTestId("settings-page-control-card")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-theme-toggle")).toBeInTheDocument();
    expect(screen.queryByTestId("sync-health-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("device-sessions-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-section-switcher")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-page-control-deck")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-cockpit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-page-sections")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-module-list")).toBeInTheDocument();
    expect(screen.getByTestId("settings-module-card-account")).toHaveTextContent(
      "Automatic sync active"
    );
    expect(screen.getByTestId("settings-module-card-modules")).toHaveTextContent("8/9");
    expect(screen.getByTestId("settings-module-card-appearance")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByTestId("settings-module-appearance")).toHaveAttribute(
      "data-visual-role",
      "mind"
    );
    expect(screen.getByTestId("settings-module-notifications")).toHaveAttribute(
      "data-visual-role",
      "focus"
    );
    expect(screen.getByTestId("settings-module-privacy")).toHaveAttribute(
      "data-visual-role",
      "rest"
    );
    expect(screen.getByTestId("settings-page")).toHaveAttribute("data-controls-wired", "false");
  });

  it("opens the profile module by default inside the first card", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    expect(screen.getByTestId("settings-page")).toHaveAttribute("data-controls-wired", "true");
    expect(screen.queryByTestId("settings-section-switcher")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-page-control-deck")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-module-card-profile")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByTestId("settings-module-panel-profile")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-panel-profile")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Avery")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sync-health-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("device-sessions-card")).not.toBeInTheDocument();

    expectDocumentOrder(
      screen.getByTestId("settings-page-control-card"),
      screen.getByTestId("settings-module-list")
    );
  });

  it("opens the matching real settings module directly under the clicked card", () => {
    const { restore, scrollIntoView } = installScrollIntoViewSpy();

    try {
      render(<SettingsPage controls={createSettingsControls()} />);

      fireEvent.click(screen.getByTestId("settings-module-card-data"));

      expect(screen.getByTestId("settings-module-card-data")).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      expect(screen.getByTestId("settings-module-card-profile")).toHaveAttribute(
        "aria-expanded",
        "false"
      );
      expect(screen.getByTestId("settings-module-panel-data")).toBeInTheDocument();
      expect(screen.getByTestId("settings-v2-panel-data")).toBeInTheDocument();
      expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
      expect(document.querySelectorAll('[data-testid^="settings-module-panel-"]')).toHaveLength(1);
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("keeps one module open and shows automatic sync without a manual sync button", () => {
    const { restore, scrollIntoView } = installScrollIntoViewSpy();

    try {
      render(<SettingsPage controls={createSettingsControls()} />);

      fireEvent.click(screen.getByTestId("settings-module-card-account"));

      expect(screen.getByTestId("settings-module-card-account")).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      expect(screen.getByTestId("settings-module-panel-account")).toBeInTheDocument();
      expect(screen.getByTestId("settings-v2-panel-account")).toBeInTheDocument();
      expect(screen.queryByTestId("settings-v2-automatic-sync-card")).not.toBeInTheDocument();
      expect(screen.getByTestId("sync-health-card")).toHaveAttribute(
        "data-allow-manual-retry",
        "false"
      );
      expect(screen.getByTestId("sync-health-card")).toHaveAttribute("data-compact", "true");
      expect(screen.getByTestId("device-sessions-card")).toBeInTheDocument();
      expectDocumentOrder(
        screen.getByTestId("settings-v2-panel-account"),
        screen.getByTestId("sync-health-card")
      );
      expect(
        screen.queryByRole("button", { name: /sync now|manual sync/i })
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
      expect(document.querySelectorAll('[data-testid^="settings-module-panel-"]')).toHaveLength(1);

      fireEvent.click(screen.getByTestId("settings-module-card-account"));

      expect(screen.getByTestId("settings-module-panel-account")).toBeInTheDocument();
      expect(document.querySelectorAll('[data-testid^="settings-module-panel-"]')).toHaveLength(1);
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});
