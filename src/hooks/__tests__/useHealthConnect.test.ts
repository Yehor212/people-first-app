/**
 * useHealthConnect Hook Tests
 * Tests Health Connect integration for Android
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Capacitor
let mockPlatform = 'web';
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => mockPlatform,
  },
}));

// Mock HealthConnect plugin
const mockIsAvailable = vi.fn();
const mockCheckPermissions = vi.fn();
const mockRequestPermissions = vi.fn();
const mockWriteMindfulnessSession = vi.fn();
const mockReadSleepSessions = vi.fn();
const mockReadSteps = vi.fn();
const mockOpenHealthConnect = vi.fn();

vi.mock('@/plugins/HealthConnectPlugin', () => ({
  HealthConnect: {
    isAvailable: () => mockIsAvailable(),
    checkPermissions: () => mockCheckPermissions(),
    requestPermissions: () => mockRequestPermissions(),
    writeMindfulnessSession: (data: any) => mockWriteMindfulnessSession(data),
    readSleepSessions: (data: any) => mockReadSleepSessions(data),
    readSteps: (data: any) => mockReadSteps(data),
    openHealthConnect: () => mockOpenHealthConnect(),
  },
}));

describe('useHealthConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform = 'web';
    mockIsAvailable.mockResolvedValue({ available: true });
    mockCheckPermissions.mockResolvedValue({
      mindfulness: true,
      sleep: true,
      steps: true,
      allGranted: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('non-android platform', () => {
    it('returns unavailable state on web', async () => {
      mockPlatform = 'web';

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      expect(result.current.isAndroid).toBe(false);
      expect(result.current.state.isAvailable).toBe(false);
      expect(result.current.state.unavailableReason).toBe('not_supported');
    });

    it('checkAvailability returns not_supported on web', async () => {
      mockPlatform = 'web';

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      const availability = await result.current.checkAvailability();

      expect(availability.available).toBe(false);
      expect(availability.reason).toBe('not_supported');
    });

    it('requestPermissions returns denied on web', async () => {
      mockPlatform = 'web';

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      const permissions = await result.current.requestPermissions();

      expect(permissions.allGranted).toBe(false);
      expect(mockRequestPermissions).not.toHaveBeenCalled();
    });
  });

  describe('android platform', () => {
    beforeEach(() => {
      mockPlatform = 'android';
    });

    it('checks availability on mount', async () => {
      vi.resetModules();
      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      renderHook(() => useHealthConnect());

      await waitFor(() => {
        expect(mockIsAvailable).toHaveBeenCalled();
      });
    });

    it('checks permissions after availability', async () => {
      vi.resetModules();
      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      renderHook(() => useHealthConnect());

      await waitFor(() => {
        expect(mockCheckPermissions).toHaveBeenCalled();
      });
    });

    it('updates state with permissions', async () => {
      vi.resetModules();
      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      expect(result.current.state.isAvailable).toBe(true);
      expect(result.current.state.permissions?.allGranted).toBe(true);
    });

    it('handles unavailable Health Connect', async () => {
      vi.resetModules();
      mockIsAvailable.mockResolvedValue({ available: false, reason: 'not_installed' });

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      expect(result.current.state.isAvailable).toBe(false);
      expect(result.current.state.unavailableReason).toBe('not_installed');
    });
  });

  describe('requestPermissions', () => {
    it('calls plugin requestPermissions on android', async () => {
      vi.resetModules();
      mockRequestPermissions.mockResolvedValue({
        mindfulness: true,
        sleep: true,
        steps: false,
        allGranted: false,
      });

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      let permissions: any;
      await act(async () => {
        permissions = await result.current.requestPermissions();
      });

      expect(mockRequestPermissions).toHaveBeenCalled();
      expect(permissions.mindfulness).toBe(true);
      expect(permissions.steps).toBe(false);
    });

    it('handles permission request errors', async () => {
      vi.resetModules();
      mockRequestPermissions.mockRejectedValue(new Error('Permission denied'));

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      let permissions: any;
      await act(async () => {
        permissions = await result.current.requestPermissions();
      });

      expect(permissions.allGranted).toBe(false);
    });
  });

  describe('syncFocusSession', () => {
    it('returns false on web', async () => {
      mockPlatform = 'web';

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      const success = await result.current.syncFocusSession('123', Date.now(), 25);

      expect(success).toBe(false);
      expect(mockWriteMindfulnessSession).not.toHaveBeenCalled();
    });

    it('syncs session when available with permissions', async () => {
      vi.resetModules();
      mockWriteMindfulnessSession.mockResolvedValue({ success: true });

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      await waitFor(() => {
        expect(result.current.state.isAvailable).toBe(true);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.syncFocusSession('123', Date.now(), 25, 'Deep Work');
      });

      expect(mockWriteMindfulnessSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: '123',
          durationMinutes: 25,
          title: 'Deep Work',
        })
      );
      expect(success!).toBe(true);
    });

    it('returns false without mindfulness permission', async () => {
      vi.resetModules();
      mockCheckPermissions.mockResolvedValue({
        mindfulness: false,
        sleep: true,
        steps: true,
        allGranted: false,
      });

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      const success = await result.current.syncFocusSession('123', Date.now(), 25);

      expect(success).toBe(false);
      expect(mockWriteMindfulnessSession).not.toHaveBeenCalled();
    });
  });

  describe('getSleepData', () => {
    it('returns empty array on web', async () => {
      mockPlatform = 'web';

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      const data = await result.current.getSleepData();

      expect(data).toEqual([]);
    });

    it('fetches sleep data when available', async () => {
      vi.resetModules();
      mockReadSleepSessions.mockResolvedValue({
        count: 2,
        sessions: [
          { startTime: 1, endTime: 2, title: 'Sleep 1' },
          { startTime: 3, endTime: 4, title: 'Sleep 2' },
        ],
      });

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      await waitFor(() => {
        expect(result.current.state.isAvailable).toBe(true);
      });

      let data: any[];
      await act(async () => {
        data = await result.current.getSleepData(7);
      });

      expect(mockReadSleepSessions).toHaveBeenCalled();
      expect(data!).toHaveLength(2);
    });
  });

  describe('getStepsData', () => {
    it('returns zero on web', async () => {
      mockPlatform = 'web';

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      const data = await result.current.getStepsData();

      expect(data.total).toBe(0);
      expect(data.records).toEqual([]);
    });

    it('fetches steps data when available', async () => {
      vi.resetModules();
      mockReadSteps.mockResolvedValue({
        totalSteps: 10000,
        records: [{ count: 5000 }, { count: 5000 }],
      });

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      await waitFor(() => {
        expect(result.current.state.isAvailable).toBe(true);
      });

      let data: any;
      await act(async () => {
        data = await result.current.getStepsData(1);
      });

      expect(mockReadSteps).toHaveBeenCalled();
      expect(data.total).toBe(10000);
    });
  });

  describe('openHealthConnect', () => {
    it('does nothing on web', async () => {
      vi.resetModules();
      mockOpenHealthConnect.mockClear();

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'web',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      await result.current.openHealthConnect();

      expect(mockOpenHealthConnect).not.toHaveBeenCalled();
    });

    it('calls plugin on android', async () => {
      vi.resetModules();
      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      await act(async () => {
        await result.current.openHealthConnect();
      });

      expect(mockOpenHealthConnect).toHaveBeenCalled();
    });
  });

  describe('refreshState', () => {
    it('re-checks availability and permissions', async () => {
      vi.resetModules();
      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useHealthConnect } = await import('../useHealthConnect');
      const { result } = renderHook(() => useHealthConnect());

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      mockIsAvailable.mockClear();
      mockCheckPermissions.mockClear();

      await act(async () => {
        await result.current.refreshState();
      });

      expect(mockIsAvailable).toHaveBeenCalled();
      expect(mockCheckPermissions).toHaveBeenCalled();
    });
  });
});
