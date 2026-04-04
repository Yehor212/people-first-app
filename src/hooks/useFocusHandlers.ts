import { useCallback, useEffect, useRef } from 'react';
import { useGamificationStore, useUIStore, useUserDataStore } from '@/stores';
import { triggerXpPopup } from '@/components/XpPopup';
import { haptics } from '@/lib/haptics';
import { queueFocusSessionSync } from '@/lib/offlineQueueHandlers';
import { updateAllQuestsProgress } from '@/lib/randomQuests';
import { logger } from '@/lib/logger';
import { analytics } from '@/lib/analytics';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import type { FocusSession } from '@/types';

interface UseFocusHandlersParams {
  earnTreats: (source: string, amount: number, reason?: string) => { earned: number };
  updateChallengeProgress: () => void;
  checkForFeatureUnlocks: () => void;
}

/**
 * Focus session handlers: complete session, mindful moment.
 * Owns mindfulTimeoutRef internally.
 */
export function useFocusHandlers({
  earnTreats,
  updateChallengeProgress,
  checkForFeatureUnlocks,
}: UseFocusHandlersParams) {
  const setFocusSessions = useUserDataStore(s => s.setFocusSessions);
  const rewardUser = useGamificationStore(s => s.rewardUser);
  const mindfulTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Guarantee cleanup of mindful timeout on unmount
  useEffect(() => {
    return () => {
      if (mindfulTimeoutRef.current) clearTimeout(mindfulTimeoutRef.current);
    };
  }, []);

  const handleCompleteFocusSession = useThrottledCallback((session: FocusSession) => {
    const stamped = { ...session, updatedAt: session.updatedAt || Date.now() };
    setFocusSessions(prev => [...prev, stamped]);

    const focusTreats = Math.round(session.duration * 0.5);
    rewardUser('focus', { treats: focusTreats, treatReason: `Focus ${session.duration}min`, haptic: haptics.focusCompleted });
    analytics.focusSessionCompleted(session.duration);

    queueFocusSessionSync(session).catch((err) => {
      logger.warn('[Index] Failed to queue focus session sync:', err);
    });

    // Show MindfulMoment after focus session (only for sessions > 5 min)
    if (session.duration >= 5) {
      mindfulTimeoutRef.current = setTimeout(() => {
        useUIStore.getState().openModal('showMindfulMoment');
      }, 500);
    }

    updateChallengeProgress();
    checkForFeatureUnlocks();

    const completedQuests = updateAllQuestsProgress({ type: 'focus_completed', value: session.duration });
    completedQuests.forEach(quest => {
      const xpReward = quest.reward.xp;
      earnTreats('focus', xpReward, `Quest: ${quest.title}`);
      triggerXpPopup(xpReward, 'bonus');
    });
  }, 800);

  const handleMindfulMomentComplete = useCallback(() => {
    const treatResult = earnTreats('mindful', 1, 'Mindful Moment');
    triggerXpPopup(treatResult.earned, 'mindful');
  }, [earnTreats]);

  return { handleCompleteFocusSession, handleMindfulMomentComplete, mindfulTimeoutRef };
}
