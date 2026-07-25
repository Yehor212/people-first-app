import type { CSSProperties } from 'react';
import type { StarData } from './types';

export function Star({ x, y, size, opacity, duration, delay }: Omit<StarData, 'id'>) {
  return (
    <div
      className="absolute rounded-full animate-zen-loop-fade-scale"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        backgroundColor: 'hsl(var(--cosmic-star-bg))',
        opacity: opacity * 0.75,
        '--zen-loop-min-opacity': opacity * 0.5,
        '--zen-loop-max-opacity': opacity,
        '--zen-loop-scale': 1.3,
        '--zen-loop-duration': `${duration}s`,
        '--zen-loop-delay': `${delay}s`,
      } as CSSProperties}
    />
  );
}
