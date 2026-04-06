import { useGamificationStore, useUserDataStore } from "@/stores";
import { triggerXpPopup } from "@/components/XpPopup";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";
import { triggerSync } from "@/storage/cloudSync";
import { syncGratitude } from "@/storage/realtimeSync";
import { updateAllQuestsProgress } from "@/lib/randomQuests";
import { useThrottledCallback } from "@/hooks/useThrottledCallback";
import type { GratitudeEntry } from "@/types";

interface UseGratitudeHandlersParams {
  earnTreats: (source: string, amount: number, reason?: string) => { earned: number };
  attractCreature: () => void;
  feedCreatures: () => void;
  updateChallengeProgress: () => void;
}

/**
 * Gratitude entry handlers: add gratitude with gamification rewards.
 */
export function useGratitudeHandlers({
  earnTreats,
  attractCreature,
  feedCreatures,
  updateChallengeProgress,
}: UseGratitudeHandlersParams) {
  const setGratitudeEntries = useUserDataStore((s) => s.setGratitudeEntries);
  const rewardUser = useGamificationStore((s) => s.rewardUser);

  const handleAddGratitude = useThrottledCallback((entry: GratitudeEntry) => {
    const stamped = { ...entry, updatedAt: entry.updatedAt || Date.now() };
    setGratitudeEntries((prev) => [...prev, stamped]);
    rewardUser("gratitude", {
      treats: 8,
      treatReason: "Gratitude entry",
      haptic: haptics.gratitudeSaved,
    });

    // Gratitude-specific: attract creatures
    if (Math.random() < 0.3) attractCreature();
    feedCreatures();

    updateChallengeProgress();

    const completedQuests = updateAllQuestsProgress({ type: "gratitude_added", value: 1 });
    completedQuests.forEach((quest) => {
      const xpReward = quest.reward.xp;
      earnTreats("gratitude", xpReward, `Quest: ${quest.title}`);
      triggerXpPopup(xpReward, "bonus");
    });

    triggerSync();
    void syncGratitude(stamped).catch((err) =>
      logger.warn("[Gratitude] Granular sync failed:", err)
    );
  }, 800);

  return { handleAddGratitude };
}
