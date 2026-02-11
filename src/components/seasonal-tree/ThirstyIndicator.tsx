/**
 * ThirstyIndicator — Wobbling 🥺 emoji when tree is thirsty (waterLevel < 30).
 * Preserved from original SeasonalTree implementation.
 */

import { motion } from 'framer-motion';

export function ThirstyIndicator() {
  return (
    <motion.div
      className="absolute top-2 right-2 text-2xl"
      animate={{ scale: [1, 1.2, 1], rotate: [-5, 5, -5] }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      🥺
    </motion.div>
  );
}
