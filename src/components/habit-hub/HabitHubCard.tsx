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

import { memo, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { cn, getToday } from "@/lib/utils";
import { zenMotion } from "@/lib/animationUtils";
import { hapticTap } from "@/lib/haptics";
import { resolveHabitColor } from "@/lib/habitColorUtils";
import { isHabitCompletedOnDate, getNumericalValue } from "@/lib/habits";
import { getCurrentStreak } from "@/lib/habitScore";
import { computeEntriesWithAuto } from "@/lib/habitComputedEntries";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDecimal } from "@/lib/timeUtils";
import { frequencyPresets } from "@/hooks/useHabitForm";
import { AnimatedFire } from "@/components/compact-habit-card/AnimatedFire";
import { ScoreRing } from "./ScoreRing";
import { MiniWeekRow } from "./MiniWeekRow";
import { ENTRY } from "@/types";
import type { Habit } from "@/types";

interface HabitHubCardProps {
  habit: Habit;
  score: number;
  onToggle: (habitId: string, date: string) => void;
  onAdjust?: (habitId: string, date: string, delta: number) => void;
  onSelect: (habit: Habit) => void;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return "text-emerald-400";
  if (score >= 0.5) return "text-amber-400";
  if (score >= 0.2) return "text-orange-400";
  return "text-muted-foreground";
}

function getScoreBg(score: number): string {
  if (score >= 0.8) return "bg-emerald-500/15 border-emerald-500/20";
  if (score >= 0.5) return "bg-amber-500/15 border-amber-500/20";
  if (score >= 0.2) return "bg-orange-500/15 border-orange-500/20";
  return "bg-muted-foreground/10 border-muted-foreground/15";
}

