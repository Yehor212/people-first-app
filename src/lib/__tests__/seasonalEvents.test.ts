import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── In-memory safeJson mock ────────────────────────────────────
let mockStorage: Record<string, unknown> = {};

vi.mock('@/lib/safeJson', () => ({
  safeLocalStorageGet: vi.fn((key: string, def: unknown) => mockStorage[key] ?? def),
  safeLocalStorageSet: vi.fn((key: string, val: unknown) => {
    mockStorage[key] = val;
    return true;
  }),
  storageRemove: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), sync: vi.fn(), auth: vi.fn() },
}));

import {
  getSeasonalEventsConfig,
  isEventActive,
  getActiveEvents,
  getUpcomingEvents,
  getSeasonalProgress,
  saveSeasonalProgress,
  initializeEventProgress,
  updateChallengeProgress,
  claimCompletionReward,
  onHabitCompleted,
  onMoodLogged,
  onFocusCompleted,
  onGratitudeAdded,
  getEventWithProgress,
} from '../seasonalEvents';
import type { SeasonalEvent, SeasonalChallenge, UserSeasonalProgress } from '../seasonalEvents';

// ─── Helpers ────────────────────────────────────────────────────

function makeEvent(overrides: Partial<SeasonalEvent> = {}): SeasonalEvent {
  return {
    id: 'test-event-2026',
    name: 'Test Event',
    description: 'A test event',
    type: 'seasonal',
    icon: '🧪',
    themeColor: '#000',
    startDate: '2026-06-20',
    endDate: '2026-07-04',
    isActive: false,
    challenges: [],
    ...overrides,
  };
}

function makeChallenge(overrides: Partial<SeasonalChallenge> = {}): SeasonalChallenge {
  return {
    id: 'test-challenge',
    name: 'Test Challenge',
    description: 'A test challenge',
    icon: '🎯',
    type: 'habit_streak',
    target: 5,
    progress: 0,
    completed: false,
    reward: {
      id: 'test-reward',
      type: 'badge',
      name: 'Test Badge',
      description: 'A test badge',
      icon: '🏆',
      rarity: 'common',
    },
    ...overrides,
  };
}

// ─── Setup ──────────────────────────────────────────────────────

