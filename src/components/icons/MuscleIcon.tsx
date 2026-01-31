/**
 * MuscleIcon - Animated flexing arm SVG icon
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

export function MuscleIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="muscleGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="50%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id="muscleGradHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
        <filter id="muscleGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="muscleShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Arm shape */}
      <g filter="url(#muscleShadow)">
        {/* Upper arm / bicep */}
        <path
          d="M25 75
             C20 70 18 60 20 50
             C22 40 30 35 40 32
             C50 29 55 28 60 30
             C65 32 70 38 68 48
             C66 58 58 62 50 60
             C42 58 35 55 32 58
             C29 61 28 70 30 75
             Z"
          fill="url(#muscleGradMain)"
          filter="url(#muscleGlow)"
        >
          {animated && (
            <animate
              attributeName="d"
              values="M25 75 C20 70 18 60 20 50 C22 40 30 35 40 32 C50 29 55 28 60 30 C65 32 70 38 68 48 C66 58 58 62 50 60 C42 58 35 55 32 58 C29 61 28 70 30 75 Z;
                      M25 75 C20 70 18 58 20 48 C22 38 30 32 40 28 C52 24 58 24 64 28 C70 32 75 40 72 52 C69 64 58 66 48 62 C38 58 33 54 30 58 C27 62 26 70 30 75 Z;
                      M25 75 C20 70 18 60 20 50 C22 40 30 35 40 32 C50 29 55 28 60 30 C65 32 70 38 68 48 C66 58 58 62 50 60 C42 58 35 55 32 58 C29 61 28 70 30 75 Z"
              dur="1.5s"
              repeatCount="indefinite"
            />
          )}
        </path>

        {/* Forearm */}
        <path
          d="M68 48
             C72 50 78 55 82 58
             C86 61 88 65 86 70
             C84 75 78 78 72 76
             C66 74 60 68 58 62
             C56 56 64 46 68 48
             Z"
          fill="url(#muscleGradMain)"
        >
          {animated && (
            <animate
              attributeName="d"
              values="M68 48 C72 50 78 55 82 58 C86 61 88 65 86 70 C84 75 78 78 72 76 C66 74 60 68 58 62 C56 56 64 46 68 48 Z;
                      M72 52 C76 54 82 58 86 60 C90 62 92 66 90 72 C88 78 82 80 76 78 C70 76 64 70 62 64 C60 58 68 50 72 52 Z;
                      M68 48 C72 50 78 55 82 58 C86 61 88 65 86 70 C84 75 78 78 72 76 C66 74 60 68 58 62 C56 56 64 46 68 48 Z"
              dur="1.5s"
              repeatCount="indefinite"
            />
          )}
        </path>

        {/* Fist */}
        <ellipse
          cx="84"
          cy="62"
          rx="8"
          ry="10"
          fill="url(#muscleGradMain)"
          transform="rotate(25 84 62)"
        >
          {animated && (
            <animate
              attributeName="rx"
              values="8;9;8"
              dur="1.5s"
              repeatCount="indefinite"
            />
          )}
        </ellipse>
      </g>

      {/* Bicep highlight */}
      <ellipse
        cx="45"
        cy="42"
        rx="12"
        ry="8"
        fill="url(#muscleGradHighlight)"
        transform="rotate(-20 45 42)"
      >
        {animated && (
          <animate
            attributeName="rx"
            values="12;15;12"
            dur="1.5s"
            repeatCount="indefinite"
          />
        )}
      </ellipse>

      {/* Muscle definition lines */}
      <path
        d="M35 50 Q40 48 45 52"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M38 58 Q42 55 48 58"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.2"
      />

      {/* Strength sparkles */}
      {animated && (
        <>
          <circle cx="55" cy="25" r="2" fill="#fbbf24">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="1s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="1;3;1"
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="70" cy="32" r="1.5" fill="#fbbf24">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="1.2s"
              repeatCount="indefinite"
              begin="0.3s"
            />
            <animate
              attributeName="r"
              values="1;2.5;1"
              dur="1.2s"
              repeatCount="indefinite"
              begin="0.3s"
            />
          </circle>
          <circle cx="42" cy="28" r="1.5" fill="#fbbf24">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="0.9s"
              repeatCount="indefinite"
              begin="0.6s"
            />
          </circle>
        </>
      )}

      {/* Power lines */}
      {animated && (
        <>
          <line x1="30" y1="30" x2="25" y2="22" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
            <animate
              attributeName="opacity"
              values="0;0.8;0"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="50" y1="22" x2="50" y2="14" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
            <animate
              attributeName="opacity"
              values="0;0.8;0"
              dur="1.5s"
              repeatCount="indefinite"
              begin="0.2s"
            />
          </line>
          <line x1="68" y1="26" x2="74" y2="18" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
            <animate
              attributeName="opacity"
              values="0;0.8;0"
              dur="1.5s"
              repeatCount="indefinite"
              begin="0.4s"
            />
          </line>
        </>
      )}
    </svg>
  );
}

export default MuscleIcon;
