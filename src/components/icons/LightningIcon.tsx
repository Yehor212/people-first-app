/**
 * LightningIcon - Electric bolt with glow SVG icon
 * Part of Premium Icons Library - Phase 11.2
 */

import { cn } from '@/lib/utils';
import { IconProps } from './FireIcon';

const sizeMap = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

export function LightningIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="50%" stopColor="#ffb347" />
          <stop offset="100%" stopColor="#ff8c00" />
        </linearGradient>
        <linearGradient id="boltShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="boltGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="boltGlowIntense">
          <feGaussianBlur stdDeviation="5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main lightning bolt */}
      <path
        d="M55 5 L25 45 L45 45 L40 95 L75 50 L55 50 Z"
        fill="url(#boltGrad)"
        filter="url(#boltGlow)"
      >
        {animated && (
          <>
            <animate
              attributeName="filter"
              values="url(#boltGlow);url(#boltGlowIntense);url(#boltGlow)"
              dur="0.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="1;0.9;1"
              dur="0.3s"
              repeatCount="indefinite"
            />
          </>
        )}
      </path>

      {/* Shine overlay */}
      <path
        d="M55 5 L25 45 L45 45 L40 95 L75 50 L55 50 Z"
        fill="url(#boltShine)"
      />

      {/* Inner bright core */}
      <path
        d="M52 15 L32 45 L47 45 L43 85 L68 52 L53 52 Z"
        fill="#fff9e6"
        opacity="0.6"
      >
        {animated && (
          <animate
            attributeName="opacity"
            values="0.6;0.9;0.6"
            dur="0.4s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Electric sparks */}
      {animated && (
        <>
          <circle cx="20" cy="40" r="2" fill="#ffd700">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="0.8s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="1;3;1"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="80" cy="55" r="1.5" fill="#ffb347">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="0.6s"
              repeatCount="indefinite"
              begin="0.2s"
            />
          </circle>
          <circle cx="35" cy="85" r="1.5" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;0.8;0"
              dur="0.7s"
              repeatCount="indefinite"
              begin="0.4s"
            />
          </circle>
        </>
      )}
    </svg>
  );
}

export default LightningIcon;
