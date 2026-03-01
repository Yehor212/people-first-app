import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MoodEntry, MoodType, Habit, FocusSession, GratitudeEntry, Badge } from '@/types';
import { makeTestHabit, datesToEntries } from '@/test/habitFixtures';

// ============================================
// TESTS — progressStories
// ============================================

import {
  getCurrentWeekRange,
  generateWeeklyStory,
  hasEnoughDataForStory,
} from '../progressStories';

// ============================================
// HELPERS
// ============================================

const makeMood = (mood: MoodType, date: string): MoodEntry => ({
  id: `mood-${date}`,
  mood,
  date,
  timestamp: new Date(`${date}T12:00:00`).getTime(),
});

const makeHabit = (
  id: string,
  name: string,
  completedDates: string[],
  icon: string = '🏃'
): Habit => makeTestHabit({
  id,
  name,
  icon,
  color: 8,
  entries: datesToEntries(completedDates),
  createdAt: Date.now(),
});

const makeFocusSession = (date: string, duration: number, status: 'completed' | 'aborted' = 'completed', label?: string): FocusSession => ({
  id: `focus-${date}-${duration}`,
  duration,
  date,
  completedAt: new Date(`${date}T12:00:00`).getTime(),
  status,
  label,
});

const makeGratitude = (date: string): GratitudeEntry => ({
  id: `gratitude-${date}`,
  text: 'Grateful for today',
  date,
  timestamp: new Date(`${date}T12:00:00`).getTime(),
});

const makeBadge = (id: string): Badge => ({
  id,
  category: 'streak',
  icon: '🏆',
  title: { en: 'Test Badge' },
  description: { en: 'A test badge' },
  requirement: 7,
  unlocked: true,
  unlockedDate: '2026-02-17',
  rarity: 'common',
});

/**
 * Get the dates of the current (faked) week (Mon-Sun) as YYYY-MM-DD strings.
 */
