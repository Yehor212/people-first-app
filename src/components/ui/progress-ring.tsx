import { cn } from '@/lib/utils';

interface ProgressRingProps {
  progress: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  strokeWidth?: number;
  className?: string;
  color?: 'primary' | 'accent' | 'success' | 'warning';
}

const SIZES = {
  sm: { size: 32, stroke: 3, fontSize: 'text-[10px]' },
  md: { size: 44, stroke: 4, fontSize: 'text-xs' },
  lg: { size: 56, stroke: 5, fontSize: 'text-sm' },
} as const;

const COLORS = {
  primary: 'stroke-primary',
  accent: 'stroke-accent',
  success: 'stroke-mood-great',
  warning: 'stroke-mood-okay',
} as const;

export function ProgressRing({
  progress,
  size = 'md',
  showPercentage = false,
  strokeWidth,
  className,
  color = 'primary',
}: ProgressRingProps) {
  const config = SIZES[size];
  const actualStroke = strokeWidth ?? config.stroke;
  const radius = (config.size - actualStroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const offset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={config.size}
        height={config.size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          strokeWidth={actualStroke}
          className="stroke-secondary"
        />
        {/* Progress circle */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          strokeWidth={actualStroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            COLORS[color],
            'transition-all duration-300 ease-out'
          )}
        />
      </svg>
      {showPercentage && (
        <span className={cn(
          'absolute font-semibold text-foreground',
          config.fontSize
        )}>
          {Math.round(clampedProgress)}%
        </span>
      )}
    </div>
  );
}

// Compact version for inline use
export function ProgressRingCompact({
  progress,
  completed,
  className,
}: {
  progress: number;
  completed?: boolean;
  className?: string;
}) {
  if (completed) {
    return (
      <div className={cn(
        'w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center',
        className
      )}>
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  return (
    <ProgressRing
      progress={progress}
      size="sm"
      color={progress >= 100 ? 'success' : 'primary'}
      className={className}
    />
  );
}
