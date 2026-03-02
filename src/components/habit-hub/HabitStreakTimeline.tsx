/**
 * HabitStreakTimeline — Top 5 historical streaks with fire icon for the current one.
 * Clean, minimal rows. Deep Space aesthetic.
 */

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { computeAllStreaks, getCurrentStreak, type HabitStreak } from '@/lib/habitScore';
import { AnimatedFire } from '@/components/compact-habit-card/AnimatedFire';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Habit } from '@/types';

interface HabitStreakTimelineProps {
  habit: Habit;
  className?: string;
}

function formatDateRange(start: string, end: string): string {
  const fmt = (s: string) => {
    const [, m, d] = s.split('-');
    return `${d}.${m}`;
  };
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export const HabitStreakTimeline = memo(function HabitStreakTimeline({
  habit,
  className,
}: HabitStreakTimelineProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const { streaks, currentLen, bestLen } = useMemo(() => {
    const all = computeAllStreaks(habit);
    const current = getCurrentStreak(habit);
    const best = all.length > 0 ? all[0].length : 0;
    return { streaks: all.slice(0, 5), currentLen: current, bestLen: best };
  }, [habit]);

  if (streaks.length === 0) {
    return (
      <div className={cn('', className)}>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {ts.streakHistory || 'Streaks'}
        </h4>
        <p className="text-xs text-slate-600 py-4 text-center">{ts.noStreaksYet || 'No streaks yet'}</p>
      </div>
    );
  }

  return (
    <div className={cn('', className)}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        {ts.streakHistory || 'Streaks'}
      </h4>

      {/* Summary badges */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <AnimatedFire intensity={1} size="sm" />
          <span>{ts.currentStreak || 'Current'}: <strong className="text-slate-200">{currentLen}d</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="text-amber-400">★</span>
          <span>{ts.bestStreak || 'Best'}: <strong className="text-slate-200">{bestLen}d</strong></span>
        </div>
      </div>

      {/* Streak rows */}
      <div className="space-y-1.5">
        {streaks.map((streak: HabitStreak, i: number) => {
          const isCurrent = i === 0 && streak.length === currentLen && currentLen > 0;
          // Check if this is the "current" streak — the most recent one matching currentLen
          return (
            <div
              key={`${streak.start}-${streak.end}`}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl',
                'bg-white/[0.02] border border-white/[0.04]',
                isCurrent && 'bg-orange-500/[0.06] border-orange-500/[0.1]',
              )}
            >
              {/* Rank */}
              <span className="text-[10px] font-semibold text-slate-600 w-4 text-center">
                {i + 1}
              </span>

              {/* Fire for current */}
              <div className="w-5 flex items-center justify-center">
                {isCurrent ? (
                  <AnimatedFire intensity={Math.min(streak.length / 7, 3)} size="sm" />
                ) : (
                  <span className="text-xs text-slate-700">—</span>
                )}
              </div>

              {/* Date range */}
              <span className="flex-1 text-xs text-slate-400 font-mono">
                {formatDateRange(streak.start, streak.end)}
              </span>

              {/* Length */}
              <span className={cn(
                'text-xs font-bold tabular-nums',
                isCurrent ? 'text-orange-400' : 'text-slate-300',
              )}>
                {streak.length}d
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
