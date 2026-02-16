import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useAppStore, useUIStore, selectAnyModalOpen, getModalToggle, useHydrateGamification, useUserDataStore, useHydrateUserData, type TabType } from '@/stores';
import { motion } from 'framer-motion';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { LazyErrorBoundary, ModalErrorBoundary } from '@/components/ErrorBoundary';
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
import { MoodEntry, ScheduleEvent } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmotionTheme } from '@/contexts/EmotionThemeContext';
import { AdProvider } from '@/contexts/AdContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { MoodBackgroundOverlay } from '@/components/MoodBackgroundOverlay';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { SessionExpiredBanner } from '@/components/SessionExpiredBanner';
import { db } from '@/storage/db';
import { defaultReminderSettings } from '@/lib/reminders';
import { generateId, getToday, calculateStreak } from '@/lib/utils';
import { normalizeHabit } from '@/lib/habits';
import { supabase } from '@/lib/supabaseClient';
import { syncWithCloud, triggerSync } from '@/storage/cloudSync';
import { generateHabitScheduleEvents, mergeScheduleEvents } from '@/lib/habitScheduleSync';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { App } from '@capacitor/app';
import {
  handleAuthCallback,
  isNativePlatform,
  notifyAuthComplete,
  setPendingAuthUrl,
} from '@/lib/authRedirect';
import { registerModalCloseCallback } from '@/lib/androidBackHandler';

import { ModalLayer } from '@/components/ModalLayer';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { OfflineBanner } from '@/components/OfflineBanner';
import { StorageErrorBanner } from '@/components/StorageErrorBanner';
import { PullToRefresh } from '@/components/PullToRefresh';

// Lazy-loaded components with retry logic for chunk loading failures
const StatsPage = lazyWithRetry(() => import('@/components/StatsPage').then(m => ({ default: m.StatsPage })), 'StatsPage');
const SettingsPanel = lazyWithRetry(() => import('@/components/SettingsPanel').then(m => ({ default: m.SettingsPanel })), 'SettingsPanel');
const GratitudeJournal = lazyWithRetry(() => import('@/components/GratitudeJournal').then(m => ({ default: m.GratitudeJournal })), 'GratitudeJournal');
const BreathingExercise = lazyWithRetry(() => import('@/components/BreathingExercise').then(m => ({ default: m.BreathingExercise })), 'BreathingExercise');

// Journal module (lazy-loaded feature)
const JournalModule = lazyWithRetry(() => import('@/features/journal').then(m => ({ default: m.JournalModule })), 'JournalModule');

// Heavy components lazy-loaded for better initial load performance
const ScheduleTimeline = lazyWithRetry(() => import('@/components/ScheduleTimeline').then(m => ({ default: m.ScheduleTimeline })), 'ScheduleTimeline');
const HabitTracker = lazyWithRetry(() => import('@/components/HabitTracker').then(m => ({ default: m.HabitTracker })), 'HabitTracker');
const FocusTimer = lazyWithRetry(() => import('@/components/FocusTimer').then(m => ({ default: m.FocusTimer })), 'FocusTimer');
const EmotionWheel = lazyWithRetry(() => import('@/components/mindfulness/EmotionWheel').then(m => ({ default: m.EmotionWheel })), 'EmotionWheel');
import { LanguageSelector } from '@/components/LanguageSelector';
import { InstallBanner } from '@/components/InstallBanner';
// RemindersPanel only used in Settings, imported there directly
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { WelcomeTutorial } from '@/components/WelcomeTutorial';
// import { AICoachOnboarding } from '@/components/AICoachOnboarding'; // Hidden until AI ready
import { AchievementsPanel } from '@/components/AchievementsPanel';
import { NotificationPermission } from '@/components/NotificationPermission';
import { AuthScreen } from '@/components/AuthScreen';
// WeeklyReport, TimeHelper → moved to ModalLayer

