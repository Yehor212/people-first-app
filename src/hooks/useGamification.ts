import { useEffect, useCallback, useRef } from 'react';
import { useIndexedDB } from './useIndexedDB';
import { db, getLocalDataOwnerId } from '@/storage/db';
import { gamificationStateSchema } from '@/lib/schemas';
import {
  AchievementId,
  checkAchievements,
  UserStats,
  calculateLevel,
  getXpForAction,
  XpAction,
} from '@/lib/gamification';
import { addFriendActivity, loadMyProfile, updateMyLevel } from '@/storage/friendsSync';
import { analytics } from '@/lib/analytics';
import { playSound } from '@/lib/audioManager';
import { logger } from '@/lib/logger';
import { getCurrentSessionUserId } from '@/lib/supabaseClient';
import { useUserDataStore } from '@/stores/userDataStore';
import { useAppStore } from '@/stores/appStore';

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
  achievementProgress: {} as Record<AchievementId, number>,
  shownAchievementToasts: [],
};

interface UseGamificationOptions {
  enabled?: boolean;
}

export function useGamification(options: UseGamificationOptions = {}) {
  const enabled = options.enabled ?? true;
  const isAccountBoundaryInProgress = useAppStore(
    (state) => state.isAccountBoundaryInProgress
  );
  const [gamificationState, setGamificationState] = useIndexedDB<GamificationState>({
    table: db.settings,
    localStorageKey: 'gamification',
    initialValue: INITIAL_STATE,
    idField: 'key',
    objectSchema: gamificationStateSchema,
  });

  // Subscribe to Zustand store instead of polling DB every 5s
  const moods = useUserDataStore(s => s.moods);
  const habits = useUserDataStore(s => s.habits);
  const focusSessions = useUserDataStore(s => s.focusSessions);
  const gratitudeEntries = useUserDataStore(s => s.gratitudeEntries);

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
    if (!enabled) {
      initialLoadRef.current = false;
      lastDataHashRef.current = `${moods.length}-${habits.length}-${focusSessions.length}-${gratitudeEntries.length}`;
      return;
    }
    if (isAccountBoundaryInProgress) {
      initialLoadRef.current = true;
      lastDataHashRef.current = '';
      return;
    }

    let isCurrentAchievementCheck = true;
    if (moods.length === 0 && habits.length === 0) {
      return () => {
        isCurrentAchievementCheck = false;
      };
    }

    // Create a hash of the current data to detect real changes
    const dataHash = `${moods.length}-${habits.length}-${focusSessions.length}-${gratitudeEntries.length}`;
    const isRealChange = lastDataHashRef.current !== '' && lastDataHashRef.current !== dataHash;
    lastDataHashRef.current = dataHash;

    // Read current gamification state directly from store to avoid stale closure
    const currentState = gamificationState;

    const { newAchievements, updatedProgress } = checkAchievements(
      stats,
      currentState.unlockedAchievements
    );

    if (newAchievements.length > 0) {
      const xpGained = newAchievements.reduce((sum, a) => sum + a.points, 0);
      const newAchievementIds = newAchievements.map((a) => a.id);

      // Use functional updater to avoid stale closure data loss
      setGamificationState(prev => {
        const shownToasts = new Set(prev.shownAchievementToasts || []);
        const achievementsToShow = newAchievements.filter(a => !shownToasts.has(a.id));

        // Side effects (toasts/analytics) — schedule outside updater
        if (!initialLoadRef.current && isRealChange && achievementsToShow.length > 0) {
          queueMicrotask(() => {
            if (
              !isCurrentAchievementCheck ||
              useAppStore.getState().isAccountBoundaryInProgress
            ) {
              return;
            }
            const profile = loadMyProfile();
            const milestoneSound = achievementsToShow.some((achievement) => achievement.id.startsWith('streak_'))
              ? 'streak'
              : 'milestone';
            playSound(milestoneSound);
            achievementsToShow.forEach((achievement) => {
              analytics.achievementUnlocked(achievement.id);
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
          });
        }

        return {
          ...prev,
          totalXp: prev.totalXp + xpGained,
          unlockedAchievements: [...prev.unlockedAchievements, ...newAchievementIds],
          achievementProgress: { ...prev.achievementProgress, ...updatedProgress },
          shownAchievementToasts: [...(prev.shownAchievementToasts || []), ...newAchievementIds],
        };
      });
    } else {
      // Update progress only — functional updater prevents stale overwrites
      setGamificationState(prev => ({
        ...prev,
        achievementProgress: { ...prev.achievementProgress, ...updatedProgress },
      }));
    }

    // Mark initial load as complete after first run
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
    }

    return () => {
      isCurrentAchievementCheck = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- gamificationState read via functional updater (prev), not closure
  }, [enabled, isAccountBoundaryInProgress, moods, habits, focusSessions, gratitudeEntries]);

  // Award XP for actions
  const awardXp = useCallback(
    (action: XpAction) => {
      if (!enabled) return;
      const xp = getXpForAction(action);
      setGamificationState((prev) => ({
        ...prev,
        totalXp: prev.totalXp + xp,
      }));
    },
    [enabled, setGamificationState]
  );

  const userLevel = calculateLevel(gamificationState.totalXp);

  // Track level-up for friends activity feed + sync level to profile
  const prevLevelRef = useRef(userLevel.level);
  useEffect(() => {
    if (!enabled || isAccountBoundaryInProgress) return;
    let isCurrentLevel = true;
    const didLevelUp =
      prevLevelRef.current > 0 && userLevel.level > prevLevelRef.current;

    // Always sync current level to friends profile
    void Promise.all([getCurrentSessionUserId(), getLocalDataOwnerId()])
      .then(async ([expectedOwnerUserId, localOwnerUserId]) => {
        if (
          !isCurrentLevel ||
          !expectedOwnerUserId ||
          localOwnerUserId !== expectedOwnerUserId
        ) {
          return;
        }
        await updateMyLevel(userLevel.level, expectedOwnerUserId);
        if (
          !isCurrentLevel ||
          useAppStore.getState().isAccountBoundaryInProgress ||
          !didLevelUp
        ) {
          return;
        }

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
      })
      .catch((error) => {
        logger.warn('[Gamification] Failed to schedule level sync:', error);
      });
    prevLevelRef.current = userLevel.level;

    return () => {
      isCurrentLevel = false;
    };
  }, [enabled, isAccountBoundaryInProgress, userLevel.level, userLevel.title]);

  return {
    stats,
    gamificationState,
    userLevel,
    awardXp,
  };
}
