import { useState } from "react";
import { motion } from "framer-motion";
import { zenTap } from "@/lib/animationUtils";
import { normalizeHabitReminderDays } from "@/lib/habitScheduling";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HabitReminder } from "@/types";

interface RemindersSectionProps {
  isPrimaryCTA: boolean;
  t: Record<string, string>;
  reminders: HabitReminder[];
  handleAddReminder: () => void;
  handleRemoveReminder: (index: number) => void;
  handleReminderChange: <K extends keyof HabitReminder>(
    index: number,
    field: K,
    value: HabitReminder[K]
  ) => void;
}

export function RemindersSection({
  isPrimaryCTA,
  t,
  reminders,
  handleAddReminder,
  handleRemoveReminder,
  handleReminderChange,
}: RemindersSectionProps) {
  const [daySelectionNoticeIndex, setDaySelectionNoticeIndex] = useState<number | null>(null);

  return (
    <div
      className={cn(
        "relative mb-4 p-4 rounded-xl",
        isPrimaryCTA
          ? "bg-foreground/5 backdrop-blur-sm border border-foreground/10"
          : "bg-secondary/50"
      )}
    >
      <div className="mb-2 flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
        <label
          className={cn(
            "text-sm",
            isPrimaryCTA ? "text-slate-600 dark:text-foreground/70" : "text-muted-foreground"
          )}
        >
          {t.reminders}
        </label>
        <motion.button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            handleAddReminder();
          }}
          className={cn(
            "min-h-[44px] whitespace-normal break-words rounded-lg px-3 py-2 text-xs motion-safe:transition-colors",
            isPrimaryCTA
              ? "bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={zenTap.card}
        >
          + {t.addReminder}
        </motion.button>
      </div>

      {reminders.length === 0 ? (
        <p
          className={cn(
            "text-xs italic",
            isPrimaryCTA ? "text-slate-400 dark:text-foreground/60" : "text-muted-foreground"
          )}
        >
          {t.noReminders}
        </p>
      ) : (
        <div className="space-y-2">
          {reminders.map((reminder, index) => {
            const selectedDays = normalizeHabitReminderDays(reminder.days);
            return (
              <div
              key={index}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_44px] items-start gap-2 rounded-lg p-2",
                isPrimaryCTA ? "bg-foreground/5 border border-foreground/10" : "bg-background"
              )}
            >
              <input
                type="time"
                value={reminder.time}
                onChange={(e) => handleReminderChange(index, "time", e.target.value)}
                className={cn(
                  "min-h-[44px] min-w-0 w-full rounded p-2 text-sm focus:outline-none focus:ring-1",
                  isPrimaryCTA
                    ? "bg-foreground/10 border border-foreground/20 text-white focus:ring-violet-500/50"
                    : "bg-secondary text-foreground focus:ring-primary/30"
                )}
                aria-label={t.habitReminderTime}
              />
              <div className="col-span-2 row-start-2 grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(3.25rem*var(--font-scale,1))),1fr))] gap-1">
                {[
                  { day: 1, label: t.mon },
                  { day: 2, label: t.tue },
                  { day: 3, label: t.wed },
                  { day: 4, label: t.thu },
                  { day: 5, label: t.fri },
                  { day: 6, label: t.sat },
                  { day: 0, label: t.sun },
                ].map(({ day, label }) => (
                  <motion.button
                    key={day}
                    type="button"
                    aria-pressed={selectedDays.includes(day)}
                    onClick={(e) => {
                      e.preventDefault();
                      if (selectedDays.includes(day) && selectedDays.length === 1) {
                        setDaySelectionNoticeIndex(index);
                        return;
                      }
                      const newDays = selectedDays.includes(day)
                        ? selectedDays.filter((d) => d !== day)
                        : [...selectedDays, day];
                      setDaySelectionNoticeIndex(null);
                      handleReminderChange(index, "days", newDays);
                    }}
                    className={cn(
                      "min-h-[44px] min-w-[44px] w-full whitespace-normal break-words rounded-lg px-1.5 py-2 text-xs font-medium motion-safe:transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none",
                      isPrimaryCTA
                        ? selectedDays.includes(day)
                          ? "bg-gradient-to-br from-violet-500/60 to-purple-600/60 text-white"
                          : "bg-foreground/5 text-foreground/50 hover:bg-foreground/10"
                        : selectedDays.includes(day)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:bg-muted"
                    )}
                    style={
                      isPrimaryCTA && selectedDays.includes(day)
                        ? { boxShadow: "0 0 8px hsl(var(--cosmic-nebula-purple) / 0.4)" }
                        : undefined
                    }
                    whileTap={zenTap.button}
                  >
                    {label}
                  </motion.button>
                ))}
              </div>
              {daySelectionNoticeIndex === index ? (
                <p
                  role="status"
                  className="col-span-2 min-w-0 break-words text-xs text-muted-foreground [hyphens:auto] [overflow-wrap:break-word]"
                >
                  {t.habitReminderAtLeastOneDay ||
                    "Keep at least one day selected. To turn this reminder off, remove it."}
                </p>
              ) : null}
              <motion.button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleRemoveReminder(index);
                }}
                aria-label={t.delete}
                className={cn(
                  "col-start-2 row-start-1 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 motion-safe:transition-colors",
                  isPrimaryCTA
                    ? "text-red-400 hover:bg-red-500/20"
                    : "text-destructive hover:bg-destructive/10"
                )}
                whileTap={zenTap.button}
              >
                <X className="w-4 h-4" />
              </motion.button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
