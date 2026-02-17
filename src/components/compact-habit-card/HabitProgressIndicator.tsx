/**
 * HabitProgressIndicator - Right-side progress indicator for habit cards
 * Extracted from CompactHabitCard (v1.3.0 Premium Phase 8)
 *
 * Renders 4 variants: reduce / multiple / continuous / daily
 */

import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
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
      {habitType === 'reduce' ? (
        // Reduce type: counter with +/- buttons - Premium styling
        <div className="flex items-center gap-1.5">
          <motion.button
            onClick={() => onAdjust?.(habitId, today, -1)}
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
            onClick={() => onAdjust?.(habitId, today, 1)}
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
            onClick={() => onAdjust?.(habitId, today, -1)}
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
            onClick={() => onAdjust?.(habitId, today, 1)}
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
  );
}
