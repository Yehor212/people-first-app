/**
 * WateringEffect — Animated water drop emojis that fall when isWatering=true.
 * Preserved from original SeasonalTree implementation.
 */

import { AnimatePresence, motion } from 'framer-motion';

interface WateringEffectProps {
  isWatering?: boolean;
  height: number;
}

export function WateringEffect({ isWatering, height }: WateringEffectProps) {
  return (
    <AnimatePresence>
      {isWatering && (
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: height / 2, opacity: [0, 1, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
        >
          {[...Array(5)].map((_, i) => (
            <motion.span
              key={i}
              className="absolute text-xl"
              style={{ left: `${i * 10 - 20}px` }}
              animate={{
                y: [0, 30],
                opacity: [1, 0],
              }}
              transition={{
                duration: 0.8,
                delay: i * 0.1,
                repeat: 2,
              }}
            >
              💧
            </motion.span>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
