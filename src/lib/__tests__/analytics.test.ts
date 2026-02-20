import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

let mockIsDev = false;
vi.mock('@/lib/env', () => ({
  get IS_DEV() {
    return mockIsDev;
  },
}));

import { analytics } from '@/lib/analytics';

// ─── Helpers ────────────────────────────────────────────────────
const mockGtag = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockIsDev = false;
  // Reset analytics enabled state by re-initialising with disabled settings
  analytics.init({ analytics: false, noTracking: false });
  delete (window as any).gtag;
});

// ─── init ───────────────────────────────────────────────────────

describe('analytics.init', () => {
  it('enables tracking when analytics=true and noTracking=false', () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: false });
    analytics.track('test_event');
    expect(mockGtag).toHaveBeenCalledWith('event', 'test_event', undefined);
  });

  it('disables tracking when analytics=false', () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: false, noTracking: false });
    analytics.track('test_event');
    expect(mockGtag).not.toHaveBeenCalled();
  });

  it('disables tracking when noTracking=true', () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: true });
    analytics.track('test_event');
    expect(mockGtag).not.toHaveBeenCalled();
  });
});

// ─── track ──────────────────────────────────────────────────────

describe('analytics.track', () => {
  it('does nothing when disabled', () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: false, noTracking: false });
    analytics.track('test_event');
    expect(mockGtag).not.toHaveBeenCalled();
  });

  it('calls window.gtag when enabled', () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: false });
    analytics.track('click', { button: 'ok' });
    expect(mockGtag).toHaveBeenCalledWith('event', 'click', { button: 'ok' });
  });

  it('swallows errors from gtag', () => {
    window.gtag = vi.fn(() => {
      throw new Error('gtag broke');
    });
    analytics.init({ analytics: true, noTracking: false });
    expect(() => analytics.track('test')).not.toThrow();
  });
});

// ─── convenience methods ────────────────────────────────────────

describe('analytics convenience methods', () => {
  beforeEach(() => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: false });
  });

  it('page() calls track with page_view', () => {
    analytics.page('home');
    expect(mockGtag).toHaveBeenCalledWith('event', 'page_view', { page: 'home' });
  });

  it('signIn() tracks sign_in', () => {
    analytics.signIn();
    expect(mockGtag).toHaveBeenCalledWith('event', 'sign_in', undefined);
  });

  it('signOut() tracks sign_out', () => {
    analytics.signOut();
    expect(mockGtag).toHaveBeenCalledWith('event', 'sign_out', undefined);
  });

  it('habitCompleted() tracks habit_completed with name', () => {
    analytics.habitCompleted('Meditation');
    expect(mockGtag).toHaveBeenCalledWith('event', 'habit_completed', { habit: 'Meditation' });
  });

  it('moodTracked() tracks mood_tracked with mood', () => {
    analytics.moodTracked('great');
    expect(mockGtag).toHaveBeenCalledWith('event', 'mood_tracked', { mood: 'great' });
  });

  it('focusSessionCompleted() tracks focus_session with duration', () => {
    analytics.focusSessionCompleted(25);
    expect(mockGtag).toHaveBeenCalledWith('event', 'focus_session', { duration_minutes: 25 });
  });

  it('achievementUnlocked() tracks achievement_unlocked with id', () => {
    analytics.achievementUnlocked('streak_7');
    expect(mockGtag).toHaveBeenCalledWith('event', 'achievement_unlocked', { achievement: 'streak_7' });
  });
});
