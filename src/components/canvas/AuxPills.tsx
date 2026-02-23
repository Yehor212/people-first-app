/**
 * AuxPills — Two auxiliary pills that animate outward from Root node
 * when user taps Root in idle mode → canvasMode = 'split'.
 *
 * Left pill: "Эмоции" (Heart icon) — positioned to the left of Root
 * Right pill: "Цели" (Target icon) — positioned to the right of Root
 *
 * Springs: stiffness 400, damping 25 (snappy organic pop)
 * Auto-collapse: 5s timeout → back to idle
 */

import { memo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useTransform, type MotionValue } from 'framer-motion';
import { Heart, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { ROOT_SIZE } from './mindMapLayout';
import type { CanvasMode } from '@/stores/uiStore';

interface AuxPillsProps {
  canvasCenter: { x: number; y: number };
  canvasMode: CanvasMode;
  onEmotionSelect: () => void;
  onGoalSelect: () => void;
  zoom: MotionValue<number>;
}

const PILL_OFFSET = 100; // px from center

const pillSpring = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 25,
};

export const AuxPills = memo(function AuxPills({ canvasCenter, canvasMode, onEmotionSelect, onGoalSelect, zoom }: AuxPillsProps) {
  const isVisible = canvasMode === 'split';
  const textOpacity = useTransform(zoom, [0.65, 0.85], [0, 1]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on mode change or unmount
  useEffect(() => {
    const ref = timeoutRef.current;
    if (ref) clearTimeout(ref);
    return () => {
      if (ref) clearTimeout(ref);
    };
  }, [canvasMode]);

  const handleEmotionTap = useCallback(() => {
    void haptics.buttonPress();
    onEmotionSelect();
  }, [onEmotionSelect]);

  const handleGoalTap = useCallback(() => {
    void haptics.buttonPress();
    onGoalSelect();
  }, [onGoalSelect]);

  const centerY = canvasCenter.y - ROOT_SIZE.height / 2 + ROOT_SIZE.height / 2 - 18; // vertically centered with root

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Left pill: Emotions */}
          <motion.button
            type="button"
            initial={{ opacity: 0, x: canvasCenter.x - 20, y: centerY, scale: 0.3 }}
            animate={{ opacity: 1, x: canvasCenter.x - PILL_OFFSET - 50, y: centerY, scale: 1 }}
            exit={{ opacity: 0, x: canvasCenter.x - 20, y: centerY, scale: 0.3 }}
            transition={pillSpring}
            onPointerUp={handleEmotionTap}
            className={cn(
              'absolute flex items-center gap-2 px-4 py-3 rounded-full',
              'bg-white/5 backdrop-blur-md',
              'border border-white/10',
              'text-white text-sm font-medium',
              'cursor-pointer z-20',
              'hover:bg-white/10 transition-colors',
            )}
            style={{ transformOrigin: 'right center' }}
            aria-label="Emotions"
          >
            <Heart className="w-4 h-4 text-rose-400" />
            <motion.span style={{ opacity: textOpacity }}>Эмоции</motion.span>
          </motion.button>

          {/* Right pill: Goals */}
          <motion.button
            type="button"
            initial={{ opacity: 0, x: canvasCenter.x + 20, y: centerY, scale: 0.3 }}
            animate={{ opacity: 1, x: canvasCenter.x + PILL_OFFSET - 10, y: centerY, scale: 1 }}
            exit={{ opacity: 0, x: canvasCenter.x + 20, y: centerY, scale: 0.3 }}
            transition={pillSpring}
            onPointerUp={handleGoalTap}
            className={cn(
              'absolute flex items-center gap-2 px-4 py-3 rounded-full',
              'bg-white/5 backdrop-blur-md',
              'border border-white/10',
              'text-white text-sm font-medium',
              'cursor-pointer z-20',
              'hover:bg-white/10 transition-colors',
            )}
            style={{ transformOrigin: 'left center' }}
            aria-label="Goals"
          >
            <Target className="w-4 h-4 text-emerald-400" />
            <motion.span style={{ opacity: textOpacity }}>Цели</motion.span>
          </motion.button>
        </>
      )}
    </AnimatePresence>
  );
});
