import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useAppStore, useUIStore, selectAnyModalOpen, useGamificationStore, useHydrateGamification, useUserDataStore, useHydrateUserData, type TabType } from '@/stores';
import { motion } from 'framer-motion';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { LazyErrorBoundary, ModalErrorBoundary } from '@/components/ErrorBoundary';
import { logger } from '@/lib/logger';
import { addFriendActivity, loadMyProfile } from '@/storage/friendsSync';
import { initializeApp } from '@/lib/appInitializer';
import { MoodEntry, Habit, FocusSession, GratitudeEntry, ScheduleEvent } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmotionTheme } from '@/contexts/EmotionThemeContext';
import { AdProvider } from '@/contexts/AdContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { MoodBackgroundOverlay } from '@/components/MoodBackgroundOverlay';
import { triggerXpPopup } from '@/components/XpPopup';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { SessionExpiredBanner } from '@/components/SessionExpiredBanner';
import { db } from '@/storage/db';
import { defaultReminderSettings } from '@/lib/reminders';
import { generateId, getToday, calculateStreak } from '@/lib/utils';
import { safeLocalStorageGet } from '@/lib/safeJson';
import { findTemplateIdByName, getHabitTemplateName } from '@/lib/habitTemplates';
import { normalizeHabit } from '@/lib/habits';
import { supabase } from '@/lib/supabaseClient';
import { syncReminderSettings } from '@/storage/reminderSync';
import { syncWithCloud, startAutoSync, stopAutoSync, triggerSync } from '@/storage/cloudSync';
import { joinPresence, leavePresence } from '@/lib/presenceService';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { generateHabitScheduleEvents, mergeScheduleEvents } from '@/lib/habitScheduleSync';
import { migrateExistingUser } from '@/lib/cloudSyncSettings';
import { useQuickActions, QuickActionType } from '@/hooks/useQuickActions';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { App } from '@capacitor/app';
import {
  handleAuthCallback,
  isNativePlatform,
  notifyAuthComplete,
  setPendingAuthUrl,
  getPendingAuthUrl
} from '@/lib/authRedirect';
import { AUTH_SESSION_EXPIRED_EVENT } from '@/lib/apiClient';
import { registerModalCloseCallback } from '@/lib/androidBackHandler';
import {
  scheduleLocalReminders,
  scheduleHabitReminders,
  registerMoodNotificationActions,
  setupNotificationActionListener,
  setMoodActionCallback,
  scheduleMoodQuickLogNotification,
  initializeNotificationChannel,
} from '@/lib/localNotifications';

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
import { WeeklyReport } from '@/components/WeeklyReport';
import { TimeHelper } from '@/components/TimeHelper';

// More lazy-loaded components (opened via modals/sheets) with retry logic
const ChallengesPanel = lazyWithRetry(() => import('@/components/ChallengesPanel').then(m => ({ default: m.ChallengesPanel })), 'ChallengesPanel');
const TasksPanel = lazyWithRetry(() => import('@/components/TasksPanel').then(m => ({ default: m.TasksPanel })), 'TasksPanel');
const QuestsPanel = lazyWithRetry(() => import('@/components/QuestsPanel').then(m => ({ default: m.QuestsPanel })), 'QuestsPanel');
const WidgetSettings = lazyWithRetry(() => import('@/pages/WidgetSettings').then(m => ({ default: m.WidgetSettings })), 'WidgetSettings');
const Leaderboard = lazyWithRetry(() => import('@/components/Leaderboard').then(m => ({ default: m.Leaderboard })), 'Leaderboard');
const FriendsPanel = lazyWithRetry(() => import('@/components/FriendsPanel').then(m => ({ default: m.FriendsPanel })), 'FriendsPanel');
import { useGamification } from '@/hooks/useGamification';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { useInnerWorld } from '@/hooks/useInnerWorld';
import { getChallenges, getBadges, addChallenge, syncChallengeProgress } from '@/lib/challengeStorage';
import { syncChallengesWithCloud, syncBadgesWithCloud, subscribeToChallengeUpdates, subscribeToBadgeUpdates } from '@/storage/challengeCloudSync';
import { syncTasks, syncQuests, subscribeToTaskUpdates, subscribeToQuestUpdates } from '@/storage/tasksCloudSync';
import { updateAllQuestsProgress } from '@/lib/randomQuests';
import { MoodInsights } from '@/components/MoodInsights';
import { StreakBanner } from '@/components/StreakBanner';
import { UrgencyAlert } from '@/components/UrgencyAlert';
import { RestModeCard } from '@/components/RestModeCard';
import { WhatsNewModal } from '@/components/WhatsNewModal';
import { ChallengeModal } from '@/components/ChallengeModal';
import { decodeInviteData } from '@/lib/friendChallenge';
import { initializeOfflineQueueHandlers, queueFocusSessionSync } from '@/lib/offlineQueueHandlers';
import { AllCompleteCelebration } from '@/components/AllCompleteCelebration';
import { ConsentBanner } from '@/components/ConsentBanner';
import { GlobalScheduleBar } from '@/components/GlobalScheduleBar';
import { haptics } from '@/lib/haptics';
import { preloadShareCardAssets } from '@/lib/shareCards';
import { initializePushNotifications } from '@/lib/pushNotifications';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useScrollLock } from '@/hooks/useScrollLock';
// import { AICoachChat } from '@/components/AICoachChat'; // Hidden until AI ready
// import { useAICoach } from '@/contexts/AICoachContext'; // Hidden until AI ready
import { OnboardingOverlay, DayProgressIndicator } from '@/components/OnboardingOverlay';
import { FeatureUnlock } from '@/components/FeatureUnlock';
import { QuickStatsRow } from '@/components/ui/stat-card';
import { SkeletonCard, SkeletonStats, SkeletonList, SkeletonSection } from '@/components/ui/skeleton';
import { MindfulMoment } from '@/components/MindfulMoment';
import {
  initializeOnboarding,
  checkFeatureUnlock,
  unlockFeature,
  shouldShowWelcome,
  updateOnboardingProgress,
  type FeatureId
} from '@/lib/onboardingFlow';
import { WelcomeBackModal } from '@/components/WelcomeBackModal';
import {
  shouldShowWelcomeBack,
  markWelcomeBackShown,
  getDaysSinceLastActive,
  calculateHabitSuccessRates,
  wasStreakBroken,
  updateLastActiveDate
} from '@/lib/reEngagement';
import { recordHabitForChallenge } from '@/lib/comebackChallenge';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { checkForAppUpdate, wasUpdateDismissed, dismissUpdate } from '@/lib/appUpdateManager';

