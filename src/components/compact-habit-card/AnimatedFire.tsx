/**
 * AnimatedFire - Animated fire icon for streak display
 * Extracted from CompactHabitCard (v1.3.0 Premium Phase 8)
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function AnimatedFire({ intensity = 1, size = 'sm' }: { intensity?: number; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';

  // Intensity affects glow and animation speed
  const glowIntensity = Math.min(intensity, 3);
  const animationDuration = Math.max(0.3, 0.6 - intensity * 0.1);

  return (
    <motion.div
      className="relative"
      animate={{
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: animationDuration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {/* Glow layer */}
      <motion.div
        className="absolute inset-0 rounded-full blur-sm"
        style={{
          background: `radial-gradient(circle, rgba(249, 115, 22, ${0.3 * glowIntensity}) 0%, transparent 70%)`,
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: animationDuration * 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* Fire SVG */}
      <svg className={cn(sizeClass, 'relative z-10')} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id="fireGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        <path
          d="M12 2C12 2 8 6 8 10C8 12 10 14 12 14C14 14 16 12 16 10C16 6 12 2 12 2Z"
          fill="url(#fireGradient)"
        >
          <animate
            attributeName="d"
            values="M12 2C12 2 8 6 8 10C8 12 10 14 12 14C14 14 16 12 16 10C16 6 12 2 12 2Z;M12 1C12 1 7 5 7 10C7 13 10 15 12 15C14 15 17 13 17 10C17 5 12 1 12 1Z;M12 2C12 2 8 6 8 10C8 12 10 14 12 14C14 14 16 12 16 10C16 6 12 2 12 2Z"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
        <path
          d="M12 6C12 6 10 8 10 10C10 11 11 12 12 12C13 12 14 11 14 10C14 8 12 6 12 6Z"
          fill="#fef3c7"
        >
          <animate
            attributeName="d"
            values="M12 6C12 6 10 8 10 10C10 11 11 12 12 12C13 12 14 11 14 10C14 8 12 6 12 6Z;M12 5C12 5 9 7 9 10C9 11.5 11 13 12 13C13 13 15 11.5 15 10C15 7 12 5 12 5Z;M12 6C12 6 10 8 10 10C10 11 11 12 12 12C13 12 14 11 14 10C14 8 12 6 12 6Z"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    </motion.div>
  );
}
