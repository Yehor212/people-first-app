/**
 * DiamondIcon - Sparkling crystal SVG icon
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

export function DiamondIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="diamondGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b9f2ff" />
          <stop offset="30%" stopColor="#87ceeb" />
          <stop offset="60%" stopColor="#4fc3f7" />
          <stop offset="100%" stopColor="#00bcd4" />
        </linearGradient>
        <linearGradient id="diamondFacet1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0f7fa" />
          <stop offset="100%" stopColor="#80deea" />
        </linearGradient>
        <linearGradient id="diamondFacet2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4dd0e1" />
          <stop offset="100%" stopColor="#26c6da" />
        </linearGradient>
        <filter id="diamondGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main diamond shape */}
      <path
        d="M50 5 L85 35 L50 95 L15 35 Z"
        fill="url(#diamondGrad)"
        filter="url(#diamondGlow)"
      >
        {animated && (
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1;1.03;1"
            dur="2s"
            repeatCount="indefinite"
            additive="sum"
          />
        )}
      </path>

      {/* Top facet */}
      <path d="M50 5 L85 35 L50 45 L15 35 Z" fill="url(#diamondFacet1)" opacity="0.9" />

      {/* Left facet */}
      <path d="M15 35 L50 45 L50 95 Z" fill="url(#diamondFacet2)" opacity="0.7" />

      {/* Right facet highlight */}
      <path d="M50 45 L85 35 L50 95 Z" fill="url(#diamondGrad)" opacity="0.5" />

      {/* Center line */}
      <path d="M50 5 L50 95" stroke="#fff" strokeWidth="0.5" opacity="0.3" />

      {/* Sparkle effects */}
      {animated && (
        <>
          <circle cx="30" cy="30" r="3" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="2;4;2"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="70" cy="40" r="2" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="1.8s"
              repeatCount="indefinite"
              begin="0.5s"
            />
            <animate
              attributeName="r"
              values="1;3;1"
              dur="1.8s"
              repeatCount="indefinite"
              begin="0.5s"
            />
          </circle>
          <circle cx="50" cy="60" r="2.5" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;0.8;0"
              dur="2s"
              repeatCount="indefinite"
              begin="1s"
            />
            <animate
              attributeName="r"
              values="1.5;3.5;1.5"
              dur="2s"
              repeatCount="indefinite"
              begin="1s"
            />
          </circle>

          {/* Shine sweep */}
          <rect x="0" y="0" width="20" height="100" fill="url(#diamondFacet1)" opacity="0.3">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="-20,0;120,0;-20,0"
              dur="3s"
              repeatCount="indefinite"
            />
          </rect>
        </>
      )}
    </svg>
  );
}

export default DiamondIcon;
