/**
 * useAppUpdateCheck Hook Tests
 * Tests delayed app update check with dismissal and loading guards.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// --- mocks ---

const mockSetUpdateState = vi.fn();
let mockOnboardingComplete = true;

vi.mock('@/stores', () => ({
  useUIStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ setUpdateState: mockSetUpdateState }),
  ),
  useUserDataStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ onboardingComplete: mockOnboardingComplete }),
  ),
}));

const mockCheckForAppUpdate = vi.fn(() => Promise.resolve({ available: false }));
const mockWasUpdateDismissed = vi.fn(() => false);

vi.mock('@/lib/appUpdateManager', () => ({
  checkForAppUpdate: (...args: unknown[]) => mockCheckForAppUpdate(...args),
  wasUpdateDismissed: (...args: unknown[]) => mockWasUpdateDismissed(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn() },
}));

// --- import under test after mocks ---

import { useAppUpdateCheck } from '../useAppUpdateCheck';

describe('useAppUpdateCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockOnboardingComplete = true;
    mockCheckForAppUpdate.mockImplementation(() => Promise.resolve({ available: false }));
    mockWasUpdateDismissed.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when isLoading is true', async () => {
    renderHook(() => useAppUpdateCheck(true));

    await vi.advanceTimersByTimeAsync(3000);

    expect(mockCheckForAppUpdate).not.toHaveBeenCalled();
  });

  it('does nothing when onboardingComplete is false', async () => {
    mockOnboardingComplete = false;
    renderHook(() => useAppUpdateCheck(false));

    await vi.advanceTimersByTimeAsync(3000);

    expect(mockCheckForAppUpdate).not.toHaveBeenCalled();
  });

  it('calls checkForAppUpdate after 3s delay', async () => {
    renderHook(() => useAppUpdateCheck(false));

    // Not called before timeout
    expect(mockCheckForAppUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3000);

    expect(mockCheckForAppUpdate).toHaveBeenCalledTimes(1);
  });

  it('skips check when update was dismissed', async () => {
    mockWasUpdateDismissed.mockReturnValue(true);
    renderHook(() => useAppUpdateCheck(false));

    await vi.advanceTimersByTimeAsync(3000);

    expect(mockCheckForAppUpdate).not.toHaveBeenCalled();
  });

  it('calls setUpdateState when update is available', async () => {
    const updateState = { available: true, versionCode: 42 };
    mockCheckForAppUpdate.mockImplementation(() => Promise.resolve(updateState));

    renderHook(() => useAppUpdateCheck(false));

    await vi.runAllTimersAsync();

    expect(mockCheckForAppUpdate).toHaveBeenCalledTimes(1);
    expect(mockSetUpdateState).toHaveBeenCalledWith(updateState);
  });
});
