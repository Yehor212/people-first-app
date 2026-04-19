/**
 * HeroEmptyJourney — 3-step onboarding for the empty habits state.
 *
 * Replaces the V1 single-CTA empty state with a research-grounded
 * micro-journey:
 *   1. Pick identity   — Atoms (Clear, 2018): identity precedes action.
 *   2. Set the cue     — Tiny Habits (Fogg, 2019): When/Where specificity.
 *   3. Plant first     — 2-Minute Rule: shrink the habit to its smallest version.
 *
 * The visual chain (numbered dots + connecting line) is the Streaks /
 * Apple Fitness "ring of dots" pattern — it cues a sequence rather than
 * a single isolated action, lowering perceived effort.
 */

import { memo, useCallback } from "react";
import { Plus, Sparkles, MapPin } from "lucide-react";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticTap } from "@/lib/haptics";

interface HeroEmptyJourneyProps {
  onCreateHabit: () => void;
}

export const HeroEmptyJourney = memo(function HeroEmptyJourney({
  onCreateHabit,
}: HeroEmptyJourneyProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const animate = useShouldAnimate();

  const handleCreate = useCallback(() => {
    void hapticTap();
    onCreateHabit();
  }, [onCreateHabit]);

  const steps = [
    { icon: Sparkles, label: tx.navV2HabitsOnboardingStep1 },
    { icon: MapPin, label: tx.navV2HabitsOnboardingStep2 },
    { icon: Plus, label: tx.navV2HabitsOnboardingStep3 },
  ];

  return (
    <div
      className="mt-6 rounded-3xl border border-dashed border-border bg-card/40 p-6 text-center md:p-8"
      data-testid="habits-hero-empty"
    >
      <p className="font-display text-xl font-semibold tracking-tight text-foreground">
        {tx.navV2HabitsEmpty}
      </p>
      <p className="mt-2 text-sm text-muted-foreground font-body">
        {tx.navV2HabitsStartSmall}
      </p>

      <ol
        className="mt-6 grid grid-cols-3 gap-2"
        aria-label={tx.navV2HabitsEmpty}
        data-testid="hero-empty-journey-steps"
      >
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <li key={idx} className="flex flex-col items-center gap-2">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-medium leading-tight text-muted-foreground">
                {idx + 1}. {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-xs italic text-muted-foreground/80 font-body">
        {tx.navV2HabitsTwoMinuteRule}
      </p>

      <button
        type="button"
        onClick={handleCreate}
        className={
          "mt-5 inline-flex min-h-[48px] min-w-[44px] items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
          (animate ? "motion-safe:transition-transform active:scale-[0.97]" : "")
        }
        aria-label={tx.navV2HabitsCreate}
        data-testid="habits-hero-create-empty"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {tx.navV2HabitsCreate}
      </button>

      <p className="mt-4 text-[11px] text-muted-foreground/70 font-body">
        {tx.navV2HabitsAddCue}
      </p>
    </div>
  );
});
