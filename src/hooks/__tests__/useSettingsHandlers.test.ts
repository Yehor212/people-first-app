/**
 * useSettingsHandlers Hook Tests
 * Tests reset data, name change, pull-to-refresh, and schedule event CRUD.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- mocks ---

const mockSetMoods = vi.fn();
const mockSetHabits = vi.fn();
const mockSetFocusSessions = vi.fn();
const mockSetGratitudeEntries = vi.fn();
const mockSetUserName = vi.fn();
const mockSetUserNameCustom = vi.fn();
const mockSetScheduleEvents = vi.fn();
const mockSetCanvasGoals = vi.fn();
const mockSetOnboardingComplete = vi.fn();
const mockSetHasSelectedLanguage = vi.fn();
const mockScheduleEvents = [
  { id: 'e1', title: 'Manual Event', date: '2026-02-19', startHour: 9, startMinute: 0, endHour: 10, endMinute: 0, color: '#ff0000', source: 'manual' as const },
  { id: 'e2', title: 'Habit Event', date: '2026-02-19', startHour: 11, startMinute: 0, endHour: 12, endMinute: 0, color: '#00ff00', source: 'habit' as const },
];

vi.mock('@/stores', () => ({
  useUserDataStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      setMoods: mockSetMoods,
      setHabits: mockSetHabits,
      setFocusSessions: mockSetFocusSessions,
      setGratitudeEntries: mockSetGratitudeEntries,
      setUserName: mockSetUserName,
      setUserNameCustom: mockSetUserNameCustom,
      setScheduleEvents: mockSetScheduleEvents,
      setCanvasGoals: mockSetCanvasGoals,
      setOnboardingComplete: mockSetOnboardingComplete,
      setHasSelectedLanguage: mockSetHasSelectedLanguage,
      scheduleEvents: mockScheduleEvents,
    }),
  ),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), log: vi.fn() },
}));

vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'generated-id'),
}));

vi.mock('@/lib/habits', () => ({
  normalizeHabit: vi.fn((h: unknown) => h),
}));

const mockSyncWithCloud = vi.fn((_mode: unknown) => Promise.resolve());
vi.mock('@/storage/cloudSync', () => ({
  syncWithCloud: (mode: unknown) => mockSyncWithCloud(mode),
}));

const mockMoodsToArray = vi.fn(() => Promise.resolve([{ id: 'm1' }]));
const mockHabitsToArray = vi.fn(() => Promise.resolve([{ id: 'h1' }]));
const mockFocusSessionsToArray = vi.fn(() => Promise.resolve([{ id: 'f1' }]));
const mockGratitudeEntriesToArray = vi.fn(() => Promise.resolve([{ id: 'g1' }]));

vi.mock('@/storage/db', () => ({
  db: {
    moods: { toArray: () => mockMoodsToArray() },
    habits: { toArray: () => mockHabitsToArray() },
    focusSessions: { toArray: () => mockFocusSessionsToArray() },
    gratitudeEntries: { toArray: () => mockGratitudeEntriesToArray() },
  },
}));

// --- import under test after mocks ---

import { useSettingsHandlers } from '../useSettingsHandlers';
import { logger } from '@/lib/logger';

describe('useSettingsHandlers', () => {
  const allScheduleEvents = mockScheduleEvents;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleResetData clears all arrays and sets name to Friend', () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    act(() => {
      result.current.handleResetData();
    });

    expect(mockSetMoods).toHaveBeenCalledWith([]);
    expect(mockSetHabits).toHaveBeenCalledWith([]);
    expect(mockSetFocusSessions).toHaveBeenCalledWith([]);
    expect(mockSetGratitudeEntries).toHaveBeenCalledWith([]);
    expect(mockSetScheduleEvents).toHaveBeenCalledWith([]);
    expect(mockSetCanvasGoals).toHaveBeenCalledWith([]);
    expect(mockSetUserName).toHaveBeenCalledWith('Friend');
    expect(mockSetUserNameCustom).toHaveBeenCalledWith(false);
    expect(mockSetOnboardingComplete).toHaveBeenCalledWith(false);
    expect(mockSetHasSelectedLanguage).toHaveBeenCalledWith(false);
  });

  it('handleNameChange sets name and custom flag', () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    act(() => {
      result.current.handleNameChange('Alice');
    });

    expect(mockSetUserName).toHaveBeenCalledWith('Alice');
    expect(mockSetUserNameCustom).toHaveBeenCalledWith(true);
  });

  it('handleAddScheduleEvent adds event with generated id', () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    act(() => {
      result.current.handleAddScheduleEvent({
        title: 'New Event',
        date: '2026-02-19',
        startHour: 14,
        startMinute: 0,
        endHour: 15,
        endMinute: 0,
        color: '#0000ff',
      });
    });

    expect(mockSetScheduleEvents).toHaveBeenCalledWith(expect.any(Function));
    // Call the updater function to verify the new event
    const updater = mockSetScheduleEvents.mock.calls[0][0] as (prev: unknown[]) => unknown[];
    const newEvents = updater([]);
    expect(newEvents).toHaveLength(1);
    expect(newEvents[0]).toMatchObject({
      id: 'generated-id',
      title: 'New Event',
      source: 'manual',
      isEditable: true,
    });
  });

  it('handleDeleteScheduleEvent removes manual events', () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    act(() => {
      result.current.handleDeleteScheduleEvent('e1');
    });

    // Should call setScheduleEvents with filtered array (removing 'e1')
    expect(mockSetScheduleEvents).toHaveBeenCalled();
  });

  it('handleDeleteScheduleEvent skips habit events and logs warning', () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    act(() => {
      result.current.handleDeleteScheduleEvent('e2');
    });

    expect(logger.warn).toHaveBeenCalledWith(
      '[Schedule] Cannot delete habit/google-generated event directly',
    );
    // setScheduleEvents should NOT be called for habit events
    expect(mockSetScheduleEvents).not.toHaveBeenCalled();
  });

  it('handlePullToRefresh calls syncWithCloud then reloads from db', async () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    await act(async () => {
      await result.current.handlePullToRefresh();
    });

    expect(mockSyncWithCloud).toHaveBeenCalledWith('merge');
    expect(mockSetMoods).toHaveBeenCalledWith([{ id: 'm1' }]);
    expect(mockSetHabits).toHaveBeenCalled(); // normalizeHabit is called on each
    expect(mockSetFocusSessions).toHaveBeenCalledWith([{ id: 'f1' }]);
    expect(mockSetGratitudeEntries).toHaveBeenCalledWith([{ id: 'g1' }]);
  });

  it('handlePullToRefresh re-throws errors for UI feedback', async () => {
    mockSyncWithCloud.mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    // Should re-throw so PullToRefresh can show error feedback
    await act(async () => {
      await expect(result.current.handlePullToRefresh()).rejects.toThrow('offline');
    });

    // setMoods should NOT be called since sync failed
    expect(mockSetMoods).not.toHaveBeenCalled();
  });

  it('handleResetData resets onboarding state', () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    act(() => {
      result.current.handleResetData();
    });

    expect(mockSetOnboardingComplete).toHaveBeenCalledWith(false);
    expect(mockSetHasSelectedLanguage).toHaveBeenCalledWith(false);
  });
});
