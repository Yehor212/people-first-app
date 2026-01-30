import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { logger } from '@/lib/logger';
import { useIndexedDB } from '@/hooks/useIndexedDB';
import { initializeApp } from '@/lib/appInitializer';
import { MoodEntry, Habit, FocusSession, GratitudeEntry, ReminderSettings, PrivacySettings, ScheduleEvent } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmotionTheme } from '@/contexts/EmotionThemeContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { MoodBackgroundOverlay } from '@/components/MoodBackgroundOverlay';
import { triggerXpPopup } from '@/components/XpPopup';
import { DayClock } from '@/components/DayClock';
import { ScheduleTimeline } from '@/components/ScheduleTimeline';
import { db } from '@/storage/db';
import { defaultReminderSettings } from '@/lib/reminders';
import { generateId, getToday, calculateStreak } from '@/lib/utils';
import { safeLocalStorageGet } from '@/lib/safeJson';
import { findTemplateIdByName, getHabitTemplateName } from '@/lib/habitTemplates';
import { normalizeHabit } from '@/lib/habits';
import { supabase } from '@/lib/supabaseClient';
import { syncReminderSettings } from '@/storage/reminderSync';
import { syncWithCloud, startAutoSync, stopAutoSync, triggerSync } from '@/storage/cloudSync';
import { generateHabitScheduleEvents, mergeScheduleEvents } from '@/lib/habitScheduleSync';
import { migrateExistingUser } from '@/lib/cloudSyncSettings';
import { useHealthConnect } from '@/hooks/useHealthConnect';
import { useQuickActions, QuickActionType } from '@/hooks/useQuickActions';
import { App } from '@capacitor/app';
import {
  handleAuthCallback,
  isNativePlatform,
  notifyAuthComplete,
  setPendingAuthUrl,
  getPendingAuthUrl
} from '@/lib/authRedirect';
import { registerModalCloseCallback } from '@/lib/androidBackHandler';
import {
  scheduleLocalReminders,
  scheduleHabitReminders,
  scheduleCompanionReminders,
  registerMoodNotificationActions,
  setupNotificationActionListener,
  setMoodActionCallback,
  scheduleMoodQuickLogNotification,
  initializeNotificationChannel,
} from '@/lib/localNotifications';

import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { EmotionWheel } from '@/components/mindfulness/EmotionWheel';
import { HabitTracker } from '@/components/HabitTracker';
import { FocusTimer } from '@/components/FocusTimer';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';