export const HabitHubCard = memo(function HabitHubCard({
  habit,
  score,
  onToggle,
  onAdjust,
  onSelect,
  className,
}: HabitHubCardProps) {
  const { t, language } = useLanguage();
  const today = getToday();
  const isCompleted = isHabitCompletedOnDate(habit, today);
  const streak = useMemo(() => getCurrentStreak(habit), [habit]);
  const scorePercent = Math.round(score * 100);
  const habitColor = resolveHabitColor(habit.color);

  // Numeric habit info
  const isNumeric = habit.habitType === "numerical";
  const currentValue = isNumeric ? getNumericalValue(habit, today) : 0;
  const target = isNumeric ? habit.targetValue || 1 : 1;
  const progress = isNumeric && target > 0 ? Math.min(currentValue / target, 1) : 0;

  // Weekly progress for boolean habits (daily: "4/7", non-daily: "2/3")
  // Uses computeEntriesWithAuto so counter matches MiniWeekRow visual (includes YES_AUTO)
  const weeklyProgress = useMemo(() => {
    if (habit.habitType !== "boolean") return null;
    const { numerator, denominator } = habit.frequency;
    const isDaily = numerator === denominator;

    // Monday of current ISO week (same window as MiniWeekRow)
    const todayDate = new Date(today + "T00:00:00");
    const dow = todayDate.getDay(); // 0=Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(todayDate);
    monday.setDate(monday.getDate() + mondayOffset);

    const computed = computeEntriesWithAuto(habit);
    let count = 0;
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday);
      date.setDate(date.getDate() + d);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const val = computed[`${y}-${m}-${day}`]?.value;
      if (val === ENTRY.YES_MANUAL || val === ENTRY.YES_AUTO) count++;
    }

    return { done: count, target: isDaily ? 7 : numerator };
  }, [habit, today]);

  // Frequency label for footer (i18n-aware)
  const freqLabel = useMemo(() => {
    const { numerator: n, denominator: d } = habit.frequency;
    const ts = t as unknown as Record<string, string>;
    const preset = frequencyPresets.find(
      (p) => p.ratio.numerator === n && p.ratio.denominator === d
    );
    if (preset) return ts[preset.i18nKey] || preset.label;
    return `${n}× / ${d}${ts.daysAbbr || "d"}`;
  }, [habit.frequency, t]);

  const handleSelect = useCallback(() => {
    void hapticTap();
    onSelect(habit);
  }, [habit, onSelect]);

  return (
    <motion.div
      onClick={handleSelect}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={habit.name}
      className={cn(
        "w-full rounded-2xl text-start motion-safe:transition-colors cursor-pointer",
        "bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm",
        "hover:bg-white/[0.06] active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
        isCompleted && "bg-emerald-500/[0.06] border-emerald-500/[0.12]",
        className
      )}
      layout
      transition={zenMotion.snappy}
    >
      {/* ═══ ROW 1: HEADER ═══ */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-1">
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
            "flex-1 text-sm font-medium truncate min-w-0",
            isCompleted && "line-through decoration-white/20 opacity-60"
          )}
          style={{ color: isCompleted ? undefined : habitColor }}
        >
          {habit.name}
        </span>

        {/* Score badge — show weekly ratio when EMA is too low to be meaningful */}
        {scorePercent >= 5 || !weeklyProgress ? (
          <motion.div
            key={scorePercent}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={zenMotion.bouncy}
            className={cn(
              "px-2 py-0.5 rounded-lg border text-xs font-semibold tabular-nums flex-shrink-0 flex items-center gap-0.5",
              getScoreBg(score),
              getScoreColor(score)
            )}
          >
            <TrendingUp className="w-2.5 h-2.5" />
            {scorePercent}%
          </motion.div>
        ) : (
          <motion.div
            key={`wp-${weeklyProgress.done}/${weeklyProgress.target}`}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={zenMotion.bouncy}
            className={cn(
              "px-2 py-0.5 rounded-lg border text-xs font-semibold tabular-nums flex-shrink-0",
              weeklyProgress.done >= weeklyProgress.target
                ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-400"
                : "bg-white/[0.04] border-white/[0.06] text-muted-foreground"
            )}
          >
            {weeklyProgress.done}/{weeklyProgress.target}
          </motion.div>
        )}
      </div>

      {/* ═══ ROW 2: MINI WEEK CALENDAR ═══ */}
      <div className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <MiniWeekRow
          habit={habit}
          habitColor={habitColor}
          onToggle={onToggle}
          onAdjust={onAdjust}
        />
      </div>

      {/* ═══ ROW 3: FOOTER (streak or progress bar) ═══ */}
      <div className="px-4 pb-3">
        {isNumeric ? (
          /* Numerical: progress bar + value label */
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full motion-safe:transition-all motion-safe:duration-300 motion-reduce:duration-0"
                style={{
                  width: `${Math.min(progress * 100, 100)}%`,
                  backgroundColor: isCompleted ? "hsl(var(--mood-great))" : habitColor,
                }}
              />
            </div>
            <span className="text-[10px] font-medium tabular-nums text-muted-foreground flex-shrink-0">
              {formatDecimal(currentValue, language)}/{target}
              {habit.unit ? ` ${habit.unit}` : ""}
            </span>
          </div>
        ) : (
          /* Boolean: streak badge + frequency label */
          <div className="flex items-center justify-between">
            {streak > 0 ? (
              <div className="flex items-center gap-1">
                <AnimatedFire intensity={Math.min(1 + streak / 7, 3)} size="sm" />
                <span className="text-xs font-medium text-orange-400/70 tabular-nums">
                  {streak}
                  {t.dStreak}
                </span>
              </div>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              {weeklyProgress && habit.frequency.numerator !== habit.frequency.denominator && (
                <span
                  className={cn(
                    "text-[10px] tabular-nums",
                    weeklyProgress.done >= weeklyProgress.target
                      ? "text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {weeklyProgress.done}/{weeklyProgress.target}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground tabular-nums">🎯 {freqLabel}</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});
