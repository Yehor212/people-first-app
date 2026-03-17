/**
 * HyperfocusBackground — cosmic background with star particles and breathing animation
 * Pure component, 0 useState. Particles visible in both themes via CSS duality.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * Theme-aware particle — CSS .zen-particle switches animation:
 *   Day:   zen-mote-float  (gentle upward drift)
 *   Night: zen-star-twinkle (pulse in place)
 * Migrated from FM animate → CSS keyframes for 50-particle performance.
 */
function CosmicStar({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <div
      className="zen-particle absolute rounded-full"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        backgroundColor: 'var(--particle-color)',
        '--particle-duration': `${2 + delay}s`,
        '--particle-delay': `${delay}s`,
      } as React.CSSProperties}
    />
  );
}

interface HyperfocusBackgroundProps {
  showBreathingAnimation: boolean;
  t: Record<string, string>;
}

export function HyperfocusBackground({ showBreathingAnimation, t }: HyperfocusBackgroundProps) {
  const cosmicStars = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 3,
    })),
  []);

  return (
    <>
      {/* Deep space background - Theme-aware (fixed layer) */}
      {/* Light mode — Sun-Dappled Meadow */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-50 via-sky-50 to-indigo-50 dark:bg-none" />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background: `radial-gradient(ellipse at center,
            hsl(var(--focus-cosmic-mid)) 0%, hsl(var(--focus-cosmic-deep)) 50%, hsl(0 0% 0%) 100%)`
        }}
      />

      {/* Star field */}
      {cosmicStars.map((star) => (
        <CosmicStar key={star.id} {...star} />
      ))}

      {/* Animated nebula gradient */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 8, repeat: Infinity }}
        style={{
          background: `
            radial-gradient(circle at 20% 30%, var(--nebula-a) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, var(--nebula-b) 0%, transparent 40%),
            radial-gradient(circle at 50% 90%, var(--nebula-b) 0%, transparent 30%)
          `
        }}
      />

      {/* Breathing Animation */}
      {showBreathingAnimation && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="breathing-circle zen-gradient rounded-full opacity-40" />
          <div className="absolute text-center">
            <p className="text-4xl font-bold text-slate-800 dark:text-white mb-4">
              {t.hyperfocusBreathe}
            </p>
            <p className="text-xl text-slate-500 dark:text-white/70">
              {t.hyperfocusBreathDesc}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
