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
  isIos: false,
  isDesktopViewport: false,
  platform: "web",
}));

const localNotificationsMock = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getPending: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
  createChannel: vi.fn(),
  listChannels: vi.fn(),
  registerActionTypes: vi.fn(),
  addListener: vi.fn(),
}));

const notificationSoundsMock = vi.hoisted(() => {
  const state = { currentChannelId: "zenflow_default_v2" };
  return {
    state,
    updateNotificationSound: vi.fn().mockImplementation(async (sound: string) => {
      state.currentChannelId = sound === "gentle" ? "zenflow_gentle_v2" : "zenflow_default_v2";
      return state.currentChannelId;
    }),
    initializeNotificationChannels: vi.fn().mockResolvedValue(undefined),
  };
});

const capacitorAppMock = vi.hoisted(() => ({
  pauseListeners: [] as Array<() => void>,
  remove: vi.fn(),
  addListener: vi.fn((eventName: string, listener: () => void) => {
    if (eventName === "pause") capacitorAppMock.pauseListeners.push(listener);
    return Promise.resolve({ remove: capacitorAppMock.remove });
  }),
}));

const accountAuthMock = vi.hoisted(() => ({
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
}));

const audioManagerMock = vi.hoisted(() => {
  const state = { muted: false, volume: 0.3 };
  const getAudioSettings = vi.fn(() => ({
    muted: state.muted,
    volume: state.volume,
    feedbackSoundsEnabled: true,
    canPlayFeedback: !state.muted,
  }));

  return {
    state,
    initAudioManager: vi.fn(),
    isMuted: vi.fn(() => state.muted),
    getVolume: vi.fn(() => state.volume),
    setMuted: vi.fn((muted: boolean) => {
      state.muted = muted;
      window.dispatchEvent(new CustomEvent("zenflow-audio-settings-change"));
    }),
    setVolume: vi.fn((volume: number) => {
      state.volume = volume;
      window.dispatchEvent(new CustomEvent("zenflow-audio-settings-change"));
    }),
    playNotification: vi.fn(),
    getAudioSettings,
    subscribeAudioSettings: vi.fn((listener: (settings: ReturnType<typeof getAudioSettings>) => void) => {
      const handleChange = () => listener(getAudioSettings());
      window.addEventListener("zenflow-audio-settings-change", handleChange);
      return () => window.removeEventListener("zenflow-audio-settings-change", handleChange);
    }),
  };
});

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
      settingsSoundTitle: "Sound",
      settingsSoundDescription: "App ambience and feedback volume.",
      settingsSoundSummaryOn: "Sound on",
      settingsSoundSummaryOff: "Muted",
      settingsSoundMaster: "App sound",
      settingsSoundMasterDesc: "Controls success chimes, orb ambience, and diary ambience.",
      settingsSoundVolume: "Volume",
      settingsSoundVolumeDesc: "Sets the default level for app audio.",
      settingsSoundPreview: "Preview sound",
      settingsSoundPreviewDesc: "Play a short local preview.",
      settingsSoundAmbienceTitle: "Ambient tracks",
      settingsSoundMapTitle: "Where sound appears",
      settingsSoundMapDescription: "All app audio is local, tap-started, and shared across web, mobile, and desktop.",
      settingsSoundMapAuth: "Sign-in soft air",
      settingsSoundMapOrb: "Orb ambience",
      settingsSoundMapDiary: "Diary ambience",
      settingsSoundMapFocus: "Focus ambient library",
      settingsSoundMapFeedback: "Completion and reminder cues",
      settingsSoundCrossPlatformTitle: "Cross-platform readiness",
      settingsSoundCrossPlatformNote: "Shared sound manifest covers Web, PWA, Android, iOS, and Desktop; package proof is checked before release.",
      settingsSoundComfortTitle: "Sensory comfort",
      settingsSoundComfortDescription: "Profiles tune ambience and short cues across Web, PWA, Android, iOS, and Desktop.",
      settingsSoundProfileQuiet: "Quiet",
      settingsSoundProfileQuietDesc: "No ambience, soft completion cues only.",
      settingsSoundProfileBalanced: "Balanced",
      settingsSoundProfileBalancedDesc: "Gentle ambience and meaningful cues.",
      settingsSoundProfileRich: "Rich",
      settingsSoundProfileRichDesc: "Full ambience and cues where supported.",
      settingsSoundAmbientToggle: "Ambient sound",
      settingsSoundAmbientToggleDesc: "Controls sign-in, Orb, and diary ambience outside Hyperfocus.",
      settingsSoundCompletionCues: "Completion cues",
      settingsSoundCompletionCuesDesc: "Allows quiet confirmations after meaningful completions.",
      settingsSoundReminderCues: "Reminder previews",
      settingsSoundReminderCuesDesc: "Allows opt-in reminder preview sounds.",
      settingsSoundMilestoneCues: "Milestone cues",
      settingsSoundMilestoneCuesDesc: "Allows rare streak and achievement cues without routine tap sounds.",
      settingsSoundTextureTitle: "Non-Hyperfocus textures",
      settingsSoundTextureDescription: "Choose the air, water, and rain textures used by sign-in, Orb, and diary ambience.",
      settingsSoundTextureAir: "Air",
      settingsSoundTextureWater: "Water",
      settingsSoundTextureRain: "Rain",
      settingsSoundFeedbackTitle: "Audio comfort feedback",
      settingsSoundFeedbackDescription: "Stores only a local comfort choice, platform, mute state, and volume bucket.",
      settingsSoundFeedbackComfortable: "Comfortable",
      settingsSoundFeedbackTooLoud: "Too loud",
      settingsSoundFeedbackDistracting: "Distracting",
      settingsSoundFeedbackPreferSilent: "Prefer silent",
      settingsSoundFeedbackDidNotPlay: "Did not play",
      settingsSoundAmbientOff: "Ambient sound is off in Sensory comfort.",
      diaryAmbienceLabel: "Soft rain",
      diaryAmbiencePlay: "Play soft rain",
      diaryAmbiencePause: "Pause soft rain",
      audioRetry: "Retry",
      soundOn: "On",
      soundOff: "Off",
      settingsSoundAmbienceNote: "Orb ambience starts from Orb. Diary sound is managed here so it never covers your writing.",
      settingsSoundActionMapMilestones: "Achievements and streak milestones",
      settingsSoundActionMapBreathing: "Breathing completed",
      settingsSoundActionMapFocus: "Focus completed",
      settingsSoundActionMapJournal: "Journal saved",
      settingsSoundActionMapHabit: "Habit completed",
      settingsSoundActionMapMood: "Mood saved",
      settingsSoundActionMapDescription: "Short sounds are reserved for meaningful completions and rare milestones.",
      settingsSoundActionMapTitle: "Action feedback map",
      notificationSound: "Notification sound",
      notificationSoundDescription: "Choose sound for reminders",
      soundDefault: "Default",
      soundDefaultDesc: "System notification sound",
      soundGentle: "Gentle",
      soundGentleDesc: "Vibration only",
      soundChime: "Chime",
      soundChimeDesc: "Short notification tone",
      soundSilent: "Silent",
      soundSilentDesc: "No sound or vibration",
      notificationSystemSettingsTitle: "System notification controls",
      notificationSystemSettingsWebDescription: "Browser and OS notification settings can mute or quiet reminders. App sounds stay local and tap-started.",
      notificationSystemSettingsAndroidDescription: "Android notification categories keep the final sound and vibration setting for each channel.",
      notificationSystemSettingsIosDescription: "iOS notification settings and Focus modes keep final control over alert sound and delivery.",
      notificationSystemSettingsDesktopDescription: "Desktop browser and OS notification settings keep final control over reminder delivery.",
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
  useAccountAuth: () => accountAuthMock,
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
  IS_DESKTOP_RUNTIME: false,
  SUPABASE_URL: undefined,
  SUPABASE_ANON_KEY: undefined,
  SENTRY_DSN: undefined,
  SPOTIFY_CLIENT_ID: "",
  GOOGLE_WEB_CLIENT_ID: "",
  ENABLE_FACEBOOK_AUTH: false,
  ENABLE_TELEGRAM_AUTH: false,
  ENABLE_APPLE_AUTH: false,
  ADMOB_APP_ID_ANDROID: "",
  ADMOB_REWARDED_ID_ANDROID: "",
  ADMOB_BANNER_ID_ANDROID: "",
  ADMOB_REWARDED_ID_IOS: "",
  ADMOB_BANNER_ID_IOS: "",
}));

