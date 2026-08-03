/**
 * HeroTemplateLibrarySheet - V2 Ritual Deck template library.
 *
 * Keeps the existing Vaul bottom-sheet behavior and template source of truth,
 * while changing only the empty-state library presentation.
 */

import { memo, useMemo, useState, useCallback, type CSSProperties } from "react";
import { Drawer } from "vaul";
import { V2HabitPictogram } from "@/components/habit-pictogram/V2HabitPictogram";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticTap } from "@/lib/haptics";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useBackHandler } from "@/hooks/useBackHandler";
import { getRoleTone, getTemplateCategoryVisualRole } from "@/lib/nonOrbVisualRoles";
import { V2_SHELL_ICONS } from "@/lib/v2IconSystem";
import {
  habitTemplates,
  resolveHabitTemplateSetup,
  type HabitTemplate,
  type HabitTemplateCategory,
} from "@/lib/habitTemplates";
import { formatHabitQuantity } from "@/lib/habits";

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
  const AddedIcon = V2_SHELL_ICONS.confirm;

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

  useBackHandler(open, onClose);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[70] bg-[hsl(var(--foreground)/0.34)] backdrop-blur-md [-webkit-backdrop-filter:blur(8px)]" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[71] mt-24 flex max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)] flex-col rounded-t-[2rem] border border-[hsl(var(--border)/0.72)] bg-[radial-gradient(circle_at_16%_0%,hsl(var(--zf-role-energy)/0.20),transparent_32%),radial-gradient(circle_at_88%_10%,hsl(var(--zf-role-gratitude)/0.14),transparent_30%),linear-gradient(160deg,hsl(var(--card)/0.96),hsl(var(--surface-elevated)/0.92)_58%,hsl(var(--surface-overlay)/0.96))] text-[hsl(var(--foreground))] shadow-[0_-30px_100px_-58px_hsl(var(--foreground)/0.34)] focus:outline-none"
          data-testid="habits-library-sheet"
          data-surface="ritual-library-deck"
        >
          <div
            className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-[hsl(var(--zf-role-energy)/0.34)]"
            aria-hidden="true"
          />
          <div className="flex min-w-0 shrink-0 flex-col gap-1 ps-[max(1.25rem,var(--safe-inline-start))] pe-[max(1.25rem,var(--safe-inline-end))] pb-3 pt-4">
            <Drawer.Title
              className="min-w-0 whitespace-normal break-words font-display text-lg font-semibold tracking-tight text-[hsl(var(--foreground))] [hyphens:manual] [overflow-wrap:break-word]"
            >
              {tx.navV2HabitsLibraryTitle}
            </Drawer.Title>
            <Drawer.Description className="min-w-0 whitespace-normal break-words text-sm leading-snug text-[hsl(var(--muted-foreground))] [hyphens:manual] [overflow-wrap:break-word] font-body">
              {tx.navV2HabitsLibrarySubtitle}
            </Drawer.Description>
          </div>

          <nav
            className="flex shrink-0 gap-2 overflow-x-auto overscroll-x-contain ps-[max(1.25rem,var(--safe-inline-start))] pe-[max(1.25rem,var(--safe-inline-end))] pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={tx.navV2HabitsLibraryTitle}
            data-testid="habits-library-tabs"
          >
            {CATEGORIES.map((cat) => {
              const active = cat.key === activeCategory;
              const role = getTemplateCategoryVisualRole(cat.key);
              const tone = getRoleTone(role);
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    setActiveCategory(cat.key);
                  }}
                  className={
                    "inline-flex h-auto min-h-[44px] shrink-0 items-center whitespace-normal break-words rounded-[16px] border px-4 py-2 text-sm font-semibold [hyphens:manual] [overflow-wrap:break-word] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
                    (active
                      ? tone.activeSurfaceClass + " " + tone.textClass
                      : "border-[hsl(var(--border)/0.68)] bg-[hsl(var(--card)/0.62)] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card)/0.86)]") +
                    " " +
                    tone.focusRingClass +
                    (animate ? " motion-safe:transition-colors" : "")
                  }
                  aria-pressed={active}
                  data-testid={`habits-library-tab-${cat.key}`}
                  data-visual-role={role}
                  data-chip="ritual-library-tab"
                  style={{ "--habit-role": `var(${tone.cssVar})` } as CSSProperties}
                >
                  {tx[cat.i18nKey]}
                </button>
              );
            })}
          </nav>

          <ul
            className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,calc(9rem*var(--font-scale,1))),1fr))] gap-2 overflow-y-auto overscroll-contain ps-[max(1.25rem,var(--safe-inline-start))] pe-[max(1.25rem,var(--safe-inline-end))] pb-[calc(var(--safe-bottom)+1.25rem)] scroll-pb-[calc(var(--safe-bottom)+1.25rem)] md:grid-cols-3"
            data-testid="habits-library-list"
          >
            {filtered.map((tpl) => {
              const added = seededIds.has(tpl.id);
              const name = tpl.names[language] || tpl.names.en;
              const setup = resolveHabitTemplateSetup(tpl);
              const role = tpl.category ? getTemplateCategoryVisualRole(tpl.category) : "space";
              const tone = getRoleTone(role);
              const templateMeta =
                tpl.habitType === "numerical"
                  ? `${setup.targetType === "atMost" ? `${tx.atMost} ` : ""}${formatHabitQuantity(
                      setup.targetValue,
                      setup.unit,
                      language,
                    )}`
                  : tpl.defaultTime ?? "1x";

              return (
                <li key={tpl.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => handlePick(tpl)}
                    disabled={added}
                    className={
                      "group relative flex h-auto min-h-[118px] w-full min-w-0 flex-col items-start justify-between overflow-hidden rounded-[22px] border p-3 text-start shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_16px_36px_-34px_hsl(var(--zf-role-energy)/0.70)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
                      (added
                        ? "border-[hsl(var(--zf-role-body)/0.22)] bg-[hsl(var(--zf-role-body)/0.07)] text-[hsl(var(--muted-foreground))] opacity-70"
                        : "bg-[radial-gradient(circle_at_18%_0%,hsl(var(--card)/0.80),transparent_34%),linear-gradient(155deg,hsl(var(--card)/0.88),hsl(var(--surface-elevated)/0.78))] text-[hsl(var(--foreground))] " +
                          tone.borderClass) +
                      " " +
                      tone.focusRingClass +
                      (animate && !added
                        ? " motion-safe:transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                        : "")
                    }
                    data-testid={`habits-library-template-${tpl.id}`}
                    data-visual-role={role}
                    data-card="ritual-library-card"
                    aria-label={name}
                    aria-pressed={added}
                    style={{ "--habit-role": `var(${tone.cssVar})` } as CSSProperties}
                  >
                    <span
                      className={
                        "pointer-events-none absolute inset-x-4 top-0 h-[2px] rounded-b-full " +
                        (added ? "bg-[hsl(var(--zf-role-body)/0.44)]" : tone.railClass)
                      }
                      aria-hidden="true"
                    />
                    <span className="relative z-[1] flex w-full items-start justify-between gap-2">
                      <span
                        className={
                          "flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-visible rounded-none border-0 bg-transparent text-[hsl(var(--foreground))] shadow-none " +
                          (added ? "opacity-70" : "")
                        }
                        aria-hidden="true"
                        data-icon-frame="real-object-source-icon-native"
                        data-slot="ritual-library-icon"
                      >
                          <span data-slot="ritual-library-svg">
                            <V2HabitPictogram value={tpl.id} className="h-[4.35rem] w-[4.35rem] md:h-[5rem] md:w-[5rem]" />
                          </span>
                      </span>
                      {added && (
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--zf-role-body)/0.24)] bg-[hsl(var(--zf-role-body)/0.10)] text-[hsl(var(--zf-role-body-foreground))]"
                          aria-label={tx.navV2HabitsAlreadyAdded}
                        >
                          <AddedIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      )}
                    </span>
                    <span className="relative z-[1] flex min-w-0 flex-1 flex-col justify-end pt-2">
                      <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight [hyphens:manual] [overflow-wrap:break-word]" data-slot="ritual-library-label">
                        {name}
                      </span>
                      <span
                        className={
                          "mt-1 max-w-full whitespace-normal break-words rounded-full border px-2 py-1 text-xs font-semibold leading-tight [hyphens:manual] [overflow-wrap:break-word] " +
                          (added
                            ? "border-[hsl(var(--zf-role-body)/0.18)] text-[hsl(var(--muted-foreground))]"
                            : tone.borderClass + " " + tone.textClass)
                        }
                        data-slot="ritual-library-meta"
                      >
                        {templateMeta}
                      </span>
                    </span>
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
