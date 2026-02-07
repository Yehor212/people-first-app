/**
 * CompactHabitCard - Premium compact habit card with glassmorphism
 * Part of v1.3.0 UI redesign → Phase 8 Premium Upgrade
 * Enhanced with Nature Energy theme glow effects and animated fire streaks
 */

import { Habit } from '@/types';
import { cn, getToday } from '@/lib/utils';
import { Check, Minus, Plus, Trash2, Users, Star, Crown, Zap, Pencil } from 'lucide-react';
import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressRing, ProgressRingCompact } from './ui/progress-ring';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticTap } from '@/lib/haptics';

// Animated Fire component for streak display
function AnimatedFire({ intensity = 1, size = 'sm' }: { intensity?: number; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';

  // Intensity affects glow and animation speed
  const glowIntensity = Math.min(intensity, 3);
  const animationDuration = Math.max(0.3, 0.6 - intensity * 0.1);

  return (
    <motion.div
      className="relative"
      animate={{
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: animationDuration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {/* Glow layer */}
      <motion.div
        className="absolute inset-0 rounded-full blur-sm"
        style={{
          background: `radial-gradient(circle, rgba(249, 115, 22, ${0.3 * glowIntensity}) 0%, transparent 70%)`,
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: animationDuration * 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* Fire SVG */}
      <svg className={cn(sizeClass, 'relative z-10')} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id="fireGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        <motion.path
          d="M12 2C12 2 8 6 8 10C8 12 10 14 12 14C14 14 16 12 16 10C16 6 12 2 12 2Z"
          fill="url(#fireGradient)"
          animate={{
            d: [
              "M12 2C12 2 8 6 8 10C8 12 10 14 12 14C14 14 16 12 16 10C16 6 12 2 12 2Z",
              "M12 1C12 1 7 5 7 10C7 13 10 15 12 15C14 15 17 13 17 10C17 5 12 1 12 1Z",
              "M12 2C12 2 8 6 8 10C8 12 10 14 12 14C14 14 16 12 16 10C16 6 12 2 12 2Z",
            ],
          }}
          transition={{
            duration: animationDuration * 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.path
          d="M12 6C12 6 10 8 10 10C10 11 11 12 12 12C13 12 14 11 14 10C14 8 12 6 12 6Z"
          fill="#fef3c7"
          animate={{
            d: [
              "M12 6C12 6 10 8 10 10C10 11 11 12 12 12C13 12 14 11 14 10C14 8 12 6 12 6Z",
              "M12 5C12 5 9 7 9 10C9 11.5 11 13 12 13C13 13 15 11.5 15 10C15 7 12 5 12 5Z",
              "M12 6C12 6 10 8 10 10C10 11 11 12 12 12C13 12 14 11 14 10C14 8 12 6 12 6Z",
            ],
          }}
          transition={{
            duration: animationDuration * 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </svg>
    </motion.div>
  );
}

// Milestone badge for streaks
function StreakMilestoneBadge({ streak }: { streak: number }) {
  // Determine milestone
  if (streak >= 100) {
    return (
      <motion.div
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <Crown className="w-3 h-3 text-white" />
        <span className="text-[10px] font-bold text-white">100+</span>
      </motion.div>
    );
  }

  if (streak >= 30) {
    return (
      <motion.div
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <Star className="w-3 h-3 text-white" />
        <span className="text-[10px] font-bold text-white">30+</span>
      </motion.div>
    );
  }

  if (streak >= 7) {
    return (
      <motion.div
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <Zap className="w-3 h-3 text-white" />
        <span className="text-[10px] font-bold text-white">7+</span>
      </motion.div>
    );
  }

  return null;
}

interface CompactHabitCardProps {
  habit: Habit;
  onToggle: (habitId: string, date: string) => void;
  onAdjust?: (habitId: string, date: string, delta: number) => void;
  onDelete: (habitId: string) => void;
  onEdit?: (habit: Habit) => void;
  onChallenge?: (habit: Habit) => void;
  streak?: number;
  className?: string;
}

export function CompactHabitCard({
  habit,
  onToggle,
  onAdjust,
  onDelete,
  onEdit,
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

  // Calculate fire intensity based on streak
  const fireIntensity = useMemo(() => {
    if (streak >= 100) return 3;
    if (streak >= 30) return 2.5;
    if (streak >= 7) return 2;
    if (streak >= 3) return 1.5;
    return 1;
  }, [streak]);

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
        completed && 'ring-2 ring-emerald-500/40',
        className
      )}
      style={completed ? {
        boxShadow: '0 0 20px rgba(16, 185, 129, 0.15), 0 4px 12px -2px rgba(0, 0, 0, 0.05)',
      } : undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Actions (revealed on swipe) */}
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 flex items-center transition-all duration-200',
          isSwiped ? (onChallenge ? 'w-[10.5rem]' : 'w-28') : 'w-0'
        )}
      >
        {/* Edit button */}
        {onEdit && (
          <button
            onClick={() => {
              hapticTap();
              onEdit(habit);
              setIsSwiped(false);
            }}
            className="flex-1 h-full flex items-center justify-center bg-blue-500 text-white active:opacity-80 transition-opacity"
            aria-label={t.edit || 'Edit'}
          >
            <Pencil className="w-5 h-5" />
          </button>
        )}
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

      {/* Premium completion glow effect */}
      <AnimatePresence>
        {completed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-0"
          >
            {/* Main gradient glow */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(20, 184, 166, 0.08) 50%, transparent 100%)',
              }}
            />
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%)',
              }}
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
                ease: 'linear',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main card */}
      <div
        className={cn(
          'relative flex items-center justify-between p-4',
          'bg-card/80 backdrop-blur-sm rounded-2xl',
          'border border-border/50 transition-all duration-300',
          isSwiped && (onChallenge ? '-translate-x-[10.5rem]' : '-translate-x-28'),
          completed && 'bg-[hsl(var(--mood-good))]/5 border-[hsl(var(--mood-good))]/20'
        )}
      >
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Habit Icon Button - Premium styling */}
          <motion.button
            onClick={handleToggle}
            aria-label={`${habit.name}: ${completed ? (t.completed || 'Completed') : (t.markComplete || 'Mark complete')}`}
            aria-pressed={completed}
            className={cn(
              'relative w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0',
              'transition-all duration-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              completed
                ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white'
                : 'bg-muted/50 hover:bg-muted/80'
            )}
            style={completed ? {
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.4), 0 4px 8px rgba(0, 0, 0, 0.1)',
            } : undefined}
            whileHover={{ scale: completed ? 1.05 : 1.02 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Inner glow for completed */}
            {completed && (
              <motion.div
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, transparent 70%)',
                }}
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}
            {completed ? (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="relative z-10"
              >
                <Check className="w-7 h-7" strokeWidth={3} />
              </motion.div>
            ) : (
              <span>{habit.icon}</span>
            )}
          </motion.button>

          {/* Name + Streak - Premium styling */}
          <div className="flex flex-col min-w-0">
            <p className={cn(
              'font-semibold text-base truncate transition-colors duration-300',
              completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
            )}>
              {habit.name}
            </p>
            {streak > 1 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 mt-0.5"
              >
                <div className="flex items-center gap-1">
                  <AnimatedFire intensity={fireIntensity} size="sm" />
                  <span
                    className={cn(
                      'text-xs font-bold',
                      streak >= 100 ? 'text-amber-500' :
                      streak >= 30 ? 'text-violet-500' :
                      streak >= 7 ? 'text-emerald-500' :
                      'text-orange-500'
                    )}
                  >
                    {streak}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.dayStreak || t.days}
                  </span>
                </div>
                <StreakMilestoneBadge streak={streak} />
              </motion.div>
            )}
          </div>
        </div>

        {/* Right: Progress indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {habitType === 'reduce' ? (
            // Reduce type: counter with +/- buttons - Premium styling
            <div className="flex items-center gap-1.5">
              <motion.button
                onClick={() => onAdjust?.(habit.id, today, -1)}
                aria-label={t.decrease || 'Decrease'}
                className={cn(
                  "w-12 h-12 min-w-[48px] min-h-[48px] rounded-lg flex items-center justify-center",
                  "transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
                  "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400",
                  "hover:from-emerald-500/30 hover:to-teal-500/30"
                )}
                style={{ boxShadow: '0 0 8px rgba(16, 185, 129, 0.15)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Minus className="w-5 h-5" />
              </motion.button>
              <motion.span
                className={cn(
                  'w-10 text-center font-bold text-lg',
                  progress === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                )}
                key={progress}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                {progress}
              </motion.span>
              <motion.button
                onClick={() => onAdjust?.(habit.id, today, 1)}
                aria-label={t.increase || 'Increase'}
                className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="w-5 h-5" />
              </motion.button>
            </div>
          ) : habitType === 'multiple' ? (
            // Multiple type: progress ring with +/- buttons
            <div className="flex items-center gap-1.5">
              <motion.button
                onClick={() => onAdjust?.(habit.id, today, -1)}
                aria-label={t.decrease || 'Decrease'}
                className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Minus className="w-5 h-5" />
              </motion.button>
              <div className="flex flex-col items-center w-12 justify-center">
                <ProgressRing
                  progress={progressPercent}
                  size="sm"
                  color={completed ? 'success' : 'primary'}
                />
                <span className="text-[10px] font-medium text-muted-foreground mt-0.5">
                  {progress}/{target}
                </span>
              </div>
              <motion.button
                onClick={() => onAdjust?.(habit.id, today, 1)}
                aria-label={t.increase || 'Increase'}
                className={cn(
                  "w-12 h-12 min-w-[48px] min-h-[48px] rounded-lg flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
                  "bg-gradient-to-br from-primary/20 to-primary/10 text-primary hover:from-primary/30 hover:to-primary/20"
                )}
                style={{ boxShadow: '0 0 8px hsl(var(--primary) / 0.15)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="w-5 h-5" />
              </motion.button>
            </div>
          ) : habitType === 'continuous' ? (
            // Continuous: days count - Premium styling
            <motion.div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)',
                boxShadow: completed ? '0 0 12px rgba(139, 92, 246, 0.2)' : undefined,
              }}
              whileHover={{ scale: 1.02 }}
            >
              <span className="font-bold text-violet-600 dark:text-violet-400">{progress}</span>
              <span className="text-xs text-muted-foreground">{t.days}</span>
            </motion.div>
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
