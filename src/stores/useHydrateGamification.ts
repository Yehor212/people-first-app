import { useEffect, useRef } from "react";
import { triggerXpPopup } from "@/components/XpPopup";
import { triggerSync } from "@/storage/cloudSync";
import { useGamificationStore } from "./gamificationStore";

export interface GamificationHookRefs {
  awardXp: (activity: string) => void;
  earnTreats: (
    source: string,
    amount: number,
    reason?: string,
  ) => { earned: number };
  plantSeed: (activity: string, extra?: string) => unknown;
  waterPlants: (activity: string) => void;
}

/**
 * Bridge hook: registers React hook functions into the Zustand gamification store.
 * Must be called once in a component that already uses useGamification + useInnerWorld.
 * Uses a ref to always delegate to the latest hook versions (avoids stale closures).
 *
 * showPopup + sync are registered here instead of directly imported in the store,
 * fixing inverted dependency (C2: store→component) and storage coupling (C3: store→storage).
 */
export function useHydrateGamification(hooks: GamificationHookRefs): void {
  const ref = useRef(hooks);
  ref.current = hooks;

  useEffect(() => {
    useGamificationStore.getState()._registerHooks({
      awardXp: (activity) => ref.current.awardXp(activity),
      earnTreats: (source, amount, reason) =>
        ref.current.earnTreats(source, amount, reason),
      plantSeed: (activity, extra) => ref.current.plantSeed(activity, extra),
      waterPlants: (activity) => ref.current.waterPlants(activity),
      showPopup: (amount, type) => triggerXpPopup(amount, type),
      sync: () => triggerSync(),
    });
  }, []);
}
