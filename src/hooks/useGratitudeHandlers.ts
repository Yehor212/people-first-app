import { useCallback } from 'react';
import { useGamificationStore, useUIStore, useUserDataStore } from '@/stores';
import { triggerXpPopup } from '@/components/XpPopup';
import { haptics } from '@/lib/haptics';
import { updateAllQuestsProgress } from '@/lib/randomQuests';
import type { GratitudeEntry } from '@/types';

interface UseGratitudeHandlersParams {
  earnTreats: (source: string, amount: number, reason?: string) => { earned: number };
  attractCreature: () => void;
  feedCreatures: () => void;
  updateChallengeProgress: () => void;
}

/**
 * Gratitude entry handlers: add gratitude, journal prompt management.
 */
export function useGratitudeHandlers({
  earnTreats,
  attractCreature,
  feedCreatures,
  updateChallengeProgress,
}: UseGratitudeHandlersParams) {
  const setGratitudeEntries = useUserDataStore(s => s.setGratitudeEntries);
  const rewardUser = useGamificationStore(s => s.rewardUser);
  const setJournalPromptText = useUIStore(s => s.setJournalPromptText);

  const handleAddGratitude = (entry: GratitudeEntry) => {
    setGratitudeEntries(prev => [...prev, entry]);
    rewardUser('gratitude', { treats: 8, treatReason: 'Gratitude entry', haptic: haptics.gratitudeSaved });

    // Gratitude-specific: attract creatures
    if (Math.random() < 0.3) attractCreature();
    feedCreatures();

    updateChallengeProgress();

    const completedQuests = updateAllQuestsProgress({ type: 'gratitude_added', value: 1 });
    completedQuests.forEach(quest => {
      const xpReward = quest.reward.xp;
      earnTreats('gratitude', xpReward, `Quest: ${quest.title}`);
      triggerXpPopup(xpReward, 'bonus');
    });
  };

  const handleJournalPromptUsed = useCallback(() => {
    setJournalPromptText(undefined);
  }, [setJournalPromptText]);

  return { handleAddGratitude, handleJournalPromptUsed };
}
