import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock stores
const mockCurrentDate = vi.fn().mockReturnValue('2026-02-17');
const mockSetCurrentDate = vi.fn();

vi.mock('@/stores', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      currentDate: mockCurrentDate(),
      setCurrentDate: mockSetCurrentDate,
    }),
}));

// Mock getToday
const mockGetToday = vi.fn().mockReturnValue('2026-02-17');
vi.mock('@/lib/utils', () => ({
  getToday: () => mockGetToday(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useDateTracking } from '../useDateTracking';

describe('useDateTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCurrentDate.mockReturnValue('2026-02-17');
    mockGetToday.mockReturnValue('2026-02-17');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not call setCurrentDate when date has not changed', () => {
    renderHook(() => useDateTracking());

    // Trigger the interval
    vi.advanceTimersByTime(60000);

    expect(mockSetCurrentDate).not.toHaveBeenCalled();
  });

  it('calls setCurrentDate when getToday returns a new date', () => {
    renderHook(() => useDateTracking());

    // Simulate midnight crossing
    mockGetToday.mockReturnValue('2026-02-18');
    vi.advanceTimersByTime(60000);

    expect(mockSetCurrentDate).toHaveBeenCalledWith('2026-02-18');
  });

  it('checks date on window focus event', () => {
    renderHook(() => useDateTracking());

    mockGetToday.mockReturnValue('2026-02-18');
    window.dispatchEvent(new Event('focus'));

    expect(mockSetCurrentDate).toHaveBeenCalledWith('2026-02-18');
  });

  it('cleans up interval and focus listener on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useDateTracking());
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));

    clearIntervalSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('does not update if date is still the same on focus', () => {
    renderHook(() => useDateTracking());

    window.dispatchEvent(new Event('focus'));

    expect(mockSetCurrentDate).not.toHaveBeenCalled();
  });
});