// Lazy-loaded components for better performance
const StatsPage = lazy(() => import('@/components/StatsPage').then(m => ({ default: m.StatsPage })));
const SettingsPanel = lazy(() => import('@/components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const GratitudeJournal = lazy(() => import('@/components/GratitudeJournal').then(m => ({ default: m.GratitudeJournal })));
const BreathingExercise = lazy(() => import('@/components/BreathingExercise').then(m => ({ default: m.BreathingExercise })));
import { LanguageSelector } from '@/components/LanguageSelector';
import { InstallBanner } from '@/components/InstallBanner';
import { RemindersPanel } from '@/components/RemindersPanel';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { WelcomeTutorial } from '@/components/WelcomeTutorial';
import { AICoachOnboarding } from '@/components/AICoachOnboarding';
import { AuthGate } from '@/components/AuthGate';
import { AchievementsPanel } from '@/components/AchievementsPanel';
import { NotificationPermission } from '@/components/NotificationPermission';
import { GoogleAuthScreen } from '@/components/GoogleAuthScreen';
import { WeeklyReport } from '@/components/WeeklyReport';
import { TimeHelper } from '@/components/TimeHelper';

// More lazy-loaded components (opened via modals/sheets)
const ChallengesPanel = lazy(() => import('@/components/ChallengesPanel').then(m => ({ default: m.ChallengesPanel })));
const TasksPanel = lazy(() => import('@/components/TasksPanel').then(m => ({ default: m.TasksPanel })));
const QuestsPanel = lazy(() => import('@/components/QuestsPanel').then(m => ({ default: m.QuestsPanel })));
const WidgetSettings = lazy(() => import('@/pages/WidgetSettings').then(m => ({ default: m.WidgetSettings })));
const Leaderboard = lazy(() => import('@/components/Leaderboard').then(m => ({ default: m.Leaderboard })));
import { useGamification } from '@/hooks/useGamification';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { useInnerWorld } from '@/hooks/useInnerWorld';
import { getChallenges, getBadges, addChallenge, syncChallengeProgress } from '@/lib/challengeStorage';
import { syncChallengesWithCloud, syncBadgesWithCloud, subscribeToChallengeUpdates, subscribeToBadgeUpdates, initializeBadgesInCloud } from '@/storage/challengeCloudSync';
import { syncTasks, syncQuests, subscribeToTaskUpdates, subscribeToQuestUpdates } from '@/storage/tasksCloudSync';
import { updateAllQuestsProgress } from '@/lib/randomQuests';
import { CompanionPanel } from '@/components/CompanionPanel';
import { MoodInsights } from '@/components/MoodInsights';
import { StreakBanner } from '@/components/StreakBanner';
import { InsightsPanel } from '@/components/InsightsPanel';
import { RestModeCard } from '@/components/RestModeCard';
import { WhatsNewModal } from '@/components/WhatsNewModal';
import { ChallengeModal } from '@/components/ChallengeModal';
import { decodeInviteData, ChallengeInvite } from '@/lib/friendChallenge';
import { initializeOfflineQueueHandlers } from '@/lib/offlineQueueHandlers';
import { CompletedSection } from '@/components/CompletedSection';
import { AllCompleteCelebration } from '@/components/AllCompleteCelebration';
import { ConsentBanner } from '@/components/ConsentBanner';
import { GlobalScheduleBar } from '@/components/GlobalScheduleBar';
import { haptics } from '@/lib/haptics';
import { AICoachChat } from '@/components/AICoachChat';
import { useAICoach } from '@/contexts/AICoachContext';
import { OnboardingOverlay, DayProgressIndicator } from '@/components/OnboardingOverlay';
import { FeatureUnlock } from '@/components/FeatureUnlock';
import { QuickStatsRow } from '@/components/ui/stat-card';
import { MindfulMoment } from '@/components/MindfulMoment';
import { DailyPromptCard } from '@/components/DailyPromptCard';
import {
  initializeOnboarding,
  isFeatureUnlocked,
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
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { checkForAppUpdate, wasUpdateDismissed, dismissUpdate, UpdateState } from '@/lib/appUpdateManager';

type TabType = 'home' | 'garden' | 'stats' | 'achievements' | 'settings';

export function Index() {
  const { t, language } = useLanguage();
  const { setEmotionFromEntries } = useEmotionTheme();
  const { isFeatureVisible } = useFeatureFlags();
  const { syncFocusSession } = useHealthConnect();
  const { triggerLowMoodCheck, openCoach, setUserData, onboardingData, saveOnboardingAnswer } = useAICoach();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [showAIOnboarding, setShowAIOnboarding] = useState(false);
  const lastSyncedUserIdRef = useRef<string | null>(null);

  // App initialization state (must be first)
  const [initializationState, setInitializationState] = useState<{
    isInitializing: boolean;
    error: string | null;
    wasUpdated: boolean;
  }>({
    isInitializing: true,
    error: null,
    wasUpdated: false
  });

  // App initialization effect (before other useEffects)
  useEffect(() => {
    const initialize = async () => {
      logger.log('[Index] Starting app initialization...');

      // Initialize offline queue handlers for offline-first sync
      initializeOfflineQueueHandlers();

      // Apply OLED mode if previously enabled
      if (localStorage.getItem('zenflow_oled_mode') === 'true') {
        document.documentElement.classList.add('oled');
      }

      const result = await initializeApp();

      if (!result.success) {
        setInitializationState({
          isInitializing: false,
          error: result.error || 'Initialization failed',
          wasUpdated: result.wasUpdated
        });
        return;
      }

      if (result.wasUpdated) {
        logger.log('[Index] App was updated, showing update message');
        // Show brief update success message
        setTimeout(() => {
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

    initialize();
  }, []); // Run only once on mount

  // Track current date and detect midnight change
  const [currentDate, setCurrentDate] = useState(getToday());

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
    setCompanionType,
    renameCompanion,
    clearWelcomeBack,
    petCompanion,
    feedCompanion,
    gardenStats,
    // Treats system
    earnTreats,
    treatsBalance,
    FEED_COST,
    // Rest mode
    isRestMode,
    activateRestMode,
    deactivateRestMode,
    canActivateRestMode,
    daysUntilRestAvailable,
  } = useInnerWorld();

  // Companion panel state
  const [showCompanionPanel, setShowCompanionPanel] = useState(false);

  // Guard against double habit toggles (prevents duplicate rewards)
  const processingHabitsRef = useRef<Set<string>>(new Set());

  // Guard against concurrent reminder syncs (prevents infinite loop on 400 error)
  const reminderSyncPendingRef = useRef(false);

  // Current focus minutes (real-time)
  const [currentFocusMinutes, setCurrentFocusMinutes] = useState<number | undefined>(undefined);

  // Weekly report state
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  // Widget settings state
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);

  // Challenges state
  const [showChallenges, setShowChallenges] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeInvite, setChallengeInvite] = useState<ChallengeInvite | undefined>(undefined);
  const [showTimeHelper, setShowTimeHelper] = useState(false);
  const [showTasksPanel, setShowTasksPanel] = useState(false);
  const [showQuestsPanel, setShowQuestsPanel] = useState(false);
  const [challenges, setChallenges] = useState(() => getChallenges());
  const [badges, setBadges] = useState(() => getBadges());

  // Progressive Onboarding state
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);
  const [featureToUnlock, setFeatureToUnlock] = useState<FeatureId | null>(null);

  // Re-engagement (Welcome Back) state
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [welcomeBackData, setWelcomeBackData] = useState<{
    daysAway: number;
    streakBroken: boolean;
    currentStreak: number;
    topHabits: Array<{ habit: Habit; successRate: number }>;
  } | null>(null);

  // App Update state (Google Play In-App Updates)
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);

  // MindfulMoment - shows after focus session completion
  const [showMindfulMoment, setShowMindfulMoment] = useState(false);

  // Journal prompt text - from DailyPromptCard to GratitudeJournal
  const [journalPromptText, setJournalPromptText] = useState<string | undefined>(undefined);

  // Synchronous bypass flag for Google Auth - immediately skips GoogleAuthScreen
  // This is needed because setGoogleAuthChecked uses async IndexedDB write
  const [authBypassFlag, setAuthBypassFlag] = useState(false);

  // Используем useIndexedDB для hasSelectedLanguage
  const [hasSelectedLanguage, setHasSelectedLanguage, isLoadingLangSelected] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-language-selected',
    initialValue: false,
    idField: 'key'
  });

  // User data
  // Используем useIndexedDB для userName
  const [userName, setUserName, isLoadingUserName] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-username',
    initialValue: 'Friend',
    idField: 'key'
  });

  const [userNameCustom, setUserNameCustom, isLoadingUserNameCustom] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-username-custom',
    initialValue: false,
    idField: 'key'
  });

  // App data
  // Используем useIndexedDB для moods
  const [moods, setMoods, isLoadingMoods] = useIndexedDB<MoodEntry[]>({
    table: db.moods,
    localStorageKey: 'zenflow-moods',
    initialValue: []
  });

  // Используем useIndexedDB для habits
  const [habits, setHabits, isLoadingHabits] = useIndexedDB<Habit[]>({
    table: db.habits,
    localStorageKey: 'zenflow-habits',
    initialValue: []
  });

  // Используем useIndexedDB для focusSessions
  const [focusSessions, setFocusSessions, isLoadingFocus] = useIndexedDB<FocusSession[]>({
    table: db.focusSessions,
    localStorageKey: 'zenflow-focus',
    initialValue: []
  });

  // Используем useIndexedDB для gratitudeEntries
  const [gratitudeEntries, setGratitudeEntries, isLoadingGratitude] = useIndexedDB<GratitudeEntry[]>({
    table: db.gratitudeEntries,
    localStorageKey: 'zenflow-gratitude',
    initialValue: []
  });

  const [reminders, setReminders, isLoadingReminders] = useIndexedDB<ReminderSettings>({
    table: db.settings,
    localStorageKey: 'zenflow-reminders',
    initialValue: defaultReminderSettings,
    idField: 'key'
  });

  const [tutorialComplete, setTutorialComplete, isLoadingTutorial] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-tutorial-complete',
    initialValue: false,
    idField: 'key'
  });

  const [onboardingComplete, setOnboardingComplete, isLoadingOnboarding] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-onboarding-complete',
    initialValue: false,
    idField: 'key'
  });

  const [notificationPermissionChecked, setNotificationPermissionChecked, isLoadingNotificationPermission] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-notification-permission-checked',
    initialValue: false,
    idField: 'key'
  });

  // Google Auth check (shown once after language selection)
  const [googleAuthChecked, setGoogleAuthChecked, isLoadingGoogleAuth] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-google-auth-checked',
    initialValue: false,
    idField: 'key'
  });

  // GDPR: analytics OFF by default (opt-in, not opt-out)
  const [privacy, setPrivacy, isLoadingPrivacy] = useIndexedDB<PrivacySettings>({
    table: db.settings,
    localStorageKey: 'zenflow-privacy',
    initialValue: { noTracking: false, analytics: false, consentShown: false },
    idField: 'key'
  });

  // GDPR consent handler
  const handleConsentResponse = (analyticsAllowed: boolean) => {
    setPrivacy({
      ...privacy,
      analytics: analyticsAllowed,
      noTracking: !analyticsAllowed,
      consentShown: true,
    });
  };


  // Schedule events for ADHD timeline
  const [scheduleEvents, setScheduleEvents, isLoadingSchedule] = useIndexedDB<ScheduleEvent[]>({
    table: db.settings,
    localStorageKey: 'zenflow-schedule-events',
    initialValue: [],
    idField: 'key'
  });

  // Loading handling
  const isLoading = isLoadingLangSelected || isLoadingUserName || isLoadingUserNameCustom || isLoadingMoods || isLoadingHabits || isLoadingFocus || isLoadingGratitude || isLoadingReminders || isLoadingTutorial || isLoadingOnboarding || isLoadingPrivacy || isLoadingNotificationPermission || isLoadingGoogleAuth || isLoadingSchedule || isLoadingInnerWorld;

  // Defensive array guards - prevent crashes from corrupted cloud sync data
  const safeMoods = Array.isArray(moods) ? moods : [];
  const safeHabits = Array.isArray(habits) ? habits : [];
  const safeFocusSessions = Array.isArray(focusSessions) ? focusSessions : [];
  const safeGratitudeEntries = Array.isArray(gratitudeEntries) ? gratitudeEntries : [];
  const safeScheduleEvents = Array.isArray(scheduleEvents) ? scheduleEvents : [];
  const safeBadges = Array.isArray(badges) ? badges : [];

  // Register Android back button handler for modal panels
  useEffect(() => {
    const unregister = registerModalCloseCallback(() => {
      // Close panels in priority order (most recently opened first)
      if (showTasksPanel) { setShowTasksPanel(false); return true; }
      if (showQuestsPanel) { setShowQuestsPanel(false); return true; }
      if (showChallenges) { setShowChallenges(false); return true; }
      if (showChallengeModal) { setShowChallengeModal(false); return true; }
      if (showWidgetSettings) { setShowWidgetSettings(false); return true; }
      if (showCompanionPanel) { setShowCompanionPanel(false); return true; }
      if (showWeeklyReport) { setShowWeeklyReport(false); return true; }
      if (showTimeHelper) { setShowTimeHelper(false); return true; }
      if (showMindfulMoment) { setShowMindfulMoment(false); return true; }
      if (showWelcomeBack) { setShowWelcomeBack(false); return true; }
      if (showWelcomeOverlay) { setShowWelcomeOverlay(false); return true; }
      return false;
    });
    return unregister;
  }, [showTasksPanel, showQuestsPanel, showChallenges, showChallengeModal,
      showWidgetSettings, showCompanionPanel, showWeeklyReport, showTimeHelper,
      showMindfulMoment, showWelcomeBack, showWelcomeOverlay]);

  // Migrate old reminder settings to new 3-time mood format
  useEffect(() => {
    if (isLoadingReminders) return;

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
  }, [isLoadingReminders, reminders.moodTime, reminders.moodTimeMorning, setReminders]);

  // Update AI Coach context with user data
  useEffect(() => {
    if (!isLoading && !isLoadingInnerWorld) {
      setUserData(safeMoods, safeHabits, innerWorld);
    }
  }, [isLoading, isLoadingInnerWorld, safeMoods, safeHabits, innerWorld, setUserData]);

  // Schedule event handlers (moved here to avoid TDZ errors)
  const handleAddScheduleEvent = (event: Omit<ScheduleEvent, 'id'>) => {
    const newEvent: ScheduleEvent = {
      ...event,
      id: generateId(),
      source: 'manual',  // v1.4.0: Mark as manually created
      isEditable: true,
    };
    // v1.4.0: Use functional update to avoid stale closure race conditions
    setScheduleEvents(prev => [...prev, newEvent]);
  };

  const handleDeleteScheduleEvent = (id: string) => {
    // v1.4.0: Only allow deleting manual events (habit events are managed through habits)
    const eventToDelete = allScheduleEvents.find(e => e.id === id);
    if (eventToDelete?.source === 'habit') {
      logger.warn('[Schedule] Cannot delete habit-generated event directly');
      return;
    }
    setScheduleEvents(scheduleEvents.filter(e => e.id !== id));
  };

  // Filter today's schedule events (manual only)
  const todayScheduleEvents = useMemo(() => {
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

  // Check if user has uncompleted habits today
  const hasUncompletedHabits = useMemo(() => {
    if (safeHabits.length === 0) return false;
    return safeHabits.some(h => {
      const habitType = h.type || 'daily';
      // Continuous habits don't count for completion
      if (habitType === 'continuous') return false;
      // Multiple times per day habits
      if (habitType === 'multiple') {
        const completions = h.completionsByDate?.[currentDate] ?? 0;
        return completions < (h.dailyTarget ?? 1);
      }
      // Daily and scheduled habits
      return !h.completedDates?.includes(currentDate);
    });
  }, [safeHabits, currentDate]);

  // Count completed habits today (for QuickStatsRow)
  const completedTodayCount = useMemo(() => {
    return safeHabits.filter(h => {
      const habitType = h.type || 'daily';
      if (habitType === 'reduce') {
        return (h.progressByDate?.[currentDate] ?? 0) === 0;
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
  }, [safeHabits, currentDate]);

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
  const isWidgetDataLoading = isLoadingMoods || isLoadingHabits || isLoadingFocus || isLoadingGratitude || isLoadingInnerWorld;
  useWidgetSync(widgetStreak, habits, todayFocusMinutes, lastBadgeName, isWidgetDataLoading);

  // Sync emotion theme with current mood entries
  useEffect(() => {
    if (!isLoadingMoods) {
      setEmotionFromEntries(moods);
    }
  }, [moods, isLoadingMoods, setEmotionFromEntries]);

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
    const featuresToCheck: FeatureId[] = ['focusTimer', 'xp', 'quests', 'companion', 'tasks', 'challenges'];

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
    setMoods(prev => {
      // Add new entry without removing existing ones for the same day
      // This allows multiple mood entries per day (morning/afternoon/evening)
      return [...prev, entry];
    });
    awardXp('mood'); // +5 XP (legacy gamification)

    // Earn treats for companion (new unified reward system)
    const treatResult = earnTreats('mood', 5, 'Logged mood');
    triggerXpPopup(treatResult.earned, 'mood'); // Show treats earned

    triggerSync(); // Auto-sync to cloud
    haptics.moodSaved();

    // Inner World: Plant a flower based on mood
    plantSeed('mood', entry.mood);
    waterPlants('mood');

    // Update challenge progress
    updateChallengeProgress();

    // AI Coach: Check for low mood and offer support
    // P0 Fix: Only trigger if data is loaded (so AI Coach has context)
    if (entry.mood === 'bad' || entry.mood === 'terrible') {
      if (!isLoading && !isLoadingInnerWorld) {
        setTimeout(() => {
          triggerLowMoodCheck(entry);
        }, 1500);
      }
    }
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
    awardXp('mood');
    earnTreats('mood', 5, 'Quick mood');
    triggerSync();
    haptics.moodSaved();
    plantSeed('mood', mood);
    waterPlants('mood');

    logger.log('Quick mood logged from notification:', mood);
  }, [awardXp, earnTreats, plantSeed, waterPlants, setMoods]);

  // Update existing mood entry (for same-day editing)
  const handleUpdateMood = (entryId: string, newMood: MoodEntry['mood'], note?: string) => {
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
    setTimeout(() => {
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
          haptics.habitToggled();
          trackTimeOfDayCompletion(); // Track for Early Bird/Night Owl badges
        }

        const existingDates = habit.completedDates || [];
        return {
          ...habit,
          completionsByDate,
          completedDates: completionsByDate[date] >= target
            ? [...new Set([...existingDates, date])]
            : existingDates.filter(d => d !== date)
        };
      }

      // Daily and scheduled habits (normal toggle)
      const existingDates = habit.completedDates || [];
      const completed = existingDates.includes(date);
      if (!completed) {
        awardXp('habit'); // +10 XP for completing habit (legacy)
        const treatResult = earnTreats('habit', 10, 'Completed habit');
        triggerXpPopup(treatResult.earned, 'habit'); // Show treats earned
        haptics.habitCompleted();
        trackTimeOfDayCompletion(); // Track for Early Bird/Night Owl badges
        // Inner World: Plant a tree when completing habit
        plantSeed('habit');
        waterPlants('habit');
      }
      return {
        ...habit,
        completedDates: completed
          ? existingDates.filter(d => d !== date)
          : [...existingDates, date],
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
      if ((habit.type || 'daily') !== 'reduce') return habit;

      const progressByDate = { ...(habit.progressByDate || {}) };
      const current = typeof progressByDate[date] === 'number' ? progressByDate[date] : 0;
      const next = Math.max(0, current + delta);
      progressByDate[date] = next;

      return {
        ...habit,
        progressByDate,
      };
    }));
    triggerSync(); // Auto-sync to cloud
  };

  const handleAddHabit = (habit: Habit) => {
    setHabits(prev => [...prev, habit]);
    triggerSync(); // Auto-sync to cloud
  };

  const handleDeleteHabit = (habitId: string) => {
    setHabits(prev => prev.filter(h => h.id !== habitId));
    triggerSync(); // Auto-sync to cloud
  };

  const handleCompleteFocusSession = (session: FocusSession) => {
    setFocusSessions(prev => [...prev, session]);
    awardXp('focus'); // +15 XP (legacy)

    // Earn treats based on focus duration (0.5 treats per minute)
    const focusTreats = Math.round(session.duration * 0.5);
    const treatResult = earnTreats('focus', focusTreats, `Focus ${session.duration}min`);
    triggerXpPopup(treatResult.earned, 'focus'); // Show treats earned

    triggerSync(); // Auto-sync to cloud
    haptics.focusCompleted();

    // Show MindfulMoment after focus session (only for sessions > 5 min)
    if (session.duration >= 5) {
      setTimeout(() => setShowMindfulMoment(true), 500);
    }

    // Sync to Health Connect if enabled (only completed sessions, not aborted)
    if (session.status === 'completed' && localStorage.getItem('zenflow_health_connect_sync') === 'true') {
      const startTime = session.completedAt - (session.duration * 60 * 1000);
      syncFocusSession(session.id, startTime, session.duration, session.label);
    }

    // Inner World: Plant a crystal when completing focus session
    plantSeed('focus');
    waterPlants('focus');

    // Update challenge progress
    updateChallengeProgress();

    // Check for feature unlocks (progressive onboarding)
    checkForFeatureUnlocks();

    // Update quest progress and award XP for completed quests
    const completedQuests = updateAllQuestsProgress({ type: 'focus_completed', value: session.duration });
    completedQuests.forEach(quest => {
      const xpReward = quest.reward.xp;
      earnTreats('focus', xpReward, `Quest: ${quest.title}`);
      triggerXpPopup(xpReward, 'bonus');
    });
  };

  const handleAddGratitude = (entry: GratitudeEntry) => {
    setGratitudeEntries(prev => [...prev, entry]);
    awardXp('gratitude'); // +8 XP (legacy)

    // Earn treats for companion
    const treatResult = earnTreats('gratitude', 8, 'Gratitude entry');
    triggerXpPopup(treatResult.earned, 'gratitude'); // Show treats earned

    triggerSync(); // Auto-sync to cloud
    haptics.gratitudeSaved();

    // Inner World: Plant a mushroom and attract creatures
    plantSeed('gratitude');
    waterPlants('gratitude');
    // 30% chance to attract a creature
    if (Math.random() < 0.3) {
      attractCreature();
    }
    feedCreatures();

    // Update challenge progress
    updateChallengeProgress();

    // Update quest progress and award XP for completed quests
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
  const handleUseJournalPrompt = useCallback((promptText: string) => {
    setJournalPromptText(promptText);
    // Scroll to gratitude section
    gratitudeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Clear journal prompt text after it's been used
  const handleJournalPromptUsed = useCallback(() => {
    setJournalPromptText(undefined);
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

  const handleAuthComplete = (userData?: { name: string; email: string }) => {
    if (userData) {
      // User signed in with Google - use their name
      setUserName(userData.name);
      setUserNameCustom(false); // Allow them to change it later
    }
    // Auth is now optional - no need to set gate complete
  };

  // Google Auth handlers (shown once after language selection)
  const handleGoogleAuthComplete = (userData: { name: string; email: string }) => {
    logger.log('[Index] Google auth completed:', userData.email);

    // CRITICAL: Set synchronous bypass flag FIRST (immediate UI update)
    // This ensures we skip GoogleAuthScreen immediately, before IndexedDB writes
    setAuthBypassFlag(true);

    // Then set persistent values (async IndexedDB)
    setUserName(userData.name);
    setUserNameCustom(false);
    setGoogleAuthChecked(true);
  };

  const handleGoogleAuthSkip = () => {
    logger.log('[Index] Google auth skipped');
    setAuthBypassFlag(true);  // Immediate UI update
    setGoogleAuthChecked(true);
  };

  const handleOnboardingComplete = (result: {
    skipped?: boolean;
    mood: MoodEntry['mood'] | null;
    habits: Array<{ id: string; name: string; icon: string; color: string }>;
    enableReminders: boolean;
    reminderTime: 'morning' | 'evening';
  }) => {
    if (!result.skipped) {
      if (result.mood) {
        const today = getToday();
        setMoods(prev => {
          const filtered = prev.filter(e => e.date !== today);
          return [
            ...filtered,
            {
              id: generateId(),
              mood: result.mood,
              date: today,
              timestamp: Date.now()
            }
          ];
        });
      }

      let selectedHabitIds: string[] = [];
      if (result.habits.length > 0) {
        const existingByName = new Map(
          safeHabits.map(habit => [habit.name.toLowerCase(), habit.id])
        );
        const additions: Habit[] = [];

        result.habits.forEach(habit => {
          const key = habit.name.toLowerCase();
          const existingId = existingByName.get(key);
          if (existingId) {
            selectedHabitIds.push(existingId);
            return;
          }
          const newHabit: Habit = {
            id: generateId(),
            name: habit.name,
            icon: habit.icon,
            color: habit.color,
            templateId: habit.id,
            completedDates: [],
            createdAt: Date.now(),
            type: 'daily',
            reminders: [],
            frequency: 'daily'
          };
          additions.push(newHabit);
          selectedHabitIds.push(newHabit.id);
        });

        if (additions.length > 0) {
          setHabits(prev => [...prev, ...additions]);
        }
      }

      if (selectedHabitIds.length > 0) {
        setReminders(prev => ({
          ...prev,
          habitIds: selectedHabitIds
        }));
      }

      if (result.enableReminders) {
        const isMorning = result.reminderTime === 'morning';
        setReminders(prev => ({
          ...prev,
          enabled: true,
          moodTimeMorning: isMorning ? '09:00' : '08:00',
          moodTimeAfternoon: '14:00',
          moodTimeEvening: isMorning ? '19:00' : '20:00',
          habitTime: isMorning ? '20:00' : '21:00',
          focusTime: isMorning ? '10:00' : '11:00',
          habitIds: selectedHabitIds.length > 0 ? selectedHabitIds : prev.habitIds
        }));
      }
    }

    setOnboardingComplete(true);
  };

  const handleNotificationPermissionComplete = () => {
    setNotificationPermissionChecked(true);
  };

  const reminderCopy = useMemo(() => {
    const habitNameMap = new Map(safeHabits.map((habit) => [habit.id, habit.name]));
    const habitNames = reminders.habitIds
      .map((id) => habitNameMap.get(id))
      .filter(Boolean) as string[];
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

  // Schedule companion-based soft reminders (gentle, non-judgmental)
  useEffect(() => {
    if (!isNativePlatform() || isLoadingInnerWorld) return;
    scheduleCompanionReminders(
      reminders,
      { type: innerWorld.companion.type, name: innerWorld.companion.name },
      {
        companionMissesYou: t.companionMissesYou || 'misses you! 💕',
        companionWantsToPlay: t.companionWantsToPlay || 'wants to spend time with you!',
        companionWaiting: t.companionWaiting || 'is waiting in the garden 🌱',
        companionProud: t.companionProud || 'is proud of you! ⭐',
        companionCheersYou: t.companionCheersYou || 'is cheering for you! 💪',
      }
    ).catch((error) => {
      logger.error("Failed to schedule companion reminders:", error);
    });
  }, [reminders, innerWorld.companion, isLoadingInnerWorld, t]);

  // Initialize notification channel (Android 8+ requirement)
  useEffect(() => {
    if (!isNativePlatform()) return;
    initializeNotificationChannel().catch((error) => {
      logger.error('Failed to initialize notification channel:', error);
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
      { type: innerWorld.companion.type, name: innerWorld.companion.name },
      t.companionQuickMood || 'How are you feeling? Tap! 😊'
    ).catch((error) => {
      logger.error('Failed to schedule mood quick-log notification:', error);
    });
  }, [reminders.enabled, reminders.moodTimeMorning, innerWorld.companion, isLoadingInnerWorld, t.companionQuickMood]);

  // Lock screen quick actions handler
  useEffect(() => {
    onQuickAction((action: QuickActionType) => {
      logger.log('[Index] Quick action triggered:', action);

      // Switch to home tab first
      setActiveTab('home');

      // Small delay to ensure tab switch is complete before scrolling
      setTimeout(() => {
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
          const email = data.session.user.email || '';

          logger.log('[Auth] OAuth callback successful:', email);
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
            handleAuthUrl(event.url);
          }
        }
      });
      removeListener = () => listener.remove();
    };

    setup();
    return () => { removeListener(); };
  }, []); // Listener registers ONCE, no dependencies

  // Process pending auth URL when supabase becomes ready
  useEffect(() => {
    if (!supabase || !isNativePlatform()) return;

    let active = true;
    const pendingUrl = getPendingAuthUrl();
    if (pendingUrl) {
      logger.log('[Index] Processing pending auth URL');

      (async () => {
        try {
          await handleAuthCallback(supabase, pendingUrl);

          // Check if component is still mounted
          if (!active) return;

          const { data } = await supabase.auth.getSession();
          if (!active) return;

          if (data.session?.user) {
            const metadata = data.session.user.user_metadata;
            const name = metadata?.full_name || metadata?.name || data.session.user.email?.split('@')[0] || 'Friend';
            const email = data.session.user.email || '';

            logger.log('[Auth] Pending auth processed successfully:', email);
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
  }, [supabase, setUserName, setUserNameCustom, setGoogleAuthChecked]);

  useEffect(() => {
    if (!supabase || isLoading) return;
    let active = true;

    const syncIfNeeded = async (userId?: string | null) => {
      if (!active || !userId) return;
      if (lastSyncedUserIdRef.current === userId) return;
      lastSyncedUserIdRef.current = userId;
      try {
        await syncWithCloud('merge');
        // Start auto-sync after successful initial sync
        startAutoSync();
      } catch (error) {
        logger.error('Cloud sync failed:', error);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      // v1.1.1 Migration: Auto-enable cloud sync for existing users
      if (data.session) {
        migrateExistingUser();
      }
      syncIfNeeded(data.session?.user?.id ?? null);
    });

    // P1 Fix: Correct destructuring pattern for auth subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // v1.1.1 Migration: Auto-enable cloud sync when user signs in
      if (session) {
        migrateExistingUser();
      }
      syncIfNeeded(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
      stopAutoSync(); // Clean up auto-sync listeners and intervals
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

    syncName();

    // P1 Fix: Correct destructuring pattern for auth subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      syncName();
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [userNameCustom, userName, setUserName]);

  // Weekly report auto-show on Monday
  useEffect(() => {
    if (!onboardingComplete || isLoading) return;

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
        setTimeout(() => {
          setShowWeeklyReport(true);
          localStorage.setItem('zenflow-last-weekly-report', today.toISOString());
        }, 1000);
      }
    };

    checkWeeklyReport();
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

    syncWithCloudIfLoggedIn();

    return () => {
      active = false;
      challengeSub?.();
      badgeSub?.();
      taskSub?.();
      questSub?.();
    };
  }, []);

  // Show initialization screen
  if (initializationState.isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen zen-gradient-hero">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing ZenFlow...</p>
        </div>
      </div>
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

  // Google Auth screen (optional - can be skipped)
  // Shown after language selection, before tutorial
  // Check both googleAuthChecked (IndexedDB) and authBypassFlag (synchronous)
  // authBypassFlag provides immediate skip while IndexedDB writes are pending
  if (!googleAuthChecked && !authBypassFlag) {
    return (
      <GoogleAuthScreen
        onComplete={handleGoogleAuthComplete}
        onSkip={handleGoogleAuthSkip}
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
          // P0 Fix: Show AI Coach Onboarding after Welcome Tutorial
          if (!onboardingData.completedAt) {
            setShowAIOnboarding(true);
          }
        }}
        onSkip={() => {
          setTutorialComplete(true);
        }}
      />
    );
  }

  // P0 Fix: AI Coach Onboarding (personalization questions)
  if (showAIOnboarding) {
    return (
      <AICoachOnboarding
        onComplete={() => {
          saveOnboardingAnswer('completedAt', String(Date.now()));
          setShowAIOnboarding(false);
        }}
        onSkip={() => setShowAIOnboarding(false)}
      />
    );
  }

  if (!onboardingComplete) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  if (!notificationPermissionChecked) {
    return <NotificationPermission onComplete={handleNotificationPermissionComplete} />;
  }

  return (
    <div className="min-h-screen zen-gradient-hero">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg"
      >
        {t.skipToContent || 'Skip to main content'}
      </a>

      {/* Dynamic mood-based background overlay */}
      <MoodBackgroundOverlay />

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
          <>
            <InstallBanner />
            <Header
              userName={userName}
              onOpenChallenges={isFeatureVisible('challenges') ? () => setShowChallenges(true) : undefined}
              onOpenTasks={isFeatureVisible('tasks') ? () => setShowTasksPanel(true) : undefined}
              onOpenQuests={isFeatureVisible('quests') ? () => setShowQuestsPanel(true) : undefined}
            />

            <div className="space-y-4">
              {/* Progressive Onboarding - Day progress indicator */}
              <DayProgressIndicator />

              <RemindersPanel reminders={reminders} onUpdateReminders={setReminders} habits={safeHabits} />

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
                habitsTotal={safeHabits.length}
                focusMinutes={isFeatureVisible('focusTimer') ? todayFocusMinutes : undefined}
                level={userLevel.level}
                labels={{
                  habits: t.habits,
                  focus: t.focus,
                  level: t.level || 'Level',
                }}
              />

              {/* Personal Insights - Data-driven pattern detection */}
              {isFeatureVisible('aiCoach') && (
                <InsightsPanel
                  moods={safeMoods}
                  habits={safeHabits}
                  focusSessions={safeFocusSessions}
                  compact={true}
                />
              )}

              {/* v1.4.0: ScheduleTimeline moved to "My World" tab */}

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

                  {/* Mood Tracker - Primary or Collapsed */}
                  <div ref={moodRef}>
                    {currentPrimaryCTA === 'mood' ? (
                      <EmotionWheel
                        entries={safeMoods}
                        onAddEntry={handleAddMood}
                        isPrimaryCTA={true}
                      />
                    ) : hasMoodToday ? (
                      <CompletedSection
                        title={t.moodRecordedShort || t.moodToday}
                        icon="💜"
                        accentColor="primary"
                      >
                        <EmotionWheel
                          entries={safeMoods}
                          onAddEntry={handleAddMood}
                        />
                      </CompletedSection>
                    ) : (
                      <EmotionWheel
                        entries={safeMoods}
                        onAddEntry={handleAddMood}
                      />
                    )}
                  </div>

                  {/* Breathing Exercise - Compact mindfulness card */}
                  {isFeatureVisible('breathingExercise') && (
                    <Suspense fallback={<div className="h-24 bg-card rounded-3xl animate-pulse" />}>
                      <BreathingExercise
                        compact
                        onComplete={(pattern) => {
                          const treatResult = earnTreats('breathing', 5, `Breathing: ${pattern.name}`);
                          triggerXpPopup(treatResult.earned, 'breathing');
                          triggerSync(); // Sync inner world treats
                        }}
                      />
                    </Suspense>
                  )}

                  {/* Habit Tracker - Primary or Collapsed */}
                  <div ref={habitsRef}>
                    {currentPrimaryCTA === 'habits' ? (
                      <HabitTracker
                        habits={safeHabits}
                        onToggleHabit={handleToggleHabit}
                        onAdjustHabit={handleAdjustHabit}
                        onAddHabit={handleAddHabit}
                        onDeleteHabit={handleDeleteHabit}
                        isPrimaryCTA={true}
                      />
                    ) : !hasUncompletedHabits && safeHabits.length > 0 ? (
                      <CompletedSection
                        title={t.habitsCompletedShort || t.habits}
                        icon="✅"
                        accentColor="emerald"
                      >
                        <HabitTracker
                          habits={safeHabits}
                          onToggleHabit={handleToggleHabit}
                          onAdjustHabit={handleAdjustHabit}
                          onAddHabit={handleAddHabit}
                          onDeleteHabit={handleDeleteHabit}
                        />
                      </CompletedSection>
                    ) : (
                      <HabitTracker
                        habits={safeHabits}
                        onToggleHabit={handleToggleHabit}
                        onAdjustHabit={handleAdjustHabit}
                        onAddHabit={handleAddHabit}
                        onDeleteHabit={handleDeleteHabit}
                      />
                    )}
                  </div>

                  {/* Focus Timer - Primary or Collapsed (Progressive: Day 2) */}
                  {isFeatureVisible('focusTimer') && (
                    <div ref={focusRef}>
                      {currentPrimaryCTA === 'focus' ? (
                        <FocusTimer
                          sessions={safeFocusSessions}
                          onCompleteSession={handleCompleteFocusSession}
                          onMinuteUpdate={setCurrentFocusMinutes}
                          isPrimaryCTA={true}
                        />
                      ) : hasFocusToday ? (
                        <CompletedSection
                          title={t.focusCompletedShort || t.focus}
                          icon="🎯"
                          accentColor="violet"
                        >
                          <FocusTimer
                            sessions={safeFocusSessions}
                            onCompleteSession={handleCompleteFocusSession}
                            onMinuteUpdate={setCurrentFocusMinutes}
                          />
                        </CompletedSection>
                      ) : (
                        <FocusTimer
                          sessions={safeFocusSessions}
                          onCompleteSession={handleCompleteFocusSession}
                          onMinuteUpdate={setCurrentFocusMinutes}
                        />
                      )}
                    </div>
                  )}

                  {/* Daily Prompt Card - visible prompt for journaling */}
                  {isFeatureVisible('gratitudeJournal') && (
                    <DailyPromptCard
                      onUsePrompt={handleUseJournalPrompt}
                    />
                  )}

                  {/* Gratitude Journal - Primary or Collapsed */}
                  {isFeatureVisible('gratitudeJournal') && (
                    <div ref={gratitudeRef}>
                      <Suspense fallback={<div className="h-32 bg-card rounded-3xl animate-pulse" />}>
                        {currentPrimaryCTA === 'gratitude' ? (
                          <GratitudeJournal
                            entries={safeGratitudeEntries}
                            onAddEntry={handleAddGratitude}
                            isPrimaryCTA={true}
                            initialText={journalPromptText}
                            onInitialTextUsed={handleJournalPromptUsed}
                          />
                        ) : hasGratitudeToday ? (
                          <CompletedSection
                            title={t.gratitudeAddedShort || t.gratitude}
                            icon="🙏"
                            accentColor="pink"
                          >
                            <GratitudeJournal
                              entries={safeGratitudeEntries}
                              onAddEntry={handleAddGratitude}
                              initialText={journalPromptText}
                              onInitialTextUsed={handleJournalPromptUsed}
                            />
                          </CompletedSection>
                        ) : (
                          <GratitudeJournal
                            entries={safeGratitudeEntries}
                            onAddEntry={handleAddGratitude}
                            initialText={journalPromptText}
                            onInitialTextUsed={handleJournalPromptUsed}
                          />
                        )}
                      </Suspense>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {activeTab === 'garden' && (
          <div className="space-y-4">
            <Header
              userName={userName}
              onOpenChallenges={isFeatureVisible('challenges') ? () => setShowChallenges(true) : undefined}
              onOpenTasks={isFeatureVisible('tasks') ? () => setShowTasksPanel(true) : undefined}
              onOpenQuests={isFeatureVisible('quests') ? () => setShowQuestsPanel(true) : undefined}
            />

            {/* v1.4.0: Schedule Timeline - ADHD-friendly day planner with habits auto-synced */}
            <ScheduleTimeline
              events={todayAllEvents}
              onAddEvent={handleAddScheduleEvent}
              onDeleteEvent={handleDeleteScheduleEvent}
            />

            {/* AI Insights - Personalized mood pattern analysis */}
            {isFeatureVisible('aiCoach') && (
              <MoodInsights
                moods={safeMoods}
                habits={safeHabits}
                focusSessions={safeFocusSessions}
                gratitudeEntries={safeGratitudeEntries}
              />
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          }>
            <StatsPage
              moods={safeMoods}
              habits={safeHabits}
              focusSessions={safeFocusSessions}
              gratitudeEntries={safeGratitudeEntries}
              restDays={innerWorld.restDays}
              currentFocusMinutes={currentFocusMinutes}
            />
          </Suspense>
        )}

        {activeTab === 'achievements' && (
          <div className="content-with-nav px-4">
            <AchievementsPanel
              stats={stats}
              unlockedAchievements={gamificationState.unlockedAchievements}
            />
            {/* Leaderboard - Social Feature from v1.3.0 "Harmony" */}
            <Suspense fallback={null}>
              <div className="mt-6">
                <Leaderboard />
              </div>
            </Suspense>
          </div>
        )}

        {activeTab === 'settings' && (
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          }>
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
            />
          </Suspense>
        )}
      </main>

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
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
          <div className="fixed inset-0 z-50 bg-background">
            <WidgetSettings onBack={() => setShowWidgetSettings(false)} />
          </div>
        </Suspense>
      )}

      {/* Challenges Panel Modal (Progressive: Day 4) */}
      {showChallenges && isFeatureVisible('challenges') && (
        <Suspense fallback={null}>
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
      )}

      {/* Time Helper Modal */}
      {isFeatureVisible('focusTimer') && showTimeHelper && (
        <TimeHelper onClose={() => setShowTimeHelper(false)} />
      )}

      {/* Tasks Panel Modal (Progressive: Day 4) */}
      {showTasksPanel && isFeatureVisible('tasks') && (
        <Suspense fallback={null}>
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
      )}

      {/* Quests Panel Modal (Progressive: Day 3) */}
      {showQuestsPanel && isFeatureVisible('quests') && (
        <Suspense fallback={null}>
          <QuestsPanel
            onClose={() => setShowQuestsPanel(false)}
          />
        </Suspense>
      )}

      {/* Companion Panel Modal (Progressive: Day 3, legacy - kept for reference) */}
      {isFeatureUnlocked('companion') && isFeatureVisible('innerWorld') && (
        <CompanionPanel
          companion={innerWorld.companion}
          isOpen={showCompanionPanel}
          onClose={() => setShowCompanionPanel(false)}
          onRename={renameCompanion}
          onChangeType={setCompanionType}
          onPet={petCompanion}
          onFeed={feedCompanion}
          treatsBalance={treatsBalance}
          feedCost={FEED_COST}
          streak={innerWorld.currentActiveStreak}
          hasMoodToday={hasMoodToday}
          hasHabitsToday={safeHabits.length > 0 && safeHabits.every(h => h.completedDates?.includes(currentDate))}
          hasFocusToday={hasFocusToday}
          hasGratitudeToday={hasGratitudeToday}
        />
      )}

      {/* Challenge Modal - for deep link invites */}
      {isFeatureVisible('challenges') && (
        <ChallengeModal
          open={showChallengeModal}
          onOpenChange={(open) => {
            setShowChallengeModal(open);
            if (!open) setChallengeInvite(undefined);
          }}
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
          trigger="focus"
        />
      )}

      {/* AI Coach Chat - bottom sheet for AI coaching */}
      {isFeatureVisible('aiCoach') && <AICoachChat />}

    </div>
  );
};

export default Index;
