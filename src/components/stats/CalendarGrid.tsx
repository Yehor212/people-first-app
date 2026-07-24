/**
 * CalendarGrid — 7×6 crystal day cells for the calendar tab
 * Pure component, 0 useState.
 */

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { zenTap } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";
import { MoodEntry, GratitudeEntry } from "@/types";

interface CalendarCell {
  dateKey?: string;
  day?: number;
}

interface CalendarGridProps {
  calendarDays: CalendarCell[];
  moodByDate: Map<string, MoodEntry>;
  focusMinutesByDate: Map<string, number>;
  habitCompletionMap: Map<string, string[]>;
  gratitudeByDate: Map<string, GratitudeEntry[]>;
  todayKey: string;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  monthNames: string[];
  selectedMonth: number;
  selectedYear: number;
  t: Record<string, string>;
}

export function CalendarGrid({
  calendarDays,
  moodByDate,
  focusMinutesByDate,
  habitCompletionMap,
  gratitudeByDate,
  todayKey,
  selectedDate,
  onSelectDate,
  monthNames,
  selectedMonth,
  selectedYear,
  t,
}: CalendarGridProps) {
  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain pb-1">
      <div className="min-w-[23rem]">
        {/* Day Names */}
        <div className="mb-2 grid grid-cols-7 gap-0.5 text-xs text-muted-foreground sm:gap-1">
          {[t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat].map((day) => (
            <div key={day} className="py-1 text-center font-medium sm:py-2">
              {day.slice(0, 2)}
            </div>
          ))}
        </div>

        {/* Calendar Days - Crystal Premium Design */}
        <div className="grid grid-cols-7 gap-1 py-2 sm:gap-2">
          {calendarDays.map((cell, index) => {
            if (!cell.dateKey) {
              return <div key={`empty-${index}`} className="w-full aspect-square" />;
            }
            const mood = moodByDate.get(cell.dateKey)?.mood;
            const focusMinutes = focusMinutesByDate.get(cell.dateKey) || 0;
            const habitCount = habitCompletionMap.get(cell.dateKey)?.length || 0;
            const hasGratitude = gratitudeByDate.has(cell.dateKey);
            const hasData = mood || focusMinutes > 0 || habitCount > 0 || hasGratitude;

            // Calculate activity level for glow intensity (0-4)
            let activityLevel = 0;
            if (mood) activityLevel += mood === "great" ? 2 : mood === "good" ? 1.5 : 1;
            if (focusMinutes > 0) activityLevel += Math.min(focusMinutes / 30, 1);
            if (habitCount > 0) activityLevel += Math.min(habitCount / 3, 1);
            activityLevel = Math.min(Math.round(activityLevel), 4);

            // Perfect day = great mood + habits + focus
            const isPerfect = mood === "great" && habitCount >= 1 && focusMinutes >= 30;

            // Teal glow styles based on activity
            const crystalStyles = {
              0: {
                glow: "none",
                bg: "from-slate-200/60 to-slate-100/40 dark:from-zinc-800/30 dark:to-zinc-700/20",
                border: "border-border/30",
              },
              1: {
                glow: "0 0 6px hsl(158 40% 70% / 0.3)",
                bg: "from-teal-100/50 to-emerald-50/40 dark:from-teal-900/25 dark:to-emerald-900/20",
                border: "border-teal-300/40 dark:border-teal-700/30",
              },
              2: {
                glow: "0 0 10px hsl(158 50% 55% / 0.35)",
                bg: "from-teal-200/55 to-emerald-100/45 dark:from-teal-800/35 dark:to-emerald-800/25",
                border: "border-teal-400/50 dark:border-teal-600/40",
              },
              3: {
                glow: "0 0 14px hsl(158 65% 42% / 0.4)",
                bg: "from-emerald-200/60 to-teal-100/50 dark:from-emerald-800/45 dark:to-teal-700/35",
                border: "border-emerald-400/55 dark:border-emerald-600/45",
              },
              4: {
                glow: "0 0 18px hsl(158 75% 32% / 0.5)",
                bg: "from-emerald-300/65 to-teal-200/55 dark:from-emerald-700/55 dark:to-teal-600/45",
                border: "border-emerald-500/60 dark:border-emerald-500/55",
              },
            }[activityLevel] || {
              glow: "none",
              bg: "from-slate-200/60 to-slate-100/40 dark:from-zinc-800/30 dark:to-zinc-700/20",
              border: "border-border/30",
            };

            const isToday = cell.dateKey === todayKey;
            const isSelected = cell.dateKey === selectedDate;

            return (
              <motion.button
                key={cell.dateKey}
                onClick={() => onSelectDate(cell.dateKey || null)}
                aria-label={`${cell.day} ${monthNames[selectedMonth]} ${selectedYear}${mood ? `, ${t.mood}: ${t[mood] || mood}` : ""}`}
                aria-pressed={isSelected}
                className="relative flex aspect-square min-h-11 min-w-11 items-center justify-center"
                whileHover={{ scale: 1.15, rotateY: 15, rotateX: -10 }}
                whileTap={zenTap.button}
                style={{ perspective: 200 }}
              >
                {/* Crystal shape (rotated square) with animated glow */}
                <motion.div
                  className={cn(
                    "absolute inset-1 rotate-45 rounded-sm border motion-safe:transition-all motion-safe:duration-200",
                    "bg-gradient-to-br",
                    crystalStyles.bg,
                    crystalStyles.border,
                    isSelected && "scale-110 ring-2 ring-accent"
                  )}
                  style={{ boxShadow: crystalStyles.glow }}
                  animate={
                    activityLevel >= 2
                      ? {
                          boxShadow: [
                            crystalStyles.glow,
                            crystalStyles.glow.replace(/[\d.]+(?=\))/g, (m: string) =>
                              String(parseFloat(m) * 1.4)
                            ),
                            crystalStyles.glow,
                          ],
                        }
                      : {}
                  }
                  transition={{ duration: 2, repeat: Infinity }}
                />

                {/* Today pulse ring */}
                {isToday && (
                  <motion.div
                    className="absolute inset-0 rotate-45 rounded-sm border-2 border-primary/60"
                    animate={{
                      scale: [1, 1.05, 1],
                      opacity: [0.6, 1, 0.6],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}

                {/* Day number (counter-rotated to stay upright) */}
                <span
                  className={cn(
                    "relative z-10 text-xs font-medium",
                    isToday
                      ? "text-primary font-bold"
                      : hasData
                        ? "text-foreground"
                        : "text-muted-foreground/60"
                  )}
                >
                  {cell.day}
                </span>

                {/* Perfect day sparkles - animated dots */}
                {isPerfect && (
                  <>
                    <motion.div
                      className="absolute top-0 end-1 w-1 h-1 rounded-full bg-primary/80"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
                      transition={{ duration: 1.5, delay: 0, repeat: Infinity, repeatDelay: 2 }}
                    />
                    <motion.div
                      className="absolute bottom-0 start-1 w-1 h-1 rounded-full bg-primary/80"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
                      transition={{ duration: 1.5, delay: 0.5, repeat: Infinity, repeatDelay: 2 }}
                    />
                    <motion.div
                      className="absolute top-1 start-0 w-1 h-1 rounded-full bg-primary/80"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
                      transition={{ duration: 1.5, delay: 1, repeat: Infinity, repeatDelay: 2 }}
                    />
                  </>
                )}

                {/* Gratitude indicator */}
                {hasGratitude && !isPerfect && (
                  <motion.span
                    className="absolute -top-0.5 -end-0.5 flex size-4 items-center justify-center"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    aria-hidden="true"
                  >
                    <Sparkles className="size-3 text-primary" />
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
