/**
 * BreathingExercise - Premium Guided breathing with cosmic animations
 * Phase 3 Premium Redesign - "Cosmic Breath" Theme
 * Multi-layer breathing circle with particle effects
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Wind, X, Play, Pause, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

// Phase colors for dynamic theming
const phaseColors: Record<BreathingPhase | 'complete', string> = {
  inhale: '#06b6d4',   // Cyan
  holdIn: '#8b5cf6',   // Violet
  exhale: '#14b8a6',   // Teal
  holdOut: '#64748b',  // Slate
  complete: '#10b981', // Emerald
};

// Phase gradients for breathing circle
const phaseGradients: Record<BreathingPhase | 'complete', string> = {
  inhale: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)',
  holdIn: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)',
  exhale: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)',
  holdOut: 'linear-gradient(135deg, #64748b 0%, #475569 50%, #334155 100%)',
  complete: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
};

// Generate star positions for background
const generateStars = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
  }));

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
  const [currentPhase, setCurrentPhase] = useState<BreathingPhase | 'complete'>('inhale');
  const [phaseTime, setPhaseTime] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [circleScale, setCircleScale] = useState(0.6);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Generate stars once
  const stars = useMemo(() => generateStars(20), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Get current phase duration
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
          const nextPhase = getNextPhase(currentPhase as BreathingPhase);

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

  // ============================================
  // PHASE 1: Premium Compact Card
  // ============================================
  if (compact && !isOpen) {
    return (
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full rounded-2xl p-4 text-left transition-all relative overflow-hidden",
          "bg-gradient-to-br from-cyan-500/10 via-teal-500/5 to-transparent",
          "border border-cyan-500/20",
          "hover:border-cyan-500/40"
        )}
        style={{
          boxShadow: '0 0 20px rgba(6, 182, 212, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)',
        }}
        whileHover={{ scale: 1.01, y: -2 }}
        whileTap={{ scale: 0.99 }}
      >
        {/* Animated background glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 30% 50%, rgba(6, 182, 212, 0.15) 0%, transparent 50%)',
          }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="flex items-center gap-3 relative z-10">
          {/* Premium icon with breathing animation */}
          <motion.div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(20, 184, 166, 0.2) 100%)',
              boxShadow: '0 0 16px rgba(6, 182, 212, 0.4)',
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Wind className="w-6 h-6 text-cyan-400" />
          </motion.div>

          <div className="flex-1">
            <h3 className="font-semibold text-foreground">
              {t.breathingTitle || 'Breathing'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t.breathingSubtitle || 'Calm your mind'}
            </p>
          </div>

          {/* Animated meditation emoji */}
          <motion.div
            className="text-2xl"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            🧘
          </motion.div>
        </div>
      </motion.button>
    );
  }

  // ============================================
  // PHASE 2-7: Full Premium Modal
  // ============================================
  return (
    <AnimatePresence>
      {(isOpen || !compact) && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="breathing-title"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Premium overlay with cosmic effect */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center,
                rgba(6, 182, 212, 0.1) 0%,
                rgba(0, 0, 0, 0.8) 50%,
                rgba(0, 0, 0, 0.9) 100%)`,
              backdropFilter: 'blur(8px)',
            }}
            onClick={closeModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Star particles background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {stars.map((star) => (
              <motion.div
                key={star.id}
                className="absolute w-1 h-1 bg-cyan-400/60 rounded-full"
                style={{
                  left: `${star.left}%`,
                  top: `${star.top}%`,
                }}
                animate={{
                  opacity: [0.3, 0.8, 0.3],
                  scale: [0.8, 1.2, 0.8],
                }}
                transition={{
                  duration: star.duration,
                  repeat: Infinity,
                  delay: star.delay,
                }}
              />
            ))}
          </div>

          {/* Modal content */}
          <motion.div
            className={cn(
              "relative w-full max-w-sm rounded-3xl overflow-hidden",
              "bg-background/95 backdrop-blur-xl",
              "border border-white/10"
            )}
            style={{
              boxShadow: '0 0 40px rgba(6, 182, 212, 0.2), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Top gradient border */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

            {/* Cosmic glow at top */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse, rgba(6, 182, 212, 0.15) 0%, transparent 70%)',
              }}
            />

            {/* Content */}
            <div className="relative z-10 p-4 sm:p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 id="breathing-title" className="text-xl font-bold text-foreground">
                  {t.breathingTitle || 'Breathing'}
                </h2>
                <motion.button
                  onClick={closeModal}
                  aria-label={t.close || 'Close'}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    "bg-white/5 border border-white/10",
                    "hover:bg-white/10"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {!isActive && currentPhase !== 'complete' ? (
                <>
                  {/* ============================================
                      PHASE 3: Pattern Selection Premium
                      ============================================ */}
                  <div className="space-y-2 mb-6">
                    {BREATHING_PATTERNS.map((pattern) => (
                      <motion.button
                        key={pattern.id}
                        onClick={() => setSelectedPattern(pattern)}
                        className={cn(
                          "w-full p-4 rounded-xl flex items-center gap-3 text-left relative overflow-hidden",
                          "transition-all duration-300",
                          selectedPattern.id === pattern.id
                            ? "bg-white/10 border border-cyan-500/40"
                            : "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
                        )}
                        style={selectedPattern.id === pattern.id ? {
                          boxShadow: '0 0 20px rgba(6, 182, 212, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                        } : {
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                        }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        {/* Selection glow effect */}
                        {selectedPattern.id === pattern.id && (
                          <motion.div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: 'radial-gradient(circle at 20% 50%, rgba(6, 182, 212, 0.15) 0%, transparent 50%)',
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          />
                        )}

                        {/* Emoji with glow */}
                        <motion.span
                          className="text-2xl relative z-10"
                          animate={selectedPattern.id === pattern.id ? {
                            scale: [1, 1.1, 1],
                          } : {}}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          {pattern.emoji}
                        </motion.span>

                        <div className="flex-1 relative z-10">
                          <p className="font-medium text-foreground">
                            {(t[pattern.nameKey as keyof typeof t] as string) || pattern.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDuration(getTotalDuration(pattern))} • {pattern.cycles} {t.cycles || 'cycles'}
                          </p>
                        </div>

                        {/* Effect badge - Premium */}
                        <div
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium relative z-10",
                            "backdrop-blur-sm border",
                            pattern.effect === 'calming' && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                            pattern.effect === 'focusing' && "bg-violet-500/20 text-violet-400 border-violet-500/30",
                            pattern.effect === 'energizing' && "bg-orange-500/20 text-orange-400 border-orange-500/30",
                            pattern.effect === 'sleeping' && "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
                          )}
                          style={{
                            boxShadow: pattern.effect === 'calming' ? '0 0 8px rgba(59, 130, 246, 0.3)' :
                                       pattern.effect === 'focusing' ? '0 0 8px rgba(139, 92, 246, 0.3)' :
                                       pattern.effect === 'energizing' ? '0 0 8px rgba(249, 115, 22, 0.3)' :
                                       '0 0 8px rgba(99, 102, 241, 0.3)',
                          }}
                        >
                          {pattern.effect === 'calming' && (t.effectCalming || 'Calming')}
                          {pattern.effect === 'focusing' && (t.effectFocusing || 'Focus')}
                          {pattern.effect === 'energizing' && (t.effectEnergizing || 'Energy')}
                          {pattern.effect === 'sleeping' && (t.effectSleeping || 'Sleep')}
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  {/* ============================================
                      PHASE 7: Start Button Premium
                      ============================================ */}
                  <motion.button
                    onClick={startExercise}
                    className={cn(
                      "w-full py-4 rounded-xl font-semibold text-white relative overflow-hidden",
                      "bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-500",
                      "bg-[length:200%_100%]"
                    )}
                    style={{
                      boxShadow: '0 0 25px rgba(6, 182, 212, 0.5), 0 4px 15px rgba(0, 0, 0, 0.2)',
                    }}
                    animate={{
                      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Inner glow */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.2) 0%, transparent 50%)',
                      }}
                    />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <Play className="w-5 h-5" />
                      {t.startBreathing || 'Start'}
                    </span>
                  </motion.button>
                </>
              ) : currentPhase === 'complete' ? (
                /* ============================================
                   PHASE 6: Completion Celebration Premium
                   ============================================ */
                <motion.div
                  className="text-center py-8 relative"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  {/* Celebration particles */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 rounded-full"
                        style={{
                          left: '50%',
                          top: '50%',
                          background: ['#06b6d4', '#8b5cf6', '#14b8a6', '#f59e0b'][i % 4],
                          boxShadow: `0 0 6px ${['#06b6d4', '#8b5cf6', '#14b8a6', '#f59e0b'][i % 4]}`,
                        }}
                        initial={{ x: 0, y: 0, scale: 0 }}
                        animate={{
                          x: Math.cos((i / 20) * Math.PI * 2) * (60 + Math.random() * 40),
                          y: Math.sin((i / 20) * Math.PI * 2) * (60 + Math.random() * 40),
                          scale: [0, 1, 0],
                          opacity: [0, 1, 0],
                        }}
                        transition={{
                          duration: 1.5,
                          delay: i * 0.05,
                          ease: 'easeOut',
                        }}
                      />
                    ))}
                  </div>

                  {/* Success icon with glow */}
                  <motion.div
                    className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(6, 182, 212, 0.2) 100%)',
                      boxShadow: '0 0 40px rgba(16, 185, 129, 0.4)',
                    }}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <motion.span
                      className="text-5xl"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      ✨
                    </motion.span>
                  </motion.div>

                  <motion.h3
                    className="text-2xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    {t.breathingComplete || 'Well done!'}
                  </motion.h3>

                  <motion.p
                    className="text-muted-foreground mb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    {t.breathingCompleteMsg || 'You completed the breathing exercise'}
                  </motion.p>

                  {/* Do again button - Premium */}
                  <motion.button
                    onClick={resetExercise}
                    className={cn(
                      "w-full py-4 rounded-xl font-semibold",
                      "bg-gradient-to-r from-cyan-500 to-teal-500 text-white",
                      "hover:from-cyan-400 hover:to-teal-400 transition-all"
                    )}
                    style={{
                      boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                  >
                    {t.breathingAgain || 'Do again'}
                  </motion.button>
                </motion.div>
              ) : (
                /* ============================================
                   PHASE 4 & 5: Active Breathing State
                   ============================================ */
                <div className="text-center relative">
                  {/* Meditation animation background */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none overflow-hidden">
                    <Lottie
                      animationData={meditationAnimation}
                      loop
                      autoplay={!isPaused}
                      style={{ width: '100%', maxWidth: '280px', height: 'auto' }}
                    />
                  </div>

                  {/* ============================================
                      PHASE 4: Multi-layer Breathing Circle
                      ============================================ */}
                  <div className="relative w-44 h-44 sm:w-56 sm:h-56 mx-auto mb-8">
                    {/* Layer 1: Outer orbit ring */}
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{
                        border: '1px dashed rgba(6, 182, 212, 0.3)',
                      }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                    />

                    {/* Layer 2: Pulsing glow rings */}
                    <motion.div
                      className="absolute inset-2 rounded-full"
                      style={{
                        background: 'transparent',
                        boxShadow: `0 0 30px ${phaseColors[currentPhase]}40, 0 0 60px ${phaseColors[currentPhase]}20`,
                      }}
                      animate={{
                        scale: [1, 1.05, 1],
                        opacity: [0.5, 0.8, 0.5],
                      }}
                      transition={{
                        duration: Math.max(getPhaseDuration(currentPhase), 1),
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />

                    {/* Layer 3: Inner glow base */}
                    <div
                      className="absolute inset-4 rounded-full transition-all duration-500"
                      style={{
                        background: `radial-gradient(circle, ${phaseColors[currentPhase]}15 0%, transparent 70%)`,
                      }}
                    />

                    {/* Layer 4: Main breathing circle */}
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        transform: `scale(${circleScale})`,
                        transition: `transform ${currentPhase === 'holdIn' || currentPhase === 'holdOut' ? 0.1 : getPhaseDuration(currentPhase)}s ease-in-out`,
                      }}
                    >
                      <div
                        className="w-full h-full rounded-full relative overflow-hidden transition-all duration-300"
                        style={{
                          background: phaseGradients[currentPhase],
                          boxShadow: `0 0 40px ${phaseColors[currentPhase]}60, inset 0 0 30px rgba(255,255,255,0.1)`,
                        }}
                      >
                        {/* Inner shimmer effect */}
                        <motion.div
                          className="absolute inset-0"
                          style={{
                            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 50%)',
                          }}
                          animate={{
                            opacity: [0.3, 0.6, 0.3],
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </div>
                    </div>

                    {/* Layer 5: Particle effects on inhale/exhale */}
                    <AnimatePresence>
                      {(currentPhase === 'inhale' || currentPhase === 'exhale') && !isPaused && (
                        <>
                          {[...Array(8)].map((_, i) => {
                            const angle = (i / 8) * 360;
                            const isInhale = currentPhase === 'inhale';
                            return (
                              <motion.div
                                key={`particle-${currentPhase}-${i}-${currentCycle}`}
                                className="absolute w-2 h-2 rounded-full"
                                style={{
                                  left: '50%',
                                  top: '50%',
                                  marginLeft: '-4px',
                                  marginTop: '-4px',
                                  background: phaseColors[currentPhase],
                                  boxShadow: `0 0 8px ${phaseColors[currentPhase]}`,
                                }}
                                initial={{
                                  x: isInhale ? Math.cos(angle * Math.PI / 180) * 80 : 0,
                                  y: isInhale ? Math.sin(angle * Math.PI / 180) * 80 : 0,
                                  opacity: 0,
                                  scale: 0,
                                }}
                                animate={{
                                  x: isInhale ? 0 : Math.cos(angle * Math.PI / 180) * 80,
                                  y: isInhale ? 0 : Math.sin(angle * Math.PI / 180) * 80,
                                  opacity: [0, 1, 0],
                                  scale: [0.5, 1, 0.5],
                                }}
                                transition={{
                                  duration: getPhaseDuration(currentPhase),
                                  delay: i * 0.1,
                                  ease: 'easeInOut',
                                }}
                              />
                            );
                          })}
                        </>
                      )}
                    </AnimatePresence>

                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={currentPhase}
                          className="text-xl sm:text-2xl font-bold text-white"
                          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          {currentPhase !== 'complete' && getPhaseInstruction(currentPhase, t as Record<string, string>)}
                        </motion.span>
                      </AnimatePresence>
                      <span
                        className="text-lg text-white/80 font-medium"
                        style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
                      >
                        {currentPhase !== 'complete' && `${Math.ceil(getPhaseDuration(currentPhase) - phaseTime)}s`}
                      </span>
                    </div>
                  </div>

                  {/* ============================================
                      PHASE 5: Progress & Controls Premium
                      ============================================ */}
                  <div className="flex flex-col items-center gap-3 mb-6 relative z-10">
                    <span className="text-sm text-muted-foreground">
                      {t.cycle || 'Cycle'} {currentCycle}/{selectedPattern.cycles}
                    </span>

                    {/* Premium cycle dots */}
                    <div className="flex gap-2">
                      {Array.from({ length: selectedPattern.cycles }).map((_, i) => (
                        <motion.div
                          key={i}
                          className="relative"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <div
                            className={cn(
                              "w-3 h-3 rounded-full transition-all duration-300",
                              i < currentCycle
                                ? "bg-gradient-to-br from-cyan-400 to-teal-500"
                                : "bg-white/20"
                            )}
                            style={i < currentCycle ? {
                              boxShadow: '0 0 8px rgba(6, 182, 212, 0.6)',
                            } : {}}
                          />
                          {i === currentCycle - 1 && isActive && !isPaused && (
                            <motion.div
                              className="absolute inset-0 rounded-full bg-cyan-400/50"
                              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            />
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Control Buttons Premium */}
                  <div className="flex gap-3 relative z-10">
                    {/* Play/Pause button */}
                    <motion.button
                      onClick={() => setIsPaused(!isPaused)}
                      className={cn(
                        "flex-1 py-3.5 rounded-xl font-medium flex items-center justify-center gap-2",
                        "bg-white/10 backdrop-blur-sm border border-white/20",
                        "hover:bg-white/15 transition-all"
                      )}
                      style={{
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                      {isPaused ? (t.resume || 'Resume') : (t.pause || 'Pause')}
                    </motion.button>

                    {/* Reset button */}
                    <motion.button
                      onClick={resetExercise}
                      aria-label={t.resetTimer || 'Reset'}
                      className={cn(
                        "py-3.5 px-4 rounded-xl",
                        "bg-white/5 border border-white/10",
                        "hover:bg-white/10 transition-all"
                      )}
                      whileHover={{ scale: 1.05, rotate: -180 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <RotateCcw className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
