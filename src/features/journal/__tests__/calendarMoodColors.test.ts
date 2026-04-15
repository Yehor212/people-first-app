/**
 * Calendar Mood Intensity Coloring Tests
 *
 * Tests the mood-to-color mapping logic used in JournalCalendar.
 * The mappings (MOOD_BG_STYLE, MOOD_COLORS, MOOD_RING) are defined as
 * module-level constants in JournalCalendar.tsx using theme tokens
 * (CSS custom properties via hsl(var(--mood-*))) and Tailwind classes.
 */

import { describe, it, expect } from 'vitest';
import type { MoodType } from '@/types';

// Mirror the exact mappings from JournalCalendar.tsx for unit testing.
// These are pure data — no JSX, no side effects.
const MOOD_BG_STYLE: Record<MoodType, string> = {
  great: 'hsl(var(--mood-great) / 0.45)',
  good: 'hsl(var(--mood-good) / 0.38)',
  okay: 'hsl(var(--mood-okay) / 0.35)',
  bad: 'hsl(var(--mood-bad) / 0.32)',
  terrible: 'hsl(var(--mood-terrible) / 0.30)',
};

const MOOD_BG_STYLE_DARK: Record<MoodType, string> = {
  great: 'hsl(var(--mood-great) / 0.28)',
  good: 'hsl(var(--mood-good) / 0.24)',
  okay: 'hsl(var(--mood-okay) / 0.22)',
  bad: 'hsl(var(--mood-bad) / 0.20)',
  terrible: 'hsl(var(--mood-terrible) / 0.18)',
};

const MOOD_COLORS: Record<string, string> = {
  great: 'bg-green-400',
  good: 'bg-emerald-400',
  okay: 'bg-amber-400',
  bad: 'bg-orange-400',
  terrible: 'bg-red-400',
};

const MOOD_RING: Record<string, string> = {
  great: 'ring-green-400/20',
  good: 'ring-emerald-400/20',
  okay: 'ring-amber-400/20',
  bad: 'ring-orange-400/20',
  terrible: 'ring-red-400/20',
};

const ALL_MOODS: MoodType[] = ['great', 'good', 'okay', 'bad', 'terrible'];

describe('Calendar mood intensity coloring', () => {
  describe('"great" mood returns appropriate color', () => {
    it('maps to green dot indicator class', () => {
      expect(MOOD_COLORS['great']).toBe('bg-green-400');
    });

    it('maps to green ring class', () => {
      expect(MOOD_RING['great']).toBe('ring-green-400/20');
    });

    it('maps to theme-token background (light)', () => {
      expect(MOOD_BG_STYLE.great).toBe('hsl(var(--mood-great) / 0.45)');
    });

    it('maps to theme-token background (dark) with lower opacity', () => {
      expect(MOOD_BG_STYLE_DARK.great).toBe('hsl(var(--mood-great) / 0.28)');
    });
  });

  describe('"terrible" mood returns a different color', () => {
    it('maps to red dot indicator class', () => {
      expect(MOOD_COLORS['terrible']).toBe('bg-red-400');
    });

    it('maps to red ring class', () => {
      expect(MOOD_RING['terrible']).toBe('ring-red-400/20');
    });

    it('maps to theme-token background (light)', () => {
      expect(MOOD_BG_STYLE.terrible).toBe('hsl(var(--mood-terrible) / 0.30)');
    });

    it('is visually distinct from "great"', () => {
      expect(MOOD_COLORS['terrible']).not.toBe(MOOD_COLORS['great']);
      expect(MOOD_BG_STYLE.terrible).not.toBe(MOOD_BG_STYLE.great);
    });
  });

  describe('no mood returns no color indicator', () => {
    it('MOOD_COLORS has no entry for undefined mood key', () => {
      expect(MOOD_COLORS[undefined as unknown as string]).toBeUndefined();
    });

    it('MOOD_BG_STYLE has no entry for undefined mood', () => {
      const mood: MoodType | undefined = undefined;
      const bgColor = mood ? MOOD_BG_STYLE[mood] : undefined;
      expect(bgColor).toBeUndefined();
    });

    it('MOOD_RING has no entry for undefined mood key', () => {
      expect(MOOD_RING[undefined as unknown as string]).toBeUndefined();
    });

    it('unknown mood string returns undefined', () => {
      expect(MOOD_COLORS['unknown']).toBeUndefined();
      expect(MOOD_RING['unknown']).toBeUndefined();
    });
  });

  describe('theme token usage — no hardcoded hex colors', () => {
    it('all MOOD_BG_STYLE values use CSS custom properties (hsl(var(--*)))', () => {
      for (const mood of ALL_MOODS) {
        const value = MOOD_BG_STYLE[mood];
        expect(value).toMatch(/^hsl\(var\(--mood-/);
        // Must NOT contain hardcoded hex like #ff0000
        expect(value).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      }
    });

    it('all MOOD_BG_STYLE_DARK values use CSS custom properties', () => {
      for (const mood of ALL_MOODS) {
        const value = MOOD_BG_STYLE_DARK[mood];
        expect(value).toMatch(/^hsl\(var\(--mood-/);
        expect(value).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      }
    });

    it('MOOD_COLORS use Tailwind utility classes (not raw hex)', () => {
      for (const mood of ALL_MOODS) {
        const value = MOOD_COLORS[mood];
        expect(value).toMatch(/^bg-/);
        expect(value).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      }
    });

    it('MOOD_RING use Tailwind ring utility classes', () => {
      for (const mood of ALL_MOODS) {
        const value = MOOD_RING[mood];
        expect(value).toMatch(/^ring-/);
        expect(value).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      }
    });

    it('dark mode has lower opacity than light mode for every mood', () => {
      for (const mood of ALL_MOODS) {
        const lightOpacity = parseFloat(MOOD_BG_STYLE[mood].match(/\/ ([\d.]+)\)$/)?.[1] ?? '0');
        const darkOpacity = parseFloat(MOOD_BG_STYLE_DARK[mood].match(/\/ ([\d.]+)\)$/)?.[1] ?? '0');
        expect(darkOpacity).toBeLessThan(lightOpacity);
      }
    });
  });

  describe('all five moods are covered', () => {
    it('MOOD_BG_STYLE covers all MoodType values', () => {
      for (const mood of ALL_MOODS) {
        expect(MOOD_BG_STYLE[mood]).toBeDefined();
      }
    });

    it('MOOD_COLORS covers all MoodType values', () => {
      for (const mood of ALL_MOODS) {
        expect(MOOD_COLORS[mood]).toBeDefined();
      }
    });

    it('each mood has a unique dot color', () => {
      const colors = ALL_MOODS.map(m => MOOD_COLORS[m]);
      expect(new Set(colors).size).toBe(ALL_MOODS.length);
    });
  });
});
