import { Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { zenTap } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";

interface HabitDurationSectionProps {
  isPrimaryCTA: boolean;
  ts: Record<string, string>;
  hasDurationLimit: boolean;
  setHasDurationLimit: (value: boolean) => void;
  durationDays: number;
  setDurationDays: (value: number) => void;
}

export function HabitDurationSection({
  isPrimaryCTA,
  ts,
  hasDurationLimit,
  setHasDurationLimit,
  durationDays,
  setDurationDays,
}: HabitDurationSectionProps) {
  const safeDays = Math.max(1, Math.round(durationDays || 1));
  const dayLabel = ts.habitDurationDaysLabel;

  return (
    <div className="relative mb-4 space-y-3">
      <div>
        <label
          className={cn(
            "text-sm mb-2 block",
            isPrimaryCTA
              ? "text-slate-500 dark:text-foreground/60"
              : "text-muted-foreground",
          )}
        >
          {ts.duration}:
        </label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: false, label: ts.habitDurationOngoing },
            { value: true, label: ts.habitDurationSetDays },
          ] as const).map((option) => (
            <motion.button
              key={String(option.value)}
              type="button"
              onClick={() => setHasDurationLimit(option.value)}
              className={cn(
                "min-h-[44px] rounded-xl px-3 py-2 text-xs font-medium motion-safe:transition-all",
                hasDurationLimit === option.value
                  ? isPrimaryCTA
                    ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                    : "bg-primary text-primary-foreground shadow-sm"
                  : isPrimaryCTA
                    ? "border border-foreground/15 bg-foreground/5 text-foreground/70"
                    : "border border-border bg-background text-muted-foreground hover:bg-muted",
              )}
              whileTap={zenTap.card}
            >
              {option.label}
            </motion.button>
          ))}
        </div>
      </div>

      {hasDurationLimit && (
        <div
          className={cn(
            "rounded-2xl border px-3 py-3",
            isPrimaryCTA
              ? "border-foreground/15 bg-foreground/5"
              : "border-border bg-muted/20",
          )}
        >
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              onClick={() => setDurationDays(Math.max(1, safeDays - 1))}
              className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-background/80"
              whileTap={zenTap.button}
            >
              <Minus className="h-4 w-4" />
            </motion.button>
            <input
              type="number"
              min={1}
              step={1}
              value={safeDays}
              onChange={(e) => setDurationDays(Math.max(1, Math.round(Number(e.target.value) || 1)))}
              className={cn(
                "w-20 rounded-lg p-2 text-center text-lg font-bold",
                "focus:outline-none focus:ring-2",
                isPrimaryCTA
                  ? "border border-foreground/20 bg-foreground/10 text-white focus:ring-violet-500/50"
                  : "bg-background text-foreground focus:ring-primary/30",
              )}
              aria-label={ts.duration}
            />
            <motion.button
              type="button"
              onClick={() => setDurationDays(safeDays + 1)}
              className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-background/80"
              whileTap={zenTap.button}
            >
              <Plus className="h-4 w-4" />
            </motion.button>
            <span className="text-sm text-muted-foreground">
              {dayLabel}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {ts.habitDurationHint}
          </p>
        </div>
      )}
    </div>
  );
}
