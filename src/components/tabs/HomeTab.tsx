import { useMemo } from 'react';
import { Header } from '@/components/Header';
import { InstallBanner } from '@/components/InstallBanner';
import { SessionExpiredBanner } from '@/components/SessionExpiredBanner';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { useAppStore, useUserDataStore, getModalToggle } from '@/stores';
import { SpatialCanvas } from '@/components/canvas/SpatialCanvas';
import { getCurrentGardenAtmosphere } from '@/lib/gardenAtmosphere';
import type { MoodEntry, Habit, ScheduleEvent } from '@/types';

const setShowChallenges = getModalToggle('showChallenges');
const setShowTasksPanel = getModalToggle('showTasksPanel');
const setShowQuestsPanel = getModalToggle('showQuestsPanel');

interface HomeTabProps {
  safeHabits: Habit[];
  safeMoods: MoodEntry[];
  currentActiveStreak: number;
  todayAllEvents: ScheduleEvent[];
  handleToggleHabit: (habitId: string, date: string) => void;
}

export function HomeTab({
  safeHabits, safeMoods, currentActiveStreak,
  todayAllEvents, handleToggleHabit,
}: HomeTabProps) {
  const { isFeatureVisible } = useFeatureFlags();
  const userName = useUserDataStore(s => s.userName);
  const hasValidSession = useAppStore(s => s.hasValidSession);
  const googleAuthChecked = useUserDataStore(s => s.googleAuthChecked);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const setSettingsOpenSection = useAppStore(s => s.setSettingsOpenSection);

  const latestMood = safeMoods.length > 0 ? safeMoods[safeMoods.length - 1].mood : null;

  const atmosphere = useMemo(
    () => getCurrentGardenAtmosphere(todayAllEvents),
    [todayAllEvents],
  );

  return (
    <div className="animate-tab-enter">
      <InstallBanner />
      <Header
        userName={userName}
        streak={currentActiveStreak}
        onOpenChallenges={isFeatureVisible('challenges') ? () => setShowChallenges(true) : undefined}
        onOpenTasks={isFeatureVisible('tasks') ? () => setShowTasksPanel(true) : undefined}
        onOpenQuests={isFeatureVisible('quests') ? () => setShowQuestsPanel(true) : undefined}
      />

      {/* Session expired banner */}
      {hasValidSession === false && googleAuthChecked && userName !== 'Friend' && (
        <SessionExpiredBanner onSignIn={() => { setSettingsOpenSection('account'); setActiveTab('settings'); }} />
      )}

      {/* Spatial Canvas — the Infinite Canvas */}
      <SpatialCanvas
        habits={safeHabits}
        latestMood={latestMood}
        atmosphere={atmosphere}
        onHabitToggle={handleToggleHabit}
      />
    </div>
  );
}
