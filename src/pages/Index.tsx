import { Suspense, useEffect, useMemo, useState } from "react";
import { Bloom } from "@/lib/motion";
import { morph } from "@/lib/motion/morph";
import { staggerDelay } from "@/lib/motion/choreography";
import { useDesignFlag } from "@/hooks/useDesignFlag";
import { NavV2Orchestrator } from "@/components/navigation-v2/NavV2Orchestrator";
import {
  useUIStore,
  selectAnyModalOpen,
  useHydrateGamification,
  useUserDataStore,
  useHydrateUserData,
} from "@/stores";
import { useAppLifecycle } from "@/hooks/useAppLifecycle";
import { useDateTracking } from "@/hooks/useDateTracking";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useNotificationSetup } from "@/hooks/useNotificationSetup";
import { useOnboardingEffects } from "@/hooks/useOnboardingEffects";
import { useCloudSyncEffects } from "@/hooks/useCloudSyncEffects";
import { useDeltaSyncEffects } from "@/hooks/useDeltaSyncEffects";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
import { useWeeklyReportTrigger } from "@/hooks/useWeeklyReportTrigger";
import { useChallengeHandlers } from "@/hooks/useChallengeHandlers";
import { useMoodHandlers } from "@/hooks/useMoodHandlers";
import { useHabitHandlers } from "@/hooks/useHabitHandlers";
import { useFocusHandlers } from "@/hooks/useFocusHandlers";
import { useGratitudeHandlers } from "@/hooks/useGratitudeHandlers";
import { useDerivedData } from "@/hooks/useDerivedData";
import { useSettingsHandlers } from "@/hooks/useSettingsHandlers";
import { useReminderMigration } from "@/hooks/useReminderMigration";
import { useEmotionSync } from "@/hooks/useEmotionSync";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdProvider } from "@/contexts/AdContext";
import { MoodBackgroundOverlay } from "@/components/MoodBackgroundOverlay";
import { supabase } from "@/lib/supabaseClient";
import { useTabNavigation } from "@/hooks/useTabNavigation";
import { useSectionNavigation } from "@/hooks/useSectionNavigation";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { ModalLayer } from "@/components/ModalLayer";
import { Navigation } from "@/components/Navigation";
import { OverlayLayer } from "@/components/OverlayLayer";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AuthGate } from "@/components/AuthGate";
import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";
import { HomeTab } from "@/components/tabs/HomeTab";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { LazyErrorBoundary } from "@/components/ErrorBoundary";

const GardenTab = lazyWithRetry(
  () =>
    import("@/components/tabs/GardenTab").then((m) => ({
      default: m.GardenTab,
    })),
  "GardenTab"
);
const StatsTab = lazyWithRetry(
  () => import("@/components/tabs/StatsTab").then((m) => ({ default: m.StatsTab })),
  "StatsTab"
);
const AchievementsTab = lazyWithRetry(
  () =>
    import("@/components/tabs/AchievementsTab").then((m) => ({
      default: m.AchievementsTab,
    })),
  "AchievementsTab"
);
const SettingsTab = lazyWithRetry(
  () =>
    import("@/components/tabs/SettingsTab").then((m) => ({
      default: m.SettingsTab,
    })),
  "SettingsTab"
);
const MindMapTab = lazyWithRetry(
  () =>
    import("@/components/tabs/MindMapTab").then((m) => ({
      default: m.MindMapTab,
    })),
  "MindMapTab"
);
const HabitHubTab = lazyWithRetry(
  () => import("@/components/habit-hub").then((m) => ({ default: m.HabitHubTab })),
  "HabitHubTab"
);
const CommandPalette = lazyWithRetry(
  () => import("@/components/desktop/CommandPalette"),
  "CommandPalette"
);
import { useCanvasHandlers } from "@/hooks/useCanvasHandlers";
import { useGamification } from "@/hooks/useGamification";
import { useWidgetSync } from "@/hooks/useWidgetSync";
import { useInnerWorld } from "@/hooks/useInnerWorld";
import { getChallenges, getBadges } from "@/lib/challengeStorage";
import { GlobalScheduleBar } from "@/components/GlobalScheduleBar";
import { FocusMiniPlayer } from "@/components/FocusMiniPlayer";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { analytics } from "@/lib/analytics";

