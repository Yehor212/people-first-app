/**
 * MedalIcon - Military medal with ribbon SVG icon
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

export function MedalIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="medalGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="50%" stopColor="#daa520" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
        <linearGradient id="ribbonRed" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e63946" />
          <stop offset="100%" stopColor="#c1121f" />
        </linearGradient>
        <linearGradient id="ribbonBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4361ee" />
          <stop offset="100%" stopColor="#3a0ca3" />
        </linearGradient>
        <filter id="medalGlow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ribbon left */}
      <path
        d="M25 5 L35 5 L45 40 L35 45 L25 40 Z"
        fill="url(#ribbonRed)"
      />

      {/* Ribbon right */}
      <path
        d="M75 5 L65 5 L55 40 L65 45 L75 40 Z"
        fill="url(#ribbonBlue)"
      />

      {/* Ribbon center */}
      <path
        d="M35 5 L65 5 L60 35 L50 40 L40 35 Z"
        fill="#fff"
      />
      <path
        d="M40 5 L60 5 L57 30 L50 35 L43 30 Z"
        fill="url(#ribbonRed)"
        opacity="0.3"
      />

      {/* Medal circle */}
      <circle
        cx="50"
        cy="65"
        r="28"
        fill="url(#medalGold)"
        filter="url(#medalGlow)"
      >
        {animated && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 50 65;3 50 65;-3 50 65;0 50 65"
            dur="3s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Medal inner circle */}
      <circle cx="50" cy="65" r="22" fill="none" stroke="#b8860b" strokeWidth="2" />

      {/* Star on medal */}
      <path
        d="M50 48 L53 58 L64 59 L56 66 L59 77 L50 71 L41 77 L44 66 L36 59 L47 58 Z"
        fill="#fff9e6"
      >
        {animated && (
          <>
            <animate
              attributeName="opacity"
              values="0.9;1;0.9"
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1;1.05;1"
              dur="1.5s"
              repeatCount="indefinite"
              additive="sum"
            />
          </>
        )}
      </path>

      {/* Sparkles */}
      {animated && (
        <>
          <circle cx="35" cy="55" r="2" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="65" cy="60" r="1.5" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="1.8s"
              repeatCount="indefinite"
              begin="0.5s"
            />
          </circle>
        </>
      )}
    </svg>
  );
}

export default MedalIcon;
