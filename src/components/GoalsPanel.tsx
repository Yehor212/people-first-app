/**
 * GoalsPanel - Personal Goals Management
 *
 * Allows users to set and track weekly/monthly goals for:
 * - Habit completion (e.g., complete habit 6/7 days)
 * - Focus time (e.g., 120 minutes this week)
 * - Mood average (e.g., maintain 4+ mood)
 * - Streaks (e.g., 7-day streak)
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, Check, X, Flame, Brain, Heart, Calendar, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Goal, GoalType, GoalPeriod, Habit, MoodEntry, FocusSession } from '@/types';
import { generateId, getToday } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GoalsPanelProps {
  goals: Goal[];
  habits: Habit[];
  moods: MoodEntry[];
  focusSessions: FocusSession[];
  currentStreak: number;
  onAddGoal: (goal: Goal) => void;
  onUpdateGoal: (goal: Goal) => void;
  onDeleteGoal: (goalId: string) => void;
}

const GOAL_ICONS: Record<GoalType, typeof Target> = {
  habit: Calendar,
  focus: Brain,
  mood: Heart,
  streak: Flame,
};

const GOAL_COLORS: Record<GoalType, string> = {
  habit: 'text-emerald-500',
  focus: 'text-violet-500',
  mood: 'text-pink-500',
  streak: 'text-orange-500',
};

const GOAL_BG_COLORS: Record<GoalType, string> = {
  habit: 'bg-emerald-500/10 border-emerald-500/30',
  focus: 'bg-violet-500/10 border-violet-500/30',
  mood: 'bg-pink-500/10 border-pink-500/30',
  streak: 'bg-orange-500/10 border-orange-500/30',
};

// Calculate current progress for a goal
function calculateGoalProgress(
  goal: Goal,
  habits: Habit[],
  moods: MoodEntry[],
  focusSessions: FocusSession[],
  currentStreak: number
): { current: number; target: number; percent: number } {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const periodStart = goal.period === 'week' ? startOfWeek : startOfMonth;
  const periodStartStr = periodStart.toISOString().split('T')[0];

  let current = 0;

  switch (goal.type) {
    case 'habit': {
      if (goal.habitId) {
        const habit = habits.find(h => h.id === goal.habitId);
        if (habit) {
          current = (habit.completedDates || []).filter(d => d >= periodStartStr).length;
        }
      } else {
        // Total habit completions this period
        current = habits.reduce((sum, h) => {
          return sum + (h.completedDates || []).filter(d => d >= periodStartStr).length;
        }, 0);
      }
      break;
    }
    case 'focus': {
      current = focusSessions
        .filter(s => s.date >= periodStartStr)
        .reduce((sum, s) => sum + s.duration, 0);
      break;
    }
    case 'mood': {
      const periodMoods = moods.filter(m => {
        const moodDate = new Date(m.timestamp).toISOString().split('T')[0];
        return moodDate >= periodStartStr;
      });
      if (periodMoods.length > 0) {
        const moodValues: Record<string, number> = {
          terrible: 1, bad: 2, okay: 3, good: 4, great: 5
        };
        const avg = periodMoods.reduce((sum, m) => sum + (moodValues[m.mood] || 3), 0) / periodMoods.length;
        current = Math.round(avg * 10) / 10;
      }
      break;
    }
    case 'streak': {
      current = currentStreak;
      break;
    }
  }

  const percent = Math.min((current / goal.target) * 100, 100);
  return { current, target: goal.target, percent };
}

// Goal card component
function GoalCard({
  goal,
  progress,
  onComplete,
  onDelete,
  t,
}: {
  goal: Goal;
  progress: { current: number; target: number; percent: number };
  onComplete: () => void;
  onDelete: () => void;
  t: Record<string, string>;
}) {
  const Icon = GOAL_ICONS[goal.type];
  const isComplete = progress.percent >= 100 || goal.status === 'completed';

  const formatValue = (type: GoalType, value: number) => {
    switch (type) {
      case 'focus':
        return `${value} ${t.minutes || 'min'}`;
      case 'mood':
        return value.toFixed(1);
      default:
        return value.toString();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "relative p-4 rounded-xl border transition-all",
        GOAL_BG_COLORS[goal.type],
        isComplete && "ring-2 ring-emerald-500/50"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg bg-background/50", GOAL_COLORS[goal.type])}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">{goal.title}</h4>
            <p className="text-xs text-muted-foreground">
              {goal.period === 'week' ? t.thisWeek || 'This week' : t.thisMonth || 'This month'}
            </p>
          </div>
        </div>

        {isComplete ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="p-1.5 bg-emerald-500 rounded-full"
          >
            <Check className="w-4 h-4 text-white" />
          </motion.div>
        ) : (
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
            aria-label={t.delete || 'Delete'}
          >
            <X className="w-4 h-4 text-muted-foreground hover:text-red-500" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t.progress || 'Progress'}</span>
          <span className={cn("font-bold", isComplete ? "text-emerald-500" : "text-foreground")}>
            {formatValue(goal.type, progress.current)} / {formatValue(goal.type, progress.target)}
          </span>
        </div>
        <Progress
          value={progress.percent}
          className={cn("h-2", isComplete && "bg-emerald-500/20")}
        />
      </div>

      {isComplete && goal.status !== 'completed' && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onComplete}
          className="mt-3 w-full py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
        >
          <Trophy className="w-4 h-4" />
          {t.claimReward || 'Claim Reward'}
        </motion.button>
      )}
    </motion.div>
  );
}

// Add goal form
function AddGoalForm({
  habits,
  onAdd,
  onCancel,
  t,
}: {
  habits: Habit[];
  onAdd: (goal: Goal) => void;
  onCancel: () => void;
  t: Record<string, string>;
}) {
  const [type, setType] = useState<GoalType>('habit');
  const [period, setPeriod] = useState<GoalPeriod>('week');
  const [target, setTarget] = useState(5);
  const [habitId, setHabitId] = useState<string>('');

  const handleSubmit = () => {
    const titles: Record<GoalType, string> = {
      habit: habitId
        ? `${t.complete || 'Complete'} ${habits.find(h => h.id === habitId)?.name || ''}`
        : t.goalCompleteHabits || 'Complete habits',
      focus: t.goalFocusTime || 'Focus time',
      mood: t.goalMoodAverage || 'Mood average',
      streak: t.goalMaintainStreak || 'Maintain streak',
    };

    const goal: Goal = {
      id: generateId(),
      type,
      target,
      period,
      habitId: type === 'habit' && habitId ? habitId : undefined,
      title: titles[type] + (type !== 'mood' ? ` ${target}${type === 'focus' ? ' min' : ''}` : ` ${target}+`),
      createdAt: getToday(),
      status: 'active',
    };

    onAdd(goal);
  };

  const getTargetPresets = (): number[] => {
    switch (type) {
      case 'habit':
        return period === 'week' ? [5, 6, 7] : [20, 25, 30];
      case 'focus':
        return period === 'week' ? [60, 120, 180] : [300, 500, 1000];
      case 'mood':
        return [3, 4, 5];
      case 'streak':
        return [7, 14, 30];
      default:
        return [5, 10, 15];
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="p-4 bg-card rounded-xl border border-border space-y-4"
    >
      {/* Goal Type */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          {t.goalType || 'Goal Type'}
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(['habit', 'focus', 'mood', 'streak'] as GoalType[]).map((goalType) => {
            const Icon = GOAL_ICONS[goalType];
            return (
              <button
                key={goalType}
                onClick={() => setType(goalType)}
                className={cn(
                  "p-3 rounded-xl border transition-all flex flex-col items-center gap-1",
                  type === goalType
                    ? `${GOAL_BG_COLORS[goalType]} ${GOAL_COLORS[goalType]}`
                    : "border-border hover:border-primary/50"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs capitalize">{t[`goal${goalType.charAt(0).toUpperCase() + goalType.slice(1)}`] || goalType}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Habit Selector (if type is habit) */}
      {type === 'habit' && habits.length > 0 && (
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            {t.selectHabit || 'Select Habit'} ({t.optional || 'optional'})
          </label>
          <select
            value={habitId}
            onChange={(e) => setHabitId(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground"
          >
            <option value="">{t.allHabits || 'All habits'}</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.icon} {h.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Period */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          {t.period || 'Period'}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setPeriod('week')}
            className={cn(
              "p-2.5 rounded-lg border transition-all text-sm",
              period === 'week'
                ? "bg-primary/10 border-primary text-primary"
                : "border-border hover:border-primary/50"
            )}
          >
            {t.weekly || 'Weekly'}
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={cn(
              "p-2.5 rounded-lg border transition-all text-sm",
              period === 'month'
                ? "bg-primary/10 border-primary text-primary"
                : "border-border hover:border-primary/50"
            )}
          >
            {t.monthly || 'Monthly'}
          </button>
        </div>
      </div>

      {/* Target */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          {t.target || 'Target'}
          {type === 'focus' && ` (${t.minutes || 'minutes'})`}
          {type === 'mood' && ` (${t.average || 'average'})`}
          {type === 'streak' && ` (${t.days || 'days'})`}
        </label>
        <div className="flex gap-2">
          {getTargetPresets().map((preset) => (
            <button
              key={preset}
              onClick={() => setTarget(preset)}
              className={cn(
                "flex-1 p-2.5 rounded-lg border transition-all text-sm font-medium",
                target === preset
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border hover:border-primary/50"
              )}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          {t.cancel || 'Cancel'}
        </Button>
        <Button variant="gradient" className="flex-1" onClick={handleSubmit}>
          <Plus className="w-4 h-4 mr-1" />
          {t.addGoal || 'Add Goal'}
        </Button>
      </div>
    </motion.div>
  );
}

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
  const [showAddForm, setShowAddForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate progress for all goals
  const goalsWithProgress = useMemo(() => {
    return goals.map((goal) => ({
      goal,
      progress: calculateGoalProgress(goal, habits, moods, focusSessions, currentStreak),
    }));
  }, [goals, habits, moods, focusSessions, currentStreak]);

  const activeGoals = goalsWithProgress.filter(g => g.goal.status === 'active');
  const completedGoals = goalsWithProgress.filter(g => g.goal.status === 'completed');

  const handleComplete = useCallback((goal: Goal) => {
    onUpdateGoal({ ...goal, status: 'completed', completedAt: getToday() });
  }, [onUpdateGoal]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Target className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">
            {t.personalGoals || 'Personal Goals'}
          </h3>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {!showAddForm && isExpanded && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="gap-1"
          >
            <Plus className="w-4 h-4" />
            {t.add || 'Add'}
          </Button>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {/* Add Goal Form */}
            <AnimatePresence>
              {showAddForm && (
                <AddGoalForm
                  habits={habits}
                  onAdd={(goal) => {
                    onAddGoal(goal);
                    setShowAddForm(false);
                  }}
                  onCancel={() => setShowAddForm(false)}
                  t={t}
                />
              )}
            </AnimatePresence>

            {/* Active Goals */}
            {activeGoals.length > 0 && (
              <div className="space-y-3">
                {activeGoals.map(({ goal, progress }) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    progress={progress}
                    onComplete={() => handleComplete(goal)}
                    onDelete={() => onDeleteGoal(goal.id)}
                    t={t}
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {activeGoals.length === 0 && !showAddForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-muted-foreground"
              >
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t.noGoalsYet || 'No goals yet'}</p>
                <p className="text-xs mt-1">{t.setGoalHint || 'Set a goal to track your progress'}</p>
              </motion.div>
            )}

            {/* Completed Goals (collapsed by default) */}
            {completedGoals.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">
                  {t.completedGoals || 'Completed'} ({completedGoals.length})
                </p>
                <div className="space-y-2 opacity-60">
                  {completedGoals.slice(0, 3).map(({ goal, progress }) => (
                    <div
                      key={goal.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-foreground">{goal.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
