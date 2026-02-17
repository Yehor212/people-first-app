import { describe, it, expect, vi } from 'vitest';

vi.mock('../validation', () => ({
  generateSecureId: vi.fn(() => 'test-challenge-id'),
}));

vi.mock('../utils', () => ({
  formatDate: vi.fn(() => '2026-02-17'),
}));

import {
  challengeTemplates,
  createChallengeFromTemplate,
  getHabitChallenges,
  getAvailableChallenges,
} from '../challenges';
import type { Challenge } from '@/types';

// ============================================
// challengeTemplates
// ============================================
describe('challengeTemplates', () => {
  it('contains exactly 9 templates', () => {
    expect(challengeTemplates).toHaveLength(9);
  });

  it('every template has required fields', () => {
    for (const tpl of challengeTemplates) {
      expect(tpl).toHaveProperty('type');
      expect(tpl).toHaveProperty('target');
      expect(tpl).toHaveProperty('icon');
      expect(tpl).toHaveProperty('title');
      expect(tpl).toHaveProperty('description');
      expect(tpl).toHaveProperty('reward');
    }
  });

  it('contains templates of all four types', () => {
    const types = new Set(challengeTemplates.map(t => t.type));
    expect(types).toContain('streak');
    expect(types).toContain('focus');
    expect(types).toContain('gratitude');
    expect(types).toContain('total');
  });

  it('every template title and description has an "en" key', () => {
    for (const tpl of challengeTemplates) {
      expect(tpl.title).toHaveProperty('en');
      expect(tpl.description).toHaveProperty('en');
      expect(typeof tpl.title.en).toBe('string');
      expect(typeof tpl.description.en).toBe('string');
    }
  });
});

// ============================================
// createChallengeFromTemplate
// ============================================
describe('createChallengeFromTemplate', () => {
  it('creates a challenge with mocked id and startDate', () => {
    const challenge = createChallengeFromTemplate(0);
    expect(challenge.id).toBe('test-challenge-id');
    expect(challenge.startDate).toBe('2026-02-17');
  });

  it('creates a challenge with progress=0 and completed=false', () => {
    const challenge = createChallengeFromTemplate(0);
    expect(challenge.progress).toBe(0);
    expect(challenge.completed).toBe(false);
  });

  it('copies type, target, icon, title, description, reward from template', () => {
    const template = challengeTemplates[0];
    const challenge = createChallengeFromTemplate(0);
    expect(challenge.type).toBe(template.type);
    expect(challenge.target).toBe(template.target);
    expect(challenge.icon).toBe(template.icon);
    expect(challenge.title).toEqual(template.title);
    expect(challenge.description).toEqual(template.description);
    expect(challenge.reward).toBe(template.reward);
  });

  it('sets habitId when provided', () => {
    const challenge = createChallengeFromTemplate(1, 'my-habit-123');
    expect(challenge.habitId).toBe('my-habit-123');
  });

  it('has undefined habitId when not provided', () => {
    const challenge = createChallengeFromTemplate(2);
    expect(challenge.habitId).toBeUndefined();
  });
});

// ============================================
// getHabitChallenges
// ============================================
describe('getHabitChallenges', () => {
  const challenges: Challenge[] = [
    { id: 'c1', type: 'streak', habitId: 'h1', target: 7, progress: 3, startDate: '2026-01-01', completed: false, icon: '🔥', title: { en: 'T1' }, description: { en: 'D1' } },
    { id: 'c2', type: 'streak', habitId: 'h1', target: 30, progress: 30, startDate: '2025-12-01', completed: true, icon: '🌟', title: { en: 'T2' }, description: { en: 'D2' } },
    { id: 'c3', type: 'focus', habitId: 'h2', target: 300, progress: 100, startDate: '2026-01-15', completed: false, icon: '🎯', title: { en: 'T3' }, description: { en: 'D3' } },
  ];

  it('returns only active (non-completed) challenges for the given habitId', () => {
    const result = getHabitChallenges('h1', challenges);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('returns empty array when habitId has no active challenges', () => {
    const result = getHabitChallenges('h999', challenges);
    expect(result).toEqual([]);
  });

  it('excludes completed challenges', () => {
    const result = getHabitChallenges('h1', challenges);
    expect(result.every(c => !c.completed)).toBe(true);
  });
});

// ============================================
// getAvailableChallenges
// ============================================
describe('getAvailableChallenges', () => {
  it('returns all templates when no type filter is provided', () => {
    const result = getAvailableChallenges();
    expect(result).toHaveLength(9);
  });

  it('returns only streak templates when filtered by "streak"', () => {
    const result = getAvailableChallenges('streak');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(t => t.type === 'streak')).toBe(true);
  });

  it('returns only focus templates when filtered by "focus"', () => {
    const result = getAvailableChallenges('focus');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(t => t.type === 'focus')).toBe(true);
  });

  it('returns only gratitude templates when filtered by "gratitude"', () => {
    const result = getAvailableChallenges('gratitude');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(t => t.type === 'gratitude')).toBe(true);
  });

  it('returns only total templates when filtered by "total"', () => {
    const result = getAvailableChallenges('total');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(t => t.type === 'total')).toBe(true);
  });
});
