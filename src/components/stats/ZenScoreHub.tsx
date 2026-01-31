/**
 * ZenScoreHub - Central wellness score with animated ring
 * Part of Phase 10 Premium Stats Redesign
 *
 * Displays a 0-100 ZenScore combining mood, habits, focus, and streak data
 */

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { ParticleBackground } from './ParticleBackground';

interface ZenScoreHubProps {
  /** Average mood score (1-5) */
  moodScore: number;
  /** Habit completion rate (0-100) */
  habitRate: number;
  /** Focus score (0-100) */
  focusScore: number;
  /** Current streak days */
  streakDays: number;
  /** Comparison to last week (-100 to +100) */
  weeklyChange?: number;
  /** Optional class name */
  className?: string;
}

// Score thresholds for glow colors
const getScoreColor = (score: number) => {
  if (score >= 81) return { hsl: '158 60% 50%', class: 'text-[hsl(var(--mood-good))]', glow: 'hsl(158 60% 50%)' };
  if (score >= 61) return { hsl: '217 91% 60%', class: 'text-[hsl(var(--chart-focus))]', glow: 'hsl(217 91% 60%)' };
  if (score >= 41) return { hsl: '45 95% 55%', class: 'text-[hsl(var(--mood-okay))]', glow: 'hsl(45 95% 55%)' };
  return { hsl: '0 72% 51%', class: 'text-destructive', glow: 'hsl(0 72% 51%)' };
};

const getScoreLabel = (score: number, t: Record<string, string>) => {
  if (score >= 81) return t.zenScoreExcellent || 'Excellent!';
  if (score >= 61) return t.zenScoreGood || 'Good';
  if (score >= 41) return t.zenScoreOkay || 'Keep going';
  return t.zenScoreNeedsWork || 'Needs work';
};

export function ZenScoreHub({
  moodScore,
  habitRate,
  focusScore,
  streakDays,
  weeklyChange = 0,
  className,
}: ZenScoreHubProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Calculate ZenScore
  const zenScore = useMemo(() => {
    // Normalize mood to 0-100
    const normalizedMood = ((moodScore - 1) / 4) * 100;

    // Calculate streak bonus (max 15 points for 7+ day streak)
    const streakBonus = Math.min(streakDays / 7, 1) * 15;

    // Weighted average
    const score = (
      normalizedMood * 0.30 +      // 30% mood
      habitRate * 0.35 +           // 35% habits
      focusScore * 0.20 +          // 20% focus
      streakBonus                   // 15% streak bonus
    );

    return Math.round(Math.max(0, Math.min(100, score)));
  }, [moodScore, habitRate, focusScore, streakDays]);

  // Animate score count-up
  useEffect(() => {
    if (hasAnimated) return;

    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;
    const increment = zenScore / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= zenScore) {
        setAnimatedScore(zenScore);
        clearInterval(timer);
        setHasAnimated(true);
      } else {
        setAnimatedScore(Math.round(current));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [zenScore, hasAnimated]);

  const scoreColor = getScoreColor(zenScore);
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (zenScore / 100) * circumference;

  // Breakdown items
  const breakdownItems = [
    {
      label: t.mood || 'Mood',
      value: Math.round(((moodScore - 1) / 4) * 100),
      emoji: '😊',
      color: 'text-[hsl(var(--chart-mood))]'
    },
    {
      label: t.habits || 'Habits',
      value: Math.round(habitRate),
      emoji: '🎯',
      color: 'text-[hsl(var(--chart-habit))]'
    },
    {
      label: t.focus || 'Focus',
      value: Math.round(focusScore),
      emoji: '🧠',
      color: 'text-[hsl(var(--chart-focus))]'
    },
    {
      label: t.streak || 'Streak',
      value: streakDays,
      emoji: '🔥',
      color: 'text-orange-500',
      suffix: 'd'
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'relative overflow-hidden rounded-3xl',
        'bg-gradient-to-br from-card via-card to-card/80',
        'border border-border/50',
        'shadow-lg',
        className
      )}
    >
      {/* Particle background */}
      <ParticleBackground
        count={10}
        color={zenScore >= 61 ? 'primary' : zenScore >= 41 ? 'gold' : 'accent'}
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${scoreColor.glow}, transparent 70%)`
        }}
      />

      {/* Main content */}
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className={cn('w-5 h-5', scoreColor.class)} />
            <h2 className="text-lg font-bold text-foreground">
              {t.zenScore || 'Zen Score'}
            </h2>
          </div>

          {/* Weekly change badge */}
          {weeklyChange !== 0 && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              weeklyChange > 0
                ? 'bg-[hsl(var(--mood-good))]/15 text-[hsl(var(--mood-good))]'
                : 'bg-destructive/15 text-destructive'
            )}>
              {weeklyChange > 0 ? (
                <TrendingUp className="w-3 h-3 animate-trend-up" />
              ) : (
                <TrendingDown className="w-3 h-3 animate-trend-down" />
              )}
              <span>{weeklyChange > 0 ? '+' : ''}{weeklyChange}%</span>
            </div>
          )}
        </div>

        {/* Score ring */}
        <div className="flex flex-col items-center py-4">
          <div className="relative w-40 h-40">
            {/* Background ring */}
            <svg
              className="w-full h-full -rotate-90"
              viewBox="0 0 100 100"
            >
              {/* Track */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="8"
                className="stroke-muted/30"
              />

              {/* Progress arc */}
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                stroke={scoreColor.glow}
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                style={{
                  filter: `drop-shadow(0 0 8px ${scoreColor.glow})`
                }}
              />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className={cn(
                  'text-5xl font-bold tabular-nums',
                  scoreColor.class
                )}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5, type: 'spring' }}
              >
                {animatedScore}
              </motion.span>
              <span className="text-xs text-muted-foreground mt-1">
                {getScoreLabel(zenScore, t)}
              </span>
            </div>
          </div>
        </div>

        {/* Expand button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2',
            'text-sm text-muted-foreground hover:text-foreground',
            'transition-colors'
          )}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? (t.showLess || 'Show less') : (t.zenScoreTapToExpand || 'Tap to see breakdown')}
        >
          <span>{isExpanded ? (t.showLess || 'Show less') : (t.seeBreakdown || 'See breakdown')}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {/* Breakdown section */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-4 gap-2 pt-4 border-t border-border/50">
                {breakdownItems.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="text-center"
                  >
                    <span className="text-xl" role="img" aria-label={item.label}>
                      {item.emoji}
                    </span>
                    <p className={cn('text-lg font-bold tabular-nums', item.color)}>
                      {item.value}{item.suffix || '%'}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default ZenScoreHub;
