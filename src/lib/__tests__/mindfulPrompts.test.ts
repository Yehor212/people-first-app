import { describe, it, expect } from 'vitest';
import {
  ALL_MINDFUL_PROMPTS,
  MINDFUL_TYPE_LABELS,
  getRandomMindfulPrompt,
  getMindfulPromptText,
  getPostFocusPrompts,
  getRandomPostFocusPrompt,
} from '../mindfulPrompts';
import type { MindfulMomentType, MindfulPrompt } from '../mindfulPrompts';

const ALL_TYPES: MindfulMomentType[] = ['checkin', 'breathing', 'gratitude', 'body', 'affirmation'];

// ============================================
// ALL_MINDFUL_PROMPTS
// ============================================

describe('ALL_MINDFUL_PROMPTS', () => {
  it('is a non-empty array', () => {
    expect(ALL_MINDFUL_PROMPTS.length).toBeGreaterThan(0);
  });

  it('each prompt has required fields: id, type, duration, text', () => {
    for (const prompt of ALL_MINDFUL_PROMPTS) {
      expect(prompt.id).toBeDefined();
      expect(typeof prompt.id).toBe('string');
      expect(ALL_TYPES).toContain(prompt.type);
      expect(typeof prompt.duration).toBe('number');
      expect(prompt.duration).toBeGreaterThan(0);
      expect(prompt.text).toBeDefined();
      expect(typeof prompt.text.en).toBe('string');
    }
  });

  it('contains prompts of every type', () => {
    for (const type of ALL_TYPES) {
      const found = ALL_MINDFUL_PROMPTS.some(p => p.type === type);
      expect(found).toBe(true);
    }
  });
});

// ============================================
// MINDFUL_TYPE_LABELS
// ============================================

describe('MINDFUL_TYPE_LABELS', () => {
  it('has labels for all MindfulMomentType values', () => {
    for (const type of ALL_TYPES) {
      expect(MINDFUL_TYPE_LABELS[type]).toBeDefined();
      expect(typeof MINDFUL_TYPE_LABELS[type].en).toBe('string');
    }
  });

  it('has English labels for every type', () => {
    expect(MINDFUL_TYPE_LABELS.checkin.en).toBe('Check-in');
    expect(MINDFUL_TYPE_LABELS.breathing.en).toBe('Breathe');
    expect(MINDFUL_TYPE_LABELS.gratitude.en).toBe('Gratitude');
    expect(MINDFUL_TYPE_LABELS.body.en).toBe('Body');
    expect(MINDFUL_TYPE_LABELS.affirmation.en).toBe('Affirmation');
  });
});

// ============================================
// getRandomMindfulPrompt
// ============================================

describe('getRandomMindfulPrompt', () => {
  it('returns a prompt from the array', () => {
    const prompt = getRandomMindfulPrompt();
    expect(prompt).toBeDefined();
    expect(prompt.id).toBeDefined();
    expect(ALL_MINDFUL_PROMPTS).toContainEqual(prompt);
  });

  it('returns matching type when type filter is provided', () => {
    const prompt = getRandomMindfulPrompt('breathing');
    expect(prompt.type).toBe('breathing');
  });

  it('returns matching type for gratitude filter', () => {
    const prompt = getRandomMindfulPrompt('gratitude');
    expect(prompt.type).toBe('gratitude');
  });
});

// ============================================
// getMindfulPromptText
// ============================================

describe('getMindfulPromptText', () => {
  it('returns English text for "en" lang', () => {
    const prompt = ALL_MINDFUL_PROMPTS[0];
    const text = getMindfulPromptText(prompt, 'en');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
    expect(text).toBe(prompt.text.en);
  });

  it('returns Ukrainian text for "uk" lang', () => {
    const prompt = ALL_MINDFUL_PROMPTS[0];
    const text = getMindfulPromptText(prompt, 'uk');
    expect(text).toBe(prompt.text.uk);
  });

  it('falls back to English for unknown language', () => {
    const prompt = ALL_MINDFUL_PROMPTS[0];
    const text = getMindfulPromptText(prompt, 'zz');
    expect(text).toBe(prompt.text.en);
  });
});

// ============================================
// getPostFocusPrompts
// ============================================

describe('getPostFocusPrompts', () => {
  it('returns a non-empty subset', () => {
    const prompts = getPostFocusPrompts();
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.length).toBeLessThanOrEqual(ALL_MINDFUL_PROMPTS.length);
  });

  it('only contains breathing, body, or affirmation types', () => {
    const prompts = getPostFocusPrompts();
    const allowedTypes: MindfulMomentType[] = ['breathing', 'body', 'affirmation'];
    for (const prompt of prompts) {
      expect(allowedTypes).toContain(prompt.type);
    }
  });

  it('does not contain checkin or gratitude prompts', () => {
    const prompts = getPostFocusPrompts();
    const excluded = prompts.filter(p => p.type === 'checkin' || p.type === 'gratitude');
    expect(excluded.length).toBe(0);
  });
});

// ============================================
// getRandomPostFocusPrompt
// ============================================

describe('getRandomPostFocusPrompt', () => {
  it('returns a prompt from the post-focus subset', () => {
    const prompt = getRandomPostFocusPrompt();
    const allowedTypes: MindfulMomentType[] = ['breathing', 'body', 'affirmation'];
    expect(allowedTypes).toContain(prompt.type);
  });
});
