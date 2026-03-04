import { useState, useEffect, useRef, useCallback } from 'react';

interface UseHyperfocusTimerOptions {
  duration: number; // minutes
  onComplete: () => void;
}

export function useHyperfocusTimer({ duration, onComplete }: UseHyperfocusTimerOptions) {
  const totalSeconds = duration * 60;
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showBreathingAnimation, setShowBreathingAnimation] = useState(false);
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);
  const autoBreakTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoBreakFiredRef = useRef<Set<number>>(new Set());

  // Wall-clock-anchored countdown — resilient to background throttling
  useEffect(() => {
    if (!isRunning || isPaused) return;

    startTimeRef.current = Date.now() - pausedElapsedRef.current * 1000;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(totalSeconds - elapsed, 0);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onComplete();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, totalSeconds, onComplete]);

  // Track paused elapsed time
  useEffect(() => {
    if (isPaused && isRunning) {
      pausedElapsedRef.current = totalSeconds - timeLeft;
    }
  }, [isPaused, isRunning, totalSeconds, timeLeft]);

  // Auto-break reminder every 25 minutes (fires once per milestone)
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const elapsed = totalSeconds - timeLeft;
    const milestone = Math.floor(elapsed / (25 * 60));
    if (milestone > 0 && !autoBreakFiredRef.current.has(milestone)) {
      autoBreakFiredRef.current.add(milestone);
      setShowBreathingAnimation(true);
      setIsPaused(true);

      autoBreakTimeoutRef.current = setTimeout(() => {
        setShowBreathingAnimation(false);
        setIsPaused(false);
      }, 30000);
    }
  }, [timeLeft, totalSeconds, isRunning, isPaused]);

  // Cleanup auto-break timeout on unmount
  useEffect(() => () => {
    if (autoBreakTimeoutRef.current) {
      clearTimeout(autoBreakTimeoutRef.current);
    }
  }, []);

  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

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
