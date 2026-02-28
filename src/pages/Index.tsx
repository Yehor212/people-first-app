import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore, useUIStore, selectAnyModalOpen, useHydrateGamification, useUserDataStore, useHydrateUserData, type TabType } from '@/stores';
import { useAppLifecycle } from '@/hooks/useAppLifecycle';
import { useDateTracking } from '@/hooks/useDateTracking';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useNotificationSetup } from '@/hooks/useNotificationSetup';
import { useOnboardingEffects } from '@/hooks/useOnboardingEffects';
import { useCloudSyncEffects } from '@/hooks/useCloudSyncEffects';
import { useAppUpdateCheck } from '@/hooks/useAppUpdateCheck';
import { useWeeklyReportTrigger } from '@/hooks/useWeeklyReportTrigger';
import { useChallengeHandlers } from '@/hooks/useChallengeHandlers';
import { useMoodHandlers } from '@/hooks/useMoodHandlers';
import { useHabitHandlers } from '@/hooks/useHabitHandlers';
import { useFocusHandlers } from '@/hooks/useFocusHandlers';
import { useGratitudeHandlers } from '@/hooks/useGratitudeHandlers';
import { useDerivedData } from '@/hooks/useDerivedData';
import { useSettingsHandlers } from '@/hooks/useSettingsHandlers';
import { useReminderMigration } from '@/hooks/useReminderMigration';
import { useEmotionSync } from '@/hooks/useEmotionSync';
import { useLanguage } from '@/contexts/LanguageContext';
import { AdProvider } from '@/contexts/AdContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { MoodBackgroundOverlay } from '@/components/MoodBackgroundOverlay';
import { supabase } from '@/lib/supabaseClient';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { registerModalCloseCallback } from '@/lib/androidBackHandler';
import { ModalLayer } from '@/components/ModalLayer';
import { Navigation } from '@/components/Navigation';
import { OverlayLayer } from '@/components/OverlayLayer';
import { AuthGate } from '@/components/AuthGate';
import { useDeepLinkHandler } from '@/hooks/useDeepLinkHandler';
import { HomeTab } from '@/components/tabs/HomeTab';
import { GardenTab } from '@/components/tabs/GardenTab';
import { StatsTab } from '@/components/tabs/StatsTab';
import { AchievementsTab } from '@/components/tabs/AchievementsTab';
import { SettingsTab } from '@/components/tabs/SettingsTab';
import { MindMapTab } from '@/components/tabs/MindMapTab';
import { HabitHubTab } from '@/components/habit-hub';
import { useCanvasHandlers } from '@/hooks/useCanvasHandlers';
import { useGamification } from '@/hooks/useGamification';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { useInnerWorld } from '@/hooks/useInnerWorld';
import { getChallenges, getBadges } from '@/lib/challengeStorage';
import { GlobalScheduleBar } from '@/components/GlobalScheduleBar';
import { FocusMiniPlayer } from '@/components/FocusMiniPlayer';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useScrollLock } from '@/hooks/useScrollLock';
import { analytics } from '@/lib/analytics';

