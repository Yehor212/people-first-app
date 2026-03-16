/**
 * PremiumLoader — Infinity Draw SVG loader.
 *
 * Continuous self-drawing lemniscate (figure-eight) with pink→purple→blue
 * neon gradient. 3-layer depth: static glow foundation, animated mid-glow,
 * crisp main line, specular highlight.
 *
 * Uses CSS @keyframes + stroke-dashoffset (not JS-driven) for 60fps on Android.
 * Respects shouldAnimate() — falls back to static gradient path when disabled.
 */

import { useId } from 'react';
import { cn } from '@/lib/utils';
import { shouldAnimate } from '@/lib/animationUtils';

interface PremiumLoaderProps {
  /** Size variant: sm (48×24), md (96×48), lg (192×96), xl (260×130) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
  /** Accessible label (default: "Loading") */
  label?: string;
}

const sizeConfig = {
  sm: { w: 48, h: 24 },
  md: { w: 96, h: 48 },
  lg: { w: 192, h: 96 },
  xl: { w: 260, h: 130 },
} as const;

/** Mathematically symmetric lemniscate — smooth tangents at center crossover */
const INFINITY_PATH =
  'M20,25 C20,10 45,10 50,25 C55,40 80,40 80,25 C80,10 55,10 50,25 C45,40 20,40 20,25';

export function PremiumLoader({
  size = 'md',
  className,
  label = 'Loading',
}: PremiumLoaderProps) {
  const uid = useId();
  const { w, h } = sizeConfig[size];
  const animate = shouldAnimate();

  const gradId = `inf-grad${uid}`;
  const blurId = `inf-blur${uid}`;
  const blurSmId = `inf-blur-sm${uid}`;

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      role="status"
      aria-label={label}
    >
      <svg
        width={w}
        height={h}
        viewBox="0 0 100 50"
        overflow="visible"
        className="pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          {/* Rich 5-stop pink → rose → purple → indigo → blue gradient */}
          <linearGradient id={gradId} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="25%" stopColor="#e879f9" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="75%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          {/* Gaussian blurs for glow layers */}
          <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id={blurSmId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* Layer 1: Deep glow foundation — fat, blurred, always visible */}
        <path
          d={INFINITY_PATH}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.14"
          filter={`url(#${blurId})`}
        />

        {/* Layer 2: Mid-glow bed — tighter blur */}
        <path
          d={INFINITY_PATH}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.22"
          filter={`url(#${blurSmId})`}
        />

        {/* Animated draw group — neon glow pulse (3s polyrhythm) */}
        <g className={animate ? 'infinity-glow' : undefined}>
          {/* Animated glow trail — soft neon following the draw */}
          <path
            d={INFINITY_PATH}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.35"
            filter={`url(#${blurSmId})`}
            className={animate ? 'infinity-draw-line' : undefined}
            style={!animate ? { strokeDasharray: '105 60' } : undefined}
          />

          {/* Main crisp line — 4px core stroke */}
          <path
            d={INFINITY_PATH}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={animate ? 'infinity-draw-line' : undefined}
            style={!animate ? { strokeDasharray: '105 60' } : undefined}
          />

        </g>
      </svg>
      <span className="sr-only">{label}...</span>
    </div>
  );
}
