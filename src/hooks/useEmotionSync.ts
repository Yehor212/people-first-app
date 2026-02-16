import { useEffect } from 'react';
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

  useEffect(() => {
    if (!isLoading) {
      setEmotionFromEntries(moods);
    }
  }, [moods, isLoading, setEmotionFromEntries]);
}
