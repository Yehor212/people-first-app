/**
 * TimerRing - SVG circular timer with progress ring and time display
 */

import { motion } from 'framer-motion';
import { formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface TimerRingProps {
  timeLeft: number;
  progress: number;
  isRunning: boolean;
  isBreak: boolean;
  isPrimaryCTA: boolean;
  concentrateLabel: string;
  takeRestLabel: string;
}

export function TimerRing({
  timeLeft,
  progress,
  isRunning,
  isBreak,
  isPrimaryCTA,
  concentrateLabel,
  takeRestLabel,
}: TimerRingProps) {
  return (
    <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto mb-6">
      {/* Premium multi-layer timer */}
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Layer 1: Orbit path (dashed) */}
        {isPrimaryCTA && (
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="hsl(0 0% 100% / 0.1)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* Layer 2: Background track */}
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={isPrimaryCTA ? "hsl(0 0% 100% / 0.1)" : "hsl(var(--secondary))"}
          strokeWidth="6"
        />

        {/* Layer 3: Progress ring with glow */}
        <motion.circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={isPrimaryCTA
            ? isBreak ? "url(#breakGradient)" : "url(#focusGradient)"
            : isBreak ? "hsl(var(--accent))" : "hsl(var(--primary))"
          }
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 42}`}
          strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
          style={isPrimaryCTA ? {
            filter: `drop-shadow(0 0 8px ${isBreak ? 'hsl(var(--focus-pink) / 0.6)' : 'hsl(var(--focus-violet) / 0.6)'})`
          } : {}}
          initial={false}
          animate={{ strokeDashoffset: `${2 * Math.PI * 42 * (1 - progress / 100)}` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />

        {/* Gradient definitions */}
        <defs>
          <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--focus-violet))" />
            <stop offset="50%" stopColor="hsl(var(--focus-purple))" />
            <stop offset="100%" stopColor="hsl(var(--focus-pink))" />
          </linearGradient>
          <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--focus-pink))" />
            <stop offset="50%" stopColor="hsl(var(--focus-pink-mid))" />
            <stop offset="100%" stopColor="hsl(var(--focus-rose))" />
          </linearGradient>
        </defs>
      </svg>

      {/* Inner breathing glow */}
      {isPrimaryCTA && isRunning && (
        <motion.div
          className="absolute inset-6 rounded-full pointer-events-none"
          style={{
            background: isBreak
              ? 'radial-gradient(circle, hsl(var(--focus-pink) / 0.15) 0%, transparent 70%)'
              : 'radial-gradient(circle, hsl(var(--focus-violet) / 0.15) 0%, transparent 70%)'
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      <div
        role="timer"
        aria-label={isBreak ? takeRestLabel : concentrateLabel}
        className="absolute inset-0 flex flex-col items-center justify-center"
      >
        <motion.span
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            "text-5xl font-bold tracking-tight",
            isPrimaryCTA
              ? "text-violet-700 dark:text-white"
              : isBreak ? "text-accent" : "text-primary"
          )}
          style={isPrimaryCTA ? {
            textShadow: isBreak
              ? '0 0 20px hsl(var(--focus-pink) / 0.5)'
              : '0 0 20px hsl(var(--focus-violet) / 0.5)'
          } : {}}
          key={timeLeft}
          initial={{ scale: 0.95, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {formatTime(timeLeft)}
        </motion.span>
        <span className={cn(
          "text-sm mt-2",
          isPrimaryCTA ? "text-slate-600 dark:text-white/60" : "text-muted-foreground"
        )} aria-hidden="true">
          {isBreak ? takeRestLabel : concentrateLabel}
        </span>
      </div>
    </div>
  );
}
