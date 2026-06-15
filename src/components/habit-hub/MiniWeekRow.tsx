/**
 * MiniWeekRow — 7-day compact calendar row for HabitHubCard.
 * Shows current ISO week (Mon-Sun) with weekday labels and MiniCheckmarkCell toggles.
 * Uses computeEntriesWithAuto for non-daily boolean habits (YES_AUTO display).
 */

import { memo, useMemo, useCallback } from "react";
import { cn, getToday } from "@/lib/utils";
import { formatHabitValue, getNumericalValue } from "@/lib/habits";
import { computeEntriesWithAuto } from "@/lib/habitComputedEntries";
import { hapticTap } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getNumericalActionDelta,
  getNumericalQuickEntryAction,
  getNumericalWeekCellDelta,
  type NumericalEntryAction,
} from "@/lib/habitNumericalInteraction";
import { isHabitDueOnDate } from "@/lib/habitScheduling";
import { ENTRY } from "@/types";
import type { Habit } from "@/types";
import { MiniCheckmarkCell } from "./MiniCheckmarkCell";

interface MiniWeekRowProps {
  habit: Habit;
  habitColor: string; // resolved hex
  roleAccent?: {
    color: string;
    softBg: string;
    strongBg: string;
    border: string;
    mutedBg: string;
  };
  onToggle: (habitId: string, date: string) => void;
  onAdjust?: (habitId: string, date: string, delta: number) => void;
  onNumericalAction?: (habitId: string, date: string, action: NumericalEntryAction) => void;
  tone?: "hub" | "hero";
  interactionScope?: "history" | "today";
}

// DOW_LABELS moved inside component for i18n (see useMemo below)

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Get current ISO week (Mon-Sun) as date strings. Derives from getToday() for timezone safety (Law 19). */
function getCurrentISOWeek(todayStr: string): string[] {
  const days: string[] = [];
  const [y, m, d] = todayStr.split("-").map(Number);
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
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export const MiniWeekRow = memo(function MiniWeekRow({
  habit,
  habitColor,
  roleAccent,
  onToggle,
  onAdjust,
  onNumericalAction,
  tone = "hub",
  interactionScope = "history",
}: MiniWeekRowProps) {
  const { t, language } = useLanguage();
  const today = getToday();

  const DOW_LABELS = useMemo(
    () => [t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat, t.daySun],
    [t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat, t.daySun]
  );
  const isNumerical = habit.habitType === "numerical";

  const days = useMemo(() => getCurrentISOWeek(today), [today]);
  const computedEntries = useMemo(
    () => (interactionScope === "today" ? (habit.entries ?? {}) : computeEntriesWithAuto(habit)),
    [habit, interactionScope],
  );

  const getEntryVal = useCallback(
    (date: string): number => {
      return computedEntries[date]?.value ?? ENTRY.UNKNOWN;
    },
    [computedEntries]
  );

  const getNumericDisplay = useCallback(
    (date: string): string => {
      const val = getNumericalValue(habit, date);
      const hasEntry = Boolean(habit.entries?.[date]);
      if (val === 0 && !hasEntry) return "";
      return formatHabitValue(val, language);
    },
    [habit, language]
  );

  const handleTap = useCallback(
    (date: string) => {
      if (interactionScope === "today" && date !== today) return;
      if (!isHabitDueOnDate(habit, date)) return;
      void hapticTap();
      if (isNumerical && onAdjust) {
        const currentValue = getNumericalValue(habit, date);
        const hasEntry = Boolean(habit.entries?.[date]);
        const mode = interactionScope === "today" ? "quickToggle" : "increment";
        if (mode === "quickToggle" && onNumericalAction) {
          onNumericalAction(habit.id, date, getNumericalQuickEntryAction(habit, currentValue, hasEntry));
          return;
        }
        onAdjust(habit.id, date, getNumericalWeekCellDelta(habit, currentValue, mode));
      } else if (isNumerical && onNumericalAction) {
        const currentValue = getNumericalValue(habit, date);
        const hasEntry = Boolean(habit.entries?.[date]);
        const action = getNumericalQuickEntryAction(habit, currentValue, hasEntry);
        const delta = getNumericalActionDelta(action, currentValue);
        if (delta !== null && onAdjust) {
          onAdjust(habit.id, date, delta);
          return;
        }
        onNumericalAction(habit.id, date, action);
      } else {
        onToggle(habit.id, date);
      }
    },
    [habit, interactionScope, isNumerical, onToggle, onAdjust, onNumericalAction, today]
  );

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
                "min-w-[44px] text-center text-[10px] leading-none",
                tone === "hero"
                  ? isToday
                    ? "font-medium text-foreground/80"
                    : "text-muted-foreground"
                  : isToday
                    ? "text-white/60 font-medium"
                    : "text-white/40"
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
            roleAccent={roleAccent}
            isToday={date === today}
            isFuture={date > today}
            isLocked={(interactionScope === "today" && date !== today) || !isHabitDueOnDate(habit, date)}
            isNumerical={isNumerical}
            numericDisplay={isNumerical ? getNumericDisplay(date) : undefined}
            onTap={() => handleTap(date)}
          />
        ))}
      </div>
    </div>
  );
});
