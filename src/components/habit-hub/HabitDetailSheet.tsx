/**
 * HabitDetailSheet — Bottom sheet with full Loop-style analytics for a single habit.
 * Uses Radix Sheet (existing ui/sheet.tsx). Deep Space aesthetic.
 *
 * Sections: Header → Stats → Score Chart → Heatmap → Frequency → Streaks → Notes → Actions.
 */

import { memo, useState, useMemo, useCallback } from 'react';
import { Archive, ArchiveRestore, Pencil, SkipForward, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ProgressRing } from '@/components/ui/progress-ring';
import { computeHabitScore, getCurrentStreak } from '@/lib/habitScore';
import { resolveHabitColor } from '@/lib/habitColorUtils';
import { AnimatedFire } from '@/components/compact-habit-card/AnimatedFire';
import { HabitStatsSection } from './HabitStatsSection';
import { HabitTargetCard } from './HabitTargetCard';
import { HabitScoreChart } from './HabitScoreChart';
import { HabitBarCard } from './HabitBarCard';
import { HabitHeatmapGrid } from './HabitHeatmapGrid';
import { HabitFrequencyChart } from './HabitFrequencyChart';
import { HabitStreakTimeline } from './HabitStreakTimeline';
import { HabitNotesSection } from './HabitNotesSection';
import { cn, getToday } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import type { Habit } from '@/types';

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
  useBackHandler(!!habit, onClose);

  const score = useMemo(() => (habit ? computeHabitScore(habit) : 0), [habit]);
  const scorePercent = Math.round(score * 100);
  const streak = useMemo(() => (habit ? getCurrentStreak(habit) : 0), [habit]);
  const isSkippedToday = useMemo(
    () => habit?.entries?.[today]?.value === 3 || false,
    [habit, today],
  );

  const habitColor = habit ? resolveHabitColor(habit.color) : '#8B5CF6';

  const handleArchiveToggle = useCallback(() => {
    if (!habit) return;
    if (habit.isArchived) {
      onUnarchive(habit.id);
    } else {
      onArchive(habit.id);
    }
    onClose();
  }, [habit, onArchive, onUnarchive, onClose]);

  const handleSkipToggle = useCallback(() => {
    if (!habit) return;
    if (isSkippedToday) {
      onUnskip(habit.id, today);
    } else {
      onSkip(habit.id, today);
    }
  }, [habit, isSkippedToday, today, onSkip, onUnskip]);

  const handleNoteUpdate = useCallback((updatedHabit: Habit) => {
    onUpdate(updatedHabit);
  }, [onUpdate]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = useCallback(() => {
    if (!habit) return;
    onDelete(habit.id);
    setShowDeleteConfirm(false);
    onClose();
  }, [habit, onDelete, onClose]);

  return (
    <Sheet open={!!habit} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="bottom"
        className={cn(
          'max-h-[85dvh] rounded-t-3xl overflow-y-auto',
          'bg-[#0a0f1a] border-t border-white/[0.06]',
          'p-0',
        )}
      >
        {habit && (
          <div
            className="px-6 pt-6 space-y-6"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {/* ═══ HEADER ═══ */}
            <div className="flex items-center gap-3">
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
                <span className="text-xs text-slate-500 capitalize">
                  {habit.category || habit.habitType}
                </span>
              </div>
              {/* Score ring */}
              <ProgressRing
                progress={scorePercent}
                size="md"
                showPercentage
                color={scorePercent >= 60 ? 'success' : scorePercent >= 30 ? 'warning' : 'primary'}
              />
            </div>

            {/* ═══ SCORE + STREAK SUMMARY ═══ */}
            <div className="flex items-center justify-center gap-6 py-2">
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
            </div>

            {/* ═══ STATISTICS ═══ */}
            <HabitStatsSection habit={habit} />

            {/* ═══ TARGET PROGRESS (numerical only) ═══ */}
            <HabitTargetCard habit={habit} />

            {/* ═══ SCORE HISTORY LINE CHART ═══ */}
            <HabitScoreChart habit={habit} />

            {/* ═══ COMPLETION BAR CHART ═══ */}
            <HabitBarCard habit={habit} />

            {/* ═══ HEATMAP ═══ */}
            <HabitHeatmapGrid habit={habit} />

            {/* ═══ FREQUENCY CHART ═══ */}
            <HabitFrequencyChart habit={habit} />

            {/* ═══ STREAK TIMELINE ═══ */}
            <HabitStreakTimeline habit={habit} />

            {/* ═══ NOTES ═══ */}
            <HabitNotesSection habit={habit} onUpdate={handleNoteUpdate} />

            {/* ═══ ACTIONS ═══ */}
            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              {/* Edit habit */}
              <button
                onClick={() => { onEdit(habit); onClose(); }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors',
                  'bg-white/[0.03] border border-white/[0.06]',
                  'hover:bg-white/[0.06] active:scale-[0.98]',
                )}
              >
                <Pencil className="w-4 h-4 text-violet-400" />
                <span className="text-slate-300">{ts.editHabit || 'Edit Habit'}</span>
              </button>

              {/* Skip today */}
              <button
                onClick={handleSkipToggle}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors',
                  'bg-white/[0.03] border border-white/[0.06]',
                  'hover:bg-white/[0.06] active:scale-[0.98]',
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
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors',
                  'bg-white/[0.03] border border-white/[0.06]',
                  'hover:bg-white/[0.06] active:scale-[0.98]',
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
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors',
                    'bg-red-500/[0.05] border border-red-500/[0.1]',
                    'hover:bg-red-500/[0.1] active:scale-[0.98]',
                    'text-red-400',
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{ts.deleteHabit || 'Delete Habit'}</span>
                </button>
              ) : (
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
                      )}
                    >
                      {ts.cancel || 'Cancel'}
                    </button>
                    <button
                      onClick={handleDelete}
                      className={cn(
                        'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px]',
                        'bg-red-600 text-white',
                        'hover:bg-red-500 active:scale-[0.98]',
                      )}
                    >
                      {ts.delete || 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
});
