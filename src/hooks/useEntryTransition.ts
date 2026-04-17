import { useState, useRef, useCallback } from "react";
import { morph, withTransitionName } from "@/lib/motion/morph";

export type TransitionState = "idle" | "morphing-forward" | "settled" | "morphing-reverse";

/**
 * Returns true when the browser supports the View Transitions API
 * (Chromium-based as of 2026-04; Firefox and older Safari still absent).
 *
 * Computed at call time — do NOT cache at module top level because SSR would
 * capture `undefined` and never re-evaluate in the browser.
 */
function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && typeof document.startViewTransition === "function";
}

/**
 * State machine for entry card→editor transitions.
 *
 * Prevents layoutId conflicts during rapid switching. Preserves the original
 * 100ms debounce that handles rapid taps (user mashing the same card).
 *
 * Dual-path design:
 *   1. When VT API is available → `startTransitionVT(id, mutate)` drives the
 *      morph through `document.startViewTransition`. The FSM states are still
 *      updated so `isMorphing` / `transitionEntryId` stay truthful for
 *      any consumer that watches them (e.g. hiding card clones).
 *   2. When VT API is absent → existing FSM flow is unchanged; callers use
 *      `startTransition(id)` and the returned states to drive Framer Motion
 *      `layoutId` sharing.
 *
 * Flow: idle → morphing-forward → settled → morphing-reverse → idle
 * Rapid switch: settled → morphing-forward (skips reverse, redirects)
 */
export function useEntryTransition() {
  const [transitionState, setTransitionState] = useState<TransitionState>("idle");
  const [transitionEntryId, setTransitionEntryId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTransition = useCallback((entryId: string) => {
    // Debounce rapid clicks (100ms)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setTransitionEntryId(entryId);
      setTransitionState("morphing-forward");
    }, 100);
  }, []);

  /**
   * Drive the forward transition through the View Transitions API.
   *
   * @param entryId  - unique id for the tapped entry (used as VT name suffix)
   * @param mutate   - state mutation that actually opens the editor
   *
   * On browsers without VT API the mutation still runs (via transition()'s
   * fallback) and FSM states advance the same way.
   */
  const startTransitionVT = useCallback((entryId: string, mutate: () => void) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setTransitionEntryId(entryId);
      setTransitionState("morphing-forward");
      void morph(`entry-${entryId}`, () => {
        mutate();
      });
    }, 100);
  }, []);

  const completeTransition = useCallback(() => {
    setTransitionState("settled");
  }, []);

  const reverseTransition = useCallback(() => {
    setTransitionState("morphing-reverse");
  }, []);

  const finishReverse = useCallback(() => {
    setTransitionState("idle");
    setTransitionEntryId(null);
  }, []);

  const cancelTransition = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setTransitionState("idle");
    setTransitionEntryId(null);
  }, []);

  return {
    transitionState,
    transitionEntryId,
    startTransition,
    startTransitionVT,
    completeTransition,
    reverseTransition,
    finishReverse,
    cancelTransition,
    isMorphing: transitionState === "morphing-forward" || transitionState === "morphing-reverse",
    /** True when the current browser supports `document.startViewTransition`. */
    supportsVT: supportsViewTransitions(),
    /** React inline-style helper for the card/editor anchor element. */
    withTransitionName,
  };
}
