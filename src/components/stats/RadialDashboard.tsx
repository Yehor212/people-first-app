/**
 * RadialDashboard - Concentric progress rings
 * Part of Phase 10 Premium Stats Redesign
 *
 * Three animated rings showing Mood (outer), Habits (middle), Focus (inner)
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
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

interface RadialDashboardProps {
  /** Mood percentage (0-100) */
  moodPercent: number;
  /** Habits completion rate (0-100) */
  habitsPercent: number;
  /** Focus percentage (0-100) */
  focusPercent: number;
  /** Optional class name */
  className?: string;
}

// Ring configurations (outer to inner)
const RING_CONFIG = {
  outer: { radius: 85, strokeWidth: 12 },
  middle: { radius: 65, strokeWidth: 12 },
  inner: { radius: 45, strokeWidth: 12 },
};

export function RadialDashboard({
  moodPercent,
  habitsPercent,
  focusPercent,
  className,
}: RadialDashboardProps) {
  const { t } = useLanguage();
  const [activeRing, setActiveRing] = useState<string | null>(null);

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

  return (
    <div
      className={cn(
        'relative rounded-2xl p-4',
        'bg-card border border-border/50',
        'shadow-md',
        className
      )}
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

              return (
                <g key={ring.id}>
                  {/* Track */}
                  <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    className="stroke-muted/20"
                  />

                  {/* Progress arc */}
                  <motion.circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    stroke={ring.color}
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{
                      duration: 1,
                      delay,
                      ease: 'easeOut'
                    }}
                    className={cn(
                      'transition-all duration-300',
                      activeRing === ring.id && 'radial-ring-glow'
                    )}
                    style={{
                      filter: activeRing === ring.id
                        ? `drop-shadow(0 0 10px ${ring.color})`
                        : undefined
                    }}
                    onMouseEnter={() => setActiveRing(ring.id)}
                    onMouseLeave={() => setActiveRing(null)}
                  />
                </g>
              );
            })}
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {activeRing ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div className="flex justify-center mb-1">
                  <EmojiOrIcon
                    emoji={rings.find(r => r.id === activeRing)?.emoji || ''}
                    iconName={rings.find(r => r.id === activeRing)?.iconName}
                    size="lg"
                  />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {rings.find(r => r.id === activeRing)?.value}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {rings.find(r => r.id === activeRing)?.label}
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <p className="text-xs text-muted-foreground">
                  {t.tapToSee || 'Tap a ring'}
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-4">
        {rings.map((ring) => (
          <button
            key={ring.id}
            onClick={() => setActiveRing(activeRing === ring.id ? null : ring.id)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-lg',
              'text-xs font-medium transition-all',
              activeRing === ring.id
                ? 'bg-muted scale-105'
                : 'hover:bg-muted/50'
            )}
            aria-pressed={activeRing === ring.id}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: ring.color }}
            />
            <span className="text-muted-foreground">{ring.label}</span>
            <span className="font-bold text-foreground">{ring.value}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default RadialDashboard;
