import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIndexedDB } from '@/hooks/useIndexedDB';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { MoodEntry, Habit, FocusSession, GratitudeEntry, ReminderSettings, PrivacySettings, ScheduleEvent } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMoodTheme } from '@/contexts/MoodThemeContext';
import { MoodBackgroundOverlay } from '@/components/MoodBackgroundOverlay';
import { triggerXpPopup } from '@/components/XpPopup';
import { DayClock } from '@/components/DayClock';
import { ScheduleTimeline } from '@/components/ScheduleTimeline';
import { db } from '@/storage/db';
import { defaultReminderSettings } from '@/lib/reminders';
import { generateId, getToday } from '@/lib/utils';
import { findTemplateIdByName, getHabitTemplateName } from '@/lib/habitTemplates';
import { normalizeHabit } from '@/lib/habits';
import { supabase } from '@/lib/supabaseClient';
import { syncReminderSettings } from '@/storage/reminderSync';
import { syncWithCloud, startAutoSync, triggerSync } from '@/storage/cloudSync';
import { App } from '@capacitor/app';
import { handleAuthCallback, isNativePlatform } from '@/lib/authRedirect';
import {
  scheduleLocalReminders,
  scheduleHabitReminders,
  scheduleCompanionReminders,
  registerMoodNotificationActions,
  setupNotificationActionListener,
  setMoodActionCallback,
  scheduleMoodQuickLogNotification,
} from '@/lib/localNotifications';

import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { MoodTracker } from '@/components/MoodTracker';
import { HabitTracker } from '@/components/HabitTracker';
import { FocusTimer } from '@/components/FocusTimer';
import { GratitudeJournal } from '@/components/GratitudeJournal';
import { BreathingExercise } from '@/components/BreathingExercise';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { StatsPage } from '@/components/StatsPage';
import { SettingsPanel } from '@/components/SettingsPanel';
import { LanguageSelector } from '@/components/LanguageSelector';
import { InstallBanner } from '@/components/InstallBanner';
import { RemindersPanel } from '@/components/RemindersPanel';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { WelcomeTutorial } from '@/components/WelcomeTutorial';
import { AuthGate } from '@/components/AuthGate';
import { AchievementsPanel } from '@/components/AchievementsPanel';
import { NotificationPermission } from '@/components/NotificationPermission';
import { GoogleAuthScreen } from '@/components/GoogleAuthScreen';
import { WeeklyReport } from '@/components/WeeklyReport';
import { ChallengesPanel } from '@/components/ChallengesPanel';
import { TimeHelper } from '@/components/TimeHelper';
import { WidgetSettings } from '@/pages/WidgetSettings';
import { useGamification } from '@/hooks/useGamification';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { useInnerWorld } from '@/hooks/useInnerWorld';
import { getChallenges, getBadges, addChallenge, syncChallengeProgress } from '@/lib/challengeStorage';
import { syncChallengesWithCloud, syncBadgesWithCloud, subscribeToChallengeUpdates, subscribeToBadgeUpdates, initializeBadgesInCloud } from '@/storage/challengeCloudSync';
import { InnerWorldGarden } from '@/components/InnerWorldGarden';
import { CompanionPanel } from '@/components/CompanionPanel';
import { TreePanel } from '@/components/TreePanel';
import { MoodInsights } from '@/components/MoodInsights';
import { StreakBanner } from '@/components/StreakBanner';
import { RestModeCard } from '@/components/RestModeCard';
import { ConsentBanner } from '@/components/ConsentBanner';
import { GlobalScheduleBar } from '@/components/GlobalScheduleBar';
import { haptics } from '@/lib/haptics';

type TabType = 'home' | 'garden' | 'stats' | 'achievements' | 'settings';

