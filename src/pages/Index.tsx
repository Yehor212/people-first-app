import { useEffect, useMemo, useRef, useState } from 'react';
import { useIndexedDB } from '@/hooks/useIndexedDB';
import { MoodEntry, Habit, FocusSession, GratitudeEntry, ReminderSettings, PrivacySettings } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/storage/db';
import { defaultReminderSettings } from '@/lib/reminders';
import { generateId, getToday } from '@/lib/utils';
import { findTemplateIdByName, getHabitTemplateName } from '@/lib/habitTemplates';
import { normalizeHabit } from '@/lib/habits';
import { supabase } from '@/lib/supabaseClient';
import { syncReminderSettings } from '@/storage/reminderSync';
import { syncWithCloud } from '@/storage/cloudSync';
import { App } from '@capacitor/app';
import { handleAuthCallback, isNativePlatform } from '@/lib/authRedirect';
import { scheduleLocalReminders } from '@/lib/localNotifications';

import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { StatsOverview } from '@/components/StatsOverview';
import { MoodTracker } from '@/components/MoodTracker';
import { HabitTracker } from '@/components/HabitTracker';
import { FocusTimer } from '@/components/FocusTimer';
import { GratitudeJournal } from '@/components/GratitudeJournal';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { StatsPage } from '@/components/StatsPage';
import { SettingsPanel } from '@/components/SettingsPanel';
import { LanguageSelector } from '@/components/LanguageSelector';
import { InstallBanner } from '@/components/InstallBanner';
import { RemindersPanel } from '@/components/RemindersPanel';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { AuthGate } from '@/components/AuthGate';
import { AchievementsPanel } from '@/components/AchievementsPanel';
import { useGamification } from '@/hooks/useGamification';

type TabType = 'home' | 'stats' | 'achievements' | 'settings';

export function Index() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const lastSyncedUserIdRef = useRef<string | null>(null);

  // Gamification system
  const { stats, gamificationState, userLevel, awardXp } = useGamification();

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

  const [onboardingComplete, setOnboardingComplete, isLoadingOnboarding] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-onboarding-complete',
    initialValue: false,
    idField: 'key'
  });

  const [privacy, setPrivacy, isLoadingPrivacy] = useIndexedDB<PrivacySettings>({
    table: db.settings,
    localStorageKey: 'zenflow-privacy',
    initialValue: { noTracking: true, analytics: false },
    idField: 'key'
  });

  const [authGateComplete, setAuthGateComplete, isLoadingAuthGate] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-auth-gate-complete',
    initialValue: false,
    idField: 'key'
  });

  // Loading handling
  const isLoading = isLoadingLangSelected || isLoadingUserName || isLoadingUserNameCustom || isLoadingMoods || isLoadingHabits || isLoadingFocus || isLoadingGratitude || isLoadingReminders || isLoadingOnboarding || isLoadingPrivacy || isLoadingAuthGate;

  // Handlers
  const handleAddMood = (entry: MoodEntry) => {
    setMoods(prev => {
      const filtered = prev.filter(e => e.date !== entry.date);
      return [...filtered, entry];
    });
    awardXp('mood'); // +5 XP
  };

  const handleToggleHabit = (habitId: string, date: string) => {
    setHabits(prev => prev.map(habit => {
      if (habit.id !== habitId) return habit;
      if ((habit.type || 'daily') === 'reduce') return habit;

      const completed = habit.completedDates.includes(date);
      if (!completed) {
        awardXp('habit'); // +10 XP for completing habit
      }
      return {
        ...habit,
        completedDates: completed
          ? habit.completedDates.filter(d => d !== date)
          : [...habit.completedDates, date],
      };
    }));
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
  };

  const handleAddHabit = (habit: Habit) => {
    setHabits(prev => [...prev, habit]);
  };

  const handleDeleteHabit = (habitId: string) => {
    setHabits(prev => prev.filter(h => h.id !== habitId));
  };

  const handleCompleteFocusSession = (session: FocusSession) => {
    setFocusSessions(prev => [...prev, session]);
    awardXp('focus'); // +15 XP
  };

  const handleAddGratitude = (entry: GratitudeEntry) => {
    setGratitudeEntries(prev => [...prev, entry]);
    awardXp('gratitude'); // +8 XP
  };

  const handleResetData = () => {
    setMoods([]);
    setHabits([]);
    setFocusSessions([]);
    setGratitudeEntries([]);
    setUserName('Friend');
    setUserNameCustom(false);
  };

  const handleLanguageSelected = () => {
    setHasSelectedLanguage(true);
  };

  const handleNameChange = (name: string) => {
    setUserName(name);
    setUserNameCustom(true);
  };

  const handleAuthComplete = () => {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show language selector on first visit
  if (!authGateComplete) {
    return <AuthGate onComplete={handleAuthComplete} />;
  }

  if (!hasSelectedLanguage) {
    return <LanguageSelector onComplete={handleLanguageSelected} />;
  }

  if (!onboardingComplete) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen zen-gradient-hero">
      <div className="max-w-lg mx-auto px-4 py-6 pb-28">
        {activeTab === 'home' && (
          <>
            <InstallBanner />
            <Header userName={userName} />
            
            <div className="space-y-6">
              <RemindersPanel reminders={reminders} onUpdateReminders={setReminders} habits={habits} />
              <StatsOverview
                moods={moods}
                habits={habits}
                focusSessions={focusSessions}
                gratitudeEntries={gratitudeEntries}
              />
              
              <MoodTracker entries={moods} onAddEntry={handleAddMood} />
              
              <HabitTracker
                habits={habits}
                onToggleHabit={handleToggleHabit}
                onAdjustHabit={handleAdjustHabit}
                onAddHabit={handleAddHabit}
                onDeleteHabit={handleDeleteHabit}
              />
              
              <FocusTimer
                sessions={focusSessions}
                onCompleteSession={handleCompleteFocusSession}
              />
              
              <GratitudeJournal
                entries={gratitudeEntries}
                onAddEntry={handleAddGratitude}
              />
              
              <WeeklyCalendar moods={moods} habits={habits} />
            </div>
          </>
        )}

        {activeTab === 'stats' && (
          <StatsPage
            moods={moods}
            habits={habits}
            focusSessions={focusSessions}
            gratitudeEntries={gratitudeEntries}
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
          />
        )}
      </div>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
