import { useCallback } from 'react';
import { useGamificationStore, useUserDataStore } from '@/stores';
import { getToday, generateId } from '@/lib/utils';
import { triggerSync } from '@/storage/cloudSync';
import { haptics } from '@/lib/haptics';
import { logger } from '@/lib/logger';
import type { MoodEntry } from '@/types';

interface UseMoodHandlersParams {
  updateChallengeProgress: () => void;
}

/**
 * Mood entry handlers: add mood, quick mood (notification), update mood.
 */
export function useMoodHandlers({ updateChallengeProgress }: UseMoodHandlersParams) {
  const setMoods = useUserDataStore(s => s.setMoods);
  const rewardUser = useGamificationStore(s => s.rewardUser);

  const handleAddMood = (entry: MoodEntry) => {
    setMoods(prev => [...prev, entry]);
    rewardUser('mood', { treats: 5, treatReason: 'Logged mood', haptic: haptics.moodSaved, seedExtra: entry.mood });
    updateChallengeProgress();
  };

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

  const handleUpdateMood = (entryId: string, newMood: MoodEntry['mood'], note?: string) => {
    setMoods(prev => prev.map(entry => {
      if (entry.id !== entryId) return entry;
      return {
        ...entry,
        mood: newMood,
        note: note ?? entry.note,
      };
    }));
    triggerSync();
  };

  return { handleAddMood, handleQuickMood, handleUpdateMood };
}
