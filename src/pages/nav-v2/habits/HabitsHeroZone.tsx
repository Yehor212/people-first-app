/**
 * HabitsHeroZone — Phase 3-C "today's habits" hero.
 *
 * The top support chrome now stays lean:
 *   - HeroIdentityPrompt
 *   - HeroInsightStrip
 *   - grouped weekly-first habit rows below
 */

import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { hapticTap } from "@/lib/haptics";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { getRoleTone } from "@/lib/nonOrbVisualRoles";
import { V2_HABIT_JOURNEY_ICONS } from "@/lib/v2IconSystem";
import { AllHabitsDoneAnimation } from "@/components/animations/AllHabitsDoneAnimation";
import { useStreakMilestones } from "./hero/useStreakMilestones";

const HabitCompletionCelebrationLazy = lazyWithRetry(() =>
  import("@/components/habit-completion-celebration/HabitCompletionCelebration").then((m) => ({
    default: m.HabitCompletionCelebration,
  })),
  "HabitCompletionCelebration"
);

import type { Habit } from "@/types";
import type { NumericalEntryAction } from "@/lib/habitNumericalInteraction";
import type { HabitsPageDailyProgress } from "./useHabitsPageState";
import { HeroIdentityPrompt } from "./hero/HeroIdentityPrompt";
import { HeroTimeOfDayGroup } from "./hero/HeroTimeOfDayGroup";
import { HeroEmptyJourney } from "./hero/HeroEmptyJourney";
import { HeroInsightStrip } from "./hero/HeroInsightStrip";
import { groupHabitsByTimeOfDay } from "./hero/timeOfDay";
import type { HabitTemplate } from "@/lib/habitTemplates";

interface HabitsHeroZoneProps {
  todaysHabits: Habit[];
  hasActiveHabits?: boolean;
  dailyProgress: HabitsPageDailyProgress;
  onToggleHabit: (habitId: string, date: string) => void;
  onAdjustHabit?: (habitId: string, date: string, delta: number) => void;
  onNumericalAction?: (habitId: string, date: string, action: NumericalEntryAction) => void;
  onDeleteHabit: (habitId: string) => void;
  onCreateHabit: () => void;
  onEditHabit?: (habit: Habit) => void;
  onSkipHabit?: (habitId: string, date: string) => void;
  onUnskipHabit?: (habitId: string, date: string) => void;
  onArchiveHabit?: (habitId: string) => void;
  onUnarchiveHabit?: (habitId: string) => void;
  onPickTemplate?: (template: HabitTemplate) => void;
  onOpenLibrary?: () => void;
  onOpenDetail?: (habit: Habit) => void;
}

export const HabitsHeroZone = memo(function HabitsHeroZone({
  todaysHabits,
  hasActiveHabits = todaysHabits.length > 0,
  dailyProgress,
  onToggleHabit,
  onAdjustHabit,
  onNumericalAction,
  onDeleteHabit,
  onCreateHabit,
  onEditHabit,
  onSkipHabit,
  onUnskipHabit,
  onArchiveHabit,
  onUnarchiveHabit,
  onPickTemplate,
  onOpenLibrary,
  onOpenDetail,
}: HabitsHeroZoneProps) {
  const { t } = useLanguage();
  const tx = t;
  const animate = useShouldAnimate();

  const groups = useMemo(() => groupHabitsByTimeOfDay(todaysHabits), [todaysHabits]);
  const dayOfMonth = useMemo(() => new Date().getDate(), []);

  const [celebrating, setCelebrating] = useState(false);
  const prevRatioRef = useRef<number>(dailyProgress.ratio);
  useEffect(() => {
    const prev = prevRatioRef.current;
    const now = dailyProgress.ratio;
    if (prev < 1 && now >= 1 && dailyProgress.total > 0) {
      setCelebrating(true);
    }
    prevRatioRef.current = now;
  }, [dailyProgress.ratio, dailyProgress.total]);
  const handleCelebrationDone = useCallback(() => setCelebrating(false), []);

  const { event: milestoneEvent, dismiss: dismissMilestone } = useStreakMilestones(todaysHabits);

  const handleCreate = useCallback(() => {
    void hapticTap();
    onCreateHabit();
  }, [onCreateHabit]);
  const handleOpenInsightHabit = useCallback(
    (habit: Habit) => {
      onOpenDetail?.(habit);
    },
    [onOpenDetail],
  );

  const isEmpty = todaysHabits.length === 0;
  const bodyTone = getRoleTone("body");
  const CreateHabitIcon = V2_HABIT_JOURNEY_ICONS.create;

  return (
    <section
      aria-labelledby="habits-hero-heading"
      data-testid="habits-hero-zone"
      className="px-4 py-4 md:px-6 md:py-6"
    >
      <h2 id="habits-hero-heading" className="sr-only">
        {tx.navV2HabitsHero}
      </h2>

      {!isEmpty && (
        <div
          className="habit-identity-cue sticky top-2 z-10 -mx-1 rounded-2xl border px-3 py-3 md:top-4"
          data-visual-role="body"
          data-testid="habits-identity-cue"
        >
          <HeroIdentityPrompt habits={todaysHabits} dayOfMonth={dayOfMonth} />
          <HeroInsightStrip onOpenHabitInsight={handleOpenInsightHabit} />
        </div>
      )}

      {isEmpty ? (
        <HeroEmptyJourney
          onCreateHabit={handleCreate}
          onPickTemplate={onPickTemplate}
          onOpenLibrary={onOpenLibrary}
          variant={hasActiveHabits ? "rest" : "start"}
        />
      ) : (
        <>
          {groups.map((g) => (
            <HeroTimeOfDayGroup
              key={g.bucket}
              bucket={g.bucket}
              habits={g.habits}
              onToggleHabit={onToggleHabit}
              onAdjustHabit={onAdjustHabit}
              onNumericalAction={onNumericalAction}
              onDeleteHabit={onDeleteHabit}
              onEditHabit={onEditHabit}
              onSkipHabit={onSkipHabit}
              onUnskipHabit={onUnskipHabit}
              onArchiveHabit={onArchiveHabit}
              onUnarchiveHabit={onUnarchiveHabit}
              onOpenDetail={onOpenDetail}
            />
          ))}

          <p
            className="mt-6 px-1 text-xs font-body italic text-muted-foreground/80"
            data-testid="habits-hero-recovery"
          >
            {tx.navV2HabitsRecovery}
          </p>

          <div className="mt-5 flex justify-center md:justify-end">
            <button
              type="button"
              onClick={handleCreate}
              className={
                "inline-flex min-h-[48px] items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-[hsl(var(--zf-night-0))] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
                "bg-[hsl(var(--zf-role-body))] " +
                bodyTone.focusRingClass +
                " " +
                (animate ? "motion-safe:transition-transform active:scale-[0.97]" : "")
              }
              aria-label={tx.navV2HabitsCreate}
              data-testid="habits-hero-create"
            >
              <CreateHabitIcon className="h-4 w-4" aria-hidden="true" />
              {tx.navV2HabitsCreate}
            </button>
          </div>
        </>
      )}

      {celebrating && animate && <AllHabitsDoneAnimation onComplete={handleCelebrationDone} />}

      {milestoneEvent && animate && (
        <Suspense fallback={null}>
          <HabitCompletionCelebrationLazy
            habitName={milestoneEvent.habit.name}
            habitIcon={milestoneEvent.habit.icon}
            habitColor={milestoneEvent.habit.color}
            streakDays={milestoneEvent.streak}
            onComplete={dismissMilestone}
          />
        </Suspense>
      )}
    </section>
  );
});