function getCurrentWeekDates(): string[] {
  const { start, end } = getCurrentWeekRange();
  const dates: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// ============================================
// TESTS
// ============================================

describe('progressStories', () => {
  beforeEach(() => {
    // Wednesday, Feb 18, 2026 at noon
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // getCurrentWeekRange
  // ============================================
  describe('getCurrentWeekRange', () => {
    it('should return Monday as start of week', () => {
      const { start } = getCurrentWeekRange();
      expect(start.getDay()).toBe(1); // Monday
    });

    it('should return Sunday as end of week', () => {
      const { end } = getCurrentWeekRange();
      expect(end.getDay()).toBe(0); // Sunday
    });

    it('should set start time to midnight', () => {
      const { start } = getCurrentWeekRange();
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
    });

    it('should set end time to 23:59:59', () => {
      const { end } = getCurrentWeekRange();
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
    });

    it('should return a formatted range string', () => {
      const { range } = getCurrentWeekRange();
      expect(typeof range).toBe('string');
      expect(range).toContain(' - ');
    });

    it('should have end 6 days after start', () => {
      const { start, end } = getCurrentWeekRange();
      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(6);
    });

    it('should compute correct Monday when today is Wednesday', () => {
      // Wed Feb 18 2026 -> Monday is Feb 16
      const { start } = getCurrentWeekRange();
      expect(start.getDate()).toBe(16);
      expect(start.getMonth()).toBe(1); // February (0-indexed)
    });

    it('should compute correct Monday when today is Sunday', () => {
      vi.setSystemTime(new Date('2026-02-22T12:00:00')); // Sunday
      const { start } = getCurrentWeekRange();
      expect(start.getDay()).toBe(1); // Monday
      // Sunday Feb 22 -> previous Monday = Feb 16
      expect(start.getDate()).toBe(16);
    });

    it('should compute correct Monday when today is Monday', () => {
      vi.setSystemTime(new Date('2026-02-16T12:00:00')); // Monday
      const { start } = getCurrentWeekRange();
      expect(start.getDay()).toBe(1);
      expect(start.getDate()).toBe(16);
    });
  });

  // ============================================
  // hasEnoughDataForStory
  // ============================================
  describe('hasEnoughDataForStory', () => {
    it('should return false with completely empty data', () => {
      const result = hasEnoughDataForStory([], [], []);
      expect(result).toBe(false);
    });

    it('should return true with 2+ moods in current week', () => {
      const weekDates = getCurrentWeekDates();
      const moods = [
        makeMood('good', weekDates[0]),
        makeMood('great', weekDates[1]),
      ];
      const result = hasEnoughDataForStory(moods, [], []);
      expect(result).toBe(true);
    });

    it('should return false with only 1 mood in current week and no habits/focus', () => {
      const weekDates = getCurrentWeekDates();
      const moods = [makeMood('good', weekDates[0])];
      const result = hasEnoughDataForStory(moods, [], []);
      expect(result).toBe(false);
    });

    it('should return true when habits exist (even with no moods)', () => {
      const habits = [makeHabit('h1', 'Exercise', ['2026-02-16'])];
      const result = hasEnoughDataForStory([], habits, []);
      expect(result).toBe(true);
    });

    it('should return true when focus sessions exist in current week', () => {
      const weekDates = getCurrentWeekDates();
      const focus = [makeFocusSession(weekDates[0], 25)];
      const result = hasEnoughDataForStory([], [], focus);
      expect(result).toBe(true);
    });

    it('should return false when moods are outside current week', () => {
      const moods = [
        makeMood('good', '2026-01-01'),
        makeMood('great', '2026-01-02'),
      ];
      const result = hasEnoughDataForStory(moods, [], []);
      expect(result).toBe(false);
    });
  });

  // ============================================
  // generateWeeklyStory
  // ============================================
  describe('generateWeeklyStory', () => {
    it('should always include intro slide as first', () => {
      const slides = generateWeeklyStory([], [], [], []);
      expect(slides[0].type).toBe('intro');
    });

    it('should always include outro slide as last', () => {
      const slides = generateWeeklyStory([], [], [], []);
      expect(slides[slides.length - 1].type).toBe('outro');
    });

    it('should have gradient and accentColor on every slide', () => {
      const weekDates = getCurrentWeekDates();
      const moods = weekDates.map(d => makeMood('good', d));
      const habits = [makeHabit('h1', 'Exercise', weekDates)];
      const focus = weekDates.map(d => makeFocusSession(d, 25));
      const gratitude = weekDates.map(d => makeGratitude(d));

      const slides = generateWeeklyStory(moods, habits, focus, gratitude, [], 5);
      slides.forEach(slide => {
        expect(slide).toHaveProperty('gradient');
        // SLIDE_GRADIENTS spreads { gradient, accent } onto each slide
        expect(slide).toHaveProperty('accent');
        expect(typeof slide.gradient).toBe('string');
      });
    });

    it('should produce only intro + outro with empty data', () => {
      const slides = generateWeeklyStory([], [], [], []);
      expect(slides.length).toBe(2);
      expect(slides[0].type).toBe('intro');
      expect(slides[1].type).toBe('outro');
    });

    it('should include mood slide when moods exist in current week', () => {
      const weekDates = getCurrentWeekDates();
      const moods = weekDates.slice(0, 3).map(d => makeMood('good', d));

      const slides = generateWeeklyStory(moods, [], [], []);
      const moodSlide = slides.find(s => s.type === 'mood');
      expect(moodSlide).toBeDefined();
      expect(moodSlide.title).toBeDefined();
    });

    it('should include habit slide when habits have completions', () => {
      const weekDates = getCurrentWeekDates();
      const habits = [makeHabit('h1', 'Exercise', weekDates.slice(0, 3), '💪')];

      const slides = generateWeeklyStory([], habits, [], []);
      const habitSlide = slides.find(s => s.type === 'habits');
      expect(habitSlide).toBeDefined();
      expect(habitSlide.value).toBeDefined();
    });

    it('should not include habit slide when no completions in current week', () => {
      const habits = [makeHabit('h1', 'Exercise', ['2025-01-01'])];

      const slides = generateWeeklyStory([], habits, [], []);
      const habitSlide = slides.find(s => s.type === 'habits');
      expect(habitSlide).toBeUndefined();
    });

    it('should include focus slide when focus sessions exist', () => {
      const weekDates = getCurrentWeekDates();
      const focus = [
        makeFocusSession(weekDates[0], 25),
        makeFocusSession(weekDates[1], 30),
      ];

      const slides = generateWeeklyStory([], [], focus, []);
      const focusSlide = slides.find(s => s.type === 'focus');
      expect(focusSlide).toBeDefined();
    });

    it('should exclude aborted focus sessions from stats', () => {
      const weekDates = getCurrentWeekDates();
      const focus = [
        makeFocusSession(weekDates[0], 25, 'completed'),
        makeFocusSession(weekDates[1], 30, 'aborted'),
      ];

      const slides = generateWeeklyStory([], [], focus, []);
      const focusSlide = slides.find(s => s.type === 'focus');
      expect(focusSlide).toBeDefined();
      // 1 completed session
      expect(focusSlide.subtitle).toContain('1');
    });

    it('should include gratitude slide when entries exist', () => {
      const weekDates = getCurrentWeekDates();
      const gratitude = weekDates.slice(0, 2).map(d => makeGratitude(d));

      const slides = generateWeeklyStory([], [], [], gratitude);
      const gratitudeSlide = slides.find(s => s.type === 'gratitude');
      expect(gratitudeSlide).toBeDefined();
      expect(gratitudeSlide.value).toBe(2);
    });

    it('should include streak slide when streak > 0', () => {
      const slides = generateWeeklyStory([], [], [], [], [], 7);
      const streakSlide = slides.find(s => s.type === 'streak');
      expect(streakSlide).toBeDefined();
      expect(streakSlide.value).toBe(7);
    });

    it('should not include streak slide when streak is 0', () => {
      const slides = generateWeeklyStory([], [], [], [], [], 0);
      const streakSlide = slides.find(s => s.type === 'streak');
      expect(streakSlide).toBeUndefined();
    });

    it('should show correct streak text for different streak levels', () => {
      // streak >= 30 -> Legendary
      const slides30 = generateWeeklyStory([], [], [], [], [], 30);
      const streak30 = slides30.find(s => s.type === 'streak');
      expect(streak30.subtitle).toContain('Legendary');

      // streak >= 14 -> Amazing
      const slides14 = generateWeeklyStory([], [], [], [], [], 14);
      const streak14 = slides14.find(s => s.type === 'streak');
      expect(streak14.subtitle).toContain('Amazing');

      // streak >= 7 -> On Fire
      const slides7 = generateWeeklyStory([], [], [], [], [], 7);
      const streak7 = slides7.find(s => s.type === 'streak');
      expect(streak7.subtitle).toContain('Fire');

      // streak < 7 -> Keep Going
      const slides3 = generateWeeklyStory([], [], [], [], [], 3);
      const streak3 = slides3.find(s => s.type === 'streak');
      expect(streak3.subtitle).toContain('Keep Going');
    });

    it('should include achievement slide when new badges exist', () => {
      const badges = [makeBadge('badge-1'), makeBadge('badge-2')];
      const slides = generateWeeklyStory([], [], [], [], badges);
      const achievementSlide = slides.find(s => s.type === 'achievement');
      expect(achievementSlide).toBeDefined();
      expect(achievementSlide.value).toBe(2);
    });

    it('should not include achievement slide when no badges', () => {
      const slides = generateWeeklyStory([], [], [], [], []);
      const achievementSlide = slides.find(s => s.type === 'achievement');
      expect(achievementSlide).toBeUndefined();
    });

    it('should include summary slide when there is data', () => {
      const weekDates = getCurrentWeekDates();
      const moods = [makeMood('good', weekDates[0])];

      const slides = generateWeeklyStory(moods, [], [], []);
      const summarySlide = slides.find(s => s.type === 'summary');
      expect(summarySlide).toBeDefined();
      expect(summarySlide.subtitle).toContain('avg mood');
    });

    it('should use provided translations', () => {
      const translations = {
        weeklyReview: 'Custom Title',
        keepGrowing: 'Custom Outro',
      };
      const slides = generateWeeklyStory([], [], [], [], [], 0, translations);
      expect(slides[0].title).toBe('Custom Title');
      expect(slides[slides.length - 1].title).toBe('Custom Outro');
    });

    it('should use fallback English when no translations provided', () => {
      const slides = generateWeeklyStory([], [], [], []);
      expect(slides[0].title).toBe('Your Week in Review');
      expect(slides[slides.length - 1].title).toBe('Keep Growing!');
    });
  });
});
