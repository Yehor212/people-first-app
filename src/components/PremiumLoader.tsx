/**
 * PremiumLoader — Breathing concentric rings loader.
 *
 * Replaces basic CSS `animate-spin border-b-2` spinners with a premium
 * breathing orb animation that matches ZenFlow's design language.
 *
 * Uses CSS @keyframes (not JS-driven animation) for 60fps on Android.
 * Respects shouldAnimate() — falls back to static rings when animations disabled.
 */

import { cn } from '@/lib/utils';
import { shouldAnimate } from '@/lib/animationUtils';

interface PremiumLoaderProps {
  /** Size variant: sm (24px), md (48px), lg (96px) */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Accessible label (default: "Loading") */
  label?: string;
}

const sizeConfig = {
  sm: { container: 'w-6 h-6', rings: [10, 8, 5], glow: '4px' },
  md: { container: 'w-12 h-12', rings: [22, 16, 10], glow: '8px' },
  lg: { container: 'w-24 h-24', rings: [44, 34, 22], glow: '12px' },
} as const;

export function PremiumLoader({
  size = 'md',
  className,
  label = 'Loading',
}: PremiumLoaderProps) {
  const config = sizeConfig[size];
  const animate = shouldAnimate();

  return (
    <div
      className={cn('relative flex items-center justify-center', config.container, className)}
      role="status"
      aria-label={label}
    >
      {config.rings.map((r, i) => (
        <div
          key={i}
          className={cn(
            'absolute rounded-full border border-primary/30 bg-primary/10',
            animate && 'zen-loader-ring',
          )}
          style={{
            width: r,
            height: r,
            animationDelay: animate ? `${i * 0.3}s` : undefined,
            boxShadow: animate && i === 0
              ? `0 0 ${config.glow} hsl(var(--primary) / 0.25)`
              : undefined,
          }}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">{label}...</span>
    </div>
  );
}
