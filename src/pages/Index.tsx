import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore, useUIStore, selectAnyModalOpen, useHydrateGamification, useUserDataStore, useHydrateUserData, type TabType } from '@/stores';
import { logger } from '@/lib/logger';
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
import { ScheduleEvent } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmotionTheme } from '@/contexts/EmotionThemeContext';
import { AdProvider } from '@/contexts/AdContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { MoodBackgroundOverlay } from '@/components/MoodBackgroundOverlay';
import { db } from '@/storage/db';
import { defaultReminderSettings } from '@/lib/reminders';
import { generateId, calculateStreak } from '@/lib/utils';
import { normalizeHabit } from '@/lib/habits';
import { supabase } from '@/lib/supabaseClient';
import { syncWithCloud } from '@/storage/cloudSync';
import { generateHabitScheduleEvents, mergeScheduleEvents } from '@/lib/habitScheduleSync';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { registerModalCloseCallback } from '@/lib/androidBackHandler';

import { ModalLayer } from '@/components/ModalLayer';
import { Navigation } from '@/components/Navigation';
import { OverlayLayer } from '@/components/OverlayLayer';
import { SplashScreen } from '@/components/SplashScreen';
import { useDeepLinkHandler } from '@/hooks/useDeepLinkHandler';
import { HomeTab } from '@/components/tabs/HomeTab';
import { GardenTab } from '@/components/tabs/GardenTab';
import { StatsTab } from '@/components/tabs/StatsTab';
import { AchievementsTab } from '@/components/tabs/AchievementsTab';
import { SettingsTab } from '@/components/tabs/SettingsTab';

import { LanguageSelector } from '@/components/LanguageSelector';
// RemindersPanel only used in Settings, imported there directly
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { WelcomeTutorial } from '@/components/WelcomeTutorial';
// import { AICoachOnboarding } from '@/components/AICoachOnboarding'; // Hidden until AI ready
import { NotificationPermission } from '@/components/NotificationPermission';
import { AuthScreen } from '@/components/AuthScreen';
// WeeklyReport, TimeHelper → moved to ModalLayer

// Lazy-loaded components (ChallengesPanel, TasksPanel, QuestsPanel, WidgetSettings, FriendsPanel → moved to ModalLayer)
import { useGamification } from '@/hooks/useGamification';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { useInnerWorld } from '@/hooks/useInnerWorld';
import { getChallenges, getBadges } from '@/lib/challengeStorage';
// WhatsNewModal → moved to ModalLayer
// ChallengeModal → moved to ModalLayer
import { GlobalScheduleBar } from '@/components/GlobalScheduleBar';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useScrollLock } from '@/hooks/useScrollLock';
// import { AICoachChat } from '@/components/AICoachChat'; // Hidden until AI ready
// import { useAICoach } from '@/contexts/AICoachContext'; // Hidden until AI ready
// MindfulMoment → moved to ModalLayer

