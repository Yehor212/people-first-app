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
      <div className="zf-focus-cosmic-background absolute inset-0 hidden dark:block" />
      {/* Star particles */}
      {cosmicStars.map((star) => (
        <CosmicStar key={star.id} {...star} />
      ))}
      {/* Nebula glow */}
      <motion.div
        className="zf-focus-cosmic-nebula pointer-events-none absolute inset-0"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
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
