/**
 * HeroIdentityPrompt — daily-rotating identity statement.
 *
 * "You're not aiming to read a book. You're aiming to become a reader."
 *   — James Clear, Atomic Habits (Identity-Based Habits chapter)
 *
 * Picks one identityVerb / identityIcon pair from the user's habits
 * deterministically by date-of-month, falling back to a generic
 * "someone who keeps their word" prompt when no identity is configured.
 */

import { memo, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Habit } from "@/types";

interface HeroIdentityPromptProps {
  habits: readonly Habit[];
  /** Day-of-month (1-31) used as the deterministic rotation seed. */
  dayOfMonth: number;
}

interface IdentityChoice {
  verb: string;
  icon: string;
}

/** Pure: returns the identity choice for a given seed, or null if none configured. */
export function pickIdentityForDay(
  habits: readonly Habit[],
  dayOfMonth: number,
): IdentityChoice | null {
  const choices = habits
    .map((h): IdentityChoice | null => {
      const verb = (h.identityVerb ?? "").trim();
      if (!verb) return null;
      const rawIcon = (h.identityIcon ?? "").trim() || (h.icon ?? "").trim() || "✨";
      return { verb, icon: rawIcon };
    })
    .filter((c): c is IdentityChoice => c !== null);
  if (choices.length === 0) return null;
  const idx = Math.abs(dayOfMonth) % choices.length;
  return choices[idx];
}

export const HeroIdentityPrompt = memo(function HeroIdentityPrompt({
  habits,
  dayOfMonth,
}: HeroIdentityPromptProps) {
  const { t } = useLanguage();
  const tx = t;

  const choice = useMemo(() => pickIdentityForDay(habits, dayOfMonth), [habits, dayOfMonth]);

  const verb = choice?.verb ?? tx.navV2HabitsIdentityIntention ?? "";
  const icon = choice?.icon ?? "✨";

  return (
    <p
      className="flex flex-wrap items-center gap-2 text-sm font-body text-muted-foreground"
      data-testid="hero-identity-prompt"
    >
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
        {tx.navV2HabitsIdentityToday}
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-base font-semibold text-primary"
        data-testid="hero-identity-verb"
      >
        <span aria-hidden="true">{icon}</span>
        <span className="font-hand text-lg italic leading-none tracking-tight md:text-xl">
          {verb}
        </span>
      </span>
    </p>
  );
});
