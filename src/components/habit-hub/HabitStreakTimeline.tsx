/**
 * HabitStreakTimeline — Top 5 historical streaks with fire icon for the current one.
 * Clean, minimal rows. Deep Space aesthetic.
 */

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { HabitStreak } from '@/lib/habitScore';
import { AnimatedFire } from '@/components/compact-habit-card/AnimatedFire';
import { useLanguage } from '@/contexts/LanguageContext';
interface HabitStreakTimelineProps {
  /** Pre-computed from parent to avoid redundant computation */
  allStreaks: HabitStreak[];
  currentStreak: number;
  className?: string;
}

function formatShortDate(date: string, locale: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
    new Date(year, month - 1, day),
  );
}

export const HabitStreakTimeline = memo(function HabitStreakTimeline({
  allStreaks,
  currentStreak,
  className,
}: HabitStreakTimelineProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const { streaks, currentLen, bestLen } = useMemo(() => {
    const best = allStreaks.length > 0 ? Math.max(...allStreaks.map(s => s.length)) : 0;
    return { streaks: allStreaks.slice(0, 5), currentLen: currentStreak, bestLen: best };
  }, [allStreaks, currentStreak]);

  if (streaks.length === 0) {
    return (
      <div className={cn('@container', className)}>
        <h4 className="mb-3 whitespace-normal break-words text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {ts.streakHistory || 'Streaks'}
        </h4>
        <p className="whitespace-normal break-words py-4 text-center text-xs text-muted-foreground/60">
          {ts.noStreaksYet || 'No streaks yet'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('@container', className)}>
      <h4 className="mb-3 whitespace-normal break-words text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {ts.streakHistory || 'Streaks'}
      </h4>

      {/* Summary badges */}
      <div className="mb-3 grid grid-cols-1 gap-2 @sm:grid-cols-2">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-1.5 text-xs text-muted-foreground">
          <AnimatedFire intensity={1} size="sm" />
          <span className="min-w-0 whitespace-normal break-words leading-relaxed">
            {ts.currentStreak || 'Current'}:{' '}
            <strong className="inline-block whitespace-nowrap text-foreground">
              {currentLen}{ts.daysAbbr || 'd'}
            </strong>
          </span>
        </div>
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-1.5 text-xs text-muted-foreground">
          <span className="text-amber-400">★</span>
          <span className="min-w-0 whitespace-normal break-words leading-relaxed">
            {ts.bestStreak || 'Best'}:{' '}
            <strong className="inline-block whitespace-nowrap text-foreground">
              {bestLen}{ts.daysAbbr || 'd'}
            </strong>
          </span>
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
                'grid grid-cols-[minmax(1.5rem,auto)_1.25rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded-xl px-3 py-2 @sm:grid-cols-[minmax(1.5rem,auto)_1.25rem_minmax(0,1fr)_auto]',
                'bg-white/[0.02] border border-white/[0.04]',
                isCurrent && 'bg-orange-500/[0.06] border-orange-500/[0.1]',
              )}
            >
              {/* Rank */}
              <span className="min-w-0 text-center text-xs font-semibold text-muted-foreground/60">
                {i + 1}
              </span>

              {/* Fire for current */}
              <div className="w-5 flex items-center justify-center">
                {isCurrent ? (
                  <AnimatedFire intensity={Math.min(streak.length / 7, 3)} size="sm" />
                ) : (
                  <span className="text-xs text-muted-foreground/60">—</span>
                )}
              </div>

              {/* Date range */}
              <span className="col-span-3 row-start-2 min-w-0 whitespace-normal break-words text-start text-xs font-mono leading-relaxed text-muted-foreground @sm:col-span-1 @sm:col-start-3 @sm:row-start-1">
                <time
                  dateTime={streak.start}
                  dir="auto"
                  className="inline whitespace-nowrap [unicode-bidi:isolate]"
                >
                  {formatShortDate(streak.start, language)}
                </time>
                {streak.start !== streak.end && (
                  <>
                    <span> – </span>
                    <time
                      dateTime={streak.end}
                      dir="auto"
                      className="inline whitespace-nowrap [unicode-bidi:isolate]"
                    >
                      {formatShortDate(streak.end, language)}
                    </time>
                  </>
                )}
              </span>

              {/* Length */}
              <span className={cn(
                'col-start-3 row-start-1 justify-self-end whitespace-nowrap text-end text-xs font-bold tabular-nums @sm:col-start-4',
                isCurrent ? 'text-orange-400' : 'text-muted-foreground',
              )}>
                {streak.length}{ts.daysAbbr || 'd'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
