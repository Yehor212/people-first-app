import { motion } from "framer-motion";
import type { CSSProperties } from "react";
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
import { getV2HabitTemplateIcon, getV2HabitTemplateSymbol } from "@/lib/v2IconSystem";
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
          "text-sm font-medium mb-3",
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
      <div className="grid grid-cols-2 gap-2 mb-4">
        {visibleTemplates
          .filter(
            (template) =>
              !habits.some(
                (h) =>
                  h.name === (template.names[language] || template.names.en),
              ),
          )
          .map((template, index) => {
            const TemplateIcon = getV2HabitTemplateIcon(template.id);
            const symbol = getV2HabitTemplateSymbol(template.id);
            const role = getHabitStarterPlayTone(template.id).role;
            const tone = getRoleTone(role);
            const roleStyle = getRoleStyleVars(role) as CSSProperties;
            return isPrimaryCTA ? (
              <motion.button
                key={template.id}
                onClick={() => handleQuickAdd(template.id)}
                data-template-picker-card="true"
                data-card={useRitualPicker ? "ritual-template-picker-card" : undefined}
                data-visual-role={useRitualPicker ? role : undefined}
                className={cn(
                  "flex min-h-[58px] items-center gap-3 rounded-[18px] border px-3 py-3 text-start motion-safe:transition-all",
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
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border",
                    useRitualPicker
                      ? "bg-[hsl(var(--card)/0.62)] text-[hsl(var(--foreground))] " +
                          tone.borderClass
                      : "border-[hsl(var(--zf-role-energy)/0.22)] bg-[hsl(var(--zf-night-0)/0.42)] text-[1.35rem]",
                  )}
                  data-template-picker-icon="true"
                  data-slot="template-picker-icon"
                >
                  <span className="text-[1.35rem] leading-none" data-slot="template-picker-symbol">
                    {symbol}
                  </span>
                </span>
                <span className="truncate text-sm font-semibold" data-slot="template-picker-label">
                  {template.names[language] || template.names.en}
                </span>
              </motion.button>
            ) : (
              <Button
                key={template.id}
                variant="outline"
                size="default"
                onClick={() => handleQuickAdd(template.id)}
                className="justify-start gap-2 min-h-[48px]"
              >
                {isV2Presentation ? (
                  <TemplateIcon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
                ) : (
                  <span className="text-xl">{template.icon}</span>
                )}
                <span className="truncate">
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
          className="flex min-h-[48px] w-full items-center justify-between rounded-[18px] border border-[hsl(var(--zf-role-space)/0.34)] bg-[radial-gradient(circle_at_12%_0%,hsl(var(--zf-role-space)/0.20),transparent_34%),linear-gradient(135deg,hsl(var(--card)/0.76),hsl(var(--background)/0.58))] px-3 py-3 text-sm font-semibold text-[hsl(var(--foreground))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_14px_34px_-30px_hsl(var(--zf-role-space)/0.70)] motion-safe:transition-colors hover:border-[hsl(var(--zf-role-space)/0.48)] hover:bg-[hsl(var(--zf-role-space)/0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-space)/0.62)] focus-visible:ring-offset-2"
          data-card="ritual-custom-habit-action"
          data-visual-role="space"
          style={getRoleStyleVars("space") as CSSProperties}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Settings2 className="h-5 w-5 shrink-0 text-[hsl(var(--zf-role-space))]" />
            <span className="truncate">{t.createCustomHabit}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-[hsl(var(--zf-text-soft))] rtl:scale-x-[-1]" />
        </button>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowCustomForm(true)}
          className="w-full justify-between min-h-[48px]"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            <span>{t.createCustomHabit}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground rtl:scale-x-[-1]" />
        </Button>
      )}
    </motion.div>
  );
}
