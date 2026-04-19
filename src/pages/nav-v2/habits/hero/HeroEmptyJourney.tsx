/**
 * HeroEmptyJourney — A+++ onboarding for the empty habits state.
 *
 * Layered to give new users three simultaneous entry points, each lower-effort
 * than the last:
 *   1. Inspiration  — a seed → sprout → tree SVG + literary tagline.
 *   2. Story        — 3-step Atoms/Fogg/2-Minute journey with a connecting line.
 *   3. One-tap      — "Popular starter habits" chip rail → instant seed via
 *                     `onSeedStarters(STARTER_TEMPLATES[i])` (no modal).
 *   4. Custom       — primary "Create habit" CTA for users with a specific
 *                     habit in mind.
 *
 * Research anchors: James Clear (identity before action), BJ Fogg (shrink to
 * 2 min), Habitify/Streaks onboarding (one-tap popular habits beat open-form).
 *
 * All motion gated by {@link useShouldAnimate} (Law 8 / Law 9). All text via
 * i18n keys (Law 17). Touch targets ≥44px (Law 9).
 */

import { memo, useCallback } from "react";
import { Plus, Sparkles, MapPin } from "lucide-react";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticTap } from "@/lib/haptics";
import { STARTER_TEMPLATES, type StarterTemplate } from "./starterHabits";

interface HeroEmptyJourneyProps {
  onCreateHabit: () => void;
  onSeedStarters?: (template: StarterTemplate) => void;
}

/** Seed → sprout → tree SVG: pure inline, no deps, matches warm theme. */
function GrowthIllustration({ animate }: { animate: boolean }) {
  return (
    <svg
      viewBox="0 0 240 120"
      role="presentation"
      aria-hidden="true"
      className="h-24 w-auto text-primary/70 md:h-28"
    >
      <defs>
        <linearGradient id="growth-soil" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      {/* soil baseline */}
      <rect x="0" y="104" width="240" height="16" fill="url(#growth-soil)" />
      {/* seed (left) */}
      <g transform="translate(30,96)">
        <ellipse cx="0" cy="0" rx="8" ry="6" fill="currentColor" opacity="0.55" />
        <path d="M-4,-2 Q0,-8 4,-2" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.6" />
      </g>
      {/* sprout (middle) */}
      <g transform="translate(118,100)">
        <path d="M0,4 Q0,-16 -8,-22 Q-2,-20 0,-10 Q2,-20 8,-22 Q0,-16 0,4" fill="currentColor" opacity="0.65" />
        <line x1="0" y1="4" x2="0" y2="-12" stroke="currentColor" strokeWidth="1.2" opacity="0.8" />
      </g>
      {/* tree (right) */}
      <g transform="translate(200,100)">
        <line x1="0" y1="4" x2="0" y2="-32" stroke="currentColor" strokeWidth="2.2" opacity="0.75" />
        <circle cx="0" cy="-42" r="16" fill="currentColor" opacity="0.45" />
        <circle cx="-10" cy="-36" r="10" fill="currentColor" opacity="0.4" />
        <circle cx="10" cy="-36" r="10" fill="currentColor" opacity="0.4" />
        <circle cx="0" cy="-52" r="9" fill="currentColor" opacity="0.5" />
      </g>
      {/* pulsing dotted guide line from seed → tree */}
      <line
        x1="42"
        y1="96"
        x2="182"
        y2="58"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 5"
        opacity="0.4"
        className={animate ? "motion-safe:animate-[habit-shimmer_3s_linear_infinite]" : ""}
      />
    </svg>
  );
}

export const HeroEmptyJourney = memo(function HeroEmptyJourney({
  onCreateHabit,
  onSeedStarters,
}: HeroEmptyJourneyProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const animate = useShouldAnimate();

  const handleCreate = useCallback(() => {
    void hapticTap();
    onCreateHabit();
  }, [onCreateHabit]);

  const handleSeed = useCallback(
    (template: StarterTemplate) => {
      void hapticTap();
      onSeedStarters?.(template);
    },
    [onSeedStarters],
  );

  const steps = [
    { icon: Sparkles, label: tx.navV2HabitsOnboardingStep1 },
    { icon: MapPin, label: tx.navV2HabitsOnboardingStep2 },
    { icon: Plus, label: tx.navV2HabitsOnboardingStep3 },
  ];

  return (
    <div
      className="mt-6 overflow-hidden rounded-3xl border border-dashed border-border bg-card/40 px-5 py-8 text-center md:px-8 md:py-10"
      data-testid="habits-hero-empty"
    >
      <div className="flex justify-center">
        <GrowthIllustration animate={animate} />
      </div>
      <p className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
        {tx.navV2HabitsEmpty}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground font-body">
        {tx.navV2HabitsStartSmall}
      </p>

      <ol
        className="relative mx-auto mt-8 grid max-w-lg grid-cols-3 gap-2 px-2"
        aria-label={tx.navV2HabitsEmpty}
        data-testid="hero-empty-journey-steps"
      >
        <div
          className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-6 hidden h-[2px] bg-gradient-to-r from-primary/30 via-primary/50 to-primary/30 md:block"
          aria-hidden="true"
        />
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <li key={idx} className="relative flex flex-col items-center gap-2">
              <span
                className="relative z-[1] flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/30 bg-background text-primary shadow-sm"
                aria-hidden="true"
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-medium leading-tight text-muted-foreground md:text-xs">
                <span className="font-display font-semibold text-foreground">{idx + 1}.</span>{" "}
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-xs italic text-muted-foreground/80 font-body">
        {tx.navV2HabitsTwoMinuteRule}
      </p>

      {onSeedStarters && (
        <ul
          className="mx-auto mt-4 flex max-w-xl flex-wrap items-center justify-center gap-2"
          data-testid="hero-empty-starters"
        >
          {STARTER_TEMPLATES.map((starter) => (
            <li key={starter.key}>
              <button
                type="button"
                onClick={() => handleSeed(starter)}
                className={
                  "inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
                  (animate
                    ? "motion-safe:transition-transform hover:-translate-y-0.5 hover:bg-primary/10 active:scale-[0.97]"
                    : "")
                }
                data-testid={`hero-empty-starter-${starter.key}`}
                aria-label={starter.name}
              >
                <span aria-hidden="true">{starter.icon}</span>
                {starter.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleCreate}
        className={
          "mt-6 inline-flex min-h-[48px] min-w-[44px] items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
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
