# Recovery Worktree Snapshot Receipt

**Captured before recovery planning edits:** 2026-08-11  
**Branch:** `codex/android-2-1-connected-release`  
**HEAD/base:** `13ca51a80d23220574deba762851fe5a32372e46`  
**Purpose:** preserve the exact dirty input set without treating it as accepted implementation.

## Collapsed porcelain

Expected count: 349 entries (241 modified, 2 deleted, 106 untracked paths).

```text
 M .codex/hooks.json
 M .codex/hooks/production-data-integrity-gate.cjs
 M .env.example
 M .gitleaksignore
 M .specify/feature.json
 M ARCHITECTURE.md
 M android/app/build.gradle
 D android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java
 M android/app/src/main/AndroidManifest.xml
 M android/app/src/main/java/com/zenflow/app/MainActivity.java
 M android/app/src/main/java/com/zenflow/app/StatusBarStylePlugin.java
 M android/build.gradle
 M android/settings.gradle
 M android/variables.gradle
 M capacitor.config.ts
 M docs/AD_SYSTEM_JOURNEY.md
 M docs/adr/0010-production-data-integrity-enforcement.md
 M docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md
 M docs/release/google-play/ADMOB_EXTERNAL_READINESS.json
 M docs/release/google-play/ADMOB_OWNER_FINALIZATION_RUNBOOK.md
 M e2e/nav-v2-settings.spec.ts
 M e2e/orb-renderer-lifecycle.spec.ts
 M package-lock.json
 M package.json
 D patches/brace-expansion+5.0.8.patch
 M scripts/__tests__/admob-owner-evidence-apply.test.ts
 M scripts/__tests__/admob-owner-next-steps.test.ts
 M scripts/__tests__/admob-production-readiness.test.ts
 M scripts/__tests__/agent-workspace.test.ts
 M scripts/__tests__/production-data-integrity-hook.test.ts
 M scripts/__tests__/production-data-integrity.test.ts
 M scripts/check-admob-production-readiness.cjs
 M scripts/generate-admob-owner-next-steps.cjs
 M scripts/production-data-integrity/core.cjs
 M src/__tests__/IntentionalSingleLineTextContract.test.ts
 M src/__tests__/MoodTransientTextReflow.static.test.ts
 M src/components/ChallengeModal.tsx
 M src/components/EntryGate.css
 M src/components/EntryGateBackdrop.tsx
 M src/components/EntryThemeSwitcher.tsx
 M src/components/ErrorBoundary.tsx
 M src/components/FocusReflectionModal.tsx
 M src/components/GlobalScheduleBar.tsx
 M src/components/LanguageSelector.tsx
 M src/components/OfflineBanner.tsx
 M src/components/SplashScreen.tsx
 M src/components/StorageErrorBanner.tsx
 M src/components/StorageIncidentBanner.tsx
 M src/components/UpdatePrompt.tsx
 M src/components/__tests__/AuthGate.test.tsx
 M src/components/__tests__/EntryGate.safeArea.test.ts
 M src/components/__tests__/EntryThemeSwitcher.test.tsx
 M src/components/__tests__/EssentialCardTextReflow.static.test.ts
 M src/components/__tests__/FeedbackForm.a11y.test.tsx
 M src/components/__tests__/LanguageSelector.test.tsx
 M src/components/__tests__/LegacyModalViewportRecovery.static.test.ts
 M src/components/__tests__/OfflineBanner.test.tsx
 M src/components/__tests__/SplashScreen.test.tsx
 M src/components/__tests__/StorageErrorBanner.pushRevocation.test.tsx
 M src/components/ads/RewardedAdPrompt.tsx
 M src/components/ads/__tests__/RewardedAdPrompt.uxContract.test.tsx
 M src/components/auth-screen/AuthScreen.tsx
 M src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx
 M src/components/breathing-exercise/PatternSelector.tsx
 M src/components/challenges/ChallengeDetailsView.tsx
 M src/components/challenges/ChallengesListView.tsx
 M src/components/challenges/JoinChallengeView.tsx
 M src/components/challenges/ParticipantsLeaderboard.tsx
 M src/components/focus-timer/CosmicBackground.tsx
 M src/components/friends-panel/FriendsPanel.tsx
 M src/components/friends-panel/types.ts
 M src/components/friends-panel/useFriendForm.ts
 M src/components/friends-panel/useFriendsData.ts
 M src/components/habit-creation-form/HabitCreationForm.tsx
 M src/components/habit-hub/HabitStreakTimeline.tsx
 M src/components/habit-hub/__tests__/HabitHubTypographyReflow.static.test.ts
 M src/components/habit-tracker/HabitTracker.tsx
 M src/components/hyperfocus/HyperfocusBackground.tsx
 M src/components/hyperfocus/HyperfocusMode.tsx
 M src/components/leaderboard/LeaderboardEntryRow.tsx
 M src/components/navigation-v2/DrawerV2.tsx
 M src/components/navigation-v2/NavV2Orchestrator.tsx
 M src/components/navigation-v2/SidebarV2.tsx
 M src/components/navigation-v2/ThemeToggleV2.tsx
 M src/components/navigation-v2/V2FocusMiniPlayer.tsx
 M src/components/navigation-v2/V2ProgressionModalLayer.tsx
 M src/components/navigation-v2/__tests__/DrawerV2.test.tsx
 M src/components/navigation-v2/__tests__/NavV2Orchestrator.test.tsx
 M src/components/navigation-v2/__tests__/SidebarV2.test.tsx
 M src/components/navigation-v2/__tests__/ThemeToggleV2.test.tsx
 M src/components/navigation-v2/__tests__/V2FocusMiniPlayer.test.tsx
 M src/components/navigation-v2/__tests__/integration.keyboardNav.test.tsx
 M src/components/schedule/AddEventModal.tsx
 M src/components/schedule/EventDetailsModal.tsx
 M src/components/schedule/ScheduleTimeline.tsx
 M src/components/schedule/ScheduleVisuals.tsx
 M src/components/schedule/TimelineDayColumn.tsx
 M src/components/schedule/__tests__/timelineRtlScroll.test.ts
 M src/components/schedule/useScheduleData.ts
 M src/components/stats/CalendarGrid.tsx
 M src/components/stats/DataMountains.tsx
 M src/components/stats/HabitCalendar.tsx
 M src/components/stats/emotion-galaxy/EmotionGalaxy.tsx
 M src/components/storageErrorIncidentState.ts
 M src/components/ui/__tests__/switch.rtl.test.tsx
 M src/components/ui/dialog.tsx
 M src/components/ui/switch.tsx
 M src/contexts/AdContext.tsx
 M src/contexts/__tests__/AdContext.privacyOptions.test.tsx
 M src/features/journal/JournalAudioPlayer.tsx
 M src/features/journal/JournalCalendar.tsx
 M src/features/journal/JournalEntryEditor.tsx
 M src/features/journal/JournalEntryList.tsx
 M src/features/journal/JournalModule.tsx
 M src/features/journal/MemoryPortalCanvas.tsx
 M src/features/journal/__tests__/JournalAudioPlayer.lifecycle.test.tsx
 M src/features/journal/__tests__/JournalFinalReviewContracts.static.test.ts
 M src/features/journal/__tests__/journalCrypto.test.ts
 M src/features/journal/__tests__/journalHubStorage.test.ts
 M src/features/journal/__tests__/journalSecurityMigration.test.ts
 M src/features/journal/__tests__/useJournalEditorState.recordingSave.test.tsx
 M src/features/journal/journalCrypto.ts
 M src/features/journal/journalDateUtils.ts
 M src/features/journal/journalHubStorage.ts
 M src/features/journal/journalSecurityMigration.ts
 M src/features/journal/journalStorage.ts
 M src/features/journal/useJournalEditorState.ts
 M src/hooks/__tests__/useDeepLinkHandler.test.ts
 M src/hooks/__tests__/useFocusHandlers.test.ts
 M src/hooks/__tests__/useHabitHandlers.test.ts
 M src/hooks/__tests__/useMoodHandlers.test.ts
 M src/hooks/__tests__/useNavigationV2.test.ts
 M src/hooks/useAppLifecycle.ts
 M src/hooks/useDeepLinkHandler.ts
 M src/hooks/useDeviceTier.test.ts
 M src/hooks/useDeviceTier.ts
 M src/hooks/useFocusHandlers.ts
 M src/hooks/useHabitHandlers.ts
 M src/hooks/useIndexedDB.ts
 M src/hooks/useModalState.ts
 M src/hooks/useMoodHandlers.ts
 M src/hooks/useNavigationV2.ts
 M src/i18n/index.ts
 M src/i18n/languages/ar.ts
 M src/i18n/languages/de.ts
 M src/i18n/languages/en.ts
 M src/i18n/languages/es.ts
 M src/i18n/languages/fr.ts
 M src/i18n/languages/he.ts
 M src/i18n/languages/ja.ts
 M src/i18n/languages/uk.ts
 M src/i18n/types.ts
 M src/index.css
 M src/lib/__tests__/a11y.test.ts
 M src/lib/__tests__/adConfig.test.ts
 M src/lib/__tests__/adController.nativeAdMob.test.ts
 M src/lib/__tests__/adController.test.ts
 M src/lib/__tests__/ambientSounds.test.ts
 M src/lib/__tests__/androidBackHandler.test.ts
 M src/lib/__tests__/crashReporting.test.ts
 M src/lib/__tests__/env.test.ts
 M src/lib/__tests__/errorBuffer.test.ts
 M src/lib/__tests__/friendChallenge.test.ts
 M src/lib/__tests__/habitScheduleSync.test.ts
 M src/lib/__tests__/journalContentSession.crossTab.test.ts
 M src/lib/__tests__/logger.test.ts
 M src/lib/__tests__/offlineQueue.accountBoundary.test.ts
 M src/lib/__tests__/offlineQueueHandlers.test.ts
 M src/lib/__tests__/runtimePerformanceGuards.test.ts
 M src/lib/__tests__/sentryPrivacy.test.ts
 M src/lib/__tests__/syncBroadcast.test.ts
 M src/lib/a11y.ts
 M src/lib/adConfig.ts
 M src/lib/adController.ts
 M src/lib/ambientSounds.ts
 M src/lib/androidBackHandler.ts
 M src/lib/appVersion.ts
 M src/lib/challengeService.ts
 M src/lib/crashReporting.ts
 M src/lib/env.ts
 M src/lib/errorBuffer.ts
 M src/lib/friendChallenge.ts
 M src/lib/habitScheduleSync.ts
 M src/lib/journalContentSession.ts
 M src/lib/logger.ts
 M src/lib/offlineQueue.ts
 M src/lib/offlineQueueHandlers.ts
 M src/lib/schemas.ts
 M src/lib/sentry.ts
 M src/lib/storageKeys.ts
 M src/lib/syncBroadcast.ts
 M src/main.tsx
 M src/pages/Index.tsx
 M src/pages/__tests__/IndexV2NoXpAudioContract.test.ts
 M src/pages/nav-v2/DayCosmicBackground.css
 M src/pages/nav-v2/MoodFirstRunHint.css
 M src/pages/nav-v2/MoodFirstRunHint.tsx
 M src/pages/nav-v2/OrbPage.tsx
 M src/pages/nav-v2/OrbPageSteps.tsx
 M src/pages/nav-v2/__tests__/DayCosmicBackground.test.tsx
 M src/pages/nav-v2/__tests__/MoodFirstRunHint.test.tsx
 M src/pages/nav-v2/__tests__/OrbPage.test.tsx
 M src/pages/nav-v2/__tests__/SettingsPage.test.tsx
 M src/pages/nav-v2/__tests__/androidEdgeToEdgeContract.test.ts
 M src/pages/nav-v2/__tests__/planningFocusTransferContract.test.ts
 M src/pages/nav-v2/__tests__/v2ReadabilityContract.test.ts
 M src/pages/nav-v2/habits/HabitCreateSheet.tsx
 M src/pages/nav-v2/habits/HabitsPage.tsx
 M src/pages/nav-v2/habits/__tests__/HabitCreateSheet.reflow.test.ts
 M src/pages/nav-v2/habits/__tests__/HabitsPage.test.tsx
 M src/pages/nav-v2/habits/__tests__/metrics-wiring.test.tsx
 M src/pages/nav-v2/habits/hero/HabitActionSheet.tsx
 M src/pages/nav-v2/habits/hero/HeroEmptyJourney.tsx
 M src/pages/nav-v2/habits/hero/__tests__/HabitActionSheet.test.tsx
 M src/pages/nav-v2/habits/hero/__tests__/HeroEmptyJourney.test.tsx
 M src/pages/nav-v2/planning/PlanningPage.tsx
 M src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx
 M src/pages/nav-v2/settings/__tests__/SettingsTextReflow.test.tsx
 M src/pages/nav-v2/settings/__tests__/V2SettingsFormPrimitives.test.tsx
 M src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx
 M src/pages/nav-v2/settings/components/V2SettingsFormPrimitives.tsx
 M src/pages/nav-v2/settings/components/V2SettingsPrimitiveTypes.ts
 M src/pages/nav-v2/useOrbMoodFlow.ts
 M src/storage/__tests__/eventSync.test.ts
 M src/storage/__tests__/friendsSync.test.ts
 M src/storage/__tests__/initialDeltaSync.test.ts
 M src/storage/backup.ts
 M src/storage/db.ts
 M src/storage/eventSync.ts
 M src/storage/friendsSync.ts
 M src/storage/initialDeltaSync.ts
 M src/storage/sync/__tests__/syncSettings.test.ts
 M src/storage/sync/settingSyncPolicy.ts
 M src/stores/__tests__/userDataStore.test.ts
 M src/stores/uiStore.ts
 M src/stores/userDataStore.ts
 M src/styles/__tests__/themes.test.ts
 M src/styles/themes.css
 M src/sw.ts
 M src/types/index.ts
 M supabase/config.toml
 M tsconfig.eslint.json
 M vite.config.ts
?? android/app/src/androidTest/java/com/zenflow/
?? android/app/src/main/java/com/zenflow/app/AndroidBackNavigationState.java
?? android/app/src/main/java/com/zenflow/app/AndroidBackPlugin.java
?? android/app/src/main/res/drawable/zenflow_edge_bleed_backdrop_dark.xml
?? android/app/src/main/res/values/edge_to_edge_dark_colors.xml
?? android/app/src/release/
?? android/app/src/test/java/com/zenflow/app/AndroidBackNavigationStateTest.java
?? android/baselineprofile/
?? docs/release/ANDROID_2_1_RUNBOOK.md
?? docs/release/android-2.1-back-matrix.json
?? docs/release/android-2.1-performance-evidence.json
?? docs/release/android-2.1-reflow-inventory.json
?? docs/release/android-2.1-runtime-evidence.json
?? docs/release/android-2.1-visual-evidence.json
?? docs/security/GITLEAKS_TRIAGE_2026-08-09.md
?? e2e/android-v2-destination-matrix.spec.ts
?? e2e/automation-pwa-update.spec.ts
?? e2e/calendar-reflow.spec.ts
?? e2e/global-schedule-bar-reflow.spec.ts
?? e2e/habit-streak-timeline-reflow.spec.ts
?? e2e/habits-social-entry-reflow.spec.ts
?? e2e/helpers/android-automation-lifecycle/
?? e2e/helpers/automation-lifecycle/
?? e2e/helpers/calendar-reflow/
?? e2e/helpers/global-schedule-bar-reflow/
?? e2e/helpers/habit-streak-timeline-reflow/
?? e2e/helpers/language-selector-reflow/
?? e2e/helpers/leaderboard-entry-row-reflow/
?? e2e/helpers/participants-leaderboard-reflow/
?? e2e/helpers/pwa-update/
?? e2e/helpers/storage-incident-reflow/
?? e2e/helpers/t150-visual/
?? e2e/language-selector-reflow.spec.ts
?? e2e/leaderboard-entry-row-reflow.spec.ts
?? e2e/participants-leaderboard-reflow.spec.ts
?? e2e/storage-incident-reflow.spec.ts
?? patches/@capacitor-community+admob+8.0.0.patch
?? scripts/__tests__/admobReleaseConfig.test.ts
?? scripts/__tests__/android-release-config.test.ts
?? scripts/__tests__/android21ForwardRollback.test.ts
?? scripts/__tests__/androidBackMatrix.test.ts
?? scripts/__tests__/androidBaselineProfileContract.test.ts
?? scripts/__tests__/automationMigrationContract.test.ts
?? scripts/__tests__/localeAssetPlugin.test.ts
?? scripts/check-admob-release-config.cjs
?? scripts/check-android-release-config.cjs
?? specs/002-android-2-1-connected-release/
?? src/components/__tests__/GlobalScheduleBar.test.tsx
?? src/components/__tests__/StorageIncidentBanner.reflow.test.tsx
?? src/components/challenges/__tests__/ChallengeDetailsProgressCopy.test.ts
?? src/components/challenges/__tests__/JoinChallengeView.authoritativeJoin.test.tsx
?? src/components/friends-panel/__tests__/
?? src/components/leaderboard/__tests__/
?? src/components/navigation-v2/V2ConnectedHistoryAction.tsx
?? src/components/schedule/__tests__/ScheduleCompletedState.test.tsx
?? src/components/state-of-mind/__tests__/orbStartupPolicy.test.ts
?? src/components/state-of-mind/orbStartupPolicy.ts
?? src/components/stats/__tests__/
?? src/contexts/__tests__/AdContext.rewardSettlement.test.tsx
?? src/features/ads/
?? src/features/automation/
?? src/features/journal/__tests__/gratitudeProjection.atomic.test.ts
?? src/features/journal/__tests__/journalMonthRange.test.ts
?? src/features/journal/__tests__/journalSecurityAutomationHistory.test.ts
?? src/features/journal/__tests__/journalStorage.automation.test.ts
?? src/features/journal/journalAutomationVaultGuard.ts
?? src/hooks/__tests__/useFocusHandlers.automation.test.ts
?? src/hooks/__tests__/useHabitHandlers.automation.test.ts
?? src/hooks/__tests__/useIndexedDB.timeoutDiagnostics.test.tsx
?? src/hooks/__tests__/useMoodHandlers.automation.test.ts
?? src/i18n/__tests__/connectedRecordsCopy.test.ts
?? src/i18n/__tests__/localeAssetRuntime.test.ts
?? src/i18n/localeAssetRuntime.ts
?? src/lib/__tests__/adController.ump.test.ts
?? src/lib/__tests__/ambientSounds.androidEagerUnlock.test.ts
?? src/lib/__tests__/android16NativeContract.test.ts
?? src/lib/__tests__/androidAdaptiveWindowContract.test.ts
?? src/lib/__tests__/androidBackBridgeState.test.ts
?? src/lib/__tests__/androidPredictiveBackBridge.test.ts
?? src/lib/__tests__/androidSocialInviteContract.test.ts
?? src/lib/__tests__/challengeService.invite.test.ts
?? src/lib/__tests__/diagnosticPrivacy.test.ts
?? src/lib/__tests__/offlineQueuePriority.test.ts
?? src/lib/__tests__/rewardedAdsGate.test.ts
?? src/lib/__tests__/socialInvite.test.ts
?? src/lib/androidBackBridge.ts
?? src/lib/diagnosticPrivacy.ts
?? src/lib/habitEntryCommit.ts
?? src/lib/rewardedAdsGate.ts
?? src/lib/socialInvite.ts
?? src/pages/nav-v2/habits/__tests__/HabitCreateSheet.keyboard.test.tsx
?? src/pages/nav-v2/habits/__tests__/habitKeyboardViewport.test.ts
?? src/pages/nav-v2/habits/habitKeyboardViewport.ts
?? src/pages/nav-v2/habits/hero/__tests__/HabitActionSheet.back.test.tsx
?? src/storage/__tests__/automationUndoTombstones.test.ts
?? src/storage/__tests__/backupAutomation.test.ts
?? src/storage/__tests__/dbAutomation.test.ts
?? src/storage/__tests__/eventSyncAutomationTransaction.test.ts
?? src/storage/__tests__/initialDeltaSyncAutomation.test.ts
?? src/storage/__tests__/journalEventPrivacy.test.ts
?? src/storage/sync/__tests__/settingSyncPolicy.test.ts
?? supabase/functions/rewarded-ads-gate/
?? supabase/migrations/20260808000000_automation_transaction_ledger.sql
?? supabase/migrations/20260808010000_journal_sync_event_privacy.sql
?? tools/release/
?? vite-plugin-locale-assets.ts
```

