/**
 * HeroEmptyJourney — A+++ onboarding for the empty habits state.
 *
 * 4-tier entry funnel (descending effort):
 *   1. Inspiration  — seed → sprout → tree SVG + literary tagline.
 *   2. Story        — 3-step Atoms/Fogg/2-Minute journey with connecting line.
 *   3. Quick pick   — 4 top V1 templates as one-tap chips (localized × 8 langs).
 *   4. Browse all   — opens {@link HeroTemplateLibrarySheet} (5 categories).
 *   5. Custom       — primary "Create habit" CTA for bespoke entries.
 *
 * Research anchors: James Clear (identity before action), BJ Fogg (shrink to
 * 2-min version), Huberman 2026 protocol (cold / sunlight / delayed caffeine
 * are in the library), Habitify onboarding analytics.
 *
 * All motion gated by {@link useShouldAnimate} (Law 8 / Law 9). All text via
 * i18n keys (Law 17). Touch targets ≥40px (Law 9).
 */

import { memo, useCallback } from "react";
import { Plus, Sparkles, MapPin, Library } from "lucide-react";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticTap } from "@/lib/haptics";
import { habitTemplates, type HabitTemplate } from "@/lib/habitTemplates";

interface HeroEmptyJourneyProps {
  onCreateHabit: () => void;
  /** Called when the user taps a quick-pick template. If omitted, chips hide. */
  onPickTemplate?: (template: HabitTemplate) => void;
  /** Called when the user wants to open the full library drawer. */
  onOpenLibrary?: () => void;
}

/** The 4 highest-signal starter templates per 2026 research. */
const QUICK_PICK_IDS = ["water", "sunlight", "breathwork", "gratitude"] as const;

const QUICK_PICKS: readonly HabitTemplate[] = QUICK_PICK_IDS
  .map((id) => habitTemplates.find((t) => t.id === id))
  .filter((t): t is HabitTemplate => Boolean(t));

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
      <rect x="0" y="104" width="240" height="16" fill="url(#growth-soil)" />
      <g transform="translate(30,96)">
        <ellipse cx="0" cy="0" rx="8" ry="6" fill="currentColor" opacity="0.55" />
        <path d="M-4,-2 Q0,-8 4,-2" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.6" />
      </g>
      <g transform="translate(118,100)">
        <path d="M0,4 Q0,-16 -8,-22 Q-2,-20 0,-10 Q2,-20 8,-22 Q0,-16 0,4" fill="currentColor" opacity="0.65" />
        <line x1="0" y1="4" x2="0" y2="-12" stroke="currentColor" strokeWidth="1.2" opacity="0.8" />
      </g>
      <g transform="translate(200,100)">
        <line x1="0" y1="4" x2="0" y2="-32" stroke="currentColor" strokeWidth="2.2" opacity="0.75" />
        <circle cx="0" cy="-42" r="16" fill="currentColor" opacity="0.45" />
        <circle cx="-10" cy="-36" r="10" fill="currentColor" opacity="0.4" />
        <circle cx="10" cy="-36" r="10" fill="currentColor" opacity="0.4" />
        <circle cx="0" cy="-52" r="9" fill="currentColor" opacity="0.5" />
      </g>
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
  onPickTemplate,
  onOpenLibrary,
}: HeroEmptyJourneyProps) {
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const animate = useShouldAnimate();

  const handleCreate = useCallback(() => {
    void hapticTap();
    onCreateHabit();
  }, [onCreateHabit]);

  const handlePick = useCallback(
    (tpl: HabitTemplate) => {
      void hapticTap();
      onPickTemplate?.(tpl);
    },
    [onPickTemplate],
  );

  const handleOpenLibrary = useCallback(() => {
    void hapticTap();
    onOpenLibrary?.();
  }, [onOpenLibrary]);

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
                <span
                  className="font-hand text-lg italic text-primary md:text-xl"
                  aria-hidden="true"
                >
                  {idx + 1}.
                </span>{" "}
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-xs italic text-muted-foreground/80 font-body">
        {tx.navV2HabitsTwoMinuteRule}
      </p>

      {onPickTemplate && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {tx.navV2HabitsQuickPick}
          </p>
          <ul
            className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2"
            data-testid="hero-empty-quickpick"
          >
            {QUICK_PICKS.map((tpl) => {
              const name = tpl.names[language] || tpl.names.en;
              return (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(tpl)}
                    className={
                      "inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
                      (animate
                        ? "motion-safe:transition-transform hover:-translate-y-0.5 hover:bg-primary/10 active:scale-[0.97]"
                        : "")
                    }
                    data-testid={`hero-quickpick-${tpl.id}`}
                    aria-label={name}
                  >
                    <span aria-hidden="true">{tpl.icon}</span>
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {onOpenLibrary && (
        <button
          type="button"
          onClick={handleOpenLibrary}
          className={
            "mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-xs font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
            (animate ? "motion-safe:transition-colors hover:bg-primary/10" : "")
          }
          data-testid="hero-empty-open-library"
        >
          <Library className="h-3.5 w-3.5" aria-hidden="true" />
          {tx.navV2HabitsBrowseLibrary}
        </button>
      )}

      <div>
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
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground/70 font-body">
        {tx.navV2HabitsAddCue}
      </p>
    </div>
  );
});
