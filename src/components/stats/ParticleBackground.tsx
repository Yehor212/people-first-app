/**
 * ParticleBackground - Floating particles layer for premium effects
 * Part of Phase 10 Premium Stats Redesign
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

interface ParticleBackgroundProps {
  /** Number of particles to render */
  count?: number;
  /** Base color (uses primary by default) */
  color?: 'primary' | 'accent' | 'purple' | 'teal' | 'gold';
  /** Container class name */
  className?: string;
  /** Whether to show particles */
  active?: boolean;
}

const COLOR_CLASSES = {
  primary: 'bg-primary/30',
  accent: 'bg-accent/30',
  purple: 'bg-purple-500/30',
  teal: 'bg-teal-500/30',
  gold: 'bg-amber-400/40',
};

export function ParticleBackground({
  count = 8,
  color = 'primary',
  className,
  active = true,
}: ParticleBackgroundProps) {
  // Generate random particles
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 4 + Math.random() * 8, // 4-12px
      delay: Math.random() * 5, // 0-5s delay
      duration: 8 + Math.random() * 6, // 8-14s duration
      opacity: 0.3 + Math.random() * 0.4, // 0.3-0.7 opacity
    }));
  }, [count]);

  if (!active) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 overflow-hidden pointer-events-none',
        className
      )}
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={cn(
            'absolute rounded-full blur-[1px]',
            COLOR_CLASSES[color],
            particle.id % 5 === 0 && 'animate-particle-float-1',
            particle.id % 5 === 1 && 'animate-particle-float-2',
            particle.id % 5 === 2 && 'animate-particle-float-3',
            particle.id % 5 === 3 && 'animate-particle-float-4',
            particle.id % 5 === 4 && 'animate-particle-float-5'
          )}
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: particle.opacity,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export default ParticleBackground;
