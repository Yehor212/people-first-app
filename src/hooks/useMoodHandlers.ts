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
import { persistMoodSourceRecord } from "@/features/automation";
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
  persistMoodEntry?: typeof persistMoodSourceRecord;
  rewardReason?: string;
  skipRewardPopup?: boolean;
}

export async function commitMoodEntry(
  entry: MoodEntry,
  {
    setMoods,
    rewardUser,
    updateChallengeProgress,
    rewardsEnabled = true,
    persistMoodEntry = persistMoodSourceRecord,
    rewardReason = "Logged mood",
    skipRewardPopup = false,
  }: CommitMoodEntryDeps,
): Promise<void> {
  const stamped = { ...entry, updatedAt: entry.updatedAt || Date.now() };
  await persistMoodEntry(stamped);
  setMoods((prev) => [...prev, stamped]);
  if (rewardsEnabled) {
    rewardUser("mood", {
      treats: 5,
      treatReason: rewardReason,
      haptic: haptics.moodSaved,
      ...(skipRewardPopup ? { skipPopup: true } : {}),
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
  const setMoods = useUserDataStore((s) => s._publishDurableMoods);
  const rewardUser = useGamificationStore((s) => s.rewardUser);

  const reportPersistenceFailure = () => {
    logger.error("[Mood] Durable mood persistence failed");
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("zenflow:storage-error", {
          detail: {
            type: "write_failed",
            message: "Unable to save this mood. Please try again.",
          },
        }),
      );
    }
  };

  const handleAddMood = useThrottledCallback((entry: MoodEntry) => {
    void commitMoodEntry(entry, {
      setMoods,
      rewardUser,
      updateChallengeProgress,
      rewardsEnabled,
    }).catch(reportPersistenceFailure);
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

      void commitMoodEntry(entry, {
        setMoods,
        rewardUser,
        updateChallengeProgress: () => undefined,
        rewardsEnabled,
        rewardReason: "Quick mood",
        skipRewardPopup: true,
      })
        .then(() => logger.log("Quick mood logged from notification"))
        .catch(reportPersistenceFailure);
    },
    [rewardUser, rewardsEnabled, setMoods]
  );

  const handleUpdateMood = useCallback(
    (entryId: string, newMood: MoodEntry["mood"], note?: string) => {
      const current = useUserDataStore.getState().moods.find((entry) => entry.id === entryId);
      if (!current) return;
      const updatedEntry: MoodEntry = {
        ...current,
        mood: newMood,
        note: note ?? current.note,
        updatedAt: Date.now(),
      };
      void persistMoodSourceRecord(updatedEntry)
        .then(() => {
          setMoods((previous) =>
            previous.map((entry) => (entry.id === entryId ? updatedEntry : entry)),
          );
          triggerSync();
          void syncMood(updatedEntry).catch(() =>
            logger.warn("[Mood] Update granular sync failed"),
          );
        })
        .catch(reportPersistenceFailure);
    },
    [setMoods]
  );

  return { handleAddMood, handleQuickMood, handleUpdateMood };
}
