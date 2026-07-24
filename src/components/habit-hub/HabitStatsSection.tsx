/**
 * HabitStatsSection — Loop-style statistics dashboard for a single habit.
 * 2x2 grid: Total completions | Best streak | Current streak | This month.
 * Deep Space aesthetic.
 */

import { useMemo } from 'react';
import { Hash, Flame, Trophy, CalendarDays } from 'lucide-react';
import type { HabitStreak } from '@/lib/habitScore';
import type { HabitStatsSnapshot } from '@/lib/habitStatsSnapshot';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
interface HabitStatsSectionProps {
  /** Pre-computed from parent to avoid redundant computation */
  currentStreak: number;
  allStreaks: HabitStreak[];
  completedDates: string[];
  snapshot?: HabitStatsSnapshot;
}

export function HabitStatsSection({ currentStreak, allStreaks, completedDates, snapshot }: HabitStatsSectionProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const stats = useMemo(() => {
    if (snapshot) {
      return {
        total: snapshot.totalCompleted,
        currentStreak: snapshot.currentStreak,
        bestStreak: snapshot.bestStreak,
        thisMonth: snapshot.thisMonthCompleted,
        daysInMonth: snapshot.daysInMonth,
        weekPace: snapshot.periods[0]?.percentToDate ?? 0,
      };
    }

    const total = completedDates.length;
    const bestStreak = allStreaks.length > 0
      ? Math.max(...allStreaks.map(s => s.length))
      : 0;

    // This month completions
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = completedDates.filter(d => d.startsWith(yearMonth)).length;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    return { total, currentStreak, bestStreak, thisMonth, daysInMonth, weekPace: 0 };
  }, [completedDates, allStreaks, currentStreak, snapshot]);

  const cells = [
    {
      icon: Hash,
      value: stats.total,
      label: ts.statsTotal || 'Total',
      color: 'text-violet-400',
    },
    {
      icon: Flame,
      value: stats.currentStreak,
      suffix: 'd',
      label: ts.currentStreak || 'Current',
      color: 'text-orange-400',
    },
    {
      icon: Trophy,
      value: stats.bestStreak,
      suffix: 'd',
      label: ts.bestStreak || 'Best',
      color: 'text-amber-400',
    },
    {
      icon: CalendarDays,
      value: Math.round(stats.weekPace),
      suffix: '%',
      label: ts.habitStatsPace || ts.thisMonth || 'Pace',
      color: 'text-cyan-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className={cn(
            'flex items-center gap-3 px-3 py-3 rounded-xl',
            'bg-white/[0.03] border border-white/[0.06]',
          )}
        >
          <cell.icon className={cn('w-4 h-4 flex-shrink-0', cell.color)} />
          <div className="min-w-0">
            <div className="text-lg font-bold text-foreground tabular-nums leading-tight">
              {cell.value}{cell.suffix || ''}
            </div>
            <div className="whitespace-normal break-words text-xs leading-tight text-muted-foreground">
              {cell.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
