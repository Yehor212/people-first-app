/**
 * TrophyIcon - Golden trophy with shine SVG icon
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

export function TrophyIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="trophyGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="30%" stopColor="#ffb347" />
          <stop offset="70%" stopColor="#daa520" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
        <linearGradient id="trophyShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trophyBase" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8b4513" />
          <stop offset="100%" stopColor="#5d3a1a" />
        </linearGradient>
        <filter id="trophyGlow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Trophy cup body */}
      <path
        d="M25 15 L75 15 L70 50 C70 65 60 70 50 70 C40 70 30 65 30 50 Z"
        fill="url(#trophyGold)"
        filter="url(#trophyGlow)"
      >
        {animated && (
          <animate
            attributeName="filter"
            values="url(#trophyGlow);none;url(#trophyGlow)"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Shine overlay */}
      <path
        d="M25 15 L75 15 L70 50 C70 65 60 70 50 70 C40 70 30 65 30 50 Z"
        fill="url(#trophyShine)"
      />

      {/* Left handle */}
      <path
        d="M25 20 C10 20 5 30 5 40 C5 50 15 55 25 50"
        fill="none"
        stroke="url(#trophyGold)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Right handle */}
      <path
        d="M75 20 C90 20 95 30 95 40 C95 50 85 55 75 50"
        fill="none"
        stroke="url(#trophyGold)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Stem */}
      <rect x="45" y="70" width="10" height="12" fill="url(#trophyGold)" />

      {/* Base */}
      <path
        d="M30 82 L70 82 L75 95 L25 95 Z"
        fill="url(#trophyBase)"
      />

      {/* Base top */}
      <rect x="35" y="80" width="30" height="4" rx="2" fill="url(#trophyGold)" />

      {/* Star on trophy */}
      <path
        d="M50 25 L53 33 L62 34 L56 40 L58 48 L50 44 L42 48 L44 40 L38 34 L47 33 Z"
        fill="#fff9e6"
        opacity="0.9"
      >
        {animated && (
          <>
            <animate
              attributeName="opacity"
              values="0.9;1;0.9"
              dur="1s"
              repeatCount="indefinite"
            />
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1;1.1;1"
              dur="1s"
              repeatCount="indefinite"
              additive="sum"
            />
          </>
        )}
      </path>

      {/* Sparkles */}
      {animated && (
        <>
          <circle cx="35" cy="30" r="2" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="65" cy="35" r="1.5" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="1.8s"
              repeatCount="indefinite"
              begin="0.5s"
            />
          </circle>
          <circle cx="50" cy="55" r="1.5" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;0.8;0"
              dur="2s"
              repeatCount="indefinite"
              begin="1s"
            />
          </circle>
        </>
      )}
    </svg>
  );
}

export default TrophyIcon;
