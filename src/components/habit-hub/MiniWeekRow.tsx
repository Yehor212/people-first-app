/**
 * MiniWeekRow — 7-day compact calendar row for HabitHubCard.
 * Shows current ISO week (Mon-Sun) with weekday labels and MiniCheckmarkCell toggles.
 * Uses computeEntriesWithAuto for non-daily boolean habits (YES_AUTO display).
 */

import { memo, useMemo, useCallback } from 'react';
import { cn, getToday } from '@/lib/utils';
import { getNumericalValue } from '@/lib/habits';
import { computeEntriesWithAuto } from '@/lib/habitComputedEntries';
import { hapticTap } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { ENTRY } from '@/types';
import type { Habit } from '@/types';
import { MiniCheckmarkCell } from './MiniCheckmarkCell';

interface MiniWeekRowProps {
  habit: Habit;
  habitColor: string;  // resolved hex
  onToggle: (habitId: string, date: string) => void;
  onAdjust?: (habitId: string, date: string, delta: number) => void;
}

// DOW_LABELS moved inside component for i18n (see useMemo below)

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get current ISO week (Mon-Sun) as date strings. Derives from getToday() for timezone safety (Law 19). */
function getCurrentISOWeek(todayStr: string): string[] {
  const days: string[] = [];
  const [y, m, d] = todayStr.split('-').map(Number);
  const today = new Date(y, m - 1, d);
  const dow = today.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(monday.getDate() + mondayOffset);
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(dd.getDate() + i);
    days.push(toDateStr(dd));
  }
  return days;
}

/** Map JS getDay() (0=Sun) to Mon-first index (Mon=0, Sun=6) */
function getDowIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export const MiniWeekRow = memo(function MiniWeekRow({
  habit,
  habitColor,
  onToggle,
  onAdjust,
}: MiniWeekRowProps) {
  const { t } = useLanguage();
  const today = getToday();

  const DOW_LABELS = useMemo(() => [
    t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat, t.daySun,
  ], [t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat, t.daySun]);
  const isNumerical = habit.habitType === 'numerical';

  const days = useMemo(() => getCurrentISOWeek(today), [today]);
  const computedEntries = useMemo(() => computeEntriesWithAuto(habit), [habit]);

  const getEntryVal = useCallback((date: string): number => {
    return computedEntries[date]?.value ?? ENTRY.UNKNOWN;
  }, [computedEntries]);

  const getNumericDisplay = useCallback((date: string): string => {
    const val = getNumericalValue(habit, date);
    if (val === 0) return '';
    return val % 1 === 0 ? String(val) : val.toFixed(1);
  }, [habit]);

  const handleTap = useCallback((date: string) => {
    void hapticTap();
    if (isNumerical && onAdjust) {
      onAdjust(habit.id, date, 1);
    } else {
      onToggle(habit.id, date);
    }
  }, [habit.id, isNumerical, onToggle, onAdjust]);

  return (
    <div className="flex flex-col gap-0.5">
      {/* Weekday labels */}
      <div className="flex justify-between">
        {days.map((date) => {
          const dow = getDowIndex(date);
          const isToday = date === today;
          return (
            <div
              key={`label-${date}`}
              className={cn(
                'min-w-[44px] text-center text-[10px] leading-none',
                isToday ? 'text-white/60 font-medium' : 'text-white/40',
              )}
            >
              {DOW_LABELS[dow]}
            </div>
          );
        })}
      </div>
      {/* Cells */}
      <div className="flex justify-between">
        {days.map((date) => (
          <MiniCheckmarkCell
            key={date}
            date={date}
            value={getEntryVal(date)}
            habitColor={habitColor}
            isToday={date === today}
            isFuture={date > today}
            isNumerical={isNumerical}
            numericDisplay={isNumerical ? getNumericDisplay(date) : undefined}
            onTap={() => handleTap(date)}
          />
        ))}
      </div>
    </div>
  );
});
