import type { CSSProperties } from "react";
import { shouldAnimate } from "@/lib/animationUtils";

/**
 * Wraps `document.startViewTransition` with graceful fallback.
 *
 * Legacy entry-point — callers that pre-date Phase 0-D use this shape.
 * On browsers without the View Transitions API, the callback is invoked
 * directly so the DOM mutation still happens.
 *
 * New code should prefer `transition()` which honours reduced-motion +
 * battery + Dopamine gating.
 */
export function startViewTransition(callback: () => void): void {
  if (typeof document === "undefined") {
    callback();
    return;
  }
  if (typeof document.startViewTransition === "function") {
    document.startViewTransition(callback);
  } else {
    callback();
  }
}

function isStandaloneAppDisplayMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const iosNavigator = window.navigator as Navigator & { standalone?: boolean };
  if (iosNavigator.standalone === true) {
    return true;
  }

  if (typeof window.matchMedia !== "function") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

export interface TransitionOptions {
  /**
   * Optional `view-transition-name` applied to the root element for the
   * duration of the transition. Use this for full-page shared-element
   * continuity (e.g. mood-picker → detail sheet).
   */
  name?: string;
  /**
   * Force the transition to be skipped even if all other conditions allow it.
   * Useful when the caller already knows the mutation should be immediate.
   */
  skip?: boolean;
}

/**
 * Motion-grammar entry-point for View Transitions.
 *
 * Runs `fn` wrapped in `document.startViewTransition` when every condition
 * allows it. Otherwise runs `fn` directly so state always reaches the DOM.
 *
 * Skip conditions (any ONE triggers a direct call):
 *   - `options.skip === true`
 *   - `document.startViewTransition` is not a function (Firefox, older Safari)
 *   - installed app display mode is standalone/fullscreen (PWA shell input stability)
 *   - `shouldAnimate()` returns false (Dopamine off, OS reduced-motion, low battery)
 *
 * When `options.name` is provided, `view-transition-name` is set on
 * `documentElement` for the transition and removed afterwards (success or fail).
 */
export async function transition(
  fn: () => void | Promise<void>,
  options: TransitionOptions = {},
): Promise<void> {
  const { name, skip } = options;

  const apiAvailable =
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function";

  // Installed PWA shells can freeze while Chrome captures a View Transition
  // snapshot over a route-level lazy render. Prefer immediate navigation there.
  if (skip || !apiAvailable || isStandaloneAppDisplayMode() || !shouldAnimate()) {
    await fn();
    return;
  }

  const previousName = name
    ? document.documentElement.style.getPropertyValue("view-transition-name")
    : "";

  if (name) {
    document.documentElement.style.setProperty("view-transition-name", name);
  }

  const vt = document.startViewTransition!(async () => {
    await fn();
  });

  try {
    await vt.finished;
  } finally {
    if (name) {
      if (previousName) {
        document.documentElement.style.setProperty("view-transition-name", previousName);
      } else {
        document.documentElement.style.removeProperty("view-transition-name");
      }
    }
  }
}

/**
 * React-style helper for tagging an element with a `view-transition-name`.
 * Use this on the element you want paired across the transition:
 *
 *   <div style={withTransitionName("mood-orb")} />
 *
 * Returns a plain CSSProperties object so it composes with other inline
 * styles via spread.
 */
export function withTransitionName(name: string): CSSProperties {
  return { viewTransitionName: name };
}
