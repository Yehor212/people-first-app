import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────

let mockStorage: Record<string, string> = {};

vi.mock('@/lib/safeJson', () => ({
  storageGetRaw: vi.fn((key: string) => mockStorage[key] ?? null),
  storageSetRaw: vi.fn((key: string, val: string) => { mockStorage[key] = val; }),
  storageRemove: vi.fn((key: string) => { delete mockStorage[key]; }),
}));

vi.mock('@/lib/storageKeys', () => ({ SK: { DEMO_MODE: 'demo_mode' } }));

import { useDemoMode, isDemoModeEnabled } from '../useDemoMode';

// ─── Setup ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage = {};
});

// ─── Tests ────────────────────────────────────────────────────

describe('useDemoMode', () => {
  it('is initially false when no storage value is set', () => {
    const { result } = renderHook(() => useDemoMode());

    expect(result.current.isDemoMode).toBe(false);
  });

  it('enableDemoMode sets isDemoMode to true', () => {
    const { result } = renderHook(() => useDemoMode());

    act(() => {
      result.current.enableDemoMode();
    });

    expect(result.current.isDemoMode).toBe(true);
    expect(mockStorage['demo_mode']).toBe('true');
  });

  it('disableDemoMode sets isDemoMode to false', () => {
    mockStorage['demo_mode'] = 'true';
    const { result } = renderHook(() => useDemoMode());

    act(() => {
      result.current.disableDemoMode();
    });

    expect(result.current.isDemoMode).toBe(false);
    expect(mockStorage['demo_mode']).toBeUndefined();
  });

  it('toggleDemoMode toggles between true and false', () => {
    const { result } = renderHook(() => useDemoMode());

    // Initially false, toggle to true
    act(() => {
      result.current.toggleDemoMode();
    });
    expect(result.current.isDemoMode).toBe(true);

    // Toggle back to false
    act(() => {
      result.current.toggleDemoMode();
    });
    expect(result.current.isDemoMode).toBe(false);
  });
});

describe('isDemoModeEnabled', () => {
  it('returns true when storage has demo_mode set to "true"', () => {
    mockStorage['demo_mode'] = 'true';

    expect(isDemoModeEnabled()).toBe(true);
  });

  it('returns false when storage has no demo_mode value', () => {
    expect(isDemoModeEnabled()).toBe(false);
  });
});
