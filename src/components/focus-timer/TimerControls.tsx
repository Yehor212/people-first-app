/**
 * TimerControls - Play/pause, reset, and hyperfocus mode buttons
 */

import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Focus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { zenTap } from '@/lib/animationUtils';
import { useShouldAnimate } from '@/hooks/useShouldAnimate';

interface TimerControlsProps {
  isPrimaryCTA: boolean;
  isRunning: boolean;
  isBreak: boolean;
  onToggle: () => void;
  onReset: () => void;
  onShowHyperfocus: () => void;
  labels: {
    pause: string;
    start: string;
    resetTimer: string;
    hyperfocusMode: string;
  };
}

export function TimerControls({
  isPrimaryCTA,
  isRunning,
  isBreak,
  onToggle,
  onReset,
  onShowHyperfocus,
  labels,
}: TimerControlsProps) {
  const motionAllowed = useShouldAnimate({ respectRuntimePerformance: false });

  return (
    <>
      <div className="flex justify-center gap-4 mb-4">
        {isPrimaryCTA ? (
          <>
            {/* Premium Play/Pause Button */}
            <motion.button
              onClick={onToggle}
              aria-label={isRunning ? labels.pause : labels.start}
              className={cn(
                "relative w-16 h-16 rounded-full flex items-center justify-center",
                "motion-safe:transition-all",
                isBreak
                  ? "bg-gradient-to-br from-pink-500 to-rose-600 shadow-[0_0_24px_hsl(var(--focus-pink)/0.5)]"
                  : "bg-gradient-to-br from-violet-500 to-purple-600 shadow-[0_0_24px_hsl(var(--focus-violet)/0.5)]"
              )}
              whileHover={motionAllowed ? { scale: 1.1 } : undefined}
              whileTap={motionAllowed ? zenTap.button : undefined}
            >
              {/* Pulse ring when paused */}
              {motionAllowed && !isRunning && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-white/30 dark:border-white/30"
                  animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              {isRunning ? (
                <Pause className="w-7 h-7 text-white" aria-hidden="true" />
              ) : (
                <Play className="w-7 h-7 text-white ms-1" aria-hidden="true" />
              )}
            </motion.button>

            {/* Premium Reset Button */}
            <motion.button
              onClick={onReset}
              aria-label={labels.resetTimer}
              className="w-14 h-14 rounded-full flex items-center justify-center bg-secondary backdrop-blur-sm border border-border text-slate-600 dark:text-white/70 hover:text-slate-800 dark:hover:text-white hover:bg-secondary/80 motion-safe:transition-colors"
              whileHover={motionAllowed ? { scale: 1.1, rotate: -90 } : undefined}
              whileTap={motionAllowed ? zenTap.button : undefined}
            >
              <RotateCcw className="w-5 h-5" aria-hidden="true" />
            </motion.button>
          </>
        ) : (
          <>
            <Button
              variant="gradient"
              size="icon-lg"
              onClick={onToggle}
              aria-label={isRunning ? labels.pause : labels.start}
              className={cn(
                isBreak && "zen-gradient-growth"
              )}
            >
              {isRunning ? <Pause className="w-6 h-6" aria-hidden="true" /> : <Play className="w-6 h-6" aria-hidden="true" />}
            </Button>
            <Button
              variant="secondary"
              size="icon-lg"
              onClick={onReset}
              aria-label={labels.resetTimer}
            >
              <RotateCcw className="w-6 h-6" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>

      {/* Hyperfocus Mode Button */}
      {isPrimaryCTA ? (
        <motion.button
          onClick={onShowHyperfocus}
          disabled={isRunning}
          className={cn(
            "w-full py-3.5 rounded-xl flex items-center justify-center gap-2",
            "font-semibold motion-safe:transition-all relative z-10",
            isRunning
              ? "bg-secondary text-slate-400 dark:text-white/40 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500/80 to-violet-500/80 text-white hover:from-cyan-500 hover:to-violet-500"
          )}
          style={!isRunning ? {
            boxShadow: '0 0 20px hsl(var(--focus-violet) / 0.3)'
          } : {}}
          whileHover={motionAllowed && !isRunning ? { scale: 1.02 } : undefined}
          whileTap={motionAllowed && !isRunning ? zenTap.card : undefined}
        >
          <Focus className="w-5 h-5" aria-hidden="true" />
          {labels.hyperfocusMode}
        </motion.button>
      ) : (
        <Button
          variant={isRunning ? "secondary" : "gradient"}
          size="lg"
          onClick={onShowHyperfocus}
          disabled={isRunning}
          className={cn(
            "w-full relative z-10",
            !isRunning && "zen-gradient-calm"
          )}
        >
          <Focus className="w-5 h-5" aria-hidden="true" />
          {labels.hyperfocusMode}
        </Button>
      )}
    </>
  );
}
