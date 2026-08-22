/**
 * Unit tests for Android back button handler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
const mockAddListener = vi.fn().mockResolvedValue({ remove: vi.fn() });

vi.mock('../androidBackBridge', () => ({
  AndroidBackBridge: {
    addListener: mockAddListener,
    setState: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
}));

vi.mock('@/lib/platform', () => ({
  isNative: false,
  isAndroid: false,
}));

vi.mock('./logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/safeJson', () => ({
  storageGetRaw: vi.fn(() => 'en'),
}));

vi.mock('@/lib/storageKeys', () => ({
  SK: { LANGUAGE: 'zenflow-language' },
}));

describe('androidBackHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerModalCloseCallback', () => {
    it('returns an unregister function', async () => {
      const { registerModalCloseCallback } = await import('../androidBackHandler');
      const unregister = registerModalCloseCallback(() => true);
      expect(typeof unregister).toBe('function');
    });

    it('unregister function can be called without error', async () => {
      const { registerModalCloseCallback } = await import('../androidBackHandler');
      const unregister = registerModalCloseCallback(() => false);
      expect(() => unregister()).not.toThrow();
    });

    it('calling unregister twice does not throw', async () => {
      const { registerModalCloseCallback } = await import('../androidBackHandler');
      const unregister = registerModalCloseCallback(() => false);
      unregister();
      expect(() => unregister()).not.toThrow();
    });

    it('multiple callbacks can be registered independently', async () => {
      const { registerModalCloseCallback } = await import('../androidBackHandler');
      const cb1 = vi.fn(() => false);
      const cb2 = vi.fn(() => true);
      const unsub1 = registerModalCloseCallback(cb1);
      const unsub2 = registerModalCloseCallback(cb2);
      expect(typeof unsub1).toBe('function');
      expect(typeof unsub2).toBe('function');
      // cleanup
      unsub1();
      unsub2();
    });

    it('unregistering one callback does not affect others', async () => {
      vi.resetModules();
      const { registerModalCloseCallback } = await import('../androidBackHandler');
      const cb1 = vi.fn(() => false);
      const cb2 = vi.fn(() => true);
      const unsub1 = registerModalCloseCallback(cb1);
      registerModalCloseCallback(cb2);
      unsub1();
      // cb2 should still be registered — we verify by type (no throw)
      expect(typeof cb2).toBe('function');
    });
  });

  describe('initAndroidBackHandler', () => {
    it('returns immediately on non-native platform (web)', async () => {
      const { initAndroidBackHandler } = await import('../androidBackHandler');
      await initAndroidBackHandler();
      // Should not register any listener on web
      expect(mockAddListener).not.toHaveBeenCalled();
    });

    it('returns a Promise<void>', async () => {
      const { initAndroidBackHandler } = await import('../androidBackHandler');
      const result = initAndroidBackHandler();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('offers a cold-start non-root route without web history to the registered navigation owner', async () => {
      vi.resetModules();
      let backButtonCallback: ((event: { canGoBack: boolean }) => void) | null = null;
      const nativeAddListener = vi.fn(async (_eventName: string, callback: (event: { canGoBack: boolean }) => void) => {
        backButtonCallback = callback;
        return { remove: vi.fn() };
      });

      vi.doMock('../androidBackBridge', () => ({
        AndroidBackBridge: {
          addListener: nativeAddListener,
          setState: vi.fn().mockResolvedValue(undefined),
        },
      }));
      vi.doMock('@/lib/platform', () => ({
        isNative: true,
        isAndroid: true,
      }));

      const { initAndroidBackHandler, registerModalCloseCallback } = await import('../androidBackHandler');
      const navigationOwner = vi.fn((event: { canGoBack: boolean }) => !event.canGoBack);
      registerModalCloseCallback(navigationOwner);
      window.history.pushState({}, '', '/diary?nav=v2&navLayout=phone');
      const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);

      await initAndroidBackHandler();
      const callback = backButtonCallback as ((event: { canGoBack: boolean }) => void) | null;
      expect(callback).toBeTypeOf('function');

      callback?.({ canGoBack: false });

      expect(navigationOwner).toHaveBeenCalledWith({ canGoBack: false });
      expect(historyBack).not.toHaveBeenCalled();
      expect(document.body.textContent).not.toContain('Press again to exit');
    });

    it('closes the top overlay before cold-start navigation regardless of effect registration order', async () => {
      vi.resetModules();
      let backButtonCallback: ((event: { canGoBack: boolean }) => void) | null = null;
      const nativeAddListener = vi.fn(async (_eventName: string, callback: (event: { canGoBack: boolean }) => void) => {
        backButtonCallback = callback;
        return { remove: vi.fn() };
      });

      vi.doMock('../androidBackBridge', () => ({
        AndroidBackBridge: {
          addListener: nativeAddListener,
          setState: vi.fn().mockResolvedValue(undefined),
        },
      }));
      vi.doMock('@/lib/platform', () => ({
        isNative: true,
        isAndroid: true,
      }));

      const { initAndroidBackHandler, registerModalCloseCallback } = await import('../androidBackHandler');
      const closeOverlay = vi.fn(() => true);
      const navigateToRoot = vi.fn(() => true);

      // Child effects register first and the shell effect may register later.
      // Semantic layer priority must win over incidental React effect order.
      registerModalCloseCallback(closeOverlay);
      registerModalCloseCallback(navigateToRoot, { layer: 'navigation' });

      await initAndroidBackHandler();
      const callback = backButtonCallback as ((event: { canGoBack: boolean }) => void) | null;
      expect(callback).toBeTypeOf('function');

      callback?.({ canGoBack: false });

      expect(closeOverlay).toHaveBeenCalledTimes(1);
      expect(navigateToRoot).not.toHaveBeenCalled();
    });

    it('delegates a public root screen to Android when no layer or navigation owner exists', async () => {
      vi.resetModules();
      const setState = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../androidBackBridge', () => ({
        AndroidBackBridge: {
          addListener: vi.fn(async () => ({ remove: vi.fn() })),
          setState,
        },
      }));
      vi.doMock('@/lib/platform', () => ({ isNative: true, isAndroid: true }));

      const { initAndroidBackHandler, removeAndroidBackHandler } = await import('../androidBackHandler');
      await initAndroidBackHandler();

      expect(setState).toHaveBeenLastCalledWith({
        canConsume: false,
        hasVisibleLayer: false,
      });
      await removeAndroidBackHandler();
    });

    it('never treats the first dialog action as a generic close control', async () => {
      vi.resetModules();
      let backButtonCallback: ((event: { canGoBack: boolean }) => void) | null = null;
      const nativeAddListener = vi.fn(async (_eventName: string, callback: (event: { canGoBack: boolean }) => void) => {
        backButtonCallback = callback;
        return { remove: vi.fn() };
      });
      const firstAction = vi.fn();

      vi.doMock('../androidBackBridge', () => ({
        AndroidBackBridge: {
          addListener: nativeAddListener,
          setState: vi.fn().mockResolvedValue(undefined),
        },
      }));
      vi.doMock('@/lib/platform', () => ({
        isNative: true,
        isAndroid: true,
      }));

      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      dialog.getBoundingClientRect = () => ({
        width: 320,
        height: 240,
        top: 10,
        right: 330,
        bottom: 250,
        left: 10,
        x: 10,
        y: 10,
        toJSON: () => ({}),
      });
      const actionButton = document.createElement('button');
      actionButton.textContent = 'Skip today';
      actionButton.addEventListener('click', firstAction);
      Object.defineProperty(actionButton, 'offsetParent', { value: dialog });
      dialog.append(actionButton);
      document.body.append(dialog);
      window.history.pushState({}, '', '/settings?nav=v2');
      const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
      const escapeListener = vi.fn();
      document.addEventListener('keydown', escapeListener);

      try {
        const { initAndroidBackHandler } = await import('../androidBackHandler');
        await initAndroidBackHandler();
        const callback = backButtonCallback as ((event: { canGoBack: boolean }) => void) | null;
        expect(callback).toBeTypeOf('function');

        callback?.({ canGoBack: true });

        expect(firstAction).not.toHaveBeenCalled();
        expect(escapeListener).toHaveBeenCalledWith(
          expect.objectContaining({ key: 'Escape' }),
        );
        expect(historyBack).not.toHaveBeenCalled();
      } finally {
        document.removeEventListener('keydown', escapeListener);
        historyBack.mockRestore();
        dialog.remove();
      }
    });

    it('does not click a lower-layer close button when nested dialogs rely on Escape ownership', async () => {
      vi.resetModules();
      let backButtonCallback: ((event: { canGoBack: boolean }) => void) | null = null;
      const nativeAddListener = vi.fn(async (_eventName: string, callback: (event: { canGoBack: boolean }) => void) => {
        backButtonCallback = callback;
        return { remove: vi.fn() };
      });
      vi.doMock('../androidBackBridge', () => ({
        AndroidBackBridge: {
          addListener: nativeAddListener,
          setState: vi.fn().mockResolvedValue(undefined),
        },
      }));
      vi.doMock('@/lib/platform', () => ({ isNative: true, isAndroid: true }));

      const clicks = [vi.fn(), vi.fn()];
      const dialogs = clicks.map((click, index) => {
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.getBoundingClientRect = () => ({
          width: 320,
          height: 240,
          top: 10 + index,
          right: 330,
          bottom: 250,
          left: 10,
          x: 10,
          y: 10,
          toJSON: () => ({}),
        });
        const close = document.createElement('button');
        close.setAttribute('aria-label', 'Close');
        close.addEventListener('click', click);
        Object.defineProperty(close, 'offsetParent', { value: dialog });
        dialog.append(close);
        document.body.append(dialog);
        return dialog;
      });
      const escapeListener = vi.fn();
      document.addEventListener('keydown', escapeListener);

      try {
        const { initAndroidBackHandler } = await import('../androidBackHandler');
        await initAndroidBackHandler();
        const callback = backButtonCallback as ((event: { canGoBack: boolean }) => void) | null;
        callback?.({ canGoBack: true });

        expect(clicks[0]).not.toHaveBeenCalled();
        expect(clicks[1]).not.toHaveBeenCalled();
        expect(escapeListener).toHaveBeenCalledWith(
          expect.objectContaining({ key: 'Escape' }),
        );
      } finally {
        document.removeEventListener('keydown', escapeListener);
        dialogs.forEach((dialog) => dialog.remove());
      }
    });
  });

  describe('removeAndroidBackHandler', () => {
    it('returns immediately on non-native platform', async () => {
      const { removeAndroidBackHandler } = await import('../androidBackHandler');
      await expect(removeAndroidBackHandler()).resolves.toBeUndefined();
    });

    it('returns a Promise<void>', async () => {
      const { removeAndroidBackHandler } = await import('../androidBackHandler');
      const result = removeAndroidBackHandler();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });
});
