import { motion } from 'framer-motion';
import type { StarData } from './types';

export function Star({ x, y, size, opacity, duration, delay }: Omit<StarData, 'id'>) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        backgroundColor: 'hsl(var(--cosmic-star-bg))',
      }}
      animate={{
        opacity: [opacity * 0.5, opacity, opacity * 0.5],
        scale: [1, 1.3, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}
