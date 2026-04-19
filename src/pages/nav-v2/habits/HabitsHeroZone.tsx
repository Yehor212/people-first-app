/**
 * HabitsHeroZone — Phase 3-C zone 1.
 *
 * Above-the-fold "today's habits" snapshot. Reuses the V1 {@link CompactHabitCard}
 * primitive (no edits to V1 internals — Law 1 / Law 15) and exposes a daily
 * progress ring whose value is derived from {@link useHabitsPageState}.
 *
 * Empty-state copy is research-grounded:
 *   - Atomic Habits (Clear, 2018) — "start small": 3-habit ceiling.
 *   - Implementation intentions (Gollwitzer, 1999) — "When • Where • Cue".
 *   - Habit recovery (Lally et al., 2010) — "one missed day doesn't reset progress".
 *
 * All animations are gated by {@link useShouldAnimate} (Law 8 / Law 9).
 */

import { memo, useCallback, useMemo } from "react";
import { CompactHabitCard } from "@/components/compact-habit-card/CompactHabitCard";
import { Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { hapticTap } from "@/lib/haptics";
import type { Habit } from "@/types";
import type { HabitsPageDailyProgress } from "./useHabitsPageState";

interface HabitsHeroZoneProps {
  todaysHabits: Habit[];
  dailyProgress: HabitsPageDailyProgress;
  onToggleHabit: (habitId: string, date: string) => void;
  onDeleteHabit: (habitId: string) => void;
  onCreateHabit: () => void;
  onScrollToGarden: () => void;
}

const RING_SIZE = 88;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const HabitsHeroZone = memo(function HabitsHeroZone({
  todaysHabits,
  dailyProgress,
  onToggleHabit,
  onDeleteHabit,
  onCreateHabit,
  onScrollToGarden,
}: HabitsHeroZoneProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const animate = useShouldAnimate();

  const dashOffset = useMemo(
    () => RING_CIRCUMFERENCE * (1 - dailyProgress.ratio),
    [dailyProgress.ratio],
  );

  const handleCreate = useCallback(() => {
    void hapticTap();
    onCreateHabit();
  }, [onCreateHabit]);

  const handleScroll = useCallback(() => {
    void hapticTap();
    onScrollToGarden();
  }, [onScrollToGarden]);

  const ariaProgressLabel = `${dailyProgress.completed} / ${dailyProgress.total}`;

  return (
    <section
      aria-labelledby="habits-hero-heading"
      data-testid="habits-hero-zone"
      className="px-4 py-6 md:px-6 md:py-8"
    >
      <header className="flex items-center justify-between gap-4">
        <h2
          id="habits-hero-heading"
          className="font-display text-xl font-semibold tracking-tight text-foreground"
        >
          {tx.navV2HabitsHero}
        </h2>
        <div
          className="relative shrink-0"
          style={{ width: RING_SIZE, height: RING_SIZE }}
          role="img"
          aria-live="polite"
          aria-label={`${tx.navV2HabitsHero}: ${ariaProgressLabel}`}
          data-testid="habits-hero-progress-ring"
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            aria-hidden="true"
            className="-rotate-90"
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              strokeWidth={RING_STROKE}
              className="fill-none stroke-muted"
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              className="fill-none stroke-primary"
              style={animate ? { transition: "stroke-dashoffset 600ms ease-out" } : undefined}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-semibold text-foreground">
            {ariaProgressLabel}
          </span>
        </div>
      </header>

      {todaysHabits.length === 0 ? (
        <div
          className="mt-6 rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center"
          data-testid="habits-hero-empty"
        >
          <p className="font-display text-lg font-semibold text-foreground">
            {tx.navV2HabitsEmpty}
          </p>
          <p className="mt-2 text-sm text-muted-foreground font-body">
            {tx.navV2HabitsStartSmall}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80 font-body">
            {tx.navV2HabitsAddCue}
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="mt-5 inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={tx.navV2HabitsCreate}
            data-testid="habits-hero-create-empty"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {tx.navV2HabitsCreate}
          </button>
        </div>
      ) : (
        <>
          <ul
            className="mt-6 flex flex-col gap-3"
            aria-label={tx.navV2HabitsHero}
            data-testid="habits-hero-list"
          >
            {todaysHabits.map((habit) => (
              <CompactHabitCard
                key={habit.id}
                habit={habit}
                onToggle={onToggleHabit}
                onDelete={onDeleteHabit}
                streak={0}
                isDueToday
              />
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground font-body">
            {tx.navV2HabitsRecovery}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={tx.navV2HabitsCreate}
              data-testid="habits-hero-create"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {tx.navV2HabitsCreate}
            </button>
            <button
              type="button"
              onClick={handleScroll}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={tx.navV2HabitsScrollToGarden}
              data-testid="habits-hero-scroll-to-garden"
            >
              {tx.navV2HabitsScrollToGarden}
            </button>
          </div>
        </>
      )}
    </section>
  );
});