export function Index() {
  const { t, language, isRTL } = useLanguage();
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
  const lastSyncedUserIdRef = useRef<string | null>(null);
  const hadSignOutRef = useRef(false);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const mindfulTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const quickActionTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
      if (mindfulTimeoutRef.current) clearTimeout(mindfulTimeoutRef.current);
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
  const setInitializationState = useAppStore(s => s.setInitializationState);
  const loadingFadeOut = useAppStore(s => s.loadingFadeOut);
  const setLoadingFadeOut = useAppStore(s => s.setLoadingFadeOut);

  // App initialization effect (before other useEffects)
  useEffect(() => {
    let active = true;
    const initialize = async () => {
      logger.log('[Index] Starting app initialization...');
      const startTime = Date.now();

      // Hide native splash IMMEDIATELY so web animation is visible
      if (Capacitor.isNativePlatform()) {
        SplashScreen.hide().catch(() => {});
      }

      // Initialize offline queue handlers for offline-first sync
      initializeOfflineQueueHandlers();

      // Apply OLED mode if previously enabled
      if (localStorage.getItem('zenflow_oled_mode') === 'true') {
        document.documentElement.classList.add('oled');
      }

      const result = await initializeApp();

      // Ensure animation plays for minimum 2 seconds
      // (logo spring 0-0.6s, text 0.3s, subtitle 0.6s, shimmer 0.8s — 2s shows full sequence)
      const elapsed = Date.now() - startTime;
      const MIN_DISPLAY_MS = 2000;
      if (elapsed < MIN_DISPLAY_MS) {
        await new Promise(r => window.setTimeout(r, MIN_DISPLAY_MS - elapsed));
      }

      if (!active) return;

      // Start exit fade animation
      setLoadingFadeOut(true);

      // After fade completes, remove loading screen and set final state
      await new Promise(r => window.setTimeout(r, 400));

      if (!active) return;

      if (!result.success) {
        setInitializationState({
          isInitializing: false,
          error: result.error || 'Initialization failed',
          wasUpdated: result.wasUpdated
        });
        return;
      }

      // Preload share card assets in background for faster sharing
      void preloadShareCardAssets();

      if (result.wasUpdated) {
        logger.log('[Index] App was updated, showing update message');
        // Show brief update success message
        initTimeoutRef.current = setTimeout(() => {
          if (!active) return;
          setInitializationState({
            isInitializing: false,
            error: null,
            wasUpdated: true
          });
        }, 1000);
      } else {
        setInitializationState({
          isInitializing: false,
          error: null,
          wasUpdated: false
        });
      }
    };

    void initialize();
    return () => { active = false; };
  }, []); // Run only once on mount

  // Track current date and detect midnight change (Zustand)
  const currentDate = useAppStore(s => s.currentDate);
  const setCurrentDate = useAppStore(s => s.setCurrentDate);
  // Initialize currentDate on mount
  useEffect(() => {
    if (!currentDate) setCurrentDate(getToday());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for date change every minute (for midnight reset of mood)
  useEffect(() => {
    const checkDateChange = () => {
      const newDate = getToday();
      if (newDate !== currentDate) {
        logger.log('Date changed from', currentDate, 'to', newDate);
        setCurrentDate(newDate);
        // This will trigger a re-render and all date-dependent useMemo hooks will recalculate
      }
    };

    // Check every minute
    const interval = setInterval(checkDateChange, 60000);

    // Also check on window focus (in case device was sleeping)
    const handleFocus = () => checkDateChange();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentDate]);

  // Section refs for navigation
  const moodRef = useRef<HTMLDivElement>(null);
  const habitsRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const gratitudeRef = useRef<HTMLDivElement>(null);

  const handleNavigateToSection = useCallback((section: 'mood' | 'habits' | 'focus' | 'gratitude') => {
    const refs = { mood: moodRef, habits: habitsRef, focus: focusRef, gratitude: gratitudeRef };
    refs[section]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Lock screen quick actions integration
  const { onAction: onQuickAction } = useQuickActions();

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
  const rewardUser = useGamificationStore(s => s.rewardUser);

  // Guard against double habit toggles (prevents duplicate rewards)
  const processingHabitsRef = useRef<Set<string>>(new Set());

  // Guard against concurrent reminder syncs (prevents infinite loop on 400 error)
  const reminderSyncPendingRef = useRef(false);

  // Current focus minutes (real-time) from UI store
  const currentFocusMinutes = useUIStore(s => s.currentFocusMinutes);
  const setCurrentFocusMinutes = useUIStore(s => s.setCurrentFocusMinutes);

  // UI modal/panel state from Zustand uiStore
  const showWeeklyReport = useUIStore(s => s.showWeeklyReport);
  const showWidgetSettings = useUIStore(s => s.showWidgetSettings);
  const showChallenges = useUIStore(s => s.showChallenges);
  const showChallengeModal = useUIStore(s => s.showChallengeModal);
  const challengeInvite = useUIStore(s => s.challengeInvite);
  const setChallengeInvite = useUIStore(s => s.setChallengeInvite);
  const challengeHabit = useUIStore(s => s.challengeHabit);
  const setChallengeHabit = useUIStore(s => s.setChallengeHabit);
  const showTimeHelper = useUIStore(s => s.showTimeHelper);
  const showTasksPanel = useUIStore(s => s.showTasksPanel);
  const showQuestsPanel = useUIStore(s => s.showQuestsPanel);
  const showFriendsPanel = useUIStore(s => s.showFriendsPanel);
  const confettiBurst = useUIStore(s => s.confettiBurst);
  const setConfettiBurst = useUIStore(s => s.setConfettiBurst);
  // Modal setters (convenience wrappers for JSX callbacks)
  const { openModal, closeModal } = useUIStore.getState();
  const setShowWeeklyReport = useCallback((v: boolean) => v ? openModal('showWeeklyReport') : closeModal('showWeeklyReport'), [openModal, closeModal]);
  const setShowWidgetSettings = useCallback((v: boolean) => v ? openModal('showWidgetSettings') : closeModal('showWidgetSettings'), [openModal, closeModal]);
  const setShowChallenges = useCallback((v: boolean) => v ? openModal('showChallenges') : closeModal('showChallenges'), [openModal, closeModal]);
  const setShowChallengeModal = useCallback((v: boolean) => v ? openModal('showChallengeModal') : closeModal('showChallengeModal'), [openModal, closeModal]);
  const setShowTimeHelper = useCallback((v: boolean) => v ? openModal('showTimeHelper') : closeModal('showTimeHelper'), [openModal, closeModal]);
  const setShowTasksPanel = useCallback((v: boolean) => v ? openModal('showTasksPanel') : closeModal('showTasksPanel'), [openModal, closeModal]);
  const setShowQuestsPanel = useCallback((v: boolean) => v ? openModal('showQuestsPanel') : closeModal('showQuestsPanel'), [openModal, closeModal]);
  const setShowFriendsPanel = useCallback((v: boolean) => v ? openModal('showFriendsPanel') : closeModal('showFriendsPanel'), [openModal, closeModal]);
  const setShowWelcomeOverlay = useCallback((v: boolean) => v ? openModal('showWelcomeOverlay') : closeModal('showWelcomeOverlay'), [openModal, closeModal]);
  const setShowWelcomeBack = useCallback((v: boolean) => v ? openModal('showWelcomeBack') : closeModal('showWelcomeBack'), [openModal, closeModal]);
  const setShowMindfulMoment = useCallback((v: boolean) => v ? openModal('showMindfulMoment') : closeModal('showMindfulMoment'), [openModal, closeModal]);

  const [challenges, setChallenges] = useState(() => getChallenges());
  const [badges, setBadges] = useState(() => getBadges());

  // Onboarding, celebrations, update state from UI store
  const showWelcomeOverlay = useUIStore(s => s.showWelcomeOverlay);
  const featureToUnlock = useUIStore(s => s.featureToUnlock);
  const setFeatureToUnlock = useUIStore(s => s.setFeatureToUnlock);
  const showWelcomeBack = useUIStore(s => s.showWelcomeBack);
  const welcomeBackData = useUIStore(s => s.welcomeBackData);
  const setWelcomeBackData = useUIStore(s => s.setWelcomeBackData);
  const updateState = useUIStore(s => s.updateState);
  const setUpdateState = useUIStore(s => s.setUpdateState);
  const showMindfulMoment = useUIStore(s => s.showMindfulMoment);

  // Lock background scroll when any modal/panel is open (computed from UI store)
  const anyModalOpen = useUIStore(selectAnyModalOpen);
  useScrollLock(anyModalOpen);

  // Journal prompt text from UI store
  const journalPromptText = useUIStore(s => s.journalPromptText);
  const setJournalPromptText = useUIStore(s => s.setJournalPromptText);

  // Auth state from app store
  const authBypassFlag = useAppStore(s => s.authBypassFlag);
  const setAuthBypassFlag = useAppStore(s => s.setAuthBypassFlag);
  const isProcessingWebOAuth = useAppStore(s => s.isProcessingWebOAuth);
  const setIsProcessingWebOAuth = useAppStore(s => s.setIsProcessingWebOAuth);
  const webOAuthError = useAppStore(s => s.webOAuthError);
  const setWebOAuthError = useAppStore(s => s.setWebOAuthError);

  // ── User data from Zustand store (hydrated from IndexedDB via bridge hook) ──
  useHydrateUserData();
  const hasSelectedLanguage = useUserDataStore(s => s.hasSelectedLanguage);
  const setHasSelectedLanguage = useUserDataStore(s => s.setHasSelectedLanguage);
  const userName = useUserDataStore(s => s.userName);
  const setUserName = useUserDataStore(s => s.setUserName);
  const userNameCustom = useUserDataStore(s => s.userNameCustom);
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
  const setHasValidSession = useAppStore(s => s.setHasValidSession);

  // Check Supabase session on mount - restore auth state if session exists
  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;

        const sessionExists = !!data.session;
        setHasValidSession(sessionExists);

        // If session exists but googleAuthChecked is false, restore it
        // This prevents the login loop after OAuth redirect
        if (sessionExists && !googleAuthChecked && !isLoadingUserData) {
          logger.log('[Index] Session exists but auth not checked - restoring state');
          setGoogleAuthChecked(true);
        }
      } catch (error) {
        logger.error('[Index] Error checking session:', error);
        if (active) {
          setHasValidSession(false);
        }
      }
    };

    void checkSession();

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setHasValidSession(!!session);
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [googleAuthChecked, isLoadingUserData, setGoogleAuthChecked]);

  // Web OAuth callback detection — runs ONCE on mount
  // Detects ?code= or ?error= in URL (from Supabase PKCE redirect)
  // Shows loading state while exchange completes, prevents AuthScreen flash
  useEffect(() => {
    if (isNativePlatform() || !supabase) return;

    const url = new URL(window.location.href);
    const hasCode = url.searchParams.has('code');
    const hasError = url.searchParams.has('error');
    const errorDescription = url.searchParams.get('error_description');

    if (!hasCode && !hasError) return;

    // Handle error case immediately
    if (hasError) {
      logger.error('[Index] OAuth error in URL:', url.searchParams.get('error'), errorDescription);
      setWebOAuthError(errorDescription || 'Authentication failed. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // Has ?code= — wait for Supabase to exchange it
    logger.log('[Index] Web OAuth callback detected, waiting for code exchange...');
    setIsProcessingWebOAuth(true);

    let settled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return;

      if (event === 'SIGNED_IN' && session) {
        settled = true;
        logger.log('[Index] Web OAuth code exchange succeeded');
        window.history.replaceState({}, '', window.location.pathname);
        setIsProcessingWebOAuth(false);
      }
    });

    // Timeout: if no SIGNED_IN event after 15 seconds, exchange likely failed
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      logger.error('[Index] Web OAuth code exchange timed out after 15s');
      setIsProcessingWebOAuth(false);
      setWebOAuthError('Sign-in took too long. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }, 15000);

    return () => {
      settled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

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

  // Defensive array guards - prevent crashes from corrupted cloud sync data
  // Wrapped in useMemo to stabilize references for hook dependencies
  const safeMoods = useMemo(() => Array.isArray(moods) ? moods : [], [moods]);
  const safeHabits = useMemo(() => Array.isArray(habits) ? habits : [], [habits]);
  const safeFocusSessions = useMemo(() => Array.isArray(focusSessions) ? focusSessions : [], [focusSessions]);
  const safeGratitudeEntries = useMemo(() => Array.isArray(gratitudeEntries) ? gratitudeEntries : [], [gratitudeEntries]);
  const safeScheduleEvents = useMemo(() => Array.isArray(scheduleEvents) ? scheduleEvents : [], [scheduleEvents]);
  const safeBadges = useMemo(() => Array.isArray(badges) ? badges : [], [badges]);

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

  // Initialize Progressive Onboarding
  useEffect(() => {
    if (isLoading || !onboardingComplete) return;

    // Detect existing users (skip onboarding)
    const hasExistingData = safeMoods.length > 0 || safeHabits.length > 0 || safeFocusSessions.length > 0;

    // Initialize onboarding state
    initializeOnboarding({ hasExistingData });

    // Update progress (check for day change)
    updateOnboardingProgress();

    // Show welcome overlay for new users
    if (shouldShowWelcome()) {
      setShowWelcomeOverlay(true);
    }
  }, [isLoading, onboardingComplete, safeMoods.length, safeHabits.length, safeFocusSessions.length]);

  // Re-engagement detection (Welcome Back for 3+ day absence)
  useEffect(() => {
    if (isLoading || !onboardingComplete || isLoadingInnerWorld) return;

    // Update last active date
    updateLastActiveDate();

    // Check if we should show welcome back modal
    if (shouldShowWelcomeBack()) {
      const daysAway = getDaysSinceLastActive();
      const topHabits = calculateHabitSuccessRates(safeHabits);
      const streakBroken = wasStreakBroken(innerWorld.currentActiveStreak, daysAway, innerWorld.restDays);

      setWelcomeBackData({
        daysAway,
        streakBroken,
        currentStreak: innerWorld.currentActiveStreak,
        topHabits
      });
      setShowWelcomeBack(true);
      markWelcomeBackShown();
    }
  }, [isLoading, onboardingComplete, isLoadingInnerWorld, safeHabits, innerWorld.currentActiveStreak, innerWorld.restDays]);

  // Check for app updates (Google Play In-App Updates)
  // NOTE: Update check runs only after app is fully loaded to prevent blocking
  useEffect(() => {
    if (isLoading || !onboardingComplete) return;

    // Delay update check to ensure app is fully rendered first
    const timeoutId = setTimeout(async () => {
      if (wasUpdateDismissed()) return;

      try {
        const state = await checkForAppUpdate();
        if (state.available) {
          logger.log('[AppUpdate] Update available:', state);
          setUpdateState(state);
        }
      } catch (error) {
        logger.warn('[AppUpdate] Check failed (non-critical):', error);
      }
    }, 3000); // 3 second delay

    return () => clearTimeout(timeoutId);
  }, [isLoading, onboardingComplete]);

  // Check for feature unlocks after user actions
  const checkForFeatureUnlocks = useCallback(() => {
    const habitsCompleted = safeHabits.reduce((sum, h) => sum + (h.completedDates?.length || 0), 0);
    const focusSessionsCompleted = safeFocusSessions.length;
    const moodEntriesCount = safeMoods.length;

    const stats = { habitsCompleted, focusSessionsCompleted, moodEntriesCount };

    // Check each feature for unlock conditions
    const featuresToCheck: FeatureId[] = ['focusTimer', 'xp', 'quests', 'tasks', 'challenges'];

    for (const feature of featuresToCheck) {
      const { shouldUnlock } = checkFeatureUnlock({ feature, stats });

      if (shouldUnlock) {
        unlockFeature(feature);
        // Show celebration
        setFeatureToUnlock(feature);
        break; // Show one unlock at a time
      }
    }
  }, [safeHabits, safeFocusSessions, safeMoods]);

  // Helper function to update challenge progress after user actions
  const updateChallengeProgress = useCallback(() => {
    const totalFocusMinutes = safeFocusSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalGratitude = safeGratitudeEntries.length;
    const totalHabitsCompleted = safeHabits.reduce((sum, h) => sum + (h.completedDates?.length || 0), 0);

    // Calculate perfect days (days where ALL habits were completed)
    const habitDates = new Set<string>();
    safeHabits.forEach(h => h.completedDates?.forEach(d => habitDates.add(d)));
    let perfectDaysCount = 0;
    habitDates.forEach(date => {
      const allCompleted = safeHabits.every(h => h.completedDates?.includes(date));
      if (allCompleted && safeHabits.length > 0) perfectDaysCount++;
    });

    // Calculate zen master days (days with mood + habits + focus + gratitude)
    const moodDates = new Set(safeMoods.map(m => m.date));
    const focusDates = new Set(safeFocusSessions.map(f => f.date));
    const gratitudeDates = new Set(safeGratitudeEntries.map(g => g.date));
    let zenMasterDays = 0;
    habitDates.forEach(date => {
      const hasMood = moodDates.has(date);
      const hasFocus = focusDates.has(date);
      const hasGratitude = gratitudeDates.has(date);
      const allHabits = safeHabits.every(h => h.completedDates?.includes(date));
      if (hasMood && allHabits && hasFocus && hasGratitude && safeHabits.length > 0) {
        zenMasterDays++;
      }
    });

    // Get early bird / night owl counts from localStorage (tracked incrementally)
    const specialBadgeData = safeLocalStorageGet<Record<string, number>>('zenflow-special-badges', {});

    // Build UserStats object matching types/index.ts interface
    const userStats = {
      totalFocusMinutes,
      currentStreak: innerWorld.currentActiveStreak || 0,
      longestStreak: innerWorld.currentActiveStreak || 0, // Approximation
      habitsCompleted: totalHabitsCompleted,
      moodEntries: safeMoods.length,
      gratitudeEntries: totalGratitude,
      perfectDaysCount,
      earlyBirdCount: specialBadgeData.earlyBirdCount || 0,
      nightOwlCount: specialBadgeData.nightOwlCount || 0,
      zenMasterDays,
    };

    const newBadges = syncChallengeProgress(userStats, totalFocusMinutes, totalGratitude);

    // Refresh challenges and badges state
    setChallenges(getChallenges());

    if (newBadges.length > 0) {
      setBadges(getBadges());
      // Could add a celebration/notification for new badges here
    }
  }, [safeFocusSessions, safeGratitudeEntries, safeHabits, safeMoods, innerWorld.currentActiveStreak]);

  // Handlers
  const handleAddMood = (entry: MoodEntry) => {
    setMoods(prev => [...prev, entry]);
    rewardUser('mood', { treats: 5, treatReason: 'Logged mood', haptic: haptics.moodSaved, seedExtra: entry.mood });
    updateChallengeProgress();
  };

  // Quick mood handler for one-tap notification actions
  const handleQuickMood = useCallback((mood: MoodEntry['mood']) => {
    const today = getToday();
    const entry: MoodEntry = {
      id: generateId(),
      mood,
      date: today,
      timestamp: Date.now(),
    };

    setMoods(prev => [...prev, entry]);
    rewardUser('mood', { treats: 5, treatReason: 'Quick mood', haptic: haptics.moodSaved, skipPopup: true, seedExtra: mood });

    logger.log('Quick mood logged from notification:', mood);
  }, [rewardUser, setMoods]);

  // Update existing mood entry (for same-day editing)
  const _handleUpdateMood = (entryId: string, newMood: MoodEntry['mood'], note?: string) => {
    setMoods(prev => prev.map(entry => {
      if (entry.id !== entryId) return entry;
      return {
        ...entry,
        mood: newMood,
        note: note ?? entry.note,
      };
    }));
    triggerSync(); // Auto-sync to cloud
  };

  // Track early bird / night owl for special badges
  const trackTimeOfDayCompletion = useCallback(() => {
    const hour = new Date().getHours();
    let data: Record<string, number> = {};
    try {
      data = JSON.parse(localStorage.getItem('zenflow-special-badges') || '{}');
    } catch {
      // Ignore parse errors
    }

    if (hour < 8) {
      // Early Bird: before 8 AM
      data.earlyBirdCount = (data.earlyBirdCount || 0) + 1;
    } else if (hour >= 22) {
      // Night Owl: after 10 PM
      data.nightOwlCount = (data.nightOwlCount || 0) + 1;
    }

    localStorage.setItem('zenflow-special-badges', JSON.stringify(data));
  }, []);

  const handleToggleHabit = (habitId: string, date: string) => {
    // Guard against rapid double-clicks (prevents duplicate rewards)
    const processingKey = `${habitId}-${date}`;
    if (processingHabitsRef.current.has(processingKey)) {
      return; // Already processing this habit
    }
    processingHabitsRef.current.add(processingKey);

    // Clear processing flag after a short delay
    processingTimeoutRef.current = setTimeout(() => {
      processingHabitsRef.current.delete(processingKey);
    }, 500);

    setHabits(prev => prev.map(habit => {
      if (habit.id !== habitId) return habit;

      const habitType = habit.type || 'daily';

      // Reduce habits use handleAdjustHabit
      if (habitType === 'reduce') return habit;

      // Continuous habits don't toggle - they track failures
      if (habitType === 'continuous') return habit;

      // Multiple times per day habits
      if (habitType === 'multiple') {
        const completionsByDate = { ...(habit.completionsByDate || {}) };
        const current = completionsByDate[date] ?? 0;
        const target = habit.dailyTarget ?? 1;

        // Increment count up to target
        if (current < target) {
          completionsByDate[date] = current + 1;
          awardXp('habit'); // +10 XP for each completion
          const treatResult = earnTreats('habit', 10, 'Completed habit');
          triggerXpPopup(treatResult.earned, 'habit'); // Show treats earned
          void haptics.habitToggled();
          trackTimeOfDayCompletion(); // Track for Early Bird/Night Owl badges
        }

        const existingDates = habit.completedDates || [];
        return {
          ...habit,
          completionsByDate,
          completedDates: completionsByDate[date] >= target
            ? [...new Set([...existingDates, date])]
            : existingDates.filter(d => d !== date),
          updatedAt: new Date().toISOString(), // Timestamp for conflict resolution
        };
      }

      // Daily and scheduled habits (normal toggle)
      const existingDates = habit.completedDates || [];
      const completed = existingDates.includes(date);
      if (!completed) {
        awardXp('habit'); // +10 XP for completing habit (legacy)
        const treatResult = earnTreats('habit', 10, 'Completed habit');
        triggerXpPopup(treatResult.earned, 'habit'); // Show treats earned
        void haptics.habitCompleted();
        // Confetti burst at center of screen
        setConfettiBurst({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        trackTimeOfDayCompletion(); // Track for Early Bird/Night Owl badges
        // Inner World: Plant a tree when completing habit
        plantSeed('habit');
        waterPlants('habit');

        // Track for friends activity feed
        const friendProfile = loadMyProfile();
        if (friendProfile) {
          addFriendActivity({
            friendId: friendProfile.friendCode,
            friendName: friendProfile.displayName,
            activityType: 'habit_completed',
            description: habit.name,
            icon: habit.icon || '✅',
          });
        }

        // Track comeback challenge progress
        const challengeResult = recordHabitForChallenge(date);
        if (challengeResult.challengeComplete) {
          // Award bonus XP for completing comeback challenge
          earnTreats('habit', challengeResult.bonusXp, 'Comeback Challenge Complete!');
          triggerXpPopup(challengeResult.bonusXp, 'bonus');
        }
      }
      return {
        ...habit,
        completedDates: completed
          ? existingDates.filter(d => d !== date)
          : [...existingDates, date],
        updatedAt: new Date().toISOString(), // Timestamp for conflict resolution
      };
    }));
    triggerSync(); // Auto-sync to cloud

    // Update challenge progress
    updateChallengeProgress();

    // Check for feature unlocks (progressive onboarding)
    checkForFeatureUnlocks();

    // Update quest progress and award XP for completed quests
    const completedQuests = updateAllQuestsProgress({ type: 'habit_completed', value: 1 });
    completedQuests.forEach(quest => {
      const xpReward = quest.reward.xp;
      earnTreats('habit', xpReward, `Quest: ${quest.title}`);
      triggerXpPopup(xpReward, 'bonus');
    });
  };

  const handleAdjustHabit = (habitId: string, date: string, delta: number) => {
    setHabits(prev => prev.map(habit => {
      if (habit.id !== habitId) return habit;
      const habitType = habit.type || 'daily';

      if (habitType === 'reduce') {
        const progressByDate = { ...(habit.progressByDate || {}) };
        const current = typeof progressByDate[date] === 'number' ? progressByDate[date] : 0;
        progressByDate[date] = Math.max(0, current + delta);
        return { ...habit, progressByDate };
      }

      if (habitType === 'multiple') {
        const completionsByDate = { ...(habit.completionsByDate || {}) };
        const current = completionsByDate[date] ?? 0;
        const target = habit.dailyTarget ?? 1;
        const next = Math.max(0, Math.min(target, current + delta));
        completionsByDate[date] = next;
        const existingDates = habit.completedDates || [];
        return {
          ...habit,
          completionsByDate,
          completedDates: next >= target
            ? [...new Set([...existingDates, date])]
            : existingDates.filter(d => d !== date),
          updatedAt: new Date().toISOString(),
        };
      }

      return habit;
    }));
    triggerSync(); // Auto-sync to cloud
  };

  const handleAddHabit = (habit: Habit) => {
    setHabits(prev => [...prev, habit]);
    triggerSync(); // Auto-sync to cloud
  };

  const handleUpdateHabit = (updatedHabit: Habit) => {
    setHabits(prev => prev.map(h => h.id === updatedHabit.id ? updatedHabit : h));
    triggerSync(); // Auto-sync to cloud
  };

  const handleDeleteHabit = (habitId: string) => {
    setHabits(prev => prev.filter(h => h.id !== habitId));
    triggerSync(); // Auto-sync to cloud
  };

  const handleCompleteFocusSession = (session: FocusSession) => {
    setFocusSessions(prev => [...prev, session]);

    const focusTreats = Math.round(session.duration * 0.5);
    rewardUser('focus', { treats: focusTreats, treatReason: `Focus ${session.duration}min`, haptic: haptics.focusCompleted });

    // Queue for offline sync (uses offline queue with retry logic)
    queueFocusSessionSync(session).catch((err) => {
      logger.warn('[Index] Failed to queue focus session sync:', err);
    });

    // Show MindfulMoment after focus session (only for sessions > 5 min)
    if (session.duration >= 5) {
      mindfulTimeoutRef.current = setTimeout(() => setShowMindfulMoment(true), 500);
    }

    updateChallengeProgress();
    checkForFeatureUnlocks();

    // Award bonus treats for completed quests
    const completedQuests = updateAllQuestsProgress({ type: 'focus_completed', value: session.duration });
    completedQuests.forEach(quest => {
      const xpReward = quest.reward.xp;
      earnTreats('focus', xpReward, `Quest: ${quest.title}`);
      triggerXpPopup(xpReward, 'bonus');
    });
  };

  const handleAddGratitude = (entry: GratitudeEntry) => {
    setGratitudeEntries(prev => [...prev, entry]);
    rewardUser('gratitude', { treats: 8, treatReason: 'Gratitude entry', haptic: haptics.gratitudeSaved });

    // Gratitude-specific: attract creatures
    if (Math.random() < 0.3) attractCreature();
    feedCreatures();

    updateChallengeProgress();

    // Award bonus treats for completed quests
    const completedQuests = updateAllQuestsProgress({ type: 'gratitude_added', value: 1 });
    completedQuests.forEach(quest => {
      const xpReward = quest.reward.xp;
      earnTreats('gratitude', xpReward, `Quest: ${quest.title}`);
      triggerXpPopup(xpReward, 'bonus');
    });
  };

  // MindfulMoment completion handler
  const handleMindfulMomentComplete = useCallback(() => {
    // Award treats for completing mindful moment
    const treatResult = earnTreats('mindful', 1, 'Mindful Moment');
    triggerXpPopup(treatResult.earned, 'mindful');
  }, [earnTreats]);

  // DailyPromptCard handler - opens GratitudeJournal with prompt
  const _handleUseJournalPrompt = useCallback((promptText: string) => {
    setJournalPromptText(promptText);
    // Scroll to gratitude section
    gratitudeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Clear journal prompt text after it's been used
  const handleJournalPromptUsed = useCallback(() => {
    setJournalPromptText(undefined);
  }, []);

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

  // Open challenge modal from HabitTracker
  const handleOpenChallenge = useCallback((habit?: Habit) => {
    setChallengeHabit(habit);
    setShowChallengeModal(true);
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

  const _handleAuthComplete = (userData?: { name: string; email: string }) => {
    if (userData) {
      // User signed in with Google - use their name
      setUserName(userData.name);
      setUserNameCustom(false); // Allow them to change it later
    }
    // Auth is now optional - no need to set gate complete
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

  const reminderCopy = useMemo(() => {
    const habitNameMap = new Map(safeHabits.map((habit) => [habit.id, habit.name]));
    const habitNames = reminders.habitIds
      .map((id) => habitNameMap.get(id))
      .filter(Boolean);
    const habitBody =
      habitNames.length === 0
        ? t.reminderHabitBody
        : `${t.reminderHabitBody} ${habitNames.join(", ")}`;

    return {
      mood: { title: t.reminderMoodTitle, body: t.reminderMoodBody },
      habit: { title: t.reminderHabitTitle, body: habitBody },
      focus: { title: t.reminderFocusTitle, body: t.reminderFocusBody }
    };
  }, [safeHabits, reminders.habitIds, t]);

  useEffect(() => {
    if (safeHabits.length === 0) return;
    setHabits(prev => {
      let changed = false;
      const updated = prev.map(habit => {
        const normalized = normalizeHabit(habit);
        const templateId = normalized.templateId || findTemplateIdByName(normalized.name);
        if (!templateId) {
          if (normalized !== habit) {
            changed = true;
          }
          return normalized;
        }
        const localizedName = getHabitTemplateName(templateId, language);
        if (normalized.name !== localizedName || normalized.templateId !== templateId || normalized !== habit) {
          changed = true;
          return { ...normalized, name: localizedName, templateId };
        }
        if (normalized !== habit) {
          changed = true;
        }
        return normalized;
      });
      return changed ? updated : prev;
    });
  }, [language, safeHabits.length, setHabits]);

  useEffect(() => {
    if (!supabase || reminderSyncPendingRef.current) return;

    reminderSyncPendingRef.current = true;
    const timeoutId = window.setTimeout(() => {
      syncReminderSettings(reminders, language)
        .catch((error) => {
          logger.error("Failed to sync reminder settings:", error);
        })
        .finally(() => {
          reminderSyncPendingRef.current = false;
        });
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
      // Don't reset pending flag here - let the promise complete
    };
  }, [reminders, language]);

  useEffect(() => {
    if (!isNativePlatform()) return;
    scheduleLocalReminders(reminders, reminderCopy).catch((error) => {
      logger.error("Failed to schedule local reminders:", error);
    });
  }, [reminders, reminderCopy]);

  // Schedule per-habit push notifications
  useEffect(() => {
    if (!isNativePlatform()) return;
    scheduleHabitReminders(habits, {
      reminderTitle: t.reminderHabitTitle,
      reminderBody: t.reminderHabitBody
    }).catch((error) => {
      logger.error("Failed to schedule habit reminders:", error);
    });
  }, [habits, t.reminderHabitTitle, t.reminderHabitBody]);

  // Initialize notification channel (Android 8+ requirement)
  useEffect(() => {
    if (!isNativePlatform()) return;
    initializeNotificationChannel().catch((error) => {
      logger.error('Failed to initialize notification channel:', error);
    });
  }, []);

  // Initialize FCM push notifications (Android)
  useEffect(() => {
    if (!isNativePlatform()) return;
    initializePushNotifications().catch((error) => {
      logger.error('Failed to initialize push notifications:', error);
    });
  }, []);

  // Set up one-tap mood notification actions
  useEffect(() => {
    if (!isNativePlatform()) return;

    let cleanupListener: (() => void) | null = null;

    const setupMoodActions = async () => {
      // Register notification action types (mood emoji buttons)
      await registerMoodNotificationActions();

      // Set up listener for action taps
      cleanupListener = await setupNotificationActionListener();

      // Register callback to handle quick mood logging
      setMoodActionCallback(handleQuickMood);
    };

    setupMoodActions().catch((error) => {
      logger.error('Failed to setup mood notification actions:', error);
    });

    return () => {
      if (cleanupListener) cleanupListener();
    };
  }, [handleQuickMood]);

  // Schedule mood quick-log notification with action buttons (morning check-in)
  useEffect(() => {
    if (!isNativePlatform() || isLoadingInnerWorld || !reminders.enabled) return;

    const parseTime = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return { hour: hours, minute: minutes };
    };

    // Use morning time for the quick-log notification
    scheduleMoodQuickLogNotification(
      parseTime(reminders.moodTimeMorning),
      t.howAreYouNow || 'How are you feeling? Tap! 😊'
    ).catch((error) => {
      logger.error('Failed to schedule mood quick-log notification:', error);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders.enabled, reminders.moodTimeMorning, t.howAreYouNow]);

  // Lock screen quick actions handler
  useEffect(() => {
    onQuickAction((action: QuickActionType) => {
      logger.log('[Index] Quick action triggered:', action);

      // Switch to home tab first
      setActiveTab('home');

      // Small delay to ensure tab switch is complete before scrolling
      quickActionTimeoutRef.current = setTimeout(() => {
        switch (action) {
          case 'mood':
            handleNavigateToSection('mood');
            break;
          case 'focus':
            handleNavigateToSection('focus');
            break;
          case 'habits':
            handleNavigateToSection('habits');
            break;
        }
      }, 100);
    });
  }, [onQuickAction, handleNavigateToSection]);

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

  // Process pending auth URL when supabase becomes ready
  useEffect(() => {
    if (!supabase || !isNativePlatform()) return;

    let active = true;
    const pendingUrl = getPendingAuthUrl();
    if (pendingUrl) {
      logger.log('[Index] Processing pending auth URL');

      void (async () => {
        try {
          await handleAuthCallback(supabase, pendingUrl);

          // Check if component is still mounted
          if (!active) return;

          const { data } = await supabase.auth.getSession();
          if (!active) return;

          if (data.session?.user) {
            const metadata = data.session.user.user_metadata;
            const name = metadata?.full_name || metadata?.name || data.session.user.email?.split('@')[0] || 'Friend';

            // Don't log email (PII)
            logger.log('[Auth] Pending auth processed successfully');
            setAuthBypassFlag(true);
            notifyAuthComplete();
            setUserName(name);
            setUserNameCustom(false);
            setGoogleAuthChecked(true);
          }
        } catch (error) {
          logger.error('[Index] Failed to process pending auth:', error);
        }
      })();
    }

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, setUserName, setUserNameCustom, setGoogleAuthChecked]);

  useEffect(() => {
    if (!supabase || isLoading) return;
    let active = true;

    const syncIfNeeded = async (userId?: string | null) => {
      if (!active || !userId) return;
      if (lastSyncedUserIdRef.current === userId) return;

      // Use 'replace' if: (a) sign-out happened, or (b) different user was synced before
      const isAccountSwitch = hadSignOutRef.current ||
        (lastSyncedUserIdRef.current !== null && lastSyncedUserIdRef.current !== userId);

      lastSyncedUserIdRef.current = userId;
      hadSignOutRef.current = false;

      try {
        // Use 'replace' on account switch to avoid merging different users' data
        await syncWithCloud(isAccountSwitch ? 'replace' : 'merge');
        // Start auto-sync after successful initial sync
        startAutoSync();
        // Join Presence channel for friend online status
        joinPresence().catch(() => {});
      } catch (error) {
        logger.error('Cloud sync failed:', error);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      // v1.1.1 Migration: Auto-enable cloud sync for existing users
      if (data.session) {
        migrateExistingUser();
      }
      void syncIfNeeded(data.session?.user?.id ?? null);
    }).catch(() => {});

    // Correct destructuring pattern for auth subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Reset sync refs on sign-out so next sign-in uses 'replace' mode
      if (event === 'SIGNED_OUT') {
        lastSyncedUserIdRef.current = null;
        hadSignOutRef.current = true;
      }
      // v1.1.1 Migration: Auto-enable cloud sync when user signs in
      if (session) {
        migrateExistingUser();
      }
      void syncIfNeeded(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
      stopAutoSync(); // Clean up auto-sync listeners and intervals
      leavePresence().catch(() => {}); // Leave Presence channel
    };
  }, [isLoading]);

  useEffect(() => {
    if (userNameCustom || !supabase) return;
    let active = true;

    const syncName = async () => {
      const { data } = await supabase.auth.getUser();
      const metadata = data.user?.user_metadata as { full_name?: string; name?: string } | undefined;
      const candidate = metadata?.full_name || metadata?.name;
      if (!active || !candidate) return;
      if (candidate !== userName) {
        setUserName(candidate);
      }
    };

    void syncName();

    // Correct destructuring pattern for auth subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void syncName();
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [userNameCustom, userName, setUserName]);

  // Throttle session expired events (not more than once per 5 seconds)
  const lastSessionExpiredRef = useRef<number>(0);

  // Session expired handler - listens for 401 errors from API/sync
  // Verify actual session state before resetting auth
  useEffect(() => {
    const handleSessionExpired = async () => {
      // Throttle - ignore if we just handled one
      const now = Date.now();
      if (now - lastSessionExpiredRef.current < 5000) {
        logger.log('[Index] Session expired event throttled');
        return;
      }
      lastSessionExpiredRef.current = now;

      logger.warn('[Index] Session expired event received, verifying session...');

      // Check if session is actually expired before resetting
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          logger.log('[Index] Session still valid, ignoring expired event');
          return; // Session is valid - don't reset!
        }
      } catch (error) {
        logger.error('[Index] Error checking session:', error);
        // On error, fall through to reset (safer)
      }

      // Session truly expired - reset auth state
      logger.warn('[Index] Session confirmed expired, resetting auth state');
      setHasValidSession(false);  // Must set this for AuthScreen to show
      setAuthBypassFlag(false);
      setGoogleAuthChecked(false);
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [setGoogleAuthChecked]);

  // Weekly report auto-show on Monday
  useEffect(() => {
    if (!onboardingComplete || isLoading) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkWeeklyReport = () => {
      const lastShown = localStorage.getItem('zenflow-last-weekly-report');
      const today = new Date();
      const dayOfWeek = today.getDay();

      // Function to check if lastShown is in a different week
      const isNewWeek = (lastShownDate: string) => {
        const last = new Date(lastShownDate);
        const lastMonday = new Date(last);
        lastMonday.setDate(last.getDate() - (last.getDay() === 0 ? 6 : last.getDay() - 1));
        lastMonday.setHours(0, 0, 0, 0);

        const thisMonday = new Date(today);
        thisMonday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
        thisMonday.setHours(0, 0, 0, 0);

        return lastMonday.getTime() !== thisMonday.getTime();
      };

      // Show on Monday (1) if not shown this week
      if (dayOfWeek === 1 && (!lastShown || isNewWeek(lastShown))) {
        // Delay to let data load
        timeoutId = setTimeout(() => {
          setShowWeeklyReport(true);
          localStorage.setItem('zenflow-last-weekly-report', today.toISOString());
        }, 1000);
      }
    };

    checkWeeklyReport();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [onboardingComplete, isLoading]);

  // Cloud sync for challenges and badges
  useEffect(() => {
    let active = true;
    let challengeSub: (() => void) | null = null;
    let badgeSub: (() => void) | null = null;
    let taskSub: (() => void) | null = null;
    let questSub: (() => void) | null = null;

    const syncWithCloudIfLoggedIn = async () => {
      // Guard: skip if Supabase is not available (local mode)
      if (!supabase) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();

        // Check if component is still mounted
        if (!active) return;

        if (user) {
          // Sync challenges
          const { challenges: syncedChallenges } = await syncChallengesWithCloud(user.id);
          if (active && syncedChallenges) {
            setChallenges(syncedChallenges);
          }

          // Sync badges
          const { badges: syncedBadges } = await syncBadgesWithCloud(user.id);
          if (active && syncedBadges) {
            setBadges(syncedBadges);
          }

          // Check again before continuing
          if (!active) return;

          // Sync tasks and quests (updates localStorage for Panels to read)
          await syncTasks();
          await syncQuests();

          // Check again before setting up subscriptions
          if (!active) return;

          // Subscribe to real-time updates
          challengeSub = subscribeToChallengeUpdates(user.id, (updatedChallenge) => {
            if (!active) return;
            setChallenges(prev => {
              const index = prev.findIndex(c => c.id === updatedChallenge.id);
              if (index !== -1) {
                const updated = [...prev];
                updated[index] = updatedChallenge;
                return updated;
              }
              return [...prev, updatedChallenge];
            });
          });

          badgeSub = subscribeToBadgeUpdates(user.id, (updatedBadge) => {
            if (!active) return;
            setBadges(prev => {
              const index = prev.findIndex(b => b.id === updatedBadge.id);
              if (index !== -1) {
                const updated = [...prev];
                updated[index] = updatedBadge;
                return updated;
              }
              return prev;
            });
          });

          // Subscribe to tasks/quests updates to keep localStorage fresh
          taskSub = subscribeToTaskUpdates(user.id, () => {
            if (!active) return;
            logger.log('[Index] Tasks updated from cloud');
          });

          questSub = subscribeToQuestUpdates(user.id, () => {
            if (!active) return;
            logger.log('[Index] Quests updated from cloud');
          });
        }
      } catch (error) {
        logger.error('[Index] Cloud sync error:', error);
      }
    };

    void syncWithCloudIfLoggedIn();

    return () => {
      active = false;
      challengeSub?.();
      badgeSub?.();
      taskSub?.();
      questSub?.();
    };
  }, []);

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

      {/* Weekly Report Modal */}
      {showWeeklyReport && (
        <WeeklyReport
          moods={safeMoods}
          habits={safeHabits}
          focusSessions={safeFocusSessions}
          gratitudeEntries={safeGratitudeEntries}
          onClose={() => setShowWeeklyReport(false)}
        />
      )}

      {/* Widget Settings Modal */}
      {showWidgetSettings && (
        <LazyErrorBoundary componentName="Widget Settings">
          <Suspense fallback={<div className="fixed inset-0 z-50 bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
            <div className="fixed inset-0 z-50 bg-background">
              <WidgetSettings onBack={() => setShowWidgetSettings(false)} />
            </div>
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Challenges Panel Modal (Progressive: Day 4) */}
      {showChallenges && isFeatureVisible('challenges') && (
        <LazyErrorBoundary componentName="Challenges">
          <Suspense fallback={<SkeletonSection />}>
            <ChallengesPanel
              activeChallenges={challenges}
              badges={safeBadges}
              onStartChallenge={(challenge) => {
                addChallenge(challenge);
                setChallenges(getChallenges());
                setBadges(getBadges());
              }}
              onClose={() => setShowChallenges(false)}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Time Helper Modal */}
      {isFeatureVisible('focusTimer') && showTimeHelper && (
        <TimeHelper onClose={() => setShowTimeHelper(false)} />
      )}

      {/* Tasks Panel Modal (Progressive: Day 4) */}
      {showTasksPanel && isFeatureVisible('tasks') && (
        <LazyErrorBoundary componentName="Tasks">
          <Suspense fallback={<SkeletonList />}>
            <TasksPanel
              onClose={() => setShowTasksPanel(false)}
              onAwardXp={(_source, amount) => {
                // Award XP through gamification (using habit as proxy for task)
                for (let i = 0; i < Math.ceil(amount / 15); i++) {
                  awardXp('habit');
                }
              }}
              onEarnTreats={(_source, amount, reason) => {
                // Use 'habit' as treat source since 'task' is not a valid TreatSource
                earnTreats('habit', amount, reason);
                triggerSync(); // Sync inner world treats
              }}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Quests Panel Modal (Progressive: Day 3) */}
      {showQuestsPanel && isFeatureVisible('quests') && (
        <LazyErrorBoundary componentName="Quests">
          <Suspense fallback={<SkeletonList />}>
            <QuestsPanel
              onClose={() => setShowQuestsPanel(false)}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Friends Panel */}
      {showFriendsPanel && (
        <LazyErrorBoundary componentName="Friends">
          <Suspense fallback={<SkeletonList />}>
            <FriendsPanel
              onClose={() => setShowFriendsPanel(false)}
              userName={userName}
              currentStreak={innerWorld.currentActiveStreak}
              level={userLevel.level}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Challenge Modal - for deep link invites and habit challenges */}
      {isFeatureVisible('challenges') && (
        <ChallengeModal
          open={showChallengeModal}
          onOpenChange={(open) => {
            setShowChallengeModal(open);
            if (!open) {
              setChallengeInvite(undefined);
              setChallengeHabit(undefined);
            }
          }}
          habit={challengeHabit}
          initialInvite={challengeInvite}
          username={userName}
        />
      )}

      {/* What's New Modal - shows after app update */}
      <WhatsNewModal />

      {/* MindfulMoment - shows after focus session completion */}
      {isFeatureVisible('focusTimer') && (
        <MindfulMoment
          isOpen={showMindfulMoment}
          onClose={() => setShowMindfulMoment(false)}
          onComplete={handleMindfulMomentComplete}
          onViewProgress={() => setActiveTab('stats')}
          trigger="focus"
        />
      )}

      {/* AI Coach Chat - Hidden until AI ready
      {isFeatureVisible('aiCoach') && <AICoachChat />}
      */}

    </div>
    </AdProvider>
  );
};

export default Index;
