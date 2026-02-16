import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Target, Plus, Check } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useLanguage } from '@/contexts/LanguageContext';
import { useScrollLock } from '@/hooks/useScrollLock';
import { cn, getToday } from '@/lib/utils';
import { hapticTap } from '@/lib/haptics';
import type { GoalsPanelProps } from './types';
import { calculateGoalProgress } from './types';
import { PremiumGoalCard } from './PremiumGoalCard';
import { GoalSuggestions } from './GoalSuggestions';
import { AddGoalSheet } from './AddGoalSheet';

export function GoalsPanel({
  goals,
  habits,
  moods,
  focusSessions,
  currentStreak,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
}: GoalsPanelProps) {
  const { t } = useLanguage();
  const [showAddSheet, setShowAddSheet] = useState(false);
  useScrollLock(showAddSheet);

  const goalsWithProgress = useMemo(() => {
    return goals.map((goal) => ({
      goal,
      progress: calculateGoalProgress(goal, habits, moods, focusSessions, currentStreak),
    }));
  }, [goals, habits, moods, focusSessions, currentStreak]);

  const activeGoals = goalsWithProgress.filter(g => g.goal.status === 'active');
  const completedGoals = goalsWithProgress.filter(g => g.goal.status === 'completed');

  const handleComplete = useCallback((goal: Parameters<GoalsPanelProps['onUpdateGoal']>[0]) => {
    void hapticTap();
    onUpdateGoal({ ...goal, status: 'completed', completedAt: getToday() });
  }, [onUpdateGoal]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-bold text-foreground">
            {t.personalGoals || 'Personal Goals'}
          </h3>
          {activeGoals.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {activeGoals.length}
            </span>
          )}
        </div>

        <button
          onClick={() => { void hapticTap(); setShowAddSheet(true); }}
          className={cn(
            'p-2 rounded-xl transition-all',
            'bg-gradient-to-br from-primary/10 to-accent/5',
            'hover:from-primary/20 hover:to-accent/10',
            'active:scale-95',
          )}
          aria-label={t.addGoal || 'Add Goal'}
        >
          <Plus className="w-4 h-4 text-primary" />
        </button>
      </div>

      {/* Active Goals */}
      <AnimatePresence mode="popLayout">
        {activeGoals.map(({ goal, progress }) => (
          <PremiumGoalCard
            key={goal.id}
            goal={goal}
            progress={progress}
            onComplete={() => handleComplete(goal)}
            onDelete={() => {
              void hapticTap();
              onDeleteGoal(goal.id);
            }}
            t={t as unknown as Record<string, string>}
          />
        ))}
      </AnimatePresence>

      {/* Empty State */}
      {activeGoals.length === 0 && (
        <EmptyState
          icon={<Target className="w-6 h-6 text-primary" />}
          title={t.noGoalsYet || 'No goals yet'}
          message={t.setGoalHint || 'Set a goal to track your progress'}
          size="compact"
          action={{
            label: t.addGoal || 'Add Goal',
            onClick: () => { void hapticTap(); setShowAddSheet(true); },
            icon: <Plus className="w-4 h-4" />,
          }}
        />
      )}

      {/* Smart Suggestions */}
      {activeGoals.length < 3 && (
        <GoalSuggestions
          habits={habits}
          currentStreak={currentStreak}
          existingGoals={goals}
          onAdd={onAddGoal}
          t={t as unknown as Record<string, string>}
        />
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="pt-3 border-t border-border/40">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
            {t.completedGoals || 'Completed'} ({completedGoals.length})
          </p>
          <div className="space-y-1.5">
            {completedGoals.slice(0, 3).map(({ goal }) => (
              <div
                key={goal.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-500/5"
              >
                <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span className="text-sm text-muted-foreground truncate">{goal.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Goal Sheet */}
      <AddGoalSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        habits={habits}
        onAdd={onAddGoal}
        t={t as unknown as Record<string, string>}
      />
    </div>
  );
}
