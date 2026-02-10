/**
 * JournalHabitSection — Collapsible habit tracker in journal editor
 *
 * Shows today's habits as toggleable checkboxes.
 * Reads from Dexie habits table.
 */

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/storage/db';
import type { Habit } from '@/types';

interface HabitSnapshot {
  habitId: string;
  habitName: string;
  habitIcon: string;
  completed: boolean;
}

interface JournalHabitSectionProps {
  date: string;
  snapshot: HabitSnapshot[];
  onSnapshotChange: (snapshot: HabitSnapshot[]) => void;
}

export function JournalHabitSection({ date, snapshot, onSnapshotChange }: JournalHabitSectionProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [collapsed, setCollapsed] = useState(true);
  const [habits, setHabits] = useState<Habit[]>([]);

  // Load habits from DB
  useEffect(() => {
    db.habits.toArray().then(all => {
      setHabits(all);
      // Auto-populate snapshot from existing completions if empty
      if (snapshot.length === 0 && all.length > 0) {
        const initial: HabitSnapshot[] = all.map(h => ({
          habitId: h.id,
          habitName: h.name,
          habitIcon: h.icon,
          completed: h.completedDates?.includes(date) || false,
        }));
        onSnapshotChange(initial);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const completedCount = useMemo(() => snapshot.filter(s => s.completed).length, [snapshot]);

  const toggleHabit = (habitId: string) => {
    const updated = snapshot.map(s =>
      s.habitId === habitId ? { ...s, completed: !s.completed } : s
    );
    onSnapshotChange(updated);
  };

  if (habits.length === 0) return null;

  return (
    <div className="rounded-xl bg-card/50 border border-border/15 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[44px]"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {ts.journalHabitsSection || 'Habits'}
          </span>
          {completedCount > 0 && (
            <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
              {completedCount}/{snapshot.length}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground/50" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground/50" />
        )}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3 space-y-1">
              {snapshot.map(item => (
                <button
                  key={item.habitId}
                  onClick={() => toggleHabit(item.habitId)}
                  className={cn(
                    'w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-colors min-h-[36px]',
                    item.completed ? 'bg-primary/5' : 'hover:bg-muted/30',
                  )}
                >
                  {item.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                  )}
                  <span className="text-sm flex-shrink-0">{item.habitIcon}</span>
                  <span className={cn(
                    'text-xs text-start flex-1',
                    item.completed ? 'text-foreground line-through opacity-60' : 'text-foreground',
                  )}>
                    {item.habitName}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
