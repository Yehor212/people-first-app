/**
 * GrowingEdge — Animated SVG Bezier curve that "grows" from Root upward
 * to the EmotionPanel anchor point.
 *
 * Uses framer-motion's pathLength for smooth 600ms growth animation.
 * Color: gradient from white/30 → mood color (or white/60 if no mood yet).
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ROOT_SIZE } from './mindMapLayout';
import type { MoodType } from '@/types';

const MOOD_HEX: Record<MoodType, string> = {
  great: '#34d399',
  good: '#38bdf8',
  okay: '#fbbf24',
  bad: '#fb923c',
  terrible: '#f87171',
};

interface GrowingEdgeProps {
  canvasCenter: { x: number; y: number };
  isVisible: boolean;
  /** Selected mood determines the gradient end color */
  selectedMood: MoodType | null;
}

// Edge grows from Root center upward by this distance (px)
const EDGE_LENGTH = 180;

export function GrowingEdge({ canvasCenter, isVisible, selectedMood }: GrowingEdgeProps) {
  const cx = canvasCenter.x;
  const cy = canvasCenter.y;

  // Start: top of Root orb
  const startY = cy - ROOT_SIZE.height / 2 - 4;
  // End: above Root
  const endY = startY - EDGE_LENGTH;

  // Control points for a gentle upward curve
  const cp1x = cx - 20;
  const cp1y = startY - EDGE_LENGTH * 0.4;
  const cp2x = cx + 20;
  const cp2y = startY - EDGE_LENGTH * 0.7;

  const d = `M ${cx},${startY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${cx},${endY}`;
  const endColor = selectedMood ? MOOD_HEX[selectedMood] : 'rgba(255,255,255,0.6)';
  const gradientId = 'growing-edge-grad';

  return (
    <AnimatePresence>
      {isVisible && (
        <svg
          className="absolute inset-0 pointer-events-none z-0"
          width={canvasCenter.x * 2}
          height={canvasCenter.y * 2}
          viewBox={`0 0 ${canvasCenter.x * 2} ${canvasCenter.y * 2}`}
        >
          <defs>
            <linearGradient
              id={gradientId}
              x1={cx} y1={startY}
              x2={cx} y2={endY}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="100%" stopColor={endColor} stopOpacity={0.7} />
            </linearGradient>
          </defs>

          <motion.path
            d={d}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ pathLength: 0, opacity: 0 }}
            transition={{
              pathLength: { duration: 0.6, ease: 'easeOut' },
              opacity: { duration: 0.2 },
            }}
          />
        </svg>
      )}
    </AnimatePresence>
  );
}

/** Y coordinate where the edge terminates (used to position EmotionPanel) */
export function getEdgeEndY(canvasCenterY: number): number {
  return canvasCenterY - ROOT_SIZE.height / 2 - 4 - EDGE_LENGTH;
}
