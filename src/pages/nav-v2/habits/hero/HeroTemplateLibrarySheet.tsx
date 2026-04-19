/**
 * HeroTemplateLibrarySheet — Vaul bottom-sheet library of habit templates.
 *
 * Ergonomics (research-backed):
 *   - Habitify / Fabulous ship a categorized "library" of pre-named habits
 *     rather than a blank form. One-tap add beats form-filling for novices.
 *   - Bottom-sheet (Vaul) keeps the hero page visible behind — less context
 *     switch than a full modal (Apple HIG 2026).
 *   - 5 category pills (Body / Mind / Focus / Rest / Quit) act as filters.
 *   - Added-state visual reflects idempotence: once you tap a template it
 *     gets a subtle emerald badge + disabled tap so you can't duplicate.
 *
 * Reuses V1 {@link habitTemplates} (already localized in 8 languages, so no
 * i18n proliferation) and {@link templateToHabit} for Habit materialization.
 * The drawer itself is lazy: the parent gates mount via `open`, Vaul handles
 * the animation primitives + Android back-handler.
 */

import { memo, useMemo, useState, useCallback } from "react";
import { Drawer } from "vaul";
import { Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticTap } from "@/lib/haptics";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import {
  habitTemplates,
  type HabitTemplate,
  type HabitTemplateCategory,
} from "@/lib/habitTemplates";

interface HeroTemplateLibrarySheetProps {
  open: boolean;
  onClose: () => void;
  /** Set of template ids already present in the user's habit list. */
  seededIds: ReadonlySet<string>;
  onPickTemplate: (template: HabitTemplate) => void;
}

const CATEGORIES: readonly {
  key: HabitTemplateCategory;
  i18nKey: string;
}[] = [
  { key: "body", i18nKey: "navV2HabitsCategoryBody" },
  { key: "mind", i18nKey: "navV2HabitsCategoryMind" },
  { key: "focus", i18nKey: "navV2HabitsCategoryFocus" },
  { key: "rest", i18nKey: "navV2HabitsCategoryRest" },
  { key: "quit", i18nKey: "navV2HabitsCategoryQuit" },
];

export const HeroTemplateLibrarySheet = memo(function HeroTemplateLibrarySheet({
  open,
  onClose,
  seededIds,
  onPickTemplate,
}: HeroTemplateLibrarySheetProps) {
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const animate = useShouldAnimate();

  const [activeCategory, setActiveCategory] = useState<HabitTemplateCategory>("body");

  const filtered = useMemo(
    () => habitTemplates.filter((tpl) => tpl.category === activeCategory),
    [activeCategory],
  );

  const handlePick = useCallback(
    (tpl: HabitTemplate) => {
      if (seededIds.has(tpl.id)) return;
      void hapticTap();
      onPickTemplate(tpl);
    },
    [seededIds, onPickTemplate],
  );

  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[71] mt-24 flex max-h-[85vh] flex-col rounded-t-3xl bg-background text-foreground shadow-2xl focus:outline-none"
          aria-labelledby="habits-library-title"
          data-testid="habits-library-sheet"
        >
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" aria-hidden="true" />
          <div className="flex shrink-0 flex-col gap-1 px-5 pt-4 pb-3">
            <Drawer.Title
              id="habits-library-title"
              className="font-display text-lg font-semibold tracking-tight"
            >
              {tx.navV2HabitsLibraryTitle}
            </Drawer.Title>
            <p className="text-sm text-muted-foreground font-body">
              {tx.navV2HabitsLibrarySubtitle}
            </p>
          </div>

          <nav
            className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={tx.navV2HabitsLibraryTitle}
            data-testid="habits-library-tabs"
          >
            {CATEGORIES.map((cat) => {
              const active = cat.key === activeCategory;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    setActiveCategory(cat.key);
                  }}
                  className={
                    "inline-flex min-h-[40px] shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
                    (active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-foreground hover:bg-muted") +
                    (animate ? " motion-safe:transition-colors" : "")
                  }
                  aria-pressed={active}
                  data-testid={`habits-library-tab-${cat.key}`}
                >
                  {tx[cat.i18nKey]}
                </button>
              );
            })}
          </nav>

          <ul
            className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:grid-cols-3"
            data-testid="habits-library-list"
          >
            {filtered.map((tpl) => {
              const added = seededIds.has(tpl.id);
              const name = tpl.names[language] || tpl.names.en;
              return (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(tpl)}
                    disabled={added}
                    className={
                      "flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-3 py-3 text-start shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
                      (added
                        ? "border-emerald-500/30 bg-emerald-500/10 text-foreground/80"
                        : "border-border bg-card/80 text-foreground hover:border-primary/50 hover:bg-primary/5") +
                      (animate && !added
                        ? " motion-safe:transition-all active:scale-[0.98]"
                        : "")
                    }
                    data-testid={`habits-library-template-${tpl.id}`}
                    aria-label={name}
                    aria-pressed={added}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-xl">
                      {tpl.icon}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{name}</span>
                      {tpl.defaultTime && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          ⏰ {tpl.defaultTime}
                        </span>
                      )}
                    </span>
                    {added && (
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                        aria-label={tx.navV2HabitsAlreadyAdded}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
});