// Lazy-loaded components (ChallengesPanel, TasksPanel, QuestsPanel, WidgetSettings, FriendsPanel → moved to ModalLayer)
const Leaderboard = lazyWithRetry(() => import('@/components/Leaderboard').then(m => ({ default: m.Leaderboard })), 'Leaderboard');
import { useGamification } from '@/hooks/useGamification';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { useInnerWorld } from '@/hooks/useInnerWorld';
import { getChallenges, getBadges } from '@/lib/challengeStorage';
import { MoodInsights } from '@/components/MoodInsights';
import { StreakBanner } from '@/components/StreakBanner';
import { UrgencyAlert } from '@/components/UrgencyAlert';
import { RestModeCard } from '@/components/RestModeCard';
// WhatsNewModal → moved to ModalLayer
// ChallengeModal → moved to ModalLayer
import { decodeInviteData } from '@/lib/friendChallenge';
import { AllCompleteCelebration } from '@/components/AllCompleteCelebration';
import { ConsentBanner } from '@/components/ConsentBanner';
import { GlobalScheduleBar } from '@/components/GlobalScheduleBar';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useScrollLock } from '@/hooks/useScrollLock';
// import { AICoachChat } from '@/components/AICoachChat'; // Hidden until AI ready
// import { useAICoach } from '@/contexts/AICoachContext'; // Hidden until AI ready
import { OnboardingOverlay, DayProgressIndicator } from '@/components/OnboardingOverlay';
import { FeatureUnlock } from '@/components/FeatureUnlock';
import { QuickStatsRow } from '@/components/ui/stat-card';
import { SkeletonCard, SkeletonStats, SkeletonList, SkeletonSection } from '@/components/ui/skeleton';
// MindfulMoment → moved to ModalLayer
import { WelcomeBackModal } from '@/components/WelcomeBackModal';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { dismissUpdate } from '@/lib/appUpdateManager';

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
  const setSettingsOpenSection = useAppStore(s => s.setSettingsOpenSection);
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
  const setCurrentFocusMinutes = useUIStore(s => s.setCurrentFocusMinutes);

  // UI state from Zustand uiStore (modal rendering moved to ModalLayer)
  const setChallengeInvite = useUIStore(s => s.setChallengeInvite);
  const confettiBurst = useUIStore(s => s.confettiBurst);
  const setConfettiBurst = useUIStore(s => s.setConfettiBurst);
  // Modal toggle functions still used in Index.tsx (stable references via getModalToggle utility)
  const setShowWidgetSettings = getModalToggle('showWidgetSettings');
  const setShowChallenges = getModalToggle('showChallenges');
  const setShowChallengeModal = getModalToggle('showChallengeModal');
  const setShowTasksPanel = getModalToggle('showTasksPanel');
  const setShowQuestsPanel = getModalToggle('showQuestsPanel');
  const setShowFriendsPanel = getModalToggle('showFriendsPanel');
  const setShowWelcomeOverlay = getModalToggle('showWelcomeOverlay');
  const setShowWelcomeBack = getModalToggle('showWelcomeBack');

  const [challenges, setChallenges] = useState(() => getChallenges());
  const [badges, setBadges] = useState(() => getBadges());

  // Onboarding, celebrations, update state from UI store
  const showWelcomeOverlay = useUIStore(s => s.showWelcomeOverlay);
  const featureToUnlock = useUIStore(s => s.featureToUnlock);
  const setFeatureToUnlock = useUIStore(s => s.setFeatureToUnlock);
  const showWelcomeBack = useUIStore(s => s.showWelcomeBack);
  const welcomeBackData = useUIStore(s => s.welcomeBackData);
  const updateState = useUIStore(s => s.updateState);
  const setUpdateState = useUIStore(s => s.setUpdateState);

  // Lock background scroll when any modal/panel is open (computed from UI store)
  const anyModalOpen = useUIStore(selectAnyModalOpen);
  useScrollLock(anyModalOpen);

  // Journal prompt text from UI store
  const journalPromptText = useUIStore(s => s.journalPromptText);

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

  // GDPR consent handler
  const handleConsentResponse = (analyticsAllowed: boolean) => {
    setPrivacy({
      ...privacy,
      analytics: analyticsAllowed,
      noTracking: !analyticsAllowed,
      consentShown: true,
    });
  };

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

  // Deep link listener - ALWAYS register, store URL if supabase not ready
  useEffect(() => {
    if (!isNativePlatform()) return;

    let removeListener = () => {};

    const handleAuthUrl = async (url: string) => {
      // Check if URL is auth callback
      if (!url.includes('login-callback')) return;

      logger.log('[Index] Auth URL received:', url);

      // If supabase not ready, store for later
      if (!supabase) {
        logger.log('[Index] Supabase not ready, storing pending URL');
        setPendingAuthUrl(url);
        return;
      }

      try {
        await handleAuthCallback(supabase, url);

        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const metadata = data.session.user.user_metadata;
          const name = metadata?.full_name || metadata?.name || data.session.user.email?.split('@')[0] || 'Friend';

          // Don't log email (PII)
          logger.log('[Auth] OAuth callback successful');
          setAuthBypassFlag(true);
          notifyAuthComplete();
          setUserName(name);
          setUserNameCustom(false);
          setGoogleAuthChecked(true);
        }
      } catch (error) {
        logger.error('[Index] Failed to handle auth callback:', error);
      }
    };

    // Handle challenge deep links
    const handleChallengeUrl = (url: string): boolean => {
      try {
        const parsedUrl = new URL(url);
        // Check if it's a challenge invite URL
        // Support both: zenflow://challenge?data=... and https://zenflow.app/challenge?data=...
        const isCustomScheme = parsedUrl.protocol === 'zenflow:' && parsedUrl.hostname === 'challenge';
        const isHttpsScheme = parsedUrl.hostname === 'zenflow.app' && parsedUrl.pathname.startsWith('/challenge');

        if (isCustomScheme || isHttpsScheme) {
          const data = parsedUrl.searchParams.get('data');
          if (data) {
            const invite = decodeInviteData(data);
            if (invite) {
              logger.log('[Index] Challenge invite received:', invite.code);
              // Only open challenge modal if challenges feature is enabled
              if (isFeatureVisible('challenges')) {
                setChallengeInvite(invite);
                setShowChallengeModal(true);
                return true;
              } else {
                logger.log('[Index] Challenges feature disabled, ignoring invite');
              }
            }
          }
        }
      } catch (error) {
        logger.error('[Index] Failed to parse challenge URL:', error);
      }
      return false;
    };

    const setup = async () => {
      try {
        // Check launch URL (cold start with deep link)
        const launch = await App.getLaunchUrl();
        if (launch?.url) {
          logger.log('[Index] Launch URL found:', launch.url);
          // Try challenge URL first, then auth URL
          if (!handleChallengeUrl(launch.url)) {
            await handleAuthUrl(launch.url);
          }
        }
      } catch (error) {
        logger.error('[Index] Failed to read launch URL:', error);
      }

      // Listen for future deep links
      const listener = await App.addListener('appUrlOpen', (event) => {
        if (event?.url) {
          logger.log('[Index] appUrlOpen event:', event.url);
          // Try challenge URL first, then auth URL
          if (!handleChallengeUrl(event.url)) {
            void handleAuthUrl(event.url);
          }
        }
      });
      removeListener = () => listener.remove();
    };

    void setup();
    return () => { removeListener(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Listener registers ONCE, no dependencies

  // Show premium initialization screen
  if (initializationState.isInitializing) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return (
      <motion.div
        key="loading"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden"
        animate={{
          opacity: loadingFadeOut ? 0 : 1,
          scale: loadingFadeOut ? 1.02 : 1,
        }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        {/* Aurora ambient layer 1 — top-center warm glow */}
        {!prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 60% 50% at 50% 30%, hsl(var(--primary) / 0.10) 0%, transparent 70%)'
            }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Aurora ambient layer 2 — bottom accent glow */}
        {!prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 50% 40% at 50% 70%, hsl(var(--accent) / 0.05) 0%, transparent 70%)'
            }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          />
        )}

        {/* Floating bokeh orbs — CSS only, GPU composited */}
        {!prefersReducedMotion && (
          <>
            <div className="absolute w-24 h-24 rounded-full bg-primary/[0.05] blur-[20px] animate-float" style={{ top: '20%', left: '15%', animationDuration: '6s' }} />
            <div className="absolute w-16 h-16 rounded-full bg-primary/[0.07] blur-[20px] animate-float" style={{ top: '15%', right: '20%', animationDuration: '7s', animationDelay: '-2s' }} />
            <div className="absolute w-20 h-20 rounded-full bg-primary/[0.04] blur-[20px] animate-float" style={{ bottom: '25%', left: '20%', animationDuration: '5s', animationDelay: '-1s' }} />
            <div className="absolute w-14 h-14 rounded-full bg-primary/[0.06] blur-[20px] animate-float" style={{ bottom: '20%', right: '15%', animationDuration: '8s', animationDelay: '-3s' }} />
            <div className="absolute w-10 h-10 rounded-full bg-primary/[0.08] blur-[20px] animate-float" style={{ top: '45%', left: '10%', animationDuration: '6.5s', animationDelay: '-4s' }} />
            <div className="absolute w-12 h-12 rounded-full bg-primary/[0.05] blur-[20px] animate-float" style={{ top: '40%', right: '10%', animationDuration: '7.5s', animationDelay: '-2.5s' }} />
          </>
        )}

        {/* Glow ring behind logo */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 120,
            height: 120,
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)',
            filter: 'blur(10px)',
          }}
          initial={prefersReducedMotion ? { scale: 1, opacity: 0.15 } : { scale: 0, opacity: 0 }}
          animate={prefersReducedMotion
            ? { scale: 1, opacity: 0.15 }
            : { scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }
          }
          transition={prefersReducedMotion ? {} : { delay: 0.3, duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Logo — inline SVG from icon-source.svg */}
        <motion.div
          className="mb-6 relative"
          initial={prefersReducedMotion ? {} : { scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={prefersReducedMotion ? {} : { type: 'spring', stiffness: 180, damping: 14, delay: 0.1 }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            width="80"
            height="80"
            className="drop-shadow-lg"
            role="img"
            aria-label="ZenFlow"
          >
            <defs>
              <linearGradient id="splashBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1a6b52" />
                <stop offset="50%" stopColor="#2a9d6e" />
                <stop offset="100%" stopColor="#3dbd80" />
              </linearGradient>
              <radialGradient id="splashHighlight" cx="35%" cy="35%" r="60%">
                <stop offset="0%" stopColor="white" stopOpacity="0.12" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="splashLeafGlow" cx="50%" cy="45%" r="35%">
                <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect x="16" y="16" width="480" height="480" rx="100" ry="100" fill="url(#splashBgGrad)" />
            <rect x="16" y="16" width="480" height="480" rx="100" ry="100" fill="url(#splashHighlight)" />
            <ellipse cx="256" cy="240" rx="130" ry="130" fill="url(#splashLeafGlow)" />
            <g transform="translate(106, 96) scale(12.5)">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
                fill="white" fillOpacity="0.2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
                fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <circle cx="340" cy="140" r="3" fill="white" opacity="0.4" />
            <circle cx="345" cy="135" r="1.5" fill="white" opacity="0.6" />
          </svg>
        </motion.div>

        {/* Brand name */}
        <motion.h1
          className="text-3xl font-bold text-foreground tracking-[0.15em]"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? {} : { delay: 0.5, duration: 0.5, ease: 'easeOut' }}
        >
          ZenFlow
        </motion.h1>

        {/* Localized subtitle */}
        <motion.p
          className="text-sm text-muted-foreground mt-3"
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={prefersReducedMotion ? {} : { delay: 0.8, duration: 0.5 }}
        >
          {t.initializingApp || 'Preparing your zen space...'}
        </motion.p>

        {/* Progress dots */}
        <motion.div
          className="flex items-center gap-2 mt-8"
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={prefersReducedMotion ? {} : { delay: 1.0 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary/40"
              animate={prefersReducedMotion ? {} : {
                y: [0, -6, 0],
                opacity: [0.4, 1, 0.4],
              }}
              transition={prefersReducedMotion ? {} : {
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </motion.div>
      </motion.div>
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

      {/* Confetti burst on habit completion */}
      {confettiBurst && (
        <ConfettiBurst
          x={confettiBurst.x}
          y={confettiBurst.y}
          onComplete={() => setConfettiBurst(null)}
        />
      )}

      {/* GDPR Consent Banner - shows once after onboarding */}
      {!privacy.consentShown && onboardingComplete && (
        <ConsentBanner onConsent={handleConsentResponse} />
      )}

      {/* App Update Banner - shows when Google Play update is available */}
      {updateState && updateState.available && (
        <UpdatePrompt
          updateState={updateState}
          onDismiss={() => {
            dismissUpdate();
            setUpdateState(null);
          }}
        />
      )}

      {/* Progressive Onboarding - Welcome overlay for new users */}
      {showWelcomeOverlay && (
        <OnboardingOverlay onClose={() => setShowWelcomeOverlay(false)} />
      )}

      {/* Feature Unlock Celebration */}
      {featureToUnlock && (
        <FeatureUnlock
          feature={featureToUnlock}
          onClose={() => setFeatureToUnlock(null)}
        />
      )}

      {/* Re-engagement - Welcome Back Modal (3+ day absence) */}
      {showWelcomeBack && welcomeBackData && (
        <WelcomeBackModal
          daysAway={welcomeBackData.daysAway}
          streakBroken={welcomeBackData.streakBroken}
          currentStreak={welcomeBackData.currentStreak}
          topHabits={welcomeBackData.topHabits}
          onClose={() => setShowWelcomeBack(false)}
          onQuickMoodLog={(mood) => {
            // Quick mood logging from welcome back modal
            const newMood: MoodEntry = {
              id: generateId(),
              mood,
              date: getToday(),
              timestamp: Date.now()
            };
            setMoods(prev => [...prev, newMood]);
            awardXp('mood');
            earnTreats('mood', 5, 'Welcome back mood');
            triggerSync(); // Sync mood and inner world
          }}
        />
      )}

      {/* Offline banner - shows when user loses connection */}
      <OfflineBanner />

      {/* Storage error banner - shows when localStorage/IndexedDB fails */}
      <StorageErrorBanner />

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
          <div className="animate-tab-enter">
          <PullToRefresh onRefresh={handlePullToRefresh}>
            <InstallBanner />
            <Header
              userName={userName}
              onOpenChallenges={isFeatureVisible('challenges') ? () => setShowChallenges(true) : undefined}
              onOpenTasks={isFeatureVisible('tasks') ? () => setShowTasksPanel(true) : undefined}
              onOpenQuests={isFeatureVisible('quests') ? () => setShowQuestsPanel(true) : undefined}
            />

            {/* Session expired banner - shows when user was authenticated but session is lost */}
            {hasValidSession === false && googleAuthChecked && userName !== 'Friend' && (
              <SessionExpiredBanner onSignIn={() => { setSettingsOpenSection('account'); setActiveTab('settings'); }} />
            )}

            <div className="space-y-3">
              {/* Progressive Onboarding - Day progress indicator */}
              <DayProgressIndicator />

              {/* Streak Banner - Prominent streak display with Rest Mode button */}
              <StreakBanner
                moods={safeMoods}
                habits={safeHabits}
                focusSessions={safeFocusSessions}
                gratitudeEntries={safeGratitudeEntries}
                restDays={innerWorld.restDays}
                onRestMode={activateRestMode}
                isRestMode={isRestMode}
                canActivateRestMode={canActivateRestMode}
                daysUntilRestAvailable={daysUntilRestAvailable}
              />

              {/* Quick Stats Row - At-a-glance progress overview */}
              <QuickStatsRow
                habitsCompleted={completedTodayCount}
                habitsTotal={habitsDueToday.length}
                focusMinutes={isFeatureVisible('focusTimer') ? todayFocusMinutes : undefined}
                level={userLevel.level}
                labels={{
                  habits: t.habits,
                  focus: t.focus,
                  level: t.level || 'Level',
                }}
              />

              {/* Urgency Alert - Smart reminders for pending habits */}
              <UrgencyAlert
                habits={habitsDueToday}
                currentStreak={innerWorld.currentActiveStreak}
                onHabitClick={() => {
                  // Scroll to habit tracker
                  habitsRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
              />



              {/* Rest Mode UI - Simplified interface when taking a break */}
              {isRestMode ? (
                <RestModeCard
                  streak={innerWorld.currentActiveStreak}
                  onCancel={deactivateRestMode}
                />
              ) : currentPrimaryCTA === 'complete' ? (
                /* All activities complete - show celebration */
                <AllCompleteCelebration streak={innerWorld.currentActiveStreak} />
              ) : (
                <>
                  {/* Smart Primary CTA System - Sequential focus with collapsible completed sections */}

                  {/* Mood Tracker */}
                  <div ref={moodRef}>
                    <ModalErrorBoundary fallbackTitle="Mood Tracker Error" fallbackBody="Unable to load mood tracker. Try refreshing.">
                      <Suspense fallback={<SkeletonCard />}>
                        <EmotionWheel
                          entries={safeMoods}
                          onAddEntry={handleAddMood}
                        />
                      </Suspense>
                    </ModalErrorBoundary>
                  </div>

                  {/* Habit Tracker */}
                  <div ref={habitsRef}>
                    <ModalErrorBoundary fallbackTitle="Habit Tracker Error" fallbackBody="Unable to load habit tracker. Try refreshing.">
                      <Suspense fallback={<SkeletonList />}>
                        <HabitTracker
                          habits={safeHabits}
                          onToggleHabit={handleToggleHabit}
                          onAdjustHabit={handleAdjustHabit}
                          onAddHabit={handleAddHabit}
                          onUpdateHabit={handleUpdateHabit}
                          onDeleteHabit={handleDeleteHabit}
                          onOpenChallenge={isFeatureVisible('challenges') ? handleOpenChallenge : undefined}
                        />
                      </Suspense>
                    </ModalErrorBoundary>
                  </div>

                  {/* Daily Prompt Card - HIDDEN: prompt is now built into GratitudeJournal via JournalPrompt */}
                  {/* {isFeatureVisible('gratitudeJournal') && (
                    <DailyPromptCard
                      onUsePrompt={handleUseJournalPrompt}
                    />
                  )} */}

                  {/* Gratitude Journal */}
                  {isFeatureVisible('gratitudeJournal') && (
                    <div ref={gratitudeRef}>
                      <LazyErrorBoundary componentName="Gratitude Journal">
                        <Suspense fallback={<SkeletonCard />}>
                          <GratitudeJournal
                            entries={safeGratitudeEntries}
                            onAddEntry={handleAddGratitude}
                            initialText={journalPromptText}
                            onInitialTextUsed={handleJournalPromptUsed}
                          />
                        </Suspense>
                      </LazyErrorBoundary>
                    </div>
                  )}
                </>
              )}
            </div>
          </PullToRefresh>
          </div>
        )}

        {activeTab === 'garden' && (
          <div className="animate-tab-enter">
          <div className="space-y-4">
            <Header
              userName={userName}
              onOpenChallenges={isFeatureVisible('challenges') ? () => setShowChallenges(true) : undefined}
              onOpenTasks={isFeatureVisible('tasks') ? () => setShowTasksPanel(true) : undefined}
              onOpenQuests={isFeatureVisible('quests') ? () => setShowQuestsPanel(true) : undefined}
              onOpenFriends={() => setShowFriendsPanel(true)}
            />

            {/* Schedule Timeline - ADHD-friendly day planner with habits auto-synced */}
            <LazyErrorBoundary componentName="Schedule Timeline">
              <Suspense fallback={<SkeletonList />}>
                <ScheduleTimeline
                  events={todayAllEvents}
                  onAddEvent={handleAddScheduleEvent}
                  onDeleteEvent={handleDeleteScheduleEvent}
                />
              </Suspense>
            </LazyErrorBoundary>

            {/* Diary */}
            <LazyErrorBoundary componentName="Journal">
              <Suspense fallback={<SkeletonCard />}>
                <JournalModule />
              </Suspense>
            </LazyErrorBoundary>

            {/* Breathing Exercise - Compact mindfulness card */}
            {isFeatureVisible('breathingExercise') && (
              <LazyErrorBoundary componentName="Breathing Exercise">
                <Suspense fallback={<SkeletonCard lines={1} />}>
                  <BreathingExercise
                    compact
                    onComplete={(pattern) => {
                      const treatResult = earnTreats('breathing', 5, `Breathing: ${pattern.name}`);
                      triggerXpPopup(treatResult.earned, 'breathing');
                      triggerSync();
                    }}
                  />
                </Suspense>
              </LazyErrorBoundary>
            )}

            {/* Focus Timer */}
            {isFeatureVisible('focusTimer') && (
              <ModalErrorBoundary fallbackTitle="Focus Timer Error" fallbackBody="Unable to load focus timer. Try refreshing.">
                <Suspense fallback={<SkeletonCard />}>
                  <FocusTimer
                    sessions={safeFocusSessions}
                    onCompleteSession={handleCompleteFocusSession}
                    onMinuteUpdate={setCurrentFocusMinutes}
                    isPrimaryCTA={true}
                  />
                </Suspense>
              </ModalErrorBoundary>
            )}

            {/* Insights */}
            <LazyErrorBoundary componentName="Insights">
              <MoodInsights
                moods={safeMoods}
                habits={safeHabits}
                focusSessions={safeFocusSessions}
                gratitudeEntries={safeGratitudeEntries}
              />
            </LazyErrorBoundary>

          </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="animate-tab-enter">
            <Header userName={userName} />
            <LazyErrorBoundary componentName="Stats">
              <Suspense fallback={<SkeletonStats count={4} className="px-4 pt-8" />}>
                <StatsPage
                  moods={safeMoods}
                  habits={safeHabits}
                  focusSessions={safeFocusSessions}
                  gratitudeEntries={safeGratitudeEntries}
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
              </Suspense>
            </LazyErrorBoundary>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="animate-tab-enter">
          <div className="content-with-nav px-4">
            <LazyErrorBoundary componentName="Achievements">
              <AchievementsPanel
                stats={stats}
                unlockedAchievements={gamificationState.unlockedAchievements}
              />
            </LazyErrorBoundary>
            {/* Leaderboard - Social Feature from v1.3.0 "Harmony" */}
            <LazyErrorBoundary componentName="Leaderboard">
              <Suspense fallback={<SkeletonList count={3} />}>
                <div className="mt-6">
                  <Leaderboard />
                </div>
              </Suspense>
            </LazyErrorBoundary>
          </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-tab-enter">
            <Header userName={userName} />
            <LazyErrorBoundary componentName="Settings">
              <Suspense fallback={<SkeletonSection />}>
                <SettingsPanel
                  userName={userName}
                  onNameChange={handleNameChange}
                  onResetData={handleResetData}
                  reminders={reminders}
                  onRemindersChange={setReminders}
                  habits={safeHabits}
                  moods={safeMoods}
                  focusSessions={safeFocusSessions}
                  gratitudeEntries={safeGratitudeEntries}
                  privacy={privacy}
                  onPrivacyChange={setPrivacy}
                  onOpenWidgetSettings={() => setShowWidgetSettings(true)}
                  initialOpenSection={settingsOpenSection}
                />
              </Suspense>
            </LazyErrorBoundary>
          </div>
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
