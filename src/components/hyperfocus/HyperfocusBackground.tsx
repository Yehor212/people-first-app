/**
 * HyperfocusBackground — restored Historical night Hyperfocus atmosphere.
 * Pure component, 0 useState. The fullscreen Hyperfocus shell owns the local dark scope.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useShouldAnimate } from '@/hooks/useShouldAnimate';

/**
 * Historical night Hyperfocus particle. The local dark shell keeps these as
 * quiet stars while still using the shared GPU-only .zen-particle animation.
 */
function CosmicStar({
  x,
  y,
  size,
  delay,
  motionAllowed,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  motionAllowed: boolean;
}) {
  return (
    <div
      className={motionAllowed ? "zen-particle absolute rounded-full" : "absolute rounded-full"}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        opacity: motionAllowed ? undefined : 0.42,
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
  const motionAllowed = useShouldAnimate({ respectRuntimePerformance: false });
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
      {/* Historical night Hyperfocus — Cosmic Cathedral from before day/night duality. */}
      <div className="zf-hyperfocus-cosmic-background absolute inset-0" />

      {/* Star field */}
      {cosmicStars.map((star) => (
        <CosmicStar key={star.id} {...star} motionAllowed={motionAllowed} />
      ))}

      {/* Animated nebula gradient */}
      <motion.div
        className="zf-hyperfocus-nebula pointer-events-none absolute inset-0"
        animate={motionAllowed ? { opacity: [0.2, 0.4, 0.2] } : { opacity: 0.24 }}
        transition={motionAllowed ? { duration: 8, repeat: Infinity } : { duration: 0 }}
      />

      {/* Breathing Animation */}
      {motionAllowed && showBreathingAnimation && (
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
