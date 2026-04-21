import { useState, useEffect, useCallback, useRef } from 'react';
import type { BreathingPattern, BreathingPhase } from '@/lib/breathingPatterns';

interface UseBreathingEngineOptions {
  selectedPattern: BreathingPattern;
  onComplete?: (pattern: BreathingPattern) => void;
}

export function useBreathingEngine({ selectedPattern, onComplete }: UseBreathingEngineOptions) {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<BreathingPhase | 'complete'>('inhale');
  const [phaseTime, setPhaseTime] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [circleScale, setCircleScale] = useState(0.6);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const getPhaseDuration = useCallback((phase: BreathingPhase | 'complete'): number => {
    if (phase === 'complete') return 0;
    switch (phase) {
      case 'inhale': return selectedPattern.inhale;
      case 'holdIn': return selectedPattern.holdAfterInhale;
      case 'exhale': return selectedPattern.exhale;
      case 'holdOut': return selectedPattern.holdAfterExhale;
      default: return 0;
    }
  }, [selectedPattern]);

  const getNextPhase = useCallback((phase: BreathingPhase): BreathingPhase => {
    switch (phase) {
      case 'inhale':
        return selectedPattern.holdAfterInhale > 0 ? 'holdIn' : 'exhale';
      case 'holdIn':
        return 'exhale';
      case 'exhale':
        return selectedPattern.holdAfterExhale > 0 ? 'holdOut' : 'inhale';
      case 'holdOut':
        return 'inhale';
      default:
        return 'inhale';
    }
  }, [selectedPattern]);

  // Update circle scale based on phase
  useEffect(() => {
    if (!isActive || isPaused || currentPhase === 'complete') return;

    const duration = getPhaseDuration(currentPhase);
    if (duration === 0) return;

    const progress = phaseTime / duration;

    switch (currentPhase) {
      case 'inhale':
        setCircleScale(0.6 + (0.4 * progress));
        break;
      case 'holdIn':
        setCircleScale(1.0);
        break;
      case 'exhale':
        setCircleScale(1.0 - (0.4 * progress));
        break;
      case 'holdOut':
        setCircleScale(0.6);
        break;
    }
  }, [isActive, isPaused, currentPhase, phaseTime, getPhaseDuration]);

  // Main timer logic
  useEffect(() => {
    if (!isActive || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (!mountedRef.current) return;

      setPhaseTime(prev => {
        if (currentPhase === 'complete') return 0;
        const phaseDuration = getPhaseDuration(currentPhase);

        if (prev >= phaseDuration) {
          const nextPhase = getNextPhase(currentPhase);

          if (nextPhase === 'inhale' && currentPhase !== 'inhale') {
            if (currentCycle >= selectedPattern.cycles) {
              if (mountedRef.current) {
                setIsActive(false);
                setCurrentPhase('complete');
                onComplete?.(selectedPattern);
              }
              return 0;
            }
            if (mountedRef.current) {
              setCurrentCycle(c => c + 1);
            }
          }

          if (mountedRef.current) {
            setCurrentPhase(nextPhase);
          }
          return 0;
        }

        return prev + 0.1;
      });
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, isPaused, currentPhase, currentCycle, selectedPattern, getPhaseDuration, getNextPhase, onComplete]);

  const start = () => {
    setIsActive(true);
    setIsPaused(false);
    setCurrentPhase('inhale');
    setPhaseTime(0);
    setCurrentCycle(1);
    setCircleScale(0.6);
  };

  const reset = () => {
    setIsActive(false);
    setIsPaused(false);
    setCurrentPhase('inhale');
    setPhaseTime(0);
    setCurrentCycle(1);
    setCircleScale(0.6);
  };

  const togglePause = () => setIsPaused(p => !p);

  return {
    isActive, isPaused, currentPhase, phaseTime,
    currentCycle, circleScale, getPhaseDuration,
    start, reset, togglePause,
  };
}
