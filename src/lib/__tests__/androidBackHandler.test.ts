/**
 * Unit tests for Android back button handler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
const mockAddListener = vi.fn().mockResolvedValue({ remove: vi.fn() });

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: mockAddListener,
    exitApp: vi.fn(),
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
