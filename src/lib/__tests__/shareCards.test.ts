/**
 * Unit tests for share card types, constants, and utility helpers
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CARD_TRANSLATIONS,
} from '../shareCards';
import type {
  ShareCardType,
  ShareCardData,
  WeeklyProgressData,
  TrophyShareData,
  ShareCardTranslations,
} from '../shareCards';

describe('shareCards', () => {
  describe('DEFAULT_CARD_TRANSLATIONS', () => {
    it('has all required translation keys', () => {
      const expectedKeys: (keyof ShareCardTranslations)[] = [
        'dayStreak',
        'weeklyReview',
        'mood',
        'habits',
        'focus',
        'streak',
        'days',
        'newAchievements',
        'trackHabits',
        'moodGreat',
        'moodGood',
        'moodOkay',
        'moodLow',
        'moodTough',
      ];
      for (const key of expectedKeys) {
        expect(DEFAULT_CARD_TRANSLATIONS).toHaveProperty(key);
      }
    });

    it('all translation values are non-empty strings', () => {
      for (const value of Object.values(DEFAULT_CARD_TRANSLATIONS)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    });

    it('dayStreak is uppercase (card label convention)', () => {
      expect(DEFAULT_CARD_TRANSLATIONS.dayStreak).toBe('DAY STREAK');
    });

    it('weeklyReview is uppercase (card label convention)', () => {
      expect(DEFAULT_CARD_TRANSLATIONS.weeklyReview).toBe('WEEKLY REVIEW');
    });

    it('newAchievements is uppercase (card label convention)', () => {
      expect(DEFAULT_CARD_TRANSLATIONS.newAchievements).toBe('NEW ACHIEVEMENTS');
    });

    it('has exactly 14 translation keys', () => {
      expect(Object.keys(DEFAULT_CARD_TRANSLATIONS)).toHaveLength(14);
    });
  });

  describe('ShareCardType', () => {
    it('accepts valid card types', () => {
      const validTypes: ShareCardType[] = ['achievement', 'streak', 'progress', 'weekly'];
      expect(validTypes).toHaveLength(4);
    });
  });

  describe('ShareCardData shape', () => {
    it('can construct a minimal ShareCardData object', () => {
      const data: ShareCardData = {
        type: 'achievement',
        title: 'Test Title',
      };
      expect(data.type).toBe('achievement');
      expect(data.title).toBe('Test Title');
    });

    it('supports all optional fields', () => {
      const data: ShareCardData = {
        type: 'streak',
        title: 'Streak Card',
        subtitle: 'Keep going!',
        icon: '🔥',
        value: 42,
        username: 'testuser',
        date: '2026-01-01',
        rarity: 'legendary',
        stats: [{ label: 'Days', value: 30 }],
      };
      expect(data.subtitle).toBe('Keep going!');
      expect(data.icon).toBe('🔥');
      expect(data.value).toBe(42);
      expect(data.rarity).toBe('legendary');
      expect(data.stats).toHaveLength(1);
    });
  });

  describe('WeeklyProgressData shape', () => {
    it('can construct a valid WeeklyProgressData object', () => {
      const data: WeeklyProgressData = {
        weekRange: 'Jan 1 - Jan 7',
        moodAverage: 3.5,
        habitsCompleted: 10,
        habitsTotal: 14,
        focusMinutes: 120,
        streak: 7,
        newBadges: [],
      };
      expect(data.weekRange).toBe('Jan 1 - Jan 7');
      expect(data.moodAverage).toBe(3.5);
      expect(data.habitsCompleted).toBe(10);
      expect(data.habitsTotal).toBe(14);
      expect(data.focusMinutes).toBe(120);
      expect(data.streak).toBe(7);
      expect(data.newBadges).toEqual([]);
    });
  });

  describe('TrophyShareData shape', () => {
    it('can construct a valid TrophyShareData object', () => {
      const data: TrophyShareData = {
        streak: 30,
        focusMinutes: 600,
        habitsCompleted: 50,
      };
      expect(data.streak).toBe(30);
      expect(data.focusMinutes).toBe(600);
      expect(data.habitsCompleted).toBe(50);
    });
  });
});
