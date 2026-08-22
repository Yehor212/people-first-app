import { useCallback } from "react";
import { useGamificationStore, useUserDataStore } from "@/stores";
import { getToday, generateId } from "@/lib/utils";
import { triggerSync } from "@/storage/cloudSync";
import { syncMood } from "@/storage/realtimeSync";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";
import { analytics } from "@/lib/analytics";
import { playSound } from "@/lib/audioManager";
import { useThrottledCallback } from "@/hooks/useThrottledCallback";
import type { MoodEntry } from "@/types";

interface UseMoodHandlersParams {
  updateChallengeProgress: () => void;
  rewardsEnabled?: boolean;
}

interface CommitMoodEntryDeps {
  setMoods: ReturnType<typeof useUserDataStore.getState>["setMoods"];
  rewardUser: ReturnType<typeof useGamificationStore.getState>["rewardUser"];
  updateChallengeProgress: () => void;
  rewardsEnabled?: boolean;
}

export function commitMoodEntry(
  entry: MoodEntry,
  { setMoods, rewardUser, updateChallengeProgress, rewardsEnabled = true }: CommitMoodEntryDeps,
) {
  const stamped = { ...entry, updatedAt: entry.updatedAt || Date.now() };
  setMoods((prev) => [...prev, stamped]);
  if (rewardsEnabled) {
    rewardUser("mood", {
      treats: 5,
      treatReason: "Logged mood",
      haptic: haptics.moodSaved,
      seedExtra: entry.mood,
    });
  } else {
    playSound("success");
  }
  analytics.moodTracked(entry.mood);
  updateChallengeProgress();
  triggerSync();
  void syncMood(stamped).catch((err) => logger.warn("[Mood] Granular sync failed:", err));
}

/**
 * Mood entry handlers: add mood, quick mood (notification), update mood.
 */
export function useMoodHandlers({ updateChallengeProgress, rewardsEnabled = true }: UseMoodHandlersParams) {
  const setMoods = useUserDataStore((s) => s.setMoods);
  const rewardUser = useGamificationStore((s) => s.rewardUser);

  const handleAddMood = useThrottledCallback((entry: MoodEntry) => {
    commitMoodEntry(entry, {
      setMoods,
      rewardUser,
      updateChallengeProgress,
      rewardsEnabled,
    });
  }, 800);

  const handleQuickMood = useCallback(
    (mood: MoodEntry["mood"]) => {
      const today = getToday();
      const entry: MoodEntry = {
        id: generateId(),
        mood,
        date: today,
        timestamp: Date.now(),
        updatedAt: Date.now(),
      };

      setMoods((prev) => [...prev, entry]);
      if (rewardsEnabled) {
        rewardUser("mood", {
          treats: 5,
          treatReason: "Quick mood",
          haptic: haptics.moodSaved,
          skipPopup: true,
          seedExtra: mood,
        });
      } else {
        playSound("success");
      }
      analytics.moodTracked(mood);

      triggerSync();
      void syncMood(entry).catch((err) => logger.warn("[Mood] Granular sync failed:", err));
      logger.log("[Mood] Quick mood logged from notification:", mood);
    },
    [rewardUser, rewardsEnabled, setMoods]
  );

  const handleUpdateMood = useCallback(
    (entryId: string, newMood: MoodEntry["mood"], note?: string) => {
      let updatedEntry: MoodEntry | undefined;
      setMoods((prev) =>
        prev.map((entry) => {
          if (entry.id !== entryId) return entry;
          updatedEntry = {
            ...entry,
            mood: newMood,
            note: note ?? entry.note,
            updatedAt: Date.now(),
          };
          return updatedEntry;
        })
      );
      triggerSync();
      if (updatedEntry)
        void syncMood(updatedEntry).catch((err) => logger.warn("[Mood] Update sync failed:", err));
    },
    [setMoods]
  );

  return { handleAddMood, handleQuickMood, handleUpdateMood };
}
