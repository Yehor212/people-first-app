/**
 * HeroTimeOfDayGroup - grouped V2 habit rows for a single day bucket.
 */

import { memo, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Orbit, Route, Sprout, Waypoints, type LucideIcon } from "lucide-react";
import { isHabitCompletedOnDate } from "@/lib/habits";
import { getToday } from "@/lib/utils";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useDeviceTier } from "@/hooks/useDeviceTier";
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
  onBeforeActionSheetOpen?: () => Promise<boolean>;
  onActionSheetOpenChange?: (open: boolean) => void;
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

const MOBILE_INITIAL_HABIT_ROWS = 2;
const MOBILE_HABIT_ROW_BATCH = 8;

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
  onBeforeActionSheetOpen,
  onActionSheetOpenChange,
}: HeroTimeOfDayGroupProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const animate = useShouldAnimate();
  const { tier } = useDeviceTier();
  const today = getToday();
  const [visibleHabitCount, setVisibleHabitCount] = useState(MOBILE_INITIAL_HABIT_ROWS);

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
  const animateHabitRows = animate && tier !== "phone";
  const shouldLimitInitialRows =
    tier === "phone" && habits.length > MOBILE_INITIAL_HABIT_ROWS;
  const cappedVisibleCount = shouldLimitInitialRows
    ? Math.min(visibleHabitCount, habits.length)
    : habits.length;
  const visibleHabits = useMemo(
    () => habits.slice(0, cappedVisibleCount),
    [cappedVisibleCount, habits],
  );
  const remainingHabitCount = Math.max(0, habits.length - visibleHabits.length);
  const nextRevealCount = Math.min(MOBILE_HABIT_ROW_BATCH, remainingHabitCount);
  const showMoreText = (tx.navV2HabitsShowMoreCount || "Show {count} more").replace(
    "{count}",
    String(nextRevealCount),
  );

  useLayoutEffect(() => {
    setVisibleHabitCount(MOBILE_INITIAL_HABIT_ROWS);
  }, [bucket, habits.length, tier]);

  return (
    <section
      aria-label={label}
      data-testid={`hero-group-${bucket}`}
      data-visual-role={visualRole}
      data-habit-group-count={habits.length}
      data-visible-habit-count={visibleHabits.length}
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
          {visibleHabits.map((habit) => (
            <motion.div
              key={habit.id}
              layout={animateHabitRows}
              initial={animateHabitRows ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={animateHabitRows ? { opacity: 0, y: -8 } : undefined}
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
                onBeforeActionSheetOpen={onBeforeActionSheetOpen}
                onActionSheetOpenChange={onActionSheetOpenChange}
                initiallyCollapsed={tier === "phone"}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </ul>
      {remainingHabitCount > 0 && (
        <div className="mt-3 flex justify-center px-1">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-[hsl(var(--zf-role-body)/0.28)] bg-card/70 px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm backdrop-blur-md [-webkit-backdrop-filter:blur(12px)] motion-safe:transition-[background-color,transform] hover:bg-card/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={() =>
              setVisibleHabitCount((count) =>
                Math.min(habits.length, count + MOBILE_HABIT_ROW_BATCH),
              )
            }
            aria-label={showMoreText}
            data-testid={`hero-group-${bucket}-show-more`}
          >
            {showMoreText}
          </button>
        </div>
      )}
    </section>
  );
});
