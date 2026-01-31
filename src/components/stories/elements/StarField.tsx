/**
 * StarField - Animated parallax star background
 * Used in IntroSlide, FocusSlide for cosmic atmosphere
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

interface StarFieldProps {
  /** Number of stars to render */
  count?: number;
  /** Animation speed multiplier */
  speed?: number;
  /** Star color */
  color?: string;
  /** Enable vortex effect (stars move toward center) */
  vortex?: boolean;
  /** Enable twinkle animation */
  twinkle?: boolean;
  className?: string;
}

export function StarField({
  count = 50,
  speed = 1,
  color = 'white',
  vortex = false,
  twinkle = true,
  className = '',
}: StarFieldProps) {
  // Generate stars with random positions
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5 + 0.3,
      duration: (Math.random() * 3 + 2) / speed,
      delay: Math.random() * 2,
    }));
  }, [count, speed]);

  // Parallax layers for depth effect
  const layers = useMemo(() => {
    const layerCount = 3;
    const starsPerLayer = Math.floor(count / layerCount);

    return [
      { stars: stars.slice(0, starsPerLayer), speed: 0.3, opacity: 0.4 },
      { stars: stars.slice(starsPerLayer, starsPerLayer * 2), speed: 0.6, opacity: 0.6 },
      { stars: stars.slice(starsPerLayer * 2), speed: 1, opacity: 0.9 },
    ];
  }, [stars, count]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {layers.map((layer, layerIndex) => (
        <div key={layerIndex} className="absolute inset-0">
          {layer.stars.map((star) => (
            <motion.div
              key={star.id}
              className="absolute rounded-full"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.size,
                height: star.size,
                backgroundColor: color,
                opacity: star.opacity * layer.opacity,
              }}
              animate={
                vortex
                  ? {
                      // Vortex: stars move toward center
                      x: [0, (50 - star.x) * 0.5],
                      y: [0, (50 - star.y) * 0.5],
                      scale: [1, 0.5],
                      opacity: [star.opacity * layer.opacity, 0],
                    }
                  : twinkle
                  ? {
                      // Twinkle effect
                      opacity: [
                        star.opacity * layer.opacity * 0.5,
                        star.opacity * layer.opacity,
                        star.opacity * layer.opacity * 0.5,
                      ],
                      scale: [1, 1.2, 1],
                    }
                  : {}
              }
              transition={{
                duration: star.duration,
                delay: star.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      ))}

      {/* Distant nebula glow effect */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse at 20% 30%, rgba(147, 51, 234, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, rgba(59, 130, 246, 0.2) 0%, transparent 40%)
          `,
        }}
      />
    </div>
  );
}

export default StarField;
