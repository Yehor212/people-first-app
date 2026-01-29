/**
 * StatCard - Compact stat display card for home screen
 * Part of v1.3.0 UI redesign - "Clean & Focused"
 */

import { cn } from '@/lib/utils';
import { LucideIcon, Target, Timer, Sparkles } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  color?: 'primary' | 'emerald' | 'violet' | 'amber' | 'pink';
  className?: string;
}

const COLOR_STYLES = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
} as const;

export function StatCard({ icon: Icon, value, label, color = 'primary', className }: StatCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-3 rounded-xl border transition-all',
        COLOR_STYLES[color],
        className
      )}
    >
      <Icon className="w-5 h-5 mb-1 opacity-80" />
      <span className="text-lg font-bold leading-tight">{value}</span>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
    </div>
  );
}

interface QuickStatsRowProps {
  habitsCompleted: number;
  habitsTotal: number;
  focusMinutes: number;
  level: number;
  xp?: number;
  xpForNextLevel?: number;
  className?: string;
  labels: {
    habits: string;
    focus: string;
    level: string;
  };
}

export function QuickStatsRow({
  habitsCompleted,
  habitsTotal,
  focusMinutes,
  level,
  className,
  labels,
}: QuickStatsRowProps) {
  // Format focus time nicely
  const formatFocusTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      <StatCard
        icon={Target}
        value={`${habitsCompleted}/${habitsTotal}`}
        label={labels.habits}
        color="emerald"
      />
      <StatCard
        icon={Timer}
        value={formatFocusTime(focusMinutes)}
        label={labels.focus}
        color="violet"
      />
      <StatCard
        icon={Sparkles}
        value={level}
        label={labels.level}
        color="amber"
      />
    </div>
  );
}
