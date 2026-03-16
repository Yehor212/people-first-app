/**
 * HabitTargetCard — Progress rings showing target completion by time interval.
 * NUMERICAL HABITS ONLY.
 *
 * Shows 3 rings: This Week / This Month / This Year
 * For each: actual value sum / expected based on frequency.
 * Uses existing ProgressRing component. Deep Space aesthetic.
 */

import { useMemo } from 'react';
import { ProgressRing } from '@/components/ui/progress-ring';
import { useLanguage } from '@/contexts/LanguageContext';
import { ENTRY } from '@/types';
import type { Habit } from '@/types';

interface HabitTargetCardProps {
  habit: Habit;
  className?: string;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface IntervalStat {
  label: string;
  actual: number;
  expected: number;
  percent: number;
}

function computeIntervalStats(habit: Habit): IntervalStat[] {
  const now = new Date();
  const today = toDateStr(now);

  // Week start (Monday)
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  const weekStartStr = toDateStr(weekStart);

  // Month start
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  // Year start
  const yearStart = `${now.getFullYear()}-01-01`;

  const { numerator, denominator } = habit.frequency;

  // Count completed entries in a range and sum their real values
  function sumInRange(start: string, end: string): number {
    let sum = 0;
    for (const [date, entry] of Object.entries(habit.entries)) {
      if (date >= start && date <= end && entry.value > 0 && entry.value !== ENTRY.SKIP) {
        sum += entry.value / 1000;
      }
    }
    return sum;
  }

  // Calculate expected value for a time range
  function expectedForDays(days: number): number {
    // Expected = (days / denominator) * numerator * targetValue
    // Simplified: how many "cycles" fit in the period × target per cycle
    return (days / denominator) * numerator * habit.targetValue;
  }

  // Days elapsed in each interval
  const daysInWeek = Math.min(7, Math.round((now.getTime() - weekStart.getTime()) / 86400000) + 1);
  const daysInMonth = now.getDate();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const daysInYear = Math.round((now.getTime() - startOfYear.getTime()) / 86400000) + 1;

  const weekActual = sumInRange(weekStartStr, today);
  const monthActual = sumInRange(monthStart, today);
  const yearActual = sumInRange(yearStart, today);

  const weekExpected = expectedForDays(daysInWeek);
  const monthExpected = expectedForDays(daysInMonth);
  const yearExpected = expectedForDays(daysInYear);

  function pct(actual: number, expected: number): number {
    if (expected <= 0) return actual > 0 ? 100 : 0;
    if (habit.targetType === 'atMost') {
      // For atMost: 100% when at/under, decreasing when over
      return Math.max(0, Math.min(100, (1 - (actual - expected) / expected) * 100));
    }
    return Math.min(100, (actual / expected) * 100);
  }

  return [
    { label: 'Week', actual: weekActual, expected: weekExpected, percent: pct(weekActual, weekExpected) },
    { label: 'Month', actual: monthActual, expected: monthExpected, percent: pct(monthActual, monthExpected) },
    { label: 'Year', actual: yearActual, expected: yearExpected, percent: pct(yearActual, yearExpected) },
  ];
}

export function HabitTargetCard({ habit, className }: HabitTargetCardProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const stats = useMemo(() => computeIntervalStats(habit), [habit]);

  // Guard: only for numerical habits with target
  if (habit.habitType !== 'numerical' || habit.targetValue <= 0) return null;

  const intervalLabels: Record<string, string> = {
    Week: ts.thisWeek || 'Week',
    Month: ts.thisMonth || 'Month',
    Year: ts.thisYear || 'Year',
  };

  return (
    <div className={className}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {ts.targetProgress || 'Target Progress'}
      </h4>
      <div className="flex items-center justify-around py-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1.5">
            <ProgressRing
              progress={stat.percent}
              size="sm"
              showPercentage
              color={stat.percent >= 80 ? 'success' : stat.percent >= 40 ? 'warning' : 'primary'}
            />
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">{intervalLabels[stat.label]}</div>
              <div className="text-[10px] font-medium text-muted-foreground tabular-nums">
                {stat.actual % 1 === 0 ? stat.actual : stat.actual.toFixed(1)}
                /{stat.expected % 1 === 0 ? stat.expected : stat.expected.toFixed(0)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
