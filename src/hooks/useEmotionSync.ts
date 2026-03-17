import { useEffect, useRef } from 'react';
import { useUserDataStore } from '@/stores';
import { useEmotionTheme } from '@/contexts/EmotionThemeContext';

/**
 * Syncs emotion theme (background gradient) with current mood entries.
 * Reads moods and isLoading from store directly.
 */
export function useEmotionSync(): void {
  const { setEmotionFromEntries } = useEmotionTheme();
  const moods = useUserDataStore(s => s.moods);
  const isLoading = useUserDataStore(s => s.isLoading);
  // Prevent re-fires when Zustand emits new array reference without data change
  const prevMoodsRef = useRef<string>('');

  useEffect(() => {
    if (isLoading) return;
    const serialized = JSON.stringify(moods);
    if (serialized === prevMoodsRef.current) return;
    prevMoodsRef.current = serialized;
    setEmotionFromEntries(moods);
  }, [moods, isLoading, setEmotionFromEntries]);
}
