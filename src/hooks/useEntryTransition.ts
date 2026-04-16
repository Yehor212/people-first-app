import { useState, useRef, useCallback } from "react";

export type TransitionState = "idle" | "morphing-forward" | "settled" | "morphing-reverse";

/**
 * State machine for entry card→editor transitions.
 * Prevents layoutId conflicts during rapid switching.
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
    completeTransition,
    reverseTransition,
    finishReverse,
    cancelTransition,
    isMorphing: transitionState === "morphing-forward" || transitionState === "morphing-reverse",
  };
}
