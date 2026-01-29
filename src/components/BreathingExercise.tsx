/**
 * BreathingExercise - Guided breathing with visual animation
 * Compact card that expands to full exercise mode
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Wind, X, Play, Pause, RotateCcw } from 'lucide-react';
import Lottie from 'lottie-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  BREATHING_PATTERNS,
  BreathingPattern,
  BreathingPhase,
  getPhaseInstruction,
  getTotalDuration,
  formatDuration,
} from '@/lib/breathingPatterns';

// Meditation animation for breathing exercise background
import meditationAnimation from '@/assets/animations/meditation-relax.json';

interface BreathingExerciseProps {
  onComplete?: (pattern: BreathingPattern) => void;
  compact?: boolean;
}

export function BreathingExercise({ onComplete, compact = true }: BreathingExerciseProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<BreathingPattern>(BREATHING_PATTERNS[0]);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<BreathingPhase>('inhale');
  const [phaseTime, setPhaseTime] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [circleScale, setCircleScale] = useState(0.6);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // P1 Fix: Track mounted state to prevent setState after unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Get current phase duration
  const getPhaseDuration = useCallback((phase: BreathingPhase): number => {
    switch (phase) {
      case 'inhale': return selectedPattern.inhale;
      case 'holdIn': return selectedPattern.holdAfterInhale;
      case 'exhale': return selectedPattern.exhale;
      case 'holdOut': return selectedPattern.holdAfterExhale;
      default: return 0;
    }
  }, [selectedPattern]);

  // Get next phase
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
    if (!isActive || isPaused) return;

    const duration = getPhaseDuration(currentPhase);
    if (duration === 0) return;

    const progress = phaseTime / duration;

    switch (currentPhase) {
      case 'inhale':
        setCircleScale(0.6 + (0.4 * progress)); // 0.6 -> 1.0
        break;
      case 'holdIn':
        setCircleScale(1.0);
        break;
      case 'exhale':
        setCircleScale(1.0 - (0.4 * progress)); // 1.0 -> 0.6
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
      // P1 Fix: Check mounted before setState
      if (!mountedRef.current) return;

      setPhaseTime(prev => {
        const phaseDuration = getPhaseDuration(currentPhase);

        if (prev >= phaseDuration) {
          // Move to next phase
          const nextPhase = getNextPhase(currentPhase);

          // Check if we completed a cycle (back to inhale)
          if (nextPhase === 'inhale' && currentPhase !== 'inhale') {
            if (currentCycle >= selectedPattern.cycles) {
              // Exercise complete
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

  const startExercise = () => {
    setIsActive(true);
    setIsPaused(false);
    setCurrentPhase('inhale');
    setPhaseTime(0);
    setCurrentCycle(1);
    setCircleScale(0.6);
  };

  const resetExercise = () => {
    setIsActive(false);
    setIsPaused(false);
    setCurrentPhase('inhale');
    setPhaseTime(0);
    setCurrentCycle(1);
    setCircleScale(0.6);
  };

  const closeModal = () => {
    resetExercise();
    setIsOpen(false);
  };

  // Compact card view
  if (compact && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full bg-card rounded-2xl p-4 zen-shadow-card animate-fade-in text-left hover:bg-card/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Wind className="w-6 h-6 text-cyan-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">
              {t.breathingTitle || 'Breathing'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t.breathingSubtitle || 'Calm your mind'}
            </p>
          </div>
          <div className="text-2xl">🧘</div>
        </div>
      </button>
    );
  }

  // Full exercise modal
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="breathing-title" className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-card rounded-3xl p-4 sm:p-6 w-full max-w-sm animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 id="breathing-title" className="text-xl font-bold text-foreground">
            {t.breathingTitle || 'Breathing'}
          </h2>
          <button
            onClick={closeModal}
            aria-label={t.close || 'Close'}
            className="p-2 hover:bg-muted rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isActive && currentPhase !== 'complete' ? (
          <>
            {/* Pattern selection */}
            <div className="space-y-2 mb-6">
              {BREATHING_PATTERNS.map((pattern) => (
                <button
                  key={pattern.id}
                  onClick={() => setSelectedPattern(pattern)}
                  className={cn(
                    "w-full p-3 rounded-xl flex items-center gap-3 transition-all text-left",
                    selectedPattern.id === pattern.id
                      ? "bg-primary/20 ring-2 ring-primary"
                      : "bg-secondary/50 hover:bg-secondary"
                  )}
                >
                  <span className="text-2xl">{pattern.emoji}</span>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {(t[pattern.nameKey as keyof typeof t] as string) || pattern.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(getTotalDuration(pattern))} • {pattern.cycles} {t.cycles || 'cycles'}
                    </p>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-full text-xs",
                    pattern.effect === 'calming' && "bg-blue-500/20 text-blue-400",
                    pattern.effect === 'focusing' && "bg-purple-500/20 text-purple-400",
                    pattern.effect === 'energizing' && "bg-orange-500/20 text-orange-400",
                    pattern.effect === 'sleeping' && "bg-indigo-500/20 text-indigo-400",
                  )}>
                    {pattern.effect === 'calming' && (t.effectCalming || 'Calming')}
                    {pattern.effect === 'focusing' && (t.effectFocusing || 'Focus')}
                    {pattern.effect === 'energizing' && (t.effectEnergizing || 'Energy')}
                    {pattern.effect === 'sleeping' && (t.effectSleeping || 'Sleep')}
                  </div>
                </button>
              ))}
            </div>

            {/* Start button */}
            <button
              onClick={startExercise}
              className="w-full py-4 zen-gradient text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              {t.startBreathing || 'Start'}
            </button>
          </>
        ) : currentPhase === 'complete' ? (
          /* Complete state */
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✨</div>
            <h3 className="text-xl font-bold mb-2">{t.breathingComplete || 'Well done!'}</h3>
            <p className="text-muted-foreground mb-6">
              {t.breathingCompleteMsg || 'You completed the breathing exercise'}
            </p>
            <button
              onClick={resetExercise}
              className="w-full py-3 bg-primary/20 text-primary rounded-xl font-medium"
            >
              {t.breathingAgain || 'Do again'}
            </button>
          </div>
        ) : (
          /* Active breathing state */
          <div className="text-center">
            {/* Meditation animation background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none overflow-hidden">
              <Lottie
                animationData={meditationAnimation}
                loop
                autoplay={!isPaused}
                style={{ width: '100%', maxWidth: '280px', height: 'auto' }}
              />
            </div>

            {/* Breathing circle */}
            <div className="relative w-36 h-36 sm:w-48 sm:h-48 mx-auto mb-6 z-10">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />

              {/* Animated circle */}
              <div
                className="absolute inset-0 flex items-center justify-center transition-transform"
                style={{
                  transform: `scale(${circleScale})`,
                  transitionDuration: currentPhase === 'holdIn' || currentPhase === 'holdOut' ? '0.1s' : `${getPhaseDuration(currentPhase)}s`,
                  transitionTimingFunction: 'ease-in-out',
                }}
              >
                <div className={cn(
                  "w-full h-full rounded-full",
                  currentPhase === 'inhale' && "bg-gradient-to-br from-cyan-400 to-blue-500",
                  currentPhase === 'holdIn' && "bg-gradient-to-br from-purple-400 to-indigo-500",
                  currentPhase === 'exhale' && "bg-gradient-to-br from-teal-400 to-green-500",
                  currentPhase === 'holdOut' && "bg-gradient-to-br from-slate-400 to-slate-500",
                )} />
              </div>

              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-white drop-shadow-lg">
                  {getPhaseInstruction(currentPhase, t as Record<string, string>)}
                </span>
                <span className="text-sm text-white/80 drop-shadow">
                  {Math.ceil(getPhaseDuration(currentPhase) - phaseTime)}s
                </span>
              </div>
            </div>

            {/* Progress */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-sm text-muted-foreground">
                {t.cycle || 'Cycle'} {currentCycle}/{selectedPattern.cycles}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: selectedPattern.cycles }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full",
                      i < currentCycle ? "bg-primary" : "bg-primary/20"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="flex-1 py-3 bg-secondary rounded-xl font-medium flex items-center justify-center gap-2"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isPaused ? (t.resume || 'Resume') : (t.pause || 'Pause')}
              </button>
              <button
                onClick={resetExercise}
                aria-label={t.resetTimer || 'Reset'}
                className="py-3 px-4 bg-secondary rounded-xl"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
