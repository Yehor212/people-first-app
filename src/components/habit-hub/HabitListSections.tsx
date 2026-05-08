/**
 * HabitListSections — Today/Other/Archived/Empty sections for HabitHubList.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { zenMotion } from '@/lib/animationUtils';
import { HabitHubCard } from './HabitHubCard';
import type { Habit, HabitCategory } from '@/types';

/** Stagger orchestration for card lists */
const listStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
};
const cardEntrance = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: zenMotion.gentle },
};

interface HabitListSectionsProps {
  todayHabits: Habit[];
  otherHabits: Habit[];
  archivedHabits: Habit[];
  scoresMap: Map<string, number>;
  categoryFilter: HabitCategory | 'all';
  onToggleHabit: (habitId: string, date: string) => void;
  onAdjustHabit: (habitId: string, date: string, delta: number) => void;
  onSelect: (habit: Habit) => void;
  onAddClick: () => void;
  onClearFilter: () => void;
  ts: Record<string, string>;
}

export function HabitListSections({
  todayHabits,
  otherHabits,
  archivedHabits,
  scoresMap,
  categoryFilter,
  onToggleHabit,
  onAdjustHabit,
  onSelect,
  onAddClick,
  onClearFilter,
  ts,
}: HabitListSectionsProps) {
  const [showOther, setShowOther] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  return (
    <>
      {/* ═══ TODAY'S HABITS ═══ */}
      {todayHabits.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-3">
            {ts.todayHabits || "Today's Habits"}
          </h3>
          <motion.div className="space-y-2 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:space-y-0" variants={listStagger} initial="hidden" animate="visible">
            {todayHabits.map(habit => (
              <motion.div key={habit.id} variants={cardEntrance}>
                <HabitHubCard
                  habit={habit}
                  score={scoresMap.get(habit.id) ?? 0}
                  onToggle={onToggleHabit}
                  onAdjust={onAdjustHabit}
                  onSelect={onSelect}
                />
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* ═══ OTHER HABITS ═══ */}
      {otherHabits.length > 0 && (
        <section>
          <button
            onClick={() => setShowOther(prev => !prev)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-3 w-full min-h-[44px]"
          >
            <span>{ts.otherHabits || 'Other Habits'}</span>
            <span className="text-muted-foreground/60">({otherHabits.length})</span>
            <ChevronDown className={cn('w-3.5 h-3.5 motion-safe:transition-transform ms-auto', showOther && 'rotate-180')} aria-hidden="true" />
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
                <motion.div className="space-y-2 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:space-y-0" variants={listStagger} initial="hidden" animate="visible">
                  {otherHabits.map(habit => (
                    <motion.div key={habit.id} variants={cardEntrance}>
                      <HabitHubCard
                        habit={habit}
                        score={scoresMap.get(habit.id) ?? 0}
                        onToggle={onToggleHabit}
                        onAdjust={onAdjustHabit}
                        onSelect={onSelect}
                      />
                    </motion.div>
                  ))}
                </motion.div>
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
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-3 w-full min-h-[44px]"
          >
            <Archive className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{ts.archivedHabits || 'Archived'}</span>
            <span className="text-muted-foreground/60">({archivedHabits.length})</span>
            <ChevronDown className={cn('w-3.5 h-3.5 motion-safe:transition-transform ms-auto', showArchived && 'rotate-180')} aria-hidden="true" />
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
                <motion.div className="space-y-2 opacity-50" variants={listStagger} initial="hidden" animate="visible">
                  {archivedHabits.map(habit => (
                    <motion.div key={habit.id} variants={cardEntrance}>
                      <HabitHubCard
                        habit={habit}
                        score={scoresMap.get(habit.id) ?? 0}
                        onToggle={onToggleHabit}
                        onAdjust={onAdjustHabit}
                        onSelect={onSelect}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* ═══ EMPTY STATE ═══ */}
      {todayHabits.length === 0 && otherHabits.length === 0 && (
        <motion.div
          className="text-center py-16 px-6"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div
            className="text-4xl mb-4"
            variants={{
              hidden: { opacity: 0, scale: 0.5 },
              visible: { opacity: 1, scale: 1, transition: zenMotion.bouncy },
            }}
          >
            {categoryFilter !== 'all' ? '🔍' : '🌱'}
          </motion.div>
          <motion.p
            className="text-muted-foreground text-sm mb-6"
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: zenMotion.gentle },
            }}
          >
            {categoryFilter !== 'all'
              ? (ts.noHabitsInCategory || 'No habits in this category')
              : (ts.noHabitsYet || 'No habits yet. Add your first one!')}
          </motion.p>
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { ...zenMotion.gentle, delay: 0.05 } },
            }}
          >
            {categoryFilter !== 'all' ? (
              <button
                onClick={onClearFilter}
                className={cn(
                  'px-6 py-3 rounded-2xl text-sm font-medium motion-safe:transition-all min-h-[44px]',
                  'bg-white/[0.06] border border-white/[0.08] text-muted-foreground',
                  'hover:bg-white/[0.10] active:scale-[0.97]',
                  'flex items-center gap-2 mx-auto',
                )}
              >
                {ts.showAll || 'Show All'}
              </button>
            ) : (
              <button
                onClick={onAddClick}
                className={cn(
                  'px-6 py-3 rounded-2xl text-sm font-medium motion-safe:transition-all min-h-[44px]',
                  'bg-primary text-primary-foreground',
                  'shadow-zen-lg shadow-primary/20',
                  'hover:brightness-110 active:scale-[0.97]',
                  'flex items-center gap-2 mx-auto',
                )}
              >
                <Plus className="w-5 h-5" aria-hidden="true" />
                {ts.addHabit || 'Add Habit'}
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
