/**
 * GoalsPanel - Premium Personal Goals Management
 *
 * Redesigned with:
 * - SVG circular progress rings per goal
 * - Glassmorphism card design with gradient accents
 * - Animated celebrations on goal completion
 * - Smart goal suggestions based on user data
 * - Sheet-based creation form
 * - Haptic feedback
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Plus, Check, X, Flame, Brain, Heart, Calendar,
  Trophy, Sparkles, ChevronRight, Zap,
} from 'lucide-react';
// Sheet replaced with custom bottom-sheet modal
import { EmptyState } from '@/components/EmptyState';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { Goal, GoalType, GoalPeriod, Habit, MoodEntry, FocusSession } from '@/types';
import { generateId, getToday, cn } from '@/lib/utils';
import { hapticTap } from '@/lib/haptics';

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

const GOAL_THEMES: Record<GoalType, {
  icon: typeof Target;
  gradient: string;
  glowColor: string;
  ringColor: string;
  bgGradient: string;
  emoji: string;
}> = {
  habit: {
    icon: Calendar,
    gradient: 'from-emerald-400 via-teal-500 to-cyan-500',
    glowColor: 'rgba(20, 184, 166, 0.4)',
    ringColor: '#14b8a6',
    bgGradient: 'from-emerald-500/15 via-teal-500/10 to-transparent',
    emoji: '🎯',
  },
  focus: {
    icon: Brain,
    gradient: 'from-violet-400 via-purple-500 to-indigo-500',
    glowColor: 'rgba(139, 92, 246, 0.4)',
    ringColor: '#8b5cf6',
    bgGradient: 'from-violet-500/15 via-purple-500/10 to-transparent',
    emoji: '🧠',
  },
  mood: {
    icon: Heart,
    gradient: 'from-pink-400 via-rose-500 to-red-500',
    glowColor: 'rgba(244, 63, 94, 0.4)',
    ringColor: '#f43f5e',
    bgGradient: 'from-pink-500/15 via-rose-500/10 to-transparent',
    emoji: '💜',
  },
  streak: {
    icon: Flame,
    gradient: 'from-orange-400 via-amber-500 to-yellow-500',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    ringColor: '#f59e0b',
    bgGradient: 'from-orange-500/15 via-amber-500/10 to-transparent',
    emoji: '🔥',
  },
};

// SVG Progress Ring
function ProgressRing({
  percent,
  size = 56,
  strokeWidth = 5,
  color,
  glowColor,
  children,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  glowColor: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Glow ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={glowColor}
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: 'blur(4px)' }}
        />
        {/* Progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// Calculate progress for a goal
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

// Premium goal card
function PremiumGoalCard({
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
            onClick={() => { hapticTap(); onComplete(); }}
            className={cn(
              'p-2.5 rounded-xl',
              'bg-gradient-to-br from-emerald-400 to-teal-500',
              'text-white shadow-lg active:scale-95 transition-transform',
            )}
            style={{ boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)' }}
          >
            <Trophy className="w-4 h-4" />
          </motion.button>
        ) : !isComplete ? (
          <button
            onClick={() => { hapticTap(); onDelete(); }}
            className="p-2 rounded-xl hover:bg-destructive/10 transition-colors"
            aria-label={t.delete || 'Delete'}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}

// Smart goal suggestions
function GoalSuggestions({
  habits,
  currentStreak,
  existingGoals,
  onAdd,
  t,
}: {
  habits: Habit[];
  currentStreak: number;
  existingGoals: Goal[];
  onAdd: (goal: Goal) => void;
  t: Record<string, string>;
}) {
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
            hapticTap();
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
            'hover:bg-muted/30 transition-all text-left group',
          )}
        >
          <span className="text-lg">{s.emoji}</span>
          <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {s.title}
          </span>
          <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </motion.button>
      ))}
    </div>
  );
}

// Add goal sheet form
function AddGoalSheet({
  open,
  onOpenChange,
  habits,
  onAdd,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habits: Habit[];
  onAdd: (goal: Goal) => void;
  t: Record<string, string>;
}) {
  const [type, setType] = useState<GoalType>('habit');
  const [period, setPeriod] = useState<GoalPeriod>('week');
  const [target, setTarget] = useState(5);
  const [habitId, setHabitId] = useState<string>('');

  useBackHandler(open, () => onOpenChange(false));

  const handleSubmit = () => {
    hapticTap();

    const titles: Record<GoalType, string> = {
      habit: habitId
        ? `${t.complete || 'Complete'} ${habits.find(h => h.id === habitId)?.name || ''}`
        : t.goalCompleteHabits || 'Complete habits',
      focus: t.goalFocusTime || 'Focus time',
      mood: t.goalMoodAverage || 'Mood average',
      streak: t.goalMaintainStreak || 'Maintain streak',
    };

    const suffixes: Record<GoalType, string> = {
      habit: ` ${target}`,
      focus: ` ${target} ${t.minuteShort || 'm'}`,
      mood: ` ${target}+`,
      streak: ` ${target}`,
    };

    const goal: Goal = {
      id: generateId(),
      type,
      target,
      period,
      habitId: type === 'habit' && habitId ? habitId : undefined,
      title: titles[type] + suffixes[type],
      createdAt: getToday(),
      status: 'active',
    };

    onAdd(goal);
    onOpenChange(false);

    // Reset form
    setType('habit');
    setPeriod('week');
    setTarget(5);
    setHabitId('');
  };

  const getTargetPresets = (): number[] => {
    switch (type) {
      case 'habit': return period === 'week' ? [5, 6, 7] : [20, 25, 30];
      case 'focus': return period === 'week' ? [60, 120, 180] : [300, 500, 1000];
      case 'mood': return [3, 4, 5];
      case 'streak': return [7, 14, 30];
      default: return [5, 10, 15];
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => onOpenChange(false)} />
      <div role="dialog" aria-modal="true" className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-[2rem] bg-background max-h-[85vh] overflow-hidden animate-slide-up">
        <h2 className="sr-only">{t.addGoal || 'Add Goal'}</h2>

        {/* Header */}
        <div className="relative h-20 overflow-hidden bg-gradient-to-br from-primary/20 via-accent/10 to-transparent">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-muted-foreground/30" />
          <div className="absolute bottom-4 left-6 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20 backdrop-blur-sm">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">
              {t.addGoal || 'Add Goal'}
            </h2>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[60vh]">
          {/* Goal Type */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-3 block">
              {t.goalType || 'Goal Type'}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['habit', 'focus', 'mood', 'streak'] as GoalType[]).map((goalType) => {
                const th = GOAL_THEMES[goalType];
                const selected = type === goalType;
                return (
                  <button
                    key={goalType}
                    onClick={() => { hapticTap(); setType(goalType); }}
                    className={cn(
                      'p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5',
                      selected
                        ? `border-transparent bg-gradient-to-br ${th.bgGradient}`
                        : 'border-border/50 hover:border-border',
                    )}
                    style={selected ? { boxShadow: `0 4px 16px ${th.glowColor}` } : undefined}
                  >
                    <span className="text-lg">{th.emoji}</span>
                    <span className={cn(
                      'text-[11px] font-medium capitalize',
                      selected ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {t[`goal${goalType.charAt(0).toUpperCase() + goalType.slice(1)}`] || goalType}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Habit Selector */}
          {type === 'habit' && habits.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                {t.selectHabit || 'Select Habit'} <span className="text-muted-foreground font-normal">({t.optional || 'optional'})</span>
              </label>
              <select
                value={habitId}
                onChange={(e) => setHabitId(e.target.value)}
                className="w-full p-3 rounded-xl border border-border/50 bg-muted/30 text-foreground text-sm"
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
            <label className="text-sm font-semibold text-foreground mb-3 block">
              {t.period || 'Period'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['week', 'month'] as GoalPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => { hapticTap(); setPeriod(p); }}
                  className={cn(
                    'p-3 rounded-xl border transition-all text-sm font-medium',
                    period === p
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'border-border/50 text-muted-foreground hover:border-border',
                  )}
                >
                  {p === 'week' ? (t.weekly || 'Weekly') : (t.monthly || 'Monthly')}
                </button>
              ))}
            </div>
          </div>

          {/* Target */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-3 block">
              {t.target || 'Target'}
              {type === 'focus' && <span className="text-muted-foreground font-normal"> ({t.minutes || 'minutes'})</span>}
              {type === 'mood' && <span className="text-muted-foreground font-normal"> ({t.average || 'average'})</span>}
              {type === 'streak' && <span className="text-muted-foreground font-normal"> ({t.days || 'days'})</span>}
            </label>
            <div className="flex gap-2">
              {getTargetPresets().map((preset) => (
                <button
                  key={preset}
                  onClick={() => { hapticTap(); setTarget(preset); }}
                  className={cn(
                    'flex-1 p-3 rounded-xl border transition-all text-sm font-bold',
                    target === preset
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'border-border/50 text-muted-foreground hover:border-border',
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <motion.button
            onClick={handleSubmit}
            className={cn(
              'w-full py-4 px-5 rounded-2xl font-semibold',
              'flex items-center justify-center gap-2',
              `bg-gradient-to-r ${GOAL_THEMES[type].gradient}`,
              'text-white shadow-xl active:scale-[0.98] transition-transform',
            )}
            style={{ boxShadow: `0 8px 32px ${GOAL_THEMES[type].glowColor}` }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles className="w-5 h-5" />
            <span>{t.addGoal || 'Add Goal'}</span>
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </>
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
  const [showAddSheet, setShowAddSheet] = useState(false);
  useScrollLock(showAddSheet);

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
    hapticTap();
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
          onClick={() => { hapticTap(); setShowAddSheet(true); }}
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
            onDelete={() => { hapticTap(); onDeleteGoal(goal.id); }}
            t={t}
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
            onClick: () => { hapticTap(); setShowAddSheet(true); },
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
          t={t}
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
        t={t}
      />
    </div>
  );
}
