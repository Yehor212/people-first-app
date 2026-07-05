import type React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../SettingsPage";

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

const themeStoreMock = vi.hoisted(() => {
  type ThemeCustomizationMock = {
    paletteId: "zenflow" | "morningHearth";
    accentFamily: "teal" | "clay";
    intensity: "balanced" | "vivid";
    warmth: "neutral" | "warm";
    depth: "crisp" | "cozy";
    contrastMode: "standard" | "high";
    reduceGlow: boolean;
    reduceTransparency: boolean;
  };
  const defaultCustomization: ThemeCustomizationMock = {
    paletteId: "zenflow" as const,
    accentFamily: "teal" as const,
    intensity: "balanced" as const,
    warmth: "neutral" as const,
    depth: "crisp" as const,
    contrastMode: "standard" as const,
    reduceGlow: false,
    reduceTransparency: false,
  };
  const state = {
    theme: "paper" as "paper" | "ink" | "oled" | "auto",
    appliedTheme: "paper" as "paper" | "ink" | "oled",
    themeCustomization: { ...defaultCustomization },
  };
  let previousCustomization: typeof defaultCustomization | null = null;
  const applyCustomizationDom = (customization: typeof defaultCustomization) => {
    document.documentElement.dataset.themeStyle = customization.paletteId;
    document.documentElement.dataset.themeAccent = customization.accentFamily;
    document.documentElement.dataset.themeComfort =
      customization.contrastMode === "high" ? "high-contrast" : "standard";
  };
  const setTheme = vi.fn((theme: "paper" | "ink" | "oled" | "auto") => {
    state.theme = theme;
    state.appliedTheme = theme === "auto" ? "paper" : theme;
    document.documentElement.dataset.theme = state.appliedTheme;
  });
  const setThemeCustomization = vi.fn((customization: typeof defaultCustomization) => {
    previousCustomization = { ...state.themeCustomization };
    state.themeCustomization = { ...customization };
    applyCustomizationDom(state.themeCustomization);
  });
  const previewThemeCustomization = vi.fn((customization: typeof defaultCustomization) => {
    applyCustomizationDom(customization);
  });
  const cancelThemeCustomizationPreview = vi.fn(() => {
    applyCustomizationDom(state.themeCustomization);
  });
  const resetThemeCustomization = vi.fn(() => {
    previousCustomization = { ...state.themeCustomization };
    state.themeCustomization = { ...defaultCustomization };
    applyCustomizationDom(state.themeCustomization);
  });
  const undoThemeCustomization = vi.fn(() => {
    if (!previousCustomization) return;
    const current = { ...state.themeCustomization };
    state.themeCustomization = { ...previousCustomization };
    previousCustomization = current;
    applyCustomizationDom(state.themeCustomization);
  });

  return {
    defaultCustomization,
    state,
    setTheme,
    setThemeCustomization,
    previewThemeCustomization,
    cancelThemeCustomizationPreview,
    resetThemeCustomization,
    undoThemeCustomization,
  };
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

const accountServiceMock = vi.hoisted(() => ({
  updateProfileName: vi.fn().mockResolvedValue(true),
}));

const versionCheckMock = vi.hoisted(() => ({
  checkAppVersionStatus: vi.fn(),
  reloadAppForUpdate: vi.fn(),
}));

const deleteAccountMock = vi.hoisted(() => ({
  showDeleteConfirm: false,
  setShowDeleteConfirm: vi.fn((show: boolean) => {
    deleteAccountMock.showDeleteConfirm = show;
  }),
  deleteStatus: null as string | null,
  deleteConfirmInput: "",
  setDeleteConfirmInput: vi.fn((value: string) => {
    deleteAccountMock.deleteConfirmInput = value;
  }),
  isDeletingAccount: false,
  handleDeleteAccount: vi.fn(),
}));

const dataImportMock = vi.hoisted(() => {
  const state = {
    importMode: "merge" as "merge" | "replace",
    setImportMode: vi.fn((mode: "merge" | "replace") => {
      state.importMode = mode;
    }),
    isImporting: false,
    showImportConfirm: false,
    pendingImportFile: null as File | null,
    fileInputRef: { current: null as HTMLInputElement | null },
    handleImportClick: vi.fn(),
    handleImportFile: vi.fn(),
    handleImportCancel: vi.fn(),
    handleImportConfirm: vi.fn(),
  };

  return state;
});

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
    playNotificationPreview: vi.fn(),
    getAudioSettings,
    subscribeAudioSettings: vi.fn(
      (listener: (settings: ReturnType<typeof getAudioSettings>) => void) => {
        const handleChange = () => listener(getAudioSettings());
        window.addEventListener("zenflow-audio-settings-change", handleChange);
        return () => window.removeEventListener("zenflow-audio-settings-change", handleChange);
      }
    ),
  };
});

function expectDocumentOrder(first: HTMLElement, second: HTMLElement) {
  expect(Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
    true
  );
}

