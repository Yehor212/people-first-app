/**
 * HabitFrequencyChart — Recharts BarChart showing completions by day of week.
 * Deep Space aesthetic: transparent bg, habit color bars, subtle grid.
 */

import { memo, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { getFrequencyByWeekday } from '@/lib/habitScore';
import { resolveHabitColor } from '@/lib/habitColorUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Habit } from '@/types';

interface HabitFrequencyChartProps {
  habit: Habit;
  className?: string;
}

export const HabitFrequencyChart = memo(function HabitFrequencyChart({
  habit,
  className,
}: HabitFrequencyChartProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const dayLabels = useMemo(() => [
    t.daySun, t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat,
  ], [t.daySun, t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat]);

  const data = useMemo(() => {
    const counts = getFrequencyByWeekday(habit);
    // Reorder to Mon-first: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    const reordered = [counts[1], counts[2], counts[3], counts[4], counts[5], counts[6], counts[0]];
    const labels = [dayLabels[1], dayLabels[2], dayLabels[3], dayLabels[4], dayLabels[5], dayLabels[6], dayLabels[0]];
    return reordered.map((count, i) => ({ day: labels[i], count }));
  }, [habit, dayLabels]);

  const maxCount = useMemo(() => Math.max(...data.map(d => d.count), 1), [data]);

  return (
    <div className={cn('', className)}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        {ts.weekdayFrequency || 'By Day of Week'}
      </h4>

      <div className="h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Inter, sans-serif' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 9, fontFamily: 'Inter, sans-serif' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            >
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={resolveHabitColor(habit.color)}
                  fillOpacity={0.3 + (entry.count / maxCount) * 0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
