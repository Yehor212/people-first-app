/**
 * HabitHubCard — Hybrid card with mini 7-day calendar row.
 *
 * Layout (3 sections):
 *   Row 1 (Header):  ScoreRing(16px) + Icon + Name(colored) + Score%
 *   Row 2 (Week):    MiniWeekRow — 7 checkmark/value cells
 *   Row 3 (Footer):  Streak badge (boolean) / Progress bar (numerical)
 *
 * Deep Space aesthetic. 44px WCAG touch targets on cells.
 */

import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn, getToday } from '@/lib/utils';
import { zenMotion } from '@/lib/animationUtils';
import { hapticTap } from '@/lib/haptics';
import { resolveHabitColor } from '@/lib/habitColorUtils';
import { isHabitCompletedOnDate, getNumericalValue } from '@/lib/habits';
import { getCurrentStreak } from '@/lib/habitScore';
import { useLanguage } from '@/contexts/LanguageContext';
import { AnimatedFire } from '@/components/compact-habit-card/AnimatedFire';
import { ScoreRing } from './ScoreRing';
import { MiniWeekRow } from './MiniWeekRow';
import type { Habit } from '@/types';

interface HabitHubCardProps {
  habit: Habit;
  score: number;
  onToggle: (habitId: string, date: string) => void;
  onAdjust?: (habitId: string, date: string, delta: number) => void;
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
  onAdjust,
  onSelect,
  className,
}: HabitHubCardProps) {
  const { t } = useLanguage();
  const today = getToday();
  const isCompleted = isHabitCompletedOnDate(habit, today);
  const streak = getCurrentStreak(habit);
  const scorePercent = Math.round(score * 100);
  const habitColor = resolveHabitColor(habit.color);

  // Numeric habit info
  const isNumeric = habit.habitType === 'numerical';
  const currentValue = isNumeric ? getNumericalValue(habit, today) : 0;
  const target = isNumeric ? habit.targetValue : 1;
  const progress = isNumeric && target > 0 ? Math.min(currentValue / target, 1) : 0;

  const handleSelect = useCallback(() => {
    void hapticTap();
    onSelect(habit);
  }, [habit, onSelect]);

  return (
    <motion.div
      onClick={handleSelect}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(); } }}
      tabIndex={0}
      role="button"
      aria-label={habit.name}
      className={cn(
        'w-full rounded-2xl text-left transition-colors cursor-pointer',
        'bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm',
        'hover:bg-white/[0.06] active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
        isCompleted && 'bg-emerald-500/[0.06] border-emerald-500/[0.12]',
        className,
      )}
      layout
      transition={zenMotion.snappy}
    >
      {/* ═══ ROW 1: HEADER ═══ */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-1">
        {/* Score ring */}
        <ScoreRing score={score} color={habitColor} size={16} />

        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{ backgroundColor: `${habitColor}18`, color: habitColor }}
        >
          {habit.icon}
        </div>

        {/* Name (colored by habit) */}
        <span
          className={cn(
            'flex-1 text-sm font-medium truncate min-w-0',
            isCompleted && 'line-through decoration-white/20 opacity-60',
          )}
          style={{ color: isCompleted ? undefined : habitColor }}
        >
          {habit.name}
        </span>

        {/* Score badge */}
        <div className={cn(
          'px-2 py-0.5 rounded-lg border text-xs font-semibold tabular-nums flex-shrink-0',
          getScoreBg(score),
          getScoreColor(score),
        )}>
          {scorePercent}%
        </div>
      </div>

      {/* ═══ ROW 2: MINI WEEK CALENDAR ═══ */}
      <div
        className="px-3.5 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <MiniWeekRow
          habit={habit}
          habitColor={habitColor}
          onToggle={onToggle}
          onAdjust={onAdjust}
        />
      </div>

      {/* ═══ ROW 3: FOOTER (streak or progress bar) ═══ */}
      <div className="px-3.5 pb-2.5">
        {isNumeric ? (
          /* Numerical: progress bar + value label */
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(progress * 100, 100)}%`,
                  backgroundColor: isCompleted ? '#22C55E' : habitColor,
                }}
              />
            </div>
            <span className="text-[10px] font-medium tabular-nums text-slate-400 flex-shrink-0">
              {currentValue % 1 === 0 ? currentValue : currentValue.toFixed(1)}/{target}{habit.unit ? ` ${habit.unit}` : ''}
            </span>
          </div>
        ) : (
          /* Boolean: streak badge */
          streak > 0 ? (
            <div className="flex items-center gap-1">
              <AnimatedFire intensity={Math.min(streak / 7, 3)} size="sm" />
              <span className="text-xs font-medium text-orange-400/70 tabular-nums">
                {streak}{t.dStreak}
              </span>
            </div>
          ) : null
        )}
      </div>
    </motion.div>
  );
});
