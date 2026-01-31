/**
 * FireIcon - Animated flame SVG icon
 * Part of Premium Icons Library - Phase 11.2
 */

import { cn } from '@/lib/utils';

export interface IconProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
}

const sizeMap = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

export function FireIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="fireGradOuter" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ff4500" />
          <stop offset="40%" stopColor="#ff6b00" />
          <stop offset="70%" stopColor="#ff8c00" />
          <stop offset="100%" stopColor="#ffd700" />
        </linearGradient>
        <linearGradient id="fireGradInner" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ff8c00" />
          <stop offset="50%" stopColor="#ffb347" />
          <stop offset="100%" stopColor="#fffacd" />
        </linearGradient>
        <filter id="fireGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer flame */}
      <path
        d="M50 10 C30 35 15 50 15 70 C15 88 30 98 50 98 C70 98 85 88 85 70 C85 50 70 35 50 10 Z"
        fill="url(#fireGradOuter)"
        filter="url(#fireGlow)"
      >
        {animated && (
          <>
            <animate
              attributeName="d"
              values="
                M50 10 C30 35 15 50 15 70 C15 88 30 98 50 98 C70 98 85 88 85 70 C85 50 70 35 50 10 Z;
                M50 8 C28 33 12 52 12 70 C12 90 32 100 50 100 C68 100 88 90 88 70 C88 52 72 33 50 8 Z;
                M50 12 C32 37 18 48 18 68 C18 86 28 96 50 96 C72 96 82 86 82 68 C82 48 68 37 50 12 Z;
                M50 10 C30 35 15 50 15 70 C15 88 30 98 50 98 C70 98 85 88 85 70 C85 50 70 35 50 10 Z
              "
              dur="0.6s"
              repeatCount="indefinite"
            />
          </>
        )}
      </path>

      {/* Inner flame */}
      <path
        d="M50 35 C40 50 30 60 30 75 C30 88 40 93 50 93 C60 93 70 88 70 75 C70 60 60 50 50 35 Z"
        fill="url(#fireGradInner)"
        opacity="0.9"
      >
        {animated && (
          <>
            <animate
              attributeName="d"
              values="
                M50 35 C40 50 30 60 30 75 C30 88 40 93 50 93 C60 93 70 88 70 75 C70 60 60 50 50 35 Z;
                M50 32 C38 48 28 62 28 77 C28 90 42 95 50 95 C58 95 72 90 72 77 C72 62 62 48 50 32 Z;
                M50 38 C42 52 32 58 32 73 C32 86 38 91 50 91 C62 91 68 86 68 73 C68 58 58 52 50 38 Z;
                M50 35 C40 50 30 60 30 75 C30 88 40 93 50 93 C60 93 70 88 70 75 C70 60 60 50 50 35 Z
              "
              dur="0.5s"
              repeatCount="indefinite"
            />
          </>
        )}
      </path>

      {/* Core bright spot */}
      <ellipse cx="50" cy="80" rx="12" ry="8" fill="#fff9e6" opacity="0.8">
        {animated && (
          <>
            <animate
              attributeName="rx"
              values="12;14;10;12"
              dur="0.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="ry"
              values="8;10;6;8"
              dur="0.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.8;1;0.6;0.8"
              dur="0.4s"
              repeatCount="indefinite"
            />
          </>
        )}
      </ellipse>

      {/* Sparks */}
      {animated && (
        <>
          <circle cx="35" cy="30" r="2" fill="#ffd700">
            <animate
              attributeName="cy"
              values="30;15;30"
              dur="1s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="1;0;1"
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="65" cy="25" r="1.5" fill="#ffb347">
            <animate
              attributeName="cy"
              values="25;10;25"
              dur="0.8s"
              repeatCount="indefinite"
              begin="0.3s"
            />
            <animate
              attributeName="opacity"
              values="1;0;1"
              dur="0.8s"
              repeatCount="indefinite"
              begin="0.3s"
            />
          </circle>
          <circle cx="50" cy="20" r="1" fill="#fff">
            <animate
              attributeName="cy"
              values="20;5;20"
              dur="1.2s"
              repeatCount="indefinite"
              begin="0.5s"
            />
            <animate
              attributeName="opacity"
              values="0.8;0;0.8"
              dur="1.2s"
              repeatCount="indefinite"
              begin="0.5s"
            />
          </circle>
        </>
      )}
    </svg>
  );
}

export default FireIcon;
