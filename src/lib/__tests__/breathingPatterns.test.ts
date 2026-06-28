import { describe, it, expect } from 'vitest';
import {
  BREATHING_PATTERNS,
  getPhaseInstruction,
  getTotalDuration,
  formatDuration,
} from '../breathingPatterns';
import type { BreathingPattern } from '../breathingPatterns';

// ============================================
// BREATHING_PATTERNS
// ============================================

describe('BREATHING_PATTERNS', () => {
  it('is a non-empty array', () => {
    expect(BREATHING_PATTERNS.length).toBeGreaterThan(0);
  });

  it('each pattern has required fields', () => {
    for (const pattern of BREATHING_PATTERNS) {
      expect(pattern.id).toBeDefined();
      expect(typeof pattern.id).toBe('string');
      expect(pattern.name).toBeDefined();
      expect(typeof pattern.name).toBe('string');
      expect(typeof pattern.inhale).toBe('number');
      expect(typeof pattern.holdAfterInhale).toBe('number');
      expect(typeof pattern.exhale).toBe('number');
      expect(typeof pattern.holdAfterExhale).toBe('number');
      expect(typeof pattern.cycles).toBe('number');
      expect(pattern.cycles).toBeGreaterThan(0);
    }
  });

  it('each pattern has a valid effect type', () => {
    const validEffects = ['calming', 'energizing', 'focusing', 'sleeping'];
    for (const pattern of BREATHING_PATTERNS) {
      expect(validEffects).toContain(pattern.effect);
    }
  });

  it('includes the box breathing pattern', () => {
    const box = BREATHING_PATTERNS.find(p => p.id === 'box');
    expect(box).toBeDefined();
    expect(box?.inhale).toBe(4);
    expect(box?.holdAfterInhale).toBe(4);
    expect(box?.exhale).toBe(4);
    expect(box?.holdAfterExhale).toBe(4);
  });
});

// ============================================
// getPhaseInstruction
// ============================================

describe('getPhaseInstruction', () => {
  const translations: Record<string, string> = {
    breatheIn: 'Breathe in',
    hold: 'Hold',
    breatheOut: 'Breathe out',
    complete: 'Complete',
  };

  it('returns correct instruction for inhale', () => {
    expect(getPhaseInstruction('inhale', translations)).toBe('Breathe in');
  });

  it('returns correct instruction for holdIn', () => {
    expect(getPhaseInstruction('holdIn', translations)).toBe('Hold');
  });

  it('returns correct instruction for exhale', () => {
    expect(getPhaseInstruction('exhale', translations)).toBe('Breathe out');
  });

  it('returns correct instruction for holdOut', () => {
    expect(getPhaseInstruction('holdOut', translations)).toBe('Hold');
  });

  it('returns correct instruction for complete', () => {
    expect(getPhaseInstruction('complete', translations)).toBe('Complete');
  });

  it('uses fallback text when translation keys are missing', () => {
    const emptyTranslations: Record<string, string> = {};
    expect(getPhaseInstruction('inhale', emptyTranslations)).toBe('Breathe in');
    expect(getPhaseInstruction('holdIn', emptyTranslations)).toBe('Hold');
    expect(getPhaseInstruction('exhale', emptyTranslations)).toBe('Breathe out');
    expect(getPhaseInstruction('complete', emptyTranslations)).toBe('Complete');
  });
});

// ============================================
// getTotalDuration
// ============================================

describe('getTotalDuration', () => {
  it('calculates total = (inhale + holdAfterInhale + exhale + holdAfterExhale) * cycles', () => {
    const box = BREATHING_PATTERNS.find(p => p.id === 'box');
    expect(box).toBeDefined();
    if (box) {
      // box: (4+4+4+4) * 4 = 64
      expect(getTotalDuration(box)).toBe(64);
    }
  });

  it('calculates correctly for 4-7-8 pattern', () => {
    const p478 = BREATHING_PATTERNS.find(p => p.id === '478');
    expect(p478).toBeDefined();
    if (p478) {
      // 478: (4+7+8+0) * 4 = 76
      expect(getTotalDuration(p478)).toBe(76);
    }
  });

  it('handles pattern with zero hold times', () => {
    const pattern: BreathingPattern = {
      id: 'test',
      name: 'Test',
      nameTranslationId: 'test',
      description: 'Test',
      descriptionTranslationId: 'testDesc',
      inhale: 3,
      holdAfterInhale: 0,
      exhale: 6,
      holdAfterExhale: 0,
      cycles: 5,
      effect: 'calming',
      emoji: '😌',
    };
    // (3+0+6+0) * 5 = 45
    expect(getTotalDuration(pattern)).toBe(45);
  });
});

// ============================================
// formatDuration
// ============================================

describe('formatDuration', () => {
  it('formats 0 seconds correctly', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('formats seconds-only durations', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('formats exact minutes without seconds', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(300)).toBe('5m');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(61)).toBe('1m 1s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(125)).toBe('2m 5s');
  });
});
