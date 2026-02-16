/**
 * HyperfocusBackground — cosmic background with star particles and breathing animation
 * Pure component, 0 useState. Star particles are dark-mode only.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';

// Star particle for cosmic background (dark theme only)
function CosmicStar({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-white hidden dark:block"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
      }}
      animate={{
        opacity: [0.2, 0.8, 0.2],
        scale: [1, 1.3, 1],
      }}
      transition={{
        duration: 2 + Math.random() * 2,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
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
      <div className="absolute inset-0 bg-gradient-to-b from-slate-100 via-indigo-50 to-violet-100 dark:bg-none" />
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
            radial-gradient(circle at 20% 30%, hsl(var(--focus-violet) / 0.15) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, hsl(var(--focus-pink) / 0.1) 0%, transparent 40%),
            radial-gradient(circle at 50% 90%, hsl(var(--focus-cyan) / 0.08) 0%, transparent 30%)
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
            <p className="text-xl text-white/70">
              {t.hyperfocusBreathDesc}
            </p>
          </div>
        </div>
      )}

      {/* Breathing Animation CSS */}
      <style>{`
        @keyframes breathing {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.6;
          }
        }

        .breathing-circle {
          width: 150px;
          height: 150px;
          animation: breathing 8s ease-in-out infinite;
        }

        @media (min-width: 360px) {
          .breathing-circle {
            width: 200px;
            height: 200px;
          }
        }
      `}</style>
    </>
  );
}
