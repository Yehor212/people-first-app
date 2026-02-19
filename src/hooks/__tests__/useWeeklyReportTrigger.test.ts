/**
 * useWeeklyReportTrigger Hook Tests
 * Tests auto-show of weekly report on Mondays with "already shown" guard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// --- mocks ---

let mockStorage: Record<string, string> = {};
let mockOnboardingComplete = true;
const mockOpenModal = vi.fn();

vi.mock('@/stores', () => ({
  useUserDataStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ onboardingComplete: mockOnboardingComplete }),
  ),
  useUIStore: Object.assign(
    vi.fn((sel: (s: Record<string, unknown>) => unknown) => sel({})),
    { getState: () => ({ openModal: mockOpenModal }) },
  ),
}));

vi.mock('@/lib/safeJson', () => ({
  storageGetRaw: vi.fn((key: string) => mockStorage[key] ?? null),
  storageSetRaw: vi.fn((key: string, val: string) => {
    mockStorage[key] = val;
  }),
}));

vi.mock('@/lib/storageKeys', () => ({
  SK: { WEEKLY_REPORT: 'weekly_report' },
}));

// --- import under test after mocks ---

import { useWeeklyReportTrigger } from '../useWeeklyReportTrigger';

describe('useWeeklyReportTrigger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockStorage = {};
    mockOnboardingComplete = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when isLoading is true', () => {
    // Monday 2026-02-16
    vi.setSystemTime(new Date('2026-02-16T10:00:00'));
    renderHook(() => useWeeklyReportTrigger(true));

    vi.advanceTimersByTime(1500);

    expect(mockOpenModal).not.toHaveBeenCalled();
  });

  it('does nothing when onboardingComplete is false', () => {
    mockOnboardingComplete = false;
    vi.setSystemTime(new Date('2026-02-16T10:00:00'));
    renderHook(() => useWeeklyReportTrigger(false));

    vi.advanceTimersByTime(1500);

    expect(mockOpenModal).not.toHaveBeenCalled();
  });

  it('does nothing on a non-Monday day', () => {
    // Tuesday 2026-02-17
    vi.setSystemTime(new Date('2026-02-17T10:00:00'));
    renderHook(() => useWeeklyReportTrigger(false));

    vi.advanceTimersByTime(1500);

    expect(mockOpenModal).not.toHaveBeenCalled();
  });

  it('shows weekly report on Monday when never shown before', () => {
    // Monday 2026-02-16
    vi.setSystemTime(new Date('2026-02-16T10:00:00'));
    renderHook(() => useWeeklyReportTrigger(false));

    vi.advanceTimersByTime(1500);

    expect(mockOpenModal).toHaveBeenCalledWith('showWeeklyReport');
  });

  it('skips when already shown this week (same Monday)', () => {
    // Monday 2026-02-16, already shown earlier today
    vi.setSystemTime(new Date('2026-02-16T10:00:00'));
    mockStorage['weekly_report'] = '2026-02-16T08:00:00.000Z';

    renderHook(() => useWeeklyReportTrigger(false));

    vi.advanceTimersByTime(1500);

    expect(mockOpenModal).not.toHaveBeenCalled();
  });

  it('shows when lastShown is from the previous week', () => {
    // Monday 2026-02-16, last shown on Monday 2026-02-09
    vi.setSystemTime(new Date('2026-02-16T10:00:00'));
    mockStorage['weekly_report'] = '2026-02-09T10:00:00.000Z';

    renderHook(() => useWeeklyReportTrigger(false));

    vi.advanceTimersByTime(1500);

    expect(mockOpenModal).toHaveBeenCalledWith('showWeeklyReport');
  });
});
