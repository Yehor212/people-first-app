/**
 * TargetIcon - Concentric target rings SVG icon
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

export function TargetIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="targetRed" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff6b6b" />
          <stop offset="100%" stopColor="#e63946" />
        </linearGradient>
        <filter id="targetGlow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer ring - red */}
      <circle cx="50" cy="50" r="45" fill="url(#targetRed)" />

      {/* Second ring - white */}
      <circle cx="50" cy="50" r="36" fill="#fff" />

      {/* Third ring - red */}
      <circle cx="50" cy="50" r="27" fill="url(#targetRed)" />

      {/* Fourth ring - white */}
      <circle cx="50" cy="50" r="18" fill="#fff" />

      {/* Bullseye - red */}
      <circle cx="50" cy="50" r="9" fill="url(#targetRed)" filter="url(#targetGlow)">
        {animated && (
          <>
            <animate
              attributeName="r"
              values="9;11;9"
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="1;0.8;1"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </>
        )}
      </circle>

      {/* Center dot */}
      <circle cx="50" cy="50" r="3" fill="#fff">
        {animated && (
          <animate
            attributeName="opacity"
            values="1;0.6;1"
            dur="1s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Crosshair lines */}
      <line x1="50" y1="5" x2="50" y2="20" stroke="#333" strokeWidth="2" opacity="0.3" />
      <line x1="50" y1="80" x2="50" y2="95" stroke="#333" strokeWidth="2" opacity="0.3" />
      <line x1="5" y1="50" x2="20" y2="50" stroke="#333" strokeWidth="2" opacity="0.3" />
      <line x1="80" y1="50" x2="95" y2="50" stroke="#333" strokeWidth="2" opacity="0.3" />
    </svg>
  );
}

export default TargetIcon;
