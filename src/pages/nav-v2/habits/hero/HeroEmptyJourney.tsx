/**
 * HeroEmptyJourney - V2 Ritual Deck empty state.
 *
 * This pass is intentionally scoped to the first ritual empty state, routine
 * starter cards, and the library entry. Filled-state habit rows stay untouched.
 */

import { memo, useCallback, type CSSProperties } from "react";
import { V2HabitPictogram } from "@/components/habit-pictogram/V2HabitPictogram";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticTap } from "@/lib/haptics";
import {
  habitTemplates,
  ROUTINE_STARTER_TEMPLATE_IDS,
  type HabitTemplate,
} from "@/lib/habitTemplates";
import { V2_HABIT_JOURNEY_ICONS } from "@/lib/v2IconSystem";
import {
  getHabitStarterPlayTone,
  getHabitRoleTone,
  getRoleTone,
} from "@/lib/nonOrbVisualRoles";

interface HeroEmptyJourneyProps {
  onCreateHabit: () => void;
  /** Called when the user taps a quick-pick template. If omitted, chips hide. */
  onPickTemplate?: (template: HabitTemplate) => void;
  /** Called when the user wants to open the full library drawer. */
  onOpenLibrary?: () => void;
  /** Start = no habits yet; rest = active habits exist, but none are due today. */
  variant?: "start" | "rest";
}

/** Gentle, mainstream starters: low-friction rituals before specialist protocols. */
const QUICK_PICKS: readonly HabitTemplate[] = ROUTINE_STARTER_TEMPLATE_IDS.map((id) =>
  habitTemplates.find((t) => t.id === id),
).filter((t): t is HabitTemplate => Boolean(t));

const QUICK_PICK_META: Record<string, string> = {
  "drink-water": "1x",
  "walk-distance": "3km",
  exercise: "1x",
  read: "+1p",
  meditate: "5m",
  sleep: "22:00",
};

const HERO_RITUAL_DECK_CLASS =
  "relative mt-3 overflow-hidden rounded-[28px] border border-[hsl(var(--zf-role-energy)/0.24)] bg-[radial-gradient(circle_at_14%_0%,hsl(var(--zf-role-energy)/0.18),transparent_31%),radial-gradient(circle_at_92%_12%,hsl(var(--zf-role-gratitude)/0.13),transparent_30%),radial-gradient(circle_at_52%_118%,hsl(var(--zf-role-body)/0.16),transparent_38%),linear-gradient(155deg,hsl(var(--card)/0.96)_0%,hsl(var(--surface-elevated)/0.90)_56%,hsl(var(--surface-overlay)/0.95)_100%)] px-4 py-4 text-start text-[hsl(var(--foreground))] shadow-[0_28px_96px_-72px_hsl(var(--foreground)/0.38),0_18px_62px_-54px_hsl(var(--zf-role-energy)/0.44)] before:pointer-events-none before:absolute before:inset-x-10 before:top-0 before:h-[2px] before:rounded-b-full before:bg-[linear-gradient(90deg,hsl(var(--zf-role-energy)/0.88),hsl(var(--zf-role-body)/0.82)_28%,hsl(var(--zf-role-gratitude)/0.70)_72%,hsl(var(--zf-role-rest)/0.72))] after:pointer-events-none after:absolute after:inset-[1px] after:rounded-[27px] after:border after:border-[hsl(var(--foreground)/0.07)] md:mt-6 md:px-7 md:py-7";

const QUICK_PICK_CARD_CLASS =
  "group relative isolate flex min-h-[136px] w-full min-w-[44px] flex-col items-start justify-between overflow-hidden rounded-[22px] border bg-[linear-gradient(155deg,hsl(var(--card)/0.98)_0%,hsl(var(--secondary)/0.92)_52%,hsl(var(--background)/0.74)_100%)] p-3 text-start text-sm font-semibold leading-tight text-[hsl(var(--foreground))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),inset_0_-34px_58px_-48px_hsl(var(--foreground)/0.34),0_18px_42px_-34px_hsl(var(--foreground)/0.42)] backdrop-blur-xl after:pointer-events-none after:absolute after:inset-[1px] after:rounded-[21px] after:border after:border-[hsl(var(--foreground)/0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const QUICK_PICK_ICON_CLASS =
  "flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-visible rounded-none border-0 bg-transparent text-[hsl(var(--foreground))] shadow-none";

const QUICK_PICK_META_CLASS =
  "rounded-full border bg-[hsl(var(--card)/0.86)] px-2.5 py-1 text-[11px] font-bold leading-none text-[hsl(var(--foreground))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_8px_18px_-15px_hsl(var(--foreground)/0.42)] tabular-nums";

const QUICK_PICK_LABEL_CLASS =
  "relative z-[1] line-clamp-2 max-w-full pr-1 text-[15px] font-bold leading-tight text-[hsl(var(--foreground))]";

