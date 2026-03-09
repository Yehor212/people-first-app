/**
 * useReflectionPrompts — Contextual Reflection Engine (IA Blueprint Phase 3)
 *
 * Computes micro-reflection prompts based on user's current context:
 * mood patterns, habit completion, focus sessions, time of day.
 * Prompts are lightweight invitations, never guilt-inducing.
 */

import { useMemo } from 'react';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry, ReflectionTrigger, ReflectionDepth } from '@/types';
import type { Translations } from '@/i18n/types';
import { getToday } from '@/lib/utils';
import { isHabitCompletedOnDate } from '@/lib/habits';

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
  return recent.length >= count && recent.every(m => m.emotion?.primary === emotion);
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
  t: Translations,
): ReflectionPrompt[] {
  return useMemo(() => {
    const prompts: ReflectionPrompt[] = [];
    const today = getToday();
    const hour = new Date().getHours();

    // Today's data — filter out archived habits
    const todayMoods = moods.filter(m => m.date === today);
    const activeHabits = habits.filter(h => !h.isArchived);
    const todayCompletedHabits = activeHabits.filter(h => isHabitCompletedOnDate(h, today));
    const todayFocusSessions = focusSessions.filter(s => s.date === today);
    const allHabitsComplete = activeHabits.length > 0 && todayCompletedHabits.length === activeHabits.length;

    // --- All habits complete → nano reflection ---
    if (allHabitsComplete) {
      prompts.push({
        trigger: 'all_habits_complete',
        text: t.reflectionAllDone || 'All done! One word for how you feel:',
        depth: 'nano',
        priority: 90,
        context: { habitIds: todayCompletedHabits.map(h => h.id) },
      });
    }

    // --- Joy streak (3+ consecutive joy moods) ---
    if (hasRecentMoodStreak(moods, 'joy', 3)) {
      prompts.push({
        trigger: 'mood_joy_streak',
        text: t.reflectionJoyStreak || "You've felt joyful 3 days running. What's different?",
        depth: 'micro',
        priority: 80,
      });
    }

    // --- Post-focus reflection ---
    if (todayFocusSessions.length > 0) {
      const lastSession = todayFocusSessions[todayFocusSessions.length - 1];
      prompts.push({
        trigger: 'focus_reflection',
        text: t.reflectionFocus || 'What helped you focus today?',
        depth: 'micro',
        priority: 70,
        context: { focusSessionId: lastSession.id },
      });
    }

    // --- Evening check-in (7pm+, no mood logged today) ---
    if (hour >= 19 && todayMoods.length === 0) {
      prompts.push({
        trigger: 'evening_checkin',
        text: t.reflectionEvening || 'How was your day? Even one word helps.',
        depth: 'micro',
        priority: 60,
      });
    }

    // --- Weekly review (Sunday) ---
    if (new Date().getDay() === 0) {
      prompts.push({
        trigger: 'weekly_review',
        text: t.reflectionWeekly || 'This week in 3 words:',
        depth: 'nano',
        priority: 50,
      });
    }

    // --- Daily mindfulness (fallback — always available when no context triggers fire) ---
    if (prompts.length === 0) {
      const dailyPrompts = [
        t.reflectionDaily1 || 'What are you grateful for right now?',
        t.reflectionDaily2 || 'Take a deep breath. How do you feel?',
        t.reflectionDaily3 || 'What small win can you celebrate today?',
        t.reflectionDaily4 || 'One thing you want to focus on today:',
        t.reflectionDaily5 || 'What would make today great?',
      ];
      const dayIndex = new Date().getDate() % dailyPrompts.length;
      prompts.push({
        trigger: 'daily_mindfulness',
        text: dailyPrompts[dayIndex],
        depth: 'nano',
        priority: 10,
      });
    }

    // Sort highest priority first
    return prompts.sort((a, b) => b.priority - a.priority);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gratitudeEntries included for future triggers
  }, [moods, habits, focusSessions, gratitudeEntries, t]);
}
