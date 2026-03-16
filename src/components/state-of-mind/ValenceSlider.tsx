import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { zenMotion } from '@/lib/animationUtils';
import { haptics } from '@/lib/haptics';
import { VALENCE_GRADIENT, valenceToColor } from './colorUtils';
import type { Translations } from '@/i18n/types';

interface ValenceSliderProps {
  value: number;
  onChange: (value: number) => void;
}

const TRACK_HEIGHT = 8;
const THUMB_SIZE = 28;
const TOUCH_PADDING = 10; // Extra padding for 44px+ touch target

/** 7 discrete snap positions matching Apple Health */
const SNAP_POSITIONS = [-1.0, -0.667, -0.333, 0.0, 0.333, 0.667, 1.0] as const;

/** Map snap index to i18n key */
const SNAP_LABELS: (keyof Translations)[] = [
  'somVeryUnpleasant',
  'somUnpleasant',
  'somSlightlyUnpleasant',
  'somNeutral',
  'somSlightlyPleasant',
  'somPleasant',
  'somVeryPleasant',
];

/** Find the nearest snap position index */
function nearestSnapIndex(v: number): number {
  let best = 0;
  let bestDist = Math.abs(v - SNAP_POSITIONS[0]);
  for (let i = 1; i < SNAP_POSITIONS.length; i++) {
    const dist = Math.abs(v - SNAP_POSITIONS[i]);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/**
 * Custom valence slider with 7 discrete snap positions.
 * Pointer events for cross-platform (mouse + touch + pen).
 * GPU-only: thumb positioned via CSS left (layout-only, no reflow during animation).
 *
 * Law 9 (a11y): role="slider", aria-valuemin/max/now/text, keyboard support.
 * Law 10 (Cross-Platform): pointer events, touch-none, setPointerCapture.
 */
export function ValenceSlider({ value, onChange }: ValenceSliderProps) {
  const { t } = useLanguage();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPressed, setIsPressed] = useState(false);
  const prevSnapRef = useRef(nearestSnapIndex(value));

  // Haptic feedback when crossing snap position thresholds during drag
  useEffect(() => {
    const currentSnap = nearestSnapIndex(value);
    if (currentSnap !== prevSnapRef.current) {
      prevSnapRef.current = currentSnap;
      // Stronger haptic at extreme endpoints
      if (currentSnap === 0 || currentSnap === SNAP_POSITIONS.length - 1) {
        void haptics.medium();
      } else {
        void haptics.light();
      }
    }
  }, [value]);

  const getValenceFromEvent = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    // Map 0-1 → -1.0 to 1.0, snap to 0.001 precision
    return Math.round((ratio * 2 - 1) * 1000) / 1000;
  }, []);

  /** Snap to nearest position */
  const snapToNearest = useCallback((v: number) => {
    const idx = nearestSnapIndex(v);
    return SNAP_POSITIONS[idx];
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPressed(true);
    onChange(getValenceFromEvent(e.clientX));
  }, [getValenceFromEvent, onChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    onChange(getValenceFromEvent(e.clientX));
  }, [getValenceFromEvent, onChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsPressed(false);
    // Snap to nearest discrete position on release
    const track = trackRef.current;
    if (track) {
      const rect = track.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const freeValue = Math.round((ratio * 2 - 1) * 1000) / 1000;
      onChange(snapToNearest(freeValue));
    }
  }, [onChange, snapToNearest]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentIdx = nearestSnapIndex(value);
    let newIdx = currentIdx;

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      newIdx = Math.min(SNAP_POSITIONS.length - 1, currentIdx + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      newIdx = Math.max(0, currentIdx - 1);
    } else if (e.key === 'Home') {
      newIdx = 0;
    } else if (e.key === 'End') {
      newIdx = SNAP_POSITIONS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    onChange(SNAP_POSITIONS[newIdx]);
  }, [value, onChange]);

  // Thumb position as percentage (0-100)
  const thumbPercent = ((value + 1) / 2) * 100;

  // Label: show nearest snap position's label
  const snapIdx = nearestSnapIndex(value);
  const valenceLabel = t[SNAP_LABELS[snapIdx]] as string;

  return (
    <div className="w-full px-2">
      {/* Valence label — aria-live for screen readers, color synced with valence */}
      <div className="text-center mb-4" aria-live="polite" aria-atomic="true">
        <span
          className="text-lg font-semibold som-label-enter"
          key={valenceLabel}
          style={{ color: valenceToColor(value), transition: 'color 200ms ease-out' }}
        >
          {valenceLabel}
        </span>
      </div>

      {/* Slider track */}
      <div
        ref={trackRef}
        className="relative flex items-center touch-none select-none cursor-pointer"
        style={{ height: THUMB_SIZE + TOUCH_PADDING * 2, padding: `${TOUCH_PADDING}px ${THUMB_SIZE / 2}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="slider"
        aria-label={t.somSlider}
        aria-valuemin={0}
        aria-valuemax={6}
        aria-valuenow={snapIdx}
        aria-valuetext={valenceLabel}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Track background (gradient) */}
        <div
          className="absolute rounded-full"
          style={{
            height: TRACK_HEIGHT,
            left: THUMB_SIZE / 2,
            right: THUMB_SIZE / 2,
            background: VALENCE_GRADIENT,
          }}
        />

        {/* 7 tick marks */}
        {SNAP_POSITIONS.map((pos, i) => {
          const pct = ((pos + 1) / 2) * 100;
          const isActive = i === snapIdx;
          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: isActive ? 6 : 4,
                height: isActive ? 6 : 4,
                backgroundColor: isActive ? 'hsl(var(--foreground))' : 'hsl(var(--foreground) / 0.4)',
                left: `calc(${pct}% - ${(isActive ? 6 : 4) / 2}px)`,
                top: '50%',
                transform: 'translateY(-50%)',
                transition: 'all 150ms ease-out',
              }}
              aria-hidden="true"
            />
          );
        })}

        {/* Thumb — spring snap on press/release */}
        <motion.div
          animate={{ scale: isPressed ? 1.15 : 1 }}
          transition={zenMotion.snappy}
          className="absolute rounded-full bg-white shadow-zen-md ring-1 ring-black/10 dark:bg-gray-100 dark:ring-white/20"
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            left: `calc(${thumbPercent}% - ${THUMB_SIZE / 2}px)`,
          }}
        />
      </div>

      {/* Min/Max labels */}
      <div className="flex justify-between rtl:flex-row-reverse px-1 mt-1">
        <span className="text-xs text-muted-foreground">
          {t.somVeryUnpleasant}
        </span>
        <span className="text-xs text-muted-foreground">
          {t.somVeryPleasant}
        </span>
      </div>
    </div>
  );
}
