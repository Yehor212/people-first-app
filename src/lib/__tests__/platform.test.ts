/**
 * Unit tests for platform detection module
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock @capacitor/core BEFORE importing the module under test.
// Because platform.ts evaluates at import time, we re-import per test group.

const mockCapacitor = {
  isNativePlatform: vi.fn(),
  getPlatform: vi.fn(),
};

vi.mock('@capacitor/core', () => ({
  Capacitor: mockCapacitor,
}));

describe('platform detection', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  async function importPlatform(platformValue: string, isNativeValue: boolean) {
    mockCapacitor.getPlatform.mockReturnValue(platformValue);
    mockCapacitor.isNativePlatform.mockReturnValue(isNativeValue);
    return await import('../platform');
  }

  describe('when platform is android', () => {
    it('isAndroid is true', async () => {
      const mod = await importPlatform('android', true);
      expect(mod.isAndroid).toBe(true);
    });

    it('isIos is false', async () => {
      const mod = await importPlatform('android', true);
      expect(mod.isIos).toBe(false);
    });

    it('isWeb is false', async () => {
      const mod = await importPlatform('android', true);
      expect(mod.isWeb).toBe(false);
    });

    it('isNative is true', async () => {
      const mod = await importPlatform('android', true);
      expect(mod.isNative).toBe(true);
    });

    it('platform equals "android"', async () => {
      const mod = await importPlatform('android', true);
      expect(mod.platform).toBe('android');
    });
  });

  describe('when platform is ios', () => {
    it('isIos is true', async () => {
      const mod = await importPlatform('ios', true);
      expect(mod.isIos).toBe(true);
    });

    it('isAndroid is false', async () => {
      const mod = await importPlatform('ios', true);
      expect(mod.isAndroid).toBe(false);
    });

    it('isNative is true', async () => {
      const mod = await importPlatform('ios', true);
      expect(mod.isNative).toBe(true);
    });
  });

  describe('when platform is web', () => {
    it('isWeb is true', async () => {
      const mod = await importPlatform('web', false);
      expect(mod.isWeb).toBe(true);
    });

    it('isNative is false', async () => {
      const mod = await importPlatform('web', false);
      expect(mod.isNative).toBe(false);
    });

    it('isAndroid is false', async () => {
      const mod = await importPlatform('web', false);
      expect(mod.isAndroid).toBe(false);
    });

    it('isIos is false', async () => {
      const mod = await importPlatform('web', false);
      expect(mod.isIos).toBe(false);
    });

    it('platform equals "web"', async () => {
      const mod = await importPlatform('web', false);
      expect(mod.platform).toBe('web');
    });
  });
});
