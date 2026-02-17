import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── In-memory storage mock ─────────────────────────────────────
let mockStorage: Record<string, unknown> = {};

vi.mock('../safeJson', () => ({
  safeLocalStorageGet: vi.fn(<T>(key: string, defaultValue: T): T => {
    return key in mockStorage ? (mockStorage[key] as T) : defaultValue;
  }),
  safeLocalStorageSet: vi.fn((key: string, value: unknown): boolean => {
    mockStorage[key] = value;
    return true;
  }),
  storageRemove: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
}));

import {
  getComebackChallenge,
  startComebackChallenge,
  hasActiveComebackChallenge,
  recordHabitForChallenge,
  getChallengeProgress,
  clearComebackChallenge,
} from '@/lib/comebackChallenge';
import type { ComebackChallenge } from '@/lib/comebackChallenge';
import { storageRemove } from '../safeJson';
import { SK } from '@/lib/storageKeys';

beforeEach(() => {
  mockStorage = {};
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── getComebackChallenge ───────────────────────────────────────

describe('getComebackChallenge', () => {
  it('returns null when storage is empty', () => {
    expect(getComebackChallenge()).toBeNull();
  });

  it('returns stored challenge when present', () => {
    const challenge: ComebackChallenge = {
      startDate: '2025-06-10',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 1,
      dailyProgress: { '2025-06-10': 3 },
      status: 'active',
    };
    mockStorage[SK.COMEBACK_CHALLENGE] = challenge;
    expect(getComebackChallenge()).toEqual(challenge);
  });
});

// ─── startComebackChallenge ─────────────────────────────────────

describe('startComebackChallenge', () => {
  it('creates a challenge with today as start date', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00Z'));
    const challenge = startComebackChallenge();
    expect(challenge.startDate).toBe('2025-06-15');
  });

  it('sets default values for a new challenge', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00Z'));
    const challenge = startComebackChallenge();
    expect(challenge.targetDays).toBe(3);
    expect(challenge.targetHabits).toBe(3);
    expect(challenge.bonusXp).toBe(100);
    expect(challenge.completedDays).toBe(0);
    expect(challenge.dailyProgress).toEqual({});
    expect(challenge.status).toBe('active');
  });

  it('saves the challenge to storage', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00Z'));
    startComebackChallenge();
    expect(mockStorage[SK.COMEBACK_CHALLENGE]).toBeDefined();
    const saved = mockStorage[SK.COMEBACK_CHALLENGE] as ComebackChallenge;
    expect(saved.startDate).toBe('2025-06-15');
  });
});

// ─── hasActiveComebackChallenge ─────────────────────────────────

describe('hasActiveComebackChallenge', () => {
  it('returns false when no challenge exists', () => {
    expect(hasActiveComebackChallenge()).toBe(false);
  });

  it('returns false for completed challenge', () => {
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-10',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 3,
      dailyProgress: {},
      status: 'completed',
    };
    expect(hasActiveComebackChallenge()).toBe(false);
  });

  it('returns true for active challenge within 7 days', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00Z'));
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-10',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 0,
      dailyProgress: {},
      status: 'active',
    };
    // 5 days since start — within 7-day window
    expect(hasActiveComebackChallenge()).toBe(true);
  });

  it('marks challenge as expired after 7 days and returns false', () => {
    vi.setSystemTime(new Date('2025-06-18T10:00:00Z'));
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-10',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 0,
      dailyProgress: {},
      status: 'active',
    };
    // 8 days since start — past 7-day window
    expect(hasActiveComebackChallenge()).toBe(false);
    const saved = mockStorage[SK.COMEBACK_CHALLENGE] as ComebackChallenge;
    expect(saved.status).toBe('expired');
  });

  it('returns true on exactly day 7 (not expired)', () => {
    vi.setSystemTime(new Date('2025-06-17T10:00:00Z'));
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-10',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 0,
      dailyProgress: {},
      status: 'active',
    };
    // Exactly 7 days — not > 7, so still active
    expect(hasActiveComebackChallenge()).toBe(true);
  });

  it('returns false for expired challenge', () => {
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-01',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 0,
      dailyProgress: {},
      status: 'expired',
    };
    expect(hasActiveComebackChallenge()).toBe(false);
  });
});

// ─── recordHabitForChallenge ────────────────────────────────────

