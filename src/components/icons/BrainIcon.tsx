/**
 * BrainIcon - Animated neural brain SVG icon
 * Part of Premium Icons Library - Phase 12
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

export function BrainIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="brainGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="brainGradHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f9a8d4" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0" />
        </linearGradient>
        <filter id="brainGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="neuralGlow">
          <feGaussianBlur stdDeviation="1" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Left hemisphere */}
      <path
        d="M50 15
           C35 15 25 22 22 32
           C18 42 20 52 22 58
           C24 64 20 70 22 76
           C24 82 30 88 40 88
           C45 88 48 85 50 82"
        fill="url(#brainGradMain)"
        filter="url(#brainGlow)"
      >
        {animated && (
          <animate
            attributeName="d"
            values="M50 15 C35 15 25 22 22 32 C18 42 20 52 22 58 C24 64 20 70 22 76 C24 82 30 88 40 88 C45 88 48 85 50 82;
                    M50 14 C34 14 24 21 21 31 C17 41 19 51 21 57 C23 63 19 69 21 75 C23 81 29 87 39 87 C44 87 47 84 50 81;
                    M50 15 C35 15 25 22 22 32 C18 42 20 52 22 58 C24 64 20 70 22 76 C24 82 30 88 40 88 C45 88 48 85 50 82"
            dur="3s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Right hemisphere */}
      <path
        d="M50 15
           C65 15 75 22 78 32
           C82 42 80 52 78 58
           C76 64 80 70 78 76
           C76 82 70 88 60 88
           C55 88 52 85 50 82"
        fill="url(#brainGradMain)"
        filter="url(#brainGlow)"
      >
        {animated && (
          <animate
            attributeName="d"
            values="M50 15 C65 15 75 22 78 32 C82 42 80 52 78 58 C76 64 80 70 78 76 C76 82 70 88 60 88 C55 88 52 85 50 82;
                    M50 14 C66 14 76 21 79 31 C83 41 81 51 79 57 C77 63 81 69 79 75 C77 81 71 87 61 87 C56 87 53 84 50 81;
                    M50 15 C65 15 75 22 78 32 C82 42 80 52 78 58 C76 64 80 70 78 76 C76 82 70 88 60 88 C55 88 52 85 50 82"
            dur="3s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Brain folds - left */}
      <path
        d="M30 35 Q35 40 30 50 Q25 55 30 62"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M35 28 Q42 35 35 45"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />

      {/* Brain folds - right */}
      <path
        d="M70 35 Q65 40 70 50 Q75 55 70 62"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M65 28 Q58 35 65 45"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />

      {/* Center line */}
      <line
        x1="50"
        y1="18"
        x2="50"
        y2="80"
        stroke="url(#brainGradHighlight)"
        strokeWidth="2"
      />

      {/* Neural activity pulses */}
      {animated && (
        <>
          {/* Left pulse */}
          <circle cx="32" cy="45" r="3" fill="#fff" filter="url(#neuralGlow)">
            <animate
              attributeName="opacity"
              values="0.2;1;0.2"
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

          {/* Right pulse */}
          <circle cx="68" cy="50" r="3" fill="#fff" filter="url(#neuralGlow)">
            <animate
              attributeName="opacity"
              values="0.2;1;0.2"
              dur="1.8s"
              repeatCount="indefinite"
              begin="0.3s"
            />
            <animate
              attributeName="r"
              values="2;4;2"
              dur="1.8s"
              repeatCount="indefinite"
              begin="0.3s"
            />
          </circle>

          {/* Center pulse */}
          <circle cx="50" cy="55" r="3" fill="#fff" filter="url(#neuralGlow)">
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur="2s"
              repeatCount="indefinite"
              begin="0.6s"
            />
            <animate
              attributeName="r"
              values="2;5;2"
              dur="2s"
              repeatCount="indefinite"
              begin="0.6s"
            />
          </circle>

          {/* Top pulse */}
          <circle cx="50" cy="25" r="2" fill="#fff" filter="url(#neuralGlow)">
            <animate
              attributeName="opacity"
              values="0.2;0.8;0.2"
              dur="1.2s"
              repeatCount="indefinite"
              begin="0.9s"
            />
          </circle>

          {/* Neural connections - animated lines */}
          <line x1="32" y1="45" x2="50" y2="55" stroke="#fff" strokeWidth="1" opacity="0.3">
            <animate
              attributeName="opacity"
              values="0.1;0.5;0.1"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="68" y1="50" x2="50" y2="55" stroke="#fff" strokeWidth="1" opacity="0.3">
            <animate
              attributeName="opacity"
              values="0.1;0.5;0.1"
              dur="1.8s"
              repeatCount="indefinite"
              begin="0.3s"
            />
          </line>
          <line x1="50" y1="25" x2="50" y2="55" stroke="#fff" strokeWidth="1" opacity="0.3">
            <animate
              attributeName="opacity"
              values="0.1;0.4;0.1"
              dur="2s"
              repeatCount="indefinite"
              begin="0.6s"
            />
          </line>
        </>
      )}

      {/* Highlight overlay */}
      <ellipse
        cx="35"
        cy="30"
        rx="8"
        ry="10"
        fill="#fff"
        opacity="0.15"
        transform="rotate(-20 35 30)"
      />
      <ellipse
        cx="65"
        cy="32"
        rx="6"
        ry="8"
        fill="#fff"
        opacity="0.1"
        transform="rotate(20 65 32)"
      />
    </svg>
  );
}

export default BrainIcon;
