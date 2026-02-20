/**
 * useFocusTimerConfig Hook Tests
 * Tests preset selection, input validation, and derived durations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- mocks ---

const mockSafeParseInt = vi.fn((value: string | number, def: number, min?: number, max?: number) => {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  if (isNaN(parsed)) return def;
  let result = parsed;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
});

vi.mock('@/lib/validation', () => ({
  safeParseInt: (...args: unknown[]) => mockSafeParseInt(...(args as [string | number, number, number?, number?])),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    language: 'en',
    t: {
      focusPreset25: '25 min',
      focusPreset50: '50 min',
      focusPresetCustom: 'Custom',
    },
  })),
}));

// --- import under test after mocks ---

import { useFocusTimerConfig } from '../useFocusTimerConfig';

describe('useFocusTimerConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default state with 25min preset when no savedState', () => {
    const { result } = renderHook(() => useFocusTimerConfig(null));

    expect(result.current.preset).toBe('25');
    expect(result.current.focusMinutes).toBe(25);
    expect(result.current.breakMinutes).toBe(5);
  });

  it('handlePresetSelect("50") changes to 50/10', () => {
    const { result } = renderHook(() => useFocusTimerConfig(null));

    act(() => {
      result.current.handlePresetSelect('50');
    });

    expect(result.current.preset).toBe('50');
    expect(result.current.focusMinutes).toBe(50);
    expect(result.current.breakMinutes).toBe(10);
  });

  it('handlePresetSelect("custom") restores saved custom values', () => {
    const { result } = renderHook(() => useFocusTimerConfig(null));

    // Default saved custom is 30/5 — switch to custom to see them
    act(() => {
      result.current.handlePresetSelect('custom');
    });

    expect(result.current.preset).toBe('custom');
    expect(result.current.focusMinutes).toBe(30);
    expect(result.current.breakMinutes).toBe(5);
  });

  it('handleFocusInputBlur validates via safeParseInt', () => {
    const { result } = renderHook(() => useFocusTimerConfig(null));

    act(() => {
      result.current.handleFocusInputBlur('45');
    });

    expect(mockSafeParseInt).toHaveBeenCalledWith('45', 25, 5, 120);
    expect(result.current.focusMinutes).toBe(45);
  });

  it('handleBreakInputBlur validates via safeParseInt', () => {
    const { result } = renderHook(() => useFocusTimerConfig(null));

    act(() => {
      result.current.handleBreakInputBlur('15');
    });

    expect(mockSafeParseInt).toHaveBeenCalledWith('15', 5, 1, 60);
    expect(result.current.breakMinutes).toBe(15);
  });

  it('focusDuration equals focusMinutes * 60', () => {
    const { result } = renderHook(() => useFocusTimerConfig(null));

    expect(result.current.focusDuration).toBe(25 * 60);

    act(() => {
      result.current.handlePresetSelect('50');
    });

    expect(result.current.focusDuration).toBe(50 * 60);
  });

  it('restores from savedState when provided', () => {
    const saved = {
      endTime: null,
      focusMinutes: 40,
      breakMinutes: 8,
      isRunning: false,
      isBreak: false,
      label: '',
      focusStartTime: null,
      focusAccumulated: 0,
      preset: '50' as const,
    };

    const { result } = renderHook(() => useFocusTimerConfig(saved));

    expect(result.current.preset).toBe('50');
    expect(result.current.focusMinutes).toBe(40);
    expect(result.current.breakMinutes).toBe(8);
  });

  it('presets array has 3 items with correct keys', () => {
    const { result } = renderHook(() => useFocusTimerConfig(null));

    expect(result.current.presets).toHaveLength(3);
    expect(result.current.presets.map(p => p.key)).toEqual(['25', '50', 'custom']);
    expect(result.current.presets[0].label).toBe('25 min');
    expect(result.current.presets[1].label).toBe('50 min');
    expect(result.current.presets[2].label).toBe('Custom');
  });
});
