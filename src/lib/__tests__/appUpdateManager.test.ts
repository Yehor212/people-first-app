/**
 * Unit tests for appUpdateManager — version comparison, session dismiss, store URL
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all heavy dependencies before importing
vi.mock('@/plugins/AppUpdatePlugin', () => ({
  default: {
    checkForUpdate: vi.fn(),
    startImmediateUpdate: vi.fn(),
    startFlexibleUpdate: vi.fn(),
    isSupported: vi.fn(),
  },
}));

vi.mock('@/lib/platform', () => ({
  isNative: false,
}));

vi.mock('@capacitor/app', () => ({
  App: {},
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: null,
}));

vi.mock('@/lib/appVersion', () => ({
  APP_VERSION: '1.0.0',
}));

vi.mock('@/lib/storageKeys', () => ({
  SSK: {
    UPDATE_DISMISSED: 'zenflow-update-dismissed',
  },
}));

describe('appUpdateManager', () => {
  let mod: typeof import('../appUpdateManager');

  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mod = await import('../appUpdateManager');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // wasUpdateDismissed / dismissUpdate
  // ==========================================
  describe('wasUpdateDismissed', () => {
    it('returns false when nothing is stored', () => {
      expect(mod.wasUpdateDismissed()).toBe(false);
    });

    it('returns true after dismissUpdate is called', () => {
      mod.dismissUpdate();
      expect(mod.wasUpdateDismissed()).toBe(true);
    });

    it('reads from sessionStorage key', () => {
      sessionStorage.setItem('zenflow-update-dismissed', 'true');
      expect(mod.wasUpdateDismissed()).toBe(true);
    });

    it('returns false for non-"true" values', () => {
      sessionStorage.setItem('zenflow-update-dismissed', 'false');
      expect(mod.wasUpdateDismissed()).toBe(false);
    });
  });

  describe('dismissUpdate', () => {
    it('sets the sessionStorage key to "true"', () => {
      mod.dismissUpdate();
      expect(sessionStorage.getItem('zenflow-update-dismissed')).toBe('true');
    });

    it('is idempotent', () => {
      mod.dismissUpdate();
      mod.dismissUpdate();
      expect(sessionStorage.getItem('zenflow-update-dismissed')).toBe('true');
    });
  });

  // ==========================================
  // checkForAppUpdate (non-native path)
  // ==========================================
  describe('checkForAppUpdate', () => {
    it('returns not-available on web platform', async () => {
      const result = await mod.checkForAppUpdate();
      expect(result.available).toBe(false);
      expect(result.checked).toBe(true);
      expect(result.priority).toBe('low');
      expect(result.stalenessDays).toBe(0);
    });
  });

  // ==========================================
  // openGooglePlayStore (web path)
  // ==========================================
  describe('openGooglePlayStore', () => {
    it('opens play store URL in new tab on web', async () => {
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      const result = await mod.openGooglePlayStore();
      expect(result).toBe(true);
      expect(openSpy).toHaveBeenCalledWith(
        'https://play.google.com/store/apps/details?id=com.zenflow.app',
        '_blank'
      );
    });
  });

  // ==========================================
  // UpdateState type shape
  // ==========================================
  describe('UpdateState shape', () => {
    it('checkForAppUpdate returns all required fields', async () => {
      const state = await mod.checkForAppUpdate();
      expect(state).toHaveProperty('available');
      expect(state).toHaveProperty('priority');
      expect(state).toHaveProperty('checked');
      expect(state).toHaveProperty('stalenessDays');
      expect(typeof state.available).toBe('boolean');
      expect(typeof state.checked).toBe('boolean');
      expect(typeof state.stalenessDays).toBe('number');
    });
  });
});
