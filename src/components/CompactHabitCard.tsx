/**
 * CompactHabitCard - Premium compact habit card with glassmorphism
 * Part of v1.3.0 UI redesign → Phase 8 Premium Upgrade
 */

import { Habit } from '@/types';
import { cn, getToday } from '@/lib/utils';
import { Check, Minus, Plus, Flame, Trash2, Users } from 'lucide-react';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressRing, ProgressRingCompact } from './ui/progress-ring';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticTap } from '@/lib/haptics';

interface CompactHabitCardProps {
  habit: Habit;
  onToggle: (habitId: string, date: string) => void;
  onAdjust?: (habitId: string, date: string, delta: number) => void;
  onDelete: (habitId: string) => void;
  onChallenge?: (habit: Habit) => void;
  streak?: number;
  className?: string;
}

export function CompactHabitCard({
  habit,
  onToggle,
  onAdjust,
  onDelete,
  onChallenge,
  streak = 0,
  className,
}: CompactHabitCardProps) {
  const { t } = useLanguage();
  const today = getToday();
  const [isSwiped, setIsSwiped] = useState(false);
  const touchStartX = useRef(0);

  const habitType = habit.type || 'daily';

  // Calculate completion status and progress
  const getProgress = (): { completed: boolean; progress: number; target: number } => {
    if (habitType === 'reduce') {
      const current = habit.progressByDate?.[today] ?? 0;
      return { completed: current === 0, progress: current, target: 0 };
    }

    if (habitType === 'multiple') {
      const current = habit.completionsByDate?.[today] ?? 0;
      const target = habit.dailyTarget ?? 1;
      return { completed: current >= target, progress: current, target };
    }

    if (habitType === 'continuous') {
      const failedToday = habit.failedDates?.includes(today);
      return { completed: !failedToday, progress: habit.completedDates?.length ?? 0, target: 0 };
    }

    // Daily/Scheduled
    const completed = habit.completedDates?.includes(today) ?? false;
    return { completed, progress: completed ? 1 : 0, target: 1 };
  };

  const { completed, progress, target } = getProgress();
  const progressPercent = target > 0 ? (progress / target) * 100 : completed ? 100 : 0;

  // Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) {
      setIsSwiped(true);
    } else if (diff < -50) {
      setIsSwiped(false);
    }
  };

  const handleToggle = () => {
    hapticTap();
    onToggle(habit.id, today);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      role="listitem"
      aria-label={`${habit.icon} ${habit.name}${completed ? `, ${t.completed || 'completed'}` : ''}`}
      aria-checked={completed}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'shadow-[0_4px_12px_-2px_hsl(var(--foreground)/0.05)]',
        completed && 'ring-2 ring-[hsl(var(--mood-good))]/30',
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Actions (revealed on swipe) */}
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 flex items-center transition-all duration-200',
          isSwiped ? 'w-28' : 'w-0'
        )}
      >
        {/* Challenge button */}
        {onChallenge && (
          <button
            onClick={() => {
              hapticTap();
              onChallenge(habit);
              setIsSwiped(false);
            }}
            className="flex-1 h-full flex items-center justify-center bg-primary text-white active:opacity-80 transition-opacity"
            aria-label={t.createChallenge}
          >
            <Users className="w-5 h-5" />
          </button>
        )}
        {/* Delete button */}
        <button
          onClick={() => {
            onDelete(habit.id);
            setIsSwiped(false);
          }}
          className="flex-1 h-full flex items-center justify-center bg-destructive text-white active:opacity-80 transition-opacity"
          aria-label={t.delete}
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Completion glow effect */}
      <AnimatePresence>
        {completed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--mood-good))]/10 to-transparent pointer-events-none z-0"
          />
        )}
      </AnimatePresence>

      {/* Main card */}
      <div
        className={cn(
          'relative flex items-center justify-between p-4',
          'bg-card/80 backdrop-blur-sm rounded-2xl',
          'border border-border/50 transition-all duration-300',
          isSwiped && (onChallenge ? '-translate-x-28' : '-translate-x-14'),
          completed && 'bg-[hsl(var(--mood-good))]/5 border-[hsl(var(--mood-good))]/20'
        )}
      >
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Habit Icon Button - Premium styling */}
          <button
            onClick={handleToggle}
            aria-label={`${habit.name}: ${completed ? t.completed : t.markComplete || 'Mark complete'}`}
            aria-pressed={completed}
            className={cn(
              'w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0',
              'transition-all duration-300 active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              completed
                ? 'bg-[hsl(var(--mood-good))] text-white shadow-lg shadow-[hsl(var(--mood-good))]/25 scale-105'
                : 'bg-muted/50 hover:bg-muted/80'
            )}
          >
            {completed ? (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Check className="w-7 h-7" strokeWidth={3} />
              </motion.div>
            ) : (
              <span>{habit.icon}</span>
            )}
          </button>

          {/* Name + Streak - Premium styling */}
          <div className="flex flex-col min-w-0">
            <p className={cn(
              'font-semibold text-base truncate transition-colors duration-300',
              completed ? 'text-[hsl(var(--mood-good))]' : 'text-foreground'
            )}>
              {habit.name}
            </p>
            {streak > 1 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1.5 mt-0.5"
              >
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  {streak} {t.dayStreak || t.days}
                </span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right: Progress indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {habitType === 'reduce' ? (
            // Reduce type: counter with +/- buttons
            <div className="flex items-center gap-1">
              <button
                onClick={() => onAdjust?.(habit.id, today, -1)}
                aria-label={t.decrease || 'Decrease'}
                className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg bg-mood-good/20 flex items-center justify-center text-mood-good hover:bg-mood-good/30 dark:hover:bg-mood-good/40 transition-colors active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className={cn(
                'w-8 text-center font-bold',
                progress === 0 ? 'text-mood-good' : 'text-foreground'
              )}>
                {progress}
              </span>
              <button
                onClick={() => onAdjust?.(habit.id, today, 1)}
                aria-label={t.increase || 'Increase'}
                className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:bg-muted dark:hover:bg-muted/80 transition-colors active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          ) : habitType === 'multiple' ? (
            // Multiple type: progress ring with count
            <div className="flex items-center gap-2">
              <ProgressRing
                progress={progressPercent}
                size="sm"
                color={completed ? 'success' : 'primary'}
              />
              <span className="text-sm font-medium text-muted-foreground">
                {progress}/{target}
              </span>
            </div>
          ) : habitType === 'continuous' ? (
            // Continuous: days count
            <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 rounded-lg">
              <span className="font-bold text-primary">{progress}</span>
              <span className="text-xs text-muted-foreground">{t.days}</span>
            </div>
          ) : (
            // Daily/Scheduled: simple check or ring
            <ProgressRingCompact
              progress={progressPercent}
              completed={completed}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
