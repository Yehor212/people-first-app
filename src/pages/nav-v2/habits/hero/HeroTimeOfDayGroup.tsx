/**
 * HeroTimeOfDayGroup - grouped V2 habit rows for a single day bucket.
 */

import { memo, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Orbit, Route, Sprout, Waypoints, type LucideIcon } from "lucide-react";
import { isHabitCompletedOnDate } from "@/lib/habits";
import { getToday } from "@/lib/utils";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useLanguage } from "@/contexts/LanguageContext";
import { getHabitRoleTone, getRoleHsl, getTimeOfDayVisualRole } from "@/lib/nonOrbVisualRoles";
import type { NumericalEntryAction } from "@/lib/habitNumericalInteraction";
import type { Habit } from "@/types";
import type { TimeOfDay } from "./timeOfDay";
import { HeroHabitRow } from "./HeroHabitRow";

interface HeroTimeOfDayGroupProps {
  bucket: TimeOfDay;
  habits: readonly Habit[];
  onToggleHabit: (habitId: string, date: string) => void;
  /** +/- for numerical habits. Optional. */
  onAdjustHabit?: (habitId: string, date: string, delta: number) => void;
  onNumericalAction?: (habitId: string, date: string, action: NumericalEntryAction) => void;
  onDeleteHabit: (habitId: string) => void;
  onEditHabit?: (habit: Habit) => void;
  onSkipHabit?: (habitId: string, date: string) => void;
  onUnskipHabit?: (habitId: string, date: string) => void;
  onArchiveHabit?: (habitId: string) => void;
  onUnarchiveHabit?: (habitId: string) => void;
  onOpenDetail?: (habit: Habit) => void;
}

const BUCKET_LABEL_KEY: Record<TimeOfDay, string> = {
  morning: "navV2HabitsMorning",
  afternoon: "navV2HabitsAfternoon",
  evening: "navV2HabitsEvening",
  anytime: "navV2HabitsAnytime",
};

const BUCKET_ICON: Record<TimeOfDay, LucideIcon> = {
  morning: Sprout,
  afternoon: Route,
  evening: Orbit,
  anytime: Waypoints,
};

export const HeroTimeOfDayGroup = memo(function HeroTimeOfDayGroup({
  bucket,
  habits,
  onToggleHabit,
  onAdjustHabit,
  onNumericalAction,
  onDeleteHabit,
  onEditHabit,
  onSkipHabit,
  onUnskipHabit,
  onArchiveHabit,
  onUnarchiveHabit,
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
  const visualRole = getTimeOfDayVisualRole(bucket);
  const tone = getHabitRoleTone(visualRole);
  const BucketIcon = BUCKET_ICON[bucket];
  const growthStyle = {
    "--habit-group-role": getRoleHsl(visualRole),
    "--habit-group-role-soft": getRoleHsl(visualRole, 0.16),
    "--habit-group-role-line": getRoleHsl(visualRole, 0.34),
  } as CSSProperties;

  return (
    <section
      aria-label={label}
      data-testid={`hero-group-${bucket}`}
      data-visual-role={visualRole}
      data-habit-group-count={habits.length}
      className="habit-growth-group relative isolate -mx-2 mt-6 overflow-hidden rounded-[28px] px-2 py-3 first:mt-4 md:-mx-3 md:px-3"
      style={growthStyle}
    >
      <span className="habit-growth-group__aura" aria-hidden="true" />
      <span className="habit-growth-group__thread" aria-hidden="true" />
      <header className="mb-3 flex items-end justify-between gap-3 px-1">
        <h3
          className="flex items-center gap-2 font-display text-2xl font-semibold italic tracking-tight text-foreground md:text-3xl"
          data-slot="habit-group-title"
        >
          <span
            aria-hidden="true"
            className="habit-bucket-glyph inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border not-italic"
            data-bucket={bucket}
            data-testid={`hero-group-${bucket}-icon`}
          >
            <BucketIcon className="relative z-10 h-[18px] w-[18px]" strokeWidth={1.9} />
          </span>
          {label}
        </h3>
        <span
          className={
            "rounded-full border px-2 py-1 text-xs font-medium uppercase tracking-wider tabular-nums " +
            tone.iconClass
          }
          data-testid={`hero-group-${bucket}-count`}
          data-slot="habit-group-count"
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
                onAdjust={onAdjustHabit}
                onNumericalAction={onNumericalAction}
                onDelete={onDeleteHabit}
                onEdit={onEditHabit}
                onSkip={onSkipHabit}
                onUnskip={onUnskipHabit}
                onArchive={onArchiveHabit}
                onUnarchive={onUnarchiveHabit}
                onOpenDetail={onOpenDetail}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
});
