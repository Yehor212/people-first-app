import { useCallback, useEffect, useRef } from "react";
import { useGamificationStore, useUIStore, useUserDataStore } from "@/stores";
import { triggerXpPopup } from "@/components/XpPopup";
import { haptics } from "@/lib/haptics";
import { queueFocusSessionSync } from "@/lib/offlineQueueHandlers";
import { triggerSync } from "@/storage/cloudSync";
import { updateAllQuestsProgress } from "@/lib/randomQuests";
import { logger } from "@/lib/logger";
import { analytics } from "@/lib/analytics";
import { playSound } from "@/lib/audioManager";
import { useThrottledCallback } from "@/hooks/useThrottledCallback";
import { persistFocusSourceRecord } from "@/features/automation";
import type { FocusSession, TreatSource } from "@/types";

interface UseFocusHandlersParams {
  earnTreats: (
    source: TreatSource,
    baseAmount: number,
    description?: string
  ) => { earned: number; bonus: number; multiplier: number; newBalance: number };
  updateChallengeProgress: () => void;
  checkForFeatureUnlocks: () => void;
  rewardsEnabled?: boolean;
}

interface CommitFocusSessionDeps {
  setFocusSessions: ReturnType<
    typeof useUserDataStore.getState
  >["_publishDurableFocusSessions"];
  rewardUser: ReturnType<typeof useGamificationStore.getState>["rewardUser"];
  earnTreats: UseFocusHandlersParams["earnTreats"];
  updateChallengeProgress: () => void;
  checkForFeatureUnlocks: () => void;
  rewardsEnabled?: boolean;
  persistFocusSession?: typeof persistFocusSourceRecord;
}

/**
 * Commits the primary focus record and its optional prose-free automation
 * source intent before publishing success, rewards, analytics, or sync work.
 */
export async function commitFocusSession(
  session: FocusSession,
  {
    setFocusSessions,
    rewardUser,
    earnTreats,
    updateChallengeProgress,
    checkForFeatureUnlocks,
    rewardsEnabled = true,
    persistFocusSession = persistFocusSourceRecord,
  }: CommitFocusSessionDeps,
): Promise<FocusSession> {
  const stamped = { ...session, updatedAt: session.updatedAt || Date.now() };
  await persistFocusSession(stamped);
  setFocusSessions((previous) => [...previous, stamped]);

  const focusTreats = Math.round(stamped.duration * 0.5);
  if (rewardsEnabled) {
    rewardUser("focus", {
      treats: focusTreats,
      treatReason: `Focus ${stamped.duration}min`,
      haptic: haptics.focusCompleted,
    });
  } else {
    playSound("complete");
  }
  analytics.focusSessionCompleted(stamped.duration);

  void queueFocusSessionSync(stamped).catch(() => {
    logger.warn("[Focus] Failed to queue durable focus session sync");
  });
  triggerSync();

  updateChallengeProgress();
  checkForFeatureUnlocks();

  const completedQuests = updateAllQuestsProgress({
    type: "focus_completed",
    value: stamped.duration,
  });
  if (rewardsEnabled) {
    completedQuests.forEach((quest) => {
      const xpReward = quest.reward.xp;
      earnTreats("focus", xpReward, `Quest: ${quest.title}`);
      triggerXpPopup(xpReward, "bonus");
    });
  }

  return stamped;
}

/**
 * Focus session handlers: complete session, mindful moment.
 * Owns mindfulTimeoutRef internally.
 */
export function useFocusHandlers({
  earnTreats,
  updateChallengeProgress,
  checkForFeatureUnlocks,
  rewardsEnabled = true,
}: UseFocusHandlersParams) {
  const setFocusSessions = useUserDataStore((s) => s._publishDurableFocusSessions);
  const rewardUser = useGamificationStore((s) => s.rewardUser);
  const mindfulTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportPersistenceFailure = () => {
    logger.error("[Focus] Durable focus persistence failed");
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("zenflow:storage-error", {
          detail: {
            type: "write_failed",
            message: "Unable to save this focus session. Please try again.",
          },
        }),
      );
    }
  };

  // Guarantee cleanup of mindful timeout on unmount
  useEffect(() => {
    return () => {
      if (mindfulTimeoutRef.current) clearTimeout(mindfulTimeoutRef.current);
    };
  }, []);

  const handleCompleteFocusSession = useThrottledCallback((session: FocusSession) => {
    void commitFocusSession(session, {
      setFocusSessions,
      rewardUser,
      earnTreats,
      updateChallengeProgress,
      checkForFeatureUnlocks,
      rewardsEnabled,
    })
      .then((committedSession) => {
        if (committedSession.duration >= 5) {
          mindfulTimeoutRef.current = setTimeout(() => {
            useUIStore.getState().openModal("showMindfulMoment");
          }, 500);
        }
      })
      .catch(reportPersistenceFailure);
  }, 800);

  const handleMindfulMomentComplete = useCallback(() => {
    if (!rewardsEnabled) return;
    const treatResult = earnTreats("mindful", 1, "Mindful Moment");
    triggerXpPopup(treatResult.earned, "mindful");
  }, [earnTreats, rewardsEnabled]);

  return { handleCompleteFocusSession, handleMindfulMomentComplete, mindfulTimeoutRef };
}
