import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateId, getToday } from '@/lib/utils';
import { hapticTap } from '@/lib/haptics';
import type { Goal, GoalType, GoalPeriod, Habit } from '@/types';

interface GoalSuggestionsProps {
  habits: Habit[];
  currentStreak: number;
  existingGoals: Goal[];
  onAdd: (goal: Goal) => void;
  t: Record<string, string>;
}

export function GoalSuggestions({ habits, currentStreak, existingGoals, onAdd, t }: GoalSuggestionsProps) {
  const suggestions = useMemo(() => {
    const result: { type: GoalType; title: string; target: number; period: GoalPeriod; emoji: string }[] = [];
    const existingTypes = new Set(existingGoals.filter(g => g.status === 'active').map(g => g.type));

    if (!existingTypes.has('habit') && habits.length > 0) {
      const target = Math.max(5, habits.length);
      result.push({
        type: 'habit',
        title: `${t.goalCompleteHabits || 'Complete habits'} ${target}`,
        target,
        period: 'week',
        emoji: '🎯',
      });
    }

    if (!existingTypes.has('focus')) {
      result.push({
        type: 'focus',
        title: `${t.goalFocusTime || 'Focus time'} 120 ${t.minuteShort || 'm'}`,
        target: 120,
        period: 'week',
        emoji: '🧠',
      });
    }

    if (!existingTypes.has('streak') && currentStreak > 0) {
      const target = currentStreak < 7 ? 7 : currentStreak < 14 ? 14 : 30;
      result.push({
        type: 'streak',
        title: `${t.goalMaintainStreak || 'Maintain streak'} ${target}`,
        target,
        period: 'week',
        emoji: '🔥',
      });
    }

    return result.slice(0, 2);
  }, [habits, currentStreak, existingGoals, t]);

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Zap className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-medium text-muted-foreground">
          {t.suggestedGoals || 'Suggested'}
        </span>
      </div>
      {suggestions.map((s, i) => (
        <motion.button
          key={`${s.type}-${i}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          onClick={() => {
            void hapticTap();
            onAdd({
              id: generateId(),
              type: s.type,
              target: s.target,
              period: s.period,
              title: s.title,
              createdAt: getToday(),
              status: 'active',
            });
          }}
          className={cn(
            'w-full flex items-center gap-3 p-3 rounded-xl',
            'border border-dashed border-border/60 hover:border-primary/40',
            'hover:bg-muted/30 motion-safe:transition-all text-start group',
          )}
        >
          <span className="text-lg">{s.emoji}</span>
          <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground motion-safe:transition-colors">
            {s.title}
          </span>
          <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary motion-safe:transition-colors" />
        </motion.button>
      ))}
    </div>
  );
}
