/**
 * HeroIdentityPrompt - daily rotating identity statement.
 *
 * The sentence is localized as one template with an `{identity}` placeholder so
 * languages with case, gender, or different word order do not inherit English
 * grammar.
 */

import { memo, useMemo } from "react";
import { HabitIconVisual } from "./HabitIconVisual";
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

const DEFAULT_IDENTITY_ICON = "Sparkles";
const DAILY_IDENTITY_SEPARATOR = "|";

function pickByDay<T>(items: readonly T[], dayOfMonth: number, oneBased = false): T | null {
  if (items.length === 0) return null;
  const seed = oneBased ? Math.max(0, dayOfMonth - 1) : Math.abs(dayOfMonth);
  return items[seed % items.length] ?? null;
}

export function parseDailyIdentityIntentions(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(DAILY_IDENTITY_SEPARATOR)
    .map((phrase) => phrase.trim())
    .filter(Boolean);
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
      const rawIcon =
        (h.identityIcon ?? "").trim() || (h.icon ?? "").trim() || DEFAULT_IDENTITY_ICON;
      return { verb, icon: rawIcon };
    })
    .filter((c): c is IdentityChoice => c !== null);
  if (choices.length === 0) return null;
  return pickByDay(choices, dayOfMonth);
}

export function pickDailyIdentityForDay(
  rawIntentions: string | undefined,
  dayOfMonth: number,
): IdentityChoice | null {
  const verb = pickByDay(parseDailyIdentityIntentions(rawIntentions), dayOfMonth, true);
  return verb ? { verb, icon: DEFAULT_IDENTITY_ICON } : null;
}

export const HeroIdentityPrompt = memo(function HeroIdentityPrompt({
  habits,
  dayOfMonth,
}: HeroIdentityPromptProps) {
  const { t } = useLanguage();
  const tx = t;

  const choice = useMemo(
    () =>
      pickIdentityForDay(habits, dayOfMonth) ??
      pickDailyIdentityForDay(tx.navV2HabitsIdentityIntentions, dayOfMonth),
    [habits, dayOfMonth, tx.navV2HabitsIdentityIntentions],
  );

  const verb = choice?.verb ?? tx.navV2HabitsIdentityIntention ?? "";
  const sentenceTemplate =
    tx.navV2HabitsIdentitySentence ?? `${tx.navV2HabitsIdentityToday} {identity}`;
  const [sentenceBefore, sentenceAfter = ""] = sentenceTemplate.split("{identity}");
  const icon = choice?.icon ?? DEFAULT_IDENTITY_ICON;

  return (
    <p
      className="flex flex-wrap items-center gap-2 text-sm font-body text-muted-foreground"
      data-testid="hero-identity-prompt"
    >
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
        {sentenceBefore.trim()}
      </span>
      <span
        className="habit-identity-verb inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-base font-semibold"
        data-testid="hero-identity-verb"
      >
        <HabitIconVisual
          value={icon}
          fallback={DEFAULT_IDENTITY_ICON}
          iconClassName="h-3.5 w-3.5 text-[hsl(var(--zf-role-body-foreground))]"
          textClassName="text-sm leading-none text-[hsl(var(--zf-role-body-foreground))]"
        />
        <span className="font-hand text-lg italic leading-none tracking-normal text-foreground md:text-xl">
          {verb}
        </span>
      </span>
      {sentenceAfter.trim() ? (
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
          {sentenceAfter.trim()}
        </span>
      ) : null}
    </p>
  );
});
