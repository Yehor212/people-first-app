import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── In-memory storage mock ────────────────────────────────────
let mockStorage: Record<string, string> = {};

vi.mock('../safeJson', () => ({
  storageGetRaw: vi.fn((key: string): string | null => mockStorage[key] ?? null),
  storageSetRaw: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
}));

vi.mock('../storageKeys', () => ({
  SK: { QUICK_ACTIONS_ENABLED: 'zenflow_quick_actions_enabled' },
}));

vi.mock('@/lib/platform', () => ({
  isNative: false,
}));

vi.mock('../logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    createChannel: vi.fn(),
    registerActionTypes: vi.fn(),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    cancel: vi.fn(),
    schedule: vi.fn(),
  },
}));

import {
  QUICK_ACTION_IDS,
  isQuickActionsActive,
  getQuickActionsSetting,
  saveQuickActionsSetting,
  setQuickActionCallback,
  showQuickActionsNotification,
  hideQuickActionsNotification,
  toggleQuickActionsNotification,
  initializeQuickActionsChannel,
  registerQuickActionTypes,
} from '../quickActions';

import { storageSetRaw } from '../safeJson';

// ─── Setup ──────────────────────────────────────────────────────
beforeEach(() => {
  mockStorage = {};
  vi.clearAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────

describe('QUICK_ACTION_IDS', () => {
  it('has LOG_MOOD action id', () => {
    expect(QUICK_ACTION_IDS.LOG_MOOD).toBe('quick_log_mood');
  });

  it('has START_FOCUS action id', () => {
    expect(QUICK_ACTION_IDS.START_FOCUS).toBe('quick_start_focus');
  });

  it('has VIEW_HABITS action id', () => {
    expect(QUICK_ACTION_IDS.VIEW_HABITS).toBe('quick_view_habits');
  });

  it('has DISMISS action id', () => {
    expect(QUICK_ACTION_IDS.DISMISS).toBe('quick_dismiss');
  });

  it('all action ids are unique strings', () => {
    const values = Object.values(QUICK_ACTION_IDS);
    expect(new Set(values).size).toBe(values.length);
    values.forEach(v => expect(typeof v).toBe('string'));
  });
});

describe('getQuickActionsSetting', () => {
  it('returns false when storage is empty', () => {
    expect(getQuickActionsSetting()).toBe(false);
  });

  it('returns true when storage value is "true"', () => {
    mockStorage['zenflow_quick_actions_enabled'] = 'true';
    expect(getQuickActionsSetting()).toBe(true);
  });

  it('returns false when storage value is "false"', () => {
    mockStorage['zenflow_quick_actions_enabled'] = 'false';
    expect(getQuickActionsSetting()).toBe(false);
  });

  it('returns false for arbitrary string values', () => {
    mockStorage['zenflow_quick_actions_enabled'] = 'yes';
    expect(getQuickActionsSetting()).toBe(false);
  });
});

describe('saveQuickActionsSetting', () => {
  it('saves "true" when enabled', () => {
    saveQuickActionsSetting(true);
    expect(storageSetRaw).toHaveBeenCalledWith('zenflow_quick_actions_enabled', 'true');
  });

  it('saves "false" when disabled', () => {
    saveQuickActionsSetting(false);
    expect(storageSetRaw).toHaveBeenCalledWith('zenflow_quick_actions_enabled', 'false');
  });
});

describe('isQuickActionsActive', () => {
  it('returns false initially (web platform)', () => {
    expect(isQuickActionsActive()).toBe(false);
  });
});

describe('setQuickActionCallback', () => {
  it('accepts a callback function without throwing', () => {
    expect(() => setQuickActionCallback(() => {})).not.toThrow();
  });
});

describe('showQuickActionsNotification (web platform)', () => {
  it('returns false on web (non-native)', async () => {
    const result = await showQuickActionsNotification();
    expect(result).toBe(false);
  });

  it('accepts optional translations parameter', async () => {
    const result = await showQuickActionsNotification({ title: 'Test', body: 'Body' });
    expect(result).toBe(false);
  });
});

describe('hideQuickActionsNotification (web platform)', () => {
  it('completes without error on web', async () => {
    await expect(hideQuickActionsNotification()).resolves.toBeUndefined();
  });
});

describe('toggleQuickActionsNotification', () => {
  it('returns false when enabling on web', async () => {
    const result = await toggleQuickActionsNotification(true);
    expect(result).toBe(false);
  });

  it('returns true when disabling (hides notification)', async () => {
    const result = await toggleQuickActionsNotification(false);
    expect(result).toBe(true);
  });
});

describe('initializeQuickActionsChannel (web platform)', () => {
  it('completes without error on web', async () => {
    await expect(initializeQuickActionsChannel()).resolves.toBeUndefined();
  });
});

describe('registerQuickActionTypes (web platform)', () => {
  it('completes without error on web', async () => {
    await expect(registerQuickActionTypes()).resolves.toBeUndefined();
  });
});
