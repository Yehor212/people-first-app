/**
 * TimerControls - Play/pause, reset, and hyperfocus mode buttons
 */

import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
                "transition-all",
                isBreak
                  ? "bg-gradient-to-br from-pink-500 to-rose-600"
                  : "bg-gradient-to-br from-violet-500 to-purple-600"
              )}
              style={{
                boxShadow: isBreak
                  ? '0 0 24px hsl(var(--focus-pink) / 0.5)'
                  : '0 0 24px hsl(var(--focus-violet) / 0.5)'
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Pulse ring when paused */}
              {!isRunning && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-white/30"
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
              className="w-14 h-14 rounded-full flex items-center justify-center bg-secondary backdrop-blur-sm border border-border text-slate-600 dark:text-white/70 hover:text-slate-800 dark:hover:text-white hover:bg-secondary/80 transition-colors"
              whileHover={{ scale: 1.1, rotate: -90 }}
              whileTap={{ scale: 0.95 }}
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
                isBreak && "zen-gradient-warm"
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
            "font-semibold transition-all relative z-10",
            isRunning
              ? "bg-secondary text-slate-400 dark:text-white/40 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500/80 to-violet-500/80 text-white hover:from-cyan-500 hover:to-violet-500"
          )}
          style={!isRunning ? {
            boxShadow: '0 0 20px hsl(var(--focus-violet) / 0.3)'
          } : {}}
          whileHover={!isRunning ? { scale: 1.02 } : {}}
          whileTap={!isRunning ? { scale: 0.98 } : {}}
        >
          <Zap className="w-5 h-5" />
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
          <Zap className="w-5 h-5" />
          {labels.hyperfocusMode}
        </Button>
      )}
    </>
  );
}