vi.mock("@/lib/notificationSounds", () => ({
  NOTIFICATION_SOUNDS: [
    {
      id: "default",
      labelKey: "soundDefault",
      description: "System notification sound",
      channelId: "zenflow_default_v2",
      sound: "default",
      vibrate: true,
      importance: 3,
    },
    {
      id: "gentle",
      labelKey: "soundGentle",
      description: "Vibration only",
      channelId: "zenflow_gentle_v2",
      sound: undefined,
      vibrate: true,
      importance: 2,
    },
  ],
  getNotificationSound: () => "default",
  getCurrentChannelId: () => notificationSoundsMock.state.currentChannelId,
  getNotificationSystemSettingsCopyKey: () => {
    if (platformMock.isNative && platformMock.platform === "android") {
      return "notificationSystemSettingsAndroidDescription";
    }
    if (platformMock.isNative && platformMock.platform === "ios") {
      return "notificationSystemSettingsIosDescription";
    }
    return platformMock.isDesktopViewport
      ? "notificationSystemSettingsDesktopDescription"
      : "notificationSystemSettingsWebDescription";
  },
  setNotificationSound: vi.fn(),
  updateNotificationSound: notificationSoundsMock.updateNotificationSound,
  initializeNotificationChannels: notificationSoundsMock.initializeNotificationChannels,
}));

