import { useState, useEffect, useRef } from 'react';

interface UseHyperfocusTimerOptions {
  duration: number; // minutes
  onComplete: () => void;
}

export function useHyperfocusTimer({ duration, onComplete }: UseHyperfocusTimerOptions) {
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showBreathingAnimation, setShowBreathingAnimation] = useState(false);
  const autoBreakTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, onComplete]);

  // Auto-break reminder every 25 minutes
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const elapsed = (duration * 60) - timeLeft;
    if (elapsed > 0 && elapsed % (25 * 60) === 0) {
      setShowBreathingAnimation(true);
      setIsPaused(true);

      autoBreakTimeoutRef.current = setTimeout(() => {
        setShowBreathingAnimation(false);
        setIsPaused(false);
      }, 30000);
    }

    return () => {
      if (autoBreakTimeoutRef.current) {
        clearTimeout(autoBreakTimeoutRef.current);
      }
    };
  }, [timeLeft, duration, isRunning, isPaused]);

  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    timeLeft,
    isRunning,
    isPaused,
    showBreathingAnimation,
    progress,
    formattedTime: formatTime(timeLeft),
    setIsRunning,
    setIsPaused,
  };
}