## Expanded porcelain

Expected count: 463 entries (241 modified, 2 deleted, 220 untracked files).

```text
 M .codex/hooks.json
 M .codex/hooks/production-data-integrity-gate.cjs
 M .env.example
 M .gitleaksignore
 M .specify/feature.json
 M ARCHITECTURE.md
 M android/app/build.gradle
 D android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java
 M android/app/src/main/AndroidManifest.xml
 M android/app/src/main/java/com/zenflow/app/MainActivity.java
 M android/app/src/main/java/com/zenflow/app/StatusBarStylePlugin.java
 M android/build.gradle
 M android/settings.gradle
 M android/variables.gradle
 M capacitor.config.ts
 M docs/AD_SYSTEM_JOURNEY.md
 M docs/adr/0010-production-data-integrity-enforcement.md
 M docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md
 M docs/release/google-play/ADMOB_EXTERNAL_READINESS.json
 M docs/release/google-play/ADMOB_OWNER_FINALIZATION_RUNBOOK.md
 M e2e/nav-v2-settings.spec.ts
 M e2e/orb-renderer-lifecycle.spec.ts
 M package-lock.json
 M package.json
 D patches/brace-expansion+5.0.8.patch
 M scripts/__tests__/admob-owner-evidence-apply.test.ts
 M scripts/__tests__/admob-owner-next-steps.test.ts
 M scripts/__tests__/admob-production-readiness.test.ts
 M scripts/__tests__/agent-workspace.test.ts
 M scripts/__tests__/production-data-integrity-hook.test.ts
 M scripts/__tests__/production-data-integrity.test.ts
 M scripts/check-admob-production-readiness.cjs
 M scripts/generate-admob-owner-next-steps.cjs
 M scripts/production-data-integrity/core.cjs
 M src/__tests__/IntentionalSingleLineTextContract.test.ts
 M src/__tests__/MoodTransientTextReflow.static.test.ts
 M src/components/ChallengeModal.tsx
 M src/components/EntryGate.css
 M src/components/EntryGateBackdrop.tsx
 M src/components/EntryThemeSwitcher.tsx
 M src/components/ErrorBoundary.tsx
 M src/components/FocusReflectionModal.tsx
 M src/components/GlobalScheduleBar.tsx
 M src/components/LanguageSelector.tsx
 M src/components/OfflineBanner.tsx
 M src/components/SplashScreen.tsx
 M src/components/StorageErrorBanner.tsx
 M src/components/StorageIncidentBanner.tsx
 M src/components/UpdatePrompt.tsx
 M src/components/__tests__/AuthGate.test.tsx
 M src/components/__tests__/EntryGate.safeArea.test.ts
 M src/components/__tests__/EntryThemeSwitcher.test.tsx
 M src/components/__tests__/EssentialCardTextReflow.static.test.ts
 M src/components/__tests__/FeedbackForm.a11y.test.tsx
 M src/components/__tests__/LanguageSelector.test.tsx
 M src/components/__tests__/LegacyModalViewportRecovery.static.test.ts
 M src/components/__tests__/OfflineBanner.test.tsx
 M src/components/__tests__/SplashScreen.test.tsx
 M src/components/__tests__/StorageErrorBanner.pushRevocation.test.tsx
 M src/components/ads/RewardedAdPrompt.tsx
 M src/components/ads/__tests__/RewardedAdPrompt.uxContract.test.tsx
 M src/components/auth-screen/AuthScreen.tsx
 M src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx
 M src/components/breathing-exercise/PatternSelector.tsx
 M src/components/challenges/ChallengeDetailsView.tsx
 M src/components/challenges/ChallengesListView.tsx
 M src/components/challenges/JoinChallengeView.tsx
 M src/components/challenges/ParticipantsLeaderboard.tsx
 M src/components/focus-timer/CosmicBackground.tsx
 M src/components/friends-panel/FriendsPanel.tsx
 M src/components/friends-panel/types.ts
 M src/components/friends-panel/useFriendForm.ts
 M src/components/friends-panel/useFriendsData.ts
 M src/components/habit-creation-form/HabitCreationForm.tsx
 M src/components/habit-hub/HabitStreakTimeline.tsx
 M src/components/habit-hub/__tests__/HabitHubTypographyReflow.static.test.ts
 M src/components/habit-tracker/HabitTracker.tsx
 M src/components/hyperfocus/HyperfocusBackground.tsx
 M src/components/hyperfocus/HyperfocusMode.tsx
 M src/components/leaderboard/LeaderboardEntryRow.tsx
 M src/components/navigation-v2/DrawerV2.tsx
 M src/components/navigation-v2/NavV2Orchestrator.tsx
 M src/components/navigation-v2/SidebarV2.tsx
 M src/components/navigation-v2/ThemeToggleV2.tsx
 M src/components/navigation-v2/V2FocusMiniPlayer.tsx
 M src/components/navigation-v2/V2ProgressionModalLayer.tsx
 M src/components/navigation-v2/__tests__/DrawerV2.test.tsx
 M src/components/navigation-v2/__tests__/NavV2Orchestrator.test.tsx
 M src/components/navigation-v2/__tests__/SidebarV2.test.tsx
 M src/components/navigation-v2/__tests__/ThemeToggleV2.test.tsx
 M src/components/navigation-v2/__tests__/V2FocusMiniPlayer.test.tsx
 M src/components/navigation-v2/__tests__/integration.keyboardNav.test.tsx
 M src/components/schedule/AddEventModal.tsx
 M src/components/schedule/EventDetailsModal.tsx
 M src/components/schedule/ScheduleTimeline.tsx
 M src/components/schedule/ScheduleVisuals.tsx
 M src/components/schedule/TimelineDayColumn.tsx
 M src/components/schedule/__tests__/timelineRtlScroll.test.ts
 M src/components/schedule/useScheduleData.ts
 M src/components/stats/CalendarGrid.tsx
 M src/components/stats/DataMountains.tsx
 M src/components/stats/HabitCalendar.tsx
 M src/components/stats/emotion-galaxy/EmotionGalaxy.tsx
 M src/components/storageErrorIncidentState.ts
 M src/components/ui/__tests__/switch.rtl.test.tsx
 M src/components/ui/dialog.tsx
 M src/components/ui/switch.tsx
 M src/contexts/AdContext.tsx
 M src/contexts/__tests__/AdContext.privacyOptions.test.tsx
 M src/features/journal/JournalAudioPlayer.tsx
 M src/features/journal/JournalCalendar.tsx
 M src/features/journal/JournalEntryEditor.tsx
 M src/features/journal/JournalEntryList.tsx
 M src/features/journal/JournalModule.tsx
 M src/features/journal/MemoryPortalCanvas.tsx
 M src/features/journal/__tests__/JournalAudioPlayer.lifecycle.test.tsx
 M src/features/journal/__tests__/JournalFinalReviewContracts.static.test.ts
 M src/features/journal/__tests__/journalCrypto.test.ts
 M src/features/journal/__tests__/journalHubStorage.test.ts
 M src/features/journal/__tests__/journalSecurityMigration.test.ts
 M src/features/journal/__tests__/useJournalEditorState.recordingSave.test.tsx
 M src/features/journal/journalCrypto.ts
 M src/features/journal/journalDateUtils.ts
 M src/features/journal/journalHubStorage.ts
 M src/features/journal/journalSecurityMigration.ts
 M src/features/journal/journalStorage.ts
 M src/features/journal/useJournalEditorState.ts
 M src/hooks/__tests__/useDeepLinkHandler.test.ts
 M src/hooks/__tests__/useFocusHandlers.test.ts
 M src/hooks/__tests__/useHabitHandlers.test.ts
 M src/hooks/__tests__/useMoodHandlers.test.ts
 M src/hooks/__tests__/useNavigationV2.test.ts
 M src/hooks/useAppLifecycle.ts
 M src/hooks/useDeepLinkHandler.ts
 M src/hooks/useDeviceTier.test.ts
 M src/hooks/useDeviceTier.ts
 M src/hooks/useFocusHandlers.ts
 M src/hooks/useHabitHandlers.ts
 M src/hooks/useIndexedDB.ts
 M src/hooks/useModalState.ts
 M src/hooks/useMoodHandlers.ts
 M src/hooks/useNavigationV2.ts
 M src/i18n/index.ts
 M src/i18n/languages/ar.ts
 M src/i18n/languages/de.ts
 M src/i18n/languages/en.ts
 M src/i18n/languages/es.ts
 M src/i18n/languages/fr.ts
 M src/i18n/languages/he.ts
 M src/i18n/languages/ja.ts
 M src/i18n/languages/uk.ts
 M src/i18n/types.ts
 M src/index.css
 M src/lib/__tests__/a11y.test.ts
 M src/lib/__tests__/adConfig.test.ts
 M src/lib/__tests__/adController.nativeAdMob.test.ts
 M src/lib/__tests__/adController.test.ts
 M src/lib/__tests__/ambientSounds.test.ts
 M src/lib/__tests__/androidBackHandler.test.ts
 M src/lib/__tests__/crashReporting.test.ts
 M src/lib/__tests__/env.test.ts
 M src/lib/__tests__/errorBuffer.test.ts
 M src/lib/__tests__/friendChallenge.test.ts
 M src/lib/__tests__/habitScheduleSync.test.ts
 M src/lib/__tests__/journalContentSession.crossTab.test.ts
 M src/lib/__tests__/logger.test.ts
 M src/lib/__tests__/offlineQueue.accountBoundary.test.ts
 M src/lib/__tests__/offlineQueueHandlers.test.ts
 M src/lib/__tests__/runtimePerformanceGuards.test.ts
 M src/lib/__tests__/sentryPrivacy.test.ts
 M src/lib/__tests__/syncBroadcast.test.ts
 M src/lib/a11y.ts
 M src/lib/adConfig.ts
 M src/lib/adController.ts
 M src/lib/ambientSounds.ts
 M src/lib/androidBackHandler.ts
 M src/lib/appVersion.ts
 M src/lib/challengeService.ts
 M src/lib/crashReporting.ts
 M src/lib/env.ts
 M src/lib/errorBuffer.ts
 M src/lib/friendChallenge.ts
 M src/lib/habitScheduleSync.ts
 M src/lib/journalContentSession.ts
 M src/lib/logger.ts
 M src/lib/offlineQueue.ts
 M src/lib/offlineQueueHandlers.ts
 M src/lib/schemas.ts
 M src/lib/sentry.ts
 M src/lib/storageKeys.ts
 M src/lib/syncBroadcast.ts
 M src/main.tsx
 M src/pages/Index.tsx
 M src/pages/__tests__/IndexV2NoXpAudioContract.test.ts
 M src/pages/nav-v2/DayCosmicBackground.css
 M src/pages/nav-v2/MoodFirstRunHint.css
 M src/pages/nav-v2/MoodFirstRunHint.tsx
 M src/pages/nav-v2/OrbPage.tsx
 M src/pages/nav-v2/OrbPageSteps.tsx
 M src/pages/nav-v2/__tests__/DayCosmicBackground.test.tsx
 M src/pages/nav-v2/__tests__/MoodFirstRunHint.test.tsx
 M src/pages/nav-v2/__tests__/OrbPage.test.tsx
 M src/pages/nav-v2/__tests__/SettingsPage.test.tsx
 M src/pages/nav-v2/__tests__/androidEdgeToEdgeContract.test.ts
 M src/pages/nav-v2/__tests__/planningFocusTransferContract.test.ts
 M src/pages/nav-v2/__tests__/v2ReadabilityContract.test.ts
 M src/pages/nav-v2/habits/HabitCreateSheet.tsx
 M src/pages/nav-v2/habits/HabitsPage.tsx
 M src/pages/nav-v2/habits/__tests__/HabitCreateSheet.reflow.test.ts
 M src/pages/nav-v2/habits/__tests__/HabitsPage.test.tsx
 M src/pages/nav-v2/habits/__tests__/metrics-wiring.test.tsx
 M src/pages/nav-v2/habits/hero/HabitActionSheet.tsx
 M src/pages/nav-v2/habits/hero/HeroEmptyJourney.tsx
 M src/pages/nav-v2/habits/hero/__tests__/HabitActionSheet.test.tsx
 M src/pages/nav-v2/habits/hero/__tests__/HeroEmptyJourney.test.tsx
 M src/pages/nav-v2/planning/PlanningPage.tsx
 M src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx
 M src/pages/nav-v2/settings/__tests__/SettingsTextReflow.test.tsx
 M src/pages/nav-v2/settings/__tests__/V2SettingsFormPrimitives.test.tsx
 M src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx
 M src/pages/nav-v2/settings/components/V2SettingsFormPrimitives.tsx
 M src/pages/nav-v2/settings/components/V2SettingsPrimitiveTypes.ts
 M src/pages/nav-v2/useOrbMoodFlow.ts
 M src/storage/__tests__/eventSync.test.ts
 M src/storage/__tests__/friendsSync.test.ts
 M src/storage/__tests__/initialDeltaSync.test.ts
 M src/storage/backup.ts
 M src/storage/db.ts
 M src/storage/eventSync.ts
 M src/storage/friendsSync.ts
 M src/storage/initialDeltaSync.ts
 M src/storage/sync/__tests__/syncSettings.test.ts
 M src/storage/sync/settingSyncPolicy.ts
 M src/stores/__tests__/userDataStore.test.ts
 M src/stores/uiStore.ts
 M src/stores/userDataStore.ts
 M src/styles/__tests__/themes.test.ts
 M src/styles/themes.css
 M src/sw.ts
 M src/types/index.ts
 M supabase/config.toml
 M tsconfig.eslint.json
 M vite.config.ts
?? android/app/src/androidTest/java/com/zenflow/app/AndroidBackDispatcherInstrumentedTest.java
?? android/app/src/androidTest/java/com/zenflow/app/EntryStorageIncidentInstrumentedTest.java
?? android/app/src/androidTest/java/com/zenflow/app/TalkBackTraversalInstrumentedTest.java
?? android/app/src/main/java/com/zenflow/app/AndroidBackNavigationState.java
?? android/app/src/main/java/com/zenflow/app/AndroidBackPlugin.java
?? android/app/src/main/res/drawable/zenflow_edge_bleed_backdrop_dark.xml
?? android/app/src/main/res/values/edge_to_edge_dark_colors.xml
?? android/app/src/release/generated/baselineProfiles/baseline-prof.txt
?? android/app/src/release/generated/baselineProfiles/startup-prof.txt
?? android/app/src/test/java/com/zenflow/app/AndroidBackNavigationStateTest.java
?? android/baselineprofile/build.gradle
?? android/baselineprofile/src/main/AndroidManifest.xml
?? android/baselineprofile/src/main/java/com/zenflow/benchmark/BaselineProfileGenerator.kt
?? android/baselineprofile/src/main/java/com/zenflow/benchmark/ZenFlowJourneys.kt
?? android/baselineprofile/src/main/java/com/zenflow/benchmark/ZenFlowMacrobenchmark.kt
?? android/baselineprofile/src/main/res/values/styles.xml
?? docs/release/ANDROID_2_1_RUNBOOK.md
?? docs/release/android-2.1-back-matrix.json
?? docs/release/android-2.1-performance-evidence.json
?? docs/release/android-2.1-reflow-inventory.json
?? docs/release/android-2.1-runtime-evidence.json
?? docs/release/android-2.1-visual-evidence.json
?? docs/security/GITLEAKS_TRIAGE_2026-08-09.md
?? e2e/android-v2-destination-matrix.spec.ts
?? e2e/automation-pwa-update.spec.ts
?? e2e/calendar-reflow.spec.ts
?? e2e/global-schedule-bar-reflow.spec.ts
?? e2e/habit-streak-timeline-reflow.spec.ts
?? e2e/habits-social-entry-reflow.spec.ts
?? e2e/helpers/android-automation-lifecycle/process-death-smoke.ts
?? e2e/helpers/automation-lifecycle/indexedDbFixture.ts
?? e2e/helpers/calendar-reflow/index.html
?? e2e/helpers/calendar-reflow/main.tsx
?? e2e/helpers/calendar-reflow/playwright.config.ts
?? e2e/helpers/global-schedule-bar-reflow/capture-api36.ts
?? e2e/helpers/global-schedule-bar-reflow/index.html
?? e2e/helpers/global-schedule-bar-reflow/main.tsx
?? e2e/helpers/global-schedule-bar-reflow/playwright.config.ts
?? e2e/helpers/habit-streak-timeline-reflow/capture-api36.ts
?? e2e/helpers/habit-streak-timeline-reflow/index.html
?? e2e/helpers/habit-streak-timeline-reflow/main.tsx
?? e2e/helpers/habit-streak-timeline-reflow/playwright.config.ts
?? e2e/helpers/language-selector-reflow/index.html
?? e2e/helpers/language-selector-reflow/main.tsx
?? e2e/helpers/language-selector-reflow/playwright.config.ts
?? e2e/helpers/leaderboard-entry-row-reflow/capture-api36.ts
?? e2e/helpers/leaderboard-entry-row-reflow/index.html
?? e2e/helpers/leaderboard-entry-row-reflow/main.tsx
?? e2e/helpers/leaderboard-entry-row-reflow/playwright.config.ts
?? e2e/helpers/participants-leaderboard-reflow/capture-api36.ts
?? e2e/helpers/participants-leaderboard-reflow/challengeServiceStub.ts
?? e2e/helpers/participants-leaderboard-reflow/index.html
?? e2e/helpers/participants-leaderboard-reflow/main.tsx
?? e2e/helpers/participants-leaderboard-reflow/playwright.config.ts
?? e2e/helpers/participants-leaderboard-reflow/vite.config.ts
?? e2e/helpers/pwa-update/playwright.config.ts
?? e2e/helpers/pwa-update/prepare-artifacts.mjs
?? e2e/helpers/pwa-update/serve-pwa-update.mjs
?? e2e/helpers/storage-incident-reflow/index.html
?? e2e/helpers/storage-incident-reflow/main.tsx
?? e2e/helpers/t150-visual/index.html
?? e2e/helpers/t150-visual/main.tsx
?? e2e/language-selector-reflow.spec.ts
?? e2e/leaderboard-entry-row-reflow.spec.ts
?? e2e/participants-leaderboard-reflow.spec.ts
?? e2e/storage-incident-reflow.spec.ts
?? patches/@capacitor-community+admob+8.0.0.patch
?? scripts/__tests__/admobReleaseConfig.test.ts
?? scripts/__tests__/android-release-config.test.ts
?? scripts/__tests__/android21ForwardRollback.test.ts
?? scripts/__tests__/androidBackMatrix.test.ts
?? scripts/__tests__/androidBaselineProfileContract.test.ts
?? scripts/__tests__/automationMigrationContract.test.ts
?? scripts/__tests__/localeAssetPlugin.test.ts
?? scripts/check-admob-release-config.cjs
?? scripts/check-android-release-config.cjs
?? specs/002-android-2-1-connected-release/ads-data-safety-evidence.md
?? specs/002-android-2-1-connected-release/analysis.md
?? specs/002-android-2-1-connected-release/checklists/ads-release.md
?? specs/002-android-2-1-connected-release/checklists/android-ux.md
?? specs/002-android-2-1-connected-release/checklists/data-sync-security.md
?? specs/002-android-2-1-connected-release/checklists/requirements.md
?? specs/002-android-2-1-connected-release/checklists/verification-operations.md
?? specs/002-android-2-1-connected-release/contracts/automation-transaction.schema.json
?? specs/002-android-2-1-connected-release/contracts/legal-admob-truth.md
?? specs/002-android-2-1-connected-release/contracts/non-orb-motion.md
?? specs/002-android-2-1-connected-release/contracts/social-invitations.md
?? specs/002-android-2-1-connected-release/contracts/storage-incident-reflow.md
?? specs/002-android-2-1-connected-release/convergence.md
?? specs/002-android-2-1-connected-release/data-model.md
?? specs/002-android-2-1-connected-release/handoff.md
?? specs/002-android-2-1-connected-release/people-first-app-threat-model.md
?? specs/002-android-2-1-connected-release/plan.md
?? specs/002-android-2-1-connected-release/quickstart.md
?? specs/002-android-2-1-connected-release/research.md
?? specs/002-android-2-1-connected-release/spec.md
?? specs/002-android-2-1-connected-release/tasks.md
?? src/components/__tests__/GlobalScheduleBar.test.tsx
?? src/components/__tests__/StorageIncidentBanner.reflow.test.tsx
?? src/components/challenges/__tests__/ChallengeDetailsProgressCopy.test.ts
?? src/components/challenges/__tests__/JoinChallengeView.authoritativeJoin.test.tsx
?? src/components/friends-panel/__tests__/useFriendForm.invite.test.tsx
?? src/components/friends-panel/__tests__/useFriendsData.publication.test.tsx
?? src/components/leaderboard/__tests__/LeaderboardEntryRow.reflow.test.ts
?? src/components/navigation-v2/V2ConnectedHistoryAction.tsx
?? src/components/schedule/__tests__/ScheduleCompletedState.test.tsx
?? src/components/state-of-mind/__tests__/orbStartupPolicy.test.ts
?? src/components/state-of-mind/orbStartupPolicy.ts
?? src/components/stats/__tests__/CalendarScrollRegions.reflow.test.tsx
?? src/contexts/__tests__/AdContext.rewardSettlement.test.tsx
?? src/features/ads/__tests__/rewardedAttemptLedger.test.ts
?? src/features/ads/__tests__/useAdPremiumStatus.test.tsx
?? src/features/ads/index.ts
?? src/features/ads/rewardedAttemptLedger.ts
?? src/features/ads/useAdPremiumStatus.ts
?? src/features/automation/AutomationHistorySheet.tsx
?? src/features/automation/ConnectedRecordsSettings.tsx
?? src/features/automation/HabitPlanningMappingsField.tsx
?? src/features/automation/V2ConnectedHistoryLayer.tsx
?? src/features/automation/__tests__/AutomationHistorySheet.test.tsx
?? src/features/automation/__tests__/ConnectedRecordsSettings.test.tsx
?? src/features/automation/__tests__/automationCloud.test.ts
?? src/features/automation/__tests__/automationCoordinator.test.ts
?? src/features/automation/__tests__/automationGate.test.ts
?? src/features/automation/__tests__/automationHistoryClear.test.ts
?? src/features/automation/__tests__/automationHistoryPrivacy.test.ts
?? src/features/automation/__tests__/automationOutbox.restart.test.ts
?? src/features/automation/__tests__/automationPlanner.test.ts
?? src/features/automation/__tests__/automationPreferences.test.ts
?? src/features/automation/__tests__/automationRepository.atomic.test.ts
?? src/features/automation/__tests__/automationRepository.boundary.test.ts
?? src/features/automation/__tests__/automationRepository.idempotency.test.ts
?? src/features/automation/__tests__/automationRepository.queue.test.ts
?? src/features/automation/__tests__/automationRpcContracts.test.ts
?? src/features/automation/__tests__/automationRuntime.test.ts
?? src/features/automation/__tests__/automationSchemas.test.ts
?? src/features/automation/__tests__/automationServiceControl.test.ts
?? src/features/automation/__tests__/automationSourcePersistence.test.ts
?? src/features/automation/__tests__/automationUndo.test.ts
?? src/features/automation/__tests__/connectedRecords.integration.test.ts
?? src/features/automation/__tests__/revisionCrypto.test.ts
?? src/features/automation/__tests__/ruleCatalog.test.ts
?? src/features/automation/__tests__/sourceKey.test.ts
?? src/features/automation/__tests__/useAutomation.test.tsx
?? src/features/automation/automationBootstrap.ts
?? src/features/automation/automationCloud.ts
?? src/features/automation/automationCoordinator.ts
?? src/features/automation/automationGate.ts
?? src/features/automation/automationHistoryClear.ts
?? src/features/automation/automationOperationLock.ts
?? src/features/automation/automationPreferences.ts
?? src/features/automation/automationRemoteSync.ts
?? src/features/automation/automationRepository.ts
?? src/features/automation/automationRuntime.ts
?? src/features/automation/automationRuntimeSignals.ts
?? src/features/automation/automationServiceControl.ts
?? src/features/automation/automationSourcePersistence.ts
?? src/features/automation/automationUndo.ts
?? src/features/automation/canonicalJson.ts
?? src/features/automation/connectedRecordsUiRules.ts
?? src/features/automation/deterministicId.ts
?? src/features/automation/index.ts
?? src/features/automation/planner.ts
?? src/features/automation/plannerContracts.ts
?? src/features/automation/planners/focusToHabit.ts
?? src/features/automation/planners/habitToPlanning.ts
?? src/features/automation/planners/journalToMood.ts
?? src/features/automation/planners/moodToJournal.ts
?? src/features/automation/revisionCrypto.ts
?? src/features/automation/ruleCatalog.ts
?? src/features/automation/sourceKey.ts
?? src/features/automation/types.ts
?? src/features/automation/useAutomation.ts
?? src/features/journal/__tests__/gratitudeProjection.atomic.test.ts
?? src/features/journal/__tests__/journalMonthRange.test.ts
?? src/features/journal/__tests__/journalSecurityAutomationHistory.test.ts
?? src/features/journal/__tests__/journalStorage.automation.test.ts
?? src/features/journal/journalAutomationVaultGuard.ts
?? src/hooks/__tests__/useFocusHandlers.automation.test.ts
?? src/hooks/__tests__/useHabitHandlers.automation.test.ts
?? src/hooks/__tests__/useIndexedDB.timeoutDiagnostics.test.tsx
?? src/hooks/__tests__/useMoodHandlers.automation.test.ts
?? src/i18n/__tests__/connectedRecordsCopy.test.ts
?? src/i18n/__tests__/localeAssetRuntime.test.ts
?? src/i18n/localeAssetRuntime.ts
?? src/lib/__tests__/adController.ump.test.ts
?? src/lib/__tests__/ambientSounds.androidEagerUnlock.test.ts
?? src/lib/__tests__/android16NativeContract.test.ts
?? src/lib/__tests__/androidAdaptiveWindowContract.test.ts
?? src/lib/__tests__/androidBackBridgeState.test.ts
?? src/lib/__tests__/androidPredictiveBackBridge.test.ts
?? src/lib/__tests__/androidSocialInviteContract.test.ts
?? src/lib/__tests__/challengeService.invite.test.ts
?? src/lib/__tests__/diagnosticPrivacy.test.ts
?? src/lib/__tests__/offlineQueuePriority.test.ts
?? src/lib/__tests__/rewardedAdsGate.test.ts
?? src/lib/__tests__/socialInvite.test.ts
?? src/lib/androidBackBridge.ts
?? src/lib/diagnosticPrivacy.ts
?? src/lib/habitEntryCommit.ts
?? src/lib/rewardedAdsGate.ts
?? src/lib/socialInvite.ts
?? src/pages/nav-v2/habits/__tests__/HabitCreateSheet.keyboard.test.tsx
?? src/pages/nav-v2/habits/__tests__/habitKeyboardViewport.test.ts
?? src/pages/nav-v2/habits/habitKeyboardViewport.ts
?? src/pages/nav-v2/habits/hero/__tests__/HabitActionSheet.back.test.tsx
?? src/storage/__tests__/automationUndoTombstones.test.ts
?? src/storage/__tests__/backupAutomation.test.ts
?? src/storage/__tests__/dbAutomation.test.ts
?? src/storage/__tests__/eventSyncAutomationTransaction.test.ts
?? src/storage/__tests__/initialDeltaSyncAutomation.test.ts
?? src/storage/__tests__/journalEventPrivacy.test.ts
?? src/storage/sync/__tests__/settingSyncPolicy.test.ts
?? supabase/functions/rewarded-ads-gate/gateResponse.test.ts
?? supabase/functions/rewarded-ads-gate/gateResponse.ts
?? supabase/functions/rewarded-ads-gate/index.ts
?? supabase/migrations/20260808000000_automation_transaction_ledger.sql
?? supabase/migrations/20260808010000_journal_sync_event_privacy.sql
?? tools/release/android21-reflow-inventory.mjs
?? vite-plugin-locale-assets.ts
```

