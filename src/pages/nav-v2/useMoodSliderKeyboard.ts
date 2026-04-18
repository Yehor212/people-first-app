import { useCallback } from "react";
import type React from "react";
import {
  SNAP_STOPS,
  LABEL_KEYS,
  clamp,
  nearestStopIndex,
} from "./moodSliderV2Helpers";

/**
 * useMoodSliderKeyboard — Phase 3-A.4c-ii-d-d.
 *
 * Extracted from MoodSliderV2 to keep the view file under the 400-LOC
 * god-component threshold. Owns the keyboard vocabulary contract:
 *
 *   - Arrow Left/Right: ±0.1 draft (no haptic)
 *   - Shift + Arrow:    snap to prev/next canonical stop
 *   - Home / End:       jump to extremes (-1 / +1, flipped in RTL)
 *   - Space / Enter:    commit current draft (parent fires haptic)
 *   - Escape:           reset draft to 0 (visual only, no commit)
 *
 * RTL flip: in ar/he the arrow semantics invert so the perceived left/right
 * motion matches the gradient direction (very_pleasant on the left).
 *
 * Side-effectful deps are injected — this hook does no DOM reads or writes
 * of its own.
 */
export interface UseMoodSliderKeyboardArgs {
  disabled: boolean;
  isRTL: boolean;
  /** Source of truth for the current draft valence (ref.current). */
  draftValueRef: React.RefObject<number>;
  /** Publishes a new draft value to parent + UI. */
  publishDraft: (v: number) => void;
  /** Commits the current draft (haptic + store). */
  commit: (v: number) => void;
  /** Debounced aria-live announcement. */
  queueAnnounce: (labelKey: string) => void;
}

export function useMoodSliderKeyboard(args: UseMoodSliderKeyboardArgs) {
  const { disabled, isRTL, draftValueRef, publishDraft, commit, queueAnnounce } =
    args;

  return useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      // RTL: arrow semantics flip (Right = decrease when RTL).
      const sign = isRTL ? -1 : 1;
      const current = draftValueRef.current ?? 0;
      let nextVal: number | null = null;
      let shouldCommit = false;
      let shouldReset = false;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp": {
          if (e.shiftKey) {
            const idx = nearestStopIndex(current);
            const nextIdx = Math.min(SNAP_STOPS.length - 1, idx + sign);
            nextVal = SNAP_STOPS[nextIdx];
          } else {
            nextVal = clamp(current + 0.1 * sign);
          }
          break;
        }
        case "ArrowLeft":
        case "ArrowDown": {
          if (e.shiftKey) {
            const idx = nearestStopIndex(current);
            const nextIdx = Math.max(0, idx - sign);
            nextVal = SNAP_STOPS[nextIdx];
          } else {
            nextVal = clamp(current - 0.1 * sign);
          }
          break;
        }
        case "Home":
          nextVal = isRTL ? 1 : -1;
          break;
        case "End":
          nextVal = isRTL ? -1 : 1;
          break;
        case " ":
        case "Enter":
          shouldCommit = true;
          break;
        case "Escape":
          shouldReset = true;
          break;
        default:
          return;
      }
      e.preventDefault();

      if (shouldReset) {
        publishDraft(0);
        queueAnnounce(LABEL_KEYS[2]);
        return;
      }
      if (shouldCommit) {
        commit(current);
        return;
      }
      if (nextVal !== null) {
        publishDraft(nextVal);
        queueAnnounce(LABEL_KEYS[nearestStopIndex(nextVal)]);
      }
    },
    [disabled, isRTL, draftValueRef, publishDraft, commit, queueAnnounce],
  );
}
