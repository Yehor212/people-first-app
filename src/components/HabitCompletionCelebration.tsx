import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, Flame, Star, Zap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface HabitCompletionCelebrationProps {
  habitName: string;
  habitIcon: string;
  habitColor: string;
  xpGained?: number;
  streakDays?: number;
  isAllComplete?: boolean;
  onComplete: () => void;
}

export function HabitCompletionCelebration({
  habitName,
  habitIcon,
  habitColor,
  xpGained = 10,
  streakDays,
  isAllComplete,
  onComplete,
}: HabitCompletionCelebrationProps) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<'check' | 'xp' | 'streak' | 'done'>('check');

  useEffect(() => {
    // Phase 1: Checkmark animation
    const timer1 = setTimeout(() => setPhase('xp'), 400);

    // Phase 2: XP popup
    const timer2 = setTimeout(() => {
      if (streakDays && streakDays > 1) {
        setPhase('streak');
      } else {
        setPhase('done');
      }
    }, 1200);

    // Phase 3: Done
    const timer3 = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, streakDays && streakDays > 1 ? 2200 : 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [streakDays, onComplete]);

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[150] pointer-events-none"
      style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Main completion toast */}
      <div
        className={cn(
          "relative flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300",
          habitColor,
          phase === 'check' && "animate-habit-complete-bounce scale-110",
          phase !== 'done' ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {/* Animated checkmark */}
        <div className="relative">
          <div className={cn(
            "w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center",
            phase === 'check' && "animate-check-circle-fill"
          )}>
            <Check className={cn(
              "w-6 h-6 text-white",
              phase === 'check' && "animate-check-draw"
            )} strokeWidth={3} />
          </div>

          {/* Sparkle effects */}
          <div className="absolute -top-1 -right-1 animate-sparkle-burst">
            <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
          </div>
          <div className="absolute -bottom-1 -left-1 animate-sparkle-burst delay-100">
            <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />
          </div>
        </div>

        {/* Habit name */}
        <div className="flex flex-col">
          <span className="text-white font-bold text-base">{habitName}</span>
          <span className="text-white/70 text-xs">{t.completed || 'Completed!'}</span>
        </div>

        {/* XP Popup */}
        <div
          className={cn(
            "absolute -top-8 right-4 flex items-center gap-1 px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full font-bold text-sm shadow-lg",
            phase === 'xp' || phase === 'streak' ? "animate-xp-float-up opacity-100" : "opacity-0 scale-0"
          )}
        >
          <Zap className="w-4 h-4" />
          +{xpGained} XP
        </div>

        {/* Streak indicator */}
        {streakDays && streakDays > 1 && (
          <div
            className={cn(
              "absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full font-bold shadow-lg",
              phase === 'streak' ? "animate-streak-pop opacity-100" : "opacity-0 scale-0"
            )}
          >
            <Flame className="w-5 h-5 animate-flame-flicker" />
            <span>{streakDays} {t.dayStreak || 'day streak'}!</span>
          </div>
        )}
      </div>

      {/* Particle effects */}
      {phase === 'check' && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full animate-particle-burst"
              style={{
                backgroundColor: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB', '#32CD32'][i % 6],
                '--particle-angle': `${i * 30}deg`,
                '--particle-distance': `${40 + Math.random() * 30}px`,
                animationDelay: `${i * 30}ms`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Daily Habits Progress Bar - Shows overall completion for the day
 */
interface DailyProgressBarProps {
  completedCount: number;
  totalCount: number;
  className?: string;
}

export function DailyProgressBar({ completedCount, totalCount, className }: DailyProgressBarProps) {
  const { t } = useLanguage();
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isComplete = completedCount === totalCount && totalCount > 0;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t.todayProgress || "Today's Progress"}
        </span>
        <span className={cn(
          "text-sm font-bold transition-colors",
          isComplete ? "text-mood-good" : "text-foreground"
        )}>
          {completedCount}/{totalCount}
        </span>
      </div>

      <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
        {/* Progress fill */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out",
            isComplete
              ? "bg-gradient-to-r from-mood-good to-emerald-400"
              : "bg-gradient-to-r from-primary to-accent"
          )}
          style={{ width: `${progress}%` }}
        />

        {/* Shimmer effect when complete */}
        {isComplete && (
          <div className="absolute inset-0 animate-shimmer-slide">
            <div className="h-full w-1/4 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>
        )}

        {/* Progress dots */}
        <div className="absolute inset-0 flex items-center justify-around px-1">
          {Array.from({ length: totalCount }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                i < completedCount
                  ? "bg-white/50 scale-100"
                  : "bg-foreground/20 scale-75"
              )}
              style={{ transitionDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Completion message */}
      {isComplete && (
        <div className="mt-2 flex items-center justify-center gap-2 animate-fade-in">
          <span className="text-mood-good text-sm font-medium">
            🎉 {t.allHabitsComplete || 'All habits complete!'}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Animated Habit Button with satisfying press effect
 */
interface AnimatedHabitButtonProps {
  icon: string;
  color: string;
  isCompleted: boolean;
  isAnimating: boolean;
  onClick: () => void;
}

export function AnimatedHabitButton({
  icon,
  color,
  isCompleted,
  isAnimating,
  onClick,
}: AnimatedHabitButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-200",
        "btn-press overflow-hidden",
        isCompleted
          ? `${color} text-primary-foreground zen-shadow-soft`
          : "bg-background hover:scale-105 active:scale-95 border-2 border-transparent hover:border-primary/20"
      )}
    >
      {/* Background pulse on complete */}
      {isAnimating && (
        <div className="absolute inset-0 animate-ripple-out">
          <div className={cn("w-full h-full rounded-2xl", color, "opacity-50")} />
        </div>
      )}

      {/* Icon or checkmark */}
      <div className={cn(
        "relative z-10 transition-transform duration-300",
        isAnimating && "animate-habit-icon-complete"
      )}>
        {isCompleted ? (
          <Check
            className={cn(
              "w-7 h-7",
              isAnimating && "animate-check-pop"
            )}
            strokeWidth={3}
          />
        ) : (
          <span className={cn(
            "transition-transform",
            !isCompleted && "hover:scale-110"
          )}>
            {icon}
          </span>
        )}
      </div>

      {/* Completion ring */}
      {isCompleted && (
        <div className="absolute inset-0 rounded-2xl animate-completion-ring">
          <svg className="w-full h-full" viewBox="0 0 56 56">
            <rect
              x="2"
              y="2"
              width="52"
              height="52"
              rx="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-white/50 animate-draw-rect"
              strokeDasharray="200"
              strokeDashoffset="200"
            />
          </svg>
        </div>
      )}
    </button>
  );
}