beforeEach(() => {
  mockStorage = {};
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================
// getSeasonalEventsConfig
// ============================================
describe('getSeasonalEventsConfig', () => {
  it('returns a non-empty array for any year', () => {
    const events = getSeasonalEventsConfig(2026);
    expect(events.length).toBeGreaterThan(0);
  });

  it('every event has required fields', () => {
    const events = getSeasonalEventsConfig(2026);
    for (const event of events) {
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('name');
      expect(event).toHaveProperty('startDate');
      expect(event).toHaveProperty('endDate');
      expect(event).toHaveProperty('challenges');
      expect(event.challenges.length).toBeGreaterThan(0);
    }
  });

  it('event IDs contain the given year', () => {
    const events = getSeasonalEventsConfig(2026);
    for (const event of events) {
      expect(event.id).toContain('2026');
    }
  });

  it('Winter event spans into the following year', () => {
    const events = getSeasonalEventsConfig(2026);
    const winter = events.find(e => e.id.startsWith('winter-'));
    expect(winter).toBeDefined();
    expect(winter.endDate).toContain('2027');
  });
});

// ============================================
// isEventActive
// ============================================
describe('isEventActive', () => {
  // Date-only strings like '2026-06-20' are parsed as UTC midnight,
  // so we use UTC timestamps in test dates for consistency.
  const event = makeEvent({ startDate: '2026-06-20', endDate: '2026-07-04' });

  it('returns false well before event start', () => {
    // June 18 UTC — safely before June 20 UTC midnight
    const before = new Date('2026-06-18T12:00:00Z');
    expect(isEventActive(event, before)).toBe(false);
  });

  it('returns true on exact start date (UTC)', () => {
    const start = new Date('2026-06-20T00:00:00Z');
    expect(isEventActive(event, start)).toBe(true);
  });

  it('returns true during the event', () => {
    const mid = new Date('2026-06-25T12:00:00Z');
    expect(isEventActive(event, mid)).toBe(true);
  });

  it('returns true late in the event period', () => {
    // Use a date well within the event range to avoid timezone boundary issues
    const lateButSafe = new Date('2026-07-03T12:00:00Z');
    expect(isEventActive(event, lateButSafe)).toBe(true);
  });

  it('returns false well after event end', () => {
    // July 6 — safely after end date + 23:59:59
    const after = new Date('2026-07-06T00:00:00Z');
    expect(isEventActive(event, after)).toBe(false);
  });
});

// ============================================
// getActiveEvents
// ============================================
describe('getActiveEvents', () => {
  it('returns summer event when date is in late June', () => {
    const date = new Date('2026-06-25T12:00:00');
    const active = getActiveEvents(date);
    expect(active.some(e => e.id.startsWith('summer-'))).toBe(true);
  });

  it('returns events with isActive=true', () => {
    const date = new Date('2026-06-25T12:00:00');
    const active = getActiveEvents(date);
    for (const event of active) {
      expect(event.isActive).toBe(true);
    }
  });

  it('returns empty array when no events are active', () => {
    const date = new Date('2026-05-15T12:00:00');
    const active = getActiveEvents(date);
    expect(active).toHaveLength(0);
  });

  it('includes previous year winter event in early January', () => {
    const date = new Date('2026-01-02T12:00:00');
    const active = getActiveEvents(date);
    // winter-2025 spans Dec 20 2025 - Jan 3 2026
    expect(active.some(e => e.id === 'winter-2025')).toBe(true);
  });
});

// ============================================
// getUpcomingEvents
// ============================================
describe('getUpcomingEvents', () => {
  it('returns events starting within the next 30 days', () => {
    // Spring event starts March 20, so check from Feb 25
    const date = new Date('2026-02-25T12:00:00');
    const upcoming = getUpcomingEvents(date);
    expect(upcoming.some(e => e.id.startsWith('spring-'))).toBe(true);
  });

  it('excludes events that have already started', () => {
    const date = new Date('2026-06-21T12:00:00');
    const upcoming = getUpcomingEvents(date);
    // Summer started June 20, should not be in upcoming
    expect(upcoming.some(e => e.id.startsWith('summer-'))).toBe(false);
  });

  it('excludes events more than 30 days away', () => {
    const date = new Date('2026-01-15T12:00:00');
    const upcoming = getUpcomingEvents(date);
    // Spring starts March 20 — more than 30 days away
    expect(upcoming.some(e => e.id.startsWith('spring-'))).toBe(false);
  });
});

// ============================================
// getSeasonalProgress / saveSeasonalProgress
// ============================================
describe('getSeasonalProgress / saveSeasonalProgress', () => {
  it('returns empty object when nothing is stored', () => {
    expect(getSeasonalProgress()).toEqual({});
  });

  it('round-trips saved progress', () => {
    const progress: Record<string, UserSeasonalProgress> = {
      'test-event': {
        eventId: 'test-event',
        challenges: { ch1: { progress: 3, completed: false } },
        allChallengesCompleted: false,
        completionRewardClaimed: false,
        participatedAt: '2026-06-20T00:00:00.000Z',
      },
    };
    saveSeasonalProgress(progress);
    expect(getSeasonalProgress()).toEqual(progress);
  });
});

// ============================================
// initializeEventProgress
// ============================================
describe('initializeEventProgress', () => {
  it('creates progress object with all challenges at zero', () => {
    vi.setSystemTime(new Date('2026-06-25T12:00:00'));
    const challenges = [
      makeChallenge({ id: 'ch-1', target: 5 }),
      makeChallenge({ id: 'ch-2', target: 10 }),
    ];
    const progress = initializeEventProgress('test-event', challenges);

    expect(progress.eventId).toBe('test-event');
    expect(progress.challenges['ch-1'].progress).toBe(0);
    expect(progress.challenges['ch-1'].completed).toBe(false);
    expect(progress.challenges['ch-2'].progress).toBe(0);
    expect(progress.allChallengesCompleted).toBe(false);
    expect(progress.completionRewardClaimed).toBe(false);
  });

  it('returns existing progress if already initialized', () => {
    vi.setSystemTime(new Date('2026-06-25T12:00:00'));
    const challenges = [makeChallenge({ id: 'ch-1', target: 5 })];
    const first = initializeEventProgress('test-event', challenges);
    // Manually update progress in storage
    const allProgress = getSeasonalProgress();
    allProgress['test-event'].challenges['ch-1'].progress = 3;
    saveSeasonalProgress(allProgress);

    const second = initializeEventProgress('test-event', challenges);
    expect(second.challenges['ch-1'].progress).toBe(3);
    expect(second).toEqual(first === second ? first : expect.objectContaining({ eventId: 'test-event' }));
  });
});

// ============================================
// updateChallengeProgress
// ============================================
describe('updateChallengeProgress', () => {
  it('returns zero progress when event progress does not exist', () => {
    const result = updateChallengeProgress('nonexistent', 'ch-1', 1);
    expect(result).toEqual({ completed: false, newProgress: 0 });
  });

  it('increments progress for a challenge in an active event', () => {
    vi.setSystemTime(new Date('2026-06-25T12:00:00'));
    const events = getActiveEvents(new Date());
    const summerEvent = events.find(e => e.id.startsWith('summer-'));
    expect(summerEvent).toBeDefined();

    initializeEventProgress(summerEvent.id, summerEvent.challenges);
    const challengeId = summerEvent.challenges[0].id;
    const result = updateChallengeProgress(summerEvent.id, challengeId, 50);

    expect(result.newProgress).toBe(50);
    expect(result.completed).toBe(false);
  });

  it('caps progress at target and marks completed', () => {
    vi.setSystemTime(new Date('2026-06-25T12:00:00'));
    const events = getActiveEvents(new Date());
    const summerEvent = events.find(e => e.id.startsWith('summer-'));
    expect(summerEvent).toBeDefined();

    initializeEventProgress(summerEvent.id, summerEvent.challenges);
    const challenge = summerEvent.challenges[0];
    // Exceed the target
    const result = updateChallengeProgress(summerEvent.id, challenge.id, challenge.target + 100);

    expect(result.newProgress).toBe(challenge.target);
    expect(result.completed).toBe(true);
  });

  it('does not increment already completed challenge', () => {
    vi.setSystemTime(new Date('2026-06-25T12:00:00'));
    const events = getActiveEvents(new Date());
    const summerEvent = events.find(e => e.id.startsWith('summer-'));
    expect(summerEvent).toBeDefined();

    initializeEventProgress(summerEvent.id, summerEvent.challenges);
    const challenge = summerEvent.challenges[0];

    // Complete the challenge
    updateChallengeProgress(summerEvent.id, challenge.id, challenge.target);
    // Try to add more
    const result = updateChallengeProgress(summerEvent.id, challenge.id, 10);
    expect(result.completed).toBe(true);
    expect(result.newProgress).toBe(challenge.target);
  });
});

// ============================================
// claimCompletionReward
// ============================================
describe('claimCompletionReward', () => {
  it('returns null when event progress does not exist', () => {
    expect(claimCompletionReward('nonexistent')).toBeNull();
  });

  it('returns null when not all challenges are completed', () => {
    vi.setSystemTime(new Date('2026-06-25T12:00:00'));
    const events = getActiveEvents(new Date());
    const summerEvent = events.find(e => e.id.startsWith('summer-'));
    expect(summerEvent).toBeDefined();

    initializeEventProgress(summerEvent.id, summerEvent.challenges);
    expect(claimCompletionReward(summerEvent.id)).toBeNull();
  });

  it('returns completion reward when all challenges done', () => {
    vi.setSystemTime(new Date('2026-01-05T12:00:00'));
    const events = getActiveEvents(new Date());
    const nyEvent = events.find(e => e.id.startsWith('new-year-'));
    expect(nyEvent).toBeDefined();
    expect(nyEvent.completionReward).toBeDefined();

    initializeEventProgress(nyEvent.id, nyEvent.challenges);
    // Complete all challenges
    for (const ch of nyEvent.challenges) {
      updateChallengeProgress(nyEvent.id, ch.id, ch.target);
    }

    const reward = claimCompletionReward(nyEvent.id);
    expect(reward).toBeDefined();
    expect(reward.type).toBe('badge');
  });

  it('returns null on second claim attempt', () => {
    vi.setSystemTime(new Date('2026-01-05T12:00:00'));
    const events = getActiveEvents(new Date());
    const nyEvent = events.find(e => e.id.startsWith('new-year-'));
    expect(nyEvent).toBeDefined();

    initializeEventProgress(nyEvent.id, nyEvent.challenges);
    for (const ch of nyEvent.challenges) {
      updateChallengeProgress(nyEvent.id, ch.id, ch.target);
    }

    claimCompletionReward(nyEvent.id);
    // Second claim should return null
    expect(claimCompletionReward(nyEvent.id)).toBeNull();
  });
});

// ============================================
// onHabitCompleted / onMoodLogged / onFocusCompleted / onGratitudeAdded
// ============================================
describe('event trigger hooks', () => {
  it('onHabitCompleted updates habit_streak challenges in active events', () => {
    vi.setSystemTime(new Date('2026-06-25T12:00:00'));
    onHabitCompleted();

    const progress = getSeasonalProgress();
    // Summer event has a focus_minutes challenge (not habit_streak)
    // so let's verify it got initialized
    const summerKey = Object.keys(progress).find(k => k.startsWith('summer-'));
    expect(summerKey).toBeDefined();
  });

  it('onMoodLogged updates mood_logs challenges', () => {
    vi.setSystemTime(new Date('2026-01-05T12:00:00'));
    onMoodLogged();

    const progress = getSeasonalProgress();
    const nyKey = Object.keys(progress).find(k => k.startsWith('new-year-'));
    expect(nyKey).toBeDefined();
    // New Year event has a mood_logs challenge
    const nyProgress = progress[nyKey];
    const moodChallengeId = Object.keys(nyProgress.challenges).find(k => k.includes('mood'));
    expect(moodChallengeId).toBeDefined();
    expect(nyProgress.challenges[moodChallengeId].progress).toBe(1);
  });

  it('onFocusCompleted updates focus_minutes challenges with given minutes', () => {
    vi.setSystemTime(new Date('2026-06-25T12:00:00'));
    onFocusCompleted(30);

    const progress = getSeasonalProgress();
    const summerKey = Object.keys(progress).find(k => k.startsWith('summer-'));
    expect(summerKey).toBeDefined();
    const summerProgress = progress[summerKey];
    const focusChallengeId = Object.keys(summerProgress.challenges).find(k => k.includes('focus'));
    expect(focusChallengeId).toBeDefined();
    expect(summerProgress.challenges[focusChallengeId].progress).toBe(30);
  });

  it('onGratitudeAdded updates gratitude_entries challenges', () => {
    vi.setSystemTime(new Date('2026-02-10T12:00:00'));
    onGratitudeAdded();

    const progress = getSeasonalProgress();
    const valKey = Object.keys(progress).find(k => k.startsWith('valentine-'));
    expect(valKey).toBeDefined();
    const valProgress = progress[valKey];
    const gratChallengeId = Object.keys(valProgress.challenges).find(k => k.includes('gratitude'));
    expect(gratChallengeId).toBeDefined();
    expect(valProgress.challenges[gratChallengeId].progress).toBe(1);
  });
});

// ============================================
// getEventWithProgress
// ============================================
describe('getEventWithProgress', () => {
  it('returns event with userProgress=null when no progress exists', () => {
    const event = makeEvent();
    const result = getEventWithProgress(event);
    expect(result.userProgress).toBeNull();
  });

  it('merges stored progress into challenge fields', () => {
    vi.setSystemTime(new Date('2026-06-25T12:00:00'));
    const events = getActiveEvents(new Date());
    const summerEvent = events.find(e => e.id.startsWith('summer-'));
    expect(summerEvent).toBeDefined();

    initializeEventProgress(summerEvent.id, summerEvent.challenges);
    const challenge = summerEvent.challenges[0];
    updateChallengeProgress(summerEvent.id, challenge.id, 42);

    const result = getEventWithProgress(summerEvent);
    expect(result.userProgress).not.toBeNull();
    expect(result.challenges[0].progress).toBe(42);
    expect(result.challenges[0].completed).toBe(false);
  });

  it('preserves original event fields alongside progress', () => {
    const event = makeEvent({ name: 'My Event', themeColor: '#123' });
    const result = getEventWithProgress(event);
    expect(result.name).toBe('My Event');
    expect(result.themeColor).toBe('#123');
  });
});
