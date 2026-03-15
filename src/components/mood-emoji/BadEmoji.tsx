import { cn } from '@/lib/utils';

interface EmojiProps {
  size: string;
  isSelected?: boolean;
}

// Bad mood - Sad worried face
export function BadEmoji({ size, isSelected }: EmojiProps) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="badGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFC9C9" />
          <stop offset="50%" stopColor="#FFA8A8" />
          <stop offset="100%" stopColor="#FF8787" />
        </linearGradient>
        <linearGradient id="badShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <filter id="badShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#E03131" floodOpacity="0.3"/>
        </filter>
      </defs>

      {/* Main face */}
      <circle cx="50" cy="50" r="44" fill="url(#badGrad)" filter={isSelected ? "url(#badShadow)" : undefined}>
        <animate attributeName="cy" values="50;52;50" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* Shine */}
      <ellipse cx="35" cy="35" rx="25" ry="20" fill="url(#badShine)" />

      {/* Worried eyebrows */}
      <path d="M24 35 L42 42" fill="none" stroke="#C92A2A" strokeWidth="2.5" strokeLinecap="round">
        <animate attributeName="d" values="M24 35 L42 42;M24 33 L42 40;M24 35 L42 42" dur="3s" repeatCount="indefinite" />
      </path>
      <path d="M58 42 L76 35" fill="none" stroke="#C92A2A" strokeWidth="2.5" strokeLinecap="round">
        <animate attributeName="d" values="M58 42 L76 35;M58 40 L76 33;M58 42 L76 35" dur="3s" repeatCount="indefinite" />
      </path>

      {/* Sad droopy eyes */}
      <ellipse cx="35" cy="48" rx="5" ry="6" fill="#C92A2A">
        <animate attributeName="ry" values="6;5;6" dur="4s" repeatCount="indefinite" />
      </ellipse>
      <circle cx="33" cy="46" r="1.5" fill="#FFF" opacity="0.6" />

      <ellipse cx="65" cy="48" rx="5" ry="6" fill="#C92A2A">
        <animate attributeName="ry" values="6;5;6" dur="4s" repeatCount="indefinite" begin="0.3s" />
      </ellipse>
      <circle cx="63" cy="46" r="1.5" fill="#FFF" opacity="0.6" />

      {/* Sad frown */}
      <path d="M32 72 Q50 60 68 72" fill="none" stroke="#C92A2A" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M32 72 Q50 60 68 72;M32 74 Q50 62 68 74;M32 72 Q50 60 68 72" dur="3s" repeatCount="indefinite" />
      </path>

      {/* Sweat drop */}
      <ellipse cx="80" cy="38" rx="3" ry="6" fill="#74C0FC" opacity="0.7">
        <animate attributeName="cy" values="38;45;38" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2s" repeatCount="indefinite" />
      </ellipse>
    </svg>
  );
}
