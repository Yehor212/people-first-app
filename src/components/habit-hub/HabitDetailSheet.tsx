/**
 * HabitDetailSheet — Bottom sheet with full Loop-style analytics for a single habit.
 * Uses Radix Sheet (existing ui/sheet.tsx). Deep Space aesthetic.
 *
 * Sections: Header → Stats → Score Chart → Heatmap → Frequency → Streaks → Notes → Actions.
 */

import { memo, useState, useMemo, useCallback, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archive, ArchiveRestore, Pencil, SkipForward, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ProgressRing } from '@/components/ui/progress-ring';
import { computeHabitScore, computeAllStreaks, type HabitStreak } from '@/lib/habitScore';
import { getHabitCompletedDates } from '@/lib/habits';
import { computeEntriesWithAuto } from '@/lib/habitComputedEntries';
import { resolveHabitColor } from '@/lib/habitColorUtils';
import { zenMotion } from '@/lib/animationUtils';
import { hapticTap } from '@/lib/haptics';
import { AnimatedFire } from '@/components/compact-habit-card/AnimatedFire';
import { HabitStatsSection } from './HabitStatsSection';
import { HabitTargetCard } from './HabitTargetCard';
import { HabitScoreChart } from './HabitScoreChart';
import { HabitBarCard } from './HabitBarCard';
import { HabitHeatmapGrid } from './HabitHeatmapGrid';
import { HabitStreakTimeline } from './HabitStreakTimeline';
import { HabitNotesSection } from './HabitNotesSection';
import { cn, getToday } from '@/lib/utils';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { ENTRY } from '@/types';
import type { Habit } from '@/types';

// Lazy-load HabitFrequencyChart to keep recharts out of main bundle (prevents TDZ errors)
const LazyHabitFrequencyChart = lazyWithRetry(
  () => import('./HabitFrequencyChart').then(m => ({ default: m.HabitFrequencyChart })),
  'HabitFrequencyChart'
);

/** Stagger parent for sheet sections */
const sheetStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.15 } },
};
const sectionEntrance = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: zenMotion.gentle },
};

interface HabitDetailSheetProps {
  habit: Habit | null;
  onClose: () => void;
  onEdit: (habit: Habit) => void;
  onUpdate: (habit: Habit) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onSkip: (id: string, date: string) => void;
  onUnskip: (id: string, date: string) => void;
  onDelete: (id: string) => void;
}

