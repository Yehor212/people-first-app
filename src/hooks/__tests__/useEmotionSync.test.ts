import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MoodEntry } from '@/types';

// Mock setEmotionFromEntries
const mockSetEmotionFromEntries = vi.fn();
vi.mock('@/contexts/EmotionThemeContext', () => ({
  useEmotionTheme: () => ({
    setEmotionFromEntries: mockSetEmotionFromEntries,
  }),
}));

// Mock userDataStore
let mockMoods: MoodEntry[] = [];
let mockIsLoading = false;

vi.mock('@/stores', () => ({
  useUserDataStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      moods: mockMoods,
      isLoading: mockIsLoading,
    }),
}));

import { useEmotionSync } from '../useEmotionSync';

describe('useEmotionSync', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockMoods = [];
    mockIsLoading = false;
  });

  it('calls setEmotionFromEntries with moods when not loading', () => {
    const moods: MoodEntry[] = [
      { id: '1', mood: 'great', date: '2026-02-17', timestamp: Date.now() },
    ];
    mockMoods = moods;
    mockIsLoading = false;

    renderHook(() => useEmotionSync());

    expect(mockSetEmotionFromEntries).toHaveBeenCalledWith(moods);
  });

  it('does not call setEmotionFromEntries while still loading', () => {
    mockIsLoading = true;

    renderHook(() => useEmotionSync());

    expect(mockSetEmotionFromEntries).not.toHaveBeenCalled();
  });

  it('calls setEmotionFromEntries with empty array when no moods', () => {
    mockMoods = [];
    mockIsLoading = false;

    renderHook(() => useEmotionSync());

    expect(mockSetEmotionFromEntries).toHaveBeenCalledWith([]);
  });
});
