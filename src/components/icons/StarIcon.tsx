/**
 * StarIcon - Pulsing golden star SVG icon
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

export function StarIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="50%" stopColor="#ffb347" />
          <stop offset="100%" stopColor="#ff8c00" />
        </linearGradient>
        <linearGradient id="starShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="starGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main star */}
      <path
        d="M50 5 L61 35 L95 40 L70 62 L78 95 L50 78 L22 95 L30 62 L5 40 L39 35 Z"
        fill="url(#starGrad)"
        filter="url(#starGlow)"
      >
        {animated && (
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1;1.08;1"
            dur="1.5s"
            repeatCount="indefinite"
            additive="sum"
          />
        )}
      </path>

      {/* Shine overlay */}
      <path
        d="M50 5 L61 35 L95 40 L70 62 L78 95 L50 78 L22 95 L30 62 L5 40 L39 35 Z"
        fill="url(#starShine)"
        opacity="0.5"
      />

      {/* Center glow */}
      <circle cx="50" cy="50" r="15" fill="#fff9e6" opacity="0.6">
        {animated && (
          <>
            <animate
              attributeName="r"
              values="15;18;15"
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.6;0.9;0.6"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </>
        )}
      </circle>

      {/* Sparkle rays */}
      {animated && (
        <>
          <line x1="50" y1="5" x2="50" y2="0" stroke="#fff" strokeWidth="2" opacity="0.8">
            <animate
              attributeName="opacity"
              values="0.8;0.2;0.8"
              dur="1s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="95" y1="40" x2="100" y2="40" stroke="#fff" strokeWidth="2" opacity="0.8">
            <animate
              attributeName="opacity"
              values="0.8;0.2;0.8"
              dur="1s"
              repeatCount="indefinite"
              begin="0.2s"
            />
          </line>
          <line x1="78" y1="95" x2="80" y2="100" stroke="#fff" strokeWidth="2" opacity="0.8">
            <animate
              attributeName="opacity"
              values="0.8;0.2;0.8"
              dur="1s"
              repeatCount="indefinite"
              begin="0.4s"
            />
          </line>
          <line x1="22" y1="95" x2="20" y2="100" stroke="#fff" strokeWidth="2" opacity="0.8">
            <animate
              attributeName="opacity"
              values="0.8;0.2;0.8"
              dur="1s"
              repeatCount="indefinite"
              begin="0.6s"
            />
          </line>
          <line x1="5" y1="40" x2="0" y2="40" stroke="#fff" strokeWidth="2" opacity="0.8">
            <animate
              attributeName="opacity"
              values="0.8;0.2;0.8"
              dur="1s"
              repeatCount="indefinite"
              begin="0.8s"
            />
          </line>
        </>
      )}
    </svg>
  );
}

export default StarIcon;
