/**
 * RadialDashboard - Concentric progress rings with swipe-to-switch
 * Part of Phase 10 Premium Stats Redesign
 *
 * Three animated rings showing Mood (outer), Habits (middle), Focus (inner)
 * Swipe or tap rings to switch. Tap center to open detail view.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Target, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { EmojiOrIcon } from '@/components/icons';

interface RingData {
  id: string;
  label: string;
  value: number; // 0-100
  color: string;
  icon: React.ReactNode;
  emoji: string;
  iconName: string;
}

export type RingId = 'mood' | 'habits' | 'focus';

interface RadialDashboardProps {
  /** Mood percentage (0-100) */
  moodPercent: number;
  /** Habits completion rate (0-100) */
  habitsPercent: number;
  /** Focus percentage (0-100) */
  focusPercent: number;
  /** Optional class name */
  className?: string;
  /** Callback when center is tapped (for opening detail sheet) */
  onRingClick?: (ringId: RingId) => void;
}

// Ring configurations (outer to inner)
const RING_CONFIG = {
  outer: { radius: 85, strokeWidth: 12 },
  middle: { radius: 65, strokeWidth: 12 },
  inner: { radius: 45, strokeWidth: 12 },
};

const RING_ORDER: RingId[] = ['mood', 'habits', 'focus'];

export function RadialDashboard({
  moodPercent,
  habitsPercent,
  focusPercent,
  className,
  onRingClick,
}: RadialDashboardProps) {
  const { t } = useLanguage();
  const [activeRing, setActiveRing] = useState<RingId>('habits');

  // Swipe tracking
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const rings: RingData[] = useMemo(() => [
    {
      id: 'mood',
      label: t.mood || 'Mood',
      value: moodPercent,
      color: 'hsl(var(--chart-mood))',
      icon: <Heart className="w-4 h-4" />,
      emoji: '💜',
      iconName: 'heart',
    },
    {
      id: 'habits',
      label: t.habits || 'Habits',
      value: habitsPercent,
      color: 'hsl(var(--chart-habit))',
      icon: <Target className="w-4 h-4" />,
      emoji: '🎯',
      iconName: 'target',
    },
    {
      id: 'focus',
      label: t.focus || 'Focus',
      value: focusPercent,
      color: 'hsl(var(--chart-focus))',
      icon: <Brain className="w-4 h-4" />,
      emoji: '🧠',
      iconName: 'brain',
    },
  ], [t, moodPercent, habitsPercent, focusPercent]);

  const activeRingData = useMemo(
    () => rings.find(r => r.id === activeRing) || rings[1],
    [rings, activeRing]
  );

  // Calculate circumference and offsets
  const getCircleProps = (radius: number, percent: number) => {
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;
    return { circumference, strokeDashoffset };
  };

  const ringConfigs = [
    { ...RING_CONFIG.outer, ring: rings[0], delay: 0 },
    { ...RING_CONFIG.middle, ring: rings[1], delay: 0.2 },
    { ...RING_CONFIG.inner, ring: rings[2], delay: 0.4 },
  ];

  // Cycle to next/previous ring
  const cycleRing = useCallback((direction: 'next' | 'prev') => {
    setActiveRing(current => {
      const idx = RING_ORDER.indexOf(current);
      if (direction === 'next') {
        return RING_ORDER[(idx + 1) % RING_ORDER.length];
      } else {
        return RING_ORDER[(idx - 1 + RING_ORDER.length) % RING_ORDER.length];
      }
    });
  }, []);

  // Pointer handlers for swipe (works for both mouse and touch)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    isSwiping.current = false;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const deltaX = e.clientX - touchStartX.current;
    const deltaY = e.clientY - touchStartY.current;

    // Only trigger swipe if horizontal movement is dominant and exceeds threshold
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      isSwiping.current = true;
      if (deltaX < 0) {
        cycleRing('next'); // Swipe left → next
      } else {
        cycleRing('prev'); // Swipe right → previous
      }
    }
  }, [cycleRing]);

  // Handle center tap (open detail sheet)
  const handleCenterTap = useCallback(() => {
    if (!isSwiping.current) {
      onRingClick?.(activeRing);
    }
  }, [activeRing, onRingClick]);

  // Handle ring tap (select ring, don't open sheet)
  const handleRingTap = useCallback((ringId: RingId) => {
    if (!isSwiping.current) {
      setActiveRing(ringId);
    }
  }, []);

  return (
    <div
      className={cn(
        'relative rounded-2xl p-4',
        'bg-card border border-border/50',
        'zen-shadow-md',
        'touch-pan-y', // Allow vertical scroll, capture horizontal
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* SVG Rings */}
      <div className="flex justify-center">
        <div className="relative w-48 h-48">
          <svg
            className="w-full h-full -rotate-90"
            viewBox="0 0 200 200"
          >
            {/* Render rings */}
            {ringConfigs.map(({ radius, strokeWidth, ring, delay }) => {
              const { circumference, strokeDashoffset } = getCircleProps(radius, ring.value);
              const isActive = activeRing === ring.id;

              return (
                <g
                  key={ring.id}
                  className="cursor-pointer"
                  onClick={() => handleRingTap(ring.id as RingId)}
                >
                  {/* Invisible hit area for easier tapping */}
                  <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth + 14}
                    stroke="transparent"
                  />
                  {/* Track */}
                  <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    className={cn(
                      'transition-opacity duration-300',
                      isActive ? 'stroke-muted/30' : 'stroke-muted/15'
                    )}
                  />

                  {/* Progress arc */}
                  <motion.circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    strokeWidth={isActive ? strokeWidth + 2 : strokeWidth}
                    strokeLinecap="round"
                    stroke={ring.color}
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{
                      strokeDashoffset,
                      opacity: isActive ? 1 : 0.5,
                    }}
                    transition={{
                      strokeDashoffset: { duration: 1, delay, ease: 'easeOut' },
                      opacity: { duration: 0.3 },
                    }}
                    style={{
                      filter: isActive
                        ? `drop-shadow(0 0 12px ${ring.color})`
                        : undefined
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Center content — tap to open detail */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
            onClick={handleCenterTap}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeRing}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-center"
              >
                <div className="flex justify-center mb-1">
                  <EmojiOrIcon
                    emoji={activeRingData.emoji}
                    iconName={activeRingData.iconName}
                    size="lg"
                  />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {Math.round(activeRingData.value)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeRingData.label}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-3">
        {rings.map((ring) => (
          <motion.div
            key={ring.id}
            className={cn(
              'h-2 rounded-full transition-all duration-300 cursor-pointer',
              activeRing === ring.id ? 'w-5' : 'w-2 bg-muted/40'
            )}
            style={activeRing === ring.id ? { backgroundColor: ring.color } : undefined}
            onClick={() => setActiveRing(ring.id as RingId)}
            animate={activeRing === ring.id ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}

export default RadialDashboard;
