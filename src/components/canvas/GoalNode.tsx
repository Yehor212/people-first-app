/**
 * GoalNode — Goal pill on the canvas with SVG progress ring.
 *
 * Features:
 * - Glassmorphic pill (--surface-glass) with border
 * - SVG progress ring that fills based on progressPercent
 * - Completed state: checkmark overlay, muted opacity
 * - One-shot completion burst on the <1 → ≥1 transition
 * - Tap → opens GoalActionMenu (via onTap callback)
 * - Pop-in animation via framer-motion
 */

import { memo, useCallback, useEffect, useRef, useState, Suspense } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { haptics } from "@/lib/haptics";
import { zenMotion } from "@/lib/animationUtils";
import { GOAL_ICON_MAP } from "./GoalInput";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import type { CanvasGoal } from "@/types";

const CompletionBurstLottie = lazyWithRetry(
  () =>
    import("./CompletionBurstLottie").then((m) => ({
      default: m.CompletionBurstLottie,
    })),
  "CompletionBurstLottie"
);

/** Preset color palette for goal customization. Key = stored in CanvasGoal.color */
export const GOAL_COLORS: Record<string, string> = {
  emerald: "#34d399",
  sky: "#38bdf8",
  amber: "#fbbf24",
  rose: "#fb7185",
  violet: "#a78bfa",
  orange: "#fb923c",
  pink: "#f472b6",
  cyan: "#22d3ee",
};

// Pill dimensions (PILL_H ≥ 48 for 48dp touch target compliance)
const PILL_W = 130;
const PILL_H = 48;

// Progress ring dimensions (slightly larger than pill)
const RING_W = PILL_W + 16;
const RING_H = PILL_H + 16;
const RX = RING_W / 2;
const RY = RING_H / 2;

// Approximate ellipse perimeter (Ramanujan's formula) for stroke-dasharray
const RING_PERIMETER = Math.PI * (3 * (RX + RY) - Math.sqrt((3 * RX + RY) * (RX + 3 * RY)));

/** Progress ring color based on completion percentage and optional goal color */
function ringColor(percent: number, goalColor?: string): string {
  if (percent >= 1) return "#34d399"; // emerald-400 — fully complete
  if (goalColor && GOAL_COLORS[goalColor]) return GOAL_COLORS[goalColor];
  if (percent >= 0.5) return "#fbbf24"; // amber-400 — halfway
  return "rgba(255,255,255,0.25)"; // dim white — low progress
}

interface GoalNodeProps {
  goal: CanvasGoal;
  x: number;
  y: number;
  progressPercent: number; // 0–1
  onTap: (goalId: string) => void;
  zoom: MotionValue<number>;
}

export const GoalNode = memo(
  function GoalNode({ goal, x, y, progressPercent, onTap, zoom }: GoalNodeProps) {
    const { t } = useLanguage();
    const textOpacity = useTransform(zoom, [0.65, 0.85], [0, 1]);
    const filled = progressPercent * RING_PERIMETER;
    const isComplete = goal.completed || progressPercent >= 1;
    const rColor = ringColor(progressPercent, goal.color);
    const GoalIcon = goal.icon ? (GOAL_ICON_MAP[goal.icon] ?? null) : null;

    // ── One-shot burst detection ──
    // Track previous progress to detect the <1 → ≥1 transition
    const prevProgressRef = useRef(progressPercent);
    const [showBurst, setShowBurst] = useState(false);

    useEffect(() => {
      const prev = prevProgressRef.current;
      prevProgressRef.current = progressPercent;

      // Fire burst ONLY on the transition from incomplete to complete
      if (prev < 1 && progressPercent >= 1) {
        setShowBurst(true);
        void haptics.buttonPress();
        // Auto-dismiss after animation duration (1.2s)
        const timer = setTimeout(() => setShowBurst(false), 1200);
        return () => clearTimeout(timer);
      }
    }, [progressPercent]);

    const handleTap = useCallback(() => {
      void haptics.light();
      onTap(goal.id);
    }, [goal.id, onTap]);

    return (
      <motion.div
        className="absolute z-10"
        style={{
          left: x - PILL_W / 2,
          top: y - PILL_H / 2,
          width: PILL_W,
          height: PILL_H,
        }}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={zenMotion.bouncy}
      >
        {/* SVG progress ring */}
        <svg
          viewBox={`0 0 ${RING_W} ${RING_H}`}
          className="absolute pointer-events-none"
          style={{
            left: -8,
            top: -8,
            width: RING_W,
            height: RING_H,
          }}
        >
          {/* Track */}
          <ellipse
            cx={RX}
            cy={RY}
            rx={RX - 2}
            ry={RY - 2}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={2}
          />
          {/* Progress arc */}
          {progressPercent > 0 && (
            <ellipse
              cx={RX}
              cy={RY}
              rx={RX - 2}
              ry={RY - 2}
              fill="none"
              stroke={rColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${RING_PERIMETER}`}
              className="motion-safe:transition-all motion-safe:duration-700 ease-out -rotate-90 opacity-80"
              style={{
                transformOrigin: `${RX}px ${RY}px`,
              }}
            />
          )}
        </svg>

        {/* One-shot completion burst */}
        {showBurst && (
          <Suspense fallback={null}>
            <CompletionBurstLottie onComplete={() => setShowBurst(false)} />
          </Suspense>
        )}

        {/* Pill body — tappable */}
        <button
          type="button"
          onPointerUp={handleTap}
          onClick={handleTap}
          className={cn(
            "w-full h-full rounded-full",
            "flex items-center justify-center gap-1.5 px-3",
            "border",
            isComplete ? "border-emerald-400/50 opacity-70" : !goal.color ? "border-border" : "",
            "cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-0",
            "motion-safe:transition-colors motion-safe:duration-200",
            "bg-card/80 backdrop-blur-sm [-webkit-backdrop-filter:blur(8px)]"
          )}
          style={{
            ...(!isComplete && goal.color ? { borderColor: rColor + "80" } : {}),
            boxShadow: isComplete
              ? "0 0 20px rgba(52,211,153,0.3), 0 8px 32px rgba(0,0,0,0.5)"
              : goal.color
                ? `0 0 15px ${rColor}25, 0 8px 32px rgba(0,0,0,0.5)`
                : "0 0 15px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.5)",
          }}
          aria-label={`Goal: ${goal.title}${isComplete ? " (completed)" : ""}`}
        >
          <motion.span
            style={{ opacity: textOpacity }}
            className="flex items-center gap-1.5 truncate"
          >
            {isComplete ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" aria-hidden="true" />
            ) : goal.emoji ? (
              <span
                className="text-sm flex-shrink-0 leading-none"
                role="img"
                aria-label={t.ariaGoalEmoji}
              >
                {goal.emoji}
              </span>
            ) : GoalIcon ? (
              <GoalIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            ) : null}
            <span
              className={cn(
                "text-xs font-medium truncate",
                isComplete
                  ? "text-emerald-500 dark:text-emerald-300 line-through"
                  : "text-foreground"
              )}
            >
              {goal.title}
            </span>
          </motion.span>
        </button>
      </motion.div>
    );
  },
  (prev, next) =>
    prev.goal.id === next.goal.id &&
    prev.goal.completed === next.goal.completed &&
    prev.goal.icon === next.goal.icon &&
    prev.goal.emoji === next.goal.emoji &&
    prev.goal.color === next.goal.color &&
    prev.goal.title === next.goal.title &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.progressPercent === next.progressPercent &&
    prev.onTap === next.onTap
);
