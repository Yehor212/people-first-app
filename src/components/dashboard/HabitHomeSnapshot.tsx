/**
 * HabitHomeSnapshot — Compact habit list for the Home tab.
 *
 * Replaces the legacy HabitTracker on Home with a Loop-faithful snapshot:
 *   Header: "Habits" + completion counter (X/Y)
 *   List: HabitSnapshotCard for each active habit
 *   Footer: "View all habits →" deep-link to Habit Hub tab
 *   Empty: "Start your habit journey" CTA
 *
 * Uses useHabitHub for scores/filtering. Toggle and adjust use the same
 * handlers as HabitHubTab — single source of truth.
 */

import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Plus, Sparkles } from 'lucide-react';
import { cn, getToday } from '@/lib/utils';
import { motionPresets } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHabitHub } from '@/hooks/useHabitHub';
import { isHabitCompletedOnDate } from '@/lib/habits';
import { getCurrentStreak } from '@/lib/habitScore';
import { frequencyPresets } from '@/hooks/useHabitForm';
import { HabitSnapshotCard } from './HabitSnapshotCard';
import type { Habit } from '@/types';

interface HabitHomeSnapshotProps {
  habits: Habit[];
  onToggle: (habitId: string, date: string) => void;
  onAdjust?: (habitId: string, date: string, delta: number) => void;
  onSelectHabit: (habit: Habit) => void;
  onNavigateToHub: () => void;
}

export function HabitHomeSnapshot({
  habits,
  onToggle,
  onSelectHabit,
  onNavigateToHub,
}: HabitHomeSnapshotProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const today = getToday();

  const { activeHabits, scoresMap } = useHabitHub(habits);

  // Completion stats
  const { completedCount, totalCount } = useMemo(() => {
    let completed = 0;
    for (const h of activeHabits) {
      if (isHabitCompletedOnDate(h, today)) completed++;
    }
    return { completedCount: completed, totalCount: activeHabits.length };
  }, [activeHabits, today]);

  // Per-habit derived data (streak + freq label)
  const habitData = useMemo(() => {
    const map = new Map<string, { streak: number; freqLabel: string; isCompleted: boolean }>();
    for (const h of activeHabits) {
      const streak = getCurrentStreak(h);
      const { numerator: n, denominator: d } = h.frequency;
      const preset = frequencyPresets.find(
        p => p.ratio.numerator === n && p.ratio.denominator === d,
      );
      const freqLabel = preset
        ? (ts[preset.i18nKey] || preset.label)
        : `${n}× / ${d}${ts.daysAbbr || 'd'}`;
      map.set(h.id, { streak, freqLabel, isCompleted: isHabitCompletedOnDate(h, today) });
    }
    return map;
  }, [activeHabits, today, ts]);

  const handleToggle = useCallback((habitId: string) => {
    onToggle(habitId, today);
  }, [onToggle, today]);

  // ── Empty state ──
  if (activeHabits.length === 0) {
    return (
      <motion.div
        {...motionPresets.slideUp}
        className="rounded-2xl bg-surface-glass backdrop-blur-[var(--surface-glass-blur)] border border-[var(--surface-glass-border)] zen-shadow-card p-6 text-center"
      >
        <Sparkles className="w-8 h-8 mx-auto mb-3 text-violet-400 opacity-60" />
        <p className="text-sm font-medium text-foreground/80 mb-1">
          {ts.startHabitJourney || 'Start your habit journey'}
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          {ts.createFirstHabit || 'Create your first habit in the Habit Hub'}
        </p>
        <button
          onClick={onNavigateToHub}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium',
            'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors',
            'min-h-[44px]',
          )}
        >
          <Plus className="w-4 h-4" />
          {ts.addHabit || 'Add Habit'}
        </button>
      </motion.div>
    );
  }

  // ── Habit list ──
  return (
    <motion.div
      {...motionPresets.slideUp}
      className="rounded-2xl bg-surface-glass backdrop-blur-[var(--surface-glass-blur)] border border-[var(--surface-glass-border)] zen-shadow-card overflow-hidden"
    >
      {/* Header: title + counter */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-sm font-semibold text-foreground/80">
          {ts.habitsTitle || t.habits || 'Habits'}
        </span>
        <span className={cn(
          'text-xs font-medium tabular-nums px-2 py-0.5 rounded-full',
          completedCount === totalCount
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-white/[0.06] text-slate-400',
        )}>
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Habit cards — capped height to prevent infinite scroll on Home */}
      <div className="px-2 pb-1 space-y-1 max-h-96 overflow-y-auto">
        {activeHabits.map(habit => {
          const data = habitData.get(habit.id);
          return (
            <HabitSnapshotCard
              key={habit.id}
              habit={habit}
              score={scoresMap.get(habit.id) || 0}
              isCompleted={data?.isCompleted ?? false}
              streak={data?.streak ?? 0}
              freqLabel={data?.freqLabel ?? ''}
              onToggle={() => handleToggle(habit.id)}
              onSelect={() => onSelectHabit(habit)}
            />
          );
        })}
      </div>

      {/* Footer: view all */}
      <button
        onClick={onNavigateToHub}
        className={cn(
          'w-full flex items-center justify-center gap-1 py-2.5 text-xs text-slate-500',
          'hover:text-slate-300 transition-colors border-t border-white/[0.04]',
          'min-h-[44px]',
        )}
      >
        {ts.viewAllHabits || 'View all habits'}
        <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
      </button>
    </motion.div>
  );
}
