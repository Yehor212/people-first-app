/**
 * SwipeableHabit - Swipe-to-complete habit interaction
 *
 * Features:
 * - Swipe right to complete habit (mobile)
 * - Simple click to complete (desktop)
 * - Visual progress indicator
 * - Haptic feedback on completion
 * - Protection against accidental taps
 */

import { useState, useRef, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SwipeableHabitProps {
  children: ReactNode;
  onComplete: () => void;
  disabled?: boolean;
  completed?: boolean;
  habitColor?: string;
  habitIcon?: string;
  className?: string;
}

const SWIPE_THRESHOLD = 0.6; // 60% of width to trigger
const MIN_SWIPE_DISTANCE = 50; // Minimum pixels to start tracking

export function SwipeableHabit({
  children,
  onComplete,
  disabled = false,
  completed = false,
  habitColor = 'bg-primary',
  habitIcon,
  className,
}: SwipeableHabitProps) {
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const hasTriggeredRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || completed) return;

    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
    hasTriggeredRef.current = false;
  }, [disabled, completed]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || completed || hasTriggeredRef.current) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - startXRef.current;
    const deltaY = currentY - startYRef.current;

    // Ignore if scrolling vertically
    if (!isSwipingRef.current && Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    // Start tracking horizontal swipe
    if (deltaX > MIN_SWIPE_DISTANCE && !isSwipingRef.current) {
      isSwipingRef.current = true;
      setIsSwiping(true);
    }

    if (isSwipingRef.current && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const progress = Math.min(1, Math.max(0, deltaX / containerWidth));
      setSwipeProgress(progress);

      // Trigger completion at threshold
      if (progress >= SWIPE_THRESHOLD && !hasTriggeredRef.current) {
        hasTriggeredRef.current = true;

        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        // Show success animation
        setShowSuccess(true);
        setSwipeProgress(1);

        // Trigger callback
        setTimeout(() => {
          onComplete();
          // Reset after animation
          setTimeout(() => {
            setShowSuccess(false);
            setSwipeProgress(0);
            setIsSwiping(false);
          }, 300);
        }, 200);
      }
    }
  }, [disabled, completed, onComplete]);

  const handleTouchEnd = useCallback(() => {
    if (!hasTriggeredRef.current) {
      // Reset if not completed
      setSwipeProgress(0);
      setIsSwiping(false);
    }
    isSwipingRef.current = false;
  }, []);

  // Desktop: simple click to complete
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (disabled || completed) return;

    // Ignore if this was a touch event (mobile devices trigger both touch and click)
    if (e.detail === 0) return; // Touch events have detail=0

    // Show success animation
    setShowSuccess(true);

    // Trigger callback
    onComplete();

    // Reset after animation
    setTimeout(() => {
      setShowSuccess(false);
    }, 500);
  }, [disabled, completed, onComplete]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-xl transition-all",
        isSwiping && "touch-none",
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      {/* Swipe progress background */}
      <AnimatePresence>
        {(isSwiping || showSuccess) && !completed && (
          <motion.div
            className={cn(
              "absolute inset-0 z-0",
              showSuccess
                ? "bg-gradient-to-r from-emerald-500 to-green-500"
                : "bg-gradient-to-r from-primary/30 to-primary/50"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${swipeProgress * 100}%` }}
            exit={{ width: 0 }}
            transition={{ duration: showSuccess ? 0.2 : 0 }}
          />
        )}
      </AnimatePresence>


      {/* Success checkmark overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-green-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              <Check className="w-8 h-8 text-white" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-5">
        {children}
      </div>

      {/* Swipe hint arrow (when not completed and not swiping) */}
      {!completed && !isSwiping && !showSuccess && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-5 pointer-events-none sm:hidden">
          <motion.div
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-muted-foreground/30"
          >
            <ChevronRight className="w-5 h-5" />
          </motion.div>
        </div>
      )}
    </div>
  );
}
