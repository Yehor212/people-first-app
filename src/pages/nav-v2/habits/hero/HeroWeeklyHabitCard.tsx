import { memo, useMemo } from "react";
import { AnimatedFire } from "@/components/compact-habit-card/AnimatedFire";
import { MiniWeekRow } from "@/components/habit-hub/MiniWeekRow";
import { useLanguage } from "@/contexts/LanguageContext";
import { frequencyPresets } from "@/hooks/useHabitForm";
import { resolveHabitColor } from "@/lib/habitColorUtils";
import { getHabitPlanState } from "@/lib/habitPlan";
import { formatHabitValue, getNumericalValue, isHabitCompletedOnDate } from "@/lib/habits";
import { getCurrentStreak } from "@/lib/habitScore";
import { getToday } from "@/lib/utils";
import type { Habit } from "@/types";

function getCurrentISOWeek(todayStr: string): string[] {
  const [year, month, day] = todayStr.split("-").map(Number);
  const today = new Date(year, month - 1, day);
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(monday.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
}

interface HeroWeeklyHabitCardProps {
  habit: Habit;
  onToggle: (habitId: string, date: string) => void;
  onAdjust?: (habitId: string, date: string, delta: number) => void;
  onOpenDetail?: (habit: Habit) => void;
}

export const HeroWeeklyHabitCard = memo(function HeroWeeklyHabitCard({
  habit,
  onToggle,
  onAdjust,
  onOpenDetail,
}: HeroWeeklyHabitCardProps) {
  const { t, language } = useLanguage();
  const today = getToday();
  const habitColor = resolveHabitColor(habit.color);
  const isCompletedToday = isHabitCompletedOnDate(habit, today);
  const streak = useMemo(() => getCurrentStreak(habit), [habit]);
  const isNumeric = habit.habitType === "numerical";
  const weekDates = useMemo(() => getCurrentISOWeek(today), [today]);
  const planState = useMemo(() => getHabitPlanState(habit, today), [habit, today]);

  const currentValue = isNumeric ? getNumericalValue(habit, today) : 0;
  const targetValue = habit.targetValue || 1;
  const numericSummary = isNumeric
    ? `${formatHabitValue(currentValue, language)}/${formatHabitValue(targetValue, language)}${habit.unit ? ` ${habit.unit}` : ""}`
    : null;
  const weekSummary = useMemo(() => {
    const thisWeekLabel = t.thisWeek || "This week";
    if (isNumeric) {
      const total = weekDates.reduce(
        (sum, date) => sum + getNumericalValue(habit, date),
        0,
      );
      return `${formatHabitValue(total, language)}${habit.unit ? ` ${habit.unit}` : ""} · ${thisWeekLabel}`;
    }

    const done = weekDates.reduce(
      (sum, date) => sum + (isHabitCompletedOnDate(habit, date) ? 1 : 0),
      0,
    );
    return `${done}x · ${thisWeekLabel}`;
  }, [habit, isNumeric, language, t.thisWeek, weekDates]);

  const freqLabel = useMemo(() => {
    const { numerator: n, denominator: d } = habit.frequency;
    const ts = t as unknown as Record<string, string>;
    const preset = frequencyPresets.find(
      (item) => item.ratio.numerator === n && item.ratio.denominator === d,
    );
    if (preset) return ts[preset.i18nKey] || preset.label;
    return `${n}x / ${d}${ts.daysAbbr || "d"}`;
  }, [habit.frequency, t]);

  const planLabel = planState
    ? planState.isComplete
      ? t.completed || "Completed"
      : `${planState.remainingDays} ${t.daysLeft || "days left"}`
    : null;
  const planSubLabel = planState
    ? `${planState.durationDays}-${(t as unknown as Record<string, string>).habitDurationDaysLabel || "day"} ${(t as unknown as Record<string, string>).habitPlanLabel || "plan"}`
    : null;

  return (
    <article
      role="listitem"
      aria-label={habit.icon ? `${habit.icon} ${habit.name}` : habit.name}
      className="rounded-[26px] border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm"
      data-testid={`hero-weekly-card-${habit.id}`}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg"
            style={{
              backgroundColor: `${habitColor}1c`,
              color: habitColor,
            }}
            aria-hidden="true"
          >
            {habit.icon}
          </div>
          <div className="min-w-0">
            <p
              className={
                "truncate text-sm font-semibold leading-tight md:text-base " +
                (isCompletedToday ? "text-foreground/70" : "text-foreground")
              }
              title={habit.name}
            >
              {habit.name}
            </p>
            {planSubLabel ? (
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {planSubLabel}
                {planLabel ? ` · ${planLabel}` : ""}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {numericSummary ? (
            <span
              className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground"
              data-testid={`hero-weekly-card-${habit.id}-summary`}
            >
              {numericSummary}
            </span>
          ) : null}
          {!numericSummary && planLabel ? (
            <span
              className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              data-testid={`hero-weekly-card-${habit.id}-plan`}
            >
              {planLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="px-4 pt-3" onClick={(e) => e.stopPropagation()}>
        <MiniWeekRow
          habit={habit}
          habitColor={habitColor}
          onToggle={onToggle}
          onAdjust={onAdjust}
          tone="hero"
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-4 text-[11px] text-muted-foreground">
        <div
          className="min-h-[20px] tabular-nums"
          data-testid={`hero-weekly-card-${habit.id}-streak`}
        >
          {streak > 0 ? (
            <span className="inline-flex items-center gap-1">
              <AnimatedFire intensity={Math.min(1 + streak / 7, 3)} size="sm" />
              <span className="font-medium text-orange-500/90">
                {streak}
                {t.dStreak}
              </span>
            </span>
          ) : null}
        </div>
        <span
          className="truncate text-right tabular-nums"
          data-testid={`hero-weekly-card-${habit.id}-meta`}
        >
          {weekSummary || freqLabel}
        </span>
        {onOpenDetail && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(habit);
            }}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-border/60 bg-background/80 px-3 py-2 text-[11px] font-medium text-foreground motion-safe:transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            data-testid={`hero-weekly-card-${habit.id}-stats`}
          >
            {t.statistics || "Statistics"}
          </button>
        )}
      </div>
    </article>
  );
});
