import { useEffect, useRef } from 'react';
import { useGamificationStore } from './gamificationStore';

export interface GamificationHookRefs {
  awardXp: (activity: string) => void;
  earnTreats: (source: string, amount: number, reason?: string) => { earned: number };
  plantSeed: (activity: string, extra?: string) => unknown;
  waterPlants: (activity: string) => void;
}

/**
 * Bridge hook: registers React hook functions into the Zustand gamification store.
 * Must be called once in a component that already uses useGamification + useInnerWorld.
 * Uses a ref to always delegate to the latest hook versions (avoids stale closures).
 */
export function useHydrateGamification(hooks: GamificationHookRefs): void {
  const ref = useRef(hooks);
  ref.current = hooks;

  useEffect(() => {
    useGamificationStore.getState()._registerHooks({
      awardXp: (activity) => ref.current.awardXp(activity),
      earnTreats: (source, amount, reason) => ref.current.earnTreats(source, amount, reason),
      plantSeed: (activity, extra) => ref.current.plantSeed(activity, extra),
      waterPlants: (activity) => ref.current.waterPlants(activity),
    });
  }, []);
}