export function Index() {
  const { t, language } = useLanguage();
  const { setMoodFromEntries } = useMoodTheme();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const lastSyncedUserIdRef = useRef<string | null>(null);

  // Track current date and detect midnight change
  const [currentDate, setCurrentDate] = useState(getToday());

  // Check for date change every minute (for midnight reset of mood)
  useEffect(() => {
    const checkDateChange = () => {
      const newDate = getToday();
      if (newDate !== currentDate) {
        console.log('Date changed from', currentDate, 'to', newDate);
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

  const handleNavigateToSection = (section: 'mood' | 'habits' | 'focus' | 'gratitude') => {
    const refs = { mood: moodRef, habits: habitsRef, focus: focusRef, gratitude: gratitudeRef };
    refs[section]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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
    // Tree system
    waterTree,
    touchTree,
    WATER_COST,
    treeStage,
    treeWaterLevel,
    treeXP,
    // Rest mode
    isRestMode,
    activateRestMode,
    deactivateRestMode,
  } = useInnerWorld();

  // Companion panel state
  const [showCompanionPanel, setShowCompanionPanel] = useState(false);
  // Tree panel state
  const [showTreePanel, setShowTreePanel] = useState(false);
  const [treeCalmMode, setTreeCalmMode] = useLocalStorage<boolean>('zenflow-tree-calm', false);

  // Guard against double habit toggles (prevents duplicate rewards)
  const processingHabitsRef = useRef<Set<string>>(new Set());

  // Current focus minutes (real-time)
  const [currentFocusMinutes, setCurrentFocusMinutes] = useState<number | undefined>(undefined);

  // Weekly report state
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  // Widget settings state
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);

  // Challenges state
  const [showChallenges, setShowChallenges] = useState(false);
  const [showTimeHelper, setShowTimeHelper] = useState(false);
  const [challenges, setChallenges] = useState(() => getChallenges());
  const [badges, setBadges] = useState(() => getBadges());

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

  const [authGateComplete, setAuthGateComplete, isLoadingAuthGate] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-auth-gate-complete',
    initialValue: false,
    idField: 'key'
  });

  // Schedule events for ADHD timeline
  const [scheduleEvents, setScheduleEvents, isLoadingSchedule] = useIndexedDB<ScheduleEvent[]>({
    table: db.settings,
    localStorageKey: 'zenflow-schedule-events',
    initialValue: [],
    idField: 'key'
  });

  // Loading handling
  const isLoading = isLoadingLangSelected || isLoadingUserName || isLoadingUserNameCustom || isLoadingMoods || isLoadingHabits || isLoadingFocus || isLoadingGratitude || isLoadingReminders || isLoadingTutorial || isLoadingOnboarding || isLoadingPrivacy || isLoadingAuthGate || isLoadingNotificationPermission || isLoadingSchedule || isLoadingInnerWorld;

  // Schedule event handlers (moved here to avoid TDZ errors)
  const handleAddScheduleEvent = (event: Omit<ScheduleEvent, 'id'>) => {
    const newEvent: ScheduleEvent = {
      ...event,
      id: generateId(),
    };
    setScheduleEvents([...scheduleEvents, newEvent]);
  };

  const handleDeleteScheduleEvent = (id: string) => {
    setScheduleEvents(scheduleEvents.filter(e => e.id !== id));
  };

  // Filter today's schedule events
  const todayScheduleEvents = useMemo(() => {
    return scheduleEvents.filter(e => e.date === currentDate);
  }, [scheduleEvents, currentDate]);

  // Check if user has mood today
  const hasMoodToday = useMemo(() => {
    return moods.some(m => m.date === currentDate);
  }, [moods, currentDate]);

  // Check if user has focus session today
  const hasFocusToday = useMemo(() => {
    return focusSessions.some(s => s.date === currentDate);
  }, [focusSessions, currentDate]);

  // Check if user has gratitude today
  const hasGratitudeToday = useMemo(() => {
    return gratitudeEntries.some(g => g.date === currentDate);
  }, [gratitudeEntries, currentDate]);

  // Check if user has uncompleted habits today
  const hasUncompletedHabits = useMemo(() => {
    if (habits.length === 0) return false;
    return habits.some(h => {
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
  }, [habits, currentDate]);

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
  const currentStreak = useMemo(() => {
    if (!habits.length) return 0;
    const completed = habits.filter(h => h.completedDates?.includes(currentDate) ?? false);
    return completed.length === habits.length ? 1 : 0; // Simplified - real streak calculation would be more complex
  }, [habits, currentDate]);

  const todayFocusMinutes = useMemo(() => {
    return focusSessions
      .filter(s => s.date.startsWith(currentDate))
      .reduce((sum, s) => sum + (s.minutes || 0), 0);
  }, [focusSessions, currentDate]);

  const lastBadgeName = useMemo(() => {
    const unlockedBadges = badges.filter(b => b.unlockedAt);
    if (!unlockedBadges.length) return undefined;
    const latest = unlockedBadges.sort((a, b) => (b.unlockedAt || 0) - (a.unlockedAt || 0))[0];
    return latest.name;
  }, [badges]);

  useWidgetSync(currentStreak, habits, todayFocusMinutes, lastBadgeName);

  // Sync mood theme with current mood entries
  useEffect(() => {
    if (!isLoadingMoods) {
      setMoodFromEntries(moods);
    }
  }, [moods, isLoadingMoods, setMoodFromEntries]);

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

    console.log('Quick mood logged from notification:', mood);
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
        }

        return {
          ...habit,
          completionsByDate,
          completedDates: completionsByDate[date] >= target
            ? [...new Set([...habit.completedDates, date])]
            : habit.completedDates.filter(d => d !== date)
        };
      }

      // Daily and scheduled habits (normal toggle)
      const completed = habit.completedDates.includes(date);
      if (!completed) {
        awardXp('habit'); // +10 XP for completing habit (legacy)
        const treatResult = earnTreats('habit', 10, 'Completed habit');
        triggerXpPopup(treatResult.earned, 'habit'); // Show treats earned
        haptics.habitCompleted();
        // Inner World: Plant a tree when completing habit
        plantSeed('habit');
        waterPlants('habit');
      }
      return {
        ...habit,
        completedDates: completed
          ? habit.completedDates.filter(d => d !== date)
          : [...habit.completedDates, date],
      };
    }));
    triggerSync(); // Auto-sync to cloud
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

    // Inner World: Plant a crystal when completing focus session
    plantSeed('focus');
    waterPlants('focus');
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
  };

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
    setAuthGateComplete(true);
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
          habits.map(habit => [habit.name.toLowerCase(), habit.id])
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
            createdAt: Date.now()
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
        const time = result.reminderTime === 'morning' ? '09:00' : '19:00';
        setReminders(prev => ({
          ...prev,
          enabled: true,
          moodTime: time,
          habitTime: time,
          focusTime: '13:00',
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
    const habitNameMap = new Map(habits.map((habit) => [habit.id, habit.name]));
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
  }, [habits, reminders.habitIds, t]);

  useEffect(() => {
    if (habits.length === 0) return;
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
  }, [language, habits.length, setHabits]);

  useEffect(() => {
    if (!supabase) return;
    const timeoutId = window.setTimeout(() => {
      syncReminderSettings(reminders, language).catch((error) => {
        console.error("Failed to sync reminder settings:", error);
      });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [reminders, language]);

  useEffect(() => {
    if (!isNativePlatform()) return;
    scheduleLocalReminders(reminders, reminderCopy).catch((error) => {
      console.error("Failed to schedule local reminders:", error);
    });
  }, [reminders, reminderCopy]);

  // Schedule per-habit push notifications
  useEffect(() => {
    if (!isNativePlatform()) return;
    scheduleHabitReminders(habits, {
      reminderTitle: t.reminderHabitTitle,
      reminderBody: t.reminderHabitBody
    }).catch((error) => {
      console.error("Failed to schedule habit reminders:", error);
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
      console.error("Failed to schedule companion reminders:", error);
    });
  }, [reminders, innerWorld.companion, isLoadingInnerWorld, t]);

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
      console.error('Failed to setup mood notification actions:', error);
    });

    return () => {
      if (cleanupListener) cleanupListener();
    };
  }, [handleQuickMood]);

  // Schedule mood quick-log notification with action buttons
  useEffect(() => {
    if (!isNativePlatform() || isLoadingInnerWorld || !reminders.enabled) return;

    const parseTime = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return { hour: hours, minute: minutes };
    };

    scheduleMoodQuickLogNotification(
      parseTime(reminders.moodTime),
      { type: innerWorld.companion.type, name: innerWorld.companion.name },
      t.companionQuickMood || 'How are you feeling? Tap! 😊'
    ).catch((error) => {
      console.error('Failed to schedule mood quick-log notification:', error);
    });
  }, [reminders.enabled, reminders.moodTime, innerWorld.companion, isLoadingInnerWorld, t.companionQuickMood]);

  useEffect(() => {
    if (!supabase || !isNativePlatform()) return;
    let removeListener = () => {};

    const handleAuthUrl = async (url: string) => {
      try {
        await handleAuthCallback(supabase, url);
      } catch (error) {
        console.error("Failed to handle auth callback:", error);
      }
    };

    const setup = async () => {
      try {
        const launch = await App.getLaunchUrl();
        if (launch?.url) {
          await handleAuthUrl(launch.url);
        }
      } catch (error) {
        console.error("Failed to read launch url:", error);
      }

      const listener = await App.addListener("appUrlOpen", (event) => {
        if (event?.url) {
          handleAuthUrl(event.url);
        }
      });
      removeListener = () => listener.remove();
    };

    setup();

    return () => {
      removeListener();
    };
  }, []);

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
        console.error('Cloud sync failed:', error);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      syncIfNeeded(data.session?.user?.id ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      syncIfNeeded(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
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

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      syncName();
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
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
    const syncWithCloudIfLoggedIn = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Sync challenges
        const { challenges: syncedChallenges } = await syncChallengesWithCloud(user.id);
        if (syncedChallenges) {
          setChallenges(syncedChallenges);
        }

        // Sync badges
        const { badges: syncedBadges } = await syncBadgesWithCloud(user.id);
        if (syncedBadges) {
          setBadges(syncedBadges);
        }

        // Subscribe to real-time updates
        const challengeSub = subscribeToChallengeUpdates(user.id, (updatedChallenge) => {
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

        const badgeSub = subscribeToBadgeUpdates(user.id, (updatedBadge) => {
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

        return () => {
          challengeSub.unsubscribe();
          badgeSub.unsubscribe();
        };
      }
    };

    syncWithCloudIfLoggedIn();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Google Auth FIRST - to save all progress
  if (!authGateComplete) {
    return <GoogleAuthScreen onComplete={handleAuthComplete} onSkip={() => setAuthGateComplete(true)} />;
  }

  // Language selection ALWAYS shown after auth (before tutorial)
  // This ensures tutorial is shown in user's preferred language
  if (!hasSelectedLanguage) {
    return <LanguageSelector onComplete={handleLanguageSelected} />;
  }

  // Show tutorial before onboarding for new users
  // Now tutorial will be in the language user just selected
  if (!tutorialComplete) {
    return (
      <WelcomeTutorial
        onComplete={() => setTutorialComplete(true)}
        onSkip={() => setTutorialComplete(true)}
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
      {/* Dynamic mood-based background overlay */}
      <MoodBackgroundOverlay />

      {/* GDPR Consent Banner - shows once after onboarding */}
      {!privacy.consentShown && onboardingComplete && (
        <ConsentBanner onConsent={handleConsentResponse} />
      )}

      <div className="max-w-lg mx-auto px-4 py-6 pb-28">
        {/* Global Schedule Bar - visible on all tabs when events exist */}
        {todayScheduleEvents.length > 0 && activeTab !== 'settings' && (
          <div className="mb-4">
            <GlobalScheduleBar
              events={todayScheduleEvents}
              onTap={() => setActiveTab('garden')}
            />
          </div>
        )}

        {activeTab === 'home' && (
          <>
            <InstallBanner />
            <Header
              userName={userName}
              onOpenChallenges={() => setShowChallenges(true)}
            />

            <div className="space-y-6">
              <RemindersPanel reminders={reminders} onUpdateReminders={setReminders} habits={habits} />

              {/* Streak Banner - Prominent streak display with Rest Mode button */}
              <StreakBanner
                moods={moods}
                habits={habits}
                focusSessions={focusSessions}
                gratitudeEntries={gratitudeEntries}
                onRestMode={activateRestMode}
                isRestMode={isRestMode}
              />

              {/* Rest Mode UI - Simplified interface when taking a break */}
              {isRestMode ? (
                <RestModeCard
                  streak={innerWorld.currentActiveStreak}
                  onCancel={deactivateRestMode}
                />
              ) : (
                <>
                  {/* Smart Primary CTA System - Sequential focus */}
                  {/* Mood Tracker - Primary CTA if mood not recorded */}
                  <div ref={moodRef}>
                    <MoodTracker
                      entries={moods}
                      onAddEntry={handleAddMood}
                      onUpdateEntry={handleUpdateMood}
                      isPrimaryCTA={currentPrimaryCTA === 'mood'}
                    />
                  </div>

                  {/* Habit Tracker - Primary CTA if habits not completed */}
                  <div ref={habitsRef}>
                    <HabitTracker
                      habits={habits}
                      onToggleHabit={handleToggleHabit}
                      onAdjustHabit={handleAdjustHabit}
                      onAddHabit={handleAddHabit}
                      onDeleteHabit={handleDeleteHabit}
                      isPrimaryCTA={currentPrimaryCTA === 'habits'}
                    />
                  </div>

                  {/* Focus Timer - Primary CTA if no focus session today */}
                  <div ref={focusRef}>
                    <FocusTimer
                      sessions={focusSessions}
                      onCompleteSession={handleCompleteFocusSession}
                      onMinuteUpdate={setCurrentFocusMinutes}
                      isPrimaryCTA={currentPrimaryCTA === 'focus'}
                    />
                  </div>

                  {/* Gratitude Journal - Primary CTA if no gratitude entry */}
                  <div ref={gratitudeRef}>
                    <GratitudeJournal
                      entries={gratitudeEntries}
                      onAddEntry={handleAddGratitude}
                      isPrimaryCTA={currentPrimaryCTA === 'gratitude'}
                    />
                  </div>

                  {/* Breathing Exercise - Mindfulness card */}
                  <BreathingExercise compact />
                </>
              )}
            </div>
          </>
        )}

        {activeTab === 'garden' && (
          <div className="space-y-6">
            <Header
              userName={userName}
              onOpenChallenges={() => setShowChallenges(true)}
            />

            {/* Inner World Garden - Personal growth visualization */}
            <InnerWorldGarden
              world={innerWorld}
              onCompanionClick={() => {
                clearWelcomeBack();
                setShowTreePanel(true);
              }}
              calmMode={treeCalmMode}
              onPlantClick={(plant) => {
                console.log('Plant clicked:', plant);
              }}
              onCreatureClick={(creature) => {
                console.log('Creature clicked:', creature);
              }}
            />

            {/* Garden Stats - Beautiful minimal cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-green-500/5 rounded-2xl p-4 text-center border border-emerald-500/20">
                <div className="text-2xl mb-2">🌱</div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{gardenStats.totalPlants}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.plants}</div>
                <div className="absolute -right-3 -bottom-3 text-5xl opacity-10">🌿</div>
              </div>
              <div className="relative overflow-hidden bg-gradient-to-br from-violet-500/10 to-purple-500/5 rounded-2xl p-4 text-center border border-violet-500/20">
                <div className="text-2xl mb-2">🦋</div>
                <div className="text-xl font-bold text-violet-600 dark:text-violet-400">{gardenStats.totalCreatures}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.creatures}</div>
                <div className="absolute -right-3 -bottom-3 text-5xl opacity-10">✨</div>
              </div>
              <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-yellow-500/5 rounded-2xl p-4 text-center border border-amber-500/20">
                <div className="text-2xl mb-2">⭐</div>
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{innerWorld.companion.level}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.level}</div>
                <div className="absolute -right-3 -bottom-3 text-5xl opacity-10">🏆</div>
              </div>
            </div>

            {/* Visual Day Clock - ADHD-friendly energy meter */}
            <DayClock
              moods={moods}
              habits={habits}
              focusSessions={focusSessions}
              gratitudeEntries={gratitudeEntries}
              onTimeBlockClick={handleNavigateToSection}
            />

            {/* Schedule Timeline - Horizontal day planner */}
            <ScheduleTimeline
              events={todayScheduleEvents}
              onAddEvent={handleAddScheduleEvent}
              onDeleteEvent={handleDeleteScheduleEvent}
            />

            {/* Weekly Calendar */}
            <WeeklyCalendar moods={moods} habits={habits} />

            {/* AI Insights - Personalized mood pattern analysis */}
            <MoodInsights
              moods={moods}
              habits={habits}
              focusSessions={focusSessions}
              gratitudeEntries={gratitudeEntries}
            />
          </div>
        )}

        {activeTab === 'stats' && (
          <StatsPage
            moods={moods}
            habits={habits}
            focusSessions={focusSessions}
            gratitudeEntries={gratitudeEntries}
            currentFocusMinutes={currentFocusMinutes}
          />
        )}

        {activeTab === 'achievements' && (
          <div className="pb-24 px-4">
            <AchievementsPanel
              stats={stats}
              unlockedAchievements={gamificationState.unlockedAchievements}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <SettingsPanel
            userName={userName}
            onNameChange={handleNameChange}
            onResetData={handleResetData}
            reminders={reminders}
            onRemindersChange={setReminders}
            habits={habits}
            privacy={privacy}
            onPrivacyChange={setPrivacy}
            onOpenWidgetSettings={() => setShowWidgetSettings(true)}
          />
        )}
      </div>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Weekly Report Modal */}
      {showWeeklyReport && (
        <WeeklyReport
          moods={moods}
          habits={habits}
          focusSessions={focusSessions}
          gratitudeEntries={gratitudeEntries}
          onClose={() => setShowWeeklyReport(false)}
        />
      )}

      {/* Widget Settings Modal */}
      {showWidgetSettings && (
        <div className="fixed inset-0 z-50 bg-background">
          <WidgetSettings onBack={() => setShowWidgetSettings(false)} />
        </div>
      )}

      {/* Challenges Panel Modal */}
      {showChallenges && (
        <ChallengesPanel
          activeChallenges={challenges}
          badges={badges}
          onStartChallenge={(challenge) => {
            addChallenge(challenge);
            setChallenges(getChallenges());
            setBadges(getBadges());
          }}
          onClose={() => setShowChallenges(false)}
        />
      )}

      {/* Time Helper Modal */}
      {showTimeHelper && (
        <TimeHelper onClose={() => setShowTimeHelper(false)} />
      )}

      {/* Companion Panel Modal (legacy - kept for reference) */}
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
        hasHabitsToday={habits.length > 0 && habits.every(h => h.completedDates?.includes(currentDate))}
        hasFocusToday={hasFocusToday}
        hasGratitudeToday={hasGratitudeToday}
      />

      {/* Seasonal Tree Panel Modal */}
      <TreePanel
        treeStage={treeStage}
        waterLevel={treeWaterLevel}
        treeXP={treeXP}
        treeName={innerWorld.companion.name}
        isOpen={showTreePanel}
        onClose={() => setShowTreePanel(false)}
        onRename={renameCompanion}
        onTouch={touchTree}
        onWater={waterTree}
        treatsBalance={treatsBalance}
        waterCost={WATER_COST}
        streak={innerWorld.currentActiveStreak}
        calmMode={treeCalmMode}
        onCalmModeChange={setTreeCalmMode}
      />
    </div>
  );
};

export default Index;
