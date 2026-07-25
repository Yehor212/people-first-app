import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { V2HabitPictogram } from "@/components/habit-pictogram/V2HabitPictogram";
import { zenMotion, zenTap } from "@/lib/animationUtils";
import { Settings2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { habitTemplates, ROUTINE_STARTER_TEMPLATE_IDS } from "@/lib/habitTemplates";
import {
  getHabitStarterPlayTone,
  getRoleStyleVars,
  getRoleTone,
} from "@/lib/nonOrbVisualRoles";
import type { Habit } from "@/types";
import type { Language } from "@/i18n/types";

interface TemplatePickerProps {
  isPrimaryCTA: boolean;
  habits: Habit[];
  language: Language;
  t: Record<string, string>;
  handleQuickAdd: (templateId: string) => void;
  setShowCustomForm: (show: boolean) => void;
  presentation?: "default" | "v2";
}

export function TemplatePicker({
  isPrimaryCTA,
  habits,
  language,
  t,
  handleQuickAdd,
  setShowCustomForm,
  presentation = "default",
}: TemplatePickerProps) {
  const isV2Presentation = presentation === "v2";
  const useRitualPicker = isPrimaryCTA && isV2Presentation;
  const visibleTemplates = isV2Presentation
    ? ROUTINE_STARTER_TEMPLATE_IDS.map((id) =>
        habitTemplates.find((template) => template.id === id),
      ).filter((template): template is (typeof habitTemplates)[number] => Boolean(template))
    : habitTemplates.slice(0, 6);

  return (
    <motion.div
      data-surface="habit-template-picker"
      className={cn(
        "mb-4 rounded-2xl p-4",
        useRitualPicker
          ? "relative isolate overflow-hidden border border-[hsl(var(--zf-role-body)/0.24)] bg-[radial-gradient(circle_at_14%_0%,hsl(var(--zf-role-body)/0.16),transparent_34%),radial-gradient(circle_at_92%_4%,hsl(var(--zf-role-focus)/0.12),transparent_32%),linear-gradient(155deg,hsl(var(--card)/0.92),hsl(var(--secondary)/0.82)_58%,hsl(var(--background)/0.76))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_22px_58px_-48px_hsl(var(--zf-role-body)/0.62)]"
          : isPrimaryCTA
            ? "bg-foreground/5 backdrop-blur-sm border border-foreground/10"
            : "bg-secondary",
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={zenMotion.snappy}
    >
      <p
        className={cn(
          "mb-3 break-words text-sm font-medium [hyphens:manual] [overflow-wrap:break-word]",
          useRitualPicker
            ? "text-[hsl(var(--zf-text-soft))]"
            : isPrimaryCTA
            ? "text-slate-700 dark:text-foreground/80"
            : "text-foreground",
        )}
        data-slot="template-picker-heading"
      >
        {t.quickAdd}
      </p>
      <div
        className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(8rem*var(--font-scale,1))),1fr))] gap-2"
        data-slot="template-picker-grid"
      >
        {visibleTemplates
          .filter(
            (template) =>
              !habits.some(
                (h) =>
                  h.name === (template.names[language] || template.names.en),
              ),
          )
          .map((template, index) => {
            const role = getHabitStarterPlayTone(template.id).role;
            const tone = getRoleTone(role);
            const roleStyle = getRoleStyleVars(role) as unknown as CSSProperties;
            return isPrimaryCTA ? (
              <motion.button
                key={template.id}
                onClick={() => handleQuickAdd(template.id)}
                data-template-picker-card="true"
                data-card={useRitualPicker ? "ritual-template-picker-card" : undefined}
                data-visual-role={useRitualPicker ? role : undefined}
                className={cn(
                  "flex h-auto min-w-0 items-center rounded-[18px] border text-start motion-safe:transition-all",
                  useRitualPicker ? "min-h-[84px] gap-2 px-2.5 py-2.5" : "min-h-[58px] gap-3 px-3 py-3",
                  useRitualPicker
                    ? "relative isolate overflow-hidden text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
                        tone.borderClass +
                        " " +
                        tone.focusRingClass
                    : "border-[hsl(var(--zf-role-energy)/0.18)] bg-[hsl(var(--zf-night-1)/0.52)] text-foreground/80 hover:bg-[hsl(var(--zf-role-energy)/0.10)] hover:text-foreground",
                )}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.02 }}
                whileTap={zenTap.card}
                style={
                  useRitualPicker
                    ? roleStyle
                    : undefined
                }
              >
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center",
                    useRitualPicker
                      ? "h-[4.25rem] w-[4.25rem] overflow-visible rounded-none border-0 bg-transparent text-[hsl(var(--foreground))] shadow-none"
                      : "h-10 w-10 rounded-[15px] border border-[hsl(var(--zf-role-energy)/0.22)] bg-[hsl(var(--zf-night-0)/0.42)] text-[1.35rem]",
                  )}
                  data-icon-frame={useRitualPicker ? "real-object-source-icon-native" : undefined}
                  data-template-picker-icon="true"
                  data-slot="template-picker-icon"
                >
                  <span data-slot="template-picker-svg">
                    <V2HabitPictogram
                      value={template.id}
                      className={useRitualPicker ? "h-[3.85rem] w-[3.85rem] md:h-[4.45rem] md:w-[4.45rem]" : "h-7 w-7"}
                    />
                  </span>
                </span>
                <span
                  className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight [hyphens:manual] [overflow-wrap:break-word]"
                  data-slot="template-picker-label"
                >
                  {template.names[language] || template.names.en}
                </span>
              </motion.button>
            ) : (
              <Button
                key={template.id}
                variant="outline"
                size="default"
                onClick={() => handleQuickAdd(template.id)}
                className="h-auto min-h-[48px] min-w-0 justify-start gap-2 whitespace-normal break-words py-2 [hyphens:manual] [overflow-wrap:break-word]"
              >
                {isV2Presentation ? (
                  <span
                    className="inline-flex h-[24px] w-[24px] shrink-0 items-center justify-center"
                    data-slot="template-picker-svg"
                  >
                    <V2HabitPictogram value={template.id} className="h-6 w-6" />
                  </span>
                ) : (
                  <span className="text-xl">{template.icon}</span>
                )}
                <span
                  className="min-w-0 whitespace-normal break-words text-start [hyphens:manual] [overflow-wrap:break-word]"
                  data-slot="template-picker-label"
                >
                  {template.names[language] || template.names.en}
                </span>
              </Button>
            );
          })}
      </div>
      {useRitualPicker ? (
        <button
          type="button"
          onClick={() => setShowCustomForm(true)}
          className="flex h-auto min-h-[48px] w-full min-w-0 items-center justify-between gap-2 whitespace-normal break-words rounded-[18px] border border-[hsl(var(--zf-role-space)/0.34)] bg-[radial-gradient(circle_at_12%_0%,hsl(var(--zf-role-space)/0.20),transparent_34%),linear-gradient(135deg,hsl(var(--card)/0.76),hsl(var(--background)/0.58))] px-3 py-3 text-sm font-semibold text-[hsl(var(--foreground))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_14px_34px_-30px_hsl(var(--zf-role-space)/0.70)] [hyphens:manual] [overflow-wrap:break-word] motion-safe:transition-colors hover:border-[hsl(var(--zf-role-space)/0.48)] hover:bg-[hsl(var(--zf-role-space)/0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-space)/0.62)] focus-visible:ring-offset-2"
          data-card="ritual-custom-habit-action"
          data-visual-role="space"
          style={getRoleStyleVars("space") as unknown as CSSProperties}
        >
          <span className="flex min-w-0 flex-1 items-start gap-2">
            <Settings2 className="h-5 w-5 shrink-0 text-[hsl(var(--zf-role-space-foreground))]" aria-hidden="true" />
            <span
              className="min-w-0 break-words text-start [hyphens:manual] [overflow-wrap:break-word]"
              data-slot="template-picker-custom-label"
            >
              {t.createCustomHabit}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-[hsl(var(--zf-text-soft))] rtl:scale-x-[-1]" aria-hidden="true" />
        </button>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowCustomForm(true)}
          className="h-auto min-h-[48px] w-full min-w-0 justify-between gap-2 whitespace-normal break-words py-2 [hyphens:manual] [overflow-wrap:break-word]"
        >
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <Settings2 className="w-5 h-5 text-primary" aria-hidden="true" />
            <span
              className="min-w-0 break-words text-start [hyphens:manual] [overflow-wrap:break-word]"
              data-slot="template-picker-custom-label"
            >
              {t.createCustomHabit}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground rtl:scale-x-[-1]" aria-hidden="true" />
        </Button>
      )}
    </motion.div>
  );
}