function expectDeckInsideModulePanel(sectionId: string) {
  const workspace = screen.getByTestId("settings-page-workspace");
  const moduleList = screen.getByTestId("settings-module-list");
  const selectedButton = screen.getByTestId(`settings-module-card-${sectionId}`);
  const selectedPanel = screen.getByTestId("settings-selected-panel");
  const panel = screen.getByTestId(`settings-module-panel-${sectionId}`);
  const deck = screen.getByTestId("settings-page-control-deck");

  expect(workspace).toContainElement(moduleList);
  expect(workspace).toContainElement(selectedPanel);
  expect(selectedPanel).toContainElement(panel);
  expect(moduleList).not.toContainElement(panel);
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

function installSettingsMotionMediaQuery(options: {
  isMobileWorkspace: boolean;
  prefersReducedMotion: boolean;
}) {
  const matchMediaDescriptor = Object.getOwnPropertyDescriptor(window, "matchMedia");
  const matchMedia = vi.fn((query: string) => ({
    matches: query.includes("max-width")
      ? options.isMobileWorkspace
      : query.includes("prefers-reduced-motion")
        ? options.prefersReducedMotion
        : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: matchMedia,
  });

  return {
    matchMedia,
    restore: () => {
      if (matchMediaDescriptor) {
        Object.defineProperty(window, "matchMedia", matchMediaDescriptor);
      } else {
        Reflect.deleteProperty(window, "matchMedia");
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
      themeStyleTitle: "Mood palette",
      themeStyleDescription: "Choose a curated look that sets the tone.",
      themeAccentTitle: "Accent",
      themeAccentDescription: "Color used for focus, selected states, and key controls.",
      themeIntensityTitle: "Intensity",
      themeComfortTitle: "Comfort",
      themePreviewAction: "Preview",
      themeApplyAction: "Apply",
      themeResetAction: "Reset",
      themeUndoAction: "Undo",
      themePreviewing: "Previewing style",
      themeApplied: "Style applied",
      themeReset: "Style reset",
      themeUndone: "Style restored",
      themePreviewChanged: "Preview cleared after changes",
      themePaletteZenflow: "ZenFlow",
      themePaletteMorningHearth: "Morning Hearth",
      themePaletteVelvetLibrary: "Velvet Library",
      themePaletteBotanicalPulse: "Botanical Pulse",
      themePaletteQuietOled: "Quiet Black",
      themeAccentTeal: "Blue",
      themeAccentClay: "Clay",
      themeAccentPlum: "Violet",
      themeAccentMoss: "Moss",
      themeAccentAmber: "Amber",
      themeIntensityQuiet: "Quiet",
      themeIntensityBalanced: "Balanced",
      themeIntensityVivid: "Vivid",
      themeHighContrast: "High contrast",
      themeHighContrastHint: "Strengthens text, borders, and focus indicators.",
      themeReduceGlow: "Reduce glow",
      themeReduceGlowHint: "Keeps surfaces calmer in low light.",
      themeReduceTransparency: "Reduce transparency",
      themeReduceTransparencyHint: "Uses more solid panels for readability.",
      oledDarkMode: "Pure black mode",
      oledDarkModeHint: "Pure black theme for OLED screens. May save battery.",
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
      notificationsComingSoon: "Notifications will be available in future updates.",
      settingsOverviewDescription:
        "Adjust privacy, reminders, sound, appearance, and data controls in one place.",
      settingsRemindersOff: "Reminders off",
      resetDataConfirmWord: "RESET",
      resetDataTypeConfirm: "Type RESET to confirm",
      resetDataScope:
        "This removes local moods, habits, focus, gratitude, journal data, queues, and settings.",
      resetDataConfirmAction: "Clear local data",
      moodEntries: "Mood entries",
      habits: "Habits",
      focus: "Focus",
      privacyTitle: "Privacy",
      privacyDescription: "Your data stays on device.",
      privacyNoTracking: "No tracking",
      privacyAnalytics: "Analytics",
      privacyPushNotifications: "Account reminder alerts",
      privacyPushNotificationsHint: "Let this device receive reminder alerts from your account.",
      enableReminders: "Enable reminders",
      quietHours: "Quiet hours",
      quietHoursStart: "Quiet start",
      quietHoursEnd: "Quiet end",
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
      settingsSoundMapDescription:
        "App audio stays local, starts from your tap, and follows your sound choices.",
      settingsSoundMapAuth: "Sign-in soft air",
      settingsSoundMapOrb: "Orb ambience",
      settingsSoundMapDiary: "Diary ambience",
      settingsSoundMapFocus: "Focus ambient library",
      settingsSoundMapFeedback: "Completion and reminder cues",
      settingsSoundCrossPlatformTitle: "Where sounds work",
      settingsSoundCrossPlatformNote:
        "ZenFlow uses the same sound choices where your device allows them.",
      settingsSoundComfortTitle: "Sound comfort",
      settingsSoundComfortDescription:
        "Profiles tune background sound and short cues on supported devices.",
      settingsSoundProfileQuiet: "Quiet",
      settingsSoundProfileQuietDesc: "No ambience, soft completion cues only.",
      settingsSoundProfileBalanced: "Balanced",
      settingsSoundProfileBalancedDesc: "Gentle ambience and meaningful cues.",
      settingsSoundProfileRich: "Rich",
      settingsSoundProfileRichDesc: "Full ambience and cues where supported.",
      settingsSoundAmbientToggle: "Ambient sound",
      settingsSoundAmbientToggleDesc:
        "Controls sign-in, mood orb, and diary background sound outside focus sessions.",
      settingsSoundCompletionCues: "Completion cues",
      settingsSoundCompletionCuesDesc: "Allows quiet confirmations after meaningful completions.",
      settingsSoundReminderCues: "Reminder previews",
      settingsSoundReminderCuesDesc: "Allows opt-in reminder preview sounds.",
      settingsSoundMilestoneCues: "Milestone cues",
      settingsSoundMilestoneCuesDesc:
        "Allows rare streak and achievement cues without routine tap sounds.",
      settingsSoundTextureTitle: "Background sound layers",
      settingsSoundTextureDescription:
        "Choose which air, water, and rain layers ZenFlow may use for gentle background sound.",
      settingsSoundTextureAir: "Air",
      settingsSoundTextureWater: "Water",
      settingsSoundTextureRain: "Rain",
      settingsSoundFeedbackTitle: "How did this sound feel?",
      settingsSoundFeedbackDescription:
        "Stores only your comfort choice, device type, mute setting, and volume range.",
      settingsSoundFeedbackComfortable: "Comfortable",
      settingsSoundFeedbackTooLoud: "Too loud",
      settingsSoundFeedbackDistracting: "Distracting",
      settingsSoundFeedbackPreferSilent: "Prefer silent",
      settingsSoundFeedbackDidNotPlay: "Did not play",
      settingsSoundAmbientOff: "Ambient sound is off in Sound comfort.",
      diaryAmbienceLabel: "Soft rain",
      diaryAmbiencePlay: "Play soft rain",
      diaryAmbiencePause: "Pause soft rain",
      audioLoading: "Loading...",
      audioRetry: "Retry",
      soundOn: "On",
      soundOff: "Off",
      settingsSoundAmbienceNote:
        "Orb ambience starts from Orb. Diary sound is managed here so it never covers your writing.",
      settingsSoundActionMapMilestones: "Achievements and streak milestones",
      settingsSoundActionMapBreathing: "Breathing completed",
      settingsSoundActionMapFocus: "Focus completed",
      settingsSoundActionMapJournal: "Journal saved",
      settingsSoundActionMapHabit: "Habit completed",
      settingsSoundActionMapMood: "Mood saved",
      settingsSoundActionMapDescription:
        "Short sounds are reserved for meaningful completions and rare milestones.",
      settingsSoundActionMapTitle: "When ZenFlow plays a sound",
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
      notificationSystemSettingsWebDescription:
        "Browser and OS notification settings can mute or quiet reminders. App sounds stay local and tap-started.",
      notificationSystemSettingsAndroidDescription:
        "Android notification categories keep the final sound and vibration setting for each channel.",
      notificationSystemSettingsIosDescription:
        "iOS notification settings and Focus modes keep final control over alert sound and delivery.",
      notificationSystemSettingsDesktopDescription:
        "Computer browser and device notification settings keep final control over reminder delivery and sound.",
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
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        theme: themeStoreMock.state.theme,
        appliedTheme: themeStoreMock.state.appliedTheme,
        themeCustomization: themeStoreMock.state.themeCustomization,
        setTheme: themeStoreMock.setTheme,
        setThemeCustomization: themeStoreMock.setThemeCustomization,
        previewThemeCustomization: themeStoreMock.previewThemeCustomization,
        cancelThemeCustomizationPreview: themeStoreMock.cancelThemeCustomizationPreview,
        resetThemeCustomization: themeStoreMock.resetThemeCustomization,
        undoThemeCustomization: themeStoreMock.undoThemeCustomization,
      }),
    {
      getState: () => ({
        theme: themeStoreMock.state.theme,
        appliedTheme: themeStoreMock.state.appliedTheme,
        themeCustomization: themeStoreMock.state.themeCustomization,
        setTheme: themeStoreMock.setTheme,
        setThemeCustomization: themeStoreMock.setThemeCustomization,
        previewThemeCustomization: themeStoreMock.previewThemeCustomization,
        cancelThemeCustomizationPreview: themeStoreMock.cancelThemeCustomizationPreview,
        resetThemeCustomization: themeStoreMock.resetThemeCustomization,
        undoThemeCustomization: themeStoreMock.undoThemeCustomization,
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
  useDeleteAccount: () => deleteAccountMock,
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
  useDataImport: () => dataImportMock,
}));

vi.mock("@/lib/accountService", () => accountServiceMock);

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

vi.mock("@/lib/versionCheck", () => versionCheckMock);

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
    privacy: { noTracking: false, analytics: false, consentShown: true, pushNotifications: false },
    onPrivacyChange: vi.fn(),
    onOpenWidgetSettings: vi.fn(),
  };
}

describe("SettingsPage", () => {
  beforeEach(() => {
    themeStoreMock.state.theme = "paper";
    themeStoreMock.state.appliedTheme = "paper";
    themeStoreMock.state.themeCustomization = { ...themeStoreMock.defaultCustomization };
    themeStoreMock.setTheme.mockClear();
    themeStoreMock.setThemeCustomization.mockClear();
    themeStoreMock.previewThemeCustomization.mockClear();
    themeStoreMock.cancelThemeCustomizationPreview.mockClear();
    themeStoreMock.resetThemeCustomization.mockClear();
    themeStoreMock.undoThemeCustomization.mockClear();
    delete document.documentElement.dataset.themeStyle;
    delete document.documentElement.dataset.themeAccent;
    delete document.documentElement.dataset.themeComfort;
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
    audioManagerMock.playNotificationPreview.mockClear();
    audioManagerMock.getAudioSettings.mockClear();
    audioManagerMock.subscribeAudioSettings.mockClear();
    accountAuthMock.handleSignOut.mockClear();
    accountAuthMock.handleProvider.mockClear();
    accountAuthMock.handleLinkProvider.mockClear();
    accountServiceMock.updateProfileName.mockReset();
    accountServiceMock.updateProfileName.mockResolvedValue(true);
    versionCheckMock.checkAppVersionStatus.mockReset();
    versionCheckMock.checkAppVersionStatus.mockResolvedValue({
      status: "current",
      clientVersion: "2.0.0",
      clientBuildTime: 1000,
      serverVersion: "2.0.0",
      serverBuildTime: 1000,
    });
    versionCheckMock.reloadAppForUpdate.mockReset();
    versionCheckMock.reloadAppForUpdate.mockResolvedValue(undefined);
    deleteAccountMock.showDeleteConfirm = false;
    deleteAccountMock.deleteStatus = null;
    deleteAccountMock.deleteConfirmInput = "";
    deleteAccountMock.isDeletingAccount = false;
    deleteAccountMock.setShowDeleteConfirm.mockClear();
    deleteAccountMock.setDeleteConfirmInput.mockClear();
    deleteAccountMock.handleDeleteAccount.mockClear();
    dataImportMock.importMode = "merge";
    dataImportMock.isImporting = false;
    dataImportMock.showImportConfirm = false;
    dataImportMock.pendingImportFile = null;
    dataImportMock.fileInputRef.current = null;
    dataImportMock.setImportMode.mockClear();
    dataImportMock.handleImportClick.mockClear();
    dataImportMock.handleImportFile.mockClear();
    dataImportMock.handleImportCancel.mockClear();
    dataImportMock.handleImportConfirm.mockClear();
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
    expect(screen.getByTestId("settings-module-card-profile")).not.toHaveAttribute("aria-expanded");
    expect(screen.getByTestId("settings-module-card-profile")).not.toHaveAttribute("aria-controls");
    expect(screen.getByTestId("settings-module-card-profile")).toBeDisabled();
    expect(screen.getByTestId("settings-module-card-profile")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("settings-module-card-account")).toHaveTextContent(
      "Automatic sync active"
    );
    expect(screen.queryByTestId("settings-module-card-modules")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-module-card-appearance")).not.toHaveAttribute(
      "aria-expanded"
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

  it("does not expose broken aria-controls links when controls are not wired", () => {
    render(<SettingsPage />);

    const passiveCards = screen.getAllByTestId(/^settings-module-card-/);
    for (const card of passiveCards) {
      expect(card).not.toHaveAttribute("aria-controls");
      expect(card).not.toHaveAttribute("aria-expanded");
    }

    const elementsWithControls = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-controls"));

    for (const button of elementsWithControls) {
      const controlledId = button.getAttribute("aria-controls");
      expect(controlledId).toBeTruthy();
      expect(document.getElementById(controlledId as string)).toBeInTheDocument();
    }
  });

  it("renders Settings as a separate control workspace instead of a nested accordion", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    const workspace = screen.getByTestId("settings-page-workspace");
    const moduleList = screen.getByTestId("settings-module-list");
    const selectedPanel = screen.getByTestId("settings-selected-panel");
    const deck = screen.getByTestId("settings-page-control-deck");

    expect(workspace).toHaveAttribute("data-layout", "control-surface");
    expect(workspace).toContainElement(moduleList);
    expect(workspace).toContainElement(selectedPanel);
    expect(selectedPanel).toContainElement(deck);
    expect(moduleList).not.toContainElement(deck);
    expect(screen.getByTestId("settings-module-card-profile")).toHaveAttribute(
      "aria-controls",
      "settings-module-panel-profile"
    );
  });

  it("opens the account module from a settingsSection query and clears the routing hint", () => {
    window.history.replaceState({}, "", "/people-first-app/settings?nav=v2&navLayout=phone&settingsSection=account");

    render(<SettingsPage controls={createSettingsControls()} />);

    expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
      "data-selected-section",
      "account",
    );
    expect(screen.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByTestId("settings-v2-panel-account")).toBeInTheDocument();
    expect(window.location.search).not.toContain("settingsSection");
    expect(window.location.search).toContain("nav=v2");
  });
  it("opens appearance customization first when Settings controls are wired", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
      "data-selected-section",
      "appearance"
    );
    expect(screen.getByTestId("settings-module-card-appearance")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByTestId("settings-v2-panel-appearance")).toBeInTheDocument();
    expectDeckInsideModulePanel("appearance");
  });

  it("keeps the selected profile controls in the module without standalone sync status", () => {
    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-module-card-profile"));

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

  it("uses a calm tokenized profile save action instead of a solid accent block", () => {
    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-module-card-profile"));

    const saveButton = screen.getByTestId("settings-v2-profile-save");
    const saveClassName = saveButton.getAttribute("class") || "";

    expect(saveButton).toHaveAccessibleName("Save name");
    expect(saveButton).toBeDisabled();
    expect(within(saveButton).getByTestId("settings-v2-profile-save-icon")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(saveClassName).toContain("bg-[hsl(var(--settings-v2-accent)/0.14)]");
    expect(saveClassName).not.toContain("bg-[hsl(var(--settings-v2-accent))]");
  });

  it("saves profile name only after a scoped dirty change", async () => {
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);
    fireEvent.click(screen.getByTestId("settings-module-card-profile"));

    const nameInput = screen.getByLabelText("Your name");
    const saveButton = screen.getByTestId("settings-v2-profile-save");

    fireEvent.change(nameInput, { target: { value: "Avery Stone" } });
    expect(saveButton).not.toBeDisabled();

    fireEvent.keyDown(nameInput, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(controls.onNameChange).toHaveBeenCalledWith("Avery Stone"));
    expect(accountServiceMock.updateProfileName).toHaveBeenCalledWith("Avery Stone");
    await waitFor(() => expect(saveButton).toBeDisabled());
  });

  it("keeps data export primary actions tonal instead of louder than the Settings panel", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-data"));

    const exportButton = screen.getByTestId("settings-v2-export-json");
    const exportClassName = exportButton.getAttribute("class") || "";

    expect(exportButton).toHaveAccessibleName(/Export/);
    expect(exportClassName).toContain("bg-[hsl(var(--settings-v2-accent)/0.14)]");
    expect(exportClassName).not.toContain("bg-[hsl(var(--settings-v2-accent))]");
  });

  it("uses destructive hierarchy for replace-mode import confirmation", () => {
    dataImportMock.importMode = "replace";
    dataImportMock.showImportConfirm = true;
    dataImportMock.pendingImportFile = new File(["{}"], "zenflow-backup.json", {
      type: "application/json",
    });

    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-module-card-data"));

    const replaceChoice = screen.getByTestId("settings-v2-import-mode-replace");
    const importButton = screen.getByTestId("settings-v2-import");
    const dialog = screen.getByRole("dialog", { name: "Import Backup" });
    const confirmButton = within(dialog).getByRole("button", { name: "Replace" });

    expect(replaceChoice).toHaveAttribute("aria-pressed", "true");
    expect(replaceChoice.className).toContain("bg-destructive/10");
    expect(importButton.className).toContain("text-destructive");
    expect(dialog).toHaveTextContent("All current data will be deleted and replaced with import");
    expect(confirmButton.className).toContain("text-destructive");
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
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  it("uses instant panel scroll on mobile settings module changes", () => {
    const scroll = installScrollIntoViewSpy();
    const media = installSettingsMotionMediaQuery({
      isMobileWorkspace: true,
      prefersReducedMotion: false,
    });

    try {
      render(<SettingsPage controls={createSettingsControls()} />);

      fireEvent.click(screen.getByTestId("settings-module-card-data"));

      expect(scroll.scrollIntoView).toHaveBeenCalledWith({
        block: "start",
        behavior: "auto",
      });
      expect(media.matchMedia).toHaveBeenCalledWith("(max-width: 1023px)");
      expect(media.matchMedia).not.toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    } finally {
      media.restore();
      scroll.restore();
    }
  });

  it("moves keyboard focus to the selected module panel on mobile module changes", () => {
    const scroll = installScrollIntoViewSpy();
    const media = installSettingsMotionMediaQuery({
      isMobileWorkspace: true,
      prefersReducedMotion: false,
    });

    try {
      render(<SettingsPage controls={createSettingsControls()} />);

      fireEvent.click(screen.getByTestId("settings-module-card-sound"));

      const selectedPanel = screen.getByTestId("settings-module-panel-sound");
      expect(selectedPanel).toHaveAttribute("tabindex", "-1");
      expect(selectedPanel).toHaveFocus();
    } finally {
      media.restore();
      scroll.restore();
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

  it("marks the account delete confirmation action busy while deletion is running", () => {
    deleteAccountMock.showDeleteConfirm = true;
    deleteAccountMock.deleteConfirmInput = "DELETE";
    deleteAccountMock.isDeletingAccount = true;

    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "account",
        }}
      />
    );

    const deletingButton = screen.getByRole("button", { name: "Deleting..." });
    expect(deletingButton).toHaveAttribute("aria-busy", "true");
    expect(deletingButton).toBeDisabled();
    expect(screen.getByLabelText("Type DELETE to confirm:")).toBeDisabled();
  });

  it("focuses the account delete confirmation input when the destructive panel is shown", () => {
    deleteAccountMock.showDeleteConfirm = true;
    deleteAccountMock.deleteConfirmInput = "";
    deleteAccountMock.isDeletingAccount = false;

    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "account",
        }}
      />
    );

    expect(screen.getByLabelText("Type DELETE to confirm:")).toHaveFocus();
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
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
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
    expect(screen.getByTestId("settings-v2-theme-choice-paper").className).toContain(
      "bg-[hsl(var(--settings-v2-accent)/0.14)]"
    );

    fireEvent.click(screen.getByTestId("settings-v2-theme-choice-ink"));
    expect(themeStoreMock.setTheme).toHaveBeenLastCalledWith("ink");
    expect(document.documentElement.dataset.theme).toBe("ink");

    fireEvent.click(screen.getByTestId("settings-v2-theme-choice-auto"));
    expect(themeStoreMock.setTheme).toHaveBeenLastCalledWith("auto");
    expect(document.documentElement.dataset.theme).toBe("paper");

    const oledToggle = within(screen.getByTestId("settings-v2-oled-toggle")).getByRole("switch", {
      name: "Pure black mode",
    });
    fireEvent.click(oledToggle);
    expect(themeStoreMock.setTheme).toHaveBeenLastCalledWith("oled");
    expect(document.documentElement.dataset.theme).toBe("oled");
  });

  it("removes placeholder appearance preview and renders optical swatches", () => {
    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "appearance",
        }}
      />
    );

    expect(screen.queryByTestId("settings-v2-style-preview-card")).not.toBeInTheDocument();
    expect(screen.queryByText(/Preview shows cards/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-style-choice-botanicalPulse")).toHaveTextContent(
      "Botanical Pulse"
    );
    expect(screen.getByTestId("settings-v2-style-choice-botanicalPulse")).not.toHaveTextContent(
      "Fresh Glass"
    );

    const violetAccent = screen.getByTestId("settings-v2-accent-choice-plum");
    fireEvent.click(violetAccent);
    expect(screen.getByTestId("settings-v2-accent-selected-label")).toHaveTextContent("Violet");
    expect(violetAccent).toHaveAccessibleName("Violet");
    expect(violetAccent).toHaveAttribute("aria-describedby", "settings-v2-accent-selected-label");
    expect(violetAccent).toHaveAttribute("data-swatch-kind", "accent");
    expect(violetAccent.textContent?.trim()).toBe("");
    expect(violetAccent.className).toContain("rounded-full");
  });

  it("previews and applies guided appearance customization", () => {
    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "appearance",
        }}
      />
    );

    fireEvent.click(screen.getByTestId("settings-v2-style-choice-morningHearth"));
    fireEvent.click(screen.getByTestId("settings-v2-accent-choice-clay"));
    fireEvent.click(screen.getByTestId("settings-v2-intensity-choice-vivid"));
    fireEvent.click(screen.getByTestId("settings-v2-comfort-summary"));
    fireEvent.click(
      within(screen.getByTestId("settings-v2-high-contrast-toggle")).getByRole("switch", {
        name: "High contrast",
      })
    );

    fireEvent.click(screen.getByTestId("settings-v2-style-preview"));

    expect(themeStoreMock.previewThemeCustomization).toHaveBeenLastCalledWith(
      expect.objectContaining({
        paletteId: "morningHearth",
        accentFamily: "clay",
        intensity: "vivid",
        contrastMode: "high",
      })
    );
    expect(themeStoreMock.setThemeCustomization).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.themeStyle).toBe("morningHearth");

    fireEvent.click(screen.getByTestId("settings-v2-style-apply"));
    expect(themeStoreMock.setThemeCustomization).toHaveBeenLastCalledWith(
      expect.objectContaining({ paletteId: "morningHearth", accentFamily: "clay" })
    );

    fireEvent.click(screen.getByTestId("settings-v2-appearance-more"));
    fireEvent.click(screen.getByTestId("settings-v2-style-reset"));
    expect(themeStoreMock.resetThemeCustomization).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("settings-v2-style-undo"));
    expect(themeStoreMock.undoThemeCustomization).toHaveBeenCalledTimes(1);
  });

  it("gives settings navigation and actions a tactile affordance contract", () => {
    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "appearance",
        }}
      />
    );

    const appearanceArticle = screen.getByTestId("settings-module-appearance");
    const appearanceModule = screen.getByTestId("settings-module-card-appearance");
    const morningHearthChoice = screen.getByTestId("settings-v2-style-choice-morningHearth");
    const actions = screen.getByTestId("settings-v2-appearance-actions");
    const moreAction = screen.getByTestId("settings-v2-appearance-more");
    const previewAction = screen.getByTestId("settings-v2-style-preview");
    const applyAction = screen.getByTestId("settings-v2-style-apply");

    expect(appearanceArticle).toHaveAttribute("data-active", "true");
    expect(appearanceModule).toHaveAttribute("data-interaction-surface", "settings-module");
    expect(appearanceModule.className).toContain("active:translate-y-[1px]");
    expect(morningHearthChoice).toHaveAttribute("data-interaction-surface", "settings-choice");
    expect(morningHearthChoice.className).toContain("active:translate-y-[1px]");
    expect(within(actions).queryByTestId("settings-v2-style-reset")).toBeNull();
    expect(moreAction).toHaveAttribute("aria-haspopup", "menu");
    expect(previewAction).toHaveAttribute("data-button-tone", "secondary");
    expect(previewAction.className).toContain("active:translate-y-[1px]");
    expect(applyAction).toHaveAttribute("data-button-tone", "primary");
    expect(applyAction.className).toContain("shadow-[");
  });

  it("clears a live preview when the draft changes before apply", () => {
    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "appearance",
        }}
      />
    );

    fireEvent.click(screen.getByTestId("settings-v2-style-choice-morningHearth"));
    fireEvent.click(screen.getByTestId("settings-v2-style-preview"));
    expect(themeStoreMock.previewThemeCustomization).toHaveBeenLastCalledWith(
      expect.objectContaining({ paletteId: "morningHearth" })
    );

    fireEvent.click(screen.getByTestId("settings-v2-accent-choice-clay"));

    expect(themeStoreMock.cancelThemeCustomizationPreview).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Preview cleared after changes")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-style-apply")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("settings-v2-style-apply"));
    expect(themeStoreMock.setThemeCustomization).toHaveBeenLastCalledWith(
      expect.objectContaining({ paletteId: "morningHearth", accentFamily: "clay" })
    );
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
    expect(
      screen.getByText(
        "Orb ambience starts from Orb. Diary sound is managed here so it never covers your writing."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Sound comfort")).toBeInTheDocument();
    expect(screen.getByText("Ambient sound")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-diary-ambience-control")).toHaveTextContent("Soft rain");
    expect(screen.queryByText("Where sound appears")).not.toBeInTheDocument();
    expect(screen.queryByText("Action feedback map")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-sound-map-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-action-sound-map-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-sound-platform-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-panel-sound")).not.toHaveTextContent(
      /\b(PWA|Android|iOS|Desktop|Web)\b/
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview sound" }));
    expect(audioManagerMock.playNotificationPreview).toHaveBeenCalledTimes(1);
    expect(audioManagerMock.playNotification).toHaveBeenCalledTimes(0);

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

  it("keeps V2 sound settings focused on active controls instead of reference maps", () => {
    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-module-card-sound"));

    const soundPanel = screen.getByTestId("settings-v2-panel-sound");

    expect(screen.getByTestId("settings-v2-app-sound-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-audio-volume")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-audio-preview")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-diary-ambience-control")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-sound-map-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-action-sound-map-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-sound-platform-card")).not.toBeInTheDocument();
    expect(soundPanel).not.toHaveTextContent(/\b(PWA|Android|iOS|Desktop|Web)\b/);
  });

  it("keeps settings range controls at a finger-size target without a thicker visible track", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-sound"));
    const volume = screen.getByTestId("settings-v2-audio-volume");
    expect(volume).toHaveClass("settings-v2-range-control", "h-11");
    expect(volume).not.toHaveClass("bg-muted", "py-[18px]");

    fireEvent.click(screen.getByTestId("settings-module-card-about"));
    const textSize = screen.getByLabelText("Text Size");
    expect(textSize).toHaveClass("settings-v2-range-control", "h-11");
    expect(textSize).not.toHaveClass("bg-muted", "py-[18px]");
  });

  it("keeps diary ambience control inside sound settings only", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
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
      expect(play).not.toHaveBeenCalled();

      const pendingPlayback = createDeferred();
      play.mockReturnValueOnce(pendingPlayback.promise);
      fireEvent.click(toggle);

      await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
      expect(toggle).toHaveAccessibleName("Soft rain, Loading...");

      pendingPlayback.resolve();
      await waitFor(() => expect(toggle).toHaveAccessibleName("Pause soft rain"));

      fireEvent.click(toggle);

      expect(pause).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(toggle).toHaveAccessibleName("Play soft rain"));

      fireEvent.click(toggle);
      await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
      pause.mockClear();
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(pause).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(toggle).toHaveAccessibleName("Play soft rain"));

      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      fireEvent.click(toggle);
      await waitFor(() => expect(play).toHaveBeenCalledTimes(3));
      pause.mockClear();
      window.dispatchEvent(new Event("pagehide"));

      expect(pause).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(toggle).toHaveAccessibleName("Play soft rain"));

      fireEvent.click(toggle);
      await waitFor(() => expect(play).toHaveBeenCalledTimes(4));
      await waitFor(() =>
        expect(capacitorAppMock.addListener).toHaveBeenCalledWith("pause", expect.any(Function))
      );
      pause.mockClear();
      capacitorAppMock.pauseListeners[0]?.();

      expect(pause).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(toggle).toHaveAccessibleName("Play soft rain"));
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

  it("names the disabled diary ambience button by control and status", () => {
    audioManagerMock.state.muted = true;
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    try {
      render(<SettingsPage controls={createSettingsControls()} />);
      fireEvent.click(screen.getByTestId("settings-module-card-sound"));

      const control = screen.getByTestId("settings-v2-diary-ambience-control");
      const toggle = within(control).getByRole("button", { name: "Soft rain, Muted" });

      expect(toggle).toBeDisabled();
      expect(control).toHaveTextContent("Muted");
      fireEvent.click(toggle);
      expect(play).not.toHaveBeenCalled();
    } finally {
      play.mockRestore();
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

    fireEvent.change(screen.getByLabelText("Quiet start"), { target: { value: "21:30" } });
    const quietStartUpdater = controls.onRemindersChange.mock.calls.at(-1)?.[0];
    expect(typeof quietStartUpdater).toBe("function");
    expect(quietStartUpdater(controls.reminders).quietHours).toEqual({
      start: "21:30",
      end: "07:00",
    });

    fireEvent.change(screen.getByLabelText("Quiet end"), { target: { value: "08:15" } });
    const quietEndUpdater = controls.onRemindersChange.mock.calls.at(-1)?.[0];
    expect(typeof quietEndUpdater).toBe("function");
    expect(quietEndUpdater(controls.reminders).quietHours).toEqual({
      start: "22:00",
      end: "08:15",
    });
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

    await waitFor(() => expect(localNotificationsMock.requestPermissions).toHaveBeenCalledTimes(1));
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
      expect(notificationSoundsMock.updateNotificationSound).toHaveBeenCalledWith("gentle")
    );
    await waitFor(() => expect(localNotificationsMock.schedule).toHaveBeenCalled());
    const scheduled = localNotificationsMock.schedule.mock.calls.flatMap(
      ([payload]) => payload.notifications
    );
    expect(scheduled).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 101,
          channelId: "zenflow_gentle_v2",
          schedule: expect.objectContaining({ on: expect.objectContaining({ weekday: 2 }) }),
        }),
        expect.objectContaining({
          id: 9001,
          channelId: "zenflow_gentle_v2",
          actionTypeId: "MOOD_QUICK_LOG",
          schedule: expect.objectContaining({ on: expect.objectContaining({ weekday: 2 }) }),
        }),
      ])
    );
    expect(scheduled).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 1 })]));
    expect(scheduled).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 150 })]));
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

    expect(await screen.findByTestId("settings-v2-reminders-permission-warning")).toHaveTextContent(
      "Notification permission denied."
    );
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
      pushNotifications: false,
    });
  });

  it("wires account reminder alerts to explicit privacy consent", () => {
    const controls = {
      ...createSettingsControls(),
      privacy: {
        noTracking: true,
        analytics: false,
        consentShown: true,
        adConsent: false,
        pushNotifications: false,
      },
    };
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));
    fireEvent.click(
      within(screen.getByTestId("settings-v2-push-notifications")).getByRole("switch", {
        name: "Account reminder alerts",
      })
    );

    const updater = controls.onPrivacyChange.mock.calls.at(-1)?.[0];
    expect(typeof updater).toBe("function");
    expect(updater(controls.privacy)).toMatchObject({
      noTracking: false,
      analytics: false,
      adConsent: false,
      pushNotifications: true,
    });
  });

  it("does not expose the legacy widget settings action inside the V2 about panel", () => {
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-about"));

    expect(screen.queryByRole("button", { name: "Widget Settings" })).not.toBeInTheDocument();
    expect(controls.onOpenWidgetSettings).not.toHaveBeenCalled();
  });

  it("lets Web/PWA users manually check whether the open tab is stale and reload only by explicit action", async () => {
    const controls = createSettingsControls();
    versionCheckMock.checkAppVersionStatus.mockResolvedValueOnce({
      status: "stale",
      clientVersion: "2.0.0",
      clientBuildTime: 1000,
      serverVersion: "2.0.0",
      serverBuildTime: 2000,
    });

    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-about"));
    fireEvent.click(screen.getByTestId("settings-v2-check-updates"));

    expect(versionCheckMock.checkAppVersionStatus).toHaveBeenCalledTimes(1);
    const status = await screen.findByRole("status", {
      name: /A newer version is ready.*Finish anything you are typing first./,
    });
    expect(status).toHaveTextContent("Restart ZenFlow to load the latest version.");
    expect(versionCheckMock.reloadAppForUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Restart ZenFlow" }));

    await waitFor(() => expect(versionCheckMock.reloadAppForUpdate).toHaveBeenCalledTimes(1));
  });

  it("clears the restart busy state when the update reload loop guard blocks navigation", async () => {
    const controls = createSettingsControls();
    versionCheckMock.checkAppVersionStatus.mockResolvedValueOnce({
      status: "stale",
      clientVersion: "2.0.0",
      clientBuildTime: 1000,
      serverVersion: "2.0.0",
      serverBuildTime: 2000,
    });
    versionCheckMock.reloadAppForUpdate.mockReturnValueOnce(false);

    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-about"));
    fireEvent.click(screen.getByTestId("settings-v2-check-updates"));

    const restartButton = await screen.findByRole("button", { name: "Restart ZenFlow" });
    fireEvent.click(restartButton);

    await waitFor(() => expect(versionCheckMock.reloadAppForUpdate).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Restart ZenFlow" })).not.toBeDisabled();
  });

  it("does not show a failed Web/PWA version check as up to date", async () => {
    const controls = createSettingsControls();
    versionCheckMock.checkAppVersionStatus.mockResolvedValueOnce({
      status: "unavailable",
      reason: "network",
    });

    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-about"));
    fireEvent.click(screen.getByTestId("settings-v2-check-updates"));

    const status = await screen.findByRole("status", {
      name: /Could not check for updates.*Nothing changed on this device./,
    });
    expect(status).toHaveTextContent("ZenFlow needs a network check to confirm the latest version.");
    expect(screen.queryByText("You have the latest version")).not.toBeInTheDocument();
  });

  it("groups About actions into experience and support/legal areas", () => {
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-about"));

    const experience = screen.getByTestId("settings-v2-about-experience-group");
    const supportLegal = screen.getByTestId("settings-v2-about-support-legal-group");

    expect(experience).toHaveTextContent("Experience controls");
    expect(experience).toHaveTextContent("Feedback style");
    expect(experience).toHaveTextContent("Version History");
    expect(supportLegal).toHaveTextContent("Support and legal");
    expect(supportLegal).toHaveTextContent("Send feedback");
    expect(supportLegal).toHaveTextContent("Privacy Policy");
    expect(supportLegal).toHaveTextContent("Terms of Service");
    expect(supportLegal).toHaveTextContent("Open-source library licenses");
  });

  it("requires typed confirmation before resetting local data", async () => {
    const controls = createSettingsControls();
    controls.onResetData.mockResolvedValue(undefined);
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-data"));
    fireEvent.click(screen.getByTestId("settings-v2-reset-data"));

    const confirmButton = screen.getByRole("button", { name: "Clear local data" });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByLabelText("Type RESET to confirm")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Type RESET to confirm"), {
      target: { value: "RESET" },
    });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    await waitFor(() => expect(controls.onResetData).toHaveBeenCalledTimes(1));
  });

  it("focuses the reset confirmation input before accepting destructive local data removal", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-data"));
    fireEvent.click(screen.getByTestId("settings-v2-reset-data"));

    expect(screen.getByLabelText("Type RESET to confirm")).toHaveFocus();
  });

  it("marks the reset confirmation action busy while reset is running", async () => {
    const controls = createSettingsControls();
    controls.onResetData.mockReturnValue(new Promise(() => undefined));
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-data"));
    fireEvent.click(screen.getByTestId("settings-v2-reset-data"));
    fireEvent.change(screen.getByLabelText("Type RESET to confirm"), {
      target: { value: "RESET" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear local data" }));

    const resettingButton = await screen.findByRole("button", { name: "Resetting..." });
    expect(resettingButton).toHaveAttribute("aria-busy", "true");
    expect(resettingButton).toBeDisabled();
  });

  it("renders working settings without future-update placeholder copy", () => {
    const controls = createSettingsControls();
    controls.reminders = { ...controls.reminders, enabled: false };

    render(<SettingsPage controls={controls} />);

    expect(screen.getByTestId("settings-page-heading")).toHaveTextContent("Settings");
    const notificationsCard = screen.getByTestId("settings-module-card-notifications");
    expect(notificationsCard).toHaveTextContent("Reminders off");
    expect(notificationsCard).not.toHaveTextContent(
      "Notifications will be available in future updates."
    );
  });
});
