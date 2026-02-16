import { useState, useRef, useEffect, useCallback } from 'react';
import type { CelebrationData } from './types';

interface UseMoodFeedbackReturn {
  showMoodChangedToast: boolean;
  changedMoodEmoji: string;
  triggerToast: (emoji: string) => void;
  showCelebration: boolean;
  celebrationData: CelebrationData | null;
  triggerCelebration: (data: CelebrationData) => void;
  dismissCelebration: () => void;
}

export function useMoodFeedback(): UseMoodFeedbackReturn {
  const [showMoodChangedToast, setShowMoodChangedToast] = useState(false);
  const [changedMoodEmoji, setChangedMoodEmoji] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null);

  const mountedRef = useRef(true);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const triggerToast = useCallback((emoji: string) => {
    setChangedMoodEmoji(emoji);
    setShowMoodChangedToast(true);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setShowMoodChangedToast(false);
      }
    }, 2500);
  }, []);

  const triggerCelebration = useCallback((data: CelebrationData) => {
    setCelebrationData(data);
    setShowCelebration(true);
  }, []);

  const dismissCelebration = useCallback(() => {
    setShowCelebration(false);
    setCelebrationData(null);
  }, []);

  return {
    showMoodChangedToast, changedMoodEmoji, triggerToast,
    showCelebration, celebrationData, triggerCelebration, dismissCelebration,
  };
}
