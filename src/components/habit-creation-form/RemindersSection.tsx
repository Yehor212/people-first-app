import { motion } from "framer-motion";
import { zenTap } from "@/lib/animationUtils";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RemindersSectionProps {
  isPrimaryCTA: boolean;
  t: Record<string, string>;
  reminders: Array<{ time: string; days: number[] }>;
  handleAddReminder: () => void;
  handleRemoveReminder: (index: number) => void;
  handleReminderChange: (index: number, field: string, value: unknown) => void;
}

export function RemindersSection({
  isPrimaryCTA,
  t,
  reminders,
  handleAddReminder,
  handleRemoveReminder,
  handleReminderChange,
}: RemindersSectionProps) {
  return (
    <div
      className={cn(
        "relative mb-4 p-4 rounded-xl",
        isPrimaryCTA
          ? "bg-foreground/5 backdrop-blur-sm border border-foreground/10"
          : "bg-secondary/50",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <label
          className={cn(
            "text-sm",
            isPrimaryCTA
              ? "text-slate-600 dark:text-foreground/70"
              : "text-muted-foreground",
          )}
        >
          {t.reminders || "Reminders"}
        </label>
        <motion.button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            handleAddReminder();
          }}
          className={cn(
            "text-xs px-3 py-1.5 rounded-lg transition-colors",
            isPrimaryCTA
              ? "bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30"
              : "bg-primary/10 text-primary hover:bg-primary/20",
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={zenTap.card}
        >
          + {t.addReminder || "Add"}
        </motion.button>
      </div>

      {reminders.length === 0 ? (
        <p
          className={cn(
            "text-xs italic",
            isPrimaryCTA
              ? "text-slate-400 dark:text-foreground/40"
              : "text-muted-foreground",
          )}
        >
          {t.noReminders || "No reminders set"}
        </p>
      ) : (
        <div className="space-y-2">
          {reminders.map((reminder, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg",
                isPrimaryCTA
                  ? "bg-foreground/5 border border-foreground/10"
                  : "bg-background",
              )}
            >
              <input
                type="time"
                value={reminder.time}
                onChange={(e) =>
                  handleReminderChange(index, "time", e.target.value)
                }
                className={cn(
                  "flex-1 p-1 rounded text-sm focus:outline-none focus:ring-1",
                  isPrimaryCTA
                    ? "bg-foreground/10 border border-foreground/20 text-white focus:ring-violet-500/50"
                    : "bg-secondary text-foreground focus:ring-primary/30",
                )}
                aria-label="Reminder time"
              />
              <div className="flex gap-1">
                {[
                  { day: 1, label: t.mon || "Mo" },
                  { day: 2, label: t.tue || "Tu" },
                  { day: 3, label: t.wed || "We" },
                  { day: 4, label: t.thu || "Th" },
                  { day: 5, label: t.fri || "Fr" },
                  { day: 6, label: t.sat || "Sa" },
                  { day: 0, label: t.sun || "Su" },
                ].map(({ day, label }) => (
                  <motion.button
                    key={day}
                    type="button"
                    aria-pressed={reminder.days.includes(day)}
                    onClick={(e) => {
                      e.preventDefault();
                      const newDays = reminder.days.includes(day)
                        ? reminder.days.filter((d) => d !== day)
                        : [...reminder.days, day];
                      handleReminderChange(index, "days", newDays);
                    }}
                    className={cn(
                      "w-11 h-11 min-w-[44px] min-h-[44px] text-[10px] rounded-lg transition-colors font-medium",
                      "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none",
                      isPrimaryCTA
                        ? reminder.days.includes(day)
                          ? "bg-gradient-to-br from-violet-500/60 to-purple-600/60 text-white"
                          : "bg-foreground/5 text-foreground/50 hover:bg-foreground/10"
                        : reminder.days.includes(day)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:bg-muted",
                    )}
                    style={
                      isPrimaryCTA && reminder.days.includes(day)
                        ? { boxShadow: "0 0 8px rgba(139, 92, 246, 0.4)" }
                        : undefined
                    }
                    whileTap={zenTap.button}
                  >
                    {label}
                  </motion.button>
                ))}
              </div>
              <motion.button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleRemoveReminder(index);
                }}
                aria-label={t.removeReminder || "Remove reminder"}
                className={cn(
                  "p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors",
                  isPrimaryCTA
                    ? "text-red-400 hover:bg-red-500/20"
                    : "text-destructive hover:bg-destructive/10",
                )}
                whileTap={zenTap.button}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
