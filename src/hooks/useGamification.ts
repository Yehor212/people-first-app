import { useState, useEffect, useCallback, useRef } from 'react';
import { useIndexedDB } from './useIndexedDB';
import { db } from '@/storage/db';
import { gamificationStateSchema } from '@/lib/schemas';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import {
  AchievementId,
  checkAchievements,
  UserStats,
  calculateLevel,
  getXpForAction,
} from '@/lib/gamification';
import { addFriendActivity, loadMyProfile, updateMyLevel } from '@/storage/friendsSync';

interface GamificationState {
  totalXp: number;
  unlockedAchievements: AchievementId[];
  achievementProgress: Record<AchievementId, number>;
  lastClaimedReward?: string; // ISO date
  shownAchievementToasts?: AchievementId[]; // Track which toasts have been shown
}

const INITIAL_STATE: GamificationState = {
  totalXp: 0,
  unlockedAchievements: [],
  achievementProgress: {},
  shownAchievementToasts: [],
};

export function useGamification() {
  const [gamificationState, setGamificationState] = useIndexedDB<GamificationState>({
    table: db.settings,
    localStorageKey: 'gamification',
    initialValue: INITIAL_STATE,
    idField: 'key',
    objectSchema: gamificationStateSchema,
  });

  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeEntry[]>([]);

  // Track mounted state to prevent setState after unmount
  const isMountedRef = useRef(true);

  // Load all data for stats
  useEffect(() => {
    isMountedRef.current = true;

    const loadData = async () => {
      const [moodsData, habitsData, focusData, gratitudeData] = await Promise.all([
        db.moods.toArray(),
        db.habits.toArray(),
        db.focusSessions.toArray(),
        db.gratitudeEntries.toArray(),
      ]);

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      setMoods(moodsData);
      setHabits(habitsData);
      setFocusSessions(focusData);
      setGratitudeEntries(gratitudeData);
    };

    void loadData();

    // Refresh periodically
    const interval = setInterval(loadData, 5000);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  const stats: UserStats = {
    moods,
    habits,
    focusSessions,
    gratitudeEntries,
    totalXp: gamificationState.totalXp,
  };

  // Track if initial load is complete to avoid showing toasts on page load
  const initialLoadRef = useRef(true);
  const lastDataHashRef = useRef('');

  // Check for new achievements
  useEffect(() => {
    if (moods.length === 0 && habits.length === 0) return;

    // Create a hash of the current data to detect real changes
    const dataHash = `${moods.length}-${habits.length}-${focusSessions.length}-${gratitudeEntries.length}`;
    const isRealChange = lastDataHashRef.current !== '' && lastDataHashRef.current !== dataHash;
    lastDataHashRef.current = dataHash;

    const { newAchievements, updatedProgress } = checkAchievements(
      stats,
      gamificationState.unlockedAchievements
    );

    // Get list of achievements we've already shown toasts for
    const shownToasts = new Set(gamificationState.shownAchievementToasts || []);

    if (newAchievements.length > 0) {
      const updatedAchievements = [
        ...gamificationState.unlockedAchievements,
        ...newAchievements.map((a) => a.id),
      ];

      const xpGained = newAchievements.reduce((sum, a) => sum + a.points, 0);

      // Filter achievements that haven't had their toast shown yet
      const achievementsToShow = newAchievements.filter(a => !shownToasts.has(a.id));

      // Mark all new achievements as having their toast shown
      const updatedShownToasts = [
        ...(gamificationState.shownAchievementToasts || []),
        ...newAchievements.map(a => a.id),
      ];

      setGamificationState({
        ...gamificationState,
        totalXp: gamificationState.totalXp + xpGained,
        unlockedAchievements: updatedAchievements,
        achievementProgress: {
          ...gamificationState.achievementProgress,
          ...updatedProgress,
        },
        shownAchievementToasts: updatedShownToasts,
      });

      // Only show toasts if:
      // 1. Not on initial page load
      // 2. This is a real data change (user did something)
      // 3. The achievement toast hasn't been shown before
      if (!initialLoadRef.current && isRealChange && achievementsToShow.length > 0) {
        const profile = loadMyProfile();
        achievementsToShow.forEach((achievement) => {
          // Track for friends activity feed
          if (profile) {
            const isStreak = achievement.id.startsWith('streak_');
            addFriendActivity({
              friendId: profile.friendCode,
              friendName: profile.displayName,
              activityType: isStreak ? 'streak_milestone' : 'achievement_unlocked',
              description: achievement.name,
              icon: achievement.icon || '🏆',
            });
          }
        });
      }
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

    // Mark initial load as complete after first run
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: including gamificationState would cause infinite loop
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

  // Track level-up for friends activity feed + sync level to profile
  const prevLevelRef = useRef(userLevel.level);
  useEffect(() => {
    // Always sync current level to friends profile
    updateMyLevel(userLevel.level);

    if (prevLevelRef.current > 0 && userLevel.level > prevLevelRef.current) {
      const profile = loadMyProfile();
      if (profile) {
        addFriendActivity({
          friendId: profile.friendCode,
          friendName: profile.displayName,
          activityType: 'level_up',
          description: `${userLevel.title} (${userLevel.level})`,
          icon: '⭐',
        });
      }
    }
    prevLevelRef.current = userLevel.level;
  }, [userLevel.level]);

  return {
    stats,
    gamificationState,
    userLevel,
    awardXp,
  };
}
