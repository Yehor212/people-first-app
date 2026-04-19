/**
 * HabitsHeroZone — Phase 3-C "today's habits" hero (A+++ rewrite).
 *
 * Decomposed into 4 sub-components (Component Isolation, Law 15) under
 * `./hero/`:
 *   - HeroDailyRing       — sticky daily-progress ring + remaining copy
 *   - HeroIdentityPrompt  — daily-rotating identity statement (Atoms)
 *   - HeroTimeOfDayGroup  — collapsible group per morning/afternoon/evening
 *   - HeroEmptyJourney    — 3-step onboarding empty state
 *
 * Research basis (web research, 2026):
 *   - Habitify: time-of-day grouping anchors habits to circadian context.
 *   - Streaks (Apple Design Award 2016): high-density progress ring scannable
 *     in <200ms.
 *   - James Clear, Atomic Habits: identity-based prompts ("you ARE someone
 *     who…") outperform outcome-based prompts ("complete X habits").
 *   - BJ Fogg, Tiny Habits: cue specificity (When/Where) drives formation.
 *   - Lally et al., 2010: a single missed day does not break a habit;
 *     recovery copy reduces all-or-nothing dropout.
 *
 * All animations gated by {@link useShouldAnimate} (Law 8 / Law 9).
 * Sticky daily ring uses CSS sticky — no scroll listeners (Law 8).
 * Reuses V1 CompactHabitCard untouched (Law 1: Zero Regression).
 */

import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { hapticTap } from "@/lib/haptics";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { AllHabitsDoneAnimation } from "@/components/animations/AllHabitsDoneAnimation";
import { useStreakMilestones } from "./hero/useStreakMilestones";

// Lazy: V1 HabitCompletionCelebration pulls in particle helpers + framer
// variants — only needed on milestone cross (3/7/21/66/100 days).
const HabitCompletionCelebrationLazy = lazyWithRetry(() =>
  import("@/components/habit-completion-celebration/HabitCompletionCelebration").then((m) => ({
    default: m.HabitCompletionCelebration,
  })),
);
import type { Habit } from "@/types";
import type { HabitsPageDailyProgress } from "./useHabitsPageState";
import { HeroDailyRing } from "./hero/HeroDailyRing";
import { HeroIdentityPrompt } from "./hero/HeroIdentityPrompt";
import { HeroTimeOfDayGroup } from "./hero/HeroTimeOfDayGroup";
import { HeroEmptyJourney } from "./hero/HeroEmptyJourney";
import { HeroInsightStrip } from "./hero/HeroInsightStrip";
import { groupHabitsByTimeOfDay } from "./hero/timeOfDay";
import type { HabitTemplate } from "@/lib/habitTemplates";

interface HabitsHeroZoneProps {
  todaysHabits: Habit[];
  dailyProgress: HabitsPageDailyProgress;
  onToggleHabit: (habitId: string, date: string) => void;
  /** +/- for numerical habits (drink water etc.). Optional for back-compat. */
  onAdjustHabit?: (habitId: string, date: string, delta: number) => void;
  onDeleteHabit: (habitId: string) => void;
  onCreateHabit: () => void;
  /** Pencil button → edit form (distinct from long-press → detail sheet). */
  onEditHabit?: (habit: Habit) => void;
  onPickTemplate?: (template: HabitTemplate) => void;
  onOpenLibrary?: () => void;
  onOpenDetail?: (habit: Habit) => void;
}

export const HabitsHeroZone = memo(function HabitsHeroZone({
  todaysHabits,
  dailyProgress,
  onToggleHabit,
  onAdjustHabit,
  onDeleteHabit,
  onCreateHabit,
  onEditHabit,
  onPickTemplate,
  onOpenLibrary,
  onOpenDetail,
}: HabitsHeroZoneProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const animate = useShouldAnimate();

  const groups = useMemo(() => groupHabitsByTimeOfDay(todaysHabits), [todaysHabits]);
  const dayOfMonth = useMemo(() => new Date().getDate(), []);

  // Celebration overlay — fires once per transition of dailyProgress.ratio → 1
  // (i.e. the last habit of the day just got completed). Gate on total>0 so
  // the trivial 0/0 case doesn't celebrate nothing.
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

  // Streak milestone detection (3/7/21/66/100 days) — V2 spec §3 thresholds
  const { event: milestoneEvent, dismiss: dismissMilestone } = useStreakMilestones(todaysHabits);

  const handleCreate = useCallback(() => {
    void hapticTap();
    onCreateHabit();
  }, [onCreateHabit]);


  const isEmpty = todaysHabits.length === 0;

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
        <div className="sticky top-2 z-10 -mx-1 rounded-2xl border border-border/60 bg-background/85 px-3 py-3 shadow-sm backdrop-blur-md [-webkit-backdrop-filter:blur(12px)] md:top-4">
          <HeroDailyRing
            completed={dailyProgress.completed}
            total={dailyProgress.total}
            ratio={dailyProgress.ratio}
          />
          <div className="mt-3">
            <HeroIdentityPrompt habits={todaysHabits} dayOfMonth={dayOfMonth} />
          </div>
          <HeroInsightStrip />
        </div>
      )}

      {isEmpty ? (
        <HeroEmptyJourney
          onCreateHabit={handleCreate}
          onPickTemplate={onPickTemplate}
          onOpenLibrary={onOpenLibrary}
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
              onDeleteHabit={onDeleteHabit}
              onEditHabit={onEditHabit}
              onOpenDetail={onOpenDetail}
            />
          ))}

          <p
            className="mt-6 px-1 text-xs italic text-muted-foreground/80 font-body"
            data-testid="habits-hero-recovery"
          >
            {tx.navV2HabitsRecovery}
          </p>

          <div className="mt-5 flex justify-center md:justify-end">
            <button
              type="button"
              onClick={handleCreate}
              className={
                "inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
                (animate ? "motion-safe:transition-transform active:scale-[0.97]" : "")
              }
              aria-label={tx.navV2HabitsCreate}
              data-testid="habits-hero-create"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {tx.navV2HabitsCreate}
            </button>
          </div>
        </>
      )}

      {celebrating && animate && (
        <AllHabitsDoneAnimation onComplete={handleCelebrationDone} />
      )}

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
