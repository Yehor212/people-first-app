import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────

const mockSetReminders = vi.fn();
let mockReminders: any = {};
let mockIsLoading = false;

vi.mock('@/stores', () => ({
  useUserDataStore: vi.fn((selector: any) => {
    const state = {
      isLoading: mockIsLoading,
      reminders: mockReminders,
      setReminders: mockSetReminders,
    };
    return selector(state);
  }),
}));

vi.mock('@/lib/reminders', () => ({
  defaultReminderSettings: {
    enabled: false,
    moodTimeMorning: '09:00',
    moodTimeAfternoon: '14:00',
    moodTimeEvening: '20:00',
    habitTime: '21:00',
    focusTime: '10:00',
    days: [1, 2, 3, 4, 5],
    quietHours: { start: '22:00', end: '08:00' },
    habitIds: [],
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn() },
}));

import { useReminderMigration } from '../useReminderMigration';

// ─── Setup ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockReminders = {};
  mockIsLoading = false;
});

// ─── Tests ────────────────────────────────────────────────────

describe('useReminderMigration', () => {
  it('does nothing while isLoading is true', () => {
    mockIsLoading = true;
    mockReminders = { moodTime: '08:30' };

    renderHook(() => useReminderMigration());

    expect(mockSetReminders).not.toHaveBeenCalled();
  });

  it('migrates old moodTime to 3-time format', () => {
    mockReminders = { moodTime: '08:30' };

    renderHook(() => useReminderMigration());

    expect(mockSetReminders).toHaveBeenCalledTimes(1);
    // Extract the updater function and call it to verify the result
    const updater = mockSetReminders.mock.calls[0][0];
    const result = updater({ moodTime: '08:30' });

    expect(result.moodTimeMorning).toBe('08:30');
    expect(result.moodTimeAfternoon).toBe('14:00');
    expect(result.moodTimeEvening).toBe('20:00');
    expect(result.moodTime).toBeUndefined();
  });

  it('sets defaults when no moodTimeMorning and no moodTime', () => {
    mockReminders = {};

    renderHook(() => useReminderMigration());

    expect(mockSetReminders).toHaveBeenCalledTimes(1);
    // Extract the updater function and call it to verify defaults are spread
    const updater = mockSetReminders.mock.calls[0][0];
    const result = updater({});

    expect(result.moodTimeMorning).toBe('09:00');
    expect(result.moodTimeAfternoon).toBe('14:00');
    expect(result.moodTimeEvening).toBe('20:00');
  });

  it('does nothing when already migrated (has moodTimeMorning)', () => {
    mockReminders = { moodTimeMorning: '09:00', moodTimeAfternoon: '14:00', moodTimeEvening: '20:00' };

    renderHook(() => useReminderMigration());

    expect(mockSetReminders).not.toHaveBeenCalled();
  });

  it('uses old moodTime value as moodTimeMorning during migration', () => {
    mockReminders = { moodTime: '07:15' };

    renderHook(() => useReminderMigration());

    const updater = mockSetReminders.mock.calls[0][0];
    const result = updater({ moodTime: '07:15' });

    expect(result.moodTimeMorning).toBe('07:15');
  });
});
