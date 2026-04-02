import { useState } from "react";
import { motion } from "framer-motion";
import { zenTap } from "@/lib/animationUtils";
import { Target, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateId, getToday } from "@/lib/utils";
import { hapticTap } from "@/lib/haptics";
import { useBackHandler } from "@/hooks/useBackHandler";
import type { Goal, GoalType, GoalPeriod, Habit } from "@/types";
import { GOAL_THEMES } from "./types";

interface AddGoalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habits: Habit[];
  onAdd: (goal: Goal) => void;
  t: Record<string, string>;
}

export function AddGoalSheet({
  open,
  onOpenChange,
  habits,
  onAdd,
  t,
}: AddGoalSheetProps) {
  const [type, setType] = useState<GoalType>("habit");
  const [period, setPeriod] = useState<GoalPeriod>("week");
  const [target, setTarget] = useState(5);
  const [habitId, setHabitId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useBackHandler(open, () => onOpenChange(false));
  useModalA11y(open, () => onOpenChange(false));

  const handleSubmit = () => {
    if (isSaving) return;
    setIsSaving(true);
    void hapticTap();

    const titles: Record<GoalType, string> = {
      habit: habitId
        ? `${t.complete || "Complete"} ${habits.find((h) => h.id === habitId)?.name || ""}`
        : t.goalCompleteHabits || "Complete habits",
      focus: t.goalFocusTime || "Focus time",
      mood: t.goalMoodAverage || "Mood average",
      streak: t.goalMaintainStreak || "Maintain streak",
    };

    const suffixes: Record<GoalType, string> = {
      habit: ` ${target}`,
      focus: ` ${target} ${t.minuteShort || "m"}`,
      mood: ` ${target}+`,
      streak: ` ${target}`,
    };

    const goal: Goal = {
      id: generateId(),
      type,
      target,
      period,
      habitId: type === "habit" && habitId ? habitId : undefined,
      title: titles[type] + suffixes[type],
      createdAt: getToday(),
      status: "active",
    };

    onAdd(goal);
    onOpenChange(false);

    // Reset form
    setType("habit");
    setPeriod("week");
    setTarget(5);
    setHabitId("");
    setIsSaving(false);
  };

  const getTargetPresets = (): number[] => {
    switch (type) {
      case "habit":
        return period === "week" ? [5, 6, 7] : [20, 25, 30];
      case "focus":
        return period === "week" ? [60, 120, 180] : [300, 500, 1000];
      case "mood":
        return [3, 4, 5];
      case "streak":
        return [7, 14, 30];
      default:
        return [5, 10, 15];
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm motion-safe:animate-fade-in"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed bottom-0 inset-x-0 z-[60] rounded-t-[2rem] bg-background max-h-[85dvh] overflow-hidden motion-safe:animate-slide-up pb-[env(safe-area-inset-bottom)]"
      >
        <h2 className="sr-only">{t.addGoal || "Add Goal"}</h2>

        {/* Header */}
        <div className="relative h-20 overflow-hidden bg-gradient-to-br from-primary/20 via-accent/10 to-transparent">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-muted-foreground/30" />
          <div className="absolute bottom-4 start-6 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20 backdrop-blur-sm">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">
              {t.addGoal || "Add Goal"}
            </h2>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[60dvh]">
          {/* Goal Type */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-3 block">
              {t.goalType || "Goal Type"}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["habit", "focus", "mood", "streak"] as GoalType[]).map(
                (goalType) => {
                  const th = GOAL_THEMES[goalType];
                  const selected = type === goalType;
                  return (
                    <button
                      key={goalType}
                      onClick={() => {
                        void hapticTap();
                        setType(goalType);
                      }}
                      className={cn(
                        "p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5",
                        selected
                          ? `border-transparent bg-gradient-to-br ${th.bgGradient}`
                          : "border-border/50 hover:border-border",
                      )}
                      style={
                        selected
                          ? { boxShadow: `0 4px 16px ${th.glowColor}` }
                          : undefined
                      }
                    >
                      <span className="text-lg">{th.emoji}</span>
                      <span
                        className={cn(
                          "text-xs font-medium capitalize",
                          selected
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {(t as unknown as Record<string, string>)[
                          `goal${goalType.charAt(0).toUpperCase() + goalType.slice(1)}`
                        ] || goalType}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Habit Selector */}
          {type === "habit" && habits.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                {t.selectHabit || "Select Habit"}{" "}
                <span className="text-muted-foreground font-normal">
                  ({t.optional || "optional"})
                </span>
              </label>
              <select
                value={habitId}
                onChange={(e) => setHabitId(e.target.value)}
                className="w-full p-3 rounded-xl border border-border/50 bg-muted/30 text-foreground text-sm"
                aria-label={t.selectHabit || "Select habit"}
              >
                <option value="">{t.allHabits || "All habits"}</option>
                {habits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.icon} {h.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Period */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-3 block">
              {t.period || "Period"}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["week", "month"] as GoalPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    void hapticTap();
                    setPeriod(p);
                  }}
                  className={cn(
                    "p-3 rounded-xl border transition-all text-sm font-medium",
                    period === p
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-border",
                  )}
                >
                  {p === "week" ? t.weekly || "Weekly" : t.monthly || "Monthly"}
                </button>
              ))}
            </div>
          </div>

          {/* Target */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-3 block">
              {t.target || "Target"}
              {type === "focus" && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  ({t.minutes || "minutes"})
                </span>
              )}
              {type === "mood" && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  ({t.average || "average"})
                </span>
              )}
              {type === "streak" && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  ({t.days || "days"})
                </span>
              )}
            </label>
            <div className="flex gap-2">
              {getTargetPresets().map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    void hapticTap();
                    setTarget(preset);
                  }}
                  className={cn(
                    "flex-1 p-3 rounded-xl border transition-all text-sm font-bold",
                    target === preset
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-border",
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <motion.button
            onClick={handleSubmit}
            disabled={isSaving}
            className={cn(
              "w-full py-4 px-5 rounded-2xl font-semibold",
              "flex items-center justify-center gap-2",
              `bg-gradient-to-r ${GOAL_THEMES[type].gradient}`,
              "text-white shadow-xl active:scale-[0.98] transition-transform",
              isSaving && "opacity-50",
            )}
            style={{ boxShadow: `0 8px 32px ${GOAL_THEMES[type].glowColor}` }}
            whileTap={zenTap.card}
          >
            <Sparkles className="w-5 h-5" />
            <span>{t.addGoal || "Add Goal"}</span>
            <ChevronRight className="w-5 h-5 rtl:scale-x-[-1]" />
          </motion.button>
        </div>
      </div>
    </>
  );
}
