import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticSelection } from "@/lib/haptics";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import {
  SNAP_STOPS,
  LABEL_KEYS,
  LABEL_FALLBACK,
  clamp,
  nearestStopIndex,
  handleOklch,
  readLastCommit,
  writeLastCommit,
} from "./moodSliderV2Helpers";
import { useMoodSliderKeyboard } from "./useMoodSliderKeyboard";
import { useMoodSliderPointer } from "./useMoodSliderPointer";
import "./MoodSliderV2.css";

/**
 * MoodSliderV2 — Phase 3-A.4c-ii-d-d bespoke continuous mood slider.
 * Replaces the discrete 5-orb MoodOrbPicker. OKLCH gradient track, 36px
 * circular handle with ambient glow, 5 snap-point ghost ticks, live Fraunces
 * italic mood label, and a reset-to-center chip.
 *
 * State (Law 14): `value` prop = committed valence (null = nothing chosen).
 * Internal draft held in a ref + rAF-throttled publisher so the parent can
 * feed `onDraft` into the hero shader uniform at ≤60 Hz without re-renders.
 * `onCommit(v)` fires ONCE on pointerup / Space / Enter with haptic. Snap:
 * release-time draft within ±0.08 of a canonical stop snaps.
 *
 * A11y (Law 9): role=slider, aria-valuemin/max/now/valuetext, live label,
 * 44px touch zone, focus ring, aria-valuenow mirrors LIVE draft so SR users
 * get continuous feedback during drag/keyboard steps. Keyboard: Arrow ±0.1
 * / Shift+Arrow snap / Home+End / Space-Enter commit / Escape reset-to-0.
 *
 * i18n (Law 17): 4 new keys × 8 languages.
 * Perf (Law 8): single `left` write per frame, no layout thrash.
 * Helpers: see `moodSliderV2Helpers.ts`.
 */

export interface MoodSliderV2Props {
  /** Committed valence, or null when nothing chosen yet (handle rests at 0). */
  value: number | null;
  /** Fires during drag + keyboard steps with the live draft valence. rAF-throttled. */
  onDraft?: (valence: number) => void;
  /** Fires ONCE on commit (pointerup / Space / Enter) with final snapped valence. */
  onCommit: (valence: number) => void;
  /** Disables all interaction. */
  disabled?: boolean;
}

