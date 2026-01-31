/**
 * WeekCrystal - Glowing crystal visualization of week energy
 * Part of Phase 10 Premium Stats Redesign
 *
 * Shows a crystal with glow/color based on weekly performance
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface WeekCrystalProps {
  /** Week score (0-100) */
  score: number;
  /** Label for the crystal */
  label?: string;
  /** Optional class name */
  className?: string;
}

// Crystal color themes based on score
const getCrystalTheme = (score: number) => {
  if (score >= 80) {
    return {
      gradient: ['#34d399', '#10b981', '#059669'], // Emerald
      glow: 'hsl(158 60% 50%)',
      glowIntense: 'hsl(158 70% 60%)',
      label: 'Excellent Week',
      sparkleColor: '#fbbf24'
    };
  }
  if (score >= 60) {
    return {
      gradient: ['#60a5fa', '#3b82f6', '#2563eb'], // Blue
      glow: 'hsl(217 91% 60%)',
      glowIntense: 'hsl(217 91% 70%)',
      label: 'Good Week',
      sparkleColor: '#93c5fd'
    };
  }
  if (score >= 40) {
    return {
      gradient: ['#a78bfa', '#8b5cf6', '#7c3aed'], // Purple
      glow: 'hsl(262 83% 58%)',
      glowIntense: 'hsl(262 83% 68%)',
      label: 'Average Week',
      sparkleColor: '#c4b5fd'
    };
  }
  return {
    gradient: ['#9ca3af', '#6b7280', '#4b5563'], // Gray
    glow: 'hsl(220 9% 46%)',
    glowIntense: 'hsl(220 9% 56%)',
    label: 'Needs Improvement',
    sparkleColor: '#d1d5db'
  };
};

export function WeekCrystal({
  score,
  label,
  className,
}: WeekCrystalProps) {
  const { t } = useLanguage();
  const theme = useMemo(() => getCrystalTheme(score), [score]);

  // Sparkle positions
  const sparkles = useMemo(() => [
    { x: 30, y: 25, delay: 0, scale: 0.8 },
    { x: 70, y: 20, delay: 0.5, scale: 0.6 },
    { x: 50, y: 45, delay: 1, scale: 0.7 },
    { x: 35, y: 60, delay: 1.5, scale: 0.5 },
  ], []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative flex flex-col items-center p-4',
        'rounded-2xl',
        'bg-gradient-to-b from-card to-card/80',
        'border border-border/50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          {label || t.weekCrystal || 'Week Crystal'}
        </h3>
      </div>

      {/* Crystal SVG */}
      <div className="relative w-32 h-40">
        {/* Glow effect */}
        <div
          className="absolute inset-0 blur-xl opacity-50 animate-crystal-pulse"
          style={{
            background: `radial-gradient(circle at 50% 60%, ${theme.glow}, transparent 70%)`,
            '--crystal-color': theme.glow
          } as React.CSSProperties}
        />

        {/* Crystal shape */}
        <svg
          viewBox="0 0 100 120"
          className="relative w-full h-full crystal-hover"
          style={{
            filter: `drop-shadow(0 0 15px ${theme.glow})`
          }}
        >
          {/* Main crystal body */}
          <defs>
            <linearGradient id="crystalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.gradient[0]} />
              <stop offset="50%" stopColor={theme.gradient[1]} />
              <stop offset="100%" stopColor={theme.gradient[2]} />
            </linearGradient>
            <linearGradient id="crystalHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.4" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Crystal outline */}
          <motion.path
            d="M50 5 L85 40 L75 110 L50 115 L25 110 L15 40 Z"
            fill="url(#crystalGradient)"
            stroke={theme.gradient[0]}
            strokeWidth="1"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
          />

          {/* Inner facets */}
          <path
            d="M50 5 L50 115 M15 40 L50 60 L85 40"
            fill="none"
            stroke={theme.gradient[2]}
            strokeWidth="0.5"
            opacity="0.5"
          />

          {/* Highlight */}
          <path
            d="M50 5 L30 35 L35 80 L50 60 L50 5"
            fill="url(#crystalHighlight)"
          />

          {/* Inner sparkles */}
          {sparkles.map((sparkle, i) => (
            <motion.circle
              key={i}
              cx={sparkle.x}
              cy={sparkle.y}
              r={3 * sparkle.scale}
              fill={theme.sparkleColor}
              className={`animate-crystal-sparkle-${(i % 4) + 1}`}
              style={{
                opacity: 0
              }}
            />
          ))}
        </svg>

        {/* Floating sparkles outside crystal */}
        {score >= 60 && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  left: `${20 + i * 30}%`,
                  top: `${15 + i * 10}%`,
                }}
                animate={{
                  y: [0, -8, 0],
                  opacity: [0.3, 0.8, 0.3],
                  scale: [0.8, 1.1, 0.8],
                }}
                transition={{
                  duration: 2 + i * 0.5,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              >
                <Sparkles
                  className="w-3 h-3"
                  style={{ color: theme.sparkleColor }}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Score display */}
      <motion.div
        className="text-center mt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <p
          className="text-2xl font-bold"
          style={{ color: theme.glow }}
        >
          {score}%
        </p>
        <p className="text-xs text-muted-foreground">
          {t[`crystal${theme.label.replace(/\s/g, '')}`] || theme.label}
        </p>
      </motion.div>

      {/* Energy indicator */}
      <div className="w-full mt-3">
        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: theme.glow }}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default WeekCrystal;
