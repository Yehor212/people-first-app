import { describe, it, expect } from 'vitest';
import {
  getCurrentGardenAtmosphere,
  getCompanionBehaviorForAtmosphere,
} from '@/lib/gardenAtmosphere';
import type { GardenAtmosphere } from '@/lib/gardenAtmosphere';
import type { ScheduleEvent } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ScheduleEvent that spans [startHour:startMinute, endHour:endMinute). */
function makeEvent(
  overrides: Partial<ScheduleEvent> & {
    startHour: number;
    endHour: number;
    title?: string;
    colorVar?: string;
  },
): ScheduleEvent {
  return {
    ...overrides,
    id: 'evt-test',
    title: overrides.title ?? 'Test Event',
    startHour: overrides.startHour,
    startMinute: overrides.startMinute ?? 0,
    endHour: overrides.endHour,
    endMinute: overrides.endMinute ?? 0,
    colorVar: overrides.colorVar,
  } as ScheduleEvent;
}

// ---------------------------------------------------------------------------
// getCurrentGardenAtmosphere
// ---------------------------------------------------------------------------

describe('getCurrentGardenAtmosphere', () => {
  describe('when there are no events', () => {
    it('returns default', () => {
      expect(getCurrentGardenAtmosphere([], 10, 0)).toBe('default');
    });
  });

  describe('colorVar-based atmosphere detection', () => {
    it('returns focused for a work event covering current time', () => {
      const event = makeEvent({ startHour: 9, endHour: 11, colorVar: 'work' });
      expect(getCurrentGardenAtmosphere([event], 10, 0)).toBe('focused');
    });

    it('returns focused for a study event covering current time', () => {
      const event = makeEvent({ startHour: 14, endHour: 16, colorVar: 'study' });
      expect(getCurrentGardenAtmosphere([event], 15, 30)).toBe('focused');
    });

    it('returns restful for a rest event covering current time', () => {
      const event = makeEvent({ startHour: 13, endHour: 14, colorVar: 'rest' });
      expect(getCurrentGardenAtmosphere([event], 13, 0)).toBe('restful');
    });

    it('returns restful for a break event covering current time', () => {
      const event = makeEvent({ startHour: 15, endHour: 16, colorVar: 'break' });
      expect(getCurrentGardenAtmosphere([event], 15, 45)).toBe('restful');
    });

    it('returns social for a meeting event covering current time', () => {
      const event = makeEvent({ startHour: 10, endHour: 11, colorVar: 'meeting' });
      expect(getCurrentGardenAtmosphere([event], 10, 15)).toBe('social');
    });

    it('returns energetic for an exercise event covering current time', () => {
      const event = makeEvent({ startHour: 7, endHour: 8, colorVar: 'exercise' });
      expect(getCurrentGardenAtmosphere([event], 7, 30)).toBe('energetic');
    });
  });

  describe('time boundary conditions', () => {
    it('returns default when current time is before the event start', () => {
      const event = makeEvent({ startHour: 10, endHour: 12, colorVar: 'work' });
      expect(getCurrentGardenAtmosphere([event], 9, 59)).toBe('default');
    });

    it('returns default when current time equals the event end (exclusive boundary)', () => {
      const event = makeEvent({ startHour: 10, endHour: 12, colorVar: 'work' });
      // currentTime === end means NOT inside the event (currentTime >= start && currentTime < end)
      expect(getCurrentGardenAtmosphere([event], 12, 0)).toBe('default');
    });

    it('returns focused when current time equals the event start (inclusive boundary)', () => {
      const event = makeEvent({ startHour: 10, endHour: 12, colorVar: 'work' });
      expect(getCurrentGardenAtmosphere([event], 10, 0)).toBe('focused');
    });

    it('returns default when current time is after the event end', () => {
      const event = makeEvent({ startHour: 10, endHour: 12, colorVar: 'work' });
      expect(getCurrentGardenAtmosphere([event], 13, 0)).toBe('default');
    });

    it('respects startMinute and endMinute when matching', () => {
      const event = makeEvent({
        startHour: 9,
        startMinute: 30,
        endHour: 10,
        endMinute: 30,
        colorVar: 'work',
      });
      // Inside the window
      expect(getCurrentGardenAtmosphere([event], 10, 0)).toBe('focused');
      // Before the window
      expect(getCurrentGardenAtmosphere([event], 9, 29)).toBe('default');
      // After the window
      expect(getCurrentGardenAtmosphere([event], 10, 30)).toBe('default');
    });
  });

  describe('title keyword fallback (no colorVar)', () => {
    it('returns focused when title contains focus', () => {
      const event = makeEvent({ startHour: 9, endHour: 11, title: 'Deep Focus Session' });
      expect(getCurrentGardenAtmosphere([event], 10, 0)).toBe('focused');
    });

    it('returns focused when title contains work', () => {
      const event = makeEvent({ startHour: 9, endHour: 11, title: 'Work on feature' });
      expect(getCurrentGardenAtmosphere([event], 10, 0)).toBe('focused');
    });

    it('returns focused when title contains study', () => {
      const event = makeEvent({ startHour: 14, endHour: 16, title: 'Study for exam' });
      expect(getCurrentGardenAtmosphere([event], 15, 0)).toBe('focused');
    });

    it('returns restful when title contains rest', () => {
      const event = makeEvent({ startHour: 13, endHour: 14, title: 'Rest time' });
      expect(getCurrentGardenAtmosphere([event], 13, 30)).toBe('restful');
    });

    it('returns restful when title contains break', () => {
      const event = makeEvent({ startHour: 12, endHour: 13, title: 'Lunch break' });
      expect(getCurrentGardenAtmosphere([event], 12, 30)).toBe('restful');
    });

    it('returns restful when title contains nap', () => {
      const event = makeEvent({ startHour: 15, endHour: 16, title: 'Power nap' });
      expect(getCurrentGardenAtmosphere([event], 15, 15)).toBe('restful');
    });

    it('returns energetic when title contains exercise', () => {
      const event = makeEvent({ startHour: 7, endHour: 8, title: 'Morning exercise' });
      expect(getCurrentGardenAtmosphere([event], 7, 0)).toBe('energetic');
    });

    it('returns energetic when title contains gym', () => {
      const event = makeEvent({ startHour: 18, endHour: 19, title: 'Gym session' });
      expect(getCurrentGardenAtmosphere([event], 18, 30)).toBe('energetic');
    });

    it('returns energetic when title contains run', () => {
      const event = makeEvent({ startHour: 6, endHour: 7, title: 'Morning run' });
      expect(getCurrentGardenAtmosphere([event], 6, 30)).toBe('energetic');
    });

    it('returns social when title contains meeting', () => {
      const event = makeEvent({ startHour: 10, endHour: 11, title: 'Team meeting' });
      expect(getCurrentGardenAtmosphere([event], 10, 30)).toBe('social');
    });

    it('returns social when title contains call', () => {
      const event = makeEvent({ startHour: 11, endHour: 12, title: 'Video call with client' });
      expect(getCurrentGardenAtmosphere([event], 11, 0)).toBe('social');
    });

    it('returns social when title contains social', () => {
      const event = makeEvent({ startHour: 17, endHour: 19, title: 'Social gathering' });
      expect(getCurrentGardenAtmosphere([event], 18, 0)).toBe('social');
    });

    it('returns creative when title contains create', () => {
      // 'Create a painting' has no 'work'/'study'/'focus' substring, so falls through to 'create'
      const event = makeEvent({ startHour: 16, endHour: 18, title: 'Create a painting' });
      expect(getCurrentGardenAtmosphere([event], 17, 0)).toBe('creative');
    });

    it('returns creative when title contains draw', () => {
      const event = makeEvent({ startHour: 14, endHour: 15, title: 'Draw characters' });
      expect(getCurrentGardenAtmosphere([event], 14, 30)).toBe('creative');
    });

    it('returns creative when title contains write', () => {
      const event = makeEvent({ startHour: 20, endHour: 22, title: 'Write short story' });
      expect(getCurrentGardenAtmosphere([event], 21, 0)).toBe('creative');
    });

    it('returns default when title has no recognized keyword', () => {
      const event = makeEvent({ startHour: 9, endHour: 10, title: 'Miscellaneous' });
      expect(getCurrentGardenAtmosphere([event], 9, 30)).toBe('default');
    });
  });

  describe('colorVar takes precedence over title keywords', () => {
    it('returns restful via colorVar=rest even when title says focus', () => {
      const event = makeEvent({ startHour: 9, endHour: 10, title: 'Focus break', colorVar: 'rest' });
      expect(getCurrentGardenAtmosphere([event], 9, 30)).toBe('restful');
    });
  });

  describe('multiple events — first matching wins', () => {
    it('matches the event whose time range covers the current time', () => {
      const events = [
        makeEvent({ id: 'a', startHour: 8, endHour: 9, colorVar: 'exercise' }),
        makeEvent({ id: 'b', startHour: 10, endHour: 12, colorVar: 'work' }),
        makeEvent({ id: 'c', startHour: 14, endHour: 15, colorVar: 'rest' }),
      ];
      expect(getCurrentGardenAtmosphere(events, 10, 30)).toBe('focused');
      expect(getCurrentGardenAtmosphere(events, 8, 30)).toBe('energetic');
      expect(getCurrentGardenAtmosphere(events, 14, 0)).toBe('restful');
    });
  });
});

// ---------------------------------------------------------------------------
// getCompanionBehaviorForAtmosphere
// ---------------------------------------------------------------------------

describe('getCompanionBehaviorForAtmosphere', () => {
  const cases: Array<{ atmosphere: GardenAtmosphere; behavior: string }> = [
    { atmosphere: 'focused', behavior: 'sits_still' },
    { atmosphere: 'social', behavior: 'waves' },
    { atmosphere: 'restful', behavior: 'sleeps' },
    { atmosphere: 'energetic', behavior: 'bounces' },
    { atmosphere: 'creative', behavior: 'watches' },
    { atmosphere: 'default', behavior: 'idle' },
  ];

  for (const { atmosphere, behavior } of cases) {
    it(`returns '${behavior}' for atmosphere '${atmosphere}'`, () => {
      expect(getCompanionBehaviorForAtmosphere(atmosphere)).toBe(behavior);
    });
  }

  it('returns a non-empty string for every defined atmosphere', () => {
    const atmospheres: GardenAtmosphere[] = [
      'default', 'focused', 'social', 'restful', 'energetic', 'creative',
    ];
    for (const atm of atmospheres) {
      const result = getCompanionBehaviorForAtmosphere(atm);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });
});
