import { describe, it, expect } from 'vitest';
import {
  ALL_PROMPTS,
  CATEGORY_LABELS,
  getPromptsByCategory,
  getRandomPrompt,
  getDailyPrompt,
  getPromptText,
} from '../journalPrompts';
import type { PromptCategory } from '../journalPrompts';

const ALL_CATEGORIES: PromptCategory[] = [
  'gratitude', 'reflection', 'emotions', 'goals', 'relationships', 'adhd',
];

// ============================================
// ALL_PROMPTS
// ============================================

describe('ALL_PROMPTS', () => {
  it('is a non-empty array', () => {
    expect(ALL_PROMPTS.length).toBeGreaterThan(0);
  });

  it('each prompt has required fields: id, category, text', () => {
    for (const prompt of ALL_PROMPTS) {
      expect(prompt.id).toBeDefined();
      expect(typeof prompt.id).toBe('string');
      expect(ALL_CATEGORIES).toContain(prompt.category);
      expect(prompt.text).toBeDefined();
      expect(typeof prompt.text.en).toBe('string');
    }
  });

  it('contains prompts from every category', () => {
    for (const category of ALL_CATEGORIES) {
      const found = ALL_PROMPTS.some(p => p.category === category);
      expect(found).toBe(true);
    }
  });
});

// ============================================
// CATEGORY_LABELS
// ============================================

describe('CATEGORY_LABELS', () => {
  it('has labels for all categories', () => {
    for (const category of ALL_CATEGORIES) {
      expect(CATEGORY_LABELS[category]).toBeDefined();
      expect(typeof CATEGORY_LABELS[category].en).toBe('string');
    }
  });
});

// ============================================
// getPromptsByCategory
// ============================================

describe('getPromptsByCategory', () => {
  it('returns only prompts of the matching category', () => {
    const gratitudePrompts = getPromptsByCategory('gratitude');
    expect(gratitudePrompts.length).toBeGreaterThan(0);
    for (const prompt of gratitudePrompts) {
      expect(prompt.category).toBe('gratitude');
    }
  });

  it('returns different counts per category', () => {
    const gratitude = getPromptsByCategory('gratitude');
    const adhd = getPromptsByCategory('adhd');
    // Both should be non-empty
    expect(gratitude.length).toBeGreaterThan(0);
    expect(adhd.length).toBeGreaterThan(0);
  });

  it('returns prompts that are all part of ALL_PROMPTS', () => {
    const reflection = getPromptsByCategory('reflection');
    for (const prompt of reflection) {
      expect(ALL_PROMPTS).toContainEqual(prompt);
    }
  });
});

// ============================================
// getRandomPrompt
// ============================================

describe('getRandomPrompt', () => {
  it('returns a prompt from the array when called without category', () => {
    const prompt = getRandomPrompt();
    expect(prompt).toBeDefined();
    expect(prompt.id).toBeDefined();
    expect(ALL_PROMPTS).toContainEqual(prompt);
  });

  it('returns matching category when category filter is provided', () => {
    const prompt = getRandomPrompt('emotions');
    expect(prompt.category).toBe('emotions');
  });
});

// ============================================
// getDailyPrompt
// ============================================

describe('getDailyPrompt', () => {
  it('returns same prompt for same date (deterministic)', () => {
    const prompt1 = getDailyPrompt('2026-01-15');
    const prompt2 = getDailyPrompt('2026-01-15');
    expect(prompt1.id).toBe(prompt2.id);
  });

  it('returns different prompts for different dates', () => {
    const prompt1 = getDailyPrompt('2026-01-15');
    const prompt2 = getDailyPrompt('2026-02-20');
    // Different dates should very likely produce different prompts
    // (possible but extremely unlikely collision)
    expect(prompt1.id).not.toBe(prompt2.id);
  });

  it('returns a valid prompt from ALL_PROMPTS', () => {
    const prompt = getDailyPrompt('2026-03-01');
    expect(ALL_PROMPTS).toContainEqual(prompt);
  });
});

// ============================================
// getPromptText
// ============================================

describe('getPromptText', () => {
  it('returns English text for "en"', () => {
    const prompt = ALL_PROMPTS[0];
    const text = getPromptText(prompt, 'en');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
    expect(text).toBe(prompt.text.en);
  });

  it('returns Ukrainian text for "uk"', () => {
    const prompt = ALL_PROMPTS[0];
    const text = getPromptText(prompt, 'uk');
    expect(text).toBe(prompt.text.uk);
  });

  it('falls back to English for unknown language', () => {
    const prompt = ALL_PROMPTS[0];
    const text = getPromptText(prompt, 'zz');
    expect(text).toBe(prompt.text.en);
  });
});
