/**
 * ADHD Hooks Management Hook
 * Centralized state management for all ADHD engagement features
 */

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { safeLocalStorageGet, safeLocalStorageSet, storageGetRaw, storageSetRaw } from '@/lib/safeJson';
import { safeParseInt } from '@/lib/validation';
import { SK } from '@/lib/storageKeys';

import {
  ComboState,
  TimeChallenge,
  MysteryBox,
  initCombo,
  updateCombo,
  generateFlashChallenge,
  generateHourlyChallenge,
  generateWeekendChallenge,
  getStreakRiskNotification,
  getComebackNotification,
  ADHDNotification,
} from '@/lib/adhdHooks';

interface ADHDHooksState {
  combo: ComboState;
  spinTokens: number;
  mysteryBoxes: MysteryBox[];
  activeChallenges: TimeChallenge[];
  notifications: ADHDNotification[];
  showDailyRewards: boolean;
  lastLoginDate: string | null;
  loginStreak: number;
}

export function useADHDHooks(currentStreak: number) {
  const [state, setState] = useState<ADHDHooksState>({
    combo: initCombo(),
    spinTokens: 0,
    mysteryBoxes: [],
    activeChallenges: [],
    notifications: [],
    showDailyRewards: false,
    lastLoginDate: null,
    loginStreak: 0,
  });

  // Load saved state on mount
  useEffect(() => {
    const loadState = () => {
      try {
        // Combo - use safe parse to prevent crashes from corrupted data
        const combo = safeLocalStorageGet(SK.COMBO_STATE, initCombo());

        // Spin tokens
        const spinTokens = safeParseInt(storageGetRaw(SK.SPIN_TOKENS), 0, 0, 100);

        // Mystery boxes - use safe parse
        const mysteryBoxes: MysteryBox[] = safeLocalStorageGet(SK.MYSTERY_BOXES, []);

        // Challenges - use safe parse
        let activeChallenges: TimeChallenge[] = safeLocalStorageGet(SK.TIME_CHALLENGES, []);

        // Filter expired challenges
        const now = Date.now();
        activeChallenges = activeChallenges.filter(c => c.expiresAt > now || c.completed);

        // Last login
        const lastLoginDate = storageGetRaw(SK.LAST_LOGIN) || null;
        const loginStreak = safeParseInt(storageGetRaw(SK.LOGIN_STREAK), 0, 0, 1000);

        // Check if should show daily rewards
        const today = new Date().toDateString();
        const showDailyRewards = lastLoginDate !== today;

        // Generate notifications
        const notifications: ADHDNotification[] = [];

        // Streak risk
        const hoursUntilMidnight = (24 - new Date().getHours());
        const streakRisk = getStreakRiskNotification(currentStreak, hoursUntilMidnight);
        if (streakRisk) notifications.push(streakRisk);

        // Comeback notification
        if (lastLoginDate) {
          const lastLogin = new Date(lastLoginDate);
          const daysSince = Math.floor((now - lastLogin.getTime()) / 86400000);
          const comeback = getComebackNotification(daysSince);
          if (comeback) notifications.push(comeback);
        }

        setState({
          combo,
          spinTokens,
          mysteryBoxes,
          activeChallenges,
          notifications,
          showDailyRewards,
          lastLoginDate,
          loginStreak,
        });
      } catch (error) {
        logger.error('Failed to load ADHD hooks state:', error);
      }
    };

    loadState();
  }, [currentStreak]);

  // Save state changes
  const _saveState = useCallback((updates: Partial<ADHDHooksState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };

      // Persist to localStorage
      if (updates.combo) {
        safeLocalStorageSet(SK.COMBO_STATE, updates.combo);
      }
      if (updates.spinTokens !== undefined) {
        storageSetRaw(SK.SPIN_TOKENS, String(updates.spinTokens));
      }
      if (updates.mysteryBoxes) {
        safeLocalStorageSet(SK.MYSTERY_BOXES, updates.mysteryBoxes);
      }
      if (updates.activeChallenges) {
        safeLocalStorageSet(SK.TIME_CHALLENGES, updates.activeChallenges);
      }

      return newState;
    });
  }, []);

  // Increment combo on action
  const incrementCombo = useCallback(() => {
    setState(prev => {
      const newCombo = updateCombo(prev.combo);
      safeLocalStorageSet(SK.COMBO_STATE, newCombo);
      return { ...prev, combo: newCombo };
    });
  }, []);

  // Add spin token
  const addSpinToken = useCallback((count: number = 1) => {
    setState(prev => {
      const newCount = prev.spinTokens + count;
      storageSetRaw(SK.SPIN_TOKENS, String(newCount));
      return { ...prev, spinTokens: newCount };
    });
  }, []);

  // Use spin token
  const useSpinToken = useCallback(() => {
    setState(prev => {
      if (prev.spinTokens <= 0) return prev;
      const newCount = prev.spinTokens - 1;
      storageSetRaw(SK.SPIN_TOKENS, String(newCount));
      return { ...prev, spinTokens: newCount };
    });
  }, []);

  // Add mystery box
  const addMysteryBox = useCallback((type: MysteryBox['type']) => {
    const newBox: MysteryBox = {
      id: `box_${Date.now()}`,
      type,
      icon: type === 'diamond' ? '💎' : type === 'gold' ? '🎁' : type === 'silver' ? '🎁' : '📦',
      rewards: [],
      unlockedAt: Date.now(),
    };

    setState(prev => {
      const newBoxes = [...prev.mysteryBoxes, newBox];
      safeLocalStorageSet(SK.MYSTERY_BOXES, newBoxes);
      return { ...prev, mysteryBoxes: newBoxes };
    });

    return newBox;
  }, []);

  // Open mystery box
  const openMysteryBox = useCallback((boxId: string) => {
    setState(prev => {
      const newBoxes = prev.mysteryBoxes.map(box =>
        box.id === boxId ? { ...box, openedAt: Date.now() } : box
      );
      safeLocalStorageSet(SK.MYSTERY_BOXES, newBoxes);
      return { ...prev, mysteryBoxes: newBoxes };
    });
  }, []);

  // Remove mystery box
  const removeMysteryBox = useCallback((boxId: string) => {
    setState(prev => {
      const newBoxes = prev.mysteryBoxes.filter(box => box.id !== boxId);
      safeLocalStorageSet(SK.MYSTERY_BOXES, newBoxes);
      return { ...prev, mysteryBoxes: newBoxes };
    });
  }, []);

  // Add time challenge
  const addChallenge = useCallback((type: 'flash' | 'hourly' | 'weekend') => {
    let challenge: TimeChallenge | null = null;

    if (type === 'flash') challenge = generateFlashChallenge();
    else if (type === 'hourly') challenge = generateHourlyChallenge();
    else if (type === 'weekend') challenge = generateWeekendChallenge();

    if (!challenge) return null;

    setState(prev => {
      const newChallenges = [...prev.activeChallenges, challenge];
      safeLocalStorageSet(SK.TIME_CHALLENGES, newChallenges);
      return { ...prev, activeChallenges: newChallenges };
    });

    return challenge;
  }, []);

  // Update challenge progress
  const updateChallengeProgress = useCallback((challengeId: string, progress: number) => {
    setState(prev => {
      const newChallenges = prev.activeChallenges.map(c =>
        c.id === challengeId
          ? { ...c, progress, completed: progress >= c.target }
          : c
      );
      safeLocalStorageSet(SK.TIME_CHALLENGES, newChallenges);
      return { ...prev, activeChallenges: newChallenges };
    });
  }, []);

  // Remove challenge
  const removeChallenge = useCallback((challengeId: string) => {
    setState(prev => {
      const newChallenges = prev.activeChallenges.filter(c => c.id !== challengeId);
      safeLocalStorageSet(SK.TIME_CHALLENGES, newChallenges);
      return { ...prev, activeChallenges: newChallenges };
    });
  }, []);

  // Dismiss notification
  const dismissNotification = useCallback((notificationId: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== notificationId),
    }));
  }, []);

  // Close daily rewards
  const closeDailyRewards = useCallback(() => {
    setState(prev => ({ ...prev, showDailyRewards: false }));
  }, []);

  // Claim daily reward
  const claimDailyReward = useCallback(() => {
    const today = new Date().toDateString();
    storageSetRaw(SK.LAST_LOGIN, today);
    setState(prev => ({
      ...prev,
      showDailyRewards: false,
      lastLoginDate: today,
    }));
  }, []);

  return {
    ...state,
    incrementCombo,
    addSpinToken,
    useSpinToken,
    addMysteryBox,
    openMysteryBox,
    removeMysteryBox,
    addChallenge,
    updateChallengeProgress,
    removeChallenge,
    dismissNotification,
    closeDailyRewards,
    claimDailyReward,
  };
}
