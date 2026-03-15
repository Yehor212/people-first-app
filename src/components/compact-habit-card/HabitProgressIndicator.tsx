/**
 * HabitProgressIndicator - Right-side progress indicator for habit cards
 * Extracted from CompactHabitCard (v1.3.0 Premium Phase 8)
 *
 * Renders 2 variants: boolean (check ring) / numerical (+/- with progress ring)
 */

import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { zenTap } from '@/lib/animationUtils';
import { ProgressRing, ProgressRingCompact } from '@/components/ui/progress-ring';

export interface HabitProgressIndicatorProps {
  habitType: string;
  progress: number;
  target: number;
  progressPercent: number;
  completed: boolean;
  habitId: string;
  today: string;
  onAdjust?: (habitId: string, date: string, delta: number) => void;
  t: Record<string, string>;
}

export function HabitProgressIndicator({
  habitType,
  progress,
  target,
  progressPercent,
  completed,
  habitId,
  today,
  onAdjust,
  t,
}: HabitProgressIndicatorProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {habitType === 'numerical' ? (
        // Numerical type: progress ring with +/- buttons
        <div className="flex items-center gap-1.5">
          <motion.button
            onClick={() => onAdjust?.(habitId, today, -1)}
            aria-label={t.decrease || 'Decrease'}
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
            whileHover={{ scale: 1.05 }}
            whileTap={zenTap.button}
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
            onClick={() => onAdjust?.(habitId, today, 1)}
            aria-label={t.increase || 'Increase'}
            className={cn(
              "w-12 h-12 min-w-[48px] min-h-[48px] rounded-lg flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
              "bg-gradient-to-br from-primary/20 to-primary/10 text-primary hover:from-primary/30 hover:to-primary/20",
              "shadow-[0_0_8px_hsl(var(--primary)/0.15)]"
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={zenTap.button}
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>
      ) : (
        // Boolean: simple check or ring
        <ProgressRingCompact
          progress={progressPercent}
          completed={completed}
        />
      )}
    </div>
  );
}
