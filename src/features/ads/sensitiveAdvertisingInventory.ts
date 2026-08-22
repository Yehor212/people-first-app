import type { SensitiveAdvertisingSurface } from "./sensitiveAdvertisingPolicy";

export type SensitiveAdvertisingScenario = Readonly<{
  id: string;
  surface: Exclude<SensitiveAdvertisingSurface, "unknown">;
  sourcePath: string;
  sourceNeedle: string;
}>;

/**
 * Canonical T177 evidence inventory.
 *
 * `sourcePath` and `sourceNeedle` bind every reviewed state label to a current
 * production implementation point. They are evidence locators, not runtime
 * routing data, and must never contain user content.
 */
export const SENSITIVE_ADVERTISING_SCENARIOS = [
  { id: "auth.initialization-error", surface: "auth", sourcePath: "src/components/AuthGate.tsx", sourceNeedle: "initializationState.error" },
  { id: "auth.account-boundary-transition", surface: "auth", sourcePath: "src/components/AuthGate.tsx", sourceNeedle: "isAccountBoundaryInProgress" },
  { id: "auth.imported-backup-recovery", surface: "auth", sourcePath: "src/components/AuthGateImportedBackupScreens.tsx", sourceNeedle: "ImportedBackupLocalRecoveryScreen" },
  { id: "auth.imported-backup-settled", surface: "auth", sourcePath: "src/components/AuthGateImportedBackupScreens.tsx", sourceNeedle: "ImportedBackupDecisionSettledScreen" },
  { id: "auth.initialization-loading", surface: "auth", sourcePath: "src/components/AuthGate.tsx", sourceNeedle: "initializationState.isInitializing" },
  { id: "auth.language-selection", surface: "auth", sourcePath: "src/components/LanguageSelector.tsx", sourceNeedle: "LanguageSelector" },
  { id: "auth.sign-in-oauth", surface: "auth", sourcePath: "src/components/AuthGateSignInScreen.tsx", sourceNeedle: "AuthGateSignInScreen" },
  { id: "auth.onboarding", surface: "auth", sourcePath: "src/components/OnboardingFlow.tsx", sourceNeedle: "OnboardingFlow" },
  { id: "auth.notification-permission", surface: "auth", sourcePath: "src/components/NotificationPermission.tsx", sourceNeedle: "NotificationPermission" },
  { id: "auth.journal-magic-link-confirmation", surface: "auth", sourcePath: "src/components/auth/JournalMagicLinkConfirmGate.tsx", sourceNeedle: "JournalMagicLinkConfirmGate" },
  { id: "orb.route-shell", surface: "orb", sourcePath: "src/pages/nav-v2/OrbPage.tsx", sourceNeedle: "OrbPage" },
  { id: "orb.mood-select", surface: "orb", sourcePath: "src/pages/nav-v2/OrbPageSteps.tsx", sourceNeedle: "OrbSelectStep" },
  { id: "orb.emotion-note-refinement", surface: "orb", sourcePath: "src/pages/nav-v2/OrbPageSteps.tsx", sourceNeedle: "OrbRefineStep" },
  { id: "orb.sensitive-emotion", surface: "orb", sourcePath: "src/pages/nav-v2/OrbPageSteps.tsx", sourceNeedle: "EmotionTagGrid" },
  { id: "orb.mood-save-diary-handoff", surface: "orb", sourcePath: "src/pages/nav-v2/useOrbMoodFlow.ts", sourceNeedle: "navigateToPage?.(\"diary\")" },
  { id: "orb.visual-error-recovery", surface: "orb", sourcePath: "src/pages/nav-v2/OrbPage.tsx", sourceNeedle: "orb-page-render-error" },
  { id: "habits.route-shell", surface: "habits", sourcePath: "src/pages/nav-v2/habits/HabitsPage.tsx", sourceNeedle: "HabitsPage" },
  { id: "habits.today-progress-insights", surface: "habits", sourcePath: "src/pages/nav-v2/habits/HabitsPage.tsx", sourceNeedle: "dailyProgress" },
  { id: "habits.create-edit-template", surface: "habits", sourcePath: "src/pages/nav-v2/habits/HabitsPage.tsx", sourceNeedle: "HabitCreateSheet" },
  { id: "habits.action-sheet", surface: "habits", sourcePath: "src/pages/nav-v2/habits/HabitsHeroZone.tsx", sourceNeedle: "onNumericalAction" },
  { id: "habits.detail-delete-archive-skip", surface: "habits", sourcePath: "src/components/habit-hub/HabitDetailSheet.tsx", sourceNeedle: "HabitDetailSheet" },
  { id: "diary.route-shell", surface: "diary", sourcePath: "src/features/journal/JournalModule.tsx", sourceNeedle: "JournalModule" },
  { id: "diary.history-list-search-calendar-stats", surface: "diary", sourcePath: "src/features/journal/JournalEntryList.tsx", sourceNeedle: "JournalEntryList" },
  { id: "diary.entry-detail", surface: "diary", sourcePath: "src/features/journal/JournalEntryViewer.tsx", sourceNeedle: "JournalEntryViewer" },
  { id: "diary.entry-editor", surface: "diary", sourcePath: "src/features/journal/JournalEntryEditor.tsx", sourceNeedle: "JournalEntryEditor" },
  { id: "diary.save-pending-success-conflict-error", surface: "diary", sourcePath: "src/features/journal/useJournalEditorState.ts", sourceNeedle: "saveFailureReason" },
  { id: "diary.draft-autosave-recovery", surface: "diary", sourcePath: "src/features/journal/useJournalEditorState.ts", sourceNeedle: "draftLoadState" },
  { id: "diary.release-thought", surface: "diary", sourcePath: "src/features/journal/JournalEntryList.tsx", sourceNeedle: "QuietReleaseIcon" },
  { id: "diary.gratitude-reflection", surface: "diary", sourcePath: "src/features/journal/GratitudeBloomWidget.tsx", sourceNeedle: "GratitudeBloomWidget" },
  { id: "diary.mood-prompt-breathe-habit-widgets", surface: "diary", sourcePath: "src/features/journal/DiaryBreatheWidget.tsx", sourceNeedle: "DiaryBreatheWidget" },
  { id: "diary.voice-audio-photo", surface: "diary", sourcePath: "src/features/journal/useJournalEditorState.ts", sourceNeedle: "voicePrivacyAccepted" },
  { id: "diary.privacy-security-import-export-delete-overlays", surface: "diary", sourcePath: "src/features/journal/JournalSettingsContent.tsx", sourceNeedle: "JournalSettingsContent" },
  { id: "planning.route-shell", surface: "planning", sourcePath: "src/pages/nav-v2/planning/PlanningPage.tsx", sourceNeedle: "PlanningPage" },
  { id: "planning.today-schedule", surface: "planning", sourcePath: "src/pages/nav-v2/planning/PlanningPage.tsx", sourceNeedle: "todayScheduleEvents" },
  { id: "planning.focus-timer", surface: "planning", sourcePath: "src/components/FocusTimer.tsx", sourceNeedle: "FocusTimer" },
  { id: "planning.focus-break-miniplayer", surface: "planning", sourcePath: "src/pages/nav-v2/planning/PlanningPage.tsx", sourceNeedle: "focusIsBreak" },
  { id: "planning.focus-reflection-journal-handoff", surface: "planning", sourcePath: "src/components/FocusReflectionModal.tsx", sourceNeedle: "FocusReflectionModal" },
  { id: "planning.review-mood-focus-summary", surface: "planning", sourcePath: "src/pages/nav-v2/planning/PlanningReviewLane.tsx", sourceNeedle: "PlanningReviewLane" },
  { id: "settings.route-shell", surface: "settings", sourcePath: "src/pages/nav-v2/SettingsPage.tsx", sourceNeedle: "SettingsPage" },
  { id: "settings.account-auth-profile", surface: "settings", sourcePath: "src/pages/nav-v2/settings/V2SettingsAccountPanel.tsx", sourceNeedle: "AccountPanel" },
  { id: "settings.backup-import-export-reset", surface: "settings", sourcePath: "src/pages/nav-v2/settings/V2SettingsDataPanels.tsx", sourceNeedle: "DataPanel" },
  { id: "settings.notifications-reminders", surface: "settings", sourcePath: "src/pages/nav-v2/settings/V2SettingsNotificationsPanel.tsx", sourceNeedle: "NotificationsPanel" },
  { id: "settings.privacy-data", surface: "settings", sourcePath: "src/pages/nav-v2/settings/V2SettingsDataPanels.tsx", sourceNeedle: "accountViewState" },
  { id: "error.database-recovery", surface: "error", sourcePath: "src/components/DatabaseRecoveryDialog.tsx", sourceNeedle: "DatabaseRecoveryDialog" },
  { id: "error.storage-offline", surface: "error", sourcePath: "src/components/StorageErrorBanner.tsx", sourceNeedle: "StorageErrorBanner" },
  { id: "error.update-chunk", surface: "error", sourcePath: "src/main.tsx", sourceNeedle: "isChunkLoadMessage" },
  { id: "error.root-lazy-modal-boundary", surface: "error", sourcePath: "src/components/ErrorBoundary.tsx", sourceNeedle: "LazyErrorBoundary" },
  { id: "error.unknown-route-not-found", surface: "error", sourcePath: "src/components/NotFoundPage.tsx", sourceNeedle: "NotFoundPage" },
  { id: "navigation.route-pending", surface: "navigation", sourcePath: "src/components/navigation-v2/NavV2Orchestrator.tsx", sourceNeedle: "routePendingPage" },
  { id: "navigation.drawer-command-palette", surface: "navigation", sourcePath: "src/components/navigation-v2/NavV2Orchestrator.tsx", sourceNeedle: "drawerOpen || commandPaletteOpen" },
  { id: "navigation.back-reload", surface: "navigation", sourcePath: "src/hooks/useNavigationV2.ts", sourceNeedle: "handleBackButton" },
  { id: "overlay.weekly-report", surface: "overlay", sourcePath: "src/stores/uiStore.ts", sourceNeedle: "showWeeklyReport" },
  { id: "overlay.widget-settings", surface: "overlay", sourcePath: "src/stores/uiStore.ts", sourceNeedle: "showWidgetSettings" },
  { id: "overlay.challenges", surface: "overlay", sourcePath: "src/stores/uiStore.ts", sourceNeedle: "showChallenges" },
  { id: "overlay.challenge-detail", surface: "overlay", sourcePath: "src/stores/uiStore.ts", sourceNeedle: "showChallengeModal" },
  { id: "overlay.time-helper", surface: "overlay", sourcePath: "src/stores/uiStore.ts", sourceNeedle: "showTimeHelper" },
  { id: "overlay.tasks", surface: "overlay", sourcePath: "src/stores/uiStore.ts", sourceNeedle: "showTasksPanel" },
  { id: "overlay.add-event", surface: "overlay", sourcePath: "src/stores/uiStore.ts", sourceNeedle: "showAddEvent" },
  { id: "overlay.quests", surface: "overlay", sourcePath: "src/stores/uiStore.ts", sourceNeedle: "showQuestsPanel" },
  { id: "overlay.friends", surface: "overlay", sourcePath: "src/stores/uiStore.ts", sourceNeedle: "showFriendsPanel" },
  { id: "overlay.welcome", surface: "overlay", sourcePath: "src/stores/uiStore.ts", sourceNeedle: "showWelcomeOverlay" },
  { id: "overlay.welcome-back", surface: "overlay", sourcePath: "src/stores/uiStore.ts", sourceNeedle: "showWelcomeBack" },
  { id: "overlay.mindful-moment", surface: "overlay", sourcePath: "src/stores/uiStore.ts", sourceNeedle: "showMindfulMoment" },
] as const satisfies readonly SensitiveAdvertisingScenario[];
