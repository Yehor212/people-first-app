/**
 * useReflectionPrompts — Contextual Reflection Engine (IA Blueprint Phase 3)
 *
 * Computes micro-reflection prompts based on user's current context:
 * mood patterns, habit completion, focus sessions, time of day.
 * Prompts are lightweight invitations, never guilt-inducing.
 */

import { useMemo } from 'react';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry, ReflectionTrigger, ReflectionDepth } from '@/types';
import { getToday } from '@/lib/utils';

export interface ReflectionPrompt {
  trigger: ReflectionTrigger;
  text: string;
  depth: ReflectionDepth;
  priority: number; // Higher = show first
  context?: {
    moodId?: string;
    habitIds?: string[];
    focusSessionId?: string;
  };
}

/** Check if the last N mood entries share the same emotion */
function hasRecentMoodStreak(moods: MoodEntry[], emotion: string, count: number): boolean {
  const sorted = [...moods].sort((a, b) => b.timestamp - a.timestamp);
  const recent = sorted.slice(0, count);
  return recent.length >= count && recent.every(m => m.emotion === emotion);
}

/**
 * Returns contextual reflection prompts sorted by priority (highest first).
 * At most one prompt per trigger type. Zero prompts is valid (no context = no nagging).
 */
export function useReflectionPrompts(
  moods: MoodEntry[],
  habits: Habit[],
  focusSessions: FocusSession[],
  gratitudeEntries: GratitudeEntry[],
): ReflectionPrompt[] {
  return useMemo(() => {
    const prompts: ReflectionPrompt[] = [];
    const today = getToday();
    const hour = new Date().getHours();

    // Today's data
    const todayMoods = moods.filter(m => m.date === today);
    const todayCompletedHabits = habits.filter(h => h.completedDates?.includes(today));
    const todayFocusSessions = focusSessions.filter(s => s.date === today);
    const allHabitsComplete = habits.length > 0 && todayCompletedHabits.length === habits.length;

    // --- All habits complete → nano reflection ---
    if (allHabitsComplete) {
      prompts.push({
        trigger: 'all_habits_complete',
        text: 'All done! One word for how you feel:',
        depth: 'nano',
        priority: 90,
        context: { habitIds: todayCompletedHabits.map(h => h.id) },
      });
    }

    // --- Joy streak (3+ consecutive joy moods) ---
    if (hasRecentMoodStreak(moods, 'joy', 3)) {
      prompts.push({
        trigger: 'mood_joy_streak',
        text: "You've felt joyful 3 days running. What's different?",
        depth: 'micro',
        priority: 80,
      });
    }

    // --- Post-focus reflection ---
    if (todayFocusSessions.length > 0) {
      const lastSession = todayFocusSessions[todayFocusSessions.length - 1];
      prompts.push({
        trigger: 'focus_reflection',
        text: 'What helped you focus today?',
        depth: 'micro',
        priority: 70,
        context: { focusSessionId: lastSession.id },
      });
    }

    // --- Evening check-in (7pm+, no mood logged today) ---
    if (hour >= 19 && todayMoods.length === 0) {
      prompts.push({
        trigger: 'evening_checkin',
        text: 'How was your day? Even one word helps.',
        depth: 'micro',
        priority: 60,
      });
    }

    // --- Weekly review (Sunday) ---
    if (new Date().getDay() === 0) {
      prompts.push({
        trigger: 'weekly_review',
        text: 'This week in 3 words:',
        depth: 'nano',
        priority: 50,
      });
    }

    // Sort highest priority first
    return prompts.sort((a, b) => b.priority - a.priority);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gratitudeEntries included for future triggers
  }, [moods, habits, focusSessions, gratitudeEntries]);
}
