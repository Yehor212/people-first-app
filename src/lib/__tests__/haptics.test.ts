import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks (declared before vi.mock hoisting) ───────────
const { mockHapticsPreference } = vi.hoisted(() => ({
  mockHapticsPreference: { enabled: true },
}));

// ─── Mocks ──────────────────────────────────────────────────────
const mockImpact = vi.fn().mockResolvedValue(undefined);
const mockNotification = vi.fn().mockResolvedValue(undefined);
const mockSelectionChanged = vi.fn().mockResolvedValue(undefined);
const mockSelectionStart = vi.fn().mockResolvedValue(undefined);
const mockSelectionEnd = vi.fn().mockResolvedValue(undefined);

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: (...args: unknown[]) => mockImpact(...args),
    notification: (...args: unknown[]) => mockNotification(...args),
    selectionChanged: (...args: unknown[]) => mockSelectionChanged(...args),
    selectionStart: (...args: unknown[]) => mockSelectionStart(...args),
    selectionEnd: (...args: unknown[]) => mockSelectionEnd(...args),
  },
  ImpactStyle: {
    Light: 'LIGHT',
    Medium: 'MEDIUM',
    Heavy: 'HEAVY',
  },
  NotificationType: {
    Success: 'SUCCESS',
    Warning: 'WARNING',
    Error: 'ERROR',
  },
}));

// isNative is captured at module load time into a const, so it is always
// the value returned at import time. We set it to true so haptics are "available".
vi.mock('@/lib/platform', () => ({
  isNative: true,
}));

vi.mock('@/lib/hapticsPreference', () => ({
  getHapticsPreference: () => ({ ...mockHapticsPreference }),
}));

import {
  hapticTap,
  hapticMedium,
  hapticHeavy,
  hapticSuccess,
  hapticWarning,
  hapticError,
  hapticSelection,
  haptics,
} from '@/lib/haptics';

// ─── Setup ──────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockHapticsPreference.enabled = true;
});

// ─── hapticTap ──────────────────────────────────────────────────

describe('hapticTap', () => {
  it('calls Haptics.impact with Light style when native and haptics enabled', async () => {
    await hapticTap();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('does nothing when the direct haptics preference is disabled', async () => {
    mockHapticsPreference.enabled = false;
    await hapticTap();
    expect(mockImpact).not.toHaveBeenCalled();
  });
});

// ─── hapticMedium ───────────────────────────────────────────────

describe('hapticMedium', () => {
  it('calls Haptics.impact with Medium style', async () => {
    await hapticMedium();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'MEDIUM' });
  });
});

// ─── hapticHeavy ────────────────────────────────────────────────

describe('hapticHeavy', () => {
  it('calls Haptics.impact with Heavy style', async () => {
    await hapticHeavy();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'HEAVY' });
  });
});

// ─── hapticSuccess ──────────────────────────────────────────────

describe('hapticSuccess', () => {
  it('calls Haptics.notification with Success type', async () => {
    await hapticSuccess();
    expect(mockNotification).toHaveBeenCalledWith({ type: 'SUCCESS' });
  });
});

// ─── hapticWarning ──────────────────────────────────────────────

describe('hapticWarning', () => {
  it('calls Haptics.notification with Warning type', async () => {
    await hapticWarning();
    expect(mockNotification).toHaveBeenCalledWith({ type: 'WARNING' });
  });
});

// ─── hapticError ────────────────────────────────────────────────

describe('hapticError', () => {
  it('calls Haptics.notification with Error type', async () => {
    await hapticError();
    expect(mockNotification).toHaveBeenCalledWith({ type: 'ERROR' });
  });
});

// ─── hapticSelection ────────────────────────────────────────────

describe('hapticSelection', () => {
  it('uses a discrete light impact instead of an unstarted selection session', async () => {
    await hapticSelection();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'LIGHT' });
    expect(mockSelectionChanged).not.toHaveBeenCalled();
  });
});

// ─── haptics convenience object ─────────────────────────────────

describe('haptics object', () => {
  it('moodSaved is hapticSuccess (same function reference)', () => {
    expect(haptics.moodSaved).toBe(hapticSuccess);
  });

  it('has all expected keys', () => {
    const expectedKeys = [
      'moodSelected', 'moodSaved',
      'habitToggled', 'habitCompleted',
      'focusStarted', 'focusPaused', 'focusCompleted', 'focusPing',
      'gratitudeSaved',
      'xpGained', 'achievementUnlocked', 'levelUp',
      'light', 'medium', 'heavy',
      'buttonPress', 'buttonTap', 'tabChanged', 'panelOpened', 'panelClosed',
      'timeWarning', 'error',
    ];
    expectedKeys.forEach((key) => {
      expect(haptics).toHaveProperty(key);
      expect(typeof haptics[key as keyof typeof haptics]).toBe('function');
    });
  });
});

// ─── error swallowing ───────────────────────────────────────────

describe('error handling', () => {
  it('swallows errors from Haptics API', async () => {
    mockImpact.mockRejectedValueOnce(new Error('Haptic hardware error'));
    await expect(hapticTap()).resolves.toBeUndefined();
  });
});
