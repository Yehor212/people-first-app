/**
 * useADHDHooks Hook Tests
 * Tests ADHD engagement features (combo, challenges, mystery boxes)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock safeJson
vi.mock('@/lib/safeJson', () => ({
  safeJsonParse: vi.fn((str: string | null, defaultVal: unknown) => {
    if (!str) return defaultVal;
    try { return JSON.parse(str); } catch { return defaultVal; }
  }),
  safeLocalStorageGet: vi.fn((key: string, defaultVal: unknown) => {
    try {
      const str = localStorage.getItem(key);
      if (!str) return defaultVal;
      return JSON.parse(str);
    } catch { return defaultVal; }
  }),
  safeLocalStorageSet: vi.fn((key: string, value: unknown) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }),
  storageGetRaw: vi.fn((key: string, fallback = '') => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  }),
  storageSetRaw: vi.fn((key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* */ }
  }),
  storageRemove: vi.fn((key: string) => {
    try { localStorage.removeItem(key); } catch { /* */ }
  }),
}));

// Mock validation
vi.mock('@/lib/validation', () => ({
  safeParseInt: vi.fn((str, defaultVal) => {
    if (!str) return defaultVal;
    const num = parseInt(str, 10);
    return isNaN(num) ? defaultVal : num;
  }),
}));

// Mock adhdHooks module
const mockInitCombo = vi.fn(() => ({ count: 0, multiplier: 1, lastActionAt: 0 }));
const mockUpdateCombo = vi.fn((combo) => ({ ...combo, count: combo.count + 1 }));
const mockGenerateFlashChallenge = vi.fn(() => ({
  id: 'flash1',
  type: 'flash',
  title: 'Quick Challenge',
  target: 3,
  progress: 0,
  expiresAt: Date.now() + 300000,
  completed: false,
}));
const mockGenerateHourlyChallenge = vi.fn(() => ({
  id: 'hourly1',
  type: 'hourly',
  title: 'Hour Challenge',
  target: 5,
  progress: 0,
  expiresAt: Date.now() + 3600000,
  completed: false,
}));
const mockGenerateWeekendChallenge = vi.fn(() => ({
  id: 'weekend1',
  type: 'weekend',
  title: 'Weekend Challenge',
  target: 10,
  progress: 0,
  expiresAt: Date.now() + 172800000,
  completed: false,
}));
const mockGetStreakRiskNotification = vi.fn((_streak: number, _hours: number) => null as any);
const mockGetComebackNotification = vi.fn((_days: number) => null as any);

vi.mock('@/lib/adhdHooks', () => ({
  initCombo: () => mockInitCombo(),
  updateCombo: (combo: any) => mockUpdateCombo(combo),
  generateFlashChallenge: () => mockGenerateFlashChallenge(),
  generateHourlyChallenge: () => mockGenerateHourlyChallenge(),
  generateWeekendChallenge: () => mockGenerateWeekendChallenge(),
  getStreakRiskNotification: (streak: number, hours: number) => mockGetStreakRiskNotification(streak, hours),
  getComebackNotification: (days: number) => mockGetComebackNotification(days),
}));

// Mock localStorage
let localStorageMock: Record<string, string> = {};

