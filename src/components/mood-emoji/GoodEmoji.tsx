import { cn } from '@/lib/utils';

interface EmojiProps {
  size: string;
  isSelected?: boolean;
}

// Good mood - Content peaceful smile
export function GoodEmoji({ size, isSelected }: EmojiProps) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="goodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8CE99A" />
          <stop offset="50%" stopColor="#69DB7C" />
          <stop offset="100%" stopColor="#51CF66" />
        </linearGradient>
        <linearGradient id="goodShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <filter id="goodShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#37B24D" floodOpacity="0.4"/>
        </filter>
      </defs>

      {/* Main face */}
      <circle cx="50" cy="50" r="44" fill="url(#goodGrad)" filter={isSelected ? "url(#goodShadow)" : undefined}>
        <animate attributeName="cy" values="50;48;50" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* Shine */}
      <ellipse cx="35" cy="35" rx="25" ry="20" fill="url(#goodShine)" />

      {/* Relaxed happy eyes */}
      <g>
        <ellipse cx="35" cy="42" rx="6" ry="6" fill="#2F9E44">
          <animate attributeName="ry" values="6;2;6" dur="4s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="33" cy="40" r="2" fill="#FFF" opacity="0.7" />
      </g>
      <g>
        <ellipse cx="65" cy="42" rx="6" ry="6" fill="#2F9E44">
          <animate attributeName="ry" values="6;2;6" dur="4s" repeatCount="indefinite" begin="0.1s" />
        </ellipse>
        <circle cx="63" cy="40" r="2" fill="#FFF" opacity="0.7" />
      </g>

      {/* Gentle smile */}
      <path d="M32 62 Q50 76 68 62" fill="none" stroke="#2F9E44" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M32 62 Q50 76 68 62;M32 64 Q50 78 68 64;M32 62 Q50 76 68 62" dur="3s" repeatCount="indefinite" />
      </path>

      {/* Soft blush */}
      <ellipse cx="24" cy="54" rx="8" ry="5" fill="#40C057" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.55;0.4" dur="3s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="76" cy="54" rx="8" ry="5" fill="#40C057" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.55;0.4" dur="3s" repeatCount="indefinite" begin="0.5s" />
      </ellipse>

      {/* Floating leaf */}
      <g>
        <ellipse cx="88" cy="20" rx="6" ry="10" fill="#69DB7C" transform="rotate(-30 88 20)">
          <animateTransform attributeName="transform" type="translate" values="0,0;-3,5;0,0" dur="4s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" values="-30 88 20;-20 88 20;-30 88 20" dur="4s" repeatCount="indefinite" additive="sum" />
        </ellipse>
        <path d="M88 15 L88 28" stroke="#51CF66" strokeWidth="1.5" fill="none">
          <animateTransform attributeName="transform" type="translate" values="0,0;-3,5;0,0" dur="4s" repeatCount="indefinite" />
        </path>
      </g>
    </svg>
  );
}
