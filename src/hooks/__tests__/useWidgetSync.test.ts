/**
 * useWidgetSync Hook Tests
 * Tests widget data synchronization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Habit } from '@/types';
import { makeTestHabit, datesToEntries } from '@/test/habitFixtures';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock formatDate
vi.mock('@/lib/utils', () => ({
  formatDate: vi.fn(() => '2024-01-15'),
}));

// Mock platform
let mockIsNative = false;
vi.mock('@/lib/platform', () => ({
  get isNative() { return mockIsNative; },
  get platform() { return mockIsNative ? 'android' : 'web'; },
  get isAndroid() { return mockIsNative; },
  get isIos() { return false; },
  get isWeb() { return !mockIsNative; },
}));

// Mock Widget plugin
const mockIsSupported = vi.fn(() => Promise.resolve({ supported: true }));
const mockUpdateWidget = vi.fn((_data: any) => Promise.resolve());
const mockGetWidgetData = vi.fn(() => Promise.resolve(null));

vi.mock('@/plugins/WidgetPlugin', () => ({
  default: {
    isSupported: () => mockIsSupported(),
    updateWidget: (data: any) => mockUpdateWidget(data),
    getWidgetData: () => mockGetWidgetData(),
  },
}));

describe('useWidgetSync', () => {
  const mockHabits: Habit[] = [
    makeTestHabit({
      id: '1',
      name: 'Exercise',
      entries: datesToEntries(['2024-01-15']),
      createdAt: new Date('2024-01-01').getTime(),
    }),
    makeTestHabit({
      id: '2',
      name: 'Read',
      entries: {},
      createdAt: new Date('2024-01-01').getTime(),
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsNative = false;
    mockIsSupported.mockResolvedValue({ supported: true });
    mockUpdateWidget.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('non-native platform', () => {
    it('does not sync on web platform', async () => {
      mockIsNative = false;

      const { useWidgetSync } = await import('../useWidgetSync');
      renderHook(() => useWidgetSync(5, mockHabits, 30, 'badge'));

      // Wait a tick
      await new Promise(r => setTimeout(r, 10));

      expect(mockIsSupported).not.toHaveBeenCalled();
      expect(mockUpdateWidget).not.toHaveBeenCalled();
    });
  });

  describe('native platform', () => {
    beforeEach(() => {
      mockIsNative = true;
    });

    it('checks widget support on native', async () => {
      vi.resetModules();
      vi.doMock('@/lib/platform', () => ({
        isNative: true,
        platform: 'android',
        isAndroid: true,
        isIos: false,
        isWeb: false,
      }));

      const { useWidgetSync } = await import('../useWidgetSync');
      renderHook(() => useWidgetSync(5, mockHabits, 30, 'badge', false));

      await waitFor(() => {
        expect(mockIsSupported).toHaveBeenCalled();
      });
    });

    it('updates widget with correct data', async () => {
      vi.resetModules();
      vi.doMock('@/lib/platform', () => ({
        isNative: true,
        platform: 'android',
        isAndroid: true,
        isIos: false,
        isWeb: false,
      }));

      const { useWidgetSync } = await import('../useWidgetSync');
      renderHook(() => useWidgetSync(5, mockHabits, 30, 'First Badge', false));

      await waitFor(() => {
        expect(mockUpdateWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            streak: 5,
            habitsToday: 1, // Only Exercise is completed today
            habitsTotalToday: 2,
            focusMinutes: 30,
            lastBadge: 'First Badge',
          })
        );
      });
    });

    it('includes habit list in widget data', async () => {
      vi.resetModules();
      vi.doMock('@/lib/platform', () => ({
        isNative: true,
        platform: 'android',
        isAndroid: true,
        isIos: false,
        isWeb: false,
      }));

      const { useWidgetSync } = await import('../useWidgetSync');
      renderHook(() => useWidgetSync(5, mockHabits, 30, undefined, false));

      await waitFor(() => {
        expect(mockUpdateWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            habits: [
              { name: 'Exercise', completed: true },
              { name: 'Read', completed: false },
            ],
          })
        );
      });
    });

    it('limits habits list to 5', async () => {
      vi.resetModules();
      vi.doMock('@/lib/platform', () => ({
        isNative: true,
        platform: 'android',
        isAndroid: true,
        isIos: false,
        isWeb: false,
      }));

      const manyHabits: Habit[] = Array(10).fill(null).map((_, i) =>
        makeTestHabit({
          id: String(i),
          name: `Habit ${i}`,
          entries: {},
          createdAt: new Date('2024-01-01').getTime(),
        }),
      );

      const { useWidgetSync } = await import('../useWidgetSync');
      renderHook(() => useWidgetSync(5, manyHabits, 30, undefined, false));

      await waitFor(() => {
        expect(mockUpdateWidget).toHaveBeenCalled();
        const callData = mockUpdateWidget.mock.calls[0]?.[0];
        expect(callData!.habits).toHaveLength(5);
      });
    });

    it('skips update when widgets not supported', async () => {
      vi.resetModules();
      mockIsSupported.mockResolvedValue({ supported: false });

      vi.doMock('@/lib/platform', () => ({
        isNative: true,
        platform: 'android',
        isAndroid: true,
        isIos: false,
        isWeb: false,
      }));

      const { useWidgetSync } = await import('../useWidgetSync');
      renderHook(() => useWidgetSync(5, mockHabits, 30, 'badge', false));

      await waitFor(() => {
        expect(mockIsSupported).toHaveBeenCalled();
      });

      // Wait a tick
      await new Promise(r => setTimeout(r, 10));

      expect(mockUpdateWidget).not.toHaveBeenCalled();
    });

    it('skips update when still loading', async () => {
      vi.resetModules();
      vi.doMock('@/lib/platform', () => ({
        isNative: true,
        platform: 'android',
        isAndroid: true,
        isIos: false,
        isWeb: false,
      }));

      const { useWidgetSync } = await import('../useWidgetSync');
      renderHook(() => useWidgetSync(5, mockHabits, 30, 'badge', true)); // isLoading = true

      // Wait a tick
      await new Promise(r => setTimeout(r, 10));

      expect(mockIsSupported).not.toHaveBeenCalled();
    });

    it('handles update errors gracefully', async () => {
      vi.resetModules();
      mockUpdateWidget.mockRejectedValue(new Error('Update failed'));

      vi.doMock('@/lib/platform', () => ({
        isNative: true,
        platform: 'android',
        isAndroid: true,
        isIos: false,
        isWeb: false,
      }));
      vi.doMock('@/lib/logger', () => ({
        logger: {
          log: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      }));

      const { useWidgetSync } = await import('../useWidgetSync');

      // Should not throw
      renderHook(() => useWidgetSync(5, mockHabits, 30, 'badge', false));

      await waitFor(() => {
        expect(mockUpdateWidget).toHaveBeenCalled();
      });
    });

    it('handles support check errors gracefully', async () => {
      vi.resetModules();
      mockIsSupported.mockRejectedValue(new Error('Support check failed'));

      vi.doMock('@/lib/platform', () => ({
        isNative: true,
        platform: 'android',
        isAndroid: true,
        isIos: false,
        isWeb: false,
      }));
      vi.doMock('@/lib/logger', () => ({
        logger: {
          log: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      }));

      const { useWidgetSync } = await import('../useWidgetSync');

      // Should not throw
      renderHook(() => useWidgetSync(5, mockHabits, 30, 'badge', false));

      await new Promise(r => setTimeout(r, 10));
    });

    it('updates when dependencies change', async () => {
      vi.resetModules();
      vi.doMock('@/lib/platform', () => ({
        isNative: true,
        platform: 'android',
        isAndroid: true,
        isIos: false,
        isWeb: false,
      }));

      const { useWidgetSync } = await import('../useWidgetSync');
      const { rerender } = renderHook(
        ({ streak }) => useWidgetSync(streak, mockHabits, 30, 'badge', false),
        { initialProps: { streak: 5 } }
      );

      await waitFor(() => {
        expect(mockUpdateWidget).toHaveBeenCalledTimes(1);
      });

      rerender({ streak: 10 });

      await waitFor(() => {
        expect(mockUpdateWidget).toHaveBeenCalledTimes(2);
      });
    });
  });
});

describe('useWidgetData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWidgetData.mockResolvedValue({
      streak: 5,
      habitsToday: 2,
      habitsTotalToday: 3,
      focusMinutes: 45,
    });
  });

  it('returns null initially', async () => {
    const { useWidgetData } = await import('../useWidgetSync');
    const { result } = renderHook(() => useWidgetData());

    expect(result.current).toBeNull();
  });

  it('fetches and returns widget data', async () => {
    const { useWidgetData } = await import('../useWidgetSync');
    const { result } = renderHook(() => useWidgetData());

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current).toEqual({
      streak: 5,
      habitsToday: 2,
      habitsTotalToday: 3,
      focusMinutes: 45,
    });
  });

  it('handles fetch errors gracefully', async () => {
    mockGetWidgetData.mockRejectedValue(new Error('Fetch failed'));

    vi.doMock('@/lib/logger', () => ({
      logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    const { useWidgetData } = await import('../useWidgetSync');
    const { result } = renderHook(() => useWidgetData());

    // Wait a tick
    await new Promise(r => setTimeout(r, 10));

    expect(result.current).toBeNull();
  });
});