## Tracked diff numstat

This section excludes untracked file content and records the pre-recovery tracked diff only.

```text
2	2	.codex/hooks.json
1	1	.codex/hooks/production-data-integrity-gate.cjs
7	2	.env.example
12	0	.gitleaksignore
1	1	.specify/feature.json
16	16	ARCHITECTURE.md
54	14	android/app/build.gradle
0	26	android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java
5	4	android/app/src/main/AndroidManifest.xml
10	14	android/app/src/main/java/com/zenflow/app/MainActivity.java
41	31	android/app/src/main/java/com/zenflow/app/StatusBarStylePlugin.java
1	0	android/build.gradle
2	1	android/settings.gradle
5	1	android/variables.gradle
8	0	capacitor.config.ts
87	69	docs/AD_SYSTEM_JOURNEY.md
2	2	docs/adr/0010-production-data-integrity-enforcement.md
17	17	docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md
30	30	docs/release/google-play/ADMOB_EXTERNAL_READINESS.json
13	13	docs/release/google-play/ADMOB_OWNER_FINALIZATION_RUNBOOK.md
25	5	e2e/nav-v2-settings.spec.ts
2	0	e2e/orb-renderer-lifecycle.spec.ts
118	235	package-lock.json
13	9	package.json
0	22	patches/brace-expansion+5.0.8.patch
45	13	scripts/__tests__/admob-owner-evidence-apply.test.ts
23	3	scripts/__tests__/admob-owner-next-steps.test.ts
11	22	scripts/__tests__/admob-production-readiness.test.ts
6	6	scripts/__tests__/agent-workspace.test.ts
35	3	scripts/__tests__/production-data-integrity-hook.test.ts
268	134	scripts/__tests__/production-data-integrity.test.ts
27	3	scripts/check-admob-production-readiness.cjs
3	3	scripts/generate-admob-owner-next-steps.cjs
36	2	scripts/production-data-integrity/core.cjs
41	12	src/__tests__/IntentionalSingleLineTextContract.test.ts
1	1	src/__tests__/MoodTransientTextReflow.static.test.ts
58	49	src/components/ChallengeModal.tsx
26	0	src/components/EntryGate.css
1	6	src/components/EntryGateBackdrop.tsx
54	5	src/components/EntryThemeSwitcher.tsx
15	31	src/components/ErrorBoundary.tsx
1	7	src/components/FocusReflectionModal.tsx
71	47	src/components/GlobalScheduleBar.tsx
4	4	src/components/LanguageSelector.tsx
1	2	src/components/OfflineBanner.tsx
9	6	src/components/SplashScreen.tsx
35	3	src/components/StorageErrorBanner.tsx
18	5	src/components/StorageIncidentBanner.tsx
1	4	src/components/UpdatePrompt.tsx
13	0	src/components/__tests__/AuthGate.test.tsx
25	0	src/components/__tests__/EntryGate.safeArea.test.ts
54	6	src/components/__tests__/EntryThemeSwitcher.test.tsx
8	1	src/components/__tests__/EssentialCardTextReflow.static.test.ts
9	1	src/components/__tests__/FeedbackForm.a11y.test.tsx
12	3	src/components/__tests__/LanguageSelector.test.tsx
12	10	src/components/__tests__/LegacyModalViewportRecovery.static.test.ts
1	3	src/components/__tests__/OfflineBanner.test.tsx
33	0	src/components/__tests__/SplashScreen.test.tsx
3	3	src/components/__tests__/StorageErrorBanner.pushRevocation.test.tsx
11	33	src/components/ads/RewardedAdPrompt.tsx
15	5	src/components/ads/__tests__/RewardedAdPrompt.uxContract.test.tsx
7	1	src/components/auth-screen/AuthScreen.tsx
7	2	src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx
1	4	src/components/breathing-exercise/PatternSelector.tsx
45	27	src/components/challenges/ChallengeDetailsView.tsx
60	25	src/components/challenges/ChallengesListView.tsx
54	44	src/components/challenges/JoinChallengeView.tsx
98	73	src/components/challenges/ParticipantsLeaderboard.tsx
2	14	src/components/focus-timer/CosmicBackground.tsx
84	28	src/components/friends-panel/FriendsPanel.tsx
2	0	src/components/friends-panel/types.ts
33	5	src/components/friends-panel/useFriendForm.ts
27	14	src/components/friends-panel/useFriendsData.ts
11	17	src/components/habit-creation-form/HabitCreationForm.tsx
49	20	src/components/habit-hub/HabitStreakTimeline.tsx
7	1	src/components/habit-hub/__tests__/HabitHubTypographyReflow.static.test.ts
1	9	src/components/habit-tracker/HabitTracker.tsx
2	15	src/components/hyperfocus/HyperfocusBackground.tsx
2	7	src/components/hyperfocus/HyperfocusMode.tsx
37	14	src/components/leaderboard/LeaderboardEntryRow.tsx
10	0	src/components/navigation-v2/DrawerV2.tsx
61	49	src/components/navigation-v2/NavV2Orchestrator.tsx
10	0	src/components/navigation-v2/SidebarV2.tsx
1	2	src/components/navigation-v2/ThemeToggleV2.tsx
20	4	src/components/navigation-v2/V2FocusMiniPlayer.tsx
47	1	src/components/navigation-v2/V2ProgressionModalLayer.tsx
25	0	src/components/navigation-v2/__tests__/DrawerV2.test.tsx
212	12	src/components/navigation-v2/__tests__/NavV2Orchestrator.test.tsx
24	0	src/components/navigation-v2/__tests__/SidebarV2.test.tsx
2	3	src/components/navigation-v2/__tests__/ThemeToggleV2.test.tsx
70	2	src/components/navigation-v2/__tests__/V2FocusMiniPlayer.test.tsx
1	0	src/components/navigation-v2/__tests__/integration.keyboardNav.test.tsx
13	4	src/components/schedule/AddEventModal.tsx
68	34	src/components/schedule/EventDetailsModal.tsx
2	0	src/components/schedule/ScheduleTimeline.tsx
35	17	src/components/schedule/ScheduleVisuals.tsx
25	10	src/components/schedule/TimelineDayColumn.tsx
5	3	src/components/schedule/__tests__/timelineRtlScroll.test.ts
19	5	src/components/schedule/useScheduleData.ts
8	3	src/components/stats/CalendarGrid.tsx
1	2	src/components/stats/DataMountains.tsx
17	11	src/components/stats/HabitCalendar.tsx
2	10	src/components/stats/emotion-galaxy/EmotionGalaxy.tsx
30	2	src/components/storageErrorIncidentState.ts
2	2	src/components/ui/__tests__/switch.rtl.test.tsx
2	2	src/components/ui/dialog.tsx
1	4	src/components/ui/switch.tsx
103	49	src/contexts/AdContext.tsx
2	1	src/contexts/__tests__/AdContext.privacyOptions.test.tsx
3	15	src/features/journal/JournalAudioPlayer.tsx
2	9	src/features/journal/JournalCalendar.tsx
6	5	src/features/journal/JournalEntryEditor.tsx
4	29	src/features/journal/JournalEntryList.tsx
5	5	src/features/journal/JournalModule.tsx
2	12	src/features/journal/MemoryPortalCanvas.tsx
1	4	src/features/journal/__tests__/JournalAudioPlayer.lifecycle.test.tsx
10	2	src/features/journal/__tests__/JournalFinalReviewContracts.static.test.ts
20	0	src/features/journal/__tests__/journalCrypto.test.ts
2	5	src/features/journal/__tests__/journalHubStorage.test.ts
72	0	src/features/journal/__tests__/journalSecurityMigration.test.ts
29	0	src/features/journal/__tests__/useJournalEditorState.recordingSave.test.tsx
35	3	src/features/journal/journalCrypto.ts
39	0	src/features/journal/journalDateUtils.ts
11	17	src/features/journal/journalHubStorage.ts
5	0	src/features/journal/journalSecurityMigration.ts
42	3	src/features/journal/journalStorage.ts
20	0	src/features/journal/useJournalEditorState.ts
46	20	src/hooks/__tests__/useDeepLinkHandler.test.ts
24	12	src/hooks/__tests__/useFocusHandlers.test.ts
30	6	src/hooks/__tests__/useHabitHandlers.test.ts
43	21	src/hooks/__tests__/useMoodHandlers.test.ts
40	0	src/hooks/__tests__/useNavigationV2.test.ts
38	16	src/hooks/useAppLifecycle.ts
43	32	src/hooks/useDeepLinkHandler.ts
17	2	src/hooks/useDeviceTier.test.ts
3	1	src/hooks/useDeviceTier.ts
99	42	src/hooks/useFocusHandlers.ts
185	170	src/hooks/useHabitHandlers.ts
49	15	src/hooks/useIndexedDB.ts
0	3	src/hooks/useModalState.ts
63	39	src/hooks/useMoodHandlers.ts
49	5	src/hooks/useNavigationV2.ts
6	2	src/i18n/index.ts
96	0	src/i18n/languages/ar.ts
103	5	src/i18n/languages/de.ts
98	0	src/i18n/languages/en.ts
98	0	src/i18n/languages/es.ts
98	0	src/i18n/languages/fr.ts
97	0	src/i18n/languages/he.ts
96	0	src/i18n/languages/ja.ts
98	0	src/i18n/languages/uk.ts
86	0	src/i18n/types.ts
229	2	src/index.css
16	0	src/lib/__tests__/a11y.test.ts
6	9	src/lib/__tests__/adConfig.test.ts
282	29	src/lib/__tests__/adController.nativeAdMob.test.ts
17	7	src/lib/__tests__/adController.test.ts
27	0	src/lib/__tests__/ambientSounds.test.ts
193	11	src/lib/__tests__/androidBackHandler.test.ts
98	133	src/lib/__tests__/crashReporting.test.ts
9	16	src/lib/__tests__/env.test.ts
17	11	src/lib/__tests__/errorBuffer.test.ts
154	15	src/lib/__tests__/friendChallenge.test.ts
25	1	src/lib/__tests__/habitScheduleSync.test.ts
10	0	src/lib/__tests__/journalContentSession.crossTab.test.ts
38	131	src/lib/__tests__/logger.test.ts
141	3	src/lib/__tests__/offlineQueue.accountBoundary.test.ts
159	2	src/lib/__tests__/offlineQueueHandlers.test.ts
1	0	src/lib/__tests__/runtimePerformanceGuards.test.ts
27	28	src/lib/__tests__/sentryPrivacy.test.ts
25	0	src/lib/__tests__/syncBroadcast.test.ts
1	1	src/lib/a11y.ts
6	12	src/lib/adConfig.ts
254	63	src/lib/adController.ts
80	0	src/lib/ambientSounds.ts
120	160	src/lib/androidBackHandler.ts
1	1	src/lib/appVersion.ts
51	0	src/lib/challengeService.ts
65	78	src/lib/crashReporting.ts
30	3	src/lib/env.ts
17	2	src/lib/errorBuffer.ts
83	85	src/lib/friendChallenge.ts
7	1	src/lib/habitScheduleSync.ts
10	0	src/lib/journalContentSession.ts
15	76	src/lib/logger.ts
183	20	src/lib/offlineQueue.ts
59	4	src/lib/offlineQueueHandlers.ts
10	4	src/lib/schemas.ts
82	149	src/lib/sentry.ts
1	0	src/lib/storageKeys.ts
2	0	src/lib/syncBroadcast.ts
11	9	src/main.tsx
10	4	src/pages/Index.tsx
2	1	src/pages/__tests__/IndexV2NoXpAudioContract.test.ts
189	0	src/pages/nav-v2/DayCosmicBackground.css
1	1	src/pages/nav-v2/MoodFirstRunHint.css
14	11	src/pages/nav-v2/MoodFirstRunHint.tsx
100	27	src/pages/nav-v2/OrbPage.tsx
52	13	src/pages/nav-v2/OrbPageSteps.tsx
138	0	src/pages/nav-v2/__tests__/DayCosmicBackground.test.tsx
35	1	src/pages/nav-v2/__tests__/MoodFirstRunHint.test.tsx
64	6	src/pages/nav-v2/__tests__/OrbPage.test.tsx
28	8	src/pages/nav-v2/__tests__/SettingsPage.test.tsx
30	1	src/pages/nav-v2/__tests__/androidEdgeToEdgeContract.test.ts
32	2	src/pages/nav-v2/__tests__/planningFocusTransferContract.test.ts
14	0	src/pages/nav-v2/__tests__/v2ReadabilityContract.test.ts
112	3	src/pages/nav-v2/habits/HabitCreateSheet.tsx
155	68	src/pages/nav-v2/habits/HabitsPage.tsx
15	0	src/pages/nav-v2/habits/__tests__/HabitCreateSheet.reflow.test.ts
30	5	src/pages/nav-v2/habits/__tests__/HabitsPage.test.tsx
24	7	src/pages/nav-v2/habits/__tests__/metrics-wiring.test.tsx
9	6	src/pages/nav-v2/habits/hero/HabitActionSheet.tsx
23	23	src/pages/nav-v2/habits/hero/HeroEmptyJourney.tsx
3	3	src/pages/nav-v2/habits/hero/__tests__/HabitActionSheet.test.tsx
12	7	src/pages/nav-v2/habits/hero/__tests__/HeroEmptyJourney.test.tsx
4	1	src/pages/nav-v2/planning/PlanningPage.tsx
8	6	src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx
8	2	src/pages/nav-v2/settings/__tests__/SettingsTextReflow.test.tsx
23	0	src/pages/nav-v2/settings/__tests__/V2SettingsFormPrimitives.test.tsx
4	4	src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx
4	2	src/pages/nav-v2/settings/components/V2SettingsFormPrimitives.tsx
1	0	src/pages/nav-v2/settings/components/V2SettingsPrimitiveTypes.ts
2	2	src/pages/nav-v2/useOrbMoodFlow.ts
137	0	src/storage/__tests__/eventSync.test.ts
113	7	src/storage/__tests__/friendsSync.test.ts
27	0	src/storage/__tests__/initialDeltaSync.test.ts
371	40	src/storage/backup.ts
45	0	src/storage/db.ts
283	24	src/storage/eventSync.ts
162	74	src/storage/friendsSync.ts
46	16	src/storage/initialDeltaSync.ts
13	0	src/storage/sync/__tests__/syncSettings.test.ts
8	1	src/storage/sync/settingSyncPolicy.ts
31	0	src/stores/__tests__/userDataStore.test.ts
4	0	src/stores/uiStore.ts
24	0	src/stores/userDataStore.ts
18	13	src/styles/__tests__/themes.test.ts
8	0	src/styles/themes.css
8	5	src/sw.ts
2	0	src/types/index.ts
3	0	supabase/config.toml
1	0	tsconfig.eslint.json
3	0	vite.config.ts
```

## Evidence boundary

This is a file/path and tracked-line-count receipt, not a semantic review, test result, authorship claim, secret scan, runtime result or release approval. The recovery planning files created after capture are intentionally absent from this snapshot.