export const MoodSliderV2 = memo(function MoodSliderV2({
  value,
  onDraft,
  onCommit,
  disabled = false,
}: MoodSliderV2Props) {
  const { t, isRTL } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const shouldAnimate = useShouldAnimate();

  const groupId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pendingDraftRef = useRef<number | null>(null);
  const draftValueRef = useRef<number>(value ?? 0);
  const pointerIdRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRegionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ariaUpdateRafRef = useRef<number | null>(null);

  // The draft state is only committed to React on bucket crossings — the
  // handle position itself moves via ref mutations to avoid 60 Hz renders.
  const [bucket, setBucket] = useState<number>(() =>
    nearestStopIndex(value ?? 0),
  );
  const [isDragging, setDragging] = useState(false);
  const [announce, setAnnounce] = useState<string>("");
  const [showTooltip, setShowTooltip] = useState(false);
  const [lastCommitted, setLastCommitted] = useState<number | null>(null);
  // aria-valuenow mirrors the LIVE draft (not the committed prop) so screen
  // readers announce continuous feedback during drag. Throttled via rAF to
  // match the publishDraft cadence (~60 Hz). Screen readers batch announces.
  const [ariaValueNow, setAriaValueNow] = useState<number>(
    Number((value ?? 0).toFixed(2)),
  );

  // Load ghost marker from localStorage on mount.
  useEffect(() => {
    const stored = readLastCommit();
    if (stored !== null) setLastCommitted(stored);
  }, []);

  /** Apply the handle position + hue + label to DOM (no React re-render). */
  const applyHandlePosition = useCallback((v: number) => {
    const h = handleRef.current;
    const surface = surfaceRef.current;
    if (!h || !surface) return;
    // Map [-1, 1] → [0, 100]% inside the track.
    const percent = ((v + 1) / 2) * 100;
    // RTL: flip so +1 lives on the left.
    const leftPct = isRTL ? 100 - percent : percent;
    h.style.left = `${leftPct}%`;
    const hue = handleOklch(v);
    h.style.setProperty("--handle-hue", hue);
    surface.style.setProperty("--handle-hue", hue);
  }, [isRTL]);

  // Sync committed `value` prop → internal draft ref when it changes from
  // the outside (parent reset, store hydration).
  useEffect(() => {
    const next = value ?? 0;
    draftValueRef.current = next;
    setBucket(nearestStopIndex(next));
    applyHandlePosition(next);
    setAriaValueNow(Number(next.toFixed(2)));
  }, [value, applyHandlePosition]);

  // Apply handle position on mount (useLayoutEffect so first paint is correct).
  useLayoutEffect(() => {
    applyHandlePosition(draftValueRef.current);
  }, [applyHandlePosition]);

  /** Throttled publisher: coalesces multiple pointermove writes into 1 rAF. */
  const publishDraft = useCallback(
    (v: number) => {
      draftValueRef.current = v;
      applyHandlePosition(v);
      pendingDraftRef.current = v;
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingDraftRef.current;
        pendingDraftRef.current = null;
        if (pending === null) return;
        if (onDraft) onDraft(pending);
        const nextBucket = nearestStopIndex(pending);
        setBucket((prev) => (prev === nextBucket ? prev : nextBucket));
        // Mirror draft to aria-valuenow so screen readers announce live
        // changes (not only the committed value). rAF-gated — same cadence
        // as onDraft.
        setAriaValueNow(Number(pending.toFixed(2)));
      });
    },
    [onDraft, applyHandlePosition],
  );

  // Cleanup on unmount — capture refs into locals so the cleanup closes
  // over stable values (react-hooks/exhaustive-deps).
  useEffect(() => {
    const rafHandle = rafRef;
    const longPressHandle = longPressTimerRef;
    const liveRegionHandle = liveRegionTimerRef;
    const ariaHandle = ariaUpdateRafRef;
    return () => {
      if (rafHandle.current !== null) {
        window.cancelAnimationFrame(rafHandle.current);
        rafHandle.current = null;
      }
      if (longPressHandle.current) {
        clearTimeout(longPressHandle.current);
        longPressHandle.current = null;
      }
      if (liveRegionHandle.current) {
        clearTimeout(liveRegionHandle.current);
        liveRegionHandle.current = null;
      }
      if (ariaHandle.current !== null) {
        window.cancelAnimationFrame(ariaHandle.current);
        ariaHandle.current = null;
      }
    };
  }, []);

  /**
   * Convert clientX → valence in [-1, 1]. Returns `null` on unlaid-out track
   * (zero-width rect, NaN) — callers treat `null` as "ignore this gesture"
   * (Law 5: never propagate silent NaN into store/haptics).
   */
  const clientXToValence = useCallback(
    (clientX: number): number | null => {
      const track = trackRef.current;
      if (!track) return null;
      const rect = track.getBoundingClientRect();
      if (!rect || rect.width <= 0) return null;
      const rawT = (clientX - rect.left) / rect.width;
      if (Number.isNaN(rawT)) return null;
      let t = Math.max(0, Math.min(1, rawT));
      // RTL: invert so leftmost visual = +1.
      if (isRTL) t = 1 - t;
      const valence = clamp(t * 2 - 1);
      return Number.isFinite(valence) ? valence : null;
    },
    [isRTL],
  );

  /** Schedule the aria-live announcement with 250 ms debounce. */
  const queueAnnounce = useCallback((labelKey: string) => {
    if (liveRegionTimerRef.current) {
      clearTimeout(liveRegionTimerRef.current);
    }
    liveRegionTimerRef.current = setTimeout(() => {
      setAnnounce(labelKey);
    }, 250);
  }, []);

  const commit = useCallback(
    (raw: number) => {
      const snapIdx = nearestStopIndex(raw);
      const snapped = Math.abs(raw - SNAP_STOPS[snapIdx]) <= 0.08 ? SNAP_STOPS[snapIdx] : raw;
      draftValueRef.current = snapped;
      applyHandlePosition(snapped);
      setBucket(snapIdx);
      // Synchronous aria update on commit — final value must be announced
      // immediately (not deferred to the next rAF tick).
      setAriaValueNow(Number(snapped.toFixed(2)));
      void hapticSelection();
      writeLastCommit(snapped);
      setLastCommitted(snapped);
      onCommit(snapped);
    },
    [onCommit, applyHandlePosition],
  );

  // ----- Pointer handlers (extracted to useMoodSliderPointer) -----

  const pointerHandlers = useMoodSliderPointer({
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
  });

  // ----- Keyboard handlers -----

  // Keyboard contract extracted to useMoodSliderKeyboard (Law 11 <400 LOC).
  const handleKeyDown = useMoodSliderKeyboard({
    disabled,
    isRTL,
    draftValueRef,
    publishDraft,
    commit,
    queueAnnounce,
  });

  /** Reset handler — used by the "Not sure yet" chip AND the reset-to-center gesture. */
  const handleResetClick = useCallback(() => {
    if (disabled) return;
    publishDraft(0);
    queueAnnounce(LABEL_KEYS[2]);
    // Reset is a visual/draft action only — parent store only updates on commit.
    commit(0);
  }, [disabled, publishDraft, queueAnnounce, commit]);

  // ----- Derived UI -----

  const liveLabelKey = LABEL_KEYS[bucket] ?? LABEL_KEYS[2];
  const liveLabel = tx[liveLabelKey] ?? LABEL_FALLBACK[bucket] ?? "";
  const sliderAriaLabel = tx.moodSliderLabel ?? "Mood slider";
  const resetLabel = tx.moodReset ?? "Not sure yet";
  const tooltipHint = tx.moodSlideHint ?? "Drag to find your mood";
  const announceText = announce ? tx[announce] ?? "" : liveLabel;
  const ariaDisabled = disabled ? "true" : undefined;

  const snapTicks = useMemo(() => {
    return SNAP_STOPS.map((v) => {
      const percent = ((v + 1) / 2) * 100;
      const leftPct = isRTL ? 100 - percent : percent;
      const isLastCommit =
        lastCommitted !== null && Math.abs(lastCommitted - v) < 0.02;
      return { v, leftPct, isLastCommit };
    });
  }, [isRTL, lastCommitted]);

  const handleAnimate =
    shouldAnimate && !isDragging && value === null ? "true" : "false";

  return (
    <fieldset
      className="mood-slider-v2"
      data-testid="mood-slider-v2"
      data-has-selection={value !== null ? "true" : "false"}
      data-dragging={isDragging ? "true" : "false"}
      disabled={disabled}
      aria-labelledby={`${groupId}-legend`}
    >
      <legend
        id={`${groupId}-legend`}
        className="mood-slider-v2-legend"
        data-testid="mood-slider-v2-legend"
      >
        {tx.moodOrbGroupLabel ?? "How do you feel?"}
      </legend>

      <div
        ref={surfaceRef}
        className="mood-slider-v2-surface"
        data-testid="mood-slider-v2-surface"
        data-dragging={isDragging ? "true" : "false"}
        aria-disabled={ariaDisabled}
        onPointerDown={pointerHandlers.onPointerDown}
        onPointerMove={pointerHandlers.onPointerMove}
        onPointerUp={pointerHandlers.onPointerUp}
        onPointerCancel={pointerHandlers.onPointerCancel}
      >
        <div
          ref={trackRef}
          className="mood-slider-v2-track"
          data-testid="mood-slider-v2-track"
          aria-hidden="true"
        />

        {snapTicks.map((tick) => (
          <span
            key={tick.v}
            className="mood-slider-v2-tick"
            style={{ left: `${tick.leftPct}%` }}
            data-testid={`mood-slider-v2-tick-${tick.v}`}
            data-last-commit={tick.isLastCommit ? "true" : "false"}
            aria-hidden="true"
          />
        ))}

        <div
          ref={handleRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          className="mood-slider-v2-handle"
          data-testid="mood-slider-v2-handle"
          data-dragging={isDragging ? "true" : "false"}
          data-animate={handleAnimate}
          aria-valuemin={-1}
          aria-valuemax={1}
          aria-valuenow={ariaValueNow}
          aria-valuetext={liveLabel}
          aria-orientation="horizontal"
          aria-label={sliderAriaLabel}
          onKeyDown={handleKeyDown}
        />

        {showTooltip && (
          <div
            role="tooltip"
            className="sr-only"
            data-testid="mood-slider-v2-tooltip"
          >
            {tooltipHint}
          </div>
        )}
      </div>

      <div className="mood-slider-v2-label-row">
        <p
          className="mood-slider-v2-label"
          data-testid="mood-slider-v2-label"
          data-bucket={bucket}
          aria-live="polite"
        >
          {announceText}
        </p>
        <button
          type="button"
          className="mood-slider-v2-reset"
          data-testid="mood-slider-v2-reset"
          onClick={handleResetClick}
          disabled={disabled}
          aria-label={resetLabel}
        >
          {resetLabel}
        </button>
      </div>
    </fieldset>
  );
});
