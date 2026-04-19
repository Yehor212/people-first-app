/**
 * MoodParticles component for MoodWeather
 * Extracted from MoodWeather.tsx for TD-20 decomposition
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ParticleLayerConfig } from '@/lib/weatherMoodConfig';

// ============================================
// PARTICLE COLOR MAP (name -> rgb)
// ============================================

export const PARTICLE_RGB: Record<string, string> = {
  teal: '45, 212, 191',
  amber: '251, 191, 36',
  violet: '139, 92, 246',
  slate: '148, 163, 184',
  blue: '59, 130, 246',
  red: '239, 68, 68',
  yellow: '234, 179, 8',
  indigo: '99, 102, 241',
};

// ============================================
// MOOD PARTICLES COMPONENT
// ============================================

export function MoodParticles({ config, budget }: { config: ParticleLayerConfig; budget: number }) {
  const count = Math.min(config.count, budget);
  const rgb = PARTICLE_RGB[config.color] || '148, 163, 184';

  const { type, sizeRange, speedRange, opacity } = config;

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 90 + 5,
        top: type === 'rain' ? -(Math.random() * 20) : Math.random() * 85 + 5,
        size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
        delay: Math.random() * speedRange[1],
        duration: speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]),
        op: opacity[0] + Math.random() * (opacity[1] - opacity[0]),
      })),
    [count, type, sizeRange, speedRange, opacity],
  );

  const animClass =
    config.type === 'sparkle'
      ? 'motion-safe:animate-pulse-soft'
      : config.type === 'rain'
        ? 'motion-safe:animate-rain-drop'
        : config.type === 'fog'
          ? 'motion-safe:animate-fog-drift'
          : 'motion-safe:animate-pulse-soft';

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
      {particles.map((p) => (
        <div
          key={p.id}
          className={cn('absolute rounded-full', animClass)}
          style={{
            left: `${p.left}%`,
            top: type === 'rain' ? p.top : `${p.top}%`,
            width: p.size,
            height: type === 'rain' ? p.size * 3 : p.size,
            backgroundColor: `rgba(${rgb}, ${p.op})`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
