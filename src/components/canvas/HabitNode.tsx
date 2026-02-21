/**
 * HabitNode — Individual habit orbiting its identity cluster.
 */

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { IdentityIcon } from '@/components/IdentityIconPicker';
import type { Habit } from '@/types';

interface HabitNodeProps {
  habit: Habit;
  x: number;
  y: number;
  radius: number;
  completed: boolean;
  onToggle: () => void;
}

export function HabitNode({ habit, x, y, radius, completed, onToggle }: HabitNodeProps) {
  const size = radius * 2;

  return (
    <button
      onClick={() => {
        void haptics.success();
        onToggle();
      }}
      className="absolute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
      style={{
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
      }}
      aria-label={`${habit.name}${completed ? ' (done)' : ''}`}
    >
      <div className={cn(
        'w-full h-full rounded-full',
        'bg-surface-glass backdrop-blur-[var(--surface-glass-blur)]',
        'border-2 transition-colors',
        completed
          ? 'border-emerald-500/60'
          : 'border-[var(--surface-glass-border)]',
        'flex items-center justify-center relative',
      )}>
        {completed ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <IdentityIcon name={habit.icon || 'Target'} className="w-3.5 h-3.5 text-foreground/60" />
        )}
      </div>
    </button>
  );
}
