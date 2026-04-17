import { memo, useRef, useCallback, useEffect, useState } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { hapticSelection, hapticMedium } from "@/lib/haptics";
import { springs } from "@/config/animations";
import type { MoodType } from "@/types";
import { useDesignFlag } from "@/hooks/useDesignFlag";

/**
 * Phase 2-B — flag-gated gradient fill.
 * When `design.colors.oklch.mood-slider` flag is enabled, the track fill uses
 * the new 5-step OKLCH mood palette (--color-mood-*) which provides a
 * perceptually uniform gradient per emoji step. PostCSS
 * @csstools/postcss-oklab-function emits an rgb() fallback before the oklch()
 * declaration so browsers without Oklab support still render correctly.
 * When flag is off (default 0% rollout) the original 3-stop HSL gradient
 * remains — behaviourally identical to all prior builds, zero visual
 * regression risk.
 */
const HSL_GRADIENT =
  "linear-gradient(to right,hsl(var(--destructive)),hsl(var(--warning)),hsl(var(--primary)))";
const OKLCH_GRADIENT =
  "linear-gradient(to right,var(--color-mood-terrible),var(--color-mood-bad),var(--color-mood-okay),var(--color-mood-good),var(--color-mood-great))";

const MOODS: { key: MoodType; emoji: string }[] = [
  { key: "terrible", emoji: "\u{1F622}" },
  { key: "bad", emoji: "\u{1F614}" },
  { key: "okay", emoji: "\u{1F610}" },
  { key: "good", emoji: "\u{1F642}" },
  { key: "great", emoji: "\u{1F604}" },
];

const DETENT_FRACTIONS = [0, 0.25, 0.5, 0.75, 1] as const;

function moodToIndex(mood: MoodType | undefined): number {
  if (!mood) return 2;
  const idx = MOODS.findIndex((m) => m.key === mood);
  return idx === -1 ? 2 : idx;
}

function nearestDetentIndex(x: number, trackWidth: number): number {
  if (trackWidth <= 0) return 2;
  const fraction = Math.max(0, Math.min(1, x / trackWidth));
  let closest = 0;
  let minDist = Infinity;
  for (let i = 0; i < DETENT_FRACTIONS.length; i++) {
    const dist = Math.abs(fraction - DETENT_FRACTIONS[i]);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }
  return closest;
}

export const MoodSlider = memo(function MoodSlider({
  value,
  onChange,
  className,
  showEmojis = true,
}: {
  value: MoodType | undefined;
  onChange: (mood: MoodType) => void;
  className?: string;
  /**
   * Phase 3-A.2 — hides the emoji detent row under the track.
   * Default true preserves every existing caller (JournalEntryEditor, HomeTab, etc.)
   * byte-for-byte. OrbPage passes `false` for a minimalist, cinematic cosmic surface.
   */
  showEmojis?: boolean;
}) {
  const prefersReduced = useReducedMotion();
  const useOklchGradient = useDesignFlag("design.colors.oklch.mood-slider");
  const trackRef = useRef<HTMLDivElement>(null);
  const lastDetentRef = useRef<number>(moodToIndex(value));
  const [trackWidth, setTrackWidth] = useState(0);

  const x = useMotionValue(0);
  const fillWidth = useTransform(x, (v) => Math.max(0, v));

  // ResizeObserver: re-sync trackWidth when element resizes (hidden-tab safe)
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setTrackWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync thumb position when value or trackWidth changes
  useEffect(() => {
    if (trackWidth <= 0) return;
    const idx = moodToIndex(value);
    const target = DETENT_FRACTIONS[idx] * trackWidth;
    if (prefersReduced) {
      x.set(target);
    } else {
      animate(x, target, springs.snappy);
    }
    lastDetentRef.current = idx;
  }, [value, trackWidth, prefersReduced, x]);

  const snapToDetent = useCallback(
    (index: number) => {
      if (trackWidth <= 0) return;
      const target = DETENT_FRACTIONS[index] * trackWidth;
      if (prefersReduced) {
        x.set(target);
      } else {
        animate(x, target, springs.snappy);
      }
      lastDetentRef.current = index;
      onChange(MOODS[index].key);
      void hapticMedium();
    },
    [onChange, prefersReduced, x, trackWidth],
  );

  const handleDrag = useCallback(() => {
    if (trackWidth <= 0) return;
    const currentIndex = nearestDetentIndex(x.get(), trackWidth);
    if (currentIndex !== lastDetentRef.current) {
      lastDetentRef.current = currentIndex;
      void hapticSelection();
    }
  }, [x, trackWidth]);

  const handleDragEnd = useCallback(() => {
    if (trackWidth <= 0) return;
    const idx = nearestDetentIndex(x.get(), trackWidth);
    snapToDetent(idx);
  }, [x, trackWidth, snapToDetent]);

  const selectedIndex = moodToIndex(value);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next = selectedIndex;
      if (e.key === "ArrowRight") next = Math.min(selectedIndex + 1, 4);
      else if (e.key === "ArrowLeft") next = Math.max(selectedIndex - 1, 0);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = 4;
      else return;
      e.preventDefault();
      if (next !== selectedIndex) snapToDetent(next);
    },
    [selectedIndex, snapToDetent],
  );

  return (
    <div className={cn("min-h-[64px] select-none px-1", className)}>
      {/* Track */}
      <div ref={trackRef} className="relative h-2 rounded-full bg-muted/30">
        {/* Gradient fill — dual-path per design.colors.oklch.mood-slider flag */}
        <motion.div
          data-gradient-mode={useOklchGradient ? "oklch" : "hsl"}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: fillWidth,
            backgroundImage: useOklchGradient ? OKLCH_GRADIENT : HSL_GRADIENT,
          }}
        />

        {/* Draggable thumb */}
        <motion.div
          role="slider"
          tabIndex={0}
          aria-label="Mood"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={selectedIndex}
          aria-valuetext={MOODS[selectedIndex].key}
          className="absolute top-1/2 w-7 h-7 rounded-full bg-background shadow-lg ring-2 ring-primary/30 cursor-grab active:cursor-grabbing touch-none"
          style={{ x, y: "-50%", translateX: "-50%" }}
          drag="x"
          dragConstraints={{ left: 0, right: trackWidth }}
          dragElastic={0.05}
          dragMomentum={false}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          onKeyDown={handleKeyDown}
          whileTap={{ scale: 1.15 }}
        />
      </div>

      {/* Emoji row — gated by showEmojis (Phase 3-A.2: OrbPage opts out for cinematic vibe) */}
      {showEmojis && (
        <div className="flex justify-between mt-3 px-0" data-testid="mood-slider-emoji-row">
          {MOODS.map((mood, i) => (
            <motion.button
              key={mood.key}
              type="button"
              className="text-xl w-11 h-11 flex items-center justify-center rounded-full"
              animate={
                prefersReduced
                  ? undefined
                  : { scale: i === selectedIndex ? 1.3 : 1 }
              }
              transition={springs.snappy}
              onClick={() => snapToDetent(i)}
              aria-label={mood.key}
            >
              {mood.emoji}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
});
