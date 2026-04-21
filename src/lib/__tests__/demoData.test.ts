import { describe, it, expect } from 'vitest';
import { DEMO_DATA, getDemoCompanionState } from '../demoData';

// ============================================
// DEMO_DATA structure
// ============================================

describe('DEMO_DATA', () => {
  it('has all top-level data sections', () => {
    expect(DEMO_DATA.profile).toBeDefined();
    expect(DEMO_DATA.habits).toBeDefined();
    expect(DEMO_DATA.moods).toBeDefined();
    expect(DEMO_DATA.focusSessions).toBeDefined();
    expect(DEMO_DATA.gratitudeEntries).toBeDefined();
    expect(DEMO_DATA.goals).toBeDefined();
    expect(DEMO_DATA.tasks).toBeDefined();
    expect(DEMO_DATA.weeklyStats).toBeDefined();
  });
});

// ============================================
// Habits
// ============================================

describe('DEMO_DATA.habits', () => {
  it('is a non-empty array', () => {
    expect(DEMO_DATA.habits.length).toBeGreaterThan(0);
  });

  it('each habit has required shape fields', () => {
    for (const habit of DEMO_DATA.habits) {
      expect(typeof habit.id).toBe('string');
      expect(typeof habit.name).toBe('string');
      expect(typeof habit.icon).toBe('string');
      expect(typeof habit.color).toBe('number');
      expect(typeof habit.habitType).toBe('string');
      expect(typeof habit.frequency).toBe('object');
      expect(habit.frequency).toHaveProperty('numerator');
      expect(habit.frequency).toHaveProperty('denominator');
      expect(typeof habit.entries).toBe('object');
      expect(typeof habit.createdAt).toBe('number');
    }
  });

  it('has unique habit ids', () => {
    const ids = DEMO_DATA.habits.map(h => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ============================================
// Moods
// ============================================

describe('DEMO_DATA.moods', () => {
  it('is a non-empty array', () => {
    expect(DEMO_DATA.moods.length).toBeGreaterThan(0);
  });

  it('each mood entry has MoodEntry shape', () => {
    const validMoods = ['great', 'good', 'okay', 'bad', 'terrible'];
    for (const entry of DEMO_DATA.moods) {
      expect(typeof entry.id).toBe('string');
      expect(validMoods).toContain(entry.mood);
      expect(typeof entry.date).toBe('string');
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof entry.timestamp).toBe('number');
    }
  });
});

// ============================================
// Focus Sessions
// ============================================

describe('DEMO_DATA.focusSessions', () => {
  it('is a non-empty array', () => {
    expect(DEMO_DATA.focusSessions.length).toBeGreaterThan(0);
  });

  it('each session has duration and status', () => {
    for (const session of DEMO_DATA.focusSessions) {
      expect(typeof session.id).toBe('string');
      expect(typeof session.duration).toBe('number');
      expect(session.duration).toBeGreaterThan(0);
      expect(session.status).toBe('completed');
      expect(typeof session.date).toBe('string');
      expect(typeof session.completedAt).toBe('number');
    }
  });

  it('each session has a label', () => {
    for (const session of DEMO_DATA.focusSessions) {
      expect(session.label).toBeDefined();
      expect(typeof session.label).toBe('string');
      expect((session.label ?? '').length).toBeGreaterThan(0);
    }
  });
});

// ============================================
// Gratitude Entries
// ============================================

describe('DEMO_DATA.gratitudeEntries', () => {
  it('is a non-empty array', () => {
    expect(DEMO_DATA.gratitudeEntries.length).toBeGreaterThan(0);
  });

  it('each entry has text, date, and timestamp', () => {
    for (const entry of DEMO_DATA.gratitudeEntries) {
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.text).toBe('string');
      expect(entry.text.length).toBeGreaterThan(0);
      expect(typeof entry.date).toBe('string');
      expect(typeof entry.timestamp).toBe('number');
    }
  });
});

// ============================================
// getDemoCompanionState
// ============================================

describe('getDemoCompanionState', () => {
  it('returns a valid companion object', () => {
    const companion = getDemoCompanionState();
    expect(typeof companion.name).toBe('string');
    expect(typeof companion.type).toBe('string');
    expect(typeof companion.level).toBe('number');
    expect(companion.level).toBeGreaterThan(0);
    expect(typeof companion.experience).toBe('number');
  });

  it('has fullness and happiness values', () => {
    const companion = getDemoCompanionState();
    expect(typeof companion.fullness).toBe('number');
    expect(typeof companion.happiness).toBe('number');
  });

  it('has interaction timestamps', () => {
    const companion = getDemoCompanionState();
    expect(typeof companion.lastInteraction).toBe('number');
    expect(typeof companion.lastPetTime).toBe('number');
    expect(typeof companion.lastFeedTime).toBe('number');
  });
});
