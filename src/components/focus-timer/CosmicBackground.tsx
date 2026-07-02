/**
 * CosmicBackground - Theme-aware cosmic background and CTA header for FocusTimer
 */

import { motion } from 'framer-motion';
import { Focus } from 'lucide-react';
import { CosmicStar, cosmicStars } from '@/components/cosmic/CosmicStarField';

interface CosmicBackgroundProps {
  startHereLabel: string;
}

export function CosmicBackground({ startHereLabel }: CosmicBackgroundProps) {
  return (
    <>
      {/* Cosmic Background - Theme-aware */}
      {/* Light mode background — Sun-Dappled Meadow */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-50 via-sky-50 to-indigo-50 dark:bg-none" />
      {/* Dark mode cosmic gradient */}
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background: `radial-gradient(ellipse at center,
            hsl(var(--focus-cosmic-light)) 0%, hsl(var(--focus-cosmic-mid)) 40%, hsl(var(--focus-cosmic-dark)) 100%)`
        }}
      />
      {/* Star particles */}
      {cosmicStars.map((star) => (
        <CosmicStar key={star.id} {...star} />
      ))}
      {/* Nebula glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
        style={{
          background: `
            radial-gradient(circle at 30% 30%, var(--nebula-a) 0%, transparent 40%),
            radial-gradient(circle at 70% 70%, var(--nebula-b) 0%, transparent 40%)
          `
        }}
      />

      {/* Primary CTA Header */}
      <motion.div
        className="relative flex items-center justify-center gap-2 mb-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-500/25 backdrop-blur-sm rounded-full border border-violet-500/30">
          <Focus className="w-4 h-4 text-violet-700 dark:text-violet-300" aria-hidden="true" />
          <span className="text-sm font-bold text-violet-700 dark:text-violet-200">{startHereLabel}</span>
        </div>
      </motion.div>
    </>
  );
}
