/**
 * NumericalTargetSection — Target value, unit, and at-least/at-most controls.
 */

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { zenTap } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";

interface NumericalTargetSectionProps {
  isPrimaryCTA: boolean;
  ts: Record<string, string>;
  targetValue: number;
  setTargetValue: (v: number) => void;
  targetType: "atLeast" | "atMost";
  setTargetType: (t: "atLeast" | "atMost") => void;
  unit: string;
  setUnit: (u: string) => void;
}

export function NumericalTargetSection({
  isPrimaryCTA,
  ts,
  targetValue,
  setTargetValue,
  targetType,
  setTargetType,
  unit,
  setUnit,
}: NumericalTargetSectionProps) {
  return (
    <div className="relative mb-4 space-y-3">
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
            onClick={() => setTargetValue(Math.max(1, targetValue - 1))}
            className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-lg bg-muted/50 flex items-center justify-center"
            whileTap={zenTap.button}
          >
            <Minus className="w-4 h-4" />
          </motion.button>
          <input
            type="number"
            min="1"
            step="0.5"
            value={targetValue}
            onChange={(e) =>
              setTargetValue(Math.max(0.1, parseFloat(e.target.value) || 1))
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
            onClick={() => setTargetValue(targetValue + 1)}
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
                ? "bg-foreground/10 border border-foreground/20 text-white placeholder:text-foreground/30 focus:ring-violet-500/50"
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
              "flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px]",
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
