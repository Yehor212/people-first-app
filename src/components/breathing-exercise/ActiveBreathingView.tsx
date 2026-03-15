import { Play, Pause, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { zenTap } from '@/lib/animationUtils';
import Lottie from 'lottie-react';
import { cn } from '@/lib/utils';
import { getPhaseInstruction, type BreathingPattern, type BreathingPhase } from '@/lib/breathingPatterns';
import { phaseColors, phaseGradients } from './types';
import meditationAnimation from '@/assets/animations/meditation-relax.json';

interface ActiveBreathingViewProps {
  isActive: boolean;
  isPaused: boolean;
  currentPhase: BreathingPhase | 'complete';
  phaseTime: number;
  currentCycle: number;
  circleScale: number;
  getPhaseDuration: (phase: BreathingPhase | 'complete') => number;
  selectedPattern: BreathingPattern;
  onTogglePause: () => void;
  onReset: () => void;
  t: Record<string, string>;
}

export function ActiveBreathingView({
  isActive, isPaused, currentPhase, phaseTime,
  currentCycle, circleScale, getPhaseDuration,
  selectedPattern, onTogglePause, onReset, t,
}: ActiveBreathingViewProps) {
  return (
    <div className="text-center relative">
      {/* Meditation animation background */}
      <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none overflow-hidden">
        <Lottie
          animationData={meditationAnimation}
          loop
          autoplay={!isPaused}
          className="w-full max-w-[280px] h-auto"
        />
      </div>

      {/* Multi-layer Breathing Circle */}
      <div className="relative w-44 h-44 sm:w-56 sm:h-56 mx-auto mb-8">
        {/* Layer 1: Outer orbit ring */}
        <motion.div
          className="absolute inset-0 rounded-full border border-dashed border-cyan-500/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />

        {/* Layer 2: Pulsing glow rings */}
        <motion.div
          className="absolute inset-2 rounded-full bg-transparent"
          style={{
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
              className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.3)_0%,transparent_50%)]"
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
                    className="absolute w-2 h-2 rounded-full left-1/2 top-1/2 -ml-1 -mt-1"
                    style={{
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
              className="text-xl sm:text-2xl font-bold text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.5)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentPhase !== 'complete' && getPhaseInstruction(currentPhase, t)}
            </motion.span>
          </AnimatePresence>
          <span
            className="text-lg text-white/80 font-medium [text-shadow:0_2px_8px_rgba(0,0,0,0.5)]"
          >
            {currentPhase !== 'complete' && `${Math.ceil(getPhaseDuration(currentPhase) - phaseTime)}s`}
          </span>
        </div>
      </div>

      {/* Progress & Controls */}
      <div className="flex flex-col items-center gap-3 mb-6 relative z-10">
        <span className="text-sm text-muted-foreground">
          {t.cycle || 'Cycle'} {currentCycle}/{selectedPattern.cycles}
        </span>

        {/* Cycle dots */}
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
                    ? "bg-gradient-to-br from-cyan-400 to-teal-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                    : "bg-secondary/80"
                )}
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

      {/* Control Buttons */}
      <div className="flex gap-3 relative z-10">
        <motion.button
          onClick={onTogglePause}
          className={cn(
            "flex-1 py-3.5 rounded-xl font-medium flex items-center justify-center gap-2",
            "bg-secondary backdrop-blur-sm border border-border",
            "hover:bg-secondary/80 transition-all",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={zenTap.card}
        >
          {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          {isPaused ? (t.resume || 'Resume') : (t.pause || 'Pause')}
        </motion.button>

        <motion.button
          onClick={onReset}
          aria-label={t.resetTimer || 'Reset'}
          className={cn(
            "py-3.5 px-4 rounded-xl",
            "bg-muted border border-border",
            "hover:bg-secondary transition-all"
          )}
          whileHover={{ scale: 1.05, rotate: -180 }}
          whileTap={zenTap.button}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <RotateCcw className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}
