import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface DailyProgressBarProps {
  completedCount: number;
  totalCount: number;
  className?: string;
}

/**
 * Daily Habits Progress Bar - Shows overall completion for the day
 */
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
          "text-sm font-bold motion-safe:transition-colors",
          isComplete ? "text-mood-good" : "text-foreground"
        )}>
          {completedCount}/{totalCount}
        </span>
      </div>

      <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
        {/* Progress fill */}
        <div
          className={cn(
            "absolute inset-y-0 start-0 rounded-full motion-safe:transition-all motion-safe:duration-500 ease-out",
            isComplete
              ? "bg-gradient-to-r from-mood-good to-emerald-400"
              : "bg-gradient-to-r from-primary to-accent"
          )}
          style={{ width: `${progress}%` }}
        />

        {/* Shimmer effect when complete */}
        {isComplete && (
          <div className="absolute inset-0 motion-safe:animate-shimmer-slide">
            <div className="h-full w-1/4 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>
        )}

        {/* Progress dots */}
        <div className="absolute inset-0 flex items-center justify-around px-1">
          {Array.from({ length: totalCount }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full motion-safe:transition-all motion-safe:duration-300",
                i < completedCount
                  ? "bg-foreground/50 scale-100"
                  : "bg-foreground/20 scale-75"
              )}
              style={{ transitionDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Completion message */}
      {isComplete && (
        <div className="mt-2 flex items-center justify-center gap-2 motion-safe:animate-fade-in">
          <span className="text-mood-good text-sm font-medium">
            🎉 {t.allHabitsComplete || 'All habits complete!'}
          </span>
        </div>
      )}
    </div>
  );
}
