/**
 * useRestMode - Rest mode management hook
 * Handles rest day activation/deactivation with a cooldown system
 * (max 1 rest day per 7 days).
 *
 * Extracted from useInnerWorld.ts to keep each module under 400 LOC.
 */

import { useMemo, useCallback } from 'react';
import { InnerWorld } from '@/types';
import { getToday } from '@/lib/utils';

const REST_COOLDOWN_DAYS = 7; // 1 rest day allowed per 7 days

export function useRestMode(
  restDays: string[] | undefined,
  setWorld: (fn: (prev: InnerWorld) => InnerWorld) => void
) {
  const today = getToday();

  // Check if today is a rest day
  const isRestMode = useMemo(() => {
    return (restDays || []).includes(today);
  }, [restDays, today]);

  // Calculate rest mode availability
  const restModeStatus = useMemo(() => {
    const days = restDays || [];
    const todayDate = new Date(today);

    // Find rest days in the last 7 days (excluding today)
    const recentRestDays = days.filter(d => {
      if (d === today) return false;
      const dayDate = new Date(d);
      const diffMs = todayDate.getTime() - dayDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays < REST_COOLDOWN_DAYS;
    });

    const canActivate = recentRestDays.length === 0;

    // Calculate days until rest is available again
    let daysUntilAvailable = 0;
    if (!canActivate && recentRestDays.length > 0) {
      const mostRecentRest = recentRestDays.sort().reverse()[0];
      const restDate = new Date(mostRecentRest);
      const availableDate = new Date(restDate.getTime() + REST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      daysUntilAvailable = Math.ceil((availableDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      canActivate,
      daysUntilAvailable,
      usedThisWeek: recentRestDays.length,
    };
  }, [restDays, today]);

  // Activate rest mode for today - preserves streak
  const activateRestMode = useCallback(() => {
    const days = restDays || [];
    if (days.includes(today)) return { success: false, reason: 'already_resting' };
    if (!restModeStatus.canActivate) return { success: false, reason: 'cooldown', daysUntilAvailable: restModeStatus.daysUntilAvailable };

    // Update lastActiveDate to today to prevent streak from breaking
    setWorld(prev => ({
      ...prev,
      restDays: [...(prev.restDays || []), today],
      lastActiveDate: today, // Important: mark today as "active" to preserve streak
    }));

    return { success: true };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: restDays read is guarded by restModeStatus
  }, [setWorld, today, restModeStatus]);

  // Deactivate rest mode for today
  const deactivateRestMode = useCallback(() => {
    setWorld(prev => ({
      ...prev,
      restDays: (prev.restDays || []).filter(d => d !== today),
    }));
  }, [setWorld, today]);

  return {
    isRestMode,
    restModeStatus,
    activateRestMode,
    deactivateRestMode,
  };
}