vi.mock("@/lib/audioManager", () => audioManagerMock);

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: capacitorAppMock.addListener,
  },
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
    platformMock.isIos = false;
    platformMock.isDesktopViewport = false;
    platformMock.platform = "web";
    localNotificationsMock.checkPermissions.mockReset();
    localNotificationsMock.requestPermissions.mockReset();
    localNotificationsMock.getPending.mockReset();
    localNotificationsMock.cancel.mockReset();
    localNotificationsMock.schedule.mockReset();
    localNotificationsMock.createChannel.mockReset();
    localNotificationsMock.listChannels.mockReset();
    localNotificationsMock.registerActionTypes.mockReset();
    localNotificationsMock.addListener.mockReset();
    notificationSoundsMock.state.currentChannelId = "zenflow_default_v2";
    notificationSoundsMock.updateNotificationSound.mockClear();
    notificationSoundsMock.initializeNotificationChannels.mockClear();
    capacitorAppMock.pauseListeners.length = 0;
    capacitorAppMock.remove.mockClear();
    capacitorAppMock.addListener.mockClear();
    audioManagerMock.state.muted = false;
    audioManagerMock.state.volume = 0.3;
    audioManagerMock.initAudioManager.mockClear();
    audioManagerMock.isMuted.mockClear();
    audioManagerMock.getVolume.mockClear();
    audioManagerMock.setMuted.mockClear();
    audioManagerMock.setVolume.mockClear();
    audioManagerMock.playNotification.mockClear();
    audioManagerMock.getAudioSettings.mockClear();
    audioManagerMock.subscribeAudioSettings.mockClear();
    accountAuthMock.handleSignOut.mockClear();
    accountAuthMock.handleProvider.mockClear();
    accountAuthMock.handleLinkProvider.mockClear();
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

  it("wires the V2 account sign-out button to the shared auth logout flow", () => {
    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "account",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(accountAuthMock.handleSignOut).toHaveBeenCalledTimes(1);
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

  it("wires V2 sound controls to the app audio manager", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    const soundCard = screen.getByTestId("settings-module-card-sound");
    expect(soundCard).toHaveTextContent("Sound");
    expect(soundCard).toHaveTextContent("Sound on");

    fireEvent.click(soundCard);

    expect(screen.getByTestId("settings-v2-panel-sound")).toBeInTheDocument();
    expect(screen.getByText("Orb ambience starts from Orb. Diary sound is managed here so it never covers your writing.")).toBeInTheDocument();
    expect(screen.getByText("Where sound appears")).toBeInTheDocument();
    expect(screen.getByText("Sign-in soft air")).toBeInTheDocument();
    expect(screen.getByText("Orb ambience")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-sound-map-card")).toHaveTextContent("Diary ambience");
    expect(screen.getByTestId("settings-v2-diary-ambience-control")).toHaveTextContent("Soft rain");
    expect(screen.getByText("Focus ambient library")).toBeInTheDocument();
    expect(screen.getByText("Completion and reminder cues")).toBeInTheDocument();
    expect(screen.getByText(/Shared sound manifest covers Web, PWA, Android, iOS, and Desktop/)).toBeInTheDocument();
    expect(screen.getByText("Action feedback map")).toBeInTheDocument();
    expect(screen.getByText("Mood saved")).toBeInTheDocument();
    expect(screen.getByText("Habit completed")).toBeInTheDocument();
    expect(screen.getByText("Journal saved")).toBeInTheDocument();
    expect(screen.getByText("Focus completed")).toBeInTheDocument();
    expect(screen.getByText("Breathing completed")).toBeInTheDocument();
    expect(screen.getByText("Achievements and streak milestones")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Preview sound" }));
    expect(audioManagerMock.playNotification).toHaveBeenCalledTimes(1);

    fireEvent.click(
      within(screen.getByTestId("settings-v2-app-sound-toggle")).getByRole("switch", {
        name: "App sound",
      })
    );
    expect(audioManagerMock.setMuted).toHaveBeenLastCalledWith(true);

    const volume = screen.getByTestId("settings-v2-audio-volume");
    fireEvent.change(volume, { target: { value: "0.7" } });
    expect(audioManagerMock.setVolume).toHaveBeenLastCalledWith(0.7);
  });

  it("keeps diary ambience control inside sound settings only", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
    let unmount: (() => void) | undefined;

    try {
      ({ unmount } = render(<SettingsPage controls={createSettingsControls()} />));
      fireEvent.click(screen.getByTestId("settings-module-card-sound"));

      expect(screen.queryByTestId("diary-page-ambience-control")).toBeNull();
      expect(screen.queryByTestId("diary-page-ambience-toggle")).toBeNull();

      const control = screen.getByTestId("settings-v2-diary-ambience-control");
      const audio = screen.getByTestId("settings-v2-diary-ambience-audio");
      const toggle = within(control).getByRole("button", { name: "Play soft rain" });

      expect(audio).toHaveAttribute("preload", "none");
      expect(audio).not.toHaveAttribute("autoplay");
      expect(toggle).toHaveAttribute("aria-pressed", "false");
      expect(play).not.toHaveBeenCalled();

      fireEvent.click(toggle);

      await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
      expect(toggle).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(toggle);

      expect(pause).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));

      fireEvent.click(toggle);
      await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
      pause.mockClear();
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(pause).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));

      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      fireEvent.click(toggle);
      await waitFor(() => expect(play).toHaveBeenCalledTimes(3));
      pause.mockClear();
      window.dispatchEvent(new Event("pagehide"));

      expect(pause).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));

      fireEvent.click(toggle);
      await waitFor(() => expect(play).toHaveBeenCalledTimes(4));
      await waitFor(() => expect(capacitorAppMock.addListener).toHaveBeenCalledWith("pause", expect.any(Function)));
      pause.mockClear();
      capacitorAppMock.pauseListeners[0]?.();

      expect(pause).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));
    } finally {
      unmount?.();
      if (hiddenDescriptor) {
        Object.defineProperty(document, "hidden", hiddenDescriptor);
      } else {
        Reflect.deleteProperty(document, "hidden");
      }
      play.mockRestore();
      pause.mockRestore();
    }
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

  it("shows cross-platform system notification guidance on web/PWA settings", () => {
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));

    const guidance = screen.getByTestId("settings-v2-notification-system-guidance");
    expect(guidance).toHaveTextContent("System notification controls");
    expect(guidance).toHaveTextContent("Browser and OS notification settings");
    expect(guidance).not.toHaveTextContent("Android notification categories");
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

  it("reschedules native reminders onto the selected notification sound channel", async () => {
    platformMock.isNative = true;
    platformMock.platform = "android";
    localNotificationsMock.checkPermissions.mockResolvedValue({ display: "granted" });
    localNotificationsMock.getPending.mockResolvedValue({ notifications: [] });
    localNotificationsMock.cancel.mockResolvedValue(undefined);
    localNotificationsMock.schedule.mockResolvedValue({ notifications: [] });
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));
    fireEvent.click(screen.getByRole("button", { name: /Gentle/ }));

    await waitFor(() =>
      expect(notificationSoundsMock.updateNotificationSound).toHaveBeenCalledWith("gentle"),
    );
    await waitFor(() => expect(localNotificationsMock.schedule).toHaveBeenCalled());
    const scheduled = localNotificationsMock.schedule.mock.calls.flatMap(
      ([payload]) => payload.notifications,
    );
    expect(scheduled).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, channelId: "zenflow_gentle_v2" }),
        expect.objectContaining({ id: 150, channelId: "zenflow_gentle_v2" }),
      ]),
    );
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
