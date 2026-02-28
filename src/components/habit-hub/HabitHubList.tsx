/**
 * HabitHubList — Main scrollable content for the Habit Hub tab.
 * Sections: Overall Score → Today → Other → Archived → FAB.
 * Detail sheet delegated to HabitDetailSheet (Radix Sheet).
 * Deep Space aesthetic with glassmorphism.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { zenMotion } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProgressRing } from '@/components/ui/progress-ring';
import { useHabitHub } from '@/hooks/useHabitHub';
import { HabitHubCard } from './HabitHubCard';
import { HabitDetailSheet } from './HabitDetailSheet';
import type { Habit } from '@/types';

interface HabitHubListProps {
  habits: Habit[];
  onToggleHabit: (habitId: string, date: string) => void;
  onAddHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'completedDates'>) => void;
  onDeleteHabit: (habitId: string) => void;
  onUpdateHabit: (habit: Habit) => void;
  onArchiveHabit: (habitId: string) => void;
  onUnarchiveHabit: (habitId: string) => void;
  onSkipHabit: (habitId: string, date: string) => void;
  onUnskipHabit: (habitId: string, date: string) => void;
}

export function HabitHubList({
  habits,
  onToggleHabit,
  onAddHabit,
  onDeleteHabit,
  onUpdateHabit,
  onArchiveHabit,
  onUnarchiveHabit,
  onSkipHabit,
  onUnskipHabit,
}: HabitHubListProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [showOther, setShowOther] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const {
    todayHabits,
    otherHabits,
    archivedHabits,
    scoresMap,
    overallScore,
    selectedHabit,
    setSelectedHabit,
  } = useHabitHub(habits);

  const handleSelect = useCallback((habit: Habit) => {
    setSelectedHabit(habit);
  }, [setSelectedHabit]);

  const handleCloseSheet = useCallback(() => {
    setSelectedHabit(null);
  }, [setSelectedHabit]);

  const overallPercent = Math.round(overallScore * 100);

  return (
    <div className="space-y-6 pb-32">
      {/* ═══ OVERALL SCORE ═══ */}
      <div className="flex flex-col items-center pt-2">
        <ProgressRing
          progress={overallPercent}
          size="lg"
          showPercentage
          color={overallPercent >= 60 ? 'success' : overallPercent >= 30 ? 'warning' : 'primary'}
        />
        <span className="text-xs text-slate-400 mt-2">{ts.overallScore || 'Overall Score'}</span>
      </div>

      {/* ═══ TODAY'S HABITS ═══ */}
      {todayHabits.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1 mb-3">
            {ts.todayHabits || "Today's Habits"}
          </h3>
          <div className="space-y-2">
            {todayHabits.map(habit => (
              <HabitHubCard
                key={habit.id}
                habit={habit}
                score={scoresMap.get(habit.id) ?? 0}
                onToggle={onToggleHabit}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </section>
      )}

      {/* ═══ OTHER HABITS ═══ */}
      {otherHabits.length > 0 && (
        <section>
          <button
            onClick={() => setShowOther(prev => !prev)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 px-1 mb-3 w-full"
          >
            <span>{ts.otherHabits || 'Other Habits'}</span>
            <span className="text-slate-600">({otherHabits.length})</span>
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform ml-auto', showOther && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showOther && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={zenMotion.gentle}
                className="overflow-hidden"
              >
                <div className="space-y-2">
                  {otherHabits.map(habit => (
                    <HabitHubCard
                      key={habit.id}
                      habit={habit}
                      score={scoresMap.get(habit.id) ?? 0}
                      onToggle={onToggleHabit}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* ═══ ARCHIVED ═══ */}
      {archivedHabits.length > 0 && (
        <section>
          <button
            onClick={() => setShowArchived(prev => !prev)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 px-1 mb-3 w-full"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{ts.archivedHabits || 'Archived'}</span>
            <span className="text-slate-700">({archivedHabits.length})</span>
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform ml-auto', showArchived && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showArchived && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={zenMotion.gentle}
                className="overflow-hidden"
              >
                <div className="space-y-2 opacity-50">
                  {archivedHabits.map(habit => (
                    <HabitHubCard
                      key={habit.id}
                      habit={habit}
                      score={0}
                      onToggle={onToggleHabit}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* ═══ EMPTY STATE ═══ */}
      {todayHabits.length === 0 && otherHabits.length === 0 && (
        <div className="text-center py-16 px-6">
          <div className="text-4xl mb-4">🌱</div>
          <p className="text-slate-400 text-sm">{ts.noHabitsYet || 'No habits yet. Add your first one!'}</p>
        </div>
      )}

      {/* ═══ FAB — Add Habit ═══ */}
      <div
        className="fixed z-40"
        style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))', right: '1.25rem' }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAddForm(true)}
          className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center',
            'bg-primary shadow-zen-lg shadow-primary/20',
            'text-primary-foreground',
          )}
          aria-label={ts.addHabit || 'Add habit'}
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* ═══ Detail Sheet (Radix-based) ═══ */}
      <HabitDetailSheet
        habit={selectedHabit}
        onClose={handleCloseSheet}
        onArchive={onArchiveHabit}
        onUnarchive={onUnarchiveHabit}
        onSkip={onSkipHabit}
        onUnskip={onUnskipHabit}
        onDelete={onDeleteHabit}
      />
    </div>
  );
}
