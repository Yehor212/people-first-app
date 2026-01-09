import { useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { getToday } from '@/lib/utils';

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

type TabType = 'home' | 'stats' | 'settings';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  
  // User data
  const [userName, setUserName] = useLocalStorage('zenflow-username', 'Друг');
  
  // App data
  const [moods, setMoods] = useLocalStorage<MoodEntry[]>('zenflow-moods', []);
  const [habits, setHabits] = useLocalStorage<Habit[]>('zenflow-habits', []);
  const [focusSessions, setFocusSessions] = useLocalStorage<FocusSession[]>('zenflow-focus', []);
  const [gratitudeEntries, setGratitudeEntries] = useLocalStorage<GratitudeEntry[]>('zenflow-gratitude', []);

  // Handlers
  const handleAddMood = (entry: MoodEntry) => {
    setMoods(prev => {
      // Replace today's entry if exists
      const filtered = prev.filter(e => e.date !== entry.date);
      return [...filtered, entry];
    });
  };

  const handleToggleHabit = (habitId: string, date: string) => {
    setHabits(prev => prev.map(habit => {
      if (habit.id !== habitId) return habit;
      
      const completed = habit.completedDates.includes(date);
      return {
        ...habit,
        completedDates: completed
          ? habit.completedDates.filter(d => d !== date)
          : [...habit.completedDates, date],
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
  };

  const handleAddGratitude = (entry: GratitudeEntry) => {
    setGratitudeEntries(prev => [...prev, entry]);
  };

  const handleResetData = () => {
    setMoods([]);
    setHabits([]);
    setFocusSessions([]);
    setGratitudeEntries([]);
    setUserName('Друг');
  };

  return (
    <div className="min-h-screen zen-gradient-hero">
      <div className="max-w-lg mx-auto px-4 py-6 pb-28">
        {activeTab === 'home' && (
          <>
            <Header userName={userName} />
            
            <div className="space-y-6">
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

        {activeTab === 'settings' && (
          <SettingsPanel
            userName={userName}
            onNameChange={setUserName}
            onResetData={handleResetData}
          />
        )}
      </div>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