export function Index() {
  const { t, isRTL } = useLanguage();
  const { setEmotionFromEntries } = useEmotionTheme();
  const { isFeatureVisible } = useFeatureFlags();
  // const { openCoach, setUserData, onboardingData, saveOnboardingAnswer } = useAICoach(); // Hidden until AI ready

  // Security: Auto-logout after 15 minutes of inactivity (when supabase is configured)
  useSessionTimeout(!!supabase);

  // Navigation state from Zustand (replaces useState + useEffect for settings clearing)
  const activeTab = useAppStore(s => s.activeTab);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const settingsOpenSection = useAppStore(s => s.settingsOpenSection);
  // const [showAIOnboarding, setShowAIOnboarding] = useState(false); // Hidden until AI ready
  const quickActionTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (quickActionTimeoutRef.current) clearTimeout(quickActionTimeoutRef.current);
    };
  }, []);

  // Swipe navigation for mobile tab switching
  const SWIPE_TABS: TabType[] = ['home', 'garden', 'stats', 'settings'];
  const { containerProps: swipeProps, containerRef: swipeContainerRef } = useSwipeNavigation({
    activeTab,
    onTabChange: (tab: TabType) => setActiveTab(tab),
    tabs: SWIPE_TABS,
    threshold: 50,
    velocityThreshold: 0.3,
    isRTL,
  });

  // App lifecycle state from Zustand
  const initializationState = useAppStore(s => s.initializationState);
  const loadingFadeOut = useAppStore(s => s.loadingFadeOut);

  // Extracted lifecycle hooks (from Step 1 decomposition)
  useAppLifecycle();
  useDateTracking();

  // Track current date (read only — setting handled by hooks above)
  const currentDate = useAppStore(s => s.currentDate);

  // Section refs for navigation
  const moodRef = useRef<HTMLDivElement>(null);
  const habitsRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const gratitudeRef = useRef<HTMLDivElement>(null);

  const handleNavigateToSection = useCallback((section: 'mood' | 'habits' | 'focus' | 'gratitude') => {
    const refs = { mood: moodRef, habits: habitsRef, focus: focusRef, gratitude: gratitudeRef };
    refs[section]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // NOTE: Schedule event handlers, hint dismissal, and useMemo hooks moved below state declarations
  // to avoid TDZ (Temporal Dead Zone) errors in production builds

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
    clearWelcomeBack: _clearWelcomeBack,
    gardenStats: _gardenStats,
    // Treats system
    earnTreats,
    treatsBalance: _treatsBalance,
    // Companion interactions (unused — InnerWorldGarden removed)
    petCompanion: _petCompanion,
    feedCompanion: _feedCompanion,
    // Emoji helpers (unused — InnerWorldGarden removed)
    getPlantEmoji: _getPlantEmoji,
    getCreatureEmoji: _getCreatureEmoji,
    getCompanionEmoji: _getCompanionEmoji,
    FEED_COST: _FEED_COST,
    // Rest mode
    isRestMode,
    activateRestMode,
    deactivateRestMode,
    canActivateRestMode,
    daysUntilRestAvailable,
  } = useInnerWorld();

  // Register gamification hooks into Zustand store (bridge pattern)
  useHydrateGamification({ awardXp, earnTreats, plantSeed, waterPlants });


  // Current focus minutes (real-time) from UI store
  const currentFocusMinutes = useUIStore(s => s.currentFocusMinutes);

  const [challenges, setChallenges] = useState(() => getChallenges());
  const [badges, setBadges] = useState(() => getBadges());

  // Lock background scroll when any modal/panel is open (computed from UI store)
  const anyModalOpen = useUIStore(selectAnyModalOpen);
  useScrollLock(anyModalOpen);

  // Auth state from app store
  const authBypassFlag = useAppStore(s => s.authBypassFlag);
  const setAuthBypassFlag = useAppStore(s => s.setAuthBypassFlag);
  const isProcessingWebOAuth = useAppStore(s => s.isProcessingWebOAuth);
  const webOAuthError = useAppStore(s => s.webOAuthError);
  const setWebOAuthError = useAppStore(s => s.setWebOAuthError);

  // ── User data from Zustand store (hydrated from IndexedDB via bridge hook) ──
  useHydrateUserData();
  const hasSelectedLanguage = useUserDataStore(s => s.hasSelectedLanguage);
  const setHasSelectedLanguage = useUserDataStore(s => s.setHasSelectedLanguage);
  const userName = useUserDataStore(s => s.userName);
  const setUserName = useUserDataStore(s => s.setUserName);
  const setUserNameCustom = useUserDataStore(s => s.setUserNameCustom);
  const moods = useUserDataStore(s => s.moods);
  const setMoods = useUserDataStore(s => s.setMoods);
  const habits = useUserDataStore(s => s.habits);
  const setHabits = useUserDataStore(s => s.setHabits);
  const focusSessions = useUserDataStore(s => s.focusSessions);
  const setFocusSessions = useUserDataStore(s => s.setFocusSessions);
  const gratitudeEntries = useUserDataStore(s => s.gratitudeEntries);
  const setGratitudeEntries = useUserDataStore(s => s.setGratitudeEntries);
  const reminders = useUserDataStore(s => s.reminders);
  const setReminders = useUserDataStore(s => s.setReminders);
  const tutorialComplete = useUserDataStore(s => s.tutorialComplete);
  const setTutorialComplete = useUserDataStore(s => s.setTutorialComplete);
  const onboardingComplete = useUserDataStore(s => s.onboardingComplete);
  const setOnboardingComplete = useUserDataStore(s => s.setOnboardingComplete);
  const notificationPermissionChecked = useUserDataStore(s => s.notificationPermissionChecked);
  const setNotificationPermissionChecked = useUserDataStore(s => s.setNotificationPermissionChecked);
  const googleAuthChecked = useUserDataStore(s => s.googleAuthChecked);
  const setGoogleAuthChecked = useUserDataStore(s => s.setGoogleAuthChecked);

  // Auth session state from app store
  const hasValidSession = useAppStore(s => s.hasValidSession);

  // GDPR (privacy + scheduleEvents now from store, hydrated by useHydrateUserData)
  const privacy = useUserDataStore(s => s.privacy);
  const setPrivacy = useUserDataStore(s => s.setPrivacy);
  const scheduleEvents = useUserDataStore(s => s.scheduleEvents);
  const setScheduleEvents = useUserDataStore(s => s.setScheduleEvents);

  // Loading handling (IndexedDB fields from store + InnerWorld from hook)
  const isLoadingUserData = useUserDataStore(s => s.isLoading);
  const isLoading = isLoadingUserData || isLoadingInnerWorld;

  // Auth session management (extracted to hook)
  useAuthSession(isLoading);

  // Defensive array guards - prevent crashes from corrupted cloud sync data
  // Wrapped in useMemo to stabilize references for hook dependencies
  const safeMoods = useMemo(() => Array.isArray(moods) ? moods : [], [moods]);
  const safeHabits = useMemo(() => Array.isArray(habits) ? habits : [], [habits]);
  const safeFocusSessions = useMemo(() => Array.isArray(focusSessions) ? focusSessions : [], [focusSessions]);
  const safeGratitudeEntries = useMemo(() => Array.isArray(gratitudeEntries) ? gratitudeEntries : [], [gratitudeEntries]);
  const safeScheduleEvents = useMemo(() => Array.isArray(scheduleEvents) ? scheduleEvents : [], [scheduleEvents]);
  const safeBadges = useMemo(() => Array.isArray(badges) ? badges : [], [badges]);

  // Challenge/feature unlock handlers (used by mood/habit/focus/gratitude handlers)
  const { checkForFeatureUnlocks, updateChallengeProgress, handleOpenChallenge } = useChallengeHandlers({
    safeMoods,
    safeHabits,
    safeFocusSessions,
    safeGratitudeEntries,
    currentActiveStreak: innerWorld.currentActiveStreak,
    setChallenges,
    setBadges,
  });

  // Feature handlers (extracted from Index.tsx body)
  const { handleAddMood, handleQuickMood } = useMoodHandlers({ updateChallengeProgress });
  const { handleToggleHabit, handleAdjustHabit, handleAddHabit, handleUpdateHabit, handleDeleteHabit } = useHabitHandlers({
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


  // Migrate old reminder settings to new 3-time mood format
  useEffect(() => {
    if (isLoadingUserData) return;

    // Check if we have old moodTime but missing new fields
    const needsMigration = reminders.moodTime && !reminders.moodTimeMorning;

    if (needsMigration) {
      const oldTime = reminders.moodTime || '09:00';
      setReminders(prev => ({
        ...defaultReminderSettings,
        ...prev,
        moodTimeMorning: oldTime,
        moodTimeAfternoon: '14:00',
        moodTimeEvening: '20:00',
        moodTime: undefined, // Remove old field
      }));
      logger.log('[Migration] Migrated reminder settings to 3-time mood format');
    } else if (!reminders.moodTimeMorning) {
      // Ensure defaults are set for new users
      setReminders(prev => ({
        ...defaultReminderSettings,
        ...prev,
      }));
    }
  }, [isLoadingUserData, reminders.moodTime, reminders.moodTimeMorning, setReminders]);

  // Update AI Coach context with user data - Hidden until AI ready
  // useEffect(() => {
  //   if (!isLoading && !isLoadingInnerWorld) {
  //     setUserData(safeMoods, safeHabits, innerWorld);
  //   }
  // }, [isLoading, isLoadingInnerWorld, safeMoods, safeHabits, innerWorld, setUserData]);

  // Schedule event handlers
  const handleAddScheduleEvent = (event: Omit<ScheduleEvent, 'id'>) => {
    const newEvent: ScheduleEvent = {
      ...event,
      id: generateId(),
      source: 'manual',
      isEditable: true,
    };
    setScheduleEvents(prev => [...prev, newEvent]);
  };

  const handleDeleteScheduleEvent = (id: string) => {
    const eventToDelete = allScheduleEvents.find(e => e.id === id);
    if (eventToDelete?.source === 'habit' || eventToDelete?.source === 'google') {
      logger.warn('[Schedule] Cannot delete habit/google-generated event directly');
      return;
    }
    setScheduleEvents(scheduleEvents.filter(e => e.id !== id));
  };

  // Filter today's schedule events (manual only)
  const _todayScheduleEvents = useMemo(() => {
    return safeScheduleEvents.filter(e => e.date === currentDate);
  }, [safeScheduleEvents, currentDate]);

  // v1.4.0: Generate habit-based schedule events (7 days ahead)
  const habitScheduleEvents = useMemo(() => {
    return generateHabitScheduleEvents(safeHabits, 7);
  }, [safeHabits]);

  // v1.4.0: Merge manual and habit events for full schedule
  const allScheduleEvents = useMemo(() => {
    return mergeScheduleEvents(safeScheduleEvents, habitScheduleEvents);
  }, [safeScheduleEvents, habitScheduleEvents]);

  // v1.4.0: Today's combined events (manual + habits)
  const todayAllEvents = useMemo(() => {
    return allScheduleEvents.filter(e => e.date === currentDate);
  }, [allScheduleEvents, currentDate]);

  // Check if user has mood today
  const hasMoodToday = useMemo(() => {
    return safeMoods.some(m => m.date === currentDate);
  }, [safeMoods, currentDate]);

  // Check if user has focus session today
  const hasFocusToday = useMemo(() => {
    return safeFocusSessions.some(s => s.date === currentDate);
  }, [safeFocusSessions, currentDate]);

  // Check if user has gratitude today
  const hasGratitudeToday = useMemo(() => {
    return safeGratitudeEntries.some(g => g.date === currentDate);
  }, [safeGratitudeEntries, currentDate]);

  // Filter habits that are actually due today (excludes weekly/custom off-days)
  const habitsDueToday = useMemo(() => {
    const todayDow = new Date().getDay();
    return safeHabits.filter(habit => {
      if (habit.frequency === 'custom' && habit.customDays) {
        return habit.customDays.includes(todayDow);
      }
      if (habit.frequency === 'weekly') {
        return todayDow === new Date(habit.createdAt).getDay();
      }
      return true; // daily or unset
    });
  }, [safeHabits]);

  // Check if user has uncompleted habits today (due-today only)
  const hasUncompletedHabits = useMemo(() => {
    if (habitsDueToday.length === 0) return false;
    return habitsDueToday.some(h => {
      const habitType = h.type || 'daily';
      // Continuous habits: uncompleted if failed today
      if (habitType === 'continuous') return h.failedDates?.includes(currentDate) ?? false;
      // Reduce habits: uncompleted if not yet logged or above target
      if (habitType === 'reduce') {
        const progress = h.progressByDate?.[currentDate];
        return progress === undefined || progress > (h.targetCount ?? 0);
      }
      // Multiple times per day habits
      if (habitType === 'multiple') {
        const completions = h.completionsByDate?.[currentDate] ?? 0;
        return completions < (h.dailyTarget ?? 1);
      }
      // Daily and scheduled habits
      return !h.completedDates?.includes(currentDate);
    });
  }, [habitsDueToday, currentDate]);

  // Count completed habits today (due-today only, for QuickStatsRow)
  const completedTodayCount = useMemo(() => {
    return habitsDueToday.filter(h => {
      const habitType = h.type || 'daily';
      if (habitType === 'reduce') {
        const progress = h.progressByDate?.[currentDate];
        return progress !== undefined && progress <= (h.targetCount ?? 0);
      }
      if (habitType === 'multiple') {
        const completions = h.completionsByDate?.[currentDate] ?? 0;
        return completions >= (h.dailyTarget ?? 1);
      }
      if (habitType === 'continuous') {
        return !(h.failedDates?.includes(currentDate));
      }
      return h.completedDates?.includes(currentDate);
    }).length;
  }, [habitsDueToday, currentDate]);

  // Determine current primary CTA (Smart Focus System)
  // Priority: mood → habits → focus → gratitude → complete
  const currentPrimaryCTA = useMemo(() => {
    // 1. Mood is always first priority
    if (!hasMoodToday) return 'mood' as const;
    // 2. Habits - if there are uncompleted ones
    if (hasUncompletedHabits) return 'habits' as const;
    // 3. Focus - if no session today
    if (!hasFocusToday) return 'focus' as const;
    // 4. Gratitude - if no entry today
    if (!hasGratitudeToday) return 'gratitude' as const;
    // 5. All complete!
    return 'complete' as const;
  }, [hasMoodToday, hasUncompletedHabits, hasFocusToday, hasGratitudeToday]);

  // Widget synchronization
  const todayFocusMinutes = useMemo(() => {
    return safeFocusSessions
      .filter(s => s.date.startsWith(currentDate))
      .reduce((sum, s) => sum + (s.duration || 0), 0);
  }, [safeFocusSessions, currentDate]);

  const lastBadgeName = useMemo(() => {
    const unlockedBadges = safeBadges.filter(b => b.unlocked && b.unlockedDate);
    if (!unlockedBadges.length) return undefined;
    // Sort by unlockedDate string (ISO format sorts correctly)
    const latest = unlockedBadges.sort((a, b) =>
      (b.unlockedDate || '').localeCompare(a.unlockedDate || '')
    )[0];
    return latest.title?.['en'] || latest.id;
  }, [safeBadges]);

  // Calculate streak for widget (same logic as StreakBanner)
  const widgetStreak = useMemo(() => {
    const allActivityDates = [
      ...safeMoods.map(m => m.date),
      ...safeHabits.flatMap(h => h.completedDates || []),
      ...safeFocusSessions.map(f => f.date),
      ...safeGratitudeEntries.map(g => g.date),
      ...(innerWorld.restDays || []),
    ];
    const uniqueActivityDates = [...new Set(allActivityDates)].sort();
    return calculateStreak(uniqueActivityDates);
  }, [safeMoods, safeHabits, safeFocusSessions, safeGratitudeEntries, innerWorld.restDays]);

  // Sync widget with calculated streak (same as StreakBanner shows)
  // Wait for all data that affects streak to be loaded
  const isWidgetDataLoading = isLoadingUserData || isLoadingInnerWorld;
  useWidgetSync(widgetStreak, habits, todayFocusMinutes, lastBadgeName, isWidgetDataLoading);

  // Sync emotion theme with current mood entries
  useEffect(() => {
    if (!isLoadingUserData) {
      setEmotionFromEntries(moods);
    }
  }, [moods, isLoadingUserData, setEmotionFromEntries]);

  // Onboarding, re-engagement, update check (extracted to hooks)
  useOnboardingEffects({ isLoading, innerWorldStreak: innerWorld.currentActiveStreak, innerWorldRestDays: innerWorld.restDays || [] });
  useAppUpdateCheck(isLoading, onboardingComplete);
  useWeeklyReportTrigger(isLoading, onboardingComplete);

  // Pull-to-refresh handler: sync with cloud and reload data
  const handlePullToRefresh = useCallback(async () => {
    try {
      await syncWithCloud('merge');
      // Reload data from IndexedDB after sync
      const [m, h, f, g] = await Promise.all([
        db.moods.toArray(),
        db.habits.toArray(),
        db.focusSessions.toArray(),
        db.gratitudeEntries.toArray(),
      ]);
      setMoods(m);
      setHabits(h.map(normalizeHabit));
      setFocusSessions(f);
      setGratitudeEntries(g);
    } catch {
      // Silently fail — offline banner will show if no connection
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResetData = () => {
    setMoods([]);
    setHabits([]);
    setFocusSessions([]);
    setGratitudeEntries([]);
    setUserName('Friend');
    setUserNameCustom(false);
    // Reset onboarding to show first screen after page refresh
    setOnboardingComplete(false);
    setHasSelectedLanguage(false);
  };

  const handleLanguageSelected = () => {
    setHasSelectedLanguage(true);
  };

  const handleNameChange = (name: string) => {
    setUserName(name);
    setUserNameCustom(true);
  };

  // Google Auth handlers (shown once after language selection)
  const handleGoogleAuthComplete = (userData: { name: string; email: string }) => {
    // Don't log email (PII)
    logger.log('[Index] Google auth completed');

    // CRITICAL: Set synchronous bypass flag FIRST (immediate UI update)
    // This ensures we skip AuthScreen immediately, before IndexedDB writes
    setAuthBypassFlag(true);

    // Then set persistent values (async IndexedDB)
    setUserName(userData.name);
    setUserNameCustom(false);
    setGoogleAuthChecked(true);
  };

  // New simplified onboarding - just modules selection
  const handleOnboardingComplete = (result: {
    skipped?: boolean;
    modules?: string[];
  }) => {
    logger.log('[Index] handleOnboardingComplete called', result);
    // Module preferences are already saved by OnboardingFlow via FeatureFlags context
    // Just mark onboarding as complete
    try {
      setOnboardingComplete(true);
      logger.log('[Index] setOnboardingComplete(true) called successfully');
    } catch (error) {
      logger.error('[Index] Error in handleOnboardingComplete:', error);
    }
  };

  const handleNotificationPermissionComplete = () => {
    setNotificationPermissionChecked(true);
  };

  // Notification setup (extracted to hook)
  useNotificationSetup({ handleQuickMood });

  // Cloud sync + quick actions (extracted to hook)
  useCloudSyncEffects({ setChallenges, setBadges, handleNavigateToSection, quickActionTimeoutRef });

  // Deep link listener (auth + challenge URLs, extracted to hook)
  useDeepLinkHandler();

  // Show premium initialization screen
  if (initializationState.isInitializing) {
    return (
      <SplashScreen
        loadingFadeOut={loadingFadeOut}
        subtitle={t.initializingApp || 'Preparing your zen space...'}
      />
    );
  }

  // Show initialization error
  if (initializationState.error) {
    return (
      <div className="flex items-center justify-center min-h-screen zen-gradient-hero p-4">
        <div className="max-w-md bg-card rounded-3xl p-6 zen-shadow-card space-y-4">
          <h2 className="text-2xl font-bold text-destructive">Initialization Error</h2>
          <p className="text-muted-foreground">{initializationState.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Language selection shown before tutorial
  // This ensures tutorial is shown in user's preferred language
  if (!hasSelectedLanguage) {
    return <LanguageSelector onComplete={handleLanguageSelected} />;
  }

  // Google Auth screen (required - Google sign-in only)
  // Shown after language selection, before tutorial
  // Check both googleAuthChecked (IndexedDB) and authBypassFlag (synchronous)
  // authBypassFlag provides immediate skip while IndexedDB writes are pending
  // Also check hasValidSession - if session exists, skip to app
  // hasValidSession: null = checking, true = has session, false = no session
  if (!googleAuthChecked && !authBypassFlag && hasValidSession === false) {
    // If processing web OAuth callback, show loading instead of AuthScreen
    if (isProcessingWebOAuth) {
      return (
        <div className="min-h-screen zen-gradient-hero flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">{t.authSigningIn}</p>
          </div>
        </div>
      );
    }

    return (
      <AuthScreen
        onComplete={handleGoogleAuthComplete}
        webOAuthError={webOAuthError}
        onClearError={() => setWebOAuthError(null)}
      />
    );
  }

  // Show tutorial before onboarding for new users
  // Now tutorial will be in the language user just selected
  if (!tutorialComplete) {
    return (
      <WelcomeTutorial
        onComplete={() => {
          setTutorialComplete(true);
          // AI Coach Onboarding hidden until AI ready
          // if (!onboardingData.completedAt) {
          //   setShowAIOnboarding(true);
          // }
        }}
        onSkip={() => {
          setTutorialComplete(true);
        }}
      />
    );
  }

  // AI Coach Onboarding hidden until AI ready
  // if (showAIOnboarding) {
  //   return (
  //     <AICoachOnboarding
  //       onComplete={() => {
  //         saveOnboardingAnswer('completedAt', String(Date.now()));
  //         setShowAIOnboarding(false);
  //       }}
  //       onSkip={() => setShowAIOnboarding(false)}
  //     />
  //   );
  // }

  if (!onboardingComplete) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  if (!notificationPermissionChecked) {
    return <NotificationPermission onComplete={handleNotificationPermissionComplete} />;
  }

  return (
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
          className="max-w-lg mx-auto px-4 py-6"
          style={{ paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom))' }}
        >
        {/* Global Schedule Bar - visible on all tabs when events exist */}
        {/* v1.4.0: Use todayAllEvents to include both manual and habit-generated events */}
        {todayAllEvents.length > 0 && activeTab !== 'settings' && (
          <div className="mb-4">
            <GlobalScheduleBar
              events={todayAllEvents}
              onTap={() => setActiveTab('garden')}
            />
          </div>
        )}

        {activeTab === 'home' && (
          <HomeTab
            safeMoods={safeMoods}
            safeHabits={safeHabits}
            safeFocusSessions={safeFocusSessions}
            safeGratitudeEntries={safeGratitudeEntries}
            restDays={innerWorld.restDays}
            currentActiveStreak={innerWorld.currentActiveStreak}
            isRestMode={isRestMode}
            activateRestMode={activateRestMode}
            deactivateRestMode={deactivateRestMode}
            canActivateRestMode={canActivateRestMode}
            daysUntilRestAvailable={daysUntilRestAvailable}
            completedTodayCount={completedTodayCount}
            habitsDueToday={habitsDueToday}
            todayFocusMinutes={todayFocusMinutes}
            currentPrimaryCTA={currentPrimaryCTA}
            userLevel={userLevel.level}
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
            safeMoods={safeMoods}
            safeHabits={safeHabits}
            safeFocusSessions={safeFocusSessions}
            safeGratitudeEntries={safeGratitudeEntries}
            todayAllEvents={todayAllEvents}
            handleAddScheduleEvent={handleAddScheduleEvent}
            handleDeleteScheduleEvent={handleDeleteScheduleEvent}
            handleCompleteFocusSession={handleCompleteFocusSession}
            earnTreats={earnTreats}
          />
        )}

        {activeTab === 'stats' && (
          <StatsTab
            safeMoods={safeMoods}
            safeHabits={safeHabits}
            safeFocusSessions={safeFocusSessions}
            safeGratitudeEntries={safeGratitudeEntries}
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
            safeHabits={safeHabits}
            safeMoods={safeMoods}
            safeFocusSessions={safeFocusSessions}
            safeGratitudeEntries={safeGratitudeEntries}
            privacy={privacy}
            onPrivacyChange={setPrivacy}
            initialOpenSection={settingsOpenSection}
          />
        )}
        </main>
      </div>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

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

      {/* AI Coach Chat - Hidden until AI ready
      {isFeatureVisible('aiCoach') && <AICoachChat />}
      */}

    </div>
    </AdProvider>
  );
};

export default Index;
