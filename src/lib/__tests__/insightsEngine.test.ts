/**
 * Unit tests for Insights Engine
 * Tests pattern detection algorithms and statistical analysis
 */

import { describe, expect, it } from 'vitest';
import {
  generateInsights,
  analyzeMoodHabitCorrelation,
  analyzeFocusPatterns,
  analyzeHabitTiming,
  analyzeMoodTags,
} from '../insightsEngine';
import type { MoodEntry, Habit, FocusSession } from '@/types';

// Helper to create test data
const createMoodEntry = (date: string, mood: string, tags: string[] = [], energy: number = 3, hour: number = 12): MoodEntry => ({
  date,
  mood,
  tags,
  energy,
  timestamp: new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00`).getTime(),
});

const createHabit = (id: string, name: string, completedDates: string[]): Habit => ({
  id,
  name,
  icon: '✅',
  color: 'blue',
  completedDates,
  createdAt: Date.now(),
  type: 'daily',
  reminders: [],
  frequency: 'daily',
});

const createFocusSession = (date: string, label: string, minutes: number, hour: number = 10): FocusSession => ({
  id: `focus-${date}-${hour}`,
  date,
  label,
  duration: minutes,
  completedAt: new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00`).getTime(),
  status: 'completed',
});

describe('insightsEngine', () => {
  describe('generateInsights', () => {
    it('returns empty array when insufficient data', () => {
      const moods: MoodEntry[] = [
        createMoodEntry('2026-01-20', 'good'),
        createMoodEntry('2026-01-21', 'great'),
      ];
      const habits: Habit[] = [];
      const focusSessions: FocusSession[] = [];

      const insights = generateInsights(moods, habits, focusSessions);
      expect(insights).toEqual([]);
    });

    it('generates insights with sufficient data', () => {
      const dates = ['2026-01-15', '2026-01-16', '2026-01-17', '2026-01-18', '2026-01-19', '2026-01-20', '2026-01-21'];

      const moods: MoodEntry[] = dates.map((date, i) =>
        createMoodEntry(date, i % 2 === 0 ? 'great' : 'good', i % 2 === 0 ? ['exercise'] : [])
      );

      const habits: Habit[] = [
        createHabit('h1', 'Morning Run', ['2026-01-15', '2026-01-17', '2026-01-19', '2026-01-21']),
      ];

      const focusSessions: FocusSession[] = dates.map(date =>
        createFocusSession(date, 'Deep Work', 25, 10)
      );

      const insights = generateInsights(moods, habits, focusSessions);

      expect(insights).toBeDefined();
      expect(Array.isArray(insights)).toBe(true);
      // Should generate at least one insight
      expect(insights.length).toBeGreaterThan(0);

      // Verify insight structure
      if (insights.length > 0) {
        const insight = insights[0];
        expect(insight).toHaveProperty('id');
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('title');
        expect(insight).toHaveProperty('description');
        expect(insight).toHaveProperty('confidence');
        expect(insight.confidence).toBeGreaterThanOrEqual(0);
        expect(insight.confidence).toBeLessThanOrEqual(100);
      }
    });

    it('limits to top 5 insights', () => {
      // Create lots of data to generate many insights
      const dates = Array.from({ length: 30 }, (_, i) => {
        const d = new Date('2026-01-01');
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      });

      const moods: MoodEntry[] = dates.map((date, i) =>
        createMoodEntry(date, i % 5 === 0 ? 'great' : 'good', ['exercise', 'sleep', 'work'], 4)
      );

      const habits: Habit[] = [
        createHabit('h1', 'Exercise', dates.filter((_, i) => i % 2 === 0)),
        createHabit('h2', 'Meditation', dates.filter((_, i) => i % 3 === 0)),
        createHabit('h3', 'Reading', dates.filter((_, i) => i % 4 === 0)),
      ];

      const focusSessions: FocusSession[] = dates.map((date, i) =>
        createFocusSession(date, i % 2 === 0 ? 'Deep Work' : 'Emails', 30 + (i % 30), 9 + (i % 8))
      );

      const insights = generateInsights(moods, habits, focusSessions);

      expect(insights.length).toBeLessThanOrEqual(5);
    });
  });

  describe('analyzeMoodHabitCorrelation', () => {
    it('returns empty array with insufficient mood data', () => {
      const moods: MoodEntry[] = [
        createMoodEntry('2026-01-20', 'good'),
        createMoodEntry('2026-01-21', 'great'),
      ];
      const habits: Habit[] = [createHabit('h1', 'Exercise', ['2026-01-20'])];

      const insights = analyzeMoodHabitCorrelation(moods, habits);
      expect(insights).toEqual([]);
    });

    it('detects positive habit-mood correlation', () => {
      // Exercise days = great mood, non-exercise = okay mood
      // Need more days to ensure sufficient data (min 5 with habit, min 3 without)
      const moods: MoodEntry[] = [
        createMoodEntry('2026-01-15', 'great'), // exercise
        createMoodEntry('2026-01-16', 'okay'),
        createMoodEntry('2026-01-17', 'great'), // exercise
        createMoodEntry('2026-01-18', 'okay'),
        createMoodEntry('2026-01-19', 'great'), // exercise
        createMoodEntry('2026-01-20', 'okay'),
        createMoodEntry('2026-01-21', 'great'), // exercise
        createMoodEntry('2026-01-22', 'great'), // exercise
        createMoodEntry('2026-01-23', 'okay'),
      ];

      const habits: Habit[] = [
        createHabit('h1', 'Exercise', ['2026-01-15', '2026-01-17', '2026-01-19', '2026-01-21', '2026-01-22']),
      ];

      const insights = analyzeMoodHabitCorrelation(moods, habits);

      expect(insights.length).toBeGreaterThan(0);

      const exerciseInsight = insights.find(i => i.type === 'mood-habit-correlation');
      expect(exerciseInsight).toBeDefined();

      if (exerciseInsight) {
        expect(exerciseInsight.metadata.type).toBe('mood-habit-correlation');
        expect(exerciseInsight.metadata.habitName).toBe('Exercise');
        expect(exerciseInsight.confidence).toBeGreaterThan(0);
      }
    });

    it('requires minimum habit completions', () => {
      const moods: MoodEntry[] = Array.from({ length: 10 }, (_, i) =>
        createMoodEntry(`2026-01-${15 + i}`, 'good')
      );

      const habits: Habit[] = [
        createHabit('h1', 'Rare Habit', ['2026-01-15', '2026-01-16']), // Only 2 days
      ];

      const insights = analyzeMoodHabitCorrelation(moods, habits);

      // Should not generate insight with < 5 habit days
      expect(insights).toEqual([]);
    });
  });

  describe('analyzeFocusPatterns', () => {
    it('returns empty array with insufficient sessions', () => {
      const sessions: FocusSession[] = [
        createFocusSession('2026-01-20', 'Work', 25),
      ];

      const insights = analyzeFocusPatterns(sessions);
      expect(insights).toEqual([]);
    });

    it('detects best focus label', () => {
      const sessions: FocusSession[] = [
        createFocusSession('2026-01-15', 'Deep Work', 60),
        createFocusSession('2026-01-16', 'Deep Work', 50),
        createFocusSession('2026-01-17', 'Deep Work', 55),
        createFocusSession('2026-01-18', 'Emails', 15),
        createFocusSession('2026-01-19', 'Emails', 20),
        createFocusSession('2026-01-20', 'Emails', 10),
      ];

      const insights = analyzeFocusPatterns(sessions);

      expect(insights.length).toBeGreaterThan(0);

      const focusInsight = insights.find(i => i.type === 'focus-pattern');
      expect(focusInsight).toBeDefined();

      if (focusInsight) {
        expect(focusInsight.metadata.type).toBe('focus-pattern');
        expect(focusInsight.metadata.bestLabel).toBe('Deep Work');
        expect(focusInsight.metadata.avgDuration).toBeGreaterThan(50);
      }
    });

    it('detects best focus time of day', () => {
      const sessions: FocusSession[] = [
        createFocusSession('2026-01-15', 'Work', 60, 9),  // Morning - good
        createFocusSession('2026-01-16', 'Work', 55, 10), // Morning - good
        createFocusSession('2026-01-17', 'Work', 50, 9),  // Morning - good
        createFocusSession('2026-01-18', 'Work', 20, 14), // Afternoon - poor
        createFocusSession('2026-01-19', 'Work', 15, 15), // Afternoon - poor
      ];

      const insights = analyzeFocusPatterns(sessions);

      const timeInsight = insights.find(i =>
        i.type === 'focus-pattern' && i.metadata.type === 'focus-pattern' && i.metadata.bestTime
      );

      if (timeInsight) {
        expect(timeInsight.metadata.bestTime).toBeDefined();
        expect(timeInsight.metadata.bestTime).toMatch(/^(9|10):/); // Morning time (9:00 or 10:00)
      }
    });
  });

  describe('analyzeHabitTiming', () => {
    it('returns empty with insufficient data', () => {
      const moods: MoodEntry[] = [];
      const habits: Habit[] = [createHabit('h1', 'Exercise', ['2026-01-20'])];

      const insights = analyzeHabitTiming(habits, moods);
      expect(insights).toEqual([]);
    });

    it('detects optimal habit timing', () => {
      // Simulate habit completed at different times with clear morning preference
      // Need timestamps to determine time of day: morning (<12), afternoon (12-17), evening (>=17)
      const moods: MoodEntry[] = [
        createMoodEntry('2026-01-15', 'great', [], 3, 9),   // morning - habit completed
        createMoodEntry('2026-01-16', 'good', [], 3, 18),   // evening - habit completed
        createMoodEntry('2026-01-17', 'great', [], 3, 10),  // morning - habit completed
        createMoodEntry('2026-01-18', 'good', [], 3, 13),   // afternoon - habit completed
        createMoodEntry('2026-01-19', 'great', [], 3, 8),   // morning - habit completed
        createMoodEntry('2026-01-20', 'great', [], 3, 9),   // morning - habit completed
        createMoodEntry('2026-01-21', 'great', [], 3, 11),  // morning - habit completed
        createMoodEntry('2026-01-22', 'good', [], 3, 19),   // evening - no habit
      ];

      const habits: Habit[] = [
        // Mostly morning completions (5 morning, 1 afternoon, 1 evening)
        createHabit('h1', 'Morning Routine', ['2026-01-15', '2026-01-16', '2026-01-17', '2026-01-18', '2026-01-19', '2026-01-20', '2026-01-21']),
      ];

      const insights = analyzeHabitTiming(habits, moods);

      expect(insights.length).toBeGreaterThan(0);

      const timingInsight = insights.find(i => i.type === 'habit-timing');
      expect(timingInsight).toBeDefined();

      if (timingInsight) {
        expect(timingInsight.metadata.type).toBe('habit-timing');
        expect(timingInsight.metadata.habitName).toBe('Morning Routine');
        expect(timingInsight.metadata.bestTime).toBe('morning');
        expect(timingInsight.metadata.bestTimeRate).toBeGreaterThan(50);
      }
    });
  });

  describe('analyzeMoodTags', () => {
    it('returns empty with insufficient mood data', () => {
      const moods: MoodEntry[] = [
        createMoodEntry('2026-01-20', 'good', ['exercise']),
      ];

      const insights = analyzeMoodTags(moods);
      expect(insights).toEqual([]);
    });

    it('detects tags correlated with better mood', () => {
      const moods: MoodEntry[] = [
        createMoodEntry('2026-01-15', 'great', ['exercise']),
        createMoodEntry('2026-01-16', 'okay', []),
        createMoodEntry('2026-01-17', 'great', ['exercise']),
        createMoodEntry('2026-01-18', 'okay', []),
        createMoodEntry('2026-01-19', 'great', ['exercise']),
        createMoodEntry('2026-01-20', 'okay', []),
        createMoodEntry('2026-01-21', 'great', ['exercise']),
        createMoodEntry('2026-01-22', 'okay', []),
      ];

      const insights = analyzeMoodTags(moods);

      expect(insights.length).toBeGreaterThan(0);

      const tagInsight = insights.find(i => i.type === 'mood-tag');
      expect(tagInsight).toBeDefined();

      if (tagInsight) {
        expect(tagInsight.metadata.type).toBe('mood-tag');
        expect(tagInsight.metadata.tag).toBe('exercise');
        expect(tagInsight.metadata.avgMoodWith).toBeGreaterThan(tagInsight.metadata.avgMoodWithout);
      }
    });

    it('requires minimum tag occurrences', () => {
      const moods: MoodEntry[] = [
        createMoodEntry('2026-01-15', 'great', ['rare']),
        createMoodEntry('2026-01-16', 'okay', []),
        createMoodEntry('2026-01-17', 'great', ['rare']),
        createMoodEntry('2026-01-18', 'okay', []),
        createMoodEntry('2026-01-19', 'great', []),
        createMoodEntry('2026-01-20', 'okay', []),
        createMoodEntry('2026-01-21', 'great', []),
      ];

      const insights = analyzeMoodTags(moods);

      // Should not generate insight for tag appearing < 3 times
      expect(insights).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('handles empty datasets gracefully', () => {
      const insights = generateInsights([], [], []);
      expect(insights).toEqual([]);
    });

    it('handles missing mood values', () => {
      const moods: MoodEntry[] = Array.from({ length: 10 }, (_, i) => ({
        date: `2026-01-${15 + i}`,
        mood: 'unknown' as any, // Invalid mood
        tags: [],
        energy: 3,
        timestamp: Date.now(),
      }));

      const habits: Habit[] = [
        createHabit('h1', 'Test', ['2026-01-15', '2026-01-16']),
      ];

      // Should not crash, should use default value
      expect(() => analyzeMoodHabitCorrelation(moods, habits)).not.toThrow();
    });

    it('sorts insights by confidence', () => {
      const dates = Array.from({ length: 30 }, (_, i) => {
        const d = new Date('2026-01-01');
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      });

      const moods: MoodEntry[] = dates.map((date, i) =>
        createMoodEntry(date, i % 3 === 0 ? 'great' : 'good', ['exercise'], 4)
      );

      const habits: Habit[] = [
        createHabit('h1', 'Strong Pattern', dates.filter((_, i) => i % 3 === 0)),
        createHabit('h2', 'Weak Pattern', dates.filter((_, i) => i % 5 === 0)),
      ];

      const focusSessions: FocusSession[] = dates.map(date =>
        createFocusSession(date, 'Work', 30)
      );

      const insights = generateInsights(moods, habits, focusSessions);

      // Verify insights are sorted by confidence (descending)
      for (let i = 0; i < insights.length - 1; i++) {
        expect(insights[i].confidence).toBeGreaterThanOrEqual(insights[i + 1].confidence);
      }
    });
  });
});