describe('recordHabitForChallenge', () => {
  it('returns defaults when no active challenge', () => {
    const result = recordHabitForChallenge('2025-06-15');
    expect(result.challengeExists).toBe(false);
    expect(result.dailyTarget).toBe(false);
    expect(result.challengeComplete).toBe(false);
    expect(result.bonusXp).toBe(0);
  });

  it('increments daily progress for active challenge', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00Z'));
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-15',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 0,
      dailyProgress: {},
      status: 'active',
    };
    const result = recordHabitForChallenge('2025-06-15');
    expect(result.challengeExists).toBe(true);
    const saved = mockStorage[SK.COMEBACK_CHALLENGE] as ComebackChallenge;
    expect(saved.dailyProgress['2025-06-15']).toBe(1);
  });

  it('reports dailyTarget when target habits reached for the day', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00Z'));
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-15',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 0,
      dailyProgress: { '2025-06-15': 2 },
      status: 'active',
    };
    const result = recordHabitForChallenge('2025-06-15');
    expect(result.dailyTarget).toBe(true);
    const saved = mockStorage[SK.COMEBACK_CHALLENGE] as ComebackChallenge;
    expect(saved.completedDays).toBe(1);
  });

  it('does not report dailyTarget on subsequent habits after target reached', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00Z'));
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-15',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 1,
      dailyProgress: { '2025-06-15': 4 },
      status: 'active',
    };
    const result = recordHabitForChallenge('2025-06-15');
    expect(result.dailyTarget).toBe(false);
  });

  it('completes challenge when all target days are reached', () => {
    vi.setSystemTime(new Date('2025-06-17T10:00:00Z'));
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-15',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 2,
      dailyProgress: { '2025-06-15': 3, '2025-06-16': 3, '2025-06-17': 2 },
      status: 'active',
    };
    const result = recordHabitForChallenge('2025-06-17');
    expect(result.challengeComplete).toBe(true);
    expect(result.bonusXp).toBe(100);
    const saved = mockStorage[SK.COMEBACK_CHALLENGE] as ComebackChallenge;
    expect(saved.status).toBe('completed');
  });

  it('does not award bonus XP when daily target not yet reached', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00Z'));
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-15',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 0,
      dailyProgress: { '2025-06-15': 0 },
      status: 'active',
    };
    const result = recordHabitForChallenge('2025-06-15');
    expect(result.bonusXp).toBe(0);
    expect(result.challengeComplete).toBe(false);
  });
});

// ─── getChallengeProgress ───────────────────────────────────────

describe('getChallengeProgress', () => {
  it('returns null when no challenge exists', () => {
    expect(getChallengeProgress()).toBeNull();
  });

  it('returns null for completed challenge', () => {
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-10',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 3,
      dailyProgress: {},
      status: 'completed',
    };
    expect(getChallengeProgress()).toBeNull();
  });

  it('returns progress for active challenge', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00Z'));
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-15',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 1,
      dailyProgress: { '2025-06-15': 2 },
      status: 'active',
    };
    const progress = getChallengeProgress();
    expect(progress).not.toBeNull();
    expect(progress?.active).toBe(true);
    expect(progress?.completedDays).toBe(1);
    expect(progress?.targetDays).toBe(3);
    expect(progress?.todayProgress).toBe(2);
    expect(progress?.targetHabits).toBe(3);
    expect(progress?.bonusXp).toBe(100);
  });

  it('returns 0 todayProgress for a day without entries', () => {
    vi.setSystemTime(new Date('2025-06-16T10:00:00Z'));
    mockStorage[SK.COMEBACK_CHALLENGE] = {
      startDate: '2025-06-15',
      targetDays: 3,
      targetHabits: 3,
      bonusXp: 100,
      completedDays: 1,
      dailyProgress: { '2025-06-15': 3 },
      status: 'active',
    };
    const progress = getChallengeProgress();
    expect(progress?.todayProgress).toBe(0);
  });
});

// ─── clearComebackChallenge ─────────────────────────────────────

describe('clearComebackChallenge', () => {
  it('calls storageRemove with the correct key', () => {
    clearComebackChallenge();
    expect(storageRemove).toHaveBeenCalledWith(SK.COMEBACK_CHALLENGE);
  });

  it('removes the challenge from storage', () => {
    mockStorage[SK.COMEBACK_CHALLENGE] = { status: 'active' };
    clearComebackChallenge();
    expect(mockStorage[SK.COMEBACK_CHALLENGE]).toBeUndefined();
  });
});
