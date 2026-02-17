/**
 * SparkleParticles - Floating sparkle particle animations
 */

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

// Floating sparkle particles
export function SparkleParticles({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            left: `${5 + (i * 8)}%`,
            top: `${10 + (i % 4) * 20}%`,
          }}
          animate={{
            y: [0, -15, 0],
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2 + (i % 3) * 0.5,
            delay: i * 0.15,
            repeat: Infinity,
            repeatDelay: 0.5,
          }}
        >
          <Sparkles className="w-3 h-3" style={{ color }} />
        </motion.div>
      ))}
    </div>
  );
}
