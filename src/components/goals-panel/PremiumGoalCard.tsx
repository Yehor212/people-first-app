import { motion } from 'framer-motion';
import { Check, X, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticTap } from '@/lib/haptics';
import type { Goal, GoalType } from '@/types';
import { GOAL_THEMES } from './types';
import { ProgressRing } from './ProgressRing';

interface PremiumGoalCardProps {
  goal: Goal;
  progress: { current: number; target: number; percent: number };
  onComplete: () => void;
  onDelete: () => void;
  t: Record<string, string>;
}

export function PremiumGoalCard({ goal, progress, onComplete, onDelete, t }: PremiumGoalCardProps) {
  const theme = GOAL_THEMES[goal.type];
  const Icon = theme.icon;
  const isComplete = progress.percent >= 100 || goal.status === 'completed';

  const formatValue = (type: GoalType, value: number) => {
    switch (type) {
      case 'focus': return `${value}${t.minuteShort || 'm'}`;
      case 'mood': return value.toFixed(1);
      default: return value.toString();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/40',
        'bg-card backdrop-blur-sm transition-all',
        isComplete && 'ring-1 ring-emerald-500/40',
      )}
      style={isComplete ? {
        boxShadow: '0 0 24px rgba(16, 185, 129, 0.15)',
      } : undefined}
    >
      {/* Subtle gradient background */}
      <div className={cn(
        'absolute inset-0 opacity-60',
        `bg-gradient-to-br ${theme.bgGradient}`,
      )} />

      {/* Completion sparkles */}
      {isComplete && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[0, 0.3, 0.6, 0.9, 1.2].map((delay, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-emerald-400"
              style={{
                left: `${15 + i * 18}%`,
                top: `${20 + (i % 3) * 25}%`,
              }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: 2,
                delay,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative p-4 flex items-center gap-4">
        {/* Progress Ring */}
        <ProgressRing
          percent={progress.percent}
          color={isComplete ? '#10b981' : theme.ringColor}
          glowColor={isComplete ? 'rgba(16, 185, 129, 0.4)' : theme.glowColor}
        >
          {isComplete ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500 }}
            >
              <Check className="w-5 h-5 text-emerald-500" />
            </motion.div>
          ) : (
            <span className="text-xs font-bold text-foreground">
              {Math.round(progress.percent)}%
            </span>
          )}
        </ProgressRing>

        {/* Goal info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Icon className={cn('w-3.5 h-3.5', isComplete ? 'text-emerald-500' : `text-[${theme.ringColor}]`)} style={{ color: isComplete ? undefined : theme.ringColor }} />
            <h4 className="font-semibold text-sm text-foreground truncate">{goal.title}</h4>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              'bg-muted/50 text-muted-foreground',
            )}>
              {goal.period === 'week' ? (t.thisWeek || 'This week') : (t.thisMonth || 'This month')}
            </span>
            <span className={cn(
              'text-xs font-bold',
              isComplete ? 'text-emerald-500' : 'text-muted-foreground',
            )}>
              {formatValue(goal.type, progress.current)}/{formatValue(goal.type, progress.target)}
            </span>
          </div>
        </div>

        {/* Action */}
        {isComplete && goal.status !== 'completed' ? (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={() => { void hapticTap(); onComplete(); }}
            aria-label={t.claimReward || 'Claim reward'}
            className={cn(
              'p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center',
              'bg-gradient-to-br from-emerald-400 to-teal-500',
              'text-white shadow-lg active:scale-95 transition-transform',
            )}
            style={{ boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)' }}
          >
            <Trophy className="w-4 h-4" />
          </motion.button>
        ) : !isComplete ? (
          <button
            onClick={() => onDelete()}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-destructive/10 transition-colors"
            aria-label={t.delete || 'Delete'}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
