import { describe, it, expect } from 'vitest';
import {
  LOOP_PALETTE_LIGHT,
  LOOP_PALETTE_DARK,
  resolveHabitColor,
  migrateColorToIndex,
} from '@/lib/habitColorUtils';

// ─── Palette constants ───────────────────────────────────────────

describe('LOOP_PALETTE_LIGHT', () => {
  it('has exactly 20 colors', () => {
    expect(LOOP_PALETTE_LIGHT).toHaveLength(20);
  });

  it('contains valid hex strings', () => {
    for (const hex of LOOP_PALETTE_LIGHT) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('LOOP_PALETTE_DARK', () => {
  it('has exactly 20 colors', () => {
    expect(LOOP_PALETTE_DARK).toHaveLength(20);
  });

  it('contains valid hex strings', () => {
    for (const hex of LOOP_PALETTE_DARK) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('has same length as light palette', () => {
    expect(LOOP_PALETTE_DARK.length).toBe(LOOP_PALETTE_LIGHT.length);
  });
});

// ─── resolveHabitColor ───────────────────────────────────────────

describe('resolveHabitColor', () => {
  it('returns light palette color by default', () => {
    expect(resolveHabitColor(0)).toBe(LOOP_PALETTE_LIGHT[0]);
    expect(resolveHabitColor(0)).toBe('#D32F2F');
  });

  it('returns light palette color when isDark is false', () => {
    expect(resolveHabitColor(5, false)).toBe(LOOP_PALETTE_LIGHT[5]);
  });

  it('returns dark palette color when isDark is true', () => {
    expect(resolveHabitColor(0, true)).toBe(LOOP_PALETTE_DARK[0]);
    expect(resolveHabitColor(0, true)).toBe('#EF9A9A');
  });

  it('returns all valid indices (0-19) without fallback', () => {
    for (let i = 0; i < 20; i++) {
      expect(resolveHabitColor(i)).toBe(LOOP_PALETTE_LIGHT[i]);
      expect(resolveHabitColor(i, true)).toBe(LOOP_PALETTE_DARK[i]);
    }
  });

  it('falls back to index 8 (Teal) for out-of-range positive index', () => {
    expect(resolveHabitColor(20)).toBe(LOOP_PALETTE_LIGHT[8]);
    expect(resolveHabitColor(100)).toBe(LOOP_PALETTE_LIGHT[8]);
  });

  it('falls back to index 8 (Teal) for negative index', () => {
    expect(resolveHabitColor(-1)).toBe(LOOP_PALETTE_LIGHT[8]);
    expect(resolveHabitColor(-100)).toBe(LOOP_PALETTE_LIGHT[8]);
  });

  it('falls back to index 8 for NaN', () => {
    expect(resolveHabitColor(NaN)).toBe(LOOP_PALETTE_LIGHT[8]);
  });

  it('falls back correctly in dark mode too', () => {
    expect(resolveHabitColor(999, true)).toBe(LOOP_PALETTE_DARK[8]);
  });
});

// ─── migrateColorToIndex ─────────────────────────────────────────

describe('migrateColorToIndex', () => {
  it('returns direct match for exact light palette hex', () => {
    expect(migrateColorToIndex('#D32F2F')).toBe(0); // Red
    expect(migrateColorToIndex('#388E3C')).toBe(7); // Green
    expect(migrateColorToIndex('#9E9E9E')).toBe(19); // Grey
  });

  it('maps Tailwind class bg-primary to nearest palette index', () => {
    const idx = migrateColorToIndex('bg-primary');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(20);
  });

  it('maps Tailwind class bg-accent to nearest palette index', () => {
    const idx = migrateColorToIndex('bg-accent');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(20);
  });

  it('maps Tailwind class bg-mood-good to nearest palette index', () => {
    const idx = migrateColorToIndex('bg-mood-good');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(20);
  });

  it('finds nearest color for arbitrary hex', () => {
    // Pure red should map near index 0 (D32F2F)
    const idx = migrateColorToIndex('#FF0000');
    expect(idx).toBe(0);
  });

  it('finds nearest color for blue hex', () => {
    // Pure blue → should be near index 11 (1976D2)
    const idx = migrateColorToIndex('#0000FF');
    expect([11, 12]).toContain(idx); // 1976D2 or 303F9F
  });

  it('falls back to index 8 for invalid hex format', () => {
    expect(migrateColorToIndex('not-a-color')).toBe(8);
    expect(migrateColorToIndex('#GGG')).toBe(8);
    expect(migrateColorToIndex('')).toBe(8);
  });

  it('falls back to index 8 for short hex', () => {
    expect(migrateColorToIndex('#F00')).toBe(8); // 3-char hex not supported
  });

  it('handles unknown Tailwind class as invalid hex → fallback', () => {
    expect(migrateColorToIndex('bg-unknown')).toBe(8);
  });

  it('always returns integer in 0-19 range', () => {
    const testInputs = ['#000000', '#FFFFFF', '#123456', 'bg-primary', 'junk'];
    for (const input of testInputs) {
      const result = migrateColorToIndex(input);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(20);
    }
  });
});
