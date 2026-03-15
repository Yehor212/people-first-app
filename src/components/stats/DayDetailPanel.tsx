import { motion, AnimatePresence } from 'framer-motion';
import { Target, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Habit } from '@/types';
import { formatDate } from '@/lib/utils';

interface DayData {
  date: string;
  day: number;
  completedCount: number;
  totalHabits: number;
  completionRate: number;
  completedHabits: string[];
  isToday: boolean;
  isFuture: boolean;
}

interface DayDetailPanelProps {
  selectedDay: DayData | null;
  habits: Habit[];
  onClose: () => void;
}

export function DayDetailPanel({ selectedDay, habits, onClose }: DayDetailPanelProps) {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {selectedDay && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-border/30 overflow-hidden"
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium">
                  {selectedDay.date}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={t.close || 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full w-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                  style={{ transformOrigin: 'left' }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.min(selectedDay.completionRate, 1) }}
                />
              </div>
              <span className="text-sm font-bold text-emerald-500">
                {Math.round(selectedDay.completionRate * 100)}%
              </span>
            </div>

            {selectedDay.completedHabits.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedDay.completedHabits.map((habitId) => {
                  const habit = habits.find(h => h.id === habitId);
                  if (!habit) return null;
                  return (
                    <motion.div
                      key={habitId}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 rounded-full"
                    >
                      <span className="text-xs">{habit.icon || '✓'}</span>
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {habit.name}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                {t.noHabitsCompleted || 'No habits completed'}
              </p>
            )}

            {/* Missed habits */}
            {selectedDay.totalHabits > selectedDay.completedCount && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground mb-2">
                  {t.missedHabits || 'Missed'}:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {habits
                    .filter(h => {
                      // Only show habits that existed on the selected day
                      const createdStr = formatDate(new Date(h.createdAt));
                      return createdStr <= selectedDay.date && !selectedDay.completedHabits.includes(h.id);
                    })
                    .map((habit) => (
                      <div
                        key={habit.id}
                        className="flex items-center gap-1 px-2 py-1 bg-red-500/10 rounded-full"
                      >
                        <span className="text-xs opacity-50">{habit.icon}</span>
                        <span className="text-xs text-red-600 dark:text-red-400">
                          {habit.name}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
