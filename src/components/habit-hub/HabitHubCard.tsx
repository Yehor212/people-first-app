/**
 * HabitHubCard — Individual habit row in the Habit Hub.
 * Shows icon, name, score badge, streak fire, and a quick-toggle checkmark.
 * Tap opens detail sheet. Deep Space aesthetic.
 */

import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, SkipForward } from 'lucide-react';
import { cn, getToday } from '@/lib/utils';
import { zenMotion } from '@/lib/animationUtils';
import { hapticTap } from '@/lib/haptics';
import { AnimatedFire } from '@/components/compact-habit-card/AnimatedFire';
import { getHabitStreak } from '@/components/habit-tracker/habitStreakUtils';
import type { Habit } from '@/types';

interface HabitHubCardProps {
  habit: Habit;
  score: number;
  onToggle: (habitId: string, date: string) => void;
  onSelect: (habit: Habit) => void;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'text-emerald-400';
  if (score >= 0.5) return 'text-amber-400';
  if (score >= 0.2) return 'text-orange-400';
  return 'text-slate-500';
}

function getScoreBg(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500/15 border-emerald-500/20';
  if (score >= 0.5) return 'bg-amber-500/15 border-amber-500/20';
  if (score >= 0.2) return 'bg-orange-500/15 border-orange-500/20';
  return 'bg-slate-500/10 border-slate-500/15';
}

export const HabitHubCard = memo(function HabitHubCard({
  habit,
  score,
  onToggle,
  onSelect,
  className,
}: HabitHubCardProps) {
  const today = getToday();
  const isCompleted = habit.completedDates?.includes(today) ?? false;
  const isSkipped = habit.skippedDates?.includes(today) ?? false;
  const streak = getHabitStreak(habit);
  const scorePercent = Math.round(score * 100);

  const handleToggle = useCallback((e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    void hapticTap();
    onToggle(habit.id, today);
  }, [habit.id, today, onToggle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle(e);
    }
  }, [handleToggle]);

  const handleSelect = useCallback(() => {
    void hapticTap();
    onSelect(habit);
  }, [habit, onSelect]);

  return (
    <motion.button
      onClick={handleSelect}
      className={cn(
        'w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-colors',
        'bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm',
        'hover:bg-white/[0.06] active:scale-[0.98]',
        isCompleted && 'bg-emerald-500/[0.05] border-emerald-500/[0.1]',
        isSkipped && 'bg-blue-500/[0.05] border-blue-500/[0.1] opacity-60',
        className,
      )}
      layout
      transition={zenMotion.snappy}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: `${habit.color}20`, color: habit.color }}
      >
        {habit.icon}
      </div>

      {/* Name + streak */}
      <div className="flex-1 min-w-0">
        <span className={cn(
          'text-sm font-medium truncate block',
          isCompleted ? 'text-emerald-300/80 line-through decoration-emerald-500/30' : 'text-slate-200',
          isSkipped && 'text-blue-300/60',
        )}>
          {habit.name}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          {streak > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-orange-400/80">
              <AnimatedFire intensity={Math.min(streak / 7, 3)} size="sm" />
              {streak}d
            </span>
          )}
          {isSkipped && (
            <span className="flex items-center gap-0.5 text-xs text-blue-400/60">
              <SkipForward className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      {/* Score badge */}
      <div className={cn(
        'px-2 py-0.5 rounded-lg border text-xs font-semibold tabular-nums flex-shrink-0',
        getScoreBg(score),
        getScoreColor(score),
      )}>
        {scorePercent}%
      </div>

      {/* Quick toggle checkmark — 44px WCAG minimum touch target */}
      <div
        onClick={handleToggle}
        onTouchEnd={(e) => { e.stopPropagation(); }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="checkbox"
        aria-checked={isCompleted}
        aria-label={`Toggle ${habit.name}`}
        className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
          'border-2 cursor-pointer',
          isCompleted
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
            : 'border-white/10 text-transparent hover:border-white/20',
        )}
      >
        <Check className="w-5 h-5" strokeWidth={3} />
      </div>
    </motion.button>
  );
});
