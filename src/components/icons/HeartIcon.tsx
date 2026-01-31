/**
 * HeartIcon - Pulsing heart SVG icon
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

export function HeartIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff6b6b" />
          <stop offset="50%" stopColor="#ee5a5a" />
          <stop offset="100%" stopColor="#e63946" />
        </linearGradient>
        <linearGradient id="heartShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="heartGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main heart shape */}
      <path
        d="M50 88 C20 65 5 45 5 30 C5 15 18 5 32 5 C42 5 50 12 50 12 C50 12 58 5 68 5 C82 5 95 15 95 30 C95 45 80 65 50 88 Z"
        fill="url(#heartGrad)"
        filter="url(#heartGlow)"
      >
        {animated && (
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1;1.08;1;1.05;1"
            dur="1s"
            repeatCount="indefinite"
            additive="sum"
          />
        )}
      </path>

      {/* Shine overlay */}
      <path
        d="M50 88 C20 65 5 45 5 30 C5 15 18 5 32 5 C42 5 50 12 50 12 C50 12 58 5 68 5 C82 5 95 15 95 30 C95 45 80 65 50 88 Z"
        fill="url(#heartShine)"
      />

      {/* Highlight spots */}
      <ellipse cx="28" cy="28" rx="8" ry="10" fill="#fff" opacity="0.3" transform="rotate(-30 28 28)" />
      <ellipse cx="72" cy="28" rx="6" ry="8" fill="#fff" opacity="0.2" transform="rotate(30 72 28)" />

      {/* Sparkles */}
      {animated && (
        <>
          <circle cx="25" cy="20" r="2" fill="#fff">
            <animate
              attributeName="opacity"
              values="0.5;1;0.5"
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="75" cy="22" r="1.5" fill="#fff">
            <animate
              attributeName="opacity"
              values="0.5;1;0.5"
              dur="1.2s"
              repeatCount="indefinite"
              begin="0.3s"
            />
          </circle>
        </>
      )}
    </svg>
  );
}

export default HeartIcon;
