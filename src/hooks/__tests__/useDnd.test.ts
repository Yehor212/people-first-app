/**
 * useDnd Hook Tests
 * Tests Do Not Disturb status checking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock logger first
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock variables
let mockIsNativePlatform = false;
let mockIsDndActiveResult = { active: false };
let mockGetDndStatusResult: any = { available: false };

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mockIsNativePlatform,
  },
}));

// Mock DndPlugin
vi.mock('@/plugins/DndPlugin', () => ({
  default: {
    isDndActive: vi.fn(() => Promise.resolve(mockIsDndActiveResult)),
    getDndStatus: vi.fn(() => Promise.resolve(mockGetDndStatusResult)),
  },
}));

describe('useDnd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsNativePlatform = false;
    mockIsDndActiveResult = { active: false };
    mockGetDndStatusResult = { available: false };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('non-native platform', () => {
    it('returns inactive DND on non-native platform', async () => {
      mockIsNativePlatform = false;

      const { useDnd } = await import('../useDnd');
      const { result } = renderHook(() => useDnd());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isDndActive).toBe(false);
      expect(result.current.isAvailable).toBe(false);
    });
  });

  describe('native platform', () => {
    beforeEach(() => {
      mockIsNativePlatform = true;
    });

    it('fetches DND status on mount', async () => {
      mockIsDndActiveResult = { active: true };
      mockGetDndStatusResult = { available: true, active: true };

      // Re-import to get fresh mock values
      vi.resetModules();
      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          isNativePlatform: () => true,
        },
      }));
      vi.doMock('@/plugins/DndPlugin', () => ({
        default: {
          isDndActive: vi.fn(() => Promise.resolve({ active: true })),
          getDndStatus: vi.fn(() => Promise.resolve({ available: true, active: true })),
        },
      }));

      const { useDnd } = await import('../useDnd');
      const { result } = renderHook(() => useDnd());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      expect(result.current.isDndActive).toBe(true);
      expect(result.current.isAvailable).toBe(true);
    });
  });

  describe('refresh function', () => {
    it('exists and is callable', async () => {
      mockIsNativePlatform = false;

      const { useDnd } = await import('../useDnd');
      const { result } = renderHook(() => useDnd());

      expect(typeof result.current.refresh).toBe('function');

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});

describe('checkDndActive helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false on non-native platform', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({
      Capacitor: {
        isNativePlatform: () => false,
      },
    }));

    const { checkDndActive } = await import('../useDnd');
    const result = await checkDndActive();

    expect(result).toBe(false);
  });

  it('returns true when DND is active on native', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({
      Capacitor: {
        isNativePlatform: () => true,
      },
    }));
    vi.doMock('@/plugins/DndPlugin', () => ({
      default: {
        isDndActive: vi.fn(() => Promise.resolve({ active: true })),
        getDndStatus: vi.fn(() => Promise.resolve({ available: true })),
      },
    }));

    const { checkDndActive } = await import('../useDnd');
    const result = await checkDndActive();

    expect(result).toBe(true);
  });

  it('returns false when DND is inactive on native', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({
      Capacitor: {
        isNativePlatform: () => true,
      },
    }));
    vi.doMock('@/plugins/DndPlugin', () => ({
      default: {
        isDndActive: vi.fn(() => Promise.resolve({ active: false })),
        getDndStatus: vi.fn(() => Promise.resolve({ available: true })),
      },
    }));

    const { checkDndActive } = await import('../useDnd');
    const result = await checkDndActive();

    expect(result).toBe(false);
  });

  it('returns false on error', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({
      Capacitor: {
        isNativePlatform: () => true,
      },
    }));
    vi.doMock('@/plugins/DndPlugin', () => ({
      default: {
        isDndActive: vi.fn(() => Promise.reject(new Error('Plugin error'))),
        getDndStatus: vi.fn(() => Promise.resolve({ available: true })),
      },
    }));
    vi.doMock('@/lib/logger', () => ({
      logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    const { checkDndActive } = await import('../useDnd');
    const result = await checkDndActive();

    expect(result).toBe(false);
  });
});

describe('getDndStatus helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unavailable status on non-native platform', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({
      Capacitor: {
        isNativePlatform: () => false,
      },
    }));

    const { getDndStatus } = await import('../useDnd');
    const result = await getDndStatus();

    expect(result).toEqual({ available: false });
  });

  it('returns status from plugin on native', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({
      Capacitor: {
        isNativePlatform: () => true,
      },
    }));
    vi.doMock('@/plugins/DndPlugin', () => ({
      default: {
        isDndActive: vi.fn(() => Promise.resolve({ active: true })),
        getDndStatus: vi.fn(() => Promise.resolve({ available: true, mode: 'priority' })),
      },
    }));

    const { getDndStatus } = await import('../useDnd');
    const result = await getDndStatus();

    expect(result).toEqual({ available: true, mode: 'priority' });
  });

  it('returns unavailable status on error', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({
      Capacitor: {
        isNativePlatform: () => true,
      },
    }));
    vi.doMock('@/plugins/DndPlugin', () => ({
      default: {
        isDndActive: vi.fn(() => Promise.resolve({ active: false })),
        getDndStatus: vi.fn(() => Promise.reject(new Error('Plugin error'))),
      },
    }));
    vi.doMock('@/lib/logger', () => ({
      logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    const { getDndStatus } = await import('../useDnd');
    const result = await getDndStatus();

    expect(result).toEqual({ available: false });
  });
});