export function Index() {
  const { t, isRTL } = useLanguage();
  const { isFeatureVisible } = useFeatureFlags();

  // Security: Auto-logout after 24h inactivity on web (disabled on native)
  useSessionTimeout(!!supabase);

  // Navigation state from Zustand (replaces useState + useEffect for settings clearing)
  const activeTab = useAppStore(s => s.activeTab);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const settingsOpenSection = useAppStore(s => s.settingsOpenSection);
  const quickActionTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (quickActionTimeoutRef.current) clearTimeout(quickActionTimeoutRef.current);
    };
  }, []);

  // Feature flags (must be before any usage)
  const CANVAS_ENABLED = false; // Kill-switch for mindmap tab rollout
  const HABIT_HUB_ENABLED = true; // Habit Hub replaces the Map tab

  // Swipe navigation for mobile tab switching (disabled on mindmap tab — canvas handles its own gestures)
  const SWIPE_TABS: TabType[] = ['home', ...(HABIT_HUB_ENABLED ? ['mindmap' as TabType] : []), 'garden', 'stats', 'settings'];
  const { containerProps: swipeProps, containerRef: swipeContainerRef } = useSwipeNavigation({
    activeTab,
    onTabChange: (tab: TabType) => setActiveTab(tab),
    tabs: SWIPE_TABS,
    threshold: 50,
    velocityThreshold: 0.3,
    isRTL,
    enabled: HABIT_HUB_ENABLED || activeTab !== 'mindmap',
  });

  // Extracted lifecycle hooks (from Step 1 decomposition)
  useAppLifecycle();
  useDateTracking();

  // Section refs for navigation
  const moodRef = useRef<HTMLDivElement>(null);
  const habitsRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const gratitudeRef = useRef<HTMLDivElement>(null);

  const handleNavigateToSection = useCallback((section: 'mood' | 'habits' | 'focus' | 'gratitude') => {
    const refs = { mood: moodRef, habits: habitsRef, focus: focusRef, gratitude: gratitudeRef };
    refs[section]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);


  // Gamification system
  const { stats, gamificationState, userLevel, awardXp } = useGamification();

  // Inner World garden system
  const {
    world: innerWorld,
    isLoading: isLoadingInnerWorld,
    plantSeed, waterPlants, attractCreature, feedCreatures,
    earnTreats,
    isRestMode, activateRestMode, deactivateRestMode,
    canActivateRestMode,
  } = useInnerWorld();

  // Register gamification hooks into Zustand store (bridge pattern)
  useHydrateGamification({ awardXp, earnTreats, plantSeed, waterPlants });


  // Current focus minutes (real-time) from UI store
  const currentFocusMinutes = useUIStore(s => s.currentFocusMinutes);
  const focusMiniPlayerActive = useUIStore(s => s.focusIsRunning || s.focusEndTime !== null);

  const [challenges, setChallenges] = useState(() => getChallenges());
  const [badges, setBadges] = useState(() => getBadges());

  // Lock background scroll when any modal/panel is open (computed from UI store)
  const anyModalOpen = useUIStore(selectAnyModalOpen);
  useScrollLock(anyModalOpen);

  // ── User data from Zustand store (hydrated from IndexedDB via bridge hook) ──
  useHydrateUserData();
  const userName = useUserDataStore(s => s.userName);
  const moods = useUserDataStore(s => s.moods);
  const habits = useUserDataStore(s => s.habits);
  const focusSessions = useUserDataStore(s => s.focusSessions);
  const gratitudeEntries = useUserDataStore(s => s.gratitudeEntries);
  const reminders = useUserDataStore(s => s.reminders);
  const setReminders = useUserDataStore(s => s.setReminders);
  const privacy = useUserDataStore(s => s.privacy);
  const setPrivacy = useUserDataStore(s => s.setPrivacy);
  // Initialize analytics when privacy settings change (or on first load)
  useEffect(() => {
    analytics.init(privacy);
  }, [privacy]);

  // Loading handling (IndexedDB fields from store + InnerWorld from hook)
  const isLoadingUserData = useUserDataStore(s => s.isLoading);
  const isLoading = isLoadingUserData || isLoadingInnerWorld;

  // Auth session management (extracted to hook)
  useAuthSession(isLoading);

  // Challenge/feature unlock handlers (used by mood/habit/focus/gratitude handlers)
  const { checkForFeatureUnlocks, updateChallengeProgress, handleOpenChallenge } = useChallengeHandlers({
    safeMoods: moods,
    safeHabits: habits,
    safeFocusSessions: focusSessions,
    safeGratitudeEntries: gratitudeEntries,
    currentActiveStreak: innerWorld.currentActiveStreak,
    setChallenges,
    setBadges,
  });

  // Feature handlers (extracted from Index.tsx body)
  const { handleAddMood, handleQuickMood } = useMoodHandlers({ updateChallengeProgress });

  // Canvas / Mind Map (feature-flagged)
  const {
    canvasGoals, canvasMode, canvasRef,
    onRootTap, onCanvasBackgroundTap,
    onEmotionSelect, onGoalSelect,
    onEmotionSave, onEmotionCancel,
    onGoalCreate, onGoalToggle, onGoalDelete,
    onGoalUpdateIcon, onGoalUpdateEmoji, onGoalUpdateColor,
    onGoalCancel,
  } = useCanvasHandlers({ handleAddMood });
  const { handleToggleHabit, handleAdjustHabit, handleAddHabit, handleUpdateHabit, handleDeleteHabit, handleArchiveHabit, handleUnarchiveHabit, handleSkipHabit, handleUnskipHabit } = useHabitHandlers({
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
  const { handleAddGratitude, handleJournalPromptUsed } = useGratitudeHandlers({
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
    allScheduleEvents, todayAllEvents,
    completedTodayCount, currentPrimaryCTA,
    todayFocusMinutes, lastBadgeName, widgetStreak,
  } = useDerivedData({ restDays: innerWorld.restDays || [] }, badges);

  // Sync widget with calculated streak (same as StreakBanner shows)
  // Wait for all data that affects streak to be loaded
  const isWidgetDataLoading = isLoadingUserData || isLoadingInnerWorld;
  useWidgetSync(widgetStreak, habits, todayFocusMinutes, lastBadgeName, isWidgetDataLoading);

  // Settings/data management handlers
  const { handleResetData, handleNameChange, handlePullToRefresh,
          handleAddScheduleEvent, handleDeleteScheduleEvent } = useSettingsHandlers(allScheduleEvents);

  // Emotion theme sync, onboarding, re-engagement, update check (extracted to hooks)
  useEmotionSync();
  useOnboardingEffects({ isLoading, innerWorldStreak: innerWorld.currentActiveStreak, innerWorldRestDays: innerWorld.restDays || [] });
  useAppUpdateCheck(isLoading);
  useWeeklyReportTrigger(isLoading);


  // Notification setup (extracted to hook)
  useNotificationSetup({ handleQuickMood });

  // Cloud sync + quick actions (extracted to hook)
  useCloudSyncEffects({ setChallenges, setBadges, handleNavigateToSection, quickActionTimeoutRef });

  // Deep link listener (auth + challenge URLs, extracted to hook)
  useDeepLinkHandler();

  return (
    <AuthGate isLoading={isLoading}>
    <AdProvider
      onEarnTreats={(amount) => earnTreats('ad', amount, 'Ad reward')}
      onEarnXp={() => awardXp('habit')}
      adConsent={true}
      isPremium={false}
    >
    <div className="min-h-screen zen-gradient-hero">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:start-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg"
      >
        {t.skipToContent || 'Skip to main content'}
      </a>

      {/* Dynamic mood-based background overlay */}
      <MoodBackgroundOverlay />

      <OverlayLayer
        awardXp={awardXp}
        earnTreats={earnTreats}
      />

      {/* Swipe container for tab navigation on mobile */}
      <div
        ref={swipeContainerRef}
        {...swipeProps}
        className="min-h-screen"
      >
        <main
          id="main-content"
          role="main"
          className="mx-auto px-4 py-6"
          style={{ maxWidth: 'var(--container-max-width)', paddingBottom: focusMiniPlayerActive ? 'calc(var(--nav-height) + var(--safe-bottom) + 3.5rem)' : 'calc(var(--nav-height) + var(--safe-bottom))' }}
        >
        {/* Global Schedule Bar - visible on all tabs when events exist */}
        {/* v1.4.0: Use todayAllEvents to include both manual and habit-generated events */}
        {todayAllEvents.length > 0 && activeTab !== 'settings' && activeTab !== 'mindmap' && (
          <div className="mb-4">
            <GlobalScheduleBar
              events={todayAllEvents}
              onTap={() => setActiveTab('garden')}
            />
          </div>
        )}

        {activeTab === 'home' && (
          <HomeTab
            safeMoods={moods}
            safeHabits={habits}
            safeFocusSessions={focusSessions}
            safeGratitudeEntries={gratitudeEntries}
            currentActiveStreak={innerWorld.currentActiveStreak}
            isRestMode={isRestMode}
            activateRestMode={activateRestMode}
            deactivateRestMode={deactivateRestMode}
            canActivateRestMode={canActivateRestMode}
            completedTodayCount={completedTodayCount}
            currentPrimaryCTA={currentPrimaryCTA}
            handleAddMood={handleAddMood}
            handleToggleHabit={handleToggleHabit}
            handleAdjustHabit={handleAdjustHabit}
            handleAddHabit={handleAddHabit}
            handleUpdateHabit={handleUpdateHabit}
            handleDeleteHabit={handleDeleteHabit}
            handleAddGratitude={handleAddGratitude}
            handleJournalPromptUsed={handleJournalPromptUsed}
            handleOpenChallenge={isFeatureVisible('challenges') ? handleOpenChallenge : undefined}
            handlePullToRefresh={handlePullToRefresh}
            moodRef={moodRef}
            habitsRef={habitsRef}
            gratitudeRef={gratitudeRef}
          />
        )}

        {activeTab === 'garden' && (
          <GardenTab
            safeMoods={moods}
            safeHabits={habits}
            safeFocusSessions={focusSessions}
            safeGratitudeEntries={gratitudeEntries}
            todayAllEvents={todayAllEvents}
            handleAddScheduleEvent={handleAddScheduleEvent}
            handleDeleteScheduleEvent={handleDeleteScheduleEvent}
            handleCompleteFocusSession={handleCompleteFocusSession}
          />
        )}

        {activeTab === 'stats' && (
          <StatsTab
            safeMoods={moods}
            safeHabits={habits}
            safeFocusSessions={focusSessions}
            safeGratitudeEntries={gratitudeEntries}
            restDays={innerWorld.restDays}
            currentFocusMinutes={currentFocusMinutes}
            onQuickAction={(action) => {
              setActiveTab('home');
              quickActionTimeoutRef.current = setTimeout(() => {
                if (action === 'logMood') moodRef.current?.scrollIntoView({ behavior: 'smooth' });
                if (action === 'startFocus') focusRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
          />
        )}

        {activeTab === 'achievements' && (
          <AchievementsTab
            stats={stats}
            unlockedAchievements={gamificationState.unlockedAchievements}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            userName={userName}
            onNameChange={handleNameChange}
            onResetData={handleResetData}
            reminders={reminders}
            onRemindersChange={setReminders}
            safeHabits={habits}
            safeMoods={moods}
            safeFocusSessions={focusSessions}
            safeGratitudeEntries={gratitudeEntries}
            privacy={privacy}
            onPrivacyChange={setPrivacy}
            initialOpenSection={settingsOpenSection}
          />
        )}

        {activeTab === 'mindmap' && HABIT_HUB_ENABLED && (
          <HabitHubTab
            habits={habits}
            onToggleHabit={handleToggleHabit}
            onAddHabit={handleAddHabit}
            onDeleteHabit={handleDeleteHabit}
            onUpdateHabit={handleUpdateHabit}
            onArchiveHabit={handleArchiveHabit}
            onUnarchiveHabit={handleUnarchiveHabit}
            onSkipHabit={handleSkipHabit}
            onUnskipHabit={handleUnskipHabit}
          />
        )}
        </main>
      </div>

      {/* MindMapTab — full-bleed canvas, outside swipe container */}
      {activeTab === 'mindmap' && CANVAS_ENABLED && (
        <div className="fixed inset-0 z-30">
          <MindMapTab
            safeMoods={moods}
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
      )}

      <FocusMiniPlayer onNavigateToTimer={() => setActiveTab('garden')} />
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} canvasEnabled={CANVAS_ENABLED} habitHubEnabled={HABIT_HUB_ENABLED} />

      <ModalLayer
        challenges={challenges}
        setChallenges={setChallenges}
        setBadges={setBadges}
        awardXp={awardXp}
        earnTreats={earnTreats}
        handleMindfulMomentComplete={handleMindfulMomentComplete}
        currentStreak={innerWorld.currentActiveStreak}
        userLevel={userLevel.level}
      />

    </div>
    </AdProvider>
    </AuthGate>
  );
};

export default Index;
