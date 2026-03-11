/**
 * HabitHubList — Loop-style main scrollable content for the Habit Hub tab.
 *
 * Layout: Category filter chips → Sort dropdown → Today checklist →
 *         Other (collapsible) → Archived (collapsible) → Overall score bar → FAB.
 *
 * Detail sheet delegated to HabitDetailSheet (Radix Sheet).
 * Deep Space aesthetic with glassmorphism.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, Archive, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModalErrorBoundary } from '@/components/ErrorBoundary';
import { zenMotion, zenTap } from '@/lib/animationUtils';
import { hapticTap, hapticSelection } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useHabitHub, type HabitSortOption } from '@/hooks/useHabitHub';
import { habitCategories } from '@/hooks/useHabitForm';
import { HabitHubCard } from './HabitHubCard';
import { HabitDetailSheet } from './HabitDetailSheet';
import { AddHabitSheet } from './AddHabitSheet';
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

const CATEGORY_I18N: Record<string, string> = {
  all: 'categoryAll',
  health: 'categoryHealth',
  mindfulness: 'categoryMindfulness',
  productivity: 'categoryProductivity',
  social: 'categorySocial',
  creativity: 'categoryCreativity',
  finance: 'categoryFinance',
  'self-care': 'categorySelfCare',
  other: 'categoryOther',
};

const SORT_I18N: Record<HabitSortOption, string> = {
  score: 'sortByScore',
  name: 'sortByName',
  status: 'sortByStatus',
  color: 'sortByColor',
  manual: 'sortByManual',
};

interface HabitHubListProps {
  habits: Habit[];
  onToggleHabit: (habitId: string, date: string) => void;
  onAdjustHabit: (habitId: string, date: string, delta: number) => void;
  onAddHabit: (habit: Habit) => void;
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
  onAdjustHabit,
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
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // P0: Android hardware back must close sort dropdown
  useBackHandler(showSortMenu, () => setShowSortMenu(false));

  const {
    todayHabits,
    otherHabits,
    archivedHabits,
    scoresMap,
    overallScore,
    categoryFilter,
    setCategoryFilter,
    sortOption,
    setSortOption,
    selectedHabit,
    setSelectedHabit,
  } = useHabitHub(habits);

  const handleSelect = useCallback((habit: Habit) => {
    setSelectedHabit(habit);
  }, [setSelectedHabit]);

  const handleCloseSheet = useCallback(() => {
    setSelectedHabit(null);
  }, [setSelectedHabit]);

  const handleEdit = useCallback((habit: Habit) => {
    setEditingHabit(habit);
    setShowAddForm(true);
  }, []);

  const handleSortSelect = useCallback((opt: HabitSortOption) => {
    setSortOption(opt);
    setShowSortMenu(false);
  }, [setSortOption]);

  const overallPercent = Math.round(overallScore * 100);

  const categoryChips: Array<{ id: HabitCategory | 'all'; icon: string }> = [
    { id: 'all', icon: '✦' },
    ...habitCategories,
  ];

  const sortOptions: HabitSortOption[] = ['manual', 'score', 'name', 'status', 'color'];
  const sortLabels: Record<HabitSortOption, string> = {
    manual: ts[SORT_I18N.manual] || 'Manual',
    score: ts[SORT_I18N.score] || 'Score',
    name: ts[SORT_I18N.name] || 'Name',
    status: ts[SORT_I18N.status] || 'Status',
    color: ts[SORT_I18N.color] || 'Color',
  };

  return (
    <div className="space-y-4 pb-32">
      {/* ═══ CATEGORY FILTER CHIPS ═══ */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {categoryChips.map((cat) => (
          <motion.button
            key={cat.id}
            onClick={() => { void hapticSelection(); setCategoryFilter(cat.id); }}
            whileTap={zenTap.button}
            aria-pressed={categoryFilter === cat.id}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              'border min-h-[44px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
              categoryFilter === cat.id
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:bg-white/[0.06]',
            )}
          >
            <span>{cat.icon}</span>
            <span>{ts[CATEGORY_I18N[cat.id]] || cat.id}</span>
          </motion.button>
        ))}
      </div>

      {/* ═══ SORT DROPDOWN ═══ */}
      <div className="relative flex justify-end">
        <button
          onClick={() => { void hapticTap(); setShowSortMenu(!showSortMenu); }}
          onKeyDown={(e) => { if (e.key === 'Escape' && showSortMenu) { e.stopPropagation(); setShowSortMenu(false); } }}
          aria-expanded={showSortMenu}
          aria-haspopup="listbox"
          className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-400 transition-colors min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
        >
          <ArrowUpDown className="w-3 h-3" />
          <span>{sortLabels[sortOption]}</span>
        </button>
        <AnimatePresence>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-[60]" aria-hidden="true" onClick={() => setShowSortMenu(false)} />
              <motion.div
                role="listbox"
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -2 }}
                transition={zenMotion.snappy}
                className={cn(
                  'absolute end-0 top-full z-[61] min-w-[120px] rounded-xl overflow-hidden',
                  'bg-[#141a2e] border border-white/[0.08] shadow-xl',
                  'ltr:origin-top-right rtl:origin-top-left',
                )}
                onKeyDown={(e) => { if (e.key === 'Escape') setShowSortMenu(false); }}
              >
                {sortOptions.map((opt) => (
                  <button
                    key={opt}
                    role="option"
                    aria-selected={sortOption === opt}
                    onClick={() => handleSortSelect(opt)}
                    className={cn(
                      'w-full px-3 py-2 text-xs text-start transition-colors min-h-[44px] flex items-center',
                      sortOption === opt
                        ? 'text-violet-300 bg-violet-500/10'
                        : 'text-slate-400 hover:bg-white/[0.05]',
                    )}
                  >
                    {sortLabels[opt]}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ TODAY'S HABITS ═══ */}
      {todayHabits.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1 mb-3">
            {ts.todayHabits || "Today's Habits"}
          </h3>
          <motion.div className="space-y-2" variants={listStagger} initial="hidden" animate="visible">
            {todayHabits.map(habit => (
              <motion.div key={habit.id} variants={cardEntrance}>
                <HabitHubCard
                  habit={habit}
                  score={scoresMap.get(habit.id) ?? 0}
                  onToggle={onToggleHabit}
                  onAdjust={onAdjustHabit}
                  onSelect={handleSelect}
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
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 px-1 mb-3 w-full min-h-[44px]"
          >
            <span>{ts.otherHabits || 'Other Habits'}</span>
            <span className="text-slate-600">({otherHabits.length})</span>
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform ms-auto', showOther && 'rotate-180')} />
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
                <motion.div className="space-y-2" variants={listStagger} initial="hidden" animate="visible">
                  {otherHabits.map(habit => (
                    <motion.div key={habit.id} variants={cardEntrance}>
                      <HabitHubCard
                        habit={habit}
                        score={scoresMap.get(habit.id) ?? 0}
                        onToggle={onToggleHabit}
                        onAdjust={onAdjustHabit}
                        onSelect={handleSelect}
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
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 px-1 mb-3 w-full min-h-[44px]"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{ts.archivedHabits || 'Archived'}</span>
            <span className="text-slate-700">({archivedHabits.length})</span>
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform ms-auto', showArchived && 'rotate-180')} />
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
                        onSelect={handleSelect}
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
            className="text-slate-400 text-sm mb-6"
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
                onClick={() => setCategoryFilter('all')}
                className={cn(
                  'px-6 py-3 rounded-2xl text-sm font-medium transition-all min-h-[44px]',
                  'bg-white/[0.06] border border-white/[0.08] text-slate-300',
                  'hover:bg-white/[0.10] active:scale-[0.97]',
                  'flex items-center gap-2 mx-auto',
                )}
              >
                {ts.showAll || 'Show All'}
              </button>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className={cn(
                  'px-6 py-3 rounded-2xl text-sm font-medium transition-all min-h-[44px]',
                  'bg-primary text-primary-foreground',
                  'shadow-zen-lg shadow-primary/20',
                  'hover:brightness-110 active:scale-[0.97]',
                  'flex items-center gap-2 mx-auto',
                )}
              >
                <Plus className="w-5 h-5" />
                {ts.addHabit || 'Add Habit'}
              </button>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* ═══ OVERALL SCORE BAR ═══ */}
      {(todayHabits.length > 0 || otherHabits.length > 0) && (
        <div className="px-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">{ts.overallScore || 'Overall Score'}</span>
            <span className={cn(
              'text-xs font-bold tabular-nums',
              overallPercent >= 60 ? 'text-emerald-400' : overallPercent >= 30 ? 'text-amber-400' : 'text-slate-500',
            )}>
              {overallPercent}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${overallPercent}%`,
                backgroundColor: overallPercent >= 60 ? '#22C55E' : overallPercent >= 30 ? '#F59E0B' : '#64748B',
              }}
            />
          </div>
        </div>
      )}

      {/* ═══ FAB — Add Habit ═══ */}
      <div
        className="fixed z-[60]"
        style={{ bottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))', insetInlineEnd: '1.25rem' }}
      >
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...zenMotion.bouncy, delay: 0.3 }}
          whileTap={zenTap.button}
          whileHover={{ scale: 1.05 }}
          onClick={() => { void hapticTap(); setShowAddForm(true); }}
          className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center',
            'bg-primary shadow-zen-lg shadow-primary/20',
            'hover:shadow-primary/40',
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
        onEdit={handleEdit}
        onUpdate={onUpdateHabit}
        onArchive={onArchiveHabit}
        onUnarchive={onUnarchiveHabit}
        onSkip={onSkipHabit}
        onUnskip={onUnskipHabit}
        onDelete={onDeleteHabit}
      />

      {/* ═══ Add / Edit Habit Sheet ═══ */}
      <ModalErrorBoundary fallbackTitle={ts.addHabitError || 'Add Habit Error'}>
        <AddHabitSheet
          open={showAddForm}
          onClose={() => { setShowAddForm(false); setEditingHabit(null); }}
          onAdd={onAddHabit}
          onUpdate={onUpdateHabit}
          editingHabit={editingHabit}
          activeHabitCount={habits.filter(h => !h.isArchived).length}
        />
      </ModalErrorBoundary>
    </div>
  );
}
