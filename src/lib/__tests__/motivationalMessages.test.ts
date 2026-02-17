import { describe, it, expect } from 'vitest';
import {
  streakMessages,
  getStreakMessage,
  shouldShowStreakMessage,
} from '../motivationalMessages';
import type { Language } from '@/i18n/types';

// ============================================
// streakMessages
// ============================================

describe('streakMessages', () => {
  it('has entries for key milestones', () => {
    const milestones = [3, 7, 14, 30, 50, 100, 365];
    for (const milestone of milestones) {
      expect(streakMessages[milestone]).toBeDefined();
      expect(streakMessages[milestone].emoji).toBeDefined();
      expect(streakMessages[milestone].title).toBeDefined();
      expect(streakMessages[milestone].message).toBeDefined();
    }
  });

  it('each message has English title and message', () => {
    for (const key of Object.keys(streakMessages)) {
      const msg = streakMessages[Number(key)];
      expect(typeof msg.title.en).toBe('string');
      expect(msg.title.en.length).toBeGreaterThan(0);
      expect(typeof msg.message.en).toBe('string');
      expect(msg.message.en.length).toBeGreaterThan(0);
    }
  });

  it('each message has all 8 languages in title and message', () => {
    const languages: Language[] = ['en', 'uk', 'es', 'de', 'fr', 'ja', 'ar', 'he'];
    for (const key of Object.keys(streakMessages)) {
      const msg = streakMessages[Number(key)];
      for (const lang of languages) {
        expect(msg.title[lang]).toBeDefined();
        expect(msg.message[lang]).toBeDefined();
      }
    }
  });
});

// ============================================
// getStreakMessage
// ============================================

describe('getStreakMessage', () => {
  it('returns StreakMessage for exact milestone', () => {
    const msg = getStreakMessage(7, 'en');
    expect(msg).not.toBeNull();
    expect(msg?.emoji).toBe('⭐');
  });

  it('returns nearest passed milestone for non-milestone streak', () => {
    const msg = getStreakMessage(10, 'en');
    // Nearest passed milestone is 7
    expect(msg).not.toBeNull();
    expect(msg?.emoji).toBe('⭐');
  });

  it('returns null for streak below first milestone', () => {
    const msg = getStreakMessage(1, 'en');
    expect(msg).toBeNull();
  });

  it('returns 30-day milestone for streak of 30', () => {
    const msg = getStreakMessage(30, 'en');
    expect(msg).not.toBeNull();
    expect(msg?.title.en).toContain('Month');
  });

  it('returns 365-day milestone for exact year', () => {
    const msg = getStreakMessage(365, 'en');
    expect(msg).not.toBeNull();
    expect(msg?.emoji).toBe('🎉');
  });
});

// ============================================
// shouldShowStreakMessage
// ============================================

describe('shouldShowStreakMessage', () => {
  it('returns true when streak just hit a milestone and was not previously shown', () => {
    expect(shouldShowStreakMessage(7, 3)).toBe(true);
  });

  it('returns false when streak already shown at that milestone', () => {
    expect(shouldShowStreakMessage(7, 7)).toBe(false);
  });

  it('returns false when streak is not a milestone', () => {
    expect(shouldShowStreakMessage(5, 3)).toBe(false);
  });

  it('returns true when hitting 3-day milestone from 0', () => {
    expect(shouldShowStreakMessage(3, 0)).toBe(true);
  });

  it('returns false when lastShownStreak equals or exceeds milestone', () => {
    expect(shouldShowStreakMessage(14, 14)).toBe(false);
    expect(shouldShowStreakMessage(14, 15)).toBe(false);
  });
});