function RitualDeckScene({ animate }: { animate: boolean }) {
  return (
    <div
      className="relative h-24 w-28 overflow-visible"
      role="presentation"
      aria-hidden="true"
      data-motion="option-b-liquid-glass-totem-hero"
    >
      <span
        className="absolute inset-x-3 bottom-3 h-5 rounded-full bg-[hsl(var(--foreground)/0.10)] blur-xl"
        data-scene-layer="soft-shadow"
      />
      <span
        className={
          "absolute left-1/2 top-1/2 h-[5.1rem] w-[4.25rem] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-[hsl(var(--foreground)/0.10)] bg-[linear-gradient(145deg,hsl(var(--card)/0.42),hsl(var(--surface-elevated)/0.18))] shadow-[inset_0_1px_0_hsl(var(--background)/0.72),0_18px_42px_-34px_hsl(var(--foreground)/0.34)] backdrop-blur-xl " +
          (animate ? "motion-safe:animate-[v2hp-b41-hero-plate_6s_ease-in-out_infinite]" : "")
        }
        data-scene-layer="b41-plate"
      />
      <span
        className={
          "absolute left-1/2 top-1/2 h-[4.8rem] w-4 -translate-x-1/2 -translate-y-1/2 rotate-[-18deg] rounded-full bg-[linear-gradient(180deg,hsl(var(--background)/0.68),transparent_42%,hsl(var(--zf-role-energy)/0.16)_80%,transparent)] mix-blend-screen " +
          (animate ? "motion-safe:animate-[v2hp-b41-hero-facet_5s_ease-in-out_infinite]" : "")
        }
        data-scene-layer="b41-refraction"
      />
      <span
        className="absolute left-1/2 top-[12%] h-3 w-12 -translate-x-1/2 rotate-[-16deg] rounded-full bg-[linear-gradient(90deg,transparent,hsl(var(--background)/0.78),transparent)] opacity-70 mix-blend-screen"
        data-scene-layer="b41-highlight"
      />
      <span
        className="absolute bottom-[22%] left-1/2 h-3 w-16 -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,transparent,hsl(var(--zf-role-energy)/0.18),hsl(var(--zf-role-body)/0.14),transparent)] opacity-70 mix-blend-screen"
        data-scene-layer="b41-caustic"
      />
      <span
        className={
          "absolute left-1/2 top-1/2 grid h-[4.25rem] w-[4.25rem] -translate-x-1/2 -translate-y-1/2 place-items-center " +
          (animate ? "motion-safe:animate-[v2hp-b41-hero-float_4.2s_ease-in-out_infinite]" : "")
        }
        data-scene-layer="b41-symbol"
      >
        <V2HabitPictogram value="drink-water" className="h-[4.1rem] w-[4.1rem] md:h-[4.85rem] md:w-[4.85rem]" />
      </span>
      <span
        className="absolute right-5 top-4 h-2.5 w-2.5 rounded-sm bg-[linear-gradient(135deg,hsl(var(--background)/0.92),hsl(var(--zf-role-energy)/0.24))] shadow-[0_0_18px_hsl(var(--zf-role-energy)/0.34)] [clip-path:polygon(50%_0,62%_38%,100%_50%,62%_62%,50%_100%,38%_62%,0_50%,38%_38%)]"
        data-scene-layer="b41-spark"
      />
    </div>
  );
}

