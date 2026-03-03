/**
 * HabitSnapshotCard — Compact 60px glassmorphism habit card for the Home tab.
 *
 * Layout (single row):
 *   [Checkbox] Icon Name              Score  Streak  Frequency
 *
 * Interactions:
 *   - Tap checkbox → toggle today's entry (haptic)
 *   - Tap card body → navigate to Habit Hub + open detail sheet
 *
 * Cross-platform: logical CSS, 44px touch targets, motion-reduce safe.
 */

import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticTap } from '@/lib/haptics';
import { resolveHabitColor } from '@/lib/habitColorUtils';
import { AnimatedFire } from '@/components/compact-habit-card/AnimatedFire';
import type { Habit } from '@/types';

interface HabitSnapshotCardProps {
  habit: Habit;
  score: number;
  isCompleted: boolean;
  streak: number;
  freqLabel: string;
  onToggle: () => void;
  onSelect: () => void;
}

export const HabitSnapshotCard = memo(function HabitSnapshotCard({
  habit,
  score,
  isCompleted,
  streak,
  freqLabel,
  onToggle,
  onSelect,
}: HabitSnapshotCardProps) {
  const habitColor = resolveHabitColor(habit.color);
  const scorePercent = Math.round(score * 100);

  const handleToggle = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    void hapticTap();
    onToggle();
  }, [onToggle]);

  const handleSelect = useCallback(() => {
    void hapticTap();
    onSelect();
  }, [onSelect]);

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-3 h-[60px] rounded-xl cursor-pointer transition-colors',
        'bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm',
        'hover:bg-white/[0.06] active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
        isCompleted && 'bg-emerald-500/[0.04] border-emerald-500/[0.10]',
      )}
      onClick={handleSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(); } }}
      tabIndex={0}
      role="button"
      aria-label={habit.name}
    >
      {/* Checkbox — 44px touch target */}
      <motion.button
        className={cn(
          'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
          'min-w-[44px] min-h-[44px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
          isCompleted ? 'border-transparent' : 'border-white/20',
        )}
        style={isCompleted ? { backgroundColor: habitColor } : undefined}
        onClick={handleToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(e); } }}
        whileTap={{ scale: 0.85 }}
        aria-label={isCompleted ? `${habit.name} completed` : `${habit.name} not completed`}
        tabIndex={-1}
      >
        {isCompleted && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
          </motion.div>
        )}
      </motion.button>

      {/* Icon */}
      <span className="text-base flex-shrink-0">{habit.icon}</span>

      {/* Name */}
      <span
        className={cn(
          'flex-1 text-sm font-medium truncate min-w-0 text-start',
          isCompleted && 'line-through decoration-white/20 opacity-60',
        )}
        style={{ color: isCompleted ? undefined : habitColor }}
      >
        {habit.name}
      </span>

      {/* Score */}
      <span className={cn(
        'text-[10px] font-semibold tabular-nums flex-shrink-0',
        score >= 0.8 ? 'text-emerald-400' : score >= 0.5 ? 'text-amber-400' : score >= 0.2 ? 'text-orange-400' : 'text-slate-500',
      )}>
        {scorePercent}%
      </span>

      {/* Streak (if > 0) */}
      {streak > 0 && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <AnimatedFire intensity={Math.min(streak / 7, 3)} size="sm" />
          <span className="text-[10px] text-orange-400/70 tabular-nums">{streak}</span>
        </div>
      )}

      {/* Frequency */}
      <span className="text-[10px] text-slate-500 tabular-nums flex-shrink-0 hidden sm:inline">
        {freqLabel}
      </span>
    </div>
  );
});
