import { cn } from '@/lib/utils';

interface EmojiProps {
  size: string;
  isSelected?: boolean;
}

// Okay mood - Thoughtful neutral face
export function OkayEmoji({ size, isSelected }: EmojiProps) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="okayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE8CC" />
          <stop offset="50%" stopColor="#FFD8A8" />
          <stop offset="100%" stopColor="#FFC078" />
        </linearGradient>
        <linearGradient id="okayShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <filter id="okayShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#F08C00" floodOpacity="0.3"/>
        </filter>
      </defs>

      {/* Main face */}
      <circle cx="50" cy="50" r="44" fill="url(#okayGrad)" filter={isSelected ? "url(#okayShadow)" : undefined}>
        <animate attributeName="cx" values="50;51;50;49;50" dur="5s" repeatCount="indefinite" />
      </circle>

      {/* Shine */}
      <ellipse cx="35" cy="35" rx="25" ry="20" fill="url(#okayShine)" />

      {/* Slightly raised eyebrows */}
      <path d="M26 34 Q35 30 44 34" fill="none" stroke="#E8590C" strokeWidth="2.5" strokeLinecap="round">
        <animate attributeName="d" values="M26 34 Q35 30 44 34;M26 32 Q35 28 44 32;M26 34 Q35 30 44 34" dur="4s" repeatCount="indefinite" />
      </path>
      <path d="M56 34 Q65 30 74 34" fill="none" stroke="#E8590C" strokeWidth="2.5" strokeLinecap="round">
        <animate attributeName="d" values="M56 34 Q65 30 74 34;M56 32 Q65 28 74 32;M56 34 Q65 30 74 34" dur="4s" repeatCount="indefinite" />
      </path>

      {/* Looking-around eyes */}
      <g>
        <circle cx="35" cy="45" r="8" fill="#FFF" />
        <circle cx="35" cy="45" r="5" fill="#D9480F">
          <animate attributeName="cx" values="35;37;35;33;35" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="33" cy="43" r="2" fill="#FFF" opacity="0.8" />
      </g>
      <g>
        <circle cx="65" cy="45" r="8" fill="#FFF" />
        <circle cx="65" cy="45" r="5" fill="#D9480F">
          <animate attributeName="cx" values="65;67;65;63;65" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="63" cy="43" r="2" fill="#FFF" opacity="0.8" />
      </g>

      {/* Neutral wavy mouth */}
      <path d="M35 65 Q50 67 65 65" fill="none" stroke="#D9480F" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M35 65 Q50 67 65 65;M35 65 Q50 63 65 65;M35 65 Q50 67 65 65" dur="4s" repeatCount="indefinite" />
      </path>

      {/* Thinking dots */}
      <g opacity="0.5">
        <circle cx="85" cy="30" r="3" fill="#FFD8A8">
          <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="92" cy="22" r="2.5" fill="#FFD8A8">
          <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite" begin="0.3s" />
        </circle>
        <circle cx="96" cy="15" r="2" fill="#FFD8A8">
          <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite" begin="0.6s" />
        </circle>
      </g>
    </svg>
  );
}
