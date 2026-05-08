/**
 * NumericalTargetSection вЂ” Target value, unit, and at-least/at-most controls.
 */

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Gauge,
  Minus,
  MousePointerClick,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { zenTap } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";
import type { HabitNumericalEntryMode } from "@/types";

interface NumericalTargetSectionProps {
  isPrimaryCTA: boolean;
  ts: Record<string, string>;
  targetValue: number;
  targetStep: number;
  setTargetValue: (v: number) => void;
  targetType: "atLeast" | "atMost";
  setTargetType: (t: "atLeast" | "atMost") => void;
  quickEntryMode: HabitNumericalEntryMode;
  setQuickEntryMode: (mode: HabitNumericalEntryMode) => void;
  unit: string;
  setUnit: (u: string) => void;
  recommendedQuickEntryMode?: HabitNumericalEntryMode;
  unitOptions?: readonly { value: string }[];
  onTemplateUnitChange?: (value: string) => void;
}

export function NumericalTargetSection({
  isPrimaryCTA,
  ts,
  targetValue,
  targetStep,
  setTargetValue,
  targetType,
  setTargetType,
  quickEntryMode,
  setQuickEntryMode,
  unit,
  setUnit,
  recommendedQuickEntryMode,
  unitOptions,
  onTemplateUnitChange,
}: NumericalTargetSectionProps) {
  const targetInputRef = useRef<HTMLInputElement>(null);
  const normalize = (value: number) => Number(value.toFixed(3));
  const decrement = () => setTargetValue(Math.max(targetStep, normalize(targetValue - targetStep)));
  const increment = () => setTargetValue(normalize(targetValue + targetStep));
  const copy = (key: string, fallback: string) => ts[key] || fallback;
  const formatQuantityLabel = (value: number) => {
    const trimmedUnit = unit.trim();
    if (!trimmedUnit) return String(value);
    const singularUnits: Record<string, string> = {
      cigarettes: "cigarette",
      drinks: "drink",
      glasses: "glass",
      pages: "page",
    };
    const displayUnit = value === 1 ? singularUnits[trimmedUnit] ?? trimmedUnit : trimmedUnit;
    return `${value} ${displayUnit}`;
  };
  const targetLabel = formatQuantityLabel(targetValue);
  const stepLabel = formatQuantityLabel(targetStep);
  const fallbackAtLeastMode =
    recommendedQuickEntryMode && recommendedQuickEntryMode !== "limitCheck"
      ? recommendedQuickEntryMode
      : "completeTarget";
  const modeOptions: Array<{
    id: HabitNumericalEntryMode;
    icon: typeof CheckCircle2;
    label: string;
    description: string;
  }> = [
    {
      id: "completeTarget",
      icon: CheckCircle2,
      label: copy("habitQuickEntryCompleteTarget", "Mark the target"),
      description: copy(
        "habitQuickEntryCompleteTargetDesc",
        "One tap logs the full daily target. Best for target-style habits."
      ),
    },
    {
      id: "incrementStep",
      icon: Plus,
      label: copy("habitQuickEntryIncrementStep", "Add one portion"),
      description: copy(
        "habitQuickEntryIncrementStepDesc",
        "Each tap adds the configured step. Best for counters you build up."
      ),
    },
    {
      id: "limitCheck",
      icon: Gauge,
      label: copy("habitQuickEntryLimitCheck", "Stayed within the limit"),
      description: copy(
        "habitQuickEntryLimitCheckDesc",
        "One tap confirms there was no over-limit event today."
      ),
    },
  ];
  const visibleModeOptions =
    targetType === "atMost"
      ? modeOptions.filter((option) => option.id === "limitCheck")
      : modeOptions.filter((option) => option.id !== "limitCheck");
  const effectiveQuickEntryMode =
    targetType === "atMost"
      ? "limitCheck"
      : quickEntryMode === "limitCheck"
        ? fallbackAtLeastMode
        : quickEntryMode;
  const preview =
    effectiveQuickEntryMode === "completeTarget"
      ? copy(
          "habitQuickEntryPreviewSet",
          "Today tap: logs {value}. Tap again clears the day."
        ).replace("{value}", targetLabel)
      : effectiveQuickEntryMode === "incrementStep"
        ? copy(
            "habitQuickEntryPreviewStep",
            "Today tap: adds {value}. Use exact value when the count is unusual."
          ).replace("{value}", stepLabel)
        : copy(
            "habitQuickEntryPreviewLimit",
            "Today tap: confirms 0 {unit}. If there was more, enter it manually."
          ).replace("{unit}", unit || ts.habitUnit || "unit");

  useEffect(() => {
    if (targetType === "atMost" && quickEntryMode !== "limitCheck") {
      setQuickEntryMode("limitCheck");
      return;
    }

    if (targetType !== "atMost" && quickEntryMode === "limitCheck") {
      setQuickEntryMode(fallbackAtLeastMode);
    }
  }, [fallbackAtLeastMode, quickEntryMode, setQuickEntryMode, targetType]);

  const focusExactValue = () => {
    targetInputRef.current?.focus();
    targetInputRef.current?.select();
  };

  return (
    <div className="relative mb-4 space-y-3">
      {unitOptions && unitOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unitOptions.map((option) => {
            const active = unit === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (onTemplateUnitChange) {
                    onTemplateUnitChange(option.value);
                  } else {
                    setUnit(option.value);
                  }
                }}
                className={cn(
                  "min-h-[44px] rounded-full px-3 py-2 text-xs font-medium motion-safe:transition-colors",
                  active
                    ? isPrimaryCTA
                      ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                      : "bg-primary text-primary-foreground"
                    : isPrimaryCTA
                      ? "border border-foreground/15 bg-foreground/5 text-foreground/70"
                      : "border border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {option.value}
              </button>
            );
          })}
        </div>
      )}

      {/* Target value */}
      <div>
        <label
          className={cn(
            "text-sm mb-2 block",
            isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground"
          )}
        >
          {ts.habitTarget}:
        </label>
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            onClick={decrement}
            className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-lg bg-muted/50 flex items-center justify-center"
            whileTap={zenTap.button}
          >
            <Minus className="w-4 h-4" />
          </motion.button>
          <input
            ref={targetInputRef}
            type="number"
            min={targetStep}
            step={targetStep}
            value={targetValue}
            onChange={(e) =>
              setTargetValue(Math.max(targetStep, parseFloat(e.target.value) || targetStep))
            }
            className={cn(
              "w-20 p-2 rounded-lg text-center text-lg font-bold",
              "focus:outline-none focus:ring-2",
              isPrimaryCTA
                ? "bg-foreground/10 border border-foreground/20 text-white focus:ring-violet-500/50"
                : "bg-background text-foreground focus:ring-primary/30"
            )}
            aria-label={ts.habitTarget}
          />
          <motion.button
            type="button"
            onClick={increment}
            className={cn(
              "w-10 h-10 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center",
              "bg-gradient-to-br from-primary/20 to-primary/10 text-primary"
            )}
            whileTap={zenTap.button}
          >
            <Plus className="w-4 h-4" />
          </motion.button>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={ts.habitUnit}
            maxLength={20}
            className={cn(
              "flex-1 p-2 rounded-lg text-sm",
              "focus:outline-none focus:ring-2",
              isPrimaryCTA
                ? "bg-foreground/10 border border-foreground/20 text-white placeholder:text-foreground/60 focus:ring-violet-500/50"
                : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
            )}
          />
        </div>
      </div>

      {/* Target type: At Least / At Most */}
      <div className="flex gap-2">
        {(["atLeast", "atMost"] as const).map((tt) => (
          <motion.button
            key={tt}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setTargetType(tt);
              if (tt === "atMost") {
                setQuickEntryMode("limitCheck");
              } else if (quickEntryMode === "limitCheck") {
                setQuickEntryMode("completeTarget");
              }
            }}
            className={cn(
              "flex-1 px-3 py-2 rounded-xl text-xs font-medium motion-safe:transition-all min-h-[44px]",
              targetType === tt
                ? isPrimaryCTA
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                  : "bg-primary text-primary-foreground shadow-sm"
                : isPrimaryCTA
                  ? "bg-foreground/5 border border-foreground/10 text-foreground/60"
                  : "bg-background border border-border/50 hover:bg-muted"
            )}
            whileTap={zenTap.card}
          >
            {tt === "atLeast" ? ts.atLeast : ts.atMost}
          </motion.button>
        ))}
      </div>

      <div
        className={cn(
          "rounded-[18px] border p-3",
          isPrimaryCTA
            ? "border-[hsl(var(--zf-role-focus)/0.28)] bg-[hsl(var(--zf-role-focus)/0.08)]"
            : "border-border bg-muted/30"
        )}
      >
        <div className="mb-2 flex items-center gap-2">
          <MousePointerClick
            className={cn(
              "h-4 w-4 shrink-0",
              isPrimaryCTA ? "text-[hsl(var(--zf-role-focus))]" : "text-primary"
            )}
            aria-hidden="true"
          />
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.12em]",
              isPrimaryCTA ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground"
            )}
          >
            {copy("habitQuickEntryMode", "What quick tap does")}
          </p>
        </div>
        <div className="grid gap-2">
          {visibleModeOptions.map((option) => {
            const active = effectiveQuickEntryMode === option.id;
            const recommended = recommendedQuickEntryMode === option.id;
            const Icon = option.icon;
            return (
              <motion.button
                key={option.id}
                type="button"
                onClick={() => setQuickEntryMode(option.id)}
                className={cn(
                  "grid min-h-[56px] grid-cols-[auto_1fr] items-start gap-2 rounded-[14px] border px-3 py-2 text-start motion-safe:transition-colors",
                  active
                    ? isPrimaryCTA
                      ? "border-[hsl(var(--zf-role-body)/0.46)] bg-[hsl(var(--zf-role-body)/0.14)] text-[hsl(var(--zf-text-strong))]"
                      : "border-primary/40 bg-primary/10 text-foreground"
                    : isPrimaryCTA
                      ? "border-foreground/10 bg-foreground/5 text-[hsl(var(--zf-text-soft))]"
                      : "border-border/60 bg-background text-muted-foreground"
                )}
                aria-pressed={active}
                whileTap={zenTap.card}
              >
                <Icon className="mt-0.5 h-4 w-4" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug opacity-80">
                    {option.description}
                  </span>
                  {recommended && (
                    <span
                      className={cn(
                        "mt-2 inline-flex min-h-[24px] items-center rounded-full border px-2 text-[10px] font-semibold uppercase tracking-[0.08em]",
                        isPrimaryCTA
                          ? "border-[hsl(var(--zf-role-energy)/0.36)] bg-[hsl(var(--zf-role-energy)/0.12)] text-[hsl(var(--zf-role-energy))]"
                          : "border-primary/30 bg-primary/10 text-primary"
                      )}
                    >
                      {copy("habitQuickEntryRecommended", "Recommended")}
                    </span>
                  )}
                </span>
              </motion.button>
            );
          })}
        </div>
        <p
          className={cn(
            "mt-2 rounded-[12px] border px-3 py-2 text-[11px] leading-snug",
            isPrimaryCTA
              ? "border-[hsl(var(--zf-role-body)/0.24)] bg-[hsl(var(--zf-night-0)/0.32)] text-[hsl(var(--zf-text-soft))]"
              : "border-border bg-background text-muted-foreground"
          )}
        >
          {preview}
        </p>
        <button
          type="button"
          onClick={focusExactValue}
          className={cn(
            "mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[12px] border px-3 py-2 text-xs font-semibold motion-safe:transition-colors",
            isPrimaryCTA
              ? "border-[hsl(var(--zf-role-focus)/0.24)] bg-[hsl(var(--foreground)/0.045)] text-[hsl(var(--zf-text-soft))] hover:bg-[hsl(var(--foreground)/0.075)]"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {copy("habitQuickEntryExactValue", "Adjust exact value")}
        </button>
      </div>
    </div>
  );
}
