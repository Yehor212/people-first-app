import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

/**
 * Animated Habit Button with satisfying press effect
 */
interface AnimatedHabitButtonProps {
  icon: string;
  color: string;
  isCompleted: boolean;
  isAnimating: boolean;
  onClick: () => void;
  label?: string;
}

export function AnimatedHabitButton({
  icon,
  color,
  isCompleted,
  isAnimating,
  onClick,
  label,
}: AnimatedHabitButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label || (isCompleted ? 'Completed' : 'Mark complete')}
      className={cn(
        "relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl motion-safe:transition-all motion-safe:duration-200",
        "btn-press overflow-hidden",
        isCompleted
          ? `${color} text-primary-foreground zen-shadow-soft`
          : "bg-background hover:scale-105 active:scale-95 border-2 border-transparent hover:border-primary/20"
      )}
    >
      {/* Background pulse on complete */}
      {isAnimating && (
        <div className="absolute inset-0 motion-safe:animate-ripple-out">
          <div className={cn("w-full h-full rounded-2xl", color, "opacity-50")} />
        </div>
      )}

      {/* Icon or checkmark */}
      <div className={cn(
        "relative z-10 motion-safe:transition-transform motion-safe:duration-300",
        isAnimating && "motion-safe:animate-habit-icon-complete"
      )}>
        {isCompleted ? (
          <Check
            className={cn(
              "w-7 h-7",
              isAnimating && "motion-safe:animate-check-pop"
            )}
            strokeWidth={3}
          />
        ) : (
          <span className={cn(
            "motion-safe:transition-transform",
            !isCompleted && "hover:scale-110"
          )}>
            {icon}
          </span>
        )}
      </div>

      {/* Completion ring */}
      {isCompleted && (
        <div className="absolute inset-0 rounded-2xl motion-safe:animate-completion-ring">
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
              className="text-white/50 motion-safe:animate-draw-rect"
              strokeDasharray="200"
              strokeDashoffset="200"
            />
          </svg>
        </div>
      )}
    </button>
  );
}
