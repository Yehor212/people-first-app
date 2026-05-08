/**
 * HeroEmptyJourney - V2 Ritual Deck empty state.
 *
 * This pass is intentionally scoped to the first ritual empty state, routine
 * starter cards, and the library entry. Filled-state habit rows stay untouched.
 */

import { memo, useCallback, type CSSProperties } from "react";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticTap } from "@/lib/haptics";
import {
  habitTemplates,
  ROUTINE_STARTER_TEMPLATE_IDS,
  type HabitTemplate,
} from "@/lib/habitTemplates";
import {
  V2_HABIT_JOURNEY_ICONS,
  getV2HabitTemplateSymbol,
} from "@/lib/v2IconSystem";
import {
  getHabitStarterPlayTone,
  getHabitRoleTone,
  getRoleTone,
  type NonOrbVisualRole,
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
  "group relative isolate flex min-h-[108px] w-full min-w-[44px] flex-col items-start justify-between overflow-hidden rounded-[22px] border bg-[linear-gradient(155deg,hsl(var(--card)/0.98)_0%,hsl(var(--secondary)/0.92)_52%,hsl(var(--background)/0.74)_100%)] p-3 text-start text-sm font-semibold leading-tight text-[hsl(var(--foreground))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),inset_0_-34px_58px_-48px_hsl(var(--foreground)/0.34),0_18px_42px_-34px_hsl(var(--foreground)/0.42)] backdrop-blur-xl after:pointer-events-none after:absolute after:inset-[1px] after:rounded-[21px] after:border after:border-[hsl(var(--foreground)/0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const QUICK_PICK_ICON_CLASS =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border bg-[linear-gradient(145deg,hsl(var(--foreground)/0.12),hsl(var(--card)/0.82))] text-[hsl(var(--foreground))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.14),0_10px_24px_-18px_hsl(var(--foreground)/0.45)]";

const QUICK_PICK_META_CLASS =
  "rounded-full border bg-[hsl(var(--card)/0.86)] px-2.5 py-1 text-[11px] font-bold leading-none text-[hsl(var(--foreground))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_8px_18px_-15px_hsl(var(--foreground)/0.42)] tabular-nums";

const QUICK_PICK_LABEL_CLASS =
  "relative z-[1] line-clamp-2 max-w-full pr-1 text-[15px] font-bold leading-tight text-[hsl(var(--foreground))]";

const HERO_DECK_CARDS = [
  {
    id: "drink-water",
    role: "focus",
    stillClass: "translate-x-[-2.45rem] translate-y-[1.35rem] rotate-[-15deg] scale-[0.86]",
    motionClass: "ritual-card-focus",
  },
  {
    id: "walk-distance",
    role: "body",
    stillClass: "translate-y-[-0.9rem] rotate-[1deg] scale-[1.12]",
    motionClass: "ritual-card-body",
  },
  {
    id: "read",
    role: "rest",
    stillClass: "translate-x-[2.45rem] translate-y-[1.25rem] rotate-[13deg] scale-[0.9]",
    motionClass: "ritual-card-rest",
  },
] satisfies Array<{
  id: string;
  role: NonOrbVisualRole;
  stillClass: string;
  motionClass: string;
}>;

function RitualDeckScene({ animate }: { animate: boolean }) {
  return (
    <div
      className="relative h-24 w-28 overflow-visible"
      role="presentation"
      aria-hidden="true"
      data-motion="ritual-card-carousel"
    >
      <span
        className="absolute left-1/2 top-1/2 h-[5.95rem] w-[5.95rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[hsl(var(--zf-role-energy)/0.20)] bg-[radial-gradient(circle,hsl(var(--zf-role-energy)/0.14),transparent_63%)]"
        data-scene-layer="halo"
      />
      <span
        className={
          "absolute left-1/2 top-1/2 h-[5.95rem] w-[5.95rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[hsl(var(--zf-role-body)/0.34)] " +
          (animate ? "motion-safe:animate-[orbit-spin_14s_linear_infinite]" : "")
        }
        data-scene-layer="orbit"
      />
      <span
        className="absolute left-1/2 top-1/2 h-[4.15rem] w-[4.15rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[hsl(var(--foreground)/0.08)] bg-[linear-gradient(155deg,hsl(var(--card)/0.86),hsl(var(--surface-elevated)/0.56))]"
        data-scene-layer="core"
      />
      <span
        className="absolute inset-x-3 bottom-2 h-5 rounded-full bg-[hsl(var(--zf-role-energy)/0.16)] blur-xl"
        data-scene-layer="shadow"
      />
      <span
        className={
          "absolute inset-x-5 bottom-4 h-[2px] rounded-full bg-[linear-gradient(90deg,hsl(var(--zf-role-energy)/0),hsl(var(--zf-role-energy)/0.72),hsl(var(--zf-role-body)/0.64),hsl(var(--zf-role-release)/0))] " +
          (animate ? "ritual-rail-pulse" : "")
        }
        data-scene-layer="rail"
      />
      <span
        className={
          "absolute left-1/2 top-1/2 -ml-1 -mt-1 flex h-2 w-2 items-center justify-center rounded-full bg-[hsl(var(--zf-role-energy)/0.95)] shadow-[0_0_18px_hsl(var(--zf-role-energy)/0.85)] " +
          (animate ? "ritual-loop-comet" : "translate-x-[3.05rem]")
        }
        data-ritual-comet="true"
      >
        <span className="h-1 w-1 rounded-full bg-[hsl(var(--card)/0.92)]" />
      </span>
      <span
        className={
          "absolute bottom-5 left-9 h-1.5 w-1.5 rounded-full bg-[hsl(var(--zf-role-body)/0.78)] " +
          (animate ? "ritual-spark-rise" : "opacity-50")
        }
        style={{ "--spark-x": "-0.6rem" } as CSSProperties}
        data-ritual-spark="body"
      />
      <span
        className={
          "absolute bottom-4 right-8 h-1.5 w-1.5 rounded-full bg-[hsl(var(--zf-role-rest)/0.76)] " +
          (animate ? "ritual-spark-rise [animation-delay:1.35s]" : "opacity-50")
        }
        style={{ "--spark-x": "0.7rem" } as CSSProperties}
        data-ritual-spark="rest"
      />
      {HERO_DECK_CARDS.map((card, index) => {
        const tone = getRoleTone(card.role);
        return (
          <span
            key={card.id}
            className={
              "ritual-loop-card absolute left-1/2 top-1/2 -ml-[1.65rem] -mt-[2.05rem] flex h-[4.15rem] w-[3.3rem] items-center justify-center rounded-[1.05rem] border bg-[linear-gradient(155deg,hsl(var(--card)/0.94),hsl(var(--surface-elevated)/0.82))] text-[1.65rem] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_18px_34px_-28px_hsl(var(--foreground)/0.30)] " +
              tone.borderClass +
              " " +
              (animate ? card.motionClass : card.stillClass)
            }
            data-ritual-card={index + 1}
            data-card-motion={card.motionClass}
          >
            <span className={"absolute inset-x-3 top-2 h-1 rounded-full " + tone.railClass} />
            <span>{getV2HabitTemplateSymbol(card.id)}</span>
          </span>
        );
      })}
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
          data-scene="ritual-carousel"
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
              const symbol = getV2HabitTemplateSymbol(tpl.id);
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
                        className={
                          QUICK_PICK_ICON_CLASS +
                          " " +
                          tone.borderClass
                        }
                        aria-hidden="true"
                        data-icon-medallion="true"
                      >
                        <span className="text-[1.7rem] leading-none" data-slot="quickpick-symbol">
                          {symbol}
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