/**
 * Index — V1/V2 shell selector (Phase 3-A).
 *
 * V1 hooks are heavy (~40 hooks). To avoid Rules-of-Hooks violations from an
 * early-return flag gate, the V1 render path is isolated in <IndexV1Impl>.
 * This shell only checks the flag + query override and picks a branch.
 */
export function Index() {
  const navV2Flag = useDesignFlag("design.nav.v2");
  const navV2QueryOverride = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("nav") === "v2";
  }, []);

  if (navV2Flag || navV2QueryOverride) {
    return <NavV2Orchestrator />;
  }
  return <IndexV1Impl />;
}

/** V1 orchestrator — original 7-tab home. Unchanged from pre-Phase-3-A aside from rename. */
function IndexV1Impl() {
  const { t } = useLanguage();

  // Security: Auto-logout after 24h inactivity on web (disabled on native)
  useSessionTimeout(!!supabase);

  // Tab navigation (state, focus management, swipe gestures, feature flags)
  const {
    activeTab,
    setActiveTab,
    settingsOpenSection,
    handleTabChange: baseHandleTabChange,
    startTransition,
    mainRef,
    swipeProps,
    swipeContainerRef,
    quickActionTimeoutRef,
    CANVAS_ENABLED,
    HABIT_HUB_ENABLED,
  } = useTabNavigation();

  // Tab-change wrapped in Morph (View Transitions API). When the API is
  // unavailable (Firefox / older WebView) or reduced-motion is active,
  // `morph()` runs the callback directly — tab still switches, no freeze.
  const handleTabChange = (next: Parameters<typeof baseHandleTabChange>[0]) => {
    void morph(`tab-${next}`, () => {
      baseHandleTabChange(next);
    });
  };

  // Device tier for platform-adaptive behavior
  const { tier } = useDeviceTier();

  // Command palette state (Phase 4: full implementation)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Desktop/tablet keyboard shortcuts — all 14 registered, disabled on phone
  useKeyboardShortcuts(
    {
      "ctrl+1": () => handleTabChange("home"),
      "ctrl+2": () => handleTabChange("mindmap"),
      "ctrl+3": () => handleTabChange("garden"),
      "ctrl+4": () => handleTabChange("stats"),
      "ctrl+5": () => handleTabChange("settings"),
      "ctrl+b": () => undefined,
      "ctrl+,": () => handleTabChange("settings"),
      "ctrl+k": () => setCommandPaletteOpen((prev) => !prev),
      "ctrl+n": () => undefined,
      "ctrl+h": () => undefined,
      "ctrl+m": () => undefined,
      "ctrl+f": () => undefined,
      "ctrl+\\": () => undefined,
      escape: () => {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
      },
    },
    tier !== "phone"
  );

  // Extracted lifecycle hooks (from Step 1 decomposition)
  useAppLifecycle();
  useDateTracking();

  // Section-level navigation (scroll-to-section, quick actions)
  const { moodRef, handleNavigateToSection, handleQuickAction } = useSectionNavigation({
    setActiveTab,
    startTransition,
    quickActionTimeoutRef,
  });

  // Gamification system
  const { stats, gamificationState, userLevel, awardXp } = useGamification();

  // Inner World garden system
  const {
    world: innerWorld,
    isLoading: isLoadingInnerWorld,
    plantSeed,
    waterPlants,
    attractCreature,
    feedCreatures,
    earnTreats,
    isRestMode,
    activateRestMode,
    deactivateRestMode,
    canActivateRestMode,
  } = useInnerWorld();

  // Register gamification hooks into Zustand store (bridge pattern)
  useHydrateGamification({ awardXp, earnTreats, plantSeed, waterPlants });

  // Current focus minutes (real-time) from UI store
  const currentFocusMinutes = useUIStore((s) => s.currentFocusMinutes);
  const focusMiniPlayerActive = useUIStore((s) => s.focusIsRunning || s.focusEndTime !== null);

  const [challenges, setChallenges] = useState(() => getChallenges());
  const [badges, setBadges] = useState(() => getBadges());

  // Lock background scroll when any modal/panel is open (computed from UI store)
  const anyModalOpen = useUIStore(selectAnyModalOpen);
  useScrollLock(anyModalOpen);

  // ── User data from Zustand store (hydrated from IndexedDB via bridge hook) ──
  useHydrateUserData();
  const userName = useUserDataStore((s) => s.userName);
  const moods = useUserDataStore((s) => s.moods);
  const habits = useUserDataStore((s) => s.habits);
  const focusSessions = useUserDataStore((s) => s.focusSessions);
  const gratitudeEntries = useUserDataStore((s) => s.gratitudeEntries);
  const reminders = useUserDataStore((s) => s.reminders);
  const setReminders = useUserDataStore((s) => s.setReminders);
  const privacy = useUserDataStore((s) => s.privacy);
  const setPrivacy = useUserDataStore((s) => s.setPrivacy);
  // Initialize analytics when privacy settings change (or on first load)
  useEffect(() => {
    analytics.init(privacy);
  }, [privacy]);

  // Loading handling (IndexedDB fields from store + InnerWorld from hook)
  const isLoadingUserData = useUserDataStore((s) => s.isLoading);
  const isLoading = isLoadingUserData || isLoadingInnerWorld;

  // Auth session management (extracted to hook)
  useAuthSession(isLoading);

  // Challenge/feature unlock handlers (used by mood/habit/focus/gratitude handlers)
  const { checkForFeatureUnlocks, updateChallengeProgress } = useChallengeHandlers({
    safeMoods: moods,
    safeHabits: habits,
    safeFocusSessions: focusSessions,
    safeGratitudeEntries: gratitudeEntries,
    currentActiveStreak: innerWorld.currentActiveStreak,
    setChallenges,
    setBadges,
  });

  // Feature handlers (extracted from Index.tsx body)
  const { handleAddMood, handleQuickMood } = useMoodHandlers({
    updateChallengeProgress,
  });

  // Canvas / Mind Map (feature-flagged)
  const {
    canvasGoals,
    canvasMode,
    canvasRef,
    onRootTap,
    onCanvasBackgroundTap,
    onEmotionSelect,
    onGoalSelect,
    onEmotionSave,
    onEmotionCancel,
    onGoalCreate,
    onGoalToggle,
    onGoalDelete,
    onGoalUpdateIcon,
    onGoalUpdateEmoji,
    onGoalUpdateColor,
    onGoalCancel,
  } = useCanvasHandlers({ handleAddMood });
  const {
    handleToggleHabit,
    handleAdjustHabit,
    handleAddHabit,
    handleUpdateHabit,
    handleDeleteHabit,
    handleArchiveHabit,
    handleUnarchiveHabit,
    handleSkipHabit,
    handleUnskipHabit,
  } = useHabitHandlers({
    awardXp,
    earnTreats,
    plantSeed,
    waterPlants,
    updateChallengeProgress,
    checkForFeatureUnlocks,
  });
  const { handleCompleteFocusSession, handleMindfulMomentComplete } = useFocusHandlers({
    earnTreats,
    updateChallengeProgress,
    checkForFeatureUnlocks,
  });
  const { handleAddGratitude } = useGratitudeHandlers({
    earnTreats,
    attractCreature,
    feedCreatures,
    updateChallengeProgress,
  });

  // Register Android back button handler for modal panels (uses UI store)
  useEffect(() => {
    const unregister = registerModalCloseCallback(() => {
      return useUIStore.getState().tryCloseTopModal();
    });
    return unregister;
  }, []);

  // Reminder settings migration (old moodTime → 3-time format)
  useReminderMigration();

  // Derived data (schedule events, CTA system, widget data)
  const {
    allScheduleEvents,
    todayAllEvents,
    completedTodayCount,
    currentPrimaryCTA,
    todayFocusMinutes,
    lastBadgeName,
    widgetStreak,
  } = useDerivedData({ restDays: innerWorld.restDays || [] }, badges);

  // Sync widget with calculated streak (same as StreakBanner shows)
  // Wait for all data that affects streak to be loaded
  const isWidgetDataLoading = isLoadingUserData || isLoadingInnerWorld;

  // Derive latest mood emoji + label for widget sync
  const widgetMoodData = useMemo(() => {
    const MOOD_EMOJI: Record<string, string> = {
      great: "\u{1F604}", good: "\u{1F642}", okay: "\u{1F610}",
      bad: "\u{1F614}", terrible: "\u{1F622}",
    };
    const today = new Date().toISOString().slice(0, 10);
    const todayMoods = moods.filter(m => m.date === today);
    if (todayMoods.length === 0) return { emoji: undefined, label: undefined };
    const latest = todayMoods[todayMoods.length - 1];
    return { emoji: MOOD_EMOJI[latest.mood], label: latest.mood };
  }, [moods]);

  useWidgetSync(widgetStreak, habits, todayFocusMinutes, lastBadgeName, isWidgetDataLoading, widgetMoodData.emoji, widgetMoodData.label);

  // Settings/data management handlers
  const {
    handleResetData,
    handleNameChange,
    handlePullToRefresh,
    handleAddScheduleEvent,
    handleDeleteScheduleEvent,
  } = useSettingsHandlers(allScheduleEvents);

  // Emotion theme sync, onboarding, re-engagement, update check (extracted to hooks)
  useEmotionSync();
  useOnboardingEffects({
    isLoading,
    innerWorldStreak: innerWorld.currentActiveStreak,
    innerWorldRestDays: innerWorld.restDays || [],
  });
  useAppUpdateCheck(isLoading);
  useWeeklyReportTrigger(isLoading);

  // Notification setup (extracted to hook)
  useNotificationSetup({ handleQuickMood });

  // Cloud sync + quick actions (extracted to hook)
  useCloudSyncEffects({
    setChallenges,
    setBadges,
    handleNavigateToSection,
    quickActionTimeoutRef,
  });

  // Delta sync (Phase 3) — gated behind deltaSync feature flag
  useDeltaSyncEffects();

  // Deep link listener (auth + challenge URLs, extracted to hook)
  useDeepLinkHandler();

  return (
    <>
      {/* Offline banner outside AuthGate — visible even during loading */}
      <OfflineBanner />

      <AuthGate isLoading={isLoading}>
        <AdProvider
          onEarnTreats={(amount) => earnTreats("ad", amount, "Ad reward")}
          onEarnXp={() => awardXp("habit")}
          adConsent={true}
          isPremium={false}
        >
          <div className="min-h-screen zen-gradient-hero lg:ps-[var(--sidebar-width,256px)] motion-safe:transition-[padding] motion-safe:duration-300">
            {/* Skip to main content link for accessibility */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:start-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg"
            >
              {t.skipToContent || "Skip to main content"}
            </a>

            {/* Dynamic mood-based background overlay */}
            <MoodBackgroundOverlay />

            <OverlayLayer awardXp={awardXp} earnTreats={earnTreats} />

            {/* Command palette — Ctrl+K */}
            {commandPaletteOpen && (
              <Suspense fallback={null}>
                <CommandPalette
                  open={commandPaletteOpen}
                  onClose={() => setCommandPaletteOpen(false)}
                />
              </Suspense>
            )}

            {/* Swipe container for tab navigation on mobile */}
            <div ref={swipeContainerRef} {...swipeProps} className="min-h-screen">
              <main
                ref={mainRef}
                id="main-content"
                role="main"
                tabIndex={-1}
                className="mx-auto px-4 md:px-6 lg:px-10 xl:px-16 py-6 max-w-[var(--container-max-width)] lg:max-w-none outline-none"
                style={{
                  paddingBottom: focusMiniPlayerActive
                    ? "calc(var(--nav-height) + var(--safe-bottom) + 3.5rem)"
                    : "calc(var(--nav-height) + var(--safe-bottom))",
                }}
              >
                {/* Global Schedule Bar - visible on all tabs when events exist */}
                {/* v1.4.0: Use todayAllEvents to include both manual and habit-generated events */}
                {todayAllEvents.length > 0 &&
                  activeTab !== "settings" &&
                  activeTab !== "mindmap" && (
                    <div className="mb-4">
                      {/* A11Y-OK: GlobalScheduleBar renders its own button with aria-label internally */}
                      <GlobalScheduleBar
                        events={todayAllEvents}
                        onTap={() => startTransition(() => setActiveTab("garden"))}
                      />
                    </div>
                  )}

                <LazyErrorBoundary componentName="TabContent">
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center p-8">
                        <div className="motion-safe:animate-pulse h-64 w-full rounded-xl bg-muted" />
                      </div>
                    }
                  >
                    <Bloom
                      key={activeTab}
                      transition={staggerDelay('primary')}
                    >
                        {activeTab === "home" && (
                          <HomeTab
                            currentActiveStreak={innerWorld.currentActiveStreak}
                            isRestMode={isRestMode}
                            activateRestMode={activateRestMode}
                            deactivateRestMode={deactivateRestMode}
                            canActivateRestMode={canActivateRestMode}
                            completedTodayCount={completedTodayCount}
                            currentPrimaryCTA={currentPrimaryCTA}
                            handleAddMood={handleAddMood}
                            handlePullToRefresh={handlePullToRefresh}
                            moodRef={moodRef}
                          />
                        )}

                        {activeTab === "garden" && (
                          <GardenTab
                            todayAllEvents={todayAllEvents}
                            handleAddScheduleEvent={handleAddScheduleEvent}
                            handleDeleteScheduleEvent={handleDeleteScheduleEvent}
                            handleCompleteFocusSession={handleCompleteFocusSession}
                            onToggleHabit={handleToggleHabit}
                            onAddGratitude={handleAddGratitude}
                            handlePullToRefresh={handlePullToRefresh}
                          />
                        )}

                        {activeTab === "stats" && (
                          <StatsTab
                            restDays={innerWorld.restDays}
                            currentFocusMinutes={currentFocusMinutes}
                            onQuickAction={handleQuickAction}
                            handlePullToRefresh={handlePullToRefresh}
                          />
                        )}

                        {activeTab === "achievements" && (
                          <AchievementsTab
                            stats={stats}
                            unlockedAchievements={gamificationState.unlockedAchievements}
                            handlePullToRefresh={handlePullToRefresh}
                          />
                        )}

                        {activeTab === "settings" && (
                          <SettingsTab
                            userName={userName}
                            onNameChange={handleNameChange}
                            onResetData={handleResetData}
                            reminders={reminders}
                            onRemindersChange={setReminders}
                            privacy={privacy}
                            onPrivacyChange={setPrivacy}
                            initialOpenSection={settingsOpenSection}
                          />
                        )}

                        {activeTab === "mindmap" && HABIT_HUB_ENABLED && (
                          <HabitHubTab
                            habits={habits}
                            onToggleHabit={handleToggleHabit}
                            onAdjustHabit={handleAdjustHabit}
                            onAddHabit={handleAddHabit}
                            onDeleteHabit={handleDeleteHabit}
                            onUpdateHabit={handleUpdateHabit}
                            onArchiveHabit={handleArchiveHabit}
                            onUnarchiveHabit={handleUnarchiveHabit}
                            onSkipHabit={handleSkipHabit}
                            onUnskipHabit={handleUnskipHabit}
                          />
                        )}
                    </Bloom>
                  </Suspense>
                </LazyErrorBoundary>
              </main>
            </div>

            {/* MindMapTab — full-bleed canvas, outside swipe container */}
            {activeTab === "mindmap" && CANVAS_ENABLED && (
              <LazyErrorBoundary componentName="MindMapTab">
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center p-8">
                      <div className="motion-safe:animate-pulse h-64 w-full rounded-xl bg-muted" />
                    </div>
                  }
                >
                  <div className="fixed inset-0 z-30">
                    <MindMapTab
                      canvasGoals={canvasGoals}
                      canvasMode={canvasMode}
                      onRootTap={onRootTap}
                      onCanvasBackgroundTap={onCanvasBackgroundTap}
                      onEmotionSelect={onEmotionSelect}
                      onGoalSelect={onGoalSelect}
                      onEmotionSave={onEmotionSave}
                      onEmotionCancel={onEmotionCancel}
                      onGoalCreate={onGoalCreate}
                      onGoalToggle={onGoalToggle}
                      onGoalDelete={onGoalDelete}
                      onGoalUpdateIcon={onGoalUpdateIcon}
                      onGoalUpdateEmoji={onGoalUpdateEmoji}
                      onGoalUpdateColor={onGoalUpdateColor}
                      onGoalCancel={onGoalCancel}
                      canvasRef={canvasRef}
                    />
                  </div>
                </Suspense>
              </LazyErrorBoundary>
            )}

            {/* A11Y-OK: FocusMiniPlayer renders its own button with aria-label internally */}
            <FocusMiniPlayer
              onNavigateToTimer={() => startTransition(() => setActiveTab("garden"))}
            />
            <Navigation
              activeTab={activeTab}
              onTabChange={handleTabChange}
              canvasEnabled={CANVAS_ENABLED}
              habitHubEnabled={HABIT_HUB_ENABLED}
            />

            <ModalLayer
              challenges={challenges}
              setChallenges={setChallenges}
              setBadges={setBadges}
              awardXp={awardXp}
              earnTreats={earnTreats}
              handleMindfulMomentComplete={handleMindfulMomentComplete}
              handleAddScheduleEvent={handleAddScheduleEvent}
              currentStreak={innerWorld.currentActiveStreak}
              userLevel={userLevel.level}
            />
          </div>
        </AdProvider>
      </AuthGate>
    </>
  );
}

export default Index;
