/**
 * HeroTimeOfDayGroup — collapsible group of habit rows for a single bucket.
 *
 * Rationale (Habitify research, 2025): grouping by time-of-day ("morning",
 * "afternoon", "evening") cues the user's circadian context and improves
 * completion rates over a flat list.
 *
 * Each group:
 *   - Shows a sticky-feel section header with bucket label + completion count.
 *   - Contains one CompactHabitCard per habit (V1 primitive, untouched).
 *   - Uses Framer Motion `layout` for smooth reordering when habits move
 *     between groups (e.g. the user adjusts a reminder time).
 *
 * The group itself is non-collapsible by user input in this MVP (P1 will
 * add an expand/collapse affordance per group); we already render each
 * group with `<section>` + heading so future affordances can attach in
 * place without restructuring.
 */

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isHabitCompletedOnDate } from "@/lib/habits";
import { getToday } from "@/lib/utils";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Habit } from "@/types";
import type { TimeOfDay } from "./timeOfDay";
import { HeroHabitRow } from "./HeroHabitRow";

interface HeroTimeOfDayGroupProps {
  bucket: TimeOfDay;
  habits: readonly Habit[];
  onToggleHabit: (habitId: string, date: string) => void;
  onDeleteHabit: (habitId: string) => void;
  /** Opens the V1 HabitDetailSheet (reuses mature stats/streak/actions panel). */
  onOpenDetail?: (habit: Habit) => void;
}

const BUCKET_LABEL_KEY: Record<TimeOfDay, string> = {
  morning: "navV2HabitsMorning",
  afternoon: "navV2HabitsAfternoon",
  evening: "navV2HabitsEvening",
  anytime: "navV2HabitsAnytime",
};

const BUCKET_ICON: Record<TimeOfDay, string> = {
  morning: "🌅",
  afternoon: "☀️",
  evening: "🌙",
  anytime: "✨",
};

export const HeroTimeOfDayGroup = memo(function HeroTimeOfDayGroup({
  bucket,
  habits,
  onToggleHabit,
  onDeleteHabit,
  onOpenDetail,
}: HeroTimeOfDayGroupProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const animate = useShouldAnimate();
  const today = getToday();

  const completed = habits.reduce(
    (acc, h) => (isHabitCompletedOnDate(h, today) ? acc + 1 : acc),
    0,
  );
  const label = tx[BUCKET_LABEL_KEY[bucket]] ?? bucket;

  return (
    <section
      aria-label={label}
      data-testid={`hero-group-${bucket}`}
      className="mt-6 first:mt-4"
    >
      <header className="mb-2 flex items-center justify-between gap-3 px-1">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <span aria-hidden="true">{BUCKET_ICON[bucket]}</span>
          {label}
        </h3>
        <span
          className="text-xs font-medium tabular-nums text-muted-foreground"
          data-testid={`hero-group-${bucket}-count`}
        >
          {completed} / {habits.length}
        </span>
      </header>
      <ul
        className="flex flex-col gap-3"
        aria-label={label}
        data-testid={`hero-group-${bucket}-list`}
      >
        <AnimatePresence initial={false}>
          {habits.map((habit) => (
            <motion.div
              key={habit.id}
              layout={animate}
              initial={animate ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={animate ? { opacity: 0, y: -8 } : undefined}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <HeroHabitRow
                habit={habit}
                onToggle={onToggleHabit}
                onDelete={onDeleteHabit}
                onOpenDetail={onOpenDetail}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
});
