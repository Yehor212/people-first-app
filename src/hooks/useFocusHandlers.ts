import { useCallback, useEffect, useRef } from "react";
import { useGamificationStore, useUIStore, useUserDataStore } from "@/stores";
import { triggerXpPopup } from "@/components/XpPopup";
import { haptics } from "@/lib/haptics";
import { offlineQueue } from "@/lib/offlineQueue";
import { updateAllQuestsProgress } from "@/lib/randomQuests";
import { logger } from "@/lib/logger";
import { analytics } from "@/lib/analytics";
import { playSound } from "@/lib/audioManager";
import { reportDurablePersistenceFailure } from "@/lib/durablePersistenceFailure";
import { persistFocusSourceRecord } from "@/features/automation";
import {
  assertAccountSessionTransitionGeneration,
  assertOriginAccountBoundaryGeneration,
  captureAccountSessionTransitionGeneration,
} from "@/storage/accountBoundaryRuntime";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FocusSession, TreatSource } from "@/types";
import type { FocusCommitBoundary } from "@/types/focusTimerTypes";

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
  setFocusSessions: ReturnType<typeof useUserDataStore.getState>["_publishDurableFocusSessions"];
  rewardUser: ReturnType<typeof useGamificationStore.getState>["rewardUser"];
  earnTreats: UseFocusHandlersParams["earnTreats"];
  updateChallengeProgress: () => void;
  checkForFeatureUnlocks: () => void;
  rewardsEnabled?: boolean;
  persistFocusSession?: typeof persistFocusSourceRecord;
  assertAccountBoundaryGeneration?: typeof assertOriginAccountBoundaryGeneration;
}

function focusSessionMatches(left: FocusSession, right: FocusSession): boolean {
  return (
    left.id === right.id &&
    left.duration === right.duration &&
    left.completedAt === right.completedAt &&
    left.date === right.date &&
    left.label === right.label &&
    left.status === right.status &&
    left.reflection === right.reflection &&
    left.updatedAt === right.updatedAt
  );
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
    assertAccountBoundaryGeneration = assertOriginAccountBoundaryGeneration,
  }: CommitFocusSessionDeps,
  expectedBoundary?: FocusCommitBoundary
): Promise<{ session: FocusSession; primaryInserted: boolean }> {
  const sessionGeneration = captureAccountSessionTransitionGeneration();
  const stamped = { ...session, updatedAt: session.updatedAt || Date.now() };
  if (expectedBoundary) {
    assertAccountBoundaryGeneration(expectedBoundary.accountBoundaryGeneration);
  }
  const persisted = await persistFocusSession(stamped, expectedBoundary);
  assertAccountBoundaryGeneration(persisted.accountBoundaryGeneration);
  if (expectedBoundary) {
    assertAccountBoundaryGeneration(expectedBoundary.accountBoundaryGeneration);
  }
  assertAccountSessionTransitionGeneration(sessionGeneration);
  if (persisted.syncOutboxPersisted) {
    try {
      await offlineQueue.wakeFromDurableStorage();
    } catch {
      logger.warn("[Focus] Durable sync wake deferred");
    }
  }
  assertAccountBoundaryGeneration(persisted.accountBoundaryGeneration);
  if (expectedBoundary) {
    assertAccountBoundaryGeneration(expectedBoundary.accountBoundaryGeneration);
  }
  assertAccountSessionTransitionGeneration(sessionGeneration);
  let publicationObserved = false;
  let duplicatePublication = false;
  setFocusSessions((previous) => {
    publicationObserved = true;
    const existingIndex = previous.findIndex((candidate) => candidate.id === stamped.id);
    if (existingIndex >= 0) {
      if (focusSessionMatches(previous[existingIndex], stamped)) {
        duplicatePublication = true;
        return previous;
      }
      const next = [...previous];
      next[existingIndex] = stamped;
      return next;
    }
    return [...previous, stamped];
  });
  if (!persisted.primaryInserted || (publicationObserved && duplicatePublication)) {
    return { session: stamped, primaryInserted: false };
  }

  // Aborted sessions remain durable and syncable, but they are not a
  // completion and must not emit rewards, analytics, quests, or UI ceremony.
  if (stamped.status === "aborted") {
    return { session: stamped, primaryInserted: true };
  }

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

  return { session: stamped, primaryInserted: true };
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
  const { t } = useLanguage();
  const setFocusSessions = useUserDataStore((s) => s._publishDurableFocusSessions);
  const rewardUser = useGamificationStore((s) => s.rewardUser);
  const mindfulTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportPersistenceFailure = useCallback(
    (error: unknown) => {
      reportDurablePersistenceFailure(error, {
        domain: "Focus",
        localizedMessage: t.storageErrorDesc,
      });
    },
    [t.storageErrorDesc]
  );

  // Guarantee cleanup of mindful timeout on unmount
  useEffect(() => {
    return () => {
      if (mindfulTimeoutRef.current) clearTimeout(mindfulTimeoutRef.current);
    };
  }, []);

  const handleCompleteFocusSession = useCallback(
    async (session: FocusSession, boundary?: FocusCommitBoundary): Promise<void> => {
      try {
        const committed = await commitFocusSession(
          session,
          {
            setFocusSessions,
            rewardUser,
            earnTreats,
            updateChallengeProgress,
            checkForFeatureUnlocks,
            rewardsEnabled,
          },
          boundary
        );
        if (
          committed.primaryInserted &&
          committed.session.status !== "aborted" &&
          committed.session.duration >= 5
        ) {
          mindfulTimeoutRef.current = setTimeout(() => {
            useUIStore.getState().openModal("showMindfulMoment");
          }, 500);
        }
      } catch (error) {
        reportPersistenceFailure(error);
        throw error;
      }
    },
    [
      checkForFeatureUnlocks,
      earnTreats,
      reportPersistenceFailure,
      rewardUser,
      rewardsEnabled,
      setFocusSessions,
      updateChallengeProgress,
    ]
  );

  const handleMindfulMomentComplete = useCallback(() => {
    if (!rewardsEnabled) return;
    const treatResult = earnTreats("mindful", 1, "Mindful Moment");
    triggerXpPopup(treatResult.earned, "mindful");
  }, [earnTreats, rewardsEnabled]);

  return { handleCompleteFocusSession, handleMindfulMomentComplete, mindfulTimeoutRef };
}
