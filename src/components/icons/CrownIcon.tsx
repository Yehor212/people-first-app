/**
 * CrownIcon - Royal crown with jewels SVG icon
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

export function CrownIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="crownGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="40%" stopColor="#ffb347" />
          <stop offset="100%" stopColor="#daa520" />
        </linearGradient>
        <linearGradient id="crownShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="rubyGrad" cx="50%" cy="30%" r="50%">
          <stop offset="0%" stopColor="#ff6b6b" />
          <stop offset="100%" stopColor="#c0392b" />
        </radialGradient>
        <radialGradient id="sapphireGrad" cx="50%" cy="30%" r="50%">
          <stop offset="0%" stopColor="#74b9ff" />
          <stop offset="100%" stopColor="#2980b9" />
        </radialGradient>
        <radialGradient id="emeraldGrad" cx="50%" cy="30%" r="50%">
          <stop offset="0%" stopColor="#55efc4" />
          <stop offset="100%" stopColor="#00b894" />
        </radialGradient>
        <filter id="crownGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="jewelGlow">
          <feGaussianBlur stdDeviation="1" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Crown base band */}
      <rect
        x="15"
        y="65"
        width="70"
        height="15"
        rx="3"
        fill="url(#crownGold)"
        filter="url(#crownGlow)"
      />

      {/* Crown body with peaks */}
      <path
        d="M15 65 L10 35 L30 50 L50 20 L70 50 L90 35 L85 65 Z"
        fill="url(#crownGold)"
        filter="url(#crownGlow)"
      >
        {animated && (
          <animate
            attributeName="d"
            values="
              M15 65 L10 35 L30 50 L50 20 L70 50 L90 35 L85 65 Z;
              M15 65 L10 33 L30 48 L50 18 L70 48 L90 33 L85 65 Z;
              M15 65 L10 35 L30 50 L50 20 L70 50 L90 35 L85 65 Z
            "
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Shine overlay */}
      <path
        d="M15 65 L10 35 L30 50 L50 20 L70 50 L90 35 L85 65 Z"
        fill="url(#crownShine)"
      />

      {/* Center ruby (large) */}
      <ellipse cx="50" cy="45" rx="8" ry="10" fill="url(#rubyGrad)" filter="url(#jewelGlow)">
        {animated && (
          <>
            <animate
              attributeName="rx"
              values="8;9;8"
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="ry"
              values="10;11;10"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </>
        )}
      </ellipse>
      <ellipse cx="48" cy="42" rx="2" ry="3" fill="#fff" opacity="0.5" />

      {/* Left sapphire */}
      <circle cx="25" cy="55" r="5" fill="url(#sapphireGrad)" filter="url(#jewelGlow)">
        {animated && (
          <animate
            attributeName="r"
            values="5;5.5;5"
            dur="1.8s"
            repeatCount="indefinite"
            begin="0.3s"
          />
        )}
      </circle>
      <circle cx="24" cy="53" r="1.5" fill="#fff" opacity="0.5" />

      {/* Right sapphire */}
      <circle cx="75" cy="55" r="5" fill="url(#sapphireGrad)" filter="url(#jewelGlow)">
        {animated && (
          <animate
            attributeName="r"
            values="5;5.5;5"
            dur="1.8s"
            repeatCount="indefinite"
            begin="0.6s"
          />
        )}
      </circle>
      <circle cx="74" cy="53" r="1.5" fill="#fff" opacity="0.5" />

      {/* Peak jewels (emeralds) */}
      <circle cx="10" cy="35" r="4" fill="url(#emeraldGrad)" filter="url(#jewelGlow)">
        {animated && (
          <animate
            attributeName="opacity"
            values="1;0.8;1"
            dur="1s"
            repeatCount="indefinite"
          />
        )}
      </circle>
      <circle cx="50" cy="20" r="5" fill="url(#rubyGrad)" filter="url(#jewelGlow)">
        {animated && (
          <animate
            attributeName="opacity"
            values="1;0.8;1"
            dur="1.2s"
            repeatCount="indefinite"
            begin="0.2s"
          />
        )}
      </circle>
      <circle cx="90" cy="35" r="4" fill="url(#emeraldGrad)" filter="url(#jewelGlow)">
        {animated && (
          <animate
            attributeName="opacity"
            values="1;0.8;1"
            dur="1s"
            repeatCount="indefinite"
            begin="0.4s"
          />
        )}
      </circle>

      {/* Band decorations */}
      <rect x="25" y="70" width="8" height="5" rx="1" fill="#b8860b" />
      <rect x="46" y="70" width="8" height="5" rx="1" fill="#b8860b" />
      <rect x="67" y="70" width="8" height="5" rx="1" fill="#b8860b" />

      {/* Sparkles */}
      {animated && (
        <>
          <circle cx="35" cy="40" r="1.5" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="65" cy="42" r="1" fill="#fff">
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

export default CrownIcon;
