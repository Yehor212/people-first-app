/**
 * NumericalTargetSection вЂ” Target value, unit, and at-least/at-most controls.
 */

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { zenTap } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";

interface NumericalTargetSectionProps {
  isPrimaryCTA: boolean;
  ts: Record<string, string>;
  targetValue: number;
  targetStep: number;
  setTargetValue: (v: number) => void;
  targetType: "atLeast" | "atMost";
  setTargetType: (t: "atLeast" | "atMost") => void;
  unit: string;
  setUnit: (u: string) => void;
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
  unit,
  setUnit,
  unitOptions,
  onTemplateUnitChange,
}: NumericalTargetSectionProps) {
  const normalize = (value: number) => Number(value.toFixed(3));
  const decrement = () =>
    setTargetValue(Math.max(targetStep, normalize(targetValue - targetStep)));
  const increment = () => setTargetValue(normalize(targetValue + targetStep));

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
                      : "border border-border bg-background text-muted-foreground hover:bg-muted",
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
            isPrimaryCTA
              ? "text-slate-500 dark:text-foreground/60"
              : "text-muted-foreground",
          )}
        >
          {ts.habitTarget || "Target"}:
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
                : "bg-background text-foreground focus:ring-primary/30",
            )}
            aria-label={ts.habitTarget || "Target"}
          />
          <motion.button
            type="button"
            onClick={increment}
            className={cn(
              "w-10 h-10 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center",
              "bg-gradient-to-br from-primary/20 to-primary/10 text-primary",
            )}
            whileTap={zenTap.button}
          >
            <Plus className="w-4 h-4" />
          </motion.button>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={ts.habitUnit || "Unit (L, km, min...)"}
            maxLength={20}
            className={cn(
              "flex-1 p-2 rounded-lg text-sm",
              "focus:outline-none focus:ring-2",
              isPrimaryCTA
                ? "bg-foreground/10 border border-foreground/20 text-white placeholder:text-foreground/60 focus:ring-violet-500/50"
                : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30",
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
            }}
            className={cn(
              "flex-1 px-3 py-2 rounded-xl text-xs font-medium motion-safe:transition-all min-h-[44px]",
              targetType === tt
                ? isPrimaryCTA
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                  : "bg-primary text-primary-foreground shadow-sm"
                : isPrimaryCTA
                  ? "bg-foreground/5 border border-foreground/10 text-foreground/60"
                  : "bg-background border border-border/50 hover:bg-muted",
            )}
            whileTap={zenTap.card}
          >
            {tt === "atLeast"
              ? ts.atLeast || "At least"
              : ts.atMost || "At most"}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
