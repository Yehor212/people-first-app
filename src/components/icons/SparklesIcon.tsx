/**
 * SparklesIcon - Animated sparkling stars SVG icon
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

export function SparklesIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="sparkleGradGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="sparkleGradSilver" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#e5e7eb" />
          <stop offset="100%" stopColor="#d1d5db" />
        </linearGradient>
        <filter id="sparkleGlow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="sparkleGlowStrong">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main large sparkle - center */}
      <g filter="url(#sparkleGlowStrong)">
        <path
          d="M50 25 L53 45 L73 50 L53 55 L50 75 L47 55 L27 50 L47 45 Z"
          fill="url(#sparkleGradGold)"
        >
          {animated && (
            <>
              <animate
                attributeName="d"
                values="M50 25 L53 45 L73 50 L53 55 L50 75 L47 55 L27 50 L47 45 Z;
                        M50 20 L54 44 L78 50 L54 56 L50 80 L46 56 L22 50 L46 44 Z;
                        M50 25 L53 45 L73 50 L53 55 L50 75 L47 55 L27 50 L47 45 Z"
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
        </path>
        {/* Center highlight */}
        <circle cx="50" cy="50" r="4" fill="#fff" opacity="0.9">
          {animated && (
            <animate
              attributeName="r"
              values="3;5;3"
              dur="1.5s"
              repeatCount="indefinite"
            />
          )}
        </circle>
      </g>

      {/* Top-left sparkle */}
      <g filter="url(#sparkleGlow)">
        <path
          d="M25 20 L27 28 L35 30 L27 32 L25 40 L23 32 L15 30 L23 28 Z"
          fill="url(#sparkleGradSilver)"
        >
          {animated && (
            <>
              <animate
                attributeName="opacity"
                values="0.6;1;0.6"
                dur="1.2s"
                repeatCount="indefinite"
                begin="0.2s"
              />
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1;1.2;1"
                dur="1.2s"
                repeatCount="indefinite"
                begin="0.2s"
                additive="sum"
              />
            </>
          )}
        </path>
      </g>

      {/* Top-right sparkle */}
      <g filter="url(#sparkleGlow)">
        <path
          d="M75 15 L77 23 L85 25 L77 27 L75 35 L73 27 L65 25 L73 23 Z"
          fill="url(#sparkleGradGold)"
        >
          {animated && (
            <>
              <animate
                attributeName="opacity"
                values="0.7;1;0.7"
                dur="1s"
                repeatCount="indefinite"
                begin="0.5s"
              />
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1;1.15;1"
                dur="1s"
                repeatCount="indefinite"
                begin="0.5s"
                additive="sum"
              />
            </>
          )}
        </path>
      </g>

      {/* Bottom-left sparkle */}
      <g filter="url(#sparkleGlow)">
        <path
          d="M20 65 L22 73 L30 75 L22 77 L20 85 L18 77 L10 75 L18 73 Z"
          fill="url(#sparkleGradGold)"
        >
          {animated && (
            <>
              <animate
                attributeName="opacity"
                values="0.5;1;0.5"
                dur="1.3s"
                repeatCount="indefinite"
                begin="0.8s"
              />
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1;1.25;1"
                dur="1.3s"
                repeatCount="indefinite"
                begin="0.8s"
                additive="sum"
              />
            </>
          )}
        </path>
      </g>

      {/* Bottom-right sparkle */}
      <g filter="url(#sparkleGlow)">
        <path
          d="M80 70 L82 78 L90 80 L82 82 L80 90 L78 82 L70 80 L78 78 Z"
          fill="url(#sparkleGradSilver)"
        >
          {animated && (
            <>
              <animate
                attributeName="opacity"
                values="0.6;1;0.6"
                dur="1.1s"
                repeatCount="indefinite"
                begin="0.3s"
              />
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1;1.2;1"
                dur="1.1s"
                repeatCount="indefinite"
                begin="0.3s"
                additive="sum"
              />
            </>
          )}
        </path>
      </g>

      {/* Floating micro particles */}
      {animated && (
        <>
          <circle cx="35" cy="45" r="2" fill="#fde047">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="45;40;45"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="65" cy="55" r="1.5" fill="#fde047">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="1.8s"
              repeatCount="indefinite"
              begin="0.4s"
            />
            <animate
              attributeName="cy"
              values="55;50;55"
              dur="1.8s"
              repeatCount="indefinite"
              begin="0.4s"
            />
          </circle>
          <circle cx="45" cy="65" r="1.5" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;0.8;0"
              dur="1.6s"
              repeatCount="indefinite"
              begin="0.7s"
            />
            <animate
              attributeName="cx"
              values="45;48;45"
              dur="1.6s"
              repeatCount="indefinite"
              begin="0.7s"
            />
          </circle>
          <circle cx="55" cy="35" r="1" fill="#fff">
            <animate
              attributeName="opacity"
              values="0;0.9;0"
              dur="1.4s"
              repeatCount="indefinite"
              begin="1s"
            />
            <animate
              attributeName="cx"
              values="55;52;55"
              dur="1.4s"
              repeatCount="indefinite"
              begin="1s"
            />
          </circle>
        </>
      )}

      {/* Subtle ring burst */}
      {animated && (
        <circle
          cx="50"
          cy="50"
          r="20"
          fill="none"
          stroke="#fde047"
          strokeWidth="1"
          opacity="0"
        >
          <animate
            attributeName="r"
            values="15;35"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.5;0"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
  );
}

export default SparklesIcon;