export const HeroEmptyJourney = memo(function HeroEmptyJourney({
  onCreateHabit,
  onPickTemplate,
  onOpenLibrary,
  variant = "start",
}: HeroEmptyJourneyProps) {
  const { t, language } = useLanguage();
  const tx = t;
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

  const bodyTone = getHabitRoleTone("body");
  const focusTone = getHabitRoleTone("focus");
  const LibraryIcon = V2_HABIT_JOURNEY_ICONS.library;
  const CreateHabitIcon = V2_HABIT_JOURNEY_ICONS.create;
  const isRestDay = variant === "rest";
  const title = isRestDay ? tx.noHabitsToday : tx.navV2HabitsEmpty;
  const subtitle = isRestDay ? tx.navV2HabitsRecovery : tx.navV2HabitsStartSmall;

  return (
    <div
      className={HERO_RITUAL_DECK_CLASS}
      data-testid="habits-hero-empty"
      data-visual-role="body"
      data-tone="ritual-deck"
      data-surface="ink-paper"
    >
      <div className="relative z-[1] grid grid-cols-[auto_1fr] items-center gap-3">
        <div
          className="flex h-24 w-28 items-center justify-center overflow-visible rounded-[24px] border border-[hsl(var(--zf-role-energy)/0.28)] bg-[linear-gradient(145deg,hsl(var(--zf-role-energy)/0.14),hsl(var(--card)/0.84)_46%,hsl(var(--zf-role-gratitude)/0.12)),hsl(var(--surface-elevated)/0.76)] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_20px_54px_-40px_hsl(var(--foreground)/0.34)]"
          data-testid="hero-ritual-board-scene"
          data-scene="option-b-liquid-glass-totem"
        >
          <RitualDeckScene animate={animate} />
        </div>
        <div className="min-w-0">
          <p className="font-display text-[21px] font-semibold leading-tight tracking-tight text-[hsl(var(--foreground))] md:text-[28px]">
            {title}
          </p>
          <p className="mt-1 max-w-md text-sm leading-snug text-[hsl(var(--muted-foreground))] font-body">
            {subtitle}
          </p>
        </div>
      </div>

      {onPickTemplate && !isRestDay && (
        <div className="relative z-[1] mt-4">
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {tx.navV2HabitsQuickPick}
          </p>
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-3" data-testid="hero-empty-quickpick">
            {QUICK_PICKS.map((tpl) => {
              const name = tpl.names[language] || tpl.names.en;
              const playTone = getHabitStarterPlayTone(tpl.id);
              const tone = getRoleTone(playTone.role);
              const meta = QUICK_PICK_META[tpl.id] ?? "1x";
              return (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(tpl)}
                    className={
                      QUICK_PICK_CARD_CLASS +
                      " " +
                      tone.borderClass +
                      " " +
                      tone.focusRingClass +
                      " " +
                      (animate
                        ? "motion-safe:transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
                        : "")
                    }
                    data-testid={`hero-quickpick-${tpl.id}`}
                    data-visual-role={playTone.role}
                    data-tile="ritual-deck-card"
                    aria-label={name}
                    style={{ "--habit-role": `var(${tone.cssVar})` } as CSSProperties}
                  >
                    <span
                      className={"pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-70 blur-2xl " + playTone.haloClass}
                      aria-hidden="true"
                    />
                    <span
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent,hsl(var(--background)/0.18))]"
                      aria-hidden="true"
                    />
                    <span
                      className={"absolute inset-x-4 top-0 h-[2px] rounded-b-full " + tone.railClass}
                      aria-hidden="true"
                    />
                    <span className="relative z-[1] flex w-full items-start justify-between gap-2">
                      <span
                        className={QUICK_PICK_ICON_CLASS}
                        aria-hidden="true"
                        data-icon-frame="real-object-source-icon-native"
                      >
                        <span data-slot="quickpick-svg">
                          <V2HabitPictogram value={tpl.id} className="h-[4.35rem] w-[4.35rem] md:h-[5rem] md:w-[5rem]" />
                        </span>
                      </span>
                      <span
                        className={
                          QUICK_PICK_META_CLASS +
                          " " +
                          tone.borderClass +
                          " ring-1 ring-[hsl(var(--foreground)/0.05)]"
                        }
                        aria-hidden="true"
                        data-slot="quickpick-meta"
                      >
                        {meta}
                      </span>
                    </span>
                    <span className={QUICK_PICK_LABEL_CLASS} data-slot="quickpick-label">
                      {name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="relative z-[1] mt-4 grid grid-cols-[minmax(0,1.25fr)_minmax(112px,0.75fr)] gap-2">
        <button
          type="button"
          onClick={handleCreate}
          className={
            "inline-flex min-h-[48px] min-w-[44px] items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,hsl(var(--zf-role-energy)/0.94),hsl(var(--zf-role-body)/0.86))] px-4 py-3 text-sm font-semibold text-[hsl(var(--zf-night-0))] shadow-[0_20px_48px_-30px_hsl(var(--zf-role-energy)/0.90)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
            bodyTone.focusRingClass +
            " " +
            (animate ? "motion-safe:transition-transform active:scale-[0.97]" : "")
          }
          aria-label={tx.navV2HabitsCreate}
          data-testid="habits-hero-create-empty"
        >
          <CreateHabitIcon className="h-4 w-4" aria-hidden="true" />
          <span className="truncate">{tx.navV2HabitsCreate}</span>
        </button>
        {onOpenLibrary && (
          <button
            type="button"
            onClick={handleOpenLibrary}
            className={
              "inline-flex min-h-[48px] min-w-[112px] items-center justify-center gap-2 rounded-[22px] border bg-[hsl(var(--card)/0.72)] px-3 py-3 text-xs font-semibold text-[hsl(var(--foreground))] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
              focusTone.borderClass +
              " " +
              focusTone.focusRingClass +
              " " +
              (animate ? "motion-safe:transition-colors hover:bg-[hsl(var(--zf-role-energy)/0.14)]" : "")
            }
            data-testid="hero-empty-open-library"
            data-visual-role="focus"
          >
            <LibraryIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{tx.navV2HabitsBrowseLibrary}</span>
          </button>
        )}
      </div>

    </div>
  );
});
