import { useCallback } from "react";
import { useGamificationStore, useUserDataStore } from "@/stores";
import { getToday, generateUuid } from "@/lib/utils";
import { triggerSync } from "@/storage/cloudSync";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";
import { analytics } from "@/lib/analytics";
import { playSound } from "@/lib/audioManager";
import { reportDurablePersistenceFailure } from "@/lib/durablePersistenceFailure";
import { persistMoodSourceRecord } from "@/features/automation";
import {
  assertAccountSessionTransitionGeneration,
  assertOriginAccountBoundaryGeneration,
  captureAccountSessionTransitionGeneration,
} from "@/storage/accountBoundaryRuntime";
import { useLanguage } from "@/contexts/LanguageContext";
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
  assertAccountBoundaryGeneration?: typeof assertOriginAccountBoundaryGeneration;
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
    assertAccountBoundaryGeneration = assertOriginAccountBoundaryGeneration,
    rewardReason = "Logged mood",
    skipRewardPopup = false,
  }: CommitMoodEntryDeps
): Promise<void> {
  const sessionGeneration = captureAccountSessionTransitionGeneration();
  const stamped = { ...entry, updatedAt: entry.updatedAt || Date.now() };
  const persisted = await persistMoodEntry(stamped);
  assertAccountBoundaryGeneration(persisted.accountBoundaryGeneration);
  assertAccountSessionTransitionGeneration(sessionGeneration);
  let publicationObserved = false;
  let duplicatePublication = false;
  setMoods((prev) => {
    publicationObserved = true;
    if (prev.some((candidate) => candidate.id === stamped.id)) {
      duplicatePublication = true;
      return prev;
    }
    return [...prev, stamped];
  });
  if (publicationObserved && duplicatePublication) return;
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
}

/**
 * Mood entry handlers: add mood, quick mood (notification), update mood.
 */
export function useMoodHandlers({
  updateChallengeProgress,
  rewardsEnabled = true,
}: UseMoodHandlersParams) {
  const { t } = useLanguage();
  const setMoods = useUserDataStore((s) => s._publishDurableMoods);
  const rewardUser = useGamificationStore((s) => s.rewardUser);

  const reportPersistenceFailure = useCallback(
    (error: unknown) => {
      reportDurablePersistenceFailure(error, {
        domain: "Mood",
        localizedMessage: t.storageErrorDesc,
      });
    },
    [t.storageErrorDesc]
  );

  const handleAddMood = useCallback(
    async (entry: MoodEntry): Promise<void> => {
      try {
        await commitMoodEntry(entry, {
          setMoods,
          rewardUser,
          updateChallengeProgress,
          rewardsEnabled,
        });
      } catch (error) {
        reportPersistenceFailure(error);
        throw error;
      }
    },
    [reportPersistenceFailure, rewardUser, rewardsEnabled, setMoods, updateChallengeProgress]
  );

  const handleQuickMood = useCallback(
    (mood: MoodEntry["mood"]) => {
      const today = getToday();
      const entry: MoodEntry = {
        id: generateUuid(),
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
        .then(() => logger.log("[Mood] Quick mood logged from notification"))
        .catch(reportPersistenceFailure);
    },
    [reportPersistenceFailure, rewardUser, rewardsEnabled, setMoods]
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
      const sessionGeneration = captureAccountSessionTransitionGeneration();
      void persistMoodSourceRecord(updatedEntry)
        .then((persisted) => {
          assertOriginAccountBoundaryGeneration(persisted.accountBoundaryGeneration);
          assertAccountSessionTransitionGeneration(sessionGeneration);
          setMoods((previous) =>
            previous.map((entry) => (entry.id === entryId ? updatedEntry : entry))
          );
          triggerSync();
        })
        .catch(reportPersistenceFailure);
    },
    [reportPersistenceFailure, setMoods]
  );

  return { handleAddMood, handleQuickMood, handleUpdateMood };
}
