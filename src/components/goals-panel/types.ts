import {
  Target, Brain, Heart, Calendar, Flame,
} from 'lucide-react';
import type { Goal, GoalType, Habit, MoodEntry, FocusSession } from '@/types';

export interface GoalsPanelProps {
  goals: Goal[];
  habits: Habit[];
  moods: MoodEntry[];
  focusSessions: FocusSession[];
  currentStreak: number;
  onAddGoal: (goal: Goal) => void;
  onUpdateGoal: (goal: Goal) => void;
  onDeleteGoal: (goalId: string) => void;
}

export const GOAL_THEMES: Record<GoalType, {
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

export function calculateGoalProgress(
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
          current = Object.entries(habit.entries || {}).filter(([d, e]) => d >= periodStartStr && e.value === 2).length;
        }
      } else {
        current = habits.reduce((sum, h) => {
          return sum + Object.entries(h.entries || {}).filter(([d, e]) => d >= periodStartStr && e.value === 2).length;
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
