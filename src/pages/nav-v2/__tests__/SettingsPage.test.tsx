import type React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    schemaVersion: 1;
    accentFamily: "green" | "blue" | "violet" | "amber";
    highContrast: boolean;
  };
  const defaultCustomization: ThemeCustomizationMock = {
    schemaVersion: 1,
    accentFamily: "green",
    highContrast: false,
  };
  const state = {
    theme: "paper" as "paper" | "ink" | "oled" | "auto",
    appliedTheme: "paper" as "paper" | "ink" | "oled",
    themeCustomization: { ...defaultCustomization },
  };
  let previousCustomization: typeof defaultCustomization | null = null;
  let failNextWrite = false;
  const applyCustomizationDom = (customization: typeof defaultCustomization) => {
    document.documentElement.dataset.themeAccent = customization.accentFamily;
    document.documentElement.dataset.themeContrast =
      customization.highContrast ? "high" : "standard";
  };
  const setTheme = vi.fn((theme: "paper" | "ink" | "oled" | "auto") => {
    if (failNextWrite) {
      failNextWrite = false;
      return { ok: false as const, reason: "storage-unavailable" as const };
    }
    state.theme = theme;
    state.appliedTheme = theme === "auto" ? "paper" : theme;
    document.documentElement.dataset.theme = state.appliedTheme;
    return { ok: true as const };
  });
  const setThemeCustomization = vi.fn((customization: typeof defaultCustomization) => {
    if (failNextWrite) {
      failNextWrite = false;
      return { ok: false as const, reason: "storage-unavailable" as const };
    }
    previousCustomization = { ...state.themeCustomization };
    state.themeCustomization = { ...customization };
    applyCustomizationDom(state.themeCustomization);
    return { ok: true as const };
  });
  const resetThemeCustomization = vi.fn(() => {
    if (failNextWrite) {
      failNextWrite = false;
      return { ok: false as const, reason: "storage-unavailable" as const };
    }
    previousCustomization = { ...state.themeCustomization };
    state.themeCustomization = { ...defaultCustomization };
    applyCustomizationDom(state.themeCustomization);
    return { ok: true as const };
  });
  const undoThemeCustomization = vi.fn(() => {
    if (failNextWrite) {
      failNextWrite = false;
      return { ok: false as const, reason: "storage-unavailable" as const };
    }
    if (!previousCustomization) return { ok: true as const };
    const current = { ...state.themeCustomization };
    state.themeCustomization = { ...previousCustomization };
    previousCustomization = current;
    applyCustomizationDom(state.themeCustomization);
    return { ok: true as const };
  });

  return {
    defaultCustomization,
    state,
    setTheme,
    setThemeCustomization,
    resetThemeCustomization,
    undoThemeCustomization,
    getPreviousCustomization: () => previousCustomization,
    resetPreviousCustomization: () => {
      previousCustomization = null;
    },
    failNextWrite: () => {
      failNextWrite = true;
    },
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

const journalProtectionMock = vi.hoisted(() => ({
  hasProtection: false,
  hasPersistentJournalProtection: vi.fn(),
}));

const journalFeatureMock = vi.hoisted(() => ({
  setAutoLockMs: vi.fn<(ms: number) => boolean>(() => true),
}));

const appStoreMock = vi.hoisted<{ hasValidSession: boolean | null }>(() => ({
  hasValidSession: true,
}));

const supabaseClientMock = vi.hoisted<{ client: Record<string, unknown> | null }>(() => ({
  client: {},
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
  const state = { currentChannelId: "zenflow_default_v3" };
  return {
    state,
    updateNotificationSound: vi.fn().mockImplementation(async (sound: string) => {
      state.currentChannelId = sound === "gentle" ? "zenflow_gentle_v3" : "zenflow_default_v3";
      return state.currentChannelId;
    }),
    initializeNotificationChannels: vi.fn().mockResolvedValue(undefined),
    isCurrentNotificationSoundChannelId: (channelId: string | undefined) =>
      typeof channelId === "string" && channelId.endsWith("_v3"),
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
  authStatus: null as string | null,
  setAuthStatus: vi.fn(),
  sessionUserId: "user-1",
  sessionAccountLabel: "avery@example.com",
  sessionDisplayName: "Avery",
  linkedProviderIds: [] as string[],
  enabledProviders: [] as Array<{
    id: string;
    labelKey: string;
    loadingLabelKey: string;
    fallbackLabel: string;
    fallbackLoadingLabel: string;
  }>,
  hasSession: true,
  sessionCheckState: "signed-in",
  refreshSession: vi.fn(),
  signingInProvider: null,
  linkingProvider: null,
  isSigningIn: false,
  isSigningOut: false,
  signOutBlockReason: null as null | "pending-changes" | "cleanup-failed" | "sign-out-failed",
  handleProvider: vi.fn(),
  handleLinkProvider: vi.fn(),
  handleSignOut: vi.fn(),
  handleDiscardPendingAndSignOut: vi.fn(),
}));

const accountServiceMock = vi.hoisted(() => ({
  updateProfileName: vi.fn().mockResolvedValue(true),
}));

const settingsOwnerMock = vi.hoisted(() => ({
  currentOwnerUserId: "user-1",
  getCurrentSessionUserId: vi.fn(),
}));

const versionCheckMock = vi.hoisted(() => ({
  checkAppVersionStatus: vi.fn(),
  reloadAppForUpdate: vi.fn(),
}));

const appUpdateManagerMock = vi.hoisted(() => ({
  checkForAppUpdate: vi.fn(),
  openGooglePlayStore: vi.fn(),
}));

const adContextMock = vi.hoisted(() => ({
  adsSupported: false,
  privacyOptionsRequired: false,
  openAdPrivacyOptions: vi.fn(),
}));

const dataStatusHarness = vi.hoisted(() => ({
  setDataStatus: null as null | ((status: string | null) => void),
}));

const deleteAccountMock = vi.hoisted(() => ({
  showDeleteConfirm: false,
  setShowDeleteConfirm: vi.fn((show: boolean) => {
    deleteAccountMock.showDeleteConfirm = show;
  }),
  openDeleteConfirmation: vi.fn(() => {
    deleteAccountMock.showDeleteConfirm = true;
    deleteAccountMock.deleteConfirmInput = "";
    return true;
  }),
  closeDeleteConfirmation: vi.fn(() => {
    if (deleteAccountMock.isDeletingAccount) return false;
    deleteAccountMock.showDeleteConfirm = false;
    deleteAccountMock.deleteConfirmInput = "";
    return true;
  }),
  deleteStatus: null as string | null,
  deleteConfirmInput: "",
  setDeleteConfirmInput: vi.fn((value: string) => {
    deleteAccountMock.deleteConfirmInput = value;
  }),
  deleteConfirmMatches: false,
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

const dataExportMock = vi.hoisted(() => ({
  isExporting: false,
  isExportingCSV: false,
  isExportingPDF: false,
  handleExport: vi.fn(),
  handleExportCSV: vi.fn(),
  handleExportPDF: vi.fn(),
}));

const audioManagerMock = vi.hoisted(() => {
  const state = { muted: false, volume: 0.3, canPlayFeedback: true };
  const getAudioSettings = vi.fn(() => ({
    muted: state.muted,
    volume: state.volume,
    feedbackSoundsEnabled: true,
    canPlayFeedback: state.canPlayFeedback,
  }));

  return {
    state,
    initAudioManager: vi.fn(),
    isMuted: vi.fn(() => state.muted),
    getVolume: vi.fn(() => state.volume),
    setMuted: vi.fn((muted: boolean) => {
      state.muted = muted;
      state.canPlayFeedback = !muted && state.volume > 0;
      window.dispatchEvent(new CustomEvent("zenflow-audio-settings-change"));
      return true;
    }),
    setVolume: vi.fn((volume: number) => {
      state.volume = volume;
      state.canPlayFeedback = !state.muted && volume > 0;
      window.dispatchEvent(new CustomEvent("zenflow-audio-settings-change"));
      return true;
    }),
    setAudioEnabled: vi.fn((enabled: boolean) => {
      state.muted = !enabled;
      if (enabled && state.volume <= 0) state.volume = 0.3;
      state.canPlayFeedback = enabled && state.volume > 0;
      window.dispatchEvent(new CustomEvent("zenflow-audio-settings-change"));
      return true;
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

const interactionPreferencesMock = vi.hoisted(() => {
  const motion = { reduceMotion: false };
  const haptics = { enabled: false };
  return {
    motion,
    haptics,
    trySetReduceMotion: vi.fn((reduceMotion: boolean) => {
      motion.reduceMotion = reduceMotion;
      return { ok: true as const, preference: { ...motion } };
    }),
    trySetHapticsEnabled: vi.fn((enabled: boolean) => {
      haptics.enabled = enabled;
      return { ok: true as const, preference: { ...haptics } };
    }),
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
  expect(panel).toHaveAttribute("aria-labelledby", `settings-module-panel-heading-${sectionId}`);
  expect(document.getElementById(`settings-module-panel-heading-${sectionId}`)).toBeInTheDocument();
  expect(selectedButton).toHaveAttribute("aria-controls", `settings-module-panel-${sectionId}`);
}

function installScrollIntoViewSpy() {
  const scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
  const windowScrollDescriptor = Object.getOwnPropertyDescriptor(window, "scrollTo");
  const rafDescriptor = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame");
  const scrollIntoView = vi.fn();
  const scrollTo = vi.fn();

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
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });

  return {
    scrollIntoView,
    scrollTo,
    restore: () => {
      if (scrollDescriptor) {
        Object.defineProperty(Element.prototype, "scrollIntoView", scrollDescriptor);
      } else {
        Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      }
      if (windowScrollDescriptor) {
        Object.defineProperty(window, "scrollTo", windowScrollDescriptor);
      } else {
        Reflect.deleteProperty(window, "scrollTo");
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
  const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth");
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
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: options.isMobileWorkspace ? 390 : 1280,
  });

  return {
    matchMedia,
    restore: () => {
      if (matchMediaDescriptor) {
        Object.defineProperty(window, "matchMedia", matchMediaDescriptor);
      } else {
        Reflect.deleteProperty(window, "matchMedia");
      }
      if (innerWidthDescriptor) {
        Object.defineProperty(window, "innerWidth", innerWidthDescriptor);
      } else {
        Reflect.deleteProperty(window, "innerWidth");
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
      themeStyleDescription: "Choose a mode, accent color, and readable text size.",
      themeModeTitle: "Color mode",
      themeBlack: "Black",
      themeChangeSaved: "Changed",
      settingsPreferenceSaveError: "Could not save this change. Your previous setting is still active.",
      settingsOverviewDescriptionWithoutReminders:
        "Choose how ZenFlow looks, sounds, and handles your data.",
      settingsReduceMotion: "Reduce motion",
      settingsReduceMotionDescription: "Limits transitions and decorative movement.",
      settingsReduceMotionSystemDescription: "Your device is currently reducing motion.",
      profileNamePlaceholder: "Enter your name",
      settingsAboutProductSummary:
        "ZenFlow brings mood check-ins, habits, focus sessions, and your journal into one place.",
      settingsAboutSupportLegalTitle: "Help and legal",
      settingsAboutSupportLegalDescription:
        "Privacy, terms, licenses, and support.",
      settingsWebUpdateDescription: "Check for a newer version.",
      settingsNativeUpdateDescription: "Check for a newer version.",
      openSourceLicenses: "Licenses",
      themeAccentTitle: "Accent",
      themeAccentDescription: "Color for buttons, selections, and highlights.",
      themeIntensityTitle: "Intensity",
      themeComfortTitle: "Comfort",
      themePreviewAction: "Preview",
      themeApplyAction: "Apply",
      themeResetAction: "Reset accent and contrast",
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
      themeAccentTeal: "Green",
      themeAccentClay: "Blue",
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
      remindersDescription: "Choose when ZenFlow reminds you about mood and focus.",
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
      settingsGroupAppearanceAccessibility: "Appearance & accessibility",
      settingsGroupReminders: "Reminders",
      settingsGroupPrivacyData: "Privacy & data",
      settingsGroupHelpAbout: "Help & information",
      settingsCloudSyncTitle: "Automatic sync",
      settingsCloudSyncEnabled: "Automatic sync active",
      settingsCloudSyncDescription: "Signed-in data stays synced across devices.",
      settingsCloudSyncDisabledByUser: "Sync paused",
      cloudSyncDisabled: "Cloud sync disabled",
      sessionExpiredSettings: "Your session has expired",
      localDataSafe: "Your local data is safe.",
      syncing: "Syncing...",
      settingsGroupData: "Data & Privacy",
      settingsExportImportTitle: "Backups & reports",
      settingsExportTitle: "Save backup",
      settingsImportTitle: "Import backup",
      importMode: "How to import",
      importMerge: "Add to current data",
      importReplace: "Replace current data",
      importConfirmTitle: "Import backup",
      importConfirmMessage: "Import data from this backup?",
      settingsImportReplaceTooltip:
        "This replaces current moods, habits, focus sessions, gratitude, and settings included in backups. Diary areas are replaced only when they are present in the backup. Protection settings for this device stay unchanged.",
      fontScaleTitle: "Text Size",
      fontScalePreviewSub: "Adjust text size across the app.",
      fontScaleTiny: "Tiny",
      fontScaleSmall: "Small",
      fontScaleDefault: "Default",
      fontScaleMedium: "Medium",
      fontScaleLarge: "Large",
      fontScaleXL: "Extra large",
      fontScaleXXL: "Largest",
      authLinkedProviders: "Connected sign-in methods",
      authSignOutRecoveryTitle: "Finish signing out",
      authDiscardAndSignOut: "Discard changes and sign out",
      authDiscardSignOutConfirm: "Discard unsaved changes and sign out?",
      authDiscardSignOutWarning:
        "Changes waiting to be saved online will be permanently removed from this device.",
      authSignOutPendingChanges: "Changes are still waiting to be saved online.",
      retry: "Retry",
      exportData: "Export data",
      cancel: "Cancel",
      authGoogle: "Google",
      moodReminder: "Mood",
      habitReminder: "Habit",
      notificationsComingSoon: "Notifications will be available in future updates.",
      settingsOverviewDescription:
        "Choose how ZenFlow looks, sounds, reminds you, and handles your data.",
      settingsAccountBackupTitle: "Account & backup",
      settingsAccountBackupDescription:
        "Your account is connected. If ZenFlow can’t save an update online, your changes stay on this device.",
      settingsAccountSignedIn: "Signed in",
      settingsAccountSignedOut: "You’re not signed in",
      settingsAccountDataOnDevice:
        "Your data stays on this device. Sign in to back it up and use it on your other devices.",
      settingsAccountBackupChecking: "Checking your account…",
      settingsAccountBackupCheckingDescription:
        "Your data stays on this device while ZenFlow checks your account.",
      settingsAccountCheckFailed: "We couldn’t check your account",
      settingsAccountCheckFailedDescription:
        "Your data stays on this device. Check your connection and try again.",
      settingsAccountBackupUnavailable: "Backup isn’t available in this version",
      settingsAccountBackupUnavailableDescription: "Your data stays on this device.",
      settingsRemindersMobileApp: "Mobile app",
      settingsPrivacyDataDescription: "Choose which optional services ZenFlow may use.",
      settingsDataBackupReportsDescription:
        "Save a backup you can import later, or create a report.",
      settingsBackupRestoreTitle: "Backup & restore",
      settingsReportsTitle: "Reports",
      settingsReportsDescription:
        "Reports include mood, habits, focus, and gratitude. The PDF is currently in English. Reports are not backups.",
      settingsReportSpreadsheetAction: "Spreadsheet data (CSV)",
      settingsReportProgressAction: "Progress report (PDF)",
      settingsSoundDiaryRainOff: "Rain is turned off under Background sounds.",
      settingsSoundDiaryReady: "Ready to play.",
      settingsRemindersOff: "Reminders off",
      settingsDataSummary: "Mood check-ins: {moods} · habits: {habits} · focus sessions: {focus}",
      resetDataConfirmWord: "RESET",
      resetDataTypeConfirm: "Type RESET to confirm",
      resetDataScope:
        "This removes local moods, habits, focus, gratitude, journal data, queues, and settings.",
      resetDataConfirmAction: "Clear local data",
      moodEntries: "Mood entries",
      habits: "Habits",
      focus: "Focus",
      journalLockTimeout: "Journal auto-lock",
      journalLockTimeoutDesc: "Lock the journal after inactivity.",
      journalLockTimeoutImmediately: "When you leave the app",
      journalLockTimeoutOneMinute: "After one minute",
      journalLockTimeoutFiveMinutes: "After five minutes",
      journalLockTimeoutFifteenMinutes: "After fifteen minutes",
      journalLockTimeoutThirtyMinutes: "After thirty minutes",
      privacyTitle: "Privacy",
      privacyDescription: "Your data stays on device.",
      privacyAds: "Rewarded videos",
      privacyAdsHint:
        "They load only when you turn them on. Google may ask for your privacy choice when required.",
      privacyPushNotifications: "Account reminders",
      privacyPushNotificationsHint:
        "Receive reminders from your account on this device. Reminders you set on this device still work when this is off.",
      enableReminders: "Enable reminders",
      quietHours: "Quiet hours",
      quietHoursStart: "Quiet start",
      quietHoursEnd: "Quiet end",
      pushPermissionDenied: "Turn on notifications for ZenFlow in your device settings.",
      remindersNativeOnly: "To set reminders, open the ZenFlow mobile app.",
      settingsMoodCheckIns: "Mood check-ins",
      settingsMoodCheckInsDescription: "Gentle prompts to record how you feel.",
      settingsFocusReminder: "Focus reminder",
      settingsFocusReminderDescription: "One prompt at the time you choose.",
      settingsReminderChooseDay: "Choose at least one day. No reminders will be sent until you do.",
      habitRemindersManagedInHabits: "Set a reminder from the habit's own menu.",
      settingsSoundTitle: "Sound",
      settingsSoundDescription: "Choose background sounds, activity sounds, and volume.",
      settingsSoundSummaryOn: "Sound on",
      settingsSoundSummaryOff: "Muted",
      settingsSoundMaster: "App sound",
      settingsSoundMasterDesc: "Play sounds in ZenFlow.",
      settingsVibration: "Vibration",
      settingsVibrationDescription: "Brief vibration for taps and confirmations, when supported.",
      adPrivacyOptions: "Google ad privacy choices",
      adPrivacyOptionsHint: "Change or withdraw Google ad consent where required.",
      adPrivacyOptionsOpen: "Review ad choices",
      adPrivacyOptionsError: "Could not open Google ad privacy choices. Try again.",
      settingsSoundVolume: "Volume",
      settingsSoundVolumeDesc: "Sets the default level for app audio.",
      settingsSoundPreview: "Preview sound",
      settingsSoundPreviewDesc: "Play a short local preview.",
      settingsSoundAmbienceTitle: "Diary background sound",
      settingsSoundComfortTitle: "Sound style",
      settingsSoundComfortDescription:
        "Choose a sound style, then adjust individual sounds below.",
      settingsSoundProfileQuiet: "Quiet",
      settingsSoundProfileQuietDesc: "No background sounds; only quiet activity sounds.",
      settingsSoundProfileBalanced: "All sounds",
      settingsSoundProfileBalancedDesc:
        "Play background, activity, alert, and milestone sounds.",
      settingsSoundAmbientToggle: "Ambient sound",
      settingsSoundAmbientToggleDesc:
        "Play background sounds in ZenFlow, except during focus sessions.",
      settingsSoundCompletionCues: "Activity sounds",
      settingsSoundCompletionCuesDesc: "Play a quiet sound after completing an activity.",
      settingsSoundReminderCues: "In-app alert sounds",
      settingsSoundReminderCuesDesc:
        "Play timer alerts and reminder previews inside ZenFlow. This does not change phone notification sounds.",
      settingsSoundMilestoneCues: "Milestone sounds",
      settingsSoundMilestoneCuesDesc:
        "Play a sound for occasional streak and achievement milestones.",
      settingsSoundTextureTitle: "Background sounds",
      settingsSoundTextureDescription:
        "Choose which background sounds ZenFlow may play.",
      settingsSoundTextureAir: "Air",
      settingsSoundTextureWater: "Water",
      settingsSoundTextureRain: "Rain",
      settingsSoundAmbientOff: "Background sounds are off.",
      diaryAmbienceLabel: "Soft rain",
      diaryAmbiencePlay: "Play soft rain",
      diaryAmbiencePause: "Pause soft rain",
      audioLoading: "Loading...",
      audioRetry: "Retry",
      soundOn: "On",
      soundOff: "Off",
      settingsSoundAmbienceNote:
        "Play soft rain while you write in your diary. It starts only when you press play.",
      notificationSound: "Notification sound",
      notificationSoundDescription: "Choose sound for reminders",
      soundDefault: "Default",
      soundDefaultDesc: "System notification sound",
      soundGentle: "Gentle",
      soundGentleDesc: "Vibration only",
      soundSilent: "Silent",
      soundSilentDesc: "No sound or vibration",
      notificationSystemSettingsTitle: "If reminders are silent",
      notificationSystemSettingsWebDescription:
        "Browser and OS notification settings can mute or quiet reminders. App sounds stay local and tap-started.",
      notificationSystemSettingsAndroidDescription:
        "Your phone’s sound, vibration, and notification settings can silence or hide reminders.",
      notificationSystemSettingsIosDescription:
        "Your iPhone or iPad’s notification settings and Focus modes can silence or hide reminders.",
      notificationSystemSettingsDesktopDescription:
        "Computer browser and device notification settings keep final control over reminder delivery and sound.",
      notificationSoundUpdateFailed:
        "ZenFlow could not apply this reminder sound. Your previous sound is still selected. Try again.",
      notificationSoundUpdateUncertain:
        "ZenFlow could not finish changing the reminder sound. Check the selected sound and try again.",
      openGooglePlayFailed: "Could not open Google Play. Try again.",
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

vi.mock("@/hooks/useMotionPreference", () => ({
  useMotionPreference: () => ({ ...interactionPreferencesMock.motion }),
}));
vi.mock("@/lib/motionPreference", () => ({
  trySetReduceMotion: interactionPreferencesMock.trySetReduceMotion,
}));
vi.mock("@/hooks/useHapticsPreference", () => ({
  useHapticsPreference: () => ({ ...interactionPreferencesMock.haptics }),
}));
vi.mock("@/lib/hapticsPreference", () => ({
  trySetHapticsEnabled: interactionPreferencesMock.trySetHapticsEnabled,
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
        previousThemeCustomization: themeStoreMock.getPreviousCustomization(),
        setTheme: themeStoreMock.setTheme,
        setThemeCustomization: themeStoreMock.setThemeCustomization,
        resetThemeCustomization: themeStoreMock.resetThemeCustomization,
        undoThemeCustomization: themeStoreMock.undoThemeCustomization,
      }),
    {
      getState: () => ({
        theme: themeStoreMock.state.theme,
        appliedTheme: themeStoreMock.state.appliedTheme,
        themeCustomization: themeStoreMock.state.themeCustomization,
        previousThemeCustomization: themeStoreMock.getPreviousCustomization(),
        setTheme: themeStoreMock.setTheme,
        setThemeCustomization: themeStoreMock.setThemeCustomization,
        resetThemeCustomization: themeStoreMock.resetThemeCustomization,
        undoThemeCustomization: themeStoreMock.undoThemeCustomization,
      }),
    }
  ),
}));

vi.mock("@/stores", () => ({
  useAppStore: (selector: (s: { hasValidSession: boolean | null }) => unknown) =>
    selector({ hasValidSession: appStoreMock.hasValidSession }),
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
  get supabase() {
    return supabaseClientMock.client;
  },
  getCurrentSessionUserId: settingsOwnerMock.getCurrentSessionUserId,
}));

vi.mock("@/components/settings/account-section/useAccountAuth", () => ({
  useAccountAuth: () => accountAuthMock,
}));

vi.mock("@/components/settings/account-section/useDeleteAccount", () => ({
  useDeleteAccount: () => deleteAccountMock,
}));

vi.mock("@/components/settings/data-section/useDataExport", () => ({
  useDataExport: (options: { setDataStatus: (status: string | null) => void }) => {
    dataStatusHarness.setDataStatus = options.setDataStatus;
    return dataExportMock;
  },
}));

vi.mock("@/components/settings/data-section/useDataImport", () => ({
  useDataImport: () => dataImportMock,
}));

vi.mock("@/lib/accountService", () => accountServiceMock);

vi.mock("@/hooks/usePwaInstall", () => ({
  usePwaInstall: () => ({ canInstall: false, isInstalled: false, promptInstall: vi.fn() }),
}));

vi.mock("@/hooks/useFontScale", () => ({
  FONT_SCALE_LEVELS: [0.85, 0.9, 1, 1.1, 1.2, 1.3, 1.5],
  useFontScale: () => ({ scale: 1, setFontScale: vi.fn() }),
}));

vi.mock("@/features/journal", () => ({
  hasPersistentJournalProtection: journalProtectionMock.hasPersistentJournalProtection,
  LOCK_TIMEOUT_OPTIONS: [
    { ms: 0, label: "Immediately" },
    { ms: 60000, label: "1 minute" },
    { ms: 300000, label: "5 minutes" },
    { ms: 900000, label: "15 minutes" },
    { ms: 1800000, label: "30 minutes" },
  ],
  setAutoLockMs: journalFeatureMock.setAutoLockMs,
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
  buildNotificationChannelCopy: vi.fn(() => ({})),
  NOTIFICATION_SOUNDS: [
    {
      id: "default",
      labelKey: "soundDefault",
      description: "System notification sound",
      channelId: "zenflow_default_v3",
      sound: "default",
      vibrate: true,
      importance: 3,
    },
    {
      id: "gentle",
      labelKey: "soundGentle",
      description: "Vibration only",
      channelId: "zenflow_gentle_v3",
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

vi.mock("@/contexts/AdContext", () => ({
  useAds: () => ({
    adsSupported: adContextMock.adsSupported,
    adsAvailable: false,
    canShowRewarded: false,
    remainingToday: 0,
    googleConsentReady: false,
    privacyOptionsRequired: adContextMock.privacyOptionsRequired,
    openAdPrivacyOptions: adContextMock.openAdPrivacyOptions,
    watchRewardedAd: vi.fn(),
    rewardTreats: 0,
    rewardXp: 0,
    setCurrentMood: vi.fn(),
  }),
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: capacitorAppMock.addListener,
  },
}));

vi.mock("@/lib/appUpdateManager", () => appUpdateManagerMock);

vi.mock("@/lib/versionCheck", () => versionCheckMock);

function createSettingsControls() {
  return {
    userName: "Avery",
    onNameChange: vi.fn(),
    onResetData: vi.fn(),
    reminders: {
      enabled: true,
      moodCheckInsEnabled: true,
      focusReminderEnabled: true,
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
    privacy: {
      noTracking: false,
      analytics: false,
      consentShown: true,
      adConsent: false,
      pushNotifications: false,
    },
    onPrivacyChange: vi.fn(),
    onOpenWidgetSettings: vi.fn(),
  };
}

describe("SettingsPage", () => {
  beforeEach(() => {
    themeStoreMock.state.theme = "paper";
    themeStoreMock.state.appliedTheme = "paper";
    themeStoreMock.state.themeCustomization = { ...themeStoreMock.defaultCustomization };
    themeStoreMock.resetPreviousCustomization();
    themeStoreMock.setTheme.mockClear();
    themeStoreMock.setThemeCustomization.mockClear();
    themeStoreMock.resetThemeCustomization.mockClear();
    themeStoreMock.undoThemeCustomization.mockClear();
    delete document.documentElement.dataset.themeAccent;
    delete document.documentElement.dataset.themeContrast;
    languageContextMock.language = "en";
    languageContextMock.setLanguage.mockClear();
    platformMock.isNative = false;
    platformMock.isAndroid = false;
    platformMock.isIos = false;
    platformMock.isDesktopViewport = false;
    platformMock.platform = "web";
    journalProtectionMock.hasProtection = false;
    journalProtectionMock.hasPersistentJournalProtection.mockReset();
    journalProtectionMock.hasPersistentJournalProtection.mockImplementation(
      async () => journalProtectionMock.hasProtection,
    );
    journalFeatureMock.setAutoLockMs.mockReset();
    journalFeatureMock.setAutoLockMs.mockReturnValue(true);
    delete (window as typeof window & { __TAURI__?: unknown }).__TAURI__;
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    appStoreMock.hasValidSession = true;
    supabaseClientMock.client = {};
    localNotificationsMock.checkPermissions.mockReset();
    localNotificationsMock.requestPermissions.mockReset();
    localNotificationsMock.getPending.mockReset();
    localNotificationsMock.cancel.mockReset();
    localNotificationsMock.schedule.mockReset();
    localNotificationsMock.createChannel.mockReset();
    localNotificationsMock.listChannels.mockReset();
    localNotificationsMock.registerActionTypes.mockReset();
    localNotificationsMock.addListener.mockReset();
    notificationSoundsMock.state.currentChannelId = "zenflow_default_v3";
    notificationSoundsMock.updateNotificationSound.mockClear();
    notificationSoundsMock.initializeNotificationChannels.mockClear();
    capacitorAppMock.pauseListeners.length = 0;
    capacitorAppMock.remove.mockClear();
    capacitorAppMock.addListener.mockClear();
    audioManagerMock.state.muted = false;
    audioManagerMock.state.volume = 0.3;
    audioManagerMock.state.canPlayFeedback = true;
    audioManagerMock.initAudioManager.mockClear();
    audioManagerMock.isMuted.mockClear();
    audioManagerMock.getVolume.mockClear();
    audioManagerMock.setMuted.mockClear();
    audioManagerMock.setVolume.mockClear();
    audioManagerMock.setAudioEnabled.mockClear();
    audioManagerMock.playNotification.mockClear();
    audioManagerMock.playNotificationPreview.mockClear();
    audioManagerMock.getAudioSettings.mockClear();
    audioManagerMock.subscribeAudioSettings.mockClear();
    interactionPreferencesMock.motion.reduceMotion = false;
    interactionPreferencesMock.haptics.enabled = false;
    interactionPreferencesMock.trySetReduceMotion.mockClear();
    interactionPreferencesMock.trySetHapticsEnabled.mockClear();
    accountAuthMock.handleSignOut.mockClear();
    accountAuthMock.handleDiscardPendingAndSignOut.mockClear();
    accountAuthMock.handleProvider.mockClear();
    accountAuthMock.handleLinkProvider.mockClear();
    accountAuthMock.authStatus = null;
    accountAuthMock.sessionUserId = "user-1";
    accountAuthMock.sessionAccountLabel = "avery@example.com";
    accountAuthMock.sessionDisplayName = "Avery";
    accountAuthMock.linkedProviderIds = [];
    accountAuthMock.enabledProviders = [];
    accountAuthMock.hasSession = true;
    accountAuthMock.sessionCheckState = "signed-in";
    accountAuthMock.refreshSession.mockClear();
    accountAuthMock.signingInProvider = null;
    accountAuthMock.linkingProvider = null;
    accountAuthMock.isSigningIn = false;
    accountAuthMock.isSigningOut = false;
    accountAuthMock.signOutBlockReason = null;
    dataExportMock.handleExport.mockClear();
    dataExportMock.handleExportCSV.mockClear();
    dataExportMock.handleExportPDF.mockClear();
    accountServiceMock.updateProfileName.mockReset();
    accountServiceMock.updateProfileName.mockResolvedValue(true);
    settingsOwnerMock.currentOwnerUserId = "user-1";
    settingsOwnerMock.getCurrentSessionUserId.mockReset();
    settingsOwnerMock.getCurrentSessionUserId.mockImplementation(
      async () => settingsOwnerMock.currentOwnerUserId
    );
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
    appUpdateManagerMock.checkForAppUpdate.mockReset();
    appUpdateManagerMock.openGooglePlayStore.mockReset();
    appUpdateManagerMock.openGooglePlayStore.mockResolvedValue(true);
    adContextMock.privacyOptionsRequired = false;
    adContextMock.adsSupported = false;
    adContextMock.openAdPrivacyOptions.mockReset();
    adContextMock.openAdPrivacyOptions.mockResolvedValue(true);
    dataStatusHarness.setDataStatus = null;
    deleteAccountMock.showDeleteConfirm = false;
    deleteAccountMock.deleteStatus = null;
    deleteAccountMock.deleteConfirmInput = "";
    deleteAccountMock.deleteConfirmMatches = false;
    deleteAccountMock.isDeletingAccount = false;
    deleteAccountMock.setShowDeleteConfirm.mockClear();
    deleteAccountMock.openDeleteConfirmation.mockClear();
    deleteAccountMock.closeDeleteConfirmation.mockClear();
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
    window.history.replaceState({}, "", "/people-first-app/?nav=v2&navLayout=phone");
  });

  it("renders a passive V2 settings overview when controls are not wired", () => {
    render(<SettingsPage />);

    expect(screen.getByTestId("settings-page")).toHaveAttribute("data-visual-role", "settings");
    expect(screen.getByTestId("settings-page")).toHaveClass("focus-visible:!outline-none");
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
      "Account & backup"
    );
    expect(screen.getByTestId("settings-module-card-account")).not.toHaveAttribute("aria-current");
    expect(screen.getByTestId("settings-module-card-account")).not.toHaveAttribute("aria-controls");
    expect(screen.getByTestId("settings-module-card-account")).toBeDisabled();
    expect(screen.getByTestId("settings-module-card-account")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("settings-module-card-account")).toHaveTextContent(
      "Signed in"
    );
    expect(screen.queryByTestId("settings-module-card-modules")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-module-card-appearance")).not.toHaveAttribute(
      "aria-current"
    );
    expect(screen.getByTestId("settings-module-appearance")).toHaveAttribute(
      "data-visual-role",
      "mind"
    );
    expect(screen.queryByTestId("settings-module-notifications")).toBeNull();
    expect(screen.getByTestId("settings-module-privacy")).toHaveAttribute(
      "data-visual-role",
      "rest"
    );
    expect(screen.getByTestId("settings-page")).toHaveAttribute("data-controls-wired", "false");
  });

  it.each([
    [
      "backend unavailable",
      null,
      true,
      "Backup isn’t available in this version",
      "Your data stays on this device.",
    ],
    [
      "signed out",
      {},
      false,
      "You’re not signed in",
      "Your data stays on this device. Sign in to back it up and use it on your other devices.",
    ],
    [
      "checking",
      {},
      null,
      "Checking your account…",
      "Your data stays on this device while ZenFlow checks your account.",
    ],
    [
      "signed in",
      {},
      true,
      "Signed in",
      "Your account is connected. If ZenFlow can’t save an update online, your changes stay on this device.",
    ],
  ] as const)(
    "shows the truthful account state for %s",
    (_name, client, session, expectedStatus, expectedDescription) => {
      supabaseClientMock.client = client;
      appStoreMock.hasValidSession = session;

      render(<SettingsPage controls={createSettingsControls()} />);

      const card = screen.getByTestId("settings-module-card-account");
      expect(card).toHaveTextContent(expectedStatus);
      expect(card).toHaveTextContent(expectedDescription);
    },
  );

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
    expect(screen.getByTestId("settings-module-card-appearance")).toHaveAttribute(
      "aria-controls",
      "settings-module-panel-appearance"
    );
  });

  it("shows only actionable settings groups on web", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    const cards = screen.getAllByTestId(/^settings-module-card-/);
    expect(cards.map((card) => card.dataset.testid)).toEqual([
      "settings-module-card-account",
      "settings-module-card-appearance",
      "settings-module-card-sound",
      "settings-module-card-privacy",
    ]);
    expect(cards.map((card) => card.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Account & backup"),
        expect.stringContaining("Appearance & accessibility"),
        expect.stringContaining("Privacy & data"),
      ])
    );
    expect(screen.queryByTestId("settings-module-card-notifications")).toBeNull();
    expect(screen.queryByTestId("settings-module-card-about")).toBeNull();
  });

  it("shows Reminders as the fifth actionable destination on native", () => {
    platformMock.isNative = true;
    render(<SettingsPage controls={createSettingsControls()} />);

    expect(screen.getAllByTestId(/^settings-module-card-/)).toHaveLength(5);
    expect(screen.getByTestId("settings-module-card-notifications")).toBeInTheDocument();
  });

  it("renders the privacy data count from one localized template", () => {
    const controls = createSettingsControls();
    controls.moods = [{ id: "mood-1" }, { id: "mood-2" }] as never[];
    controls.habits = [{ id: "habit-1" }] as never[];
    controls.focusSessions = [{ id: "focus-1" }, { id: "focus-2" }, { id: "focus-3" }] as never[];

    render(<SettingsPage controls={controls} />);

    expect(screen.getByTestId("settings-module-card-privacy")).toHaveTextContent(
      "Mood check-ins: 2 · habits: 1 · focus sessions: 3"
    );
  });

  it("does not render an empty Privacy panel when no optional privacy control is available", async () => {
    render(
      <SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "privacy" }} />
    );

    expect(screen.queryByTestId("settings-v2-panel-privacy")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-panel-data")).toBeInTheDocument();
  });

  it("uses overview, URL-backed detail, and back navigation on mobile", async () => {
    window.history.replaceState({}, "", "/people-first-app/settings?nav=v2&navLayout=phone");
    render(<SettingsPage controls={createSettingsControls()} />);

    const workspace = screen.getByTestId("settings-page-workspace");
    expect(workspace).toHaveAttribute("data-mobile-view", "overview");

    fireEvent.click(screen.getByTestId("settings-module-card-account"));
    expect(workspace).toHaveAttribute("data-mobile-view", "detail");
    expect(window.location.search).toContain("settingsSection=account");

    fireEvent.click(screen.getByTestId("settings-mobile-back"));
    await waitFor(() => expect(workspace).toHaveAttribute("data-mobile-view", "overview"));
    expect(window.location.search).not.toContain("settingsSection");
  });

  it("makes an exiting mobile settings surface inert before removing it", () => {
    const media = installSettingsMotionMediaQuery({
      isMobileWorkspace: true,
      prefersReducedMotion: false,
    });
    try {
      render(<SettingsPage controls={createSettingsControls()} />);

      const overviewSurface = screen
        .getByTestId("settings-module-list")
        .closest<HTMLElement>("[data-settings-motion-surface]");
      expect(overviewSurface).not.toBeNull();

      fireEvent.click(screen.getByTestId("settings-module-card-account"));

      expect(overviewSurface).toHaveAttribute("inert");
      expect(overviewSurface).toHaveAttribute("aria-hidden", "true");
      expect(overviewSurface).toHaveClass("pointer-events-none");
    } finally {
      media.restore();
    }
  });

  it("does not expose aria-controls references to unmounted mobile panels", () => {
    const media = installSettingsMotionMediaQuery({
      isMobileWorkspace: true,
      prefersReducedMotion: false,
    });
    try {
      render(<SettingsPage controls={createSettingsControls()} />);

      for (const card of screen.getAllByTestId(/^settings-module-card-/)) {
        const targetId = card.getAttribute("aria-controls");
        if (targetId) expect(document.getElementById(targetId)).toBeInTheDocument();
      }
    } finally {
      media.restore();
    }
  });

  it("labels a mobile detail region with its own stable section heading", async () => {
    const media = installSettingsMotionMediaQuery({
      isMobileWorkspace: true,
      prefersReducedMotion: false,
    });
    try {
      render(<SettingsPage controls={createSettingsControls()} />);
      fireEvent.click(screen.getByTestId("settings-module-card-account"));

      const panel = await screen.findByTestId("settings-module-panel-account");
      expect(panel).toHaveAttribute("aria-labelledby", "settings-module-panel-heading-account");
      expect(
        screen.getByRole("heading", { level: 2, name: "Account & backup" })
      ).toBeInTheDocument();
    } finally {
      media.restore();
    }
  });

  it("opens the account module from a settingsSection query and keeps the detail URL", () => {
    window.history.replaceState(
      {},
      "",
      "/people-first-app/settings?nav=v2&navLayout=phone&settingsSection=account"
    );

    render(<SettingsPage controls={createSettingsControls()} />);

    expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
      "data-selected-section",
      "account"
    );
    expect(screen.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByTestId("settings-v2-panel-account")).toBeInTheDocument();
    expect(window.location.search).toContain("settingsSection=account");
    expect(window.location.search).toContain("nav=v2");
  });

  it("normalizes an unavailable Web reminders deep link to Appearance", async () => {
    window.history.replaceState(
      {},
      "",
      "/people-first-app/settings?nav=v2&navLayout=phone&settingsSection=notifications"
    );

    render(<SettingsPage controls={createSettingsControls()} />);

    expect(screen.getByTestId("settings-v2-panel-appearance")).toBeInTheDocument();
    await waitFor(() =>
      expect(window.location.search).toContain("settingsSection=appearance")
    );
    expect(window.location.search).not.toContain("settingsSection=notifications");
    expect(window.location.search).toContain("nav=v2");
  });

  it("restores the URL-consistent Appearance panel and focus after desktop history back", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    try {
      window.history.replaceState({}, "", "/people-first-app/settings?nav=v2&navLayout=desktop");
      render(<SettingsPage controls={createSettingsControls()} />);

      fireEvent.click(screen.getByTestId("settings-module-card-account"));
      expect(window.location.search).toContain("settingsSection=account");

      window.history.replaceState({}, "", "/people-first-app/settings?nav=v2&navLayout=desktop");
      window.dispatchEvent(new PopStateEvent("popstate"));

      await waitFor(() =>
        expect(screen.getByTestId("settings-module-card-appearance")).toHaveAttribute(
          "aria-current",
          "page"
        )
      );
      expect(screen.getByTestId("settings-module-card-account")).not.toHaveAttribute(
        "aria-current"
      );
      expect(screen.getByTestId("settings-module-panel-appearance")).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByTestId("settings-module-card-appearance")).toHaveFocus()
      );
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    }
  });

  it("does not push duplicate history entries when the active desktop Settings card is clicked again", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    const pushState = vi.spyOn(window.history, "pushState");

    try {
      render(<SettingsPage controls={createSettingsControls()} />);

      const appearanceCard = screen.getByTestId("settings-module-card-appearance");
      fireEvent.click(appearanceCard);
      fireEvent.click(appearanceCard);
      expect(pushState).not.toHaveBeenCalled();

      const accountCard = screen.getByTestId("settings-module-card-account");
      fireEvent.click(accountCard);
      fireEvent.click(accountCard);
      expect(pushState).toHaveBeenCalledTimes(1);

      window.history.replaceState({}, "", "/people-first-app/settings?nav=v2&navLayout=desktop");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await waitFor(() => expect(appearanceCard).toHaveAttribute("aria-current", "page"));
    } finally {
      pushState.mockRestore();
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    }
  });
  it("opens appearance customization first when Settings controls are wired", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
      "data-selected-section",
      "appearance"
    );
    expect(screen.getByTestId("settings-module-card-appearance")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByTestId("settings-v2-panel-appearance")).toBeInTheDocument();
    expectDeckInsideModulePanel("appearance");
  });

  it("keeps one Settings heading in the appearance detail hierarchy", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    expect(screen.getAllByRole("heading", { name: "Settings" })).toHaveLength(1);
  });

  it("keeps the Text Size control in Appearance and out of the support footer", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    const textSize = screen.getByRole("slider", { name: "Text Size" });
    expect(textSize).toHaveClass("settings-v2-range-control", "h-11");

    expect(screen.getByTestId("settings-support-footer")).not.toContainElement(textSize);
  });

  it("keeps profile, account, and shared sync status together in Account & backup", () => {
    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-module-card-account"));

    expect(screen.getByTestId("settings-page")).toHaveAttribute("data-controls-wired", "true");
    expect(screen.getByTestId("settings-module-list")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-section-switcher")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
      "data-selected-section",
      "account"
    );
    expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
      "id",
      "settings-v2-control-deck"
    );
    expect(screen.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-controls",
      "settings-module-panel-account"
    );
    expect(screen.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expectDeckInsideModulePanel("account");
    expect(screen.getByTestId("settings-v2-panel-profile")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-panel-account")).toBeInTheDocument();
    expect(screen.getByTestId("settings-module-card-account")).toHaveTextContent(
      "Account & backup"
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Account & backup" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Avery")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-status-overview")).toBeInTheDocument();
    expect(screen.getByTestId("sync-health-card")).toBeInTheDocument();
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

  it("does not show the retired weekly digest or an empty connected-methods section", () => {
    render(
      <SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "account" }} />
    );

    const accountPanel = screen.getByTestId("settings-v2-panel-account");
    expect(within(accountPanel).queryByText("Connected sign-in methods")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-weekly-digest")).not.toBeInTheDocument();
    expect(within(accountPanel).queryByText(/Weekly Progress/i)).not.toBeInTheDocument();
  });

  it("shows connected sign-in methods only when the account has a provider", () => {
    accountAuthMock.linkedProviderIds = ["google"];

    render(
      <SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "account" }} />
    );

    const accountPanel = screen.getByTestId("settings-v2-panel-account");
    expect(within(accountPanel).getByText("Connected sign-in methods")).toBeInTheDocument();
    expect(within(accountPanel).getByText("Google")).toBeInTheDocument();
  });

  it("does not expose sign-in actions while signed-in account details are still loading", () => {
    appStoreMock.hasValidSession = true;
    accountAuthMock.hasSession = false;
    accountAuthMock.sessionCheckState = "checking";
    accountAuthMock.enabledProviders = [
      {
        id: "google",
        labelKey: "continueWithGoogle",
        loadingLabelKey: "connectingGoogle",
        fallbackLabel: "Continue with Google",
        fallbackLoadingLabel: "Connecting to Google...",
      },
    ];

    render(
      <SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "account" }} />
    );

    const accountPanel = screen.getByTestId("settings-v2-panel-account");
    expect(accountPanel).toHaveTextContent("Checking your account…");
    expect(accountPanel).toHaveTextContent(
      "Your data stays on this device while ZenFlow checks your account."
    );
    expect(screen.queryByTestId("auth-provider-button")).not.toBeInTheDocument();
  });

  it("offers a safe retry when signed-in account details cannot be checked", () => {
    appStoreMock.hasValidSession = true;
    accountAuthMock.hasSession = false;
    accountAuthMock.sessionCheckState = "error";
    accountAuthMock.enabledProviders = [
      {
        id: "google",
        labelKey: "continueWithGoogle",
        loadingLabelKey: "connectingGoogle",
        fallbackLabel: "Continue with Google",
        fallbackLoadingLabel: "Connecting to Google...",
      },
    ];

    render(
      <SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "account" }} />
    );

    const accountPanel = screen.getByTestId("settings-v2-panel-account");
    expect(accountPanel).toHaveTextContent("We couldn’t check your account");
    expect(accountPanel).toHaveTextContent(
      "Your data stays on this device. Check your connection and try again."
    );
    expect(screen.queryByTestId("auth-provider-button")).not.toBeInTheDocument();

    fireEvent.click(within(accountPanel).getByRole("button", { name: "Retry" }));
    expect(accountAuthMock.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("keeps a retryable account error when the global boolean cannot prove sign-out", () => {
    appStoreMock.hasValidSession = false;
    accountAuthMock.hasSession = false;
    accountAuthMock.sessionCheckState = "error";
    accountAuthMock.enabledProviders = [
      {
        id: "google",
        labelKey: "continueWithGoogle",
        loadingLabelKey: "connectingGoogle",
        fallbackLabel: "Continue with Google",
        fallbackLoadingLabel: "Connecting to Google...",
      },
    ];

    render(
      <SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "account" }} />
    );

    expect(screen.getByTestId("settings-v2-account-check-error")).toHaveTextContent(
      "We couldn’t check your account"
    );
    expect(screen.queryByTestId("auth-provider-button")).not.toBeInTheDocument();
  });

  it("keeps signed-out account actions without a duplicate sync-health surface", () => {
    appStoreMock.hasValidSession = false;
    accountAuthMock.hasSession = false;
    accountAuthMock.sessionCheckState = "signed-out";
    accountAuthMock.enabledProviders = [
      {
        id: "google",
        labelKey: "continueWithGoogle",
        loadingLabelKey: "connectingGoogle",
        fallbackLabel: "Continue with Google",
        fallbackLoadingLabel: "Connecting to Google...",
      },
    ];

    render(
      <SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "account" }} />
    );

    const accountPanel = screen.getByTestId("settings-v2-panel-account");
    expect(accountPanel).toHaveTextContent("You’re not signed in");
    expect(accountPanel).toHaveTextContent(
      "Your data stays on this device. Sign in to back it up and use it on your other devices."
    );
    expect(accountPanel).not.toHaveTextContent(/expired|again/i);
    expect(screen.getByTestId("auth-provider-button")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-status-overview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sync-health-card")).not.toBeInTheDocument();
    expect(screen.queryByText("Connected sign-in methods")).not.toBeInTheDocument();
  });

  it("shows backend-unavailable guidance once in the detail without sync diagnostics", () => {
    supabaseClientMock.client = null;

    render(
      <SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "account" }} />
    );

    const accountPanel = screen.getByTestId("settings-v2-panel-account");
    expect(within(accountPanel).getAllByText("Backup isn’t available in this version")).toHaveLength(1);
    expect(within(accountPanel).getAllByText("Your data stays on this device.")).toHaveLength(1);
    expect(screen.queryByTestId("settings-status-overview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sync-health-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("device-sessions-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("auth-provider-button")).not.toBeInTheDocument();
  });

  it("uses a calm tokenized profile save action instead of a solid accent block", () => {
    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-module-card-account"));

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

  it("does not present the legacy Friend default as a name the user chose", () => {
    const controls = {
      ...createSettingsControls(),
      userName: "Friend",
      userNameCustom: false,
      initialOpenSection: "account",
    };
    const view = render(<SettingsPage controls={controls} />);

    expect(screen.getByLabelText("Your name")).toHaveValue("");
    expect(screen.getByLabelText("Your name")).toHaveAttribute("placeholder", "Enter your name");

    view.rerender(<SettingsPage controls={{ ...controls, userNameCustom: true }} />);
    expect(screen.getByLabelText("Your name")).toHaveValue("Friend");
  });

  it("keeps Appearance to user-recognizable controls without advanced style machinery", () => {
    render(
      <SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "appearance" }} />
    );

    expect(screen.queryByTestId("settings-v2-advanced-appearance-details")).toBeNull();
    expect(screen.queryByTestId("settings-v2-comfort-details")).toBeNull();
    expect(screen.queryByTestId("settings-v2-appearance-actions")).toBeNull();
    expect(screen.queryByText("Mood palette")).toBeNull();
    expect(within(screen.getByTestId("settings-v2-accent-field")).getByText(
      "Color for buttons, selections, and highlights.",
    )).toBeInTheDocument();
  });

  it("applies an accent immediately and offers only a transient undo", () => {
    render(
      <SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "appearance" }} />
    );

    fireEvent.click(screen.getByTestId("settings-v2-accent-choice-blue"));

    expect(themeStoreMock.setThemeCustomization).toHaveBeenLastCalledWith({
      schemaVersion: 1,
      accentFamily: "blue",
      highContrast: false,
    });
    expect(screen.getByRole("status")).toHaveTextContent("Changed");
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();
  });

  it("keeps help, legal, version, install, and update actions in a quiet footer", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    expect(screen.queryByTestId("settings-module-card-about")).toBeNull();
    expect(screen.getByTestId("settings-support-footer")).toHaveTextContent(/ZenFlow/i);
  });

  it("saves profile name only after a scoped dirty change", async () => {
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);
    fireEvent.click(screen.getByTestId("settings-module-card-account"));

    const nameInput = screen.getByLabelText("Your name");
    const saveButton = screen.getByTestId("settings-v2-profile-save");

    fireEvent.change(nameInput, { target: { value: "Avery Stone" } });
    expect(saveButton).not.toBeDisabled();

    fireEvent.keyDown(nameInput, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(controls.onNameChange).toHaveBeenCalledWith("Avery Stone"));
    expect(accountServiceMock.updateProfileName).toHaveBeenCalledWith("user-1", "Avery Stone");
    await waitFor(() => expect(saveButton).toBeDisabled());
  });

  it("ignores account A's delayed profile completion after account B becomes active", async () => {
    const deferred = createDeferred<boolean>();
    accountServiceMock.updateProfileName.mockReturnValueOnce(deferred.promise);
    const controls = createSettingsControls();
    const view = render(<SettingsPage controls={controls} />);
    fireEvent.click(screen.getByTestId("settings-module-card-account"));

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Avery Updated" },
    });
    fireEvent.click(screen.getByTestId("settings-v2-profile-save"));

    await waitFor(() => {
      expect(controls.onNameChange).toHaveBeenCalledWith("Avery Updated");
      expect(accountServiceMock.updateProfileName).toHaveBeenCalledWith("user-1", "Avery Updated");
    });

    settingsOwnerMock.currentOwnerUserId = "user-2";
    const accountBControls = { ...controls, userName: "Bailey B" };
    view.rerender(<SettingsPage controls={accountBControls} />);

    await act(async () => {
      deferred.resolve(false);
      await deferred.promise;
    });

    expect(screen.queryByText("Saved on this device")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Bailey B")).toBeInTheDocument();
    expect(controls.onNameChange).toHaveBeenCalledTimes(1);
  });

  it("keeps data export primary actions tonal instead of louder than the Settings panel", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));

    const exportButton = screen.getByTestId("settings-v2-export-json");
    const exportClassName = exportButton.getAttribute("class") || "";

    expect(exportButton).toHaveAccessibleName("Save backup");
    expect(exportClassName).toContain("bg-[hsl(var(--settings-v2-accent)/0.14)]");
    expect(exportClassName).not.toContain("bg-[hsl(var(--settings-v2-accent))]");
  });

  it("separates restorable backups from reports inside Privacy & data", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));

    const dataPanel = screen.getByTestId("settings-v2-panel-data");
    const backupRegion = screen.getByRole("region", { name: "Backup & restore" });
    const reportsRegion = screen.getByRole("region", { name: "Reports" });

    expect(dataPanel).toHaveTextContent("Backups & reports");
    expect(dataPanel).not.toHaveTextContent("Data & Privacy");
    expect(within(backupRegion).getByTestId("settings-v2-export-json")).toHaveAccessibleName(
      "Save backup"
    );
    expect(within(backupRegion).getByTestId("settings-v2-import")).toHaveAccessibleName(
      "Import backup"
    );
    expect(within(backupRegion).getByTestId("settings-v2-import-options")).toBeInTheDocument();
    expect(within(reportsRegion).getByTestId("settings-v2-export-csv")).toHaveAccessibleName(
      "Spreadsheet data (CSV)"
    );
    expect(within(reportsRegion).getByTestId("settings-v2-export-pdf")).toHaveAccessibleName(
      "Progress report (PDF)"
    );
    expect(reportsRegion).toHaveTextContent("Reports are not backups.");
  });

  it("uses quiet tokenized surfaces for real privacy controls and import options", () => {
    adContextMock.adsSupported = true;
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));

    for (const testId of ["settings-v2-ad-consent"]) {
      const row = screen.getByTestId(testId);
      expect(row).toHaveAttribute("data-surface-weight", "quiet");
      expect(row.className).toContain("border-transparent");
      expect(within(row).getByRole("switch")).toHaveAccessibleName();
    }

    const importOptions = screen.getByTestId("settings-v2-import-options");
    expect(importOptions.className).toContain("border-t");
    expect(importOptions.className).toContain("pt-3");
    expect(importOptions.className).toContain(
      "border-[hsl(var(--settings-v2-border)/0.24)]"
    );
    expect(importOptions.className).not.toContain("border-transparent");
    expect(within(importOptions).queryByRole("group", { name: "How to import" })).toBeNull();
  });

  it("keeps backup and report actions wired to their original handlers", () => {
    render(
      <SettingsPage
        controls={{ ...createSettingsControls(), initialOpenSection: "privacy" }}
      />
    );

    expect(screen.getByRole("region", { name: "Backup & restore" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Reports" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("settings-v2-export-json"));
    expect(dataExportMock.handleExport).toHaveBeenCalledTimes(1);
    expect(dataExportMock.handleExportCSV).not.toHaveBeenCalled();
    expect(dataExportMock.handleExportPDF).not.toHaveBeenCalled();
    expect(dataImportMock.handleImportClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("settings-v2-export-csv"));
    expect(dataExportMock.handleExportCSV).toHaveBeenCalledTimes(1);
    expect(dataExportMock.handleExportPDF).not.toHaveBeenCalled();
    expect(dataImportMock.handleImportClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("settings-v2-export-pdf"));
    expect(dataExportMock.handleExportPDF).toHaveBeenCalledTimes(1);
    expect(dataImportMock.handleImportClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("settings-v2-import"));
    expect(dataImportMock.handleImportClick).toHaveBeenCalledTimes(1);
  });

  it("associates every ToggleRow switch with its visible description", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    const row = screen.getByTestId("settings-v2-motion-toggle");
    const toggle = within(row).getByRole("switch", { name: "Reduce motion" });
    const descriptionId = toggle.getAttribute("aria-describedby");

    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId as string)).toHaveTextContent(
      "Limits transitions and decorative movement."
    );
  });

  it("keeps critical data errors visible until the next user action", () => {
    vi.useFakeTimers();
    try {
      render(<SettingsPage controls={createSettingsControls()} />);
      fireEvent.click(screen.getByTestId("settings-module-card-privacy"));

      act(() => {
        dataStatusHarness.setDataStatus?.("Backup could not be decrypted.");
      });
      expect(screen.getByText("Backup could not be decrypted.")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3_100);
      });
      expect(screen.getByText("Backup could not be decrypted.")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses destructive hierarchy for replace-mode import confirmation", () => {
    dataImportMock.importMode = "replace";
    dataImportMock.showImportConfirm = true;
    dataImportMock.pendingImportFile = new File(["{}"], "zenflow-backup.json", {
      type: "application/json",
    });

    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));

    const importButton = screen.getByTestId("settings-v2-import");
    const dialog = screen.getByRole("dialog", { name: "Import backup" });
    const replaceChoice = within(dialog).getByTestId("settings-v2-import-mode-replace");
    const dialogPanel = dialog.querySelector<HTMLElement>('[data-dialog-panel="true"]');
    const confirmButton = within(dialog).getAllByRole("button", {
      name: "Replace current data",
    })[1];

    expect(replaceChoice).toHaveAttribute("aria-pressed", "true");
    expect(replaceChoice.className).toContain("bg-destructive/10");
    expect(importButton.className).toContain("text-destructive");
    expect(dialog).toHaveTextContent(
      "This replaces current moods, habits, focus sessions, gratitude, and settings included in backups. Diary areas are replaced only when they are present in the backup. Protection settings for this device stay unchanged."
    );
    expect(confirmButton).toHaveClass("text-destructive");
    expect(dialogPanel).toHaveFocus();
    expect(screen.getByTestId("settings-page-control-deck")).not.toContainElement(dialog);
  });

  it("falls back to Account & backup when a removed section is requested initially", () => {
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
    expect(screen.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
      "data-selected-section",
      "account"
    );
    expectDeckInsideModulePanel("account");
    expect(screen.queryByTestId("settings-v2-panel-modules")).not.toBeInTheDocument();
  });

  it("opens the matching settings module in the fixed control deck", () => {
    const { restore, scrollIntoView } = installScrollIntoViewSpy();

    try {
      render(<SettingsPage controls={createSettingsControls()} />);

      fireEvent.click(screen.getByTestId("settings-module-card-privacy"));

      expect(screen.queryByTestId("settings-section-switcher")).not.toBeInTheDocument();
      expect(screen.getByTestId("settings-module-card-privacy")).toHaveAttribute(
        "aria-current",
        "page"
      );
      expect(screen.getByTestId("settings-page-control-deck")).toHaveAttribute(
        "data-selected-section",
        "privacy"
      );
      expectDeckInsideModulePanel("privacy");
      expect(screen.getByTestId("settings-v2-panel-data")).toBeInTheDocument();
      expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
      expect(document.querySelectorAll('[data-testid^="settings-module-panel-"]')).toHaveLength(1);
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("resets the mobile document scroll without aligning detail under the floating menu", async () => {
    const scroll = installScrollIntoViewSpy();
    const media = installSettingsMotionMediaQuery({
      isMobileWorkspace: true,
      prefersReducedMotion: false,
    });

    try {
      render(<SettingsPage controls={createSettingsControls()} />);

      fireEvent.click(screen.getByTestId("settings-module-card-privacy"));

      await screen.findByTestId("settings-module-panel-privacy");

      expect(scroll.scrollIntoView).not.toHaveBeenCalled();
      expect(scroll.scrollTo).toHaveBeenCalledWith({
        behavior: "auto",
        left: 0,
        top: 0,
      });
      expect(media.matchMedia).toHaveBeenCalledWith("(max-width: 1023px)");
      expect(media.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    } finally {
      media.restore();
      scroll.restore();
    }
  });

  it("moves keyboard focus to the selected module panel on mobile module changes", async () => {
    const scroll = installScrollIntoViewSpy();
    const media = installSettingsMotionMediaQuery({
      isMobileWorkspace: true,
      prefersReducedMotion: false,
    });

    try {
      render(<SettingsPage controls={createSettingsControls()} />);

      fireEvent.click(screen.getByTestId("settings-module-card-sound"));

      const selectedPanel = await screen.findByTestId("settings-module-panel-sound");
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

  it("keeps pending-change recovery visible and requires a second discard confirmation", () => {
    accountAuthMock.signOutBlockReason = "pending-changes";
    accountAuthMock.authStatus = "Changes are still waiting to be saved online.";

    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "account",
        }}
      />
    );

    expect(screen.getByText("Finish signing out")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(accountAuthMock.handleSignOut).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Export data" }));
    expect(dataExportMock.handleExport).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Discard changes and sign out" }));
    expect(accountAuthMock.handleDiscardPendingAndSignOut).not.toHaveBeenCalled();
    expect(screen.getByText("Discard unsaved changes and sign out?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes and sign out" }));
    expect(accountAuthMock.handleDiscardPendingAndSignOut).toHaveBeenCalledTimes(1);
  });

  it("marks the account delete confirmation action busy while deletion is running", () => {
    deleteAccountMock.showDeleteConfirm = true;
    deleteAccountMock.deleteConfirmInput = "DELETE";
    deleteAccountMock.deleteConfirmMatches = true;
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
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled();
    expect(screen.getByLabelText("Type DELETE to confirm:")).toBeDisabled();
  });

  it("does not hide an in-progress account deletion on Escape", () => {
    deleteAccountMock.showDeleteConfirm = true;
    deleteAccountMock.deleteConfirmInput = "DELETE";
    deleteAccountMock.deleteConfirmMatches = true;
    deleteAccountMock.isDeletingAccount = true;

    render(
      <SettingsPage
        controls={{ ...createSettingsControls(), initialOpenSection: "account" }}
      />
    );
    deleteAccountMock.setShowDeleteConfirm.mockClear();
    deleteAccountMock.setDeleteConfirmInput.mockClear();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(deleteAccountMock.setShowDeleteConfirm).not.toHaveBeenCalledWith(false);
    expect(deleteAccountMock.setDeleteConfirmInput).not.toHaveBeenCalledWith("");
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
  });

  it("focuses the account delete warning before its destructive input", async () => {
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

    await waitFor(() =>
      expect(screen.getByTestId("settings-v2-delete-confirmation")).toHaveFocus(),
    );
  });

  it("keeps the inline account-delete confirmation scrollable and restores its trigger", async () => {
    const { restore, scrollIntoView } = installScrollIntoViewSpy();
    const controls = createSettingsControls();
    const view = render(
      <SettingsPage controls={{ ...controls, initialOpenSection: "account" }} />
    );

    try {
      const trigger = screen.getByRole("button", { name: "Delete account" });
      trigger.focus();
      fireEvent.click(trigger);
      view.rerender(
        <SettingsPage controls={{ ...controls, initialOpenSection: "account" }} />
      );

      const confirmationInput = screen.getByLabelText("Type DELETE to confirm:");
      expect(document.body.style.position).not.toBe("fixed");
      expect(scrollIntoView).toHaveBeenCalled();

      expect(confirmationInput).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      view.rerender(
        <SettingsPage controls={{ ...controls, initialOpenSection: "account" }} />
      );

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Delete account" })).toHaveFocus()
      );
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
        "aria-current",
        "page"
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
    expect(screen.getByTestId("settings-v2-theme-choice-paper").className).toContain(
      "bg-[hsl(var(--settings-v2-accent)/0.1)]"
    );

    fireEvent.click(screen.getByTestId("settings-v2-theme-choice-ink"));
    expect(themeStoreMock.setTheme).toHaveBeenLastCalledWith("ink");
    expect(document.documentElement.dataset.theme).toBe("ink");

    fireEvent.click(screen.getByTestId("settings-v2-theme-choice-auto"));
    expect(themeStoreMock.setTheme).toHaveBeenLastCalledWith("auto");
    expect(document.documentElement.dataset.theme).toBe("paper");

    fireEvent.click(screen.getByTestId("settings-v2-theme-choice-oled"));
    expect(themeStoreMock.setTheme).toHaveBeenLastCalledWith("oled");
    expect(document.documentElement.dataset.theme).toBe("oled");
  });

  it("renders four clearly named accent choices without mood palettes", () => {
    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "appearance",
        }}
      />
    );

    expect(screen.queryByTestId("settings-v2-style-preview-card")).toBeNull();
    expect(screen.queryByTestId("settings-v2-style-choice-botanicalPulse")).toBeNull();
    const violetAccent = screen.getByTestId("settings-v2-accent-choice-violet");
    fireEvent.click(violetAccent);
    expect(violetAccent).toHaveAccessibleName("Violet");
    expect(violetAccent.querySelector('[data-swatch-kind="accent"]')).not.toBeNull();
    expect(violetAccent.querySelector('[data-swatch-kind="accent"]')).toHaveStyle({
      "--settings-v2-choice-accent": "267 48% 38%",
    });
    expect(violetAccent).toHaveTextContent("Violet");
  });

  it("applies accessibility appearance changes immediately, then resets and undoes", () => {
    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "appearance",
        }}
      />
    );

    fireEvent.click(
      within(screen.getByTestId("settings-v2-high-contrast-toggle")).getByRole("switch", {
        name: "High contrast",
      })
    );
    expect(themeStoreMock.setThemeCustomization).toHaveBeenLastCalledWith(
      expect.objectContaining({ highContrast: true })
    );

    fireEvent.click(screen.getByTestId("settings-v2-appearance-more"));
    fireEvent.click(screen.getByTestId("settings-v2-style-reset"));
    expect(themeStoreMock.resetThemeCustomization).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
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
    const blueChoice = screen.getByTestId("settings-v2-accent-choice-blue");
    const moreAction = screen.getByTestId("settings-v2-appearance-more");

    expect(appearanceArticle).toHaveAttribute("data-active", "true");
    expect(appearanceModule).toHaveAttribute("data-interaction-surface", "settings-module");
    expect(appearanceModule.className).toContain("active:translate-y-[1px]");
    expect(blueChoice).toHaveAttribute("data-interaction-surface", "settings-choice");
    expect(blueChoice.className).toContain("active:translate-y-[1px]");
    expect(screen.queryByTestId("settings-v2-style-reset")).toBeNull();
    expect(moreAction).toHaveAttribute("aria-haspopup", "menu");
    expect(moreAction).toHaveAttribute("aria-expanded", "false");
    expect(moreAction).not.toHaveAttribute("aria-controls");
  });

  it("uses a keyboard-safe disclosure for the single appearance reset action", async () => {
    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "appearance",
        }}
      />
    );

    const trigger = screen.getByTestId("settings-v2-appearance-more");
    expect(trigger).not.toHaveAttribute("aria-controls");
    fireEvent.click(trigger);

    const reset = screen.getByTestId("settings-v2-style-reset");
    expect(trigger).toHaveAttribute("aria-controls", "settings-v2-appearance-more-menu");
    expect(document.getElementById("settings-v2-appearance-more-menu")).toBeInTheDocument();
    await waitFor(() => expect(reset).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByTestId("settings-v2-style-reset")).toBeNull());
    expect(trigger).not.toHaveAttribute("aria-controls");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes the appearance action menu when keyboard focus moves outside it", async () => {
    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "appearance",
        }}
      />
    );

    fireEvent.click(screen.getByTestId("settings-v2-appearance-more"));
    await waitFor(() => expect(screen.getByTestId("settings-v2-style-reset")).toHaveFocus());

    const themeChoice = screen.getByTestId("settings-v2-theme-choice-paper");
    themeChoice.focus();
    fireEvent.focusIn(themeChoice);

    await waitFor(() => expect(screen.queryByTestId("settings-v2-style-reset")).toBeNull());
    expect(themeChoice).toHaveFocus();
  });

  it("keeps the previous appearance active when local persistence fails", () => {
    render(
      <SettingsPage
        controls={{
          ...createSettingsControls(),
          initialOpenSection: "appearance",
        }}
      />
    );

    themeStoreMock.failNextWrite();
    fireEvent.click(screen.getByTestId("settings-v2-accent-choice-blue"));

    expect(document.documentElement.dataset.themeAccent).not.toBe("blue");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not save this change. Your previous setting is still active.",
    );
  });

  it("wires language choices to the language context", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-appearance"));
    const ukrainian = screen.getByRole("button", { name: "Українська" });
    const arabic = screen.getByRole("button", { name: "العربية" });

    expect(ukrainian).toHaveAttribute("lang", "uk");
    expect(ukrainian).toHaveAttribute("dir", "ltr");
    expect(arabic).toHaveAttribute("lang", "ar");
    expect(arabic).toHaveAttribute("dir", "rtl");
    fireEvent.click(ukrainian);

    expect(languageContextMock.setLanguage).toHaveBeenCalledWith("uk");
  });

  it("wires V2 sound controls to the app audio manager", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    const soundCard = screen.getByTestId("settings-module-card-sound");
    expect(soundCard).toHaveTextContent("Sound");
    expect(soundCard).toHaveTextContent("Sound on");

    fireEvent.click(soundCard);

    const soundPanel = screen.getByTestId("settings-v2-panel-sound");
    expect(soundPanel).toBeInTheDocument();
    expect(soundPanel).toHaveTextContent("Choose background sounds, activity sounds, and volume.");
    expect(screen.getByText("Ambient sound")).toBeInTheDocument();
    expect(screen.getByText("Activity sounds")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-audio-ambient-toggle")).not.toHaveTextContent(
      /orb|Hyperfocus/i,
    );
    expect(screen.queryByTestId("settings-v2-diary-ambience-control")).toBeNull();
    expect(screen.queryByTestId("settings-v2-sensory-comfort-card")).toBeNull();
    expect(screen.queryByTestId("settings-v2-audio-preview")).toBeNull();
    expect(screen.queryByText("Where sound appears")).not.toBeInTheDocument();
    expect(screen.queryByText("Action feedback map")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-sound-map-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-action-sound-map-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-sound-platform-card")).not.toBeInTheDocument();
    expect(soundPanel).not.toHaveTextContent(
      /\b(Android|iOS|PWA|Desktop|Web|supported devices|orb|Hyperfocus)\b/i,
    );

    const volume = screen.getByTestId("settings-v2-audio-volume");
    fireEvent.change(volume, { target: { value: "0.7" } });
    expect(audioManagerMock.setVolume).toHaveBeenLastCalledWith(0.7);
    fireEvent.click(
      within(screen.getByTestId("settings-v2-app-sound-toggle")).getByRole("switch", {
        name: "App sound",
      })
    );
    expect(audioManagerMock.setAudioEnabled).toHaveBeenLastCalledWith(false);
  });

  it("offers one contextual recovery action for background sounds hidden by an older choice", async () => {
    localStorage.setItem(
      "zenflow-audio-comfort",
      JSON.stringify({
        profile: "balanced",
        ambientEnabled: true,
        completionCuesEnabled: true,
        milestoneCuesEnabled: true,
        reminderCuesEnabled: true,
        avoidedTextures: ["rain", "water"],
      }),
    );
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-sound"));
    const recovery = screen.getByTestId("settings-v2-audio-legacy-recovery");
    expect(recovery).toHaveTextContent("Rain");
    expect(recovery).toHaveTextContent("Water");

    fireEvent.click(within(recovery).getByRole("button", { name: "Turn them back on" }));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("zenflow-audio-comfort") || "{}");
      expect(saved.avoidedTextures).toEqual([]);
    });
    expect(screen.queryByTestId("settings-v2-audio-legacy-recovery")).toBeNull();
  });

  it("uses semantic subsection headings inside the active Settings detail", () => {
    render(
      <SettingsPage
        controls={{ ...createSettingsControls(), initialOpenSection: "appearance" }}
      />
    );

    expect(screen.getByRole("heading", { level: 3, name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Language" })).toBeInTheDocument();
  });

  it("explains invalid profile input and associates the message with the field", async () => {
    render(
      <SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "account" }} />
    );

    const input = screen.getByLabelText("Your name");
    fireEvent.change(input, { target: { value: "" } });

    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Enter a name between 1 and 100 characters.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", error.id);
  });

  it("keeps compact reminder-day choices at least 44 pixels wide", () => {
    platformMock.isNative = true;
    platformMock.isAndroid = true;
    platformMock.platform = "android";
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));
    expect(screen.getByRole("button", { name: "Mon" })).toHaveClass("min-w-11");
  });

  it("isolates reminder times before composing native RTL card summaries", () => {
    platformMock.isNative = true;
    platformMock.isAndroid = true;
    platformMock.platform = "android";
    languageContextMock.language = "ar";
    render(<SettingsPage controls={createSettingsControls()} />);

    const reminderCard = screen.getByTestId("settings-module-card-notifications");
    expect(reminderCard).toHaveTextContent("Mood check-ins");
    expect(reminderCard).toHaveTextContent("Focus reminder");
    expect(reminderCard).not.toHaveTextContent(/09:00|10:00/);
  });

  it("shows the audio manager effective state in both the Sound overview and master control", () => {
    audioManagerMock.state.muted = false;
    audioManagerMock.state.volume = 0;
    audioManagerMock.state.canPlayFeedback = false;

    render(<SettingsPage controls={createSettingsControls()} />);

    const soundCard = screen.getByTestId("settings-module-card-sound");
    expect(soundCard).toHaveTextContent("Muted");
    fireEvent.click(soundCard);

    const master = within(screen.getByTestId("settings-v2-app-sound-toggle")).getByRole("switch", {
      name: "App sound",
    });
    expect(master).toHaveAttribute("aria-checked", "false");

    fireEvent.click(master);
    expect(audioManagerMock.setAudioEnabled).toHaveBeenLastCalledWith(true);
  });

  it("shows the combined activity-sounds switch as on when any legacy cue remains on", () => {
    localStorage.setItem(
      "zenflow-audio-comfort",
      JSON.stringify({
        profile: "quiet",
        ambientEnabled: false,
        completionCuesEnabled: true,
        milestoneCuesEnabled: false,
        reminderCuesEnabled: false,
        avoidedTextures: [],
      }),
    );

    render(<SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "sound" }} />);

    expect(
      within(screen.getByTestId("settings-v2-audio-activity-toggle")).getByRole("switch", {
        name: "Activity sounds",
      }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("keeps motion in Appearance, hides native-only haptics on web, and removes the unused comfort survey", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    const motion = within(screen.getByTestId("settings-v2-motion-toggle")).getByRole("switch", {
      name: "Reduce motion",
    });
    fireEvent.click(motion);
    expect(interactionPreferencesMock.trySetReduceMotion).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByTestId("settings-module-card-sound"));
    expect(screen.queryByTestId("settings-v2-haptics-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-audio-feedback-card")).not.toBeInTheDocument();
    expect(screen.queryByText("How did this sound feel?")).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Feedback style" })).not.toBeInTheDocument();
  });

  it("offers the haptics preference in Sound on native devices", () => {
    platformMock.isNative = true;
    platformMock.isAndroid = true;
    platformMock.platform = "android";

    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-module-card-sound"));

    const haptics = within(screen.getByTestId("settings-v2-haptics-toggle")).getByRole("switch", {
      name: "Vibration",
    });
    fireEvent.click(haptics);
    expect(interactionPreferencesMock.trySetHapticsEnabled).toHaveBeenLastCalledWith(true);
  });

  it("keeps V2 sound settings focused on active controls instead of reference maps", () => {
    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-module-card-sound"));

    const soundPanel = screen.getByTestId("settings-v2-panel-sound");

    expect(screen.getByTestId("settings-v2-app-sound-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-audio-volume")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-audio-ambient-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-audio-activity-toggle")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-audio-preview")).toBeNull();
    expect(screen.queryByTestId("settings-v2-diary-ambience-control")).toBeNull();
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
    expect(volume).toHaveAttribute("aria-valuetext", "30%");

    fireEvent.click(screen.getByTestId("settings-module-card-appearance"));
    const textSize = screen.getByLabelText("Text Size");
    expect(textSize).toHaveClass("settings-v2-range-control", "h-11");
    expect(textSize).not.toHaveClass("bg-muted", "py-[18px]");
    expect(textSize).toHaveAttribute("aria-valuetext", "Default");
  });

  it("keeps diary ambience out of global Sound settings", () => {
    render(<SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "sound" }} />);

    expect(screen.queryByTestId("settings-v2-diary-ambience-control")).toBeNull();
    expect(screen.queryByText("Soft rain")).toBeNull();
  });

  it("wires notification reminder controls to the settings callback", () => {
    platformMock.isNative = true;
    platformMock.isAndroid = true;
    platformMock.platform = "android";
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

  it("exposes explicit mood and focus categories and explains that no selected days means no delivery", () => {
    platformMock.isNative = true;
    const controls = createSettingsControls();
    controls.reminders = { ...controls.reminders, days: [] };
    render(<SettingsPage controls={controls} />);
    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));

    const moodToggle = within(screen.getByTestId("settings-v2-mood-reminders-toggle")).getByRole(
      "switch",
      { name: "Mood check-ins" },
    );
    const focusToggle = within(screen.getByTestId("settings-v2-focus-reminder-toggle")).getByRole(
      "switch",
      { name: "Focus reminder" },
    );
    expect(moodToggle).toHaveAttribute("aria-checked", "true");
    expect(focusToggle).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByText("Choose at least one day. No reminders will be sent until you do."),
    ).toHaveAttribute("role", "status");
  });

  it.each([
    [true, false, "Mood check-ins"],
    [false, true, "Focus reminder"],
    [true, true, "Mood check-ins · Focus reminder"],
    [false, false, "Reminders off"],
  ])(
    "summarizes only enabled reminder categories (mood=%s, focus=%s)",
    (moodCheckInsEnabled, focusReminderEnabled, expectedSummary) => {
      platformMock.isNative = true;
      const controls = createSettingsControls();
      controls.reminders = {
        ...controls.reminders,
        moodCheckInsEnabled,
        focusReminderEnabled,
      };

      render(<SettingsPage controls={controls} />);

      expect(screen.getByTestId("settings-module-card-notifications")).toHaveTextContent(
        expectedSummary,
      );
    },
  );

  it("omits the Reminders destination on web instead of showing a disabled placeholder", () => {
    platformMock.isNative = false;
    platformMock.isAndroid = false;
    platformMock.isIos = false;
    platformMock.platform = "web";
    const controls = createSettingsControls();
    controls.reminders = { ...controls.reminders, enabled: false };

    render(
      <SettingsPage
        controls={{ ...controls, initialOpenSection: "notifications" }}
      />,
    );

    expect(screen.queryByTestId("settings-module-card-notifications")).toBeNull();
    expect(screen.queryByTestId("settings-v2-panel-notifications")).toBeNull();
    expect(screen.getByTestId("settings-v2-panel-appearance")).toBeInTheDocument();
    expect(screen.queryByText("To set reminders, open the ZenFlow mobile app.")).toBeNull();
    expect(controls.onRemindersChange).not.toHaveBeenCalled();
  });

  it.each([
    [
      "android",
      true,
      false,
      "Your phone’s sound, vibration, and notification settings can silence or hide reminders.",
    ],
    [
      "ios",
      false,
      true,
      "Your iPhone or iPad’s notification settings and Focus modes can silence or hide reminders.",
    ],
  ] as const)("shows %s reminder recovery", (platform, android, ios, description) => {
    platformMock.isNative = true;
    platformMock.isAndroid = android;
    platformMock.isIos = ios;
    platformMock.platform = platform;

    render(
      <SettingsPage
        controls={{ ...createSettingsControls(), initialOpenSection: "notifications" }}
      />,
    );

    const guidance = screen.getByTestId("settings-v2-notification-system-guidance");
    expect(guidance).toHaveTextContent("If reminders are silent");
    expect(guidance).toHaveTextContent(description);
    if (platform === "android") {
      expect(screen.queryByTestId("settings-v2-quick-actions-toggle")).toBeNull();
    }
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

  it("keeps reminder settings limited to controls that have a real delivery path", () => {
    platformMock.isNative = true;
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));

    expect(screen.queryByLabelText("Habit reminder")).not.toBeInTheDocument();
    expect(screen.queryByTestId("smart-reminders-card")).not.toBeInTheDocument();
    expect(screen.getByText("Set a reminder from the habit's own menu.")).toBeInTheDocument();
  });

  it("reschedules native reminders onto the selected notification sound channel", async () => {
    platformMock.isNative = true;
    platformMock.isAndroid = true;
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
          id: 201,
          channelId: "zenflow_gentle_v3",
          schedule: expect.objectContaining({ on: expect.objectContaining({ weekday: 2 }) }),
        }),
        expect.objectContaining({
          id: 9001,
          channelId: "zenflow_gentle_v3",
          actionTypeId: "MOOD_QUICK_LOG",
          schedule: expect.objectContaining({ on: expect.objectContaining({ weekday: 2 }) }),
        }),
      ])
    );
    expect(scheduled).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 1 })]));
    expect(scheduled).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 150 })]));
  });

  it("rolls back a native sound choice and keeps the scheduling failure visible", async () => {
    platformMock.isNative = true;
    platformMock.isAndroid = true;
    platformMock.platform = "android";
    notificationSoundsMock.initializeNotificationChannels.mockRejectedValueOnce(
      new Error("channel creation failed"),
    );
    localStorage.setItem("zenflow_notification_private_channel_migration_v3", "complete");
    localNotificationsMock.getPending.mockResolvedValue({
      notifications: [
        {
          id: 201,
          title: "Mood",
          body: "Existing reminder",
          channelId: "zenflow_default_v3",
        },
      ],
    });
    localNotificationsMock.checkPermissions.mockResolvedValue({ display: "granted" });
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));
    fireEvent.click(screen.getByRole("button", { name: /Gentle/ }));

    expect(
      await screen.findByRole("alert", {
        name: "ZenFlow could not apply this reminder sound. Your previous sound is still selected. Try again.",
      }),
    ).toBeInTheDocument();
    expect(notificationSoundsMock.updateNotificationSound).toHaveBeenNthCalledWith(1, "gentle");
    expect(notificationSoundsMock.updateNotificationSound).toHaveBeenNthCalledWith(2, "default");
    expect(screen.getByRole("button", { name: /Default/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localNotificationsMock.cancel).not.toHaveBeenCalled();
    expect(localNotificationsMock.schedule).not.toHaveBeenCalled();
  });

  it("restores the previous sound channel when replacement scheduling fails after cancellation", async () => {
    platformMock.isNative = true;
    platformMock.isAndroid = true;
    platformMock.platform = "android";
    localNotificationsMock.checkPermissions.mockResolvedValue({ display: "granted" });
    localNotificationsMock.getPending.mockResolvedValue({
      notifications: [
        {
          id: 201,
          title: "Previous mood",
          body: "Previous check-in",
          channelId: "zenflow_default_v3",
          schedule: {
            on: { hour: 14, minute: 0, weekday: 2 },
            allowWhileIdle: true,
          },
        },
      ],
    });
    localNotificationsMock.cancel.mockResolvedValue(undefined);
    const replacementError = new Error("replacement schedule failed");
    let scheduleAttempts = 0;
    localNotificationsMock.schedule.mockImplementation(async () => {
      scheduleAttempts += 1;
      if (scheduleAttempts === 1) throw replacementError;
      return { notifications: [{ id: 201 }] };
    });
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));
    fireEvent.click(screen.getByRole("button", { name: /Gentle/ }));

    expect(
      await screen.findByRole("alert", {
        name: "ZenFlow could not apply this reminder sound. Your previous sound is still selected. Try again.",
      }),
    ).toBeInTheDocument();
    expect(localNotificationsMock.schedule).toHaveBeenCalledTimes(2);
    expect(localNotificationsMock.schedule).toHaveBeenNthCalledWith(2, {
      notifications: [
        expect.objectContaining({
          id: 201,
          channelId: "zenflow_default_v3",
        }),
      ],
    });
    expect(screen.getByRole("button", { name: /Default/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows the durable new sound when reconciliation and preference rollback both fail", async () => {
    platformMock.isNative = true;
    platformMock.isAndroid = true;
    platformMock.platform = "android";
    notificationSoundsMock.initializeNotificationChannels.mockRejectedValueOnce(
      new Error("channel reconciliation failed"),
    );
    notificationSoundsMock.updateNotificationSound
      .mockResolvedValueOnce("zenflow_gentle_v3")
      .mockRejectedValueOnce(new Error("rollback storage failed"));
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));
    fireEvent.click(screen.getByRole("button", { name: /Gentle/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ZenFlow could not finish changing the reminder sound. Check the selected sound and try again.",
    );
    expect(screen.getByRole("button", { name: /Gentle/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows Android notification channel sounds on Android", () => {
    platformMock.isNative = true;
    platformMock.isAndroid = true;
    platformMock.platform = "android";

    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));

    expect(screen.getByText("Notification sound")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gentle/ })).toBeInTheDocument();
  });

  it("does not show Android notification channel sounds on iOS", () => {
    platformMock.isNative = true;
    platformMock.isAndroid = false;
    platformMock.isIos = true;
    platformMock.platform = "ios";

    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));

    expect(screen.queryByText("Notification sound")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gentle/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-notification-system-guidance")).toHaveTextContent(
      "Your iPhone or iPad’s notification settings and Focus modes"
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

    expect(await screen.findByTestId("settings-v2-reminders-permission-warning")).toHaveTextContent(
      "Turn on notifications for ZenFlow in your device settings."
    );
    expect(controls.onRemindersChange).not.toHaveBeenCalled();
  });

  it("describes optional privacy services without sync jargon", () => {
    adContextMock.adsSupported = true;
    render(
      <SettingsPage
        controls={{ ...createSettingsControls(), initialOpenSection: "privacy" }}
      />,
    );

    const privacyPanel = screen.getByTestId("settings-v2-panel-privacy");
    expect(privacyPanel).toHaveTextContent(
      "Choose which optional services ZenFlow may use.",
    );
    expect(privacyPanel).toHaveTextContent("Rewarded videos");
    expect(privacyPanel).toHaveTextContent(
      "They load only when you turn them on. Google may ask for your privacy choice when required.",
    );
    expect(privacyPanel).not.toHaveTextContent(/device sync|turn it on for backup/i);
  });

  it("does not expose retired analytics, no-tracking, or unavailable rewarded-video controls", () => {
    const controls = {
      ...createSettingsControls(),
      privacy: { noTracking: true, analytics: false, consentShown: true, adConsent: false },
    };
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));

    expect(screen.queryByTestId("settings-v2-no-tracking")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-analytics")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-v2-ad-consent")).not.toBeInTheDocument();
  });

  it("shows rewarded-video privacy only when that service is available on this build", () => {
    adContextMock.adsSupported = true;
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));

    expect(screen.getByTestId("settings-v2-ad-consent")).toBeInTheDocument();
  });

  it("shows a retryable error when Google ad privacy choices do not open", async () => {
    adContextMock.adsSupported = true;
    adContextMock.privacyOptionsRequired = true;
    adContextMock.openAdPrivacyOptions.mockResolvedValueOnce(false);

    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));
    fireEvent.click(screen.getByTestId("settings-v2-open-ad-privacy-options"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not open Google ad privacy choices. Try again."
    );
  });

  it("wires account reminder alerts to explicit privacy consent", () => {
    platformMock.isNative = true;
    platformMock.isAndroid = true;
    platformMock.platform = "android";
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

    fireEvent.click(screen.getByTestId("settings-module-card-notifications"));
    fireEvent.click(
      within(screen.getByTestId("settings-v2-push-notifications")).getByRole("switch", {
        name: "Account reminders",
      })
    );

    const updater = controls.onPrivacyChange.mock.calls.at(-1)?.[0];
    expect(typeof updater).toBe("function");
    expect(updater(controls.privacy)).toMatchObject({
      noTracking: true,
      analytics: false,
      adConsent: false,
      pushNotifications: true,
    });
  });

  it("does not show an unusable remote-push control outside supported Android builds", () => {
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));

    expect(screen.queryByTestId("settings-v2-push-notifications")).not.toBeInTheDocument();
  });

  it("does not expose the legacy widget settings action in the support footer", () => {
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);

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

    fireEvent.click(screen.getByTestId("settings-v2-check-updates"));

    expect(versionCheckMock.checkAppVersionStatus).toHaveBeenCalledTimes(1);
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("A newer version is ready");
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

    fireEvent.click(screen.getByTestId("settings-v2-check-updates"));

    const status = await screen.findByRole("alert");
    expect(status).toHaveTextContent("Could not check for updates");
    expect(screen.queryByText("You have the latest version")).not.toBeInTheDocument();
  });

  it("does not claim the Android updater is available on iOS", () => {
    platformMock.isNative = true;
    platformMock.isIos = true;
    platformMock.platform = "ios";

    render(<SettingsPage controls={createSettingsControls()} />);
    expect(screen.queryByTestId("settings-v2-check-updates")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Google Play" })).not.toBeInTheDocument();
  });

  it("shows an error when Android cannot open Google Play", async () => {
    platformMock.isNative = true;
    platformMock.isAndroid = true;
    platformMock.platform = "android";
    appUpdateManagerMock.checkForAppUpdate.mockResolvedValueOnce({
      available: true,
      currentVersion: "2.0.0",
      availableVersion: "2.1.0",
    });
    appUpdateManagerMock.openGooglePlayStore.mockResolvedValueOnce(false);

    render(<SettingsPage controls={createSettingsControls()} />);
    fireEvent.click(screen.getByTestId("settings-v2-check-updates"));
    fireEvent.click(await screen.findByRole("button", { name: "Open Google Play" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not open Google Play. Try again.",
    );
  });

  it("does not present the Web reload check as a packaged Desktop updater", () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};

    render(<SettingsPage controls={createSettingsControls()} />);
    expect(screen.queryByTestId("settings-v2-check-updates")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restart ZenFlow" })).not.toBeInTheDocument();
  });

  it("uses natural help, license, and update wording", () => {
    render(<SettingsPage controls={createSettingsControls()} />);
    const footer = screen.getByTestId("settings-support-footer");
    expect(within(footer).getByRole("button", { name: "Licenses" })).toBeInTheDocument();
    expect(within(footer).getByRole("button", { name: "Check for updates" })).toBeInTheDocument();
    expect(footer).not.toHaveTextContent(/all libraries|complete license/i);
  });

  it("keeps support and legal actions without exposing developer release notes", () => {
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);

    const supportLegal = screen.getByTestId("settings-support-footer");

    expect(screen.queryByRole("button", { name: "Version History" })).not.toBeInTheDocument();
    expect(supportLegal).toHaveTextContent("Send feedback");
    expect(supportLegal).toHaveTextContent("Privacy");
    expect(supportLegal).toHaveTextContent("Terms");
    expect(supportLegal).toHaveTextContent("Licenses");
  });

  it("does not offer an ambiguous local wipe while the account remains signed in", () => {
    const controls = createSettingsControls();
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));
    expect(screen.queryByTestId("settings-v2-reset-data")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Type RESET to confirm")).not.toBeInTheDocument();
    expect(controls.onResetData).not.toHaveBeenCalled();
  });

  it("offers a typed local-data wipe to a local-first user without an account", async () => {
    appStoreMock.hasValidSession = false;
    const controls = createSettingsControls();
    controls.onResetData.mockResolvedValue(undefined);
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));
    fireEvent.click(screen.getByTestId("settings-v2-reset-data"));

    await waitFor(() =>
      expect(screen.getByTestId("settings-v2-reset-confirmation")).toHaveFocus(),
    );
    const confirmation = screen.getByLabelText("Type RESET to confirm");
    const clearButton = screen.getByRole("button", { name: "Clear local data" });
    expect(clearButton).toBeDisabled();

    fireEvent.change(confirmation, { target: { value: "RESET" } });
    expect(clearButton).toBeEnabled();
    fireEvent.click(clearButton);

    await waitFor(() => expect(controls.onResetData).toHaveBeenCalledTimes(1));
  });

  it("does not hide an in-progress local-data reset on Escape", async () => {
    const pendingReset = createDeferred<void>();
    appStoreMock.hasValidSession = false;
    const controls = createSettingsControls();
    controls.onResetData.mockReturnValue(pendingReset.promise);
    render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));
    fireEvent.click(screen.getByTestId("settings-v2-reset-data"));
    fireEvent.change(screen.getByLabelText("Type RESET to confirm"), {
      target: { value: "RESET" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear local data" }));
    await waitFor(() => expect(controls.onResetData).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByTestId("settings-v2-reset-confirmation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resetting..." })).toBeDisabled();

    await act(async () => {
      pendingReset.resolve();
      await pendingReset.promise;
    });
  });

  it("does not hide an in-progress local-data reset when a session appears", async () => {
    const pendingReset = createDeferred<void>();
    appStoreMock.hasValidSession = false;
    const controls = createSettingsControls();
    controls.onResetData.mockReturnValue(pendingReset.promise);
    const view = render(<SettingsPage controls={controls} />);

    fireEvent.click(screen.getByTestId("settings-module-card-privacy"));
    fireEvent.click(screen.getByTestId("settings-v2-reset-data"));
    fireEvent.change(screen.getByLabelText("Type RESET to confirm"), {
      target: { value: "RESET" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear local data" }));
    await waitFor(() => expect(controls.onResetData).toHaveBeenCalledTimes(1));

    appStoreMock.hasValidSession = true;
    view.rerender(<SettingsPage controls={{ ...controls }} />);

    expect(screen.getByTestId("settings-v2-reset-confirmation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resetting..." })).toBeDisabled();

    await act(async () => {
      pendingReset.resolve();
      await pendingReset.promise;
    });
  });

  it("keeps the inline local-data confirmation scrollable and restores its trigger", async () => {
    const { restore, scrollIntoView } = installScrollIntoViewSpy();
    appStoreMock.hasValidSession = false;

    try {
      render(<SettingsPage controls={createSettingsControls()} />);
      fireEvent.click(screen.getByTestId("settings-module-card-privacy"));

      const trigger = screen.getByTestId("settings-v2-reset-data");
      trigger.focus();
      fireEvent.click(trigger);

      const confirmation = screen.getByTestId("settings-v2-reset-confirmation");
      expect(document.body.style.position).not.toBe("fixed");
      expect(scrollIntoView).toHaveBeenCalled();

      fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.getByTestId("settings-v2-reset-data")).toHaveFocus());
    } finally {
      restore();
    }
  });

  it("renders working settings without future-update placeholder copy", () => {
    const controls = createSettingsControls();
    controls.reminders = { ...controls.reminders, enabled: false };

    render(<SettingsPage controls={controls} />);

    expect(screen.getByTestId("settings-page-heading")).toHaveTextContent("Settings");
    expect(screen.queryByTestId("settings-module-card-notifications")).toBeNull();
    expect(screen.getByTestId("settings-page")).not.toHaveTextContent(
      "Notifications will be available in future updates.",
    );
  });

  it("does not promise reminder controls on Web, PWA, or Desktop builds", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    const hero = screen.getByTestId("settings-page-control-card");
    expect(hero).toHaveTextContent("Choose how ZenFlow looks, sounds, and handles your data.");
    expect(hero).not.toHaveTextContent(/remind/i);
  });

  it("summarizes appearance once and names the selected language", () => {
    render(<SettingsPage controls={createSettingsControls()} />);

    const appearanceCard = screen.getByTestId("settings-module-card-appearance");
    expect(appearanceCard).toHaveTextContent("English");
    expect(appearanceCard.textContent?.match(/Light/g)).toHaveLength(1);
  });

  it("does not render an empty Privacy panel when optional services are unavailable", () => {
    supabaseClientMock.client = null;
    render(
      <SettingsPage controls={{ ...createSettingsControls(), initialOpenSection: "privacy" }} />,
    );

    expect(screen.queryByTestId("settings-v2-panel-privacy")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-support-footer")).toBeInTheDocument();
  });

  it("does not summarize hidden optional services as active on unsupported platforms", () => {
    const controls = createSettingsControls();
    controls.privacy = {
      ...controls.privacy,
      adConsent: true,
      pushNotifications: true,
    };
    render(<SettingsPage controls={controls} />);

    expect(screen.getByTestId("settings-module-card-privacy")).toHaveTextContent(
      "Optional services off",
    );
    expect(screen.getByTestId("settings-module-card-privacy")).not.toHaveTextContent(
      "Optional services on",
    );
  });

  it("preserves child sound choices but disables them while the app sound master is muted", () => {
    audioManagerMock.state.muted = true;
    audioManagerMock.state.canPlayFeedback = false;
    render(<SettingsPage controls={createSettingsControls()} />);

    fireEvent.click(screen.getByTestId("settings-module-card-sound"));

    expect(
      within(screen.getByTestId("settings-v2-audio-ambient-toggle")).getByRole("switch"),
    ).toBeDisabled();
    expect(
      within(screen.getByTestId("settings-v2-audio-activity-toggle")).getByRole("switch"),
    ).toBeDisabled();
    expect(screen.getByTestId("settings-v2-audio-master-note")).toHaveTextContent(
      "Turn on App sound to change background and activity sounds.",
    );
  });
});
