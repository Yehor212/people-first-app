/**
 * CelebrationIcon - Animated party popper with confetti SVG icon
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

export function CelebrationIcon({ size = 'md', animated = true, className }: IconProps) {
  const s = sizeMap[size];

  return (
    <svg
      viewBox="0 0 100 100"
      width={s}
      height={s}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <linearGradient id="celebrateGradCone" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="celebrateGradRed" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <linearGradient id="celebrateGradBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="celebrateGradGreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
        <linearGradient id="celebrateGradPurple" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <filter id="celebrateGlow">
          <feGaussianBlur stdDeviation="1" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Party popper cone */}
      <path
        d="M75 85 L55 45 L45 55 Z"
        fill="url(#celebrateGradCone)"
        filter="url(#celebrateGlow)"
      >
        {animated && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 60 65;-3 60 65;3 60 65;0 60 65"
            dur="0.5s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Cone stripes */}
      <path
        d="M68 72 L58 52 L54 56 Z"
        fill="#d97706"
        opacity="0.5"
      />

      {/* Confetti burst - large pieces */}
      <g filter="url(#celebrateGlow)">
        {/* Red confetti */}
        <rect x="35" y="25" width="6" height="4" rx="1" fill="url(#celebrateGradRed)">
          {animated && (
            <>
              <animate attributeName="x" values="35;25;35" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="y" values="25;15;25" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.7;1" dur="1.5s" repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="rotate" values="0;180;360" dur="1.5s" repeatCount="indefinite" additive="sum" />
            </>
          )}
        </rect>

        {/* Blue confetti */}
        <rect x="50" y="20" width="5" height="3" rx="1" fill="url(#celebrateGradBlue)">
          {animated && (
            <>
              <animate attributeName="x" values="50;55;50" dur="1.3s" repeatCount="indefinite" begin="0.2s" />
              <animate attributeName="y" values="20;10;20" dur="1.3s" repeatCount="indefinite" begin="0.2s" />
              <animate attributeName="opacity" values="1;0.6;1" dur="1.3s" repeatCount="indefinite" begin="0.2s" />
              <animateTransform attributeName="transform" type="rotate" values="0;-180;-360" dur="1.3s" repeatCount="indefinite" begin="0.2s" additive="sum" />
            </>
          )}
        </rect>

        {/* Green confetti */}
        <rect x="25" y="35" width="5" height="4" rx="1" fill="url(#celebrateGradGreen)">
          {animated && (
            <>
              <animate attributeName="x" values="25;15;25" dur="1.4s" repeatCount="indefinite" begin="0.4s" />
              <animate attributeName="y" values="35;30;35" dur="1.4s" repeatCount="indefinite" begin="0.4s" />
              <animate attributeName="opacity" values="1;0.5;1" dur="1.4s" repeatCount="indefinite" begin="0.4s" />
              <animateTransform attributeName="transform" type="rotate" values="0;270;540" dur="1.4s" repeatCount="indefinite" begin="0.4s" additive="sum" />
            </>
          )}
        </rect>

        {/* Purple confetti */}
        <rect x="55" y="30" width="4" height="5" rx="1" fill="url(#celebrateGradPurple)">
          {animated && (
            <>
              <animate attributeName="x" values="55;65;55" dur="1.6s" repeatCount="indefinite" begin="0.1s" />
              <animate attributeName="y" values="30;20;30" dur="1.6s" repeatCount="indefinite" begin="0.1s" />
              <animate attributeName="opacity" values="1;0.8;1" dur="1.6s" repeatCount="indefinite" begin="0.1s" />
              <animateTransform attributeName="transform" type="rotate" values="0;-270;-540" dur="1.6s" repeatCount="indefinite" begin="0.1s" additive="sum" />
            </>
          )}
        </rect>

        {/* Yellow confetti */}
        <rect x="40" y="15" width="4" height="3" rx="1" fill="#fbbf24">
          {animated && (
            <>
              <animate attributeName="x" values="40;38;40" dur="1.2s" repeatCount="indefinite" begin="0.3s" />
              <animate attributeName="y" values="15;8;15" dur="1.2s" repeatCount="indefinite" begin="0.3s" />
              <animate attributeName="opacity" values="1;0.6;1" dur="1.2s" repeatCount="indefinite" begin="0.3s" />
              <animateTransform attributeName="transform" type="rotate" values="0;360;720" dur="1.2s" repeatCount="indefinite" begin="0.3s" additive="sum" />
            </>
          )}
        </rect>
      </g>

      {/* Streamers */}
      <path
        d="M45 50 Q35 40 30 45 Q25 50 20 42"
        fill="none"
        stroke="url(#celebrateGradRed)"
        strokeWidth="3"
        strokeLinecap="round"
      >
        {animated && (
          <animate
            attributeName="d"
            values="M45 50 Q35 40 30 45 Q25 50 20 42;
                    M45 50 Q33 38 28 43 Q22 48 17 40;
                    M45 50 Q35 40 30 45 Q25 50 20 42"
            dur="0.8s"
            repeatCount="indefinite"
          />
        )}
      </path>

      <path
        d="M50 42 Q55 30 52 22 Q49 14 55 10"
        fill="none"
        stroke="url(#celebrateGradBlue)"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        {animated && (
          <animate
            attributeName="d"
            values="M50 42 Q55 30 52 22 Q49 14 55 10;
                    M50 42 Q57 28 54 20 Q51 12 58 8;
                    M50 42 Q55 30 52 22 Q49 14 55 10"
            dur="0.9s"
            repeatCount="indefinite"
          />
        )}
      </path>

      <path
        d="M55 48 Q65 42 70 35 Q75 28 82 32"
        fill="none"
        stroke="url(#celebrateGradGreen)"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        {animated && (
          <animate
            attributeName="d"
            values="M55 48 Q65 42 70 35 Q75 28 82 32;
                    M55 48 Q67 40 72 33 Q77 26 85 30;
                    M55 48 Q65 42 70 35 Q75 28 82 32"
            dur="0.7s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Small dots / sparkle confetti */}
      {animated && (
        <>
          <circle cx="30" cy="28" r="2" fill="#f87171">
            <animate attributeName="opacity" values="0;1;0" dur="1s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="18" r="1.5" fill="#60a5fa">
            <animate attributeName="opacity" values="0;1;0" dur="1.1s" repeatCount="indefinite" begin="0.2s" />
          </circle>
          <circle cx="22" cy="45" r="1.5" fill="#4ade80">
            <animate attributeName="opacity" values="0;1;0" dur="0.9s" repeatCount="indefinite" begin="0.4s" />
          </circle>
          <circle cx="70" cy="28" r="2" fill="#c084fc">
            <animate attributeName="opacity" values="0;1;0" dur="1.2s" repeatCount="indefinite" begin="0.6s" />
          </circle>
          <circle cx="42" cy="12" r="1.5" fill="#fbbf24">
            <animate attributeName="opacity" values="0;1;0" dur="0.8s" repeatCount="indefinite" begin="0.3s" />
          </circle>
        </>
      )}

      {/* Stars */}
      {animated && (
        <>
          <path d="M18 55 L20 58 L24 58 L21 60 L22 64 L18 62 L14 64 L15 60 L12 58 L16 58 Z" fill="#fbbf24">
            <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" begin="0.5s" />
            <animateTransform attributeName="transform" type="scale" values="0.8;1.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.5s" additive="sum" />
          </path>
          <path d="M75 45 L77 48 L81 48 L78 50 L79 54 L75 52 L71 54 L72 50 L69 48 L73 48 Z" fill="#60a5fa">
            <animate attributeName="opacity" values="0;1;0" dur="1.3s" repeatCount="indefinite" begin="0.8s" />
            <animateTransform attributeName="transform" type="scale" values="0.8;1.1;0.8" dur="1.3s" repeatCount="indefinite" begin="0.8s" additive="sum" />
          </path>
        </>
      )}
    </svg>
  );
}

export default CelebrationIcon;
