/**
 * HyperfocusTimerDisplay — SVG circular progress ring + time display + status text
 * Pure component, 0 useState.
 */

import { motion } from 'framer-motion';
import { zenMotion } from '@/lib/animationUtils';
import type { ProgressColor } from './types';

interface HyperfocusTimerDisplayProps {
  formattedTime: string;
  timeLeft: number;
  progress: number;
  progressColor: ProgressColor;
  isRunning: boolean;
  isPaused: boolean;
  t: Record<string, string>;
}

export function HyperfocusTimerDisplay({
  formattedTime, timeLeft, progress, progressColor, isRunning, isPaused, t,
}: HyperfocusTimerDisplayProps) {
  return (
    <div className="mb-6 sm:mb-12 lg:mb-16">
      <div className="relative w-52 h-52 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-80 lg:h-80 xl:w-96 xl:h-96 mx-auto mb-6 sm:mb-8">
        {/* Multi-layer Circular Progress */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 280 280">
          {/* Layer 1: Outer orbit path (dashed) */}
          <circle
            cx="140"
            cy="140"
            r="135"
            fill="none"
            className="stroke-slate-300 dark:stroke-white/10"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Layer 2: Minute markers */}
          {Array.from({ length: 60 }).map((_, i) => {
            const angle = (i * 6 - 90) * (Math.PI / 180);
            const isHour = i % 5 === 0;
            const innerR = isHour ? 118 : 122;
            const outerR = 128;
            return (
              <line
                key={i}
                x1={140 + innerR * Math.cos(angle)}
                y1={140 + innerR * Math.sin(angle)}
                x2={140 + outerR * Math.cos(angle)}
                y2={140 + outerR * Math.sin(angle)}
                className={isHour ? "stroke-slate-400 dark:stroke-white/30" : "stroke-slate-300 dark:stroke-white/10"}
                strokeWidth={isHour ? 2 : 1}
              />
            );
          })}

          {/* Layer 3: Background track */}
          <circle
            cx="140"
            cy="140"
            r="110"
            fill="none"
            className="stroke-slate-200 dark:stroke-white/[0.08]"
            strokeWidth="8"
          />

          {/* Layer 4: Progress ring with dynamic color */}
          <motion.circle
            cx="140"
            cy="140"
            r="110"
            fill="none"
            stroke="url(#hyperfocusGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 110}`}
            initial={false}
            animate={{
              strokeDashoffset: `${2 * Math.PI * 110 * (1 - progress / 100)}`
            }}
            transition={zenMotion.gentle}
            style={{
              filter: `drop-shadow(0 0 12px ${progressColor.from})`
            }}
          />

          {/* Gradient definition with dynamic colors */}
          <defs>
            <linearGradient id="hyperfocusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={progressColor.from} />
              <stop offset="100%" stopColor={progressColor.to} />
            </linearGradient>
          </defs>
        </svg>

        {/* Inner breathing glow */}
        {isRunning && !isPaused && (
          <motion.div
            className="absolute inset-12 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${progressColor.from}20 0%, transparent 70%)`
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Time Display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <motion.div
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-violet-700 dark:text-white mb-2"
              style={{
                textShadow: `0 0 30px ${progressColor.from}60`
              }}
              key={timeLeft}
              initial={{ scale: 0.95, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={zenMotion.snappy}
            >
              {formattedTime}
            </motion.div>
            <div className="text-sm text-slate-600 dark:text-white/60">
              {t.hyperfocusTimeLeft}
            </div>
          </div>
        </div>
      </div>

      {/* Status Text */}
      <p className="text-xl text-slate-700 dark:text-white/80 mb-2">
        {isPaused
          ? t.hyperfocusPaused
          : !isRunning
          ? t.hyperfocusReady
          : t.hyperfocusFocusing}
      </p>

      {isPaused && (
        <p className="text-sm text-slate-600 dark:text-white/60">
          {t.hyperfocusPauseMsg}
        </p>
      )}
    </div>
  );
}
