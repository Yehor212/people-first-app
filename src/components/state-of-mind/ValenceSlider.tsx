import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { zenMotion } from '@/lib/animationUtils';
import { haptics } from '@/lib/haptics';
import { VALENCE_GRADIENT, valenceToColor } from './colorUtils';

interface ValenceSliderProps {
  value: number;
  onChange: (value: number) => void;
}

const TRACK_HEIGHT = 8;
const THUMB_SIZE = 28;
const TOUCH_PADDING = 10; // Extra padding for 44px+ touch target

/**
 * Custom valence slider with gradient track.
 * Pointer events for cross-platform (mouse + touch + pen).
 * GPU-only: thumb positioned via transform: translateX().
 *
 * Law 9 (a11y): role="slider", aria-valuemin/max/now/text, keyboard support.
 * Law 10 (Cross-Platform): pointer events, touch-none, setPointerCapture.
 */
/** Map valence to mood tier index (0-4) for haptic threshold detection */
function valenceTier(v: number): number {
  if (v <= -0.6) return 0;
  if (v <= -0.2) return 1;
  if (v <= 0.2) return 2;
  if (v <= 0.6) return 3;
  return 4;
}

export function ValenceSlider({ value, onChange }: ValenceSliderProps) {
  const { t } = useLanguage();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPressed, setIsPressed] = useState(false);
  const prevTierRef = useRef(valenceTier(value));

  // C1: Haptic feedback when crossing valence tier thresholds during drag
  useEffect(() => {
    const currentTier = valenceTier(value);
    if (currentTier !== prevTierRef.current) {
      prevTierRef.current = currentTier;
      // Stronger haptic at extreme endpoints, subtle pulse at inner thresholds
      if (value <= -0.95 || value >= 0.95) {
        void haptics.medium();
      } else {
        void haptics.light();
      }
    }
  }, [value]);

  const getValenceFromEvent = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0; // Neutral fallback if ref not attached yet
    const rect = track.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    // Map 0-1 → -1.0 to 1.0, snap to 0.01 precision
    return Math.round((ratio * 2 - 1) * 100) / 100;
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
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    let newValue = value;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      newValue = Math.min(1, value + 0.1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      newValue = Math.max(-1, value - 0.1);
    } else if (e.key === 'Home') {
      newValue = -1;
    } else if (e.key === 'End') {
      newValue = 1;
    } else {
      return;
    }
    e.preventDefault();
    onChange(Math.round(newValue * 100) / 100);
  }, [value, onChange]);

  // Thumb position as percentage (0-100)
  const thumbPercent = ((value + 1) / 2) * 100;

  // Label for current valence
  const valenceLabel = value <= -0.6
    ? t.somVeryUnpleasant
    : value <= -0.2
      ? t.somUnpleasant
      : value <= 0.2
        ? t.somNeutral
        : value <= 0.6
          ? t.somPleasant
          : t.somVeryPleasant;

  return (
    <div className="w-full px-2">
      {/* Valence label — C4: aria-live for screen readers, C5: color synced with valence */}
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
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
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
