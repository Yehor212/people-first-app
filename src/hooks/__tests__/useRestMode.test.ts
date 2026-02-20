/**
 * useRestMode Hook Tests
 * Tests rest mode activation/deactivation, cooldown, and status calculations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- mocks ---

vi.mock('@/lib/utils', () => ({
  getToday: vi.fn(() => '2026-02-19'),
}));

// --- import under test after mocks ---

import { useRestMode } from '../useRestMode';
import type { InnerWorld } from '@/types';

describe('useRestMode', () => {
  let mockSetWorld: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetWorld = vi.fn();
  });

  it('isRestMode is true when today is in restDays', () => {
    const { result } = renderHook(() =>
      useRestMode(['2026-02-19'], mockSetWorld as (fn: (prev: InnerWorld) => InnerWorld) => void),
    );

    expect(result.current.isRestMode).toBe(true);
  });

  it('isRestMode is false when today is not in restDays', () => {
    const { result } = renderHook(() =>
      useRestMode(['2026-02-18'], mockSetWorld as (fn: (prev: InnerWorld) => InnerWorld) => void),
    );

    expect(result.current.isRestMode).toBe(false);
  });

  it('restModeStatus.canActivate is true when no recent rest days', () => {
    const { result } = renderHook(() =>
      useRestMode([], mockSetWorld as (fn: (prev: InnerWorld) => InnerWorld) => void),
    );

    expect(result.current.restModeStatus.canActivate).toBe(true);
    expect(result.current.restModeStatus.daysUntilAvailable).toBe(0);
  });

  it('restModeStatus.canActivate is false when rest taken 3 days ago (within 7-day cooldown)', () => {
    // 3 days before 2026-02-19 is 2026-02-16
    const { result } = renderHook(() =>
      useRestMode(['2026-02-16'], mockSetWorld as (fn: (prev: InnerWorld) => InnerWorld) => void),
    );

    expect(result.current.restModeStatus.canActivate).toBe(false);
    expect(result.current.restModeStatus.daysUntilAvailable).toBeGreaterThan(0);
  });

  it('activateRestMode calls setWorld when conditions are met', () => {
    const { result } = renderHook(() =>
      useRestMode([], mockSetWorld as (fn: (prev: InnerWorld) => InnerWorld) => void),
    );

    let returnValue: unknown;
    act(() => {
      returnValue = result.current.activateRestMode();
    });

    expect(mockSetWorld).toHaveBeenCalledTimes(1);
    expect(returnValue).toEqual({ success: true });
  });

  it('activateRestMode returns already_resting if today already in restDays', () => {
    const { result } = renderHook(() =>
      useRestMode(['2026-02-19'], mockSetWorld as (fn: (prev: InnerWorld) => InnerWorld) => void),
    );

    let returnValue: unknown;
    act(() => {
      returnValue = result.current.activateRestMode();
    });

    expect(returnValue).toEqual({ success: false, reason: 'already_resting' });
    expect(mockSetWorld).not.toHaveBeenCalled();
  });

  it('deactivateRestMode filters today from restDays via setWorld', () => {
    const { result } = renderHook(() =>
      useRestMode(['2026-02-19'], mockSetWorld as (fn: (prev: InnerWorld) => InnerWorld) => void),
    );

    act(() => {
      result.current.deactivateRestMode();
    });

    expect(mockSetWorld).toHaveBeenCalledTimes(1);
    // Verify the updater function filters out today
    const updater = mockSetWorld.mock.calls[0][0] as (prev: InnerWorld) => Partial<InnerWorld>;
    const updated = updater({ restDays: ['2026-02-18', '2026-02-19'] } as InnerWorld);
    expect(updated.restDays).toEqual(['2026-02-18']);
  });

  it('daysUntilAvailable calculates correctly based on most recent rest', () => {
    // Rest taken on 2026-02-17 (2 days ago), cooldown is 7 days
    // Available date = 2026-02-17 + 7 = 2026-02-24
    // daysUntilAvailable = ceil((2026-02-24 - 2026-02-19) / 86400000) = 5
    const { result } = renderHook(() =>
      useRestMode(['2026-02-17'], mockSetWorld as (fn: (prev: InnerWorld) => InnerWorld) => void),
    );

    expect(result.current.restModeStatus.canActivate).toBe(false);
    expect(result.current.restModeStatus.daysUntilAvailable).toBe(5);
  });
});
