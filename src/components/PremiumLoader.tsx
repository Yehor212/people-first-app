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
  /** Size variant: sm (48×24), md (96×48), lg (192×96) */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Accessible label (default: "Loading") */
  label?: string;
}

const sizeConfig = {
  sm: { w: 48, h: 24 },
  md: { w: 96, h: 48 },
  lg: { w: 192, h: 96 },
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
  const hiId = `inf-hi${uid}`;
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
          {/* Pink → Purple → Blue gradient */}
          <linearGradient id={gradId} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          {/* Lighter specular highlight gradient */}
          <linearGradient id={hiId} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#f9a8d4" />
            <stop offset="50%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#93c5fd" />
          </linearGradient>

          {/* Gaussian blurs for glow layers */}
          <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id={blurSmId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* Layer 1: Static glow foundation — always visible, blurred */}
        <path
          d={INFINITY_PATH}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.12"
          filter={`url(#${blurId})`}
        />

        {/* Layer 2: Static mid-glow — tighter blur */}
        <path
          d={INFINITY_PATH}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.18"
          filter={`url(#${blurSmId})`}
        />

        {/* Animated draw group — neon glow pulse */}
        <g className={animate ? 'infinity-glow' : undefined}>
          {/* Animated glow trail */}
          <path
            d={INFINITY_PATH}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.30"
            filter={`url(#${blurSmId})`}
            className={animate ? 'infinity-draw-line' : undefined}
            style={!animate ? { strokeDasharray: '105 60' } : undefined}
          />

          {/* Main crisp line — 4px as per spec */}
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

          {/* Specular highlight — glass-tube shine */}
          <path
            d={INFINITY_PATH}
            fill="none"
            stroke={`url(#${hiId})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.50"
            className={animate ? 'infinity-draw-line' : undefined}
            style={!animate ? { strokeDasharray: '105 60' } : undefined}
          />
        </g>
      </svg>
      <span className="sr-only">{label}...</span>
    </div>
  );
}
