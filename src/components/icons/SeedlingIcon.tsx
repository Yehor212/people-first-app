/**
 * SeedlingIcon - Growing plant/seedling SVG icon
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

export function SeedlingIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        {/* Leaf gradient */}
        <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="50%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        {/* Stem gradient */}
        <linearGradient id="stemGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        {/* Soil gradient */}
        <linearGradient id="soilGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <filter id="seedlingGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Soil mound */}
      <ellipse cx="50" cy="88" rx="35" ry="10" fill="url(#soilGrad)" />

      {/* Main stem */}
      <path
        d="M50 85 Q50 60 50 45"
        stroke="url(#stemGrad)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      >
        {animated && (
          <animate
            attributeName="d"
            values="M50 85 Q50 65 50 50; M50 85 Q52 62 50 45; M50 85 Q48 62 50 45; M50 85 Q50 65 50 50"
            dur="3s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Left leaf */}
      <path
        d="M50 55 Q30 45 25 30 Q35 35 50 55"
        fill="url(#leafGrad)"
        filter="url(#seedlingGlow)"
      >
        {animated && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 50 55; -5 50 55; 0 50 55"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Right leaf */}
      <path
        d="M50 55 Q70 45 75 30 Q65 35 50 55"
        fill="url(#leafGrad)"
        filter="url(#seedlingGlow)"
      >
        {animated && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 50 55; 5 50 55; 0 50 55"
            dur="2.2s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Leaf veins */}
      <path d="M50 55 Q38 48 30 38" stroke="#16a34a" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M50 55 Q62 48 70 38" stroke="#16a34a" strokeWidth="1" fill="none" opacity="0.5" />

      {/* Shine highlights */}
      <ellipse cx="35" cy="38" rx="4" ry="6" fill="#fff" opacity="0.3" transform="rotate(-30 35 38)" />
      <ellipse cx="65" cy="38" rx="4" ry="6" fill="#fff" opacity="0.3" transform="rotate(30 65 38)" />

      {/* Growth sparkles */}
      {animated && (
        <>
          <circle cx="30" cy="25" r="2" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="28;20;28"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="70" cy="28" r="1.5" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="2.5s"
              repeatCount="indefinite"
              begin="0.5s"
            />
            <animate
              attributeName="cy"
              values="30;22;30"
              dur="2.5s"
              repeatCount="indefinite"
              begin="0.5s"
            />
          </circle>
          <circle cx="50" cy="20" r="1.5" fill="#4ade80">
            <animate
              attributeName="opacity"
              values="0;0.8;0"
              dur="3s"
              repeatCount="indefinite"
              begin="1s"
            />
          </circle>
        </>
      )}
    </svg>
  );
}

export default SeedlingIcon;
