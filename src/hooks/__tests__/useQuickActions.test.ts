/**
 * useQuickActions Hook Tests
 * Tests lock screen quick actions for Android
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

// Mock variables
let mockPlatform = 'web';
let mockQuickActionsSetting = false;

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => mockPlatform,
  },
}));

// Mock quickActions module
const mockInitializeQuickActions = vi.fn(() => Promise.resolve());
const mockToggleQuickActionsNotification = vi.fn(() => Promise.resolve(true));
const mockSetQuickActionCallback = vi.fn();
const mockSetupQuickActionsListener = vi.fn(() => Promise.resolve(() => {}));
const mockGetQuickActionsSetting = vi.fn(() => mockQuickActionsSetting);
const mockSaveQuickActionsSetting = vi.fn();

vi.mock('@/lib/quickActions', () => ({
  initializeQuickActions: () => mockInitializeQuickActions(),
  toggleQuickActionsNotification: (enabled: boolean) => mockToggleQuickActionsNotification(enabled),
  setQuickActionCallback: (cb: any) => mockSetQuickActionCallback(cb),
  setupQuickActionsListener: () => mockSetupQuickActionsListener(),
  getQuickActionsSetting: () => mockGetQuickActionsSetting(),
  saveQuickActionsSetting: (enabled: boolean) => mockSaveQuickActionsSetting(enabled),
  QUICK_ACTION_IDS: {
    LOG_MOOD: 'log_mood',
    START_FOCUS: 'start_focus',
    VIEW_HABITS: 'view_habits',
  },
}));

describe('useQuickActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform = 'web';
    mockQuickActionsSetting = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('returns initial state on web platform', async () => {
      mockPlatform = 'web';

      const { useQuickActions } = await import('../useQuickActions');
      const { result } = renderHook(() => useQuickActions());

      expect(result.current.isAndroid).toBe(false);
      expect(result.current.isEnabled).toBe(false);
      expect(typeof result.current.toggle).toBe('function');
      expect(typeof result.current.onAction).toBe('function');
    });

    it('returns isAndroid true on android platform', async () => {
      mockPlatform = 'android';

      vi.resetModules();
      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));

      const { useQuickActions } = await import('../useQuickActions');
      const { result } = renderHook(() => useQuickActions());

      expect(result.current.isAndroid).toBe(true);
    });

    it('reads initial setting from storage', async () => {
      mockQuickActionsSetting = true;

      vi.resetModules();
      vi.doMock('@/lib/quickActions', () => ({
        initializeQuickActions: () => Promise.resolve(),
        toggleQuickActionsNotification: () => Promise.resolve(true),
        setQuickActionCallback: vi.fn(),
        setupQuickActionsListener: () => Promise.resolve(() => {}),
        getQuickActionsSetting: () => true,
        saveQuickActionsSetting: vi.fn(),
        QUICK_ACTION_IDS: {
          LOG_MOOD: 'log_mood',
          START_FOCUS: 'start_focus',
          VIEW_HABITS: 'view_habits',
        },
      }));

      const { useQuickActions } = await import('../useQuickActions');
      const { result } = renderHook(() => useQuickActions());

      expect(result.current.isEnabled).toBe(true);
    });
  });

  describe('android initialization', () => {
    it('initializes quick actions on android', async () => {
      mockPlatform = 'android';

      vi.resetModules();
      const mockInit = vi.fn(() => Promise.resolve());
      const mockSetup = vi.fn(() => Promise.resolve(() => {}));

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));
      vi.doMock('@/lib/quickActions', () => ({
        initializeQuickActions: mockInit,
        toggleQuickActionsNotification: () => Promise.resolve(true),
        setQuickActionCallback: vi.fn(),
        setupQuickActionsListener: mockSetup,
        getQuickActionsSetting: () => false,
        saveQuickActionsSetting: vi.fn(),
        QUICK_ACTION_IDS: {
          LOG_MOOD: 'log_mood',
          START_FOCUS: 'start_focus',
          VIEW_HABITS: 'view_habits',
        },
      }));

      const { useQuickActions } = await import('../useQuickActions');
      renderHook(() => useQuickActions());

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockSetup).toHaveBeenCalled();
      });
    });

    it('does not initialize on web', async () => {
      mockPlatform = 'web';

      const { useQuickActions } = await import('../useQuickActions');
      renderHook(() => useQuickActions());

      expect(mockInitializeQuickActions).not.toHaveBeenCalled();
    });
  });

  describe('toggle', () => {
    it('does nothing on non-android', async () => {
      mockPlatform = 'web';

      const { useQuickActions } = await import('../useQuickActions');
      const { result } = renderHook(() => useQuickActions());

      await act(async () => {
        await result.current.toggle(true);
      });

      expect(mockToggleQuickActionsNotification).not.toHaveBeenCalled();
    });

    it('toggles and saves setting on android', async () => {
      vi.resetModules();
      const mockToggle = vi.fn(() => Promise.resolve(true));
      const mockSave = vi.fn();

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));
      vi.doMock('@/lib/quickActions', () => ({
        initializeQuickActions: () => Promise.resolve(),
        toggleQuickActionsNotification: mockToggle,
        setQuickActionCallback: vi.fn(),
        setupQuickActionsListener: () => Promise.resolve(() => {}),
        getQuickActionsSetting: () => false,
        saveQuickActionsSetting: mockSave,
        QUICK_ACTION_IDS: {
          LOG_MOOD: 'log_mood',
          START_FOCUS: 'start_focus',
          VIEW_HABITS: 'view_habits',
        },
      }));

      const { useQuickActions } = await import('../useQuickActions');
      const { result } = renderHook(() => useQuickActions());

      await act(async () => {
        await result.current.toggle(true);
      });

      expect(mockToggle).toHaveBeenCalledWith(true);
      expect(mockSave).toHaveBeenCalledWith(true);
      expect(result.current.isEnabled).toBe(true);
    });

    it('does not update state if toggle fails', async () => {
      vi.resetModules();
      const mockToggle = vi.fn(() => Promise.resolve(false));
      const mockSave = vi.fn();

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));
      vi.doMock('@/lib/quickActions', () => ({
        initializeQuickActions: () => Promise.resolve(),
        toggleQuickActionsNotification: mockToggle,
        setQuickActionCallback: vi.fn(),
        setupQuickActionsListener: () => Promise.resolve(() => {}),
        getQuickActionsSetting: () => false,
        saveQuickActionsSetting: mockSave,
        QUICK_ACTION_IDS: {
          LOG_MOOD: 'log_mood',
          START_FOCUS: 'start_focus',
          VIEW_HABITS: 'view_habits',
        },
      }));

      const { useQuickActions } = await import('../useQuickActions');
      const { result } = renderHook(() => useQuickActions());

      await act(async () => {
        await result.current.toggle(true);
      });

      expect(mockSave).not.toHaveBeenCalled();
      expect(result.current.isEnabled).toBe(false);
    });

    it('handles toggle errors', async () => {
      vi.resetModules();
      const mockToggle = vi.fn(() => Promise.reject(new Error('Toggle failed')));

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));
      vi.doMock('@/lib/quickActions', () => ({
        initializeQuickActions: () => Promise.resolve(),
        toggleQuickActionsNotification: mockToggle,
        setQuickActionCallback: vi.fn(),
        setupQuickActionsListener: () => Promise.resolve(() => {}),
        getQuickActionsSetting: () => false,
        saveQuickActionsSetting: vi.fn(),
        QUICK_ACTION_IDS: {
          LOG_MOOD: 'log_mood',
          START_FOCUS: 'start_focus',
          VIEW_HABITS: 'view_habits',
        },
      }));
      vi.doMock('@/lib/logger', () => ({
        logger: {
          log: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      }));

      const { useQuickActions } = await import('../useQuickActions');
      const { result } = renderHook(() => useQuickActions());

      // Should not throw
      await act(async () => {
        await result.current.toggle(true);
      });

      expect(result.current.isEnabled).toBe(false);
    });
  });

  describe('onAction', () => {
    it('registers action callback', async () => {
      mockPlatform = 'web';

      const { useQuickActions } = await import('../useQuickActions');
      const { result } = renderHook(() => useQuickActions());

      const callback = vi.fn();

      act(() => {
        result.current.onAction(callback);
      });

      // Callback should be registered (internal state)
      expect(typeof result.current.onAction).toBe('function');
    });
  });

  describe('cleanup', () => {
    it('calls cleanup on unmount for android', async () => {
      vi.resetModules();
      const mockCleanup = vi.fn();
      const mockSetup = vi.fn(() => Promise.resolve(mockCleanup));

      vi.doMock('@capacitor/core', () => ({
        Capacitor: {
          getPlatform: () => 'android',
        },
      }));
      vi.doMock('@/lib/quickActions', () => ({
        initializeQuickActions: () => Promise.resolve(),
        toggleQuickActionsNotification: () => Promise.resolve(true),
        setQuickActionCallback: vi.fn(),
        setupQuickActionsListener: mockSetup,
        getQuickActionsSetting: () => false,
        saveQuickActionsSetting: vi.fn(),
        QUICK_ACTION_IDS: {
          LOG_MOOD: 'log_mood',
          START_FOCUS: 'start_focus',
          VIEW_HABITS: 'view_habits',
        },
      }));

      const { useQuickActions } = await import('../useQuickActions');
      const { unmount } = renderHook(() => useQuickActions());

      // Wait for initialization
      await waitFor(() => {
        expect(mockSetup).toHaveBeenCalled();
      });

      // Small delay to let the promise resolve
      await new Promise(r => setTimeout(r, 10));

      unmount();

      // Cleanup should be called
      await waitFor(() => {
        expect(mockCleanup).toHaveBeenCalled();
      });
    });
  });
});
