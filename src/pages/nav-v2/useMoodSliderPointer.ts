import { useCallback } from "react";
import type React from "react";

/**
 * useMoodSliderPointer — Phase 3-A.4c-ii-d-d.
 *
 * Owns the 4 PointerEvent handlers (down/move/up/cancel) for MoodSliderV2.
 * Extracted so the view file stays under the 400-LOC god-component threshold
 * (Law 11 — Scope Holism).
 *
 * Gesture contract:
 *   - Down: start drag, seed draft at finger position, install a 600ms
 *     long-press timer for the "Drag to find your mood" tooltip.
 *   - Move: while captured, re-publish draft every rAF tick (throttled by
 *     the publishDraft pipeline); cancel the long-press on any movement.
 *   - Up: release capture, commit the current draft (snaps + haptic).
 *   - Cancel: release capture without committing (abandoned gesture).
 *
 * Pointer capture calls are wrapped in try/catch — some jsdom builds + in-
 * app WebViews throw on setPointerCapture / releasePointerCapture. Failure
 * here is non-fatal (cursor semantics still work without capture).
 */
export interface UseMoodSliderPointerArgs {
  disabled: boolean;
  isDragging: boolean;
  showTooltip: boolean;
  pointerIdRef: React.MutableRefObject<number | null>;
  longPressTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  draftValueRef: React.RefObject<number>;
  handleRef: React.RefObject<HTMLDivElement | null>;
  clientXToValence: (clientX: number) => number | null;
  publishDraft: (v: number) => void;
  commit: (v: number) => void;
  setDragging: (v: boolean) => void;
  setShowTooltip: (v: boolean) => void;
}

export interface MoodSliderPointerHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function useMoodSliderPointer(
  args: UseMoodSliderPointerArgs,
): MoodSliderPointerHandlers {
  const {
    disabled,
    isDragging,
    showTooltip,
    pointerIdRef,
    longPressTimerRef,
    draftValueRef,
    handleRef,
    clientXToValence,
    publishDraft,
    commit,
    setDragging,
    setShowTooltip,
  } = args;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      // Only primary button (0) or touch/pen pointers.
      if (e.button !== 0 && e.button !== -1 && e.pointerType === "mouse")
        return;
      const next = clientXToValence(e.clientX);
      if (next === null) return; // track not laid out yet — ignore gesture
      publishDraft(next);
      setDragging(true);
      pointerIdRef.current = e.pointerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw on some engines; safe to ignore
      }
      // Long-press tooltip: fire after 600 ms if pointer stays put.
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        setShowTooltip(true);
      }, 600);
      // Ensure focus for keyboard follow-up.
      handleRef.current?.focus();
    },
    [
      disabled,
      clientXToValence,
      publishDraft,
      setDragging,
      pointerIdRef,
      longPressTimerRef,
      handleRef,
      setShowTooltip,
    ],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || pointerIdRef.current !== e.pointerId) return;
      // User is moving — dismiss long-press tooltip intent.
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (showTooltip) setShowTooltip(false);
      const next = clientXToValence(e.clientX);
      if (next === null) return;
      publishDraft(next);
    },
    [
      isDragging,
      publishDraft,
      clientXToValence,
      showTooltip,
      pointerIdRef,
      longPressTimerRef,
      setShowTooltip,
    ],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== e.pointerId) return;
      pointerIdRef.current = null;
      setDragging(false);
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // release can throw if capture was lost; safe to ignore
      }
      commit(draftValueRef.current ?? 0);
    },
    [commit, draftValueRef, pointerIdRef, longPressTimerRef, setDragging],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== e.pointerId) return;
      pointerIdRef.current = null;
      setDragging(false);
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // No commit on cancel — treat as abandoned gesture.
    },
    [pointerIdRef, longPressTimerRef, setDragging],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
