import { useState, useEffect, useCallback } from 'react';
import { useIndexedDB } from './useIndexedDB';
import { db } from '@/storage/db';
import {
  Achievement,
  AchievementId,
  checkAchievements,
  UserStats,
  calculateLevel,
  getXpForAction,
} from '@/lib/gamification';
import { toast } from 'sonner';
import { AchievementToast } from '@/components/AchievementToast';

interface GamificationState {
  totalXp: number;
  unlockedAchievements: AchievementId[];
  achievementProgress: Record<AchievementId, number>;
  lastClaimedReward?: string; // ISO date
}

const INITIAL_STATE: GamificationState = {
  totalXp: 0,
  unlockedAchievements: [],
  achievementProgress: {},
};

export function useGamification() {
  const [gamificationState, setGamificationState] = useIndexedDB<GamificationState>({
    table: db.settings,
    localStorageKey: 'gamification',
    initialValue: INITIAL_STATE,
    idField: 'key',
  });

  const [moods, setMoods] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [focusSessions, setFocusSessions] = useState<any[]>([]);
  const [gratitudeEntries, setGratitudeEntries] = useState<any[]>([]);

  // Load all data for stats
  useEffect(() => {
    const loadData = async () => {
      const [moodsData, habitsData, focusData, gratitudeData] = await Promise.all([
        db.moods.toArray(),
        db.habits.toArray(),
        db.focusSessions.toArray(),
        db.gratitudeEntries.toArray(),
      ]);

      setMoods(moodsData);
      setHabits(habitsData);
      setFocusSessions(focusData);
      setGratitudeEntries(gratitudeData);
    };

    loadData();

    // Refresh periodically
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const stats: UserStats = {
    moods,
    habits,
    focusSessions,
    gratitudeEntries,
    totalXp: gamificationState.totalXp,
  };

  // Check for new achievements
  useEffect(() => {
    if (moods.length === 0 && habits.length === 0) return;

    const { newAchievements, updatedProgress } = checkAchievements(
      stats,
      gamificationState.unlockedAchievements
    );

    if (newAchievements.length > 0) {
      const updatedAchievements = [
        ...gamificationState.unlockedAchievements,
        ...newAchievements.map((a) => a.id),
      ];

      const xpGained = newAchievements.reduce((sum, a) => sum + a.points, 0);

      setGamificationState({
        ...gamificationState,
        totalXp: gamificationState.totalXp + xpGained,
        unlockedAchievements: updatedAchievements,
        achievementProgress: {
          ...gamificationState.achievementProgress,
          ...updatedProgress,
        },
      });

      // Show toast for each new achievement
      newAchievements.forEach((achievement) => {
        toast.custom((t) => <AchievementToast achievement={achievement} />, {
          duration: 5000,
          position: 'top-center',
        });
      });
    } else {
      // Update progress only
      setGamificationState({
        ...gamificationState,
        achievementProgress: {
          ...gamificationState.achievementProgress,
          ...updatedProgress,
        },
      });
    }
  }, [moods, habits, focusSessions, gratitudeEntries]);

  // Award XP for actions
  const awardXp = useCallback(
    (action: 'mood' | 'habit' | 'focus' | 'gratitude' | 'streak') => {
      const xp = getXpForAction(action);
      setGamificationState((prev) => ({
        ...prev,
        totalXp: prev.totalXp + xp,
      }));
    },
    [setGamificationState]
  );

  const userLevel = calculateLevel(gamificationState.totalXp);

  return {
    stats,
    gamificationState,
    userLevel,
    awardXp,
  };
}