export const HabitDetailSheet = memo(function HabitDetailSheet({
  habit,
  onClose,
  onEdit,
  onUpdate,
  onArchive,
  onUnarchive,
  onSkip,
  onUnskip,
  onDelete,
}: HabitDetailSheetProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const today = getToday();

  // P0: Android back button must close sheet, not navigate away
  // Delete confirmation gets its own handler so back dismisses it instead of the whole sheet
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  useBackHandler(showDeleteConfirm, () => setShowDeleteConfirm(false));
  useBackHandler(!!habit && !showDeleteConfirm, onClose);

  // Compute all derived data once — passed down to child components to avoid redundant computation
  const derived = useMemo(() => {
    if (!habit) return { score: 0, streak: 0, allStreaks: [] as HabitStreak[], completedDates: [] as string[] };
    const allStreaks = computeAllStreaks(habit);
    const todayStr = getToday();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    // Derive current streak from allStreaks (same logic as getCurrentStreak)
    let streak = 0;
    if (allStreaks.length > 0) {
      const recent = allStreaks.reduce((best, s) => s.end > best.end ? s : best, allStreaks[0]);
      if (recent.end === todayStr || recent.end === yesterdayStr) streak = recent.length;
    }
    // Use computed entries (YES_AUTO fills) so Total matches heatmap green cells
    const computedEntries = computeEntriesWithAuto(habit);
    return {
      score: computeHabitScore(habit),
      streak,
      allStreaks,
      completedDates: getHabitCompletedDates(habit, computedEntries),
    };
  }, [habit]);
  const { score, streak, allStreaks, completedDates } = derived;
  const scorePercent = Math.round(score * 100);
  const isSkippedToday = useMemo(
    () => habit?.entries?.[today]?.value === ENTRY.SKIP || false,
    [habit, today],
  );

  const habitColor = habit ? resolveHabitColor(habit.color) : '#8B5CF6';

  const handleArchiveToggle = useCallback(() => {
    if (!habit) return;
    void hapticTap();
    if (habit.isArchived) {
      onUnarchive(habit.id);
    } else {
      onArchive(habit.id);
    }
    onClose();
  }, [habit, onArchive, onUnarchive, onClose]);

  const handleSkipToggle = useCallback(() => {
    if (!habit) return;
    void hapticTap();
    if (isSkippedToday) {
      onUnskip(habit.id, today);
    } else {
      onSkip(habit.id, today);
    }
  }, [habit, isSkippedToday, today, onSkip, onUnskip]);

  const handleNoteUpdate = useCallback((updatedHabit: Habit) => {
    onUpdate(updatedHabit);
  }, [onUpdate]);

  const [isDeleting, setIsDeleting] = useState(false);

  // Reset delete UI state when a different habit is selected or sheet reopens.
  // Radix Sheet stays mounted in DOM (open={false}), so state persists across opens.
  // Without this reset, isDeleting=true from a previous delete permanently blocks future deletes.
  useEffect(() => {
    setIsDeleting(false);
    setShowDeleteConfirm(false);
  }, [habit?.id]);

  const handleDelete = useCallback(() => {
    if (!habit || isDeleting) return;
    setIsDeleting(true);
    void hapticTap();
    onDelete(habit.id);
    setShowDeleteConfirm(false);
    onClose();
  }, [habit, isDeleting, onDelete, onClose]);

  return (
    <Sheet open={!!habit} onOpenChange={(open) => { if (!open) { setIsDeleting(false); setShowDeleteConfirm(false); onClose(); } }}>
      <SheetContent
        side="bottom"
        className={cn(
          'max-h-[85dvh] rounded-t-3xl overflow-y-auto',
          'bg-[#0a0f1a] border-t border-white/[0.06]',
          'p-0',
        )}
      >
        {habit && (
          <motion.div
            className="px-6 pt-6 space-y-6"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
            variants={sheetStagger}
            initial="hidden"
            animate="visible"
          >
            {/* ═══ HEADER ═══ */}
            <motion.div variants={sectionEntrance} className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: `${habitColor}20`, color: habitColor }}
              >
                {habit.icon}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg font-semibold text-slate-100 truncate">
                  {habit.name}
                </SheetTitle>
                {habit.category && (
                  <span className="text-xs text-slate-500 capitalize">
                    {habit.category}
                  </span>
                )}
              </div>
              {/* Score ring */}
              <ProgressRing
                progress={scorePercent}
                size="md"
                showPercentage
                color={scorePercent >= 60 ? 'success' : scorePercent >= 30 ? 'warning' : 'primary'}
              />
            </motion.div>

            {/* ═══ SCORE + STREAK SUMMARY ═══ */}
            <motion.div variants={sectionEntrance} className="flex items-center justify-center gap-6 py-2">
              <div className="text-center">
                <div className={cn(
                  'text-2xl font-bold tabular-nums',
                  scorePercent >= 60 ? 'text-emerald-400' : scorePercent >= 30 ? 'text-amber-400' : 'text-slate-400',
                )}>
                  {scorePercent}%
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">{ts.habitScore || 'Score'}</div>
              </div>
              {streak > 0 && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <AnimatedFire intensity={Math.min(streak / 7, 3)} size="md" />
                    <span className="text-2xl font-bold text-orange-400 tabular-nums">{streak}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5">{ts.currentStreak || 'Current Streak'}</div>
                </div>
              )}
            </motion.div>

            {/* ═══ STATISTICS ═══ */}
            <motion.div variants={sectionEntrance}>
              <HabitStatsSection currentStreak={streak} allStreaks={allStreaks} completedDates={completedDates} />
            </motion.div>

            {/* ═══ TARGET PROGRESS (numerical only) ═══ */}
            <motion.div variants={sectionEntrance}>
              <HabitTargetCard habit={habit} />
            </motion.div>

            {/* ═══ SCORE HISTORY LINE CHART ═══ */}
            <motion.div variants={sectionEntrance}>
              <HabitScoreChart habit={habit} />
            </motion.div>

            {/* ═══ COMPLETION BAR CHART ═══ */}
            <motion.div variants={sectionEntrance}>
              <HabitBarCard habit={habit} />
            </motion.div>

            {/* ═══ HEATMAP ═══ */}
            <motion.div variants={sectionEntrance}>
              <HabitHeatmapGrid habit={habit} />
            </motion.div>

            {/* ═══ FREQUENCY CHART ═══ */}
            <motion.div variants={sectionEntrance}>
              <Suspense fallback={<div className="h-48" />}>
                <LazyHabitFrequencyChart habit={habit} />
              </Suspense>
            </motion.div>

            {/* ═══ STREAK TIMELINE ═══ */}
            <motion.div variants={sectionEntrance}>
              <HabitStreakTimeline allStreaks={allStreaks} currentStreak={streak} />
            </motion.div>

            {/* ═══ NOTES ═══ */}
            <motion.div variants={sectionEntrance}>
              <HabitNotesSection habit={habit} onUpdate={handleNoteUpdate} />
            </motion.div>

            {/* ═══ ACTIONS ═══ */}
            <motion.div variants={sectionEntrance} className="space-y-2 pt-2 border-t border-white/[0.06]">
              {/* Edit habit */}
              <button
                onClick={() => { onEdit(habit); onClose(); }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors min-h-[44px]',
                  'bg-white/[0.03] border border-white/[0.06]',
                  'hover:bg-white/[0.06] active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                )}
              >
                <Pencil className="w-4 h-4 text-violet-400" />
                <span className="text-slate-300">{ts.editHabit || 'Edit Habit'}</span>
              </button>

              {/* Skip today */}
              <button
                onClick={handleSkipToggle}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors min-h-[44px]',
                  'bg-white/[0.03] border border-white/[0.06]',
                  'hover:bg-white/[0.06] active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                  isSkippedToday && 'bg-blue-500/[0.08] border-blue-500/[0.15] text-blue-400',
                )}
              >
                <SkipForward className="w-4 h-4 text-blue-400" />
                <span className={isSkippedToday ? 'text-blue-300' : 'text-slate-300'}>
                  {isSkippedToday ? (ts.skipped || 'Skipped Today') : (ts.skipToday || 'Skip Today')}
                </span>
              </button>

              {/* Archive / Unarchive */}
              <button
                onClick={handleArchiveToggle}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors min-h-[44px]',
                  'bg-white/[0.03] border border-white/[0.06]',
                  'hover:bg-white/[0.06] active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                )}
              >
                {habit.isArchived ? (
                  <>
                    <ArchiveRestore className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">{ts.unarchiveHabit || 'Unarchive'}</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">{ts.archiveHabit || 'Archive Habit'}</span>
                  </>
                )}
              </button>

              {/* Delete — danger with confirmation */}
              <AnimatePresence mode="wait" initial={false}>
                {!showDeleteConfirm ? (
                  <motion.div
                    key="del-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={zenMotion.exit}
                  >
                    <button
                      onClick={() => { void hapticTap(); setShowDeleteConfirm(true); }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors min-h-[44px]',
                        'bg-red-500/[0.05] border border-red-500/[0.1]',
                        'hover:bg-red-500/[0.1] active:scale-[0.98]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50',
                        'text-red-400',
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{ts.deleteHabit || 'Delete Habit'}</span>
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="del-confirm"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={zenMotion.snappy}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2">
                      <p className="text-xs text-red-400 text-center px-2">
                        {ts.confirmDeleteHabit || 'Are you sure? This cannot be undone.'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className={cn(
                            'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px]',
                            'bg-white/[0.05] border border-white/[0.08] text-slate-400',
                            'hover:bg-white/[0.08]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                          )}
                        >
                          {ts.cancel || 'Cancel'}
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className={cn(
                            'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px]',
                            'bg-red-600 text-white',
                            'hover:bg-red-500 active:scale-[0.98]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50',
                            isDeleting && 'opacity-50 cursor-not-allowed',
                          )}
                        >
                          {ts.delete || 'Delete'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </SheetContent>
    </Sheet>
  );
});
