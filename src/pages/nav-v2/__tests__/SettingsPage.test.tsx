import type React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../SettingsPage";

const themeStoreMock = vi.hoisted(() => {
  const state = {
    theme: "paper" as "paper" | "ink" | "oled" | "auto",
    appliedTheme: "paper" as "paper" | "ink" | "oled",
  };
  const setTheme = vi.fn((theme: "paper" | "ink" | "oled" | "auto") => {
    state.theme = theme;
    state.appliedTheme =
      theme === "auto"
        ? "paper"
        : theme;
    document.documentElement.dataset.theme = state.appliedTheme;
  });

  return { state, setTheme };
});

const languageContextMock = vi.hoisted(() => ({
  language: "en",
  setLanguage: vi.fn(),
}));

const platformMock = vi.hoisted(() => ({
  isNative: false,
  isAndroid: false,
}));

const localNotificationsMock = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
}));

function expectDocumentOrder(first: HTMLElement, second: HTMLElement) {
  expect(Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
    true
  );
}

function expectDeckInsideModulePanel(sectionId: string) {
  const moduleList = screen.getByTestId("settings-module-list");
  const selectedButton = screen.getByTestId(`settings-module-card-${sectionId}`);
  const panel = screen.getByTestId(`settings-module-panel-${sectionId}`);
  const deck = screen.getByTestId("settings-page-control-deck");

  expect(moduleList).toContainElement(panel);
  expect(panel).toContainElement(deck);
  expect(panel).toHaveAttribute("role", "region");
  expect(panel).toHaveAttribute("aria-labelledby", `settings-module-card-${sectionId}`);
  expect(selectedButton).toHaveAttribute("aria-controls", `settings-module-panel-${sectionId}`);
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
    language: languageContextMock.language,
    setLanguage: languageContextMock.setLanguage,
    t: {
      navV2Settings: "Settings",
      navV2Theme: "Theme",
      navV2SettingsPlaceholder: "Prepare your controls.",
      themeLight: "Light",
      themeDark: "Dark",
      themeSystem: "System",
      theme: "Theme",
      themeLabel: "Theme",
      appearance: "Appearance",
      oledDarkMode: "OLED dark theme",
      oledDarkModeHint: "Pure black theme for OLED screens.",
      profile: "Profile",
      settingsGroupProfile: "Profile & Appearance",
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
      enableReminders: "Enable reminders",
      pushPermissionDenied: "Notification permission denied.",
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
    hideWhenIdle,
    quietWhenIdle,
  }: {
    allowManualRetry?: boolean;
    compact?: boolean;
    hideWhenIdle?: boolean;
    quietWhenIdle?: boolean;
  }) => (
    <section
      data-testid="sync-health-card"
      data-compact={String(compact ?? false)}
      data-allow-manual-retry={String(allowManualRetry ?? true)}
      data-hide-when-idle={String(hideWhenIdle ?? false)}
      data-quiet-when-idle={String(quietWhenIdle ?? false)}
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
  setThemePreference: vi.fn(),
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: Object.assign(
    (selector: (s: {
      theme: "paper" | "ink" | "oled" | "auto";
      appliedTheme: "paper" | "ink" | "oled";
      setTheme: typeof themeStoreMock.setTheme;
    }) => unknown) =>
      selector({
        theme: themeStoreMock.state.theme,
        appliedTheme: themeStoreMock.state.appliedTheme,
        setTheme: themeStoreMock.setTheme,
      }),
    {
      getState: () => ({
        theme: themeStoreMock.state.theme,
        appliedTheme: themeStoreMock.state.appliedTheme,
        setTheme: themeStoreMock.setTheme,
      }),
    }
  ),
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

vi.mock("@/lib/platform", () => platformMock);

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: localNotificationsMock,
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
  beforeEach(() => {
    themeStoreMock.state.theme = "paper";
    themeStoreMock.state.appliedTheme = "paper";
    themeStoreMock.setTheme.mockClear();
    languageContextMock.language = "en";
    languageContextMock.setLanguage.mockClear();
    platformMock.isNative = false;
    platformMock.isAndroid = false;
    localNotificationsMock.checkPermissions.mockReset();
    localNotificationsMock.requestPermissions.mockReset();
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.remove("oled", "dark");
    localStorage.clear();
  });

  it("renders a passive V2 settings overview when controls are not wired", () => {
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
    expect(screen.getByTestId("settings-module-card-profile")).toHaveTextContent("Profile");
    expect(screen.getByTestId("settings-module-card-profile")).not.toHaveTextContent(
      "Profile & Appearance"
    );
    expect(screen.getByTestId("settings-module-card-profile")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByTestId("settings-module-card-account")).toHaveTextContent(
      "Automatic sync active"
    );
    expect(screen.queryByTestId("settings-module-card-modules")).not.toBeInTheDocument();
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

  it("keeps the selected profile controls in the module without standalone sync status", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    expect(screen.getByTestId("settings-page")).toHaveAttribute("data-controls-wired", "true");
    expect(screen.getByTestId("settings-module-list")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-section-switcher")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
      "data-selected-section",
      "profile"
    );
    expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
      "id",
      "settings-v2-control-deck"
    );
    expect(screen.getByTestId("settings-module-card-profile")).toHaveAttribute(
      "aria-controls",
      "settings-module-panel-profile"
    );
    expect(screen.getByTestId("settings-module-card-profile")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expectDeckInsideModulePanel("profile");
    expect(screen.getByTestId("settings-v2-panel-profile")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Avery")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-status-overview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sync-health-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("device-sessions-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-panel-profile")).toHaveTextContent("Profile");
    expect(screen.getByTestId("settings-v2-panel-profile")).not.toHaveTextContent(
      "Profile & Appearance"
    );

    expectDocumentOrder(
      screen.getByTestId("settings-page-control-card"),
      screen.getByTestId("settings-module-list")
    );
    expectDocumentOrder(
      screen.getByTestId("settings-module-list"),
      screen.getByTestId("settings-page-control-deck")
    );
  });

  it("falls back to profile when the removed modules section is requested initially", () => {
    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "modules",
        }}
      />
    );

    expect(screen.queryByTestId("settings-module-card-modules")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-section-switcher")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-module-card-profile")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
      "data-selected-section",
      "profile"
    );
    expectDeckInsideModulePanel("profile");
    expect(screen.queryByTestId("settings-v2-panel-modules")).not.toBeInTheDocument();
  });

  it("opens the matching settings module in the fixed control deck", () => {
    const { restore, scrollIntoView } = installScrollIntoViewSpy();

    try {
      render(<SettingsPage controls={createSettingsControls()} />);

      fireEvent.click(screen.getByTestId("settings-module-card-data"));

      expect(screen.queryByTestId("settings-section-switcher")).not.toBeInTheDocument();
      expect(screen.getByTestId("settings-module-card-data")).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      expect(screen.getByTestId("settings-module-card-profile")).toHaveAttribute(
        "aria-expanded",
        "false"
      );
      expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
        "data-selected-section",
        "data"
      );
      expectDeckInsideModulePanel("data");
      expect(screen.getByTestId("settings-v2-panel-data")).toBeInTheDocument();
      expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
      expect(document.querySelectorAll('[data-testid^="settings-module-panel-"]')).toHaveLength(1);
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("keeps automatic sync status inside the active account module without a manual sync button", () => {
    const { restore, scrollIntoView } = installScrollIntoViewSpy();

    try {
      render(<SettingsPage controls={createSettingsControls()} />);

      fireEvent.click(screen.getByTestId("settings-module-card-account"));

      expect(screen.queryByTestId("settings-section-switcher")).not.toBeInTheDocument();
      expect(screen.getByTestId("settings-module-card-account")).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
        "data-selected-section",
        "account"
      );
      expectDeckInsideModulePanel("account");
      expect(screen.getByTestId("settings-v2-panel-account")).toBeInTheDocument();
      expect(screen.getByTestId("settings-v2-panel-account")).not.toHaveTextContent(
        "Automatic syncSigned-in data stays synced across devices."
      );
      expect(screen.queryByTestId("settings-v2-automatic-sync-card")).not.toBeInTheDocument();
      expect(screen.getByTestId("sync-health-card")).toHaveAttribute(
        "data-allow-manual-retry",
        "false"
      );
      expect(screen.getByTestId("sync-health-card")).toHaveAttribute("data-compact", "true");
      expect(screen.getByTestId("sync-health-card")).toHaveAttribute(
        "data-quiet-when-idle",
        "true"
      );
      expect(screen.getByTestId("sync-health-card")).toHaveAttribute(
        "data-hide-when-idle",
        "false"
      );
      expect(screen.getByTestId("device-sessions-card")).toBeInTheDocument();
      expect(screen.getByTestId("settings-module-panel-account")).toContainElement(
        screen.getByTestId("settings-status-overview")
      );
      expect(screen.getByTestId("settings-status-overview")).toContainElement(
        screen.getByTestId("sync-health-card")
      );
      expect(screen.getByTestId("settings-status-overview")).toContainElement(
        screen.getByTestId("device-sessions-card")
      );
      expectDocumentOrder(
        screen.getByTestId("settings-v2-panel-account"),
        screen.getByTestId("sync-health-card")
      );
      expect(
        screen.queryByRole("button", { name: /sync now|manual sync/i })
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
      expect(document.querySelectorAll('[data-testid^="settings-module-panel-"]')).toHaveLength(1);
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("wires V2 appearance choices to the canonical theme store", () => {
    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "appearance",
        }}
      />
    );

    expect(screen.getByTestId("settings-module-card-appearance")).toHaveTextContent("Light");
    expect(screen.getByTestId("settings-v2-theme-choice-paper")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByTestId("settings-v2-theme-choice-ink"));
    expect(themeStoreMock.setTheme).toHaveBeenLastCalledWith("ink");
    expect(document.documentElement.dataset.theme).toBe("ink");

    fireEvent.click(screen.getByTestId("settings-v2-theme-choice-auto"));
    expect(themeStoreMock.setTheme).toHaveBeenLastCalledWith("auto");
    expect(document.documentElement.dataset.theme).toBe("paper");

    const oledToggle = within(screen.getByTestId("settings-v2-oled-toggle")).getByRole("switch", {
      name: "OLED dark theme",
    });
    fireEvent.click(oledToggle);
    expect(themeStoreMock.setTheme).toHaveBeenLastCalledWith("oled");
    expect(document.documentElement.dataset.theme).toBe("oled");
  });

  it("wires language choices to the language context", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-language"));
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));

    expect(languageContextMock.setLanguage).toHaveBeenCalledWith("uk");
  });

  it("wires notification reminder controls to the settings callback", () => {
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));
    fireEvent.click(
      within(screen.getByTestId("settings-v2-reminders-toggle")).getByRole("switch", {
        name: "Enable reminders",
      })
    );

    const enabledUpdater = controls.onRemindersChange.mock.calls.at(-1)?.[0];
    expect(typeof enabledUpdater).toBe("function");
    expect(enabledUpdater(controls.reminders)).toMatchObject({ enabled: false });

    fireEvent.click(screen.getByRole("button", { name: "Mon" }));
    const dayUpdater = controls.onRemindersChange.mock.calls.at(-1)?.[0];
    expect(typeof dayUpdater).toBe("function");
    expect(dayUpdater(controls.reminders).days).not.toContain(1);
  });

  it("requests native notification permission before enabling reminders", async () => {
    platformMock.isNative = true;
    localNotificationsMock.checkPermissions.mockResolvedValue({ display: "prompt" });
    localNotificationsMock.requestPermissions.mockResolvedValue({ display: "granted" });
    const controls = createSettingsControls();
    controls.reminders = { ...controls.reminders, enabled: false };
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));
    fireEvent.click(
      within(screen.getByTestId("settings-v2-reminders-toggle")).getByRole("switch", {
        name: "Enable reminders",
      })
    );

    await waitFor(() =>
      expect(localNotificationsMock.requestPermissions).toHaveBeenCalledTimes(1)
    );
    const enabledUpdater = controls.onRemindersChange.mock.calls.at(-1)?.[0];
    expect(typeof enabledUpdater).toBe("function");
    expect(enabledUpdater(controls.reminders)).toMatchObject({ enabled: true });
  });

  it("keeps native reminders off and shows feedback when notification permission is denied", async () => {
    platformMock.isNative = true;
    localNotificationsMock.checkPermissions.mockResolvedValue({ display: "prompt" });
    localNotificationsMock.requestPermissions.mockResolvedValue({ display: "denied" });
    const controls = createSettingsControls();
    controls.reminders = { ...controls.reminders, enabled: false };
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));
    fireEvent.click(
      within(screen.getByTestId("settings-v2-reminders-toggle")).getByRole("switch", {
        name: "Enable reminders",
      })
    );

    expect(
      await screen.findByTestId("settings-v2-reminders-permission-warning")
    ).toHaveTextContent("Notification permission denied.");
    expect(controls.onRemindersChange).not.toHaveBeenCalled();
  });

  it("lets the explicit no-tracking switch turn off no-tracking without enabling analytics", () => {
    const controls = {
      ...createSettingsControls(),
      privacy: { noTracking: true, analytics: false, consentShown: true, adConsent: false },
    };
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));
    fireEvent.click(
      within(screen.getByTestId("settings-v2-no-tracking")).getByRole("switch", {
        name: "No tracking",
      })
    );

    const updater = controls.onPrivacyChange.mock.calls.at(-1)?.[0];
    expect(typeof updater).toBe("function");
    expect(updater(controls.privacy)).toMatchObject({
      noTracking: false,
      analytics: false,
      adConsent: false,
    });
  });
});