describe('useADHDHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock = {};

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key) => localStorageMock[key] || null
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key, value) => { localStorageMock[key] = value; }
    );
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      (key) => { delete localStorageMock[key]; }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('initializes with default state', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      expect(result.current.combo).toEqual({ count: 0, multiplier: 1, lastActionAt: 0 });
      expect(result.current.spinTokens).toBe(0);
      expect(result.current.mysteryBoxes).toEqual([]);
      expect(result.current.activeChallenges).toEqual([]);
    });

    it('loads saved state from localStorage', async () => {
      localStorageMock['zenflow_combo_state'] = JSON.stringify({ count: 5, multiplier: 2, lastActionAt: 100 });
      localStorageMock['zenflow_spin_tokens'] = '3';

      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      expect(result.current.combo).toEqual({ count: 5, multiplier: 2, lastActionAt: 100 });
      expect(result.current.spinTokens).toBe(3);
    });
  });

  describe('incrementCombo', () => {
    it('increments combo count', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      act(() => {
        result.current.incrementCombo();
      });

      expect(mockUpdateCombo).toHaveBeenCalled();
      expect(result.current.combo.count).toBe(1);
    });

    it('persists combo to localStorage', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      act(() => {
        result.current.incrementCombo();
      });

      expect(localStorageMock['zenflow_combo_state']).toBeDefined();
    });
  });

  describe('spin tokens', () => {
    it('adds spin tokens', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      act(() => {
        result.current.addSpinToken(2);
      });

      expect(result.current.spinTokens).toBe(2);
    });

    it('uses spin token', async () => {
      localStorageMock['zenflow_spin_tokens'] = '3';

      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      expect(result.current.spinTokens).toBe(3);

      act(() => {
        result.current.useSpinToken();
      });

      expect(result.current.spinTokens).toBe(2);
    });

    it('does not go below zero', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      expect(result.current.spinTokens).toBe(0);

      act(() => {
        result.current.useSpinToken();
      });

      expect(result.current.spinTokens).toBe(0);
    });
  });

  describe('mystery boxes', () => {
    it('adds mystery box', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      let box: any;
      act(() => {
        box = result.current.addMysteryBox('gold');
      });

      expect(box).toBeDefined();
      expect(box.type).toBe('gold');
      expect(result.current.mysteryBoxes).toHaveLength(1);
    });

    it('opens mystery box', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      let box: any;
      act(() => {
        box = result.current.addMysteryBox('silver');
      });

      act(() => {
        result.current.openMysteryBox(box.id);
      });

      expect(result.current.mysteryBoxes[0].openedAt).toBeDefined();
    });

    it('removes mystery box', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      let box: any;
      act(() => {
        box = result.current.addMysteryBox('bronze');
      });

      expect(result.current.mysteryBoxes).toHaveLength(1);

      act(() => {
        result.current.removeMysteryBox(box.id);
      });

      expect(result.current.mysteryBoxes).toHaveLength(0);
    });
  });

  describe('time challenges', () => {
    it('adds flash challenge', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      let challenge: any;
      act(() => {
        challenge = result.current.addChallenge('flash');
      });

      expect(challenge).toBeDefined();
      expect(challenge.type).toBe('flash');
      expect(result.current.activeChallenges).toHaveLength(1);
    });

    it('adds hourly challenge', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      act(() => {
        result.current.addChallenge('hourly');
      });

      expect(result.current.activeChallenges).toHaveLength(1);
      expect(mockGenerateHourlyChallenge).toHaveBeenCalled();
    });

    it('adds weekend challenge', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      act(() => {
        result.current.addChallenge('weekend');
      });

      expect(mockGenerateWeekendChallenge).toHaveBeenCalled();
    });

    it('updates challenge progress', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      let challenge: any;
      act(() => {
        challenge = result.current.addChallenge('flash');
      });

      act(() => {
        result.current.updateChallengeProgress(challenge.id, 2);
      });

      expect(result.current.activeChallenges[0].progress).toBe(2);
    });

    it('marks challenge as completed when target reached', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      let challenge: any;
      act(() => {
        challenge = result.current.addChallenge('flash');
      });

      act(() => {
        result.current.updateChallengeProgress(challenge.id, 3); // target is 3
      });

      expect(result.current.activeChallenges[0].completed).toBe(true);
    });

    it('removes challenge', async () => {
      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      let challenge: any;
      act(() => {
        challenge = result.current.addChallenge('flash');
      });

      act(() => {
        result.current.removeChallenge(challenge.id);
      });

      expect(result.current.activeChallenges).toHaveLength(0);
    });
  });

  describe('notifications', () => {
    it('dismisses notification', async () => {
      mockGetStreakRiskNotification.mockReturnValue({
        id: 'risk1',
        type: 'streak_risk',
        message: 'Your streak is at risk!',
      });

      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      expect(result.current.notifications).toHaveLength(1);

      act(() => {
        result.current.dismissNotification('risk1');
      });

      expect(result.current.notifications).toHaveLength(0);
    });
  });

  describe('daily rewards', () => {
    it('shows daily rewards on new day', async () => {
      localStorageMock['zenflow_last_login'] = 'Mon Jan 01 2024'; // Old date

      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      expect(result.current.showDailyRewards).toBe(true);
    });

    it('closes daily rewards', async () => {
      localStorageMock['zenflow_last_login'] = 'Mon Jan 01 2024';

      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      act(() => {
        result.current.closeDailyRewards();
      });

      expect(result.current.showDailyRewards).toBe(false);
    });

    it('claims daily reward', async () => {
      localStorageMock['zenflow_last_login'] = 'Mon Jan 01 2024';

      const { useADHDHooks } = await import('../useADHDHooks');
      const { result } = renderHook(() => useADHDHooks(5));

      act(() => {
        result.current.claimDailyReward();
      });

      expect(result.current.showDailyRewards).toBe(false);
      expect(localStorageMock['zenflow_last_login']).toBeDefined();
    });
  });
});
