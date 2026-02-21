/**
 * GoalNode — Goal pill on the canvas with SVG progress ring.
 *
 * Features:
 * - Glassmorphic pill (--surface-glass) with border
 * - SVG progress ring that fills based on progressPercent
 * - Completed state: checkmark overlay, muted opacity
 * - One-shot completion burst: CSS particle ring fires ONLY on the <1 → ≥1 transition
 * - Tap → opens GoalActionMenu (via onTap callback)
 * - Pop-in animation via framer-motion
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { zenMotion } from '@/lib/animationUtils';
import type { CanvasGoal } from '@/types';

// Pill dimensions
const PILL_W = 130;
const PILL_H = 40;

// Progress ring dimensions (slightly larger than pill)
const RING_W = PILL_W + 16;
const RING_H = PILL_H + 16;
const RX = RING_W / 2;
const RY = RING_H / 2;

// Approximate ellipse perimeter (Ramanujan's formula) for stroke-dasharray
const RING_PERIMETER = Math.PI * (3 * (RX + RY) - Math.sqrt((3 * RX + RY) * (RX + 3 * RY)));

/** Progress ring color based on completion percentage */
function ringColor(percent: number): string {
  if (percent >= 1) return '#34d399';     // emerald-400 — fully complete
  if (percent >= 0.5) return '#fbbf24';   // amber-400 — halfway
  return 'rgba(255,255,255,0.25)';        // dim white — low progress
}

// Particle burst: 8 dots radiating outward in a ring
const PARTICLE_COUNT = 8;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (2 * Math.PI * i) / PARTICLE_COUNT;
  return {
    id: i,
    dx: Math.cos(angle) * 30,
    dy: Math.sin(angle) * 30,
  };
});

interface GoalNodeProps {
  goal: CanvasGoal;
  x: number;
  y: number;
  progressPercent: number; // 0–1
  onTap: (goalId: string) => void;
}

export function GoalNode({ goal, x, y, progressPercent, onTap }: GoalNodeProps) {
  const filled = progressPercent * RING_PERIMETER;
  const isComplete = goal.completed || progressPercent >= 1;
  const rColor = ringColor(progressPercent);

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
      // Auto-dismiss after animation duration
      const timer = setTimeout(() => setShowBurst(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [progressPercent]);

  const handleTap = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
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
          cx={RX} cy={RY} rx={RX - 2} ry={RY - 2}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={2}
        />
        {/* Progress arc */}
        {progressPercent > 0 && (
          <ellipse
            cx={RX} cy={RY} rx={RX - 2} ry={RY - 2}
            fill="none"
            stroke={rColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${RING_PERIMETER}`}
            className="transition-all duration-700 ease-out"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: `${RX}px ${RY}px`,
              opacity: 0.8,
            }}
          />
        )}
      </svg>

      {/* One-shot completion burst — 8 emerald particles + glow ring */}
      {showBurst && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Central glow pulse */}
          <motion.div
            className="absolute inset-[-16px] rounded-full"
            initial={{ scale: 0.6, opacity: 0.7 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{
              background: 'radial-gradient(circle, rgba(52,211,153,0.4) 0%, transparent 70%)',
            }}
          />
          {/* Particle dots */}
          {PARTICLES.map(p => (
            <motion.div
              key={p.id}
              className="absolute rounded-full bg-emerald-400"
              style={{
                width: 5,
                height: 5,
                left: PILL_W / 2 - 2.5,
                top: PILL_H / 2 - 2.5,
              }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.3 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          ))}
        </div>
      )}

      {/* Pill body — tappable */}
      <button
        type="button"
        onPointerUp={handleTap}
        className={cn(
          'w-full h-full rounded-full',
          'flex items-center justify-center gap-1.5 px-3',
          'border',
          isComplete
            ? 'border-emerald-400/50 opacity-70'
            : 'border-white/10',
          'cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-0',
          'transition-colors duration-200',
        )}
        style={{
          background: 'var(--surface-glass)',
          backdropFilter: 'blur(var(--surface-glass-blur, 20px))',
          WebkitBackdropFilter: 'blur(var(--surface-glass-blur, 20px))',
        }}
        aria-label={`Goal: ${goal.title}${isComplete ? ' (completed)' : ''}`}
        role="button"
      >
        {isComplete && (
          <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        )}
        <span
          className={cn(
            'text-xs font-medium truncate',
            isComplete ? 'text-emerald-300 line-through' : 'text-white',
          )}
        >
          {goal.title}
        </span>
      </button>
    </motion.div>
  );
}
