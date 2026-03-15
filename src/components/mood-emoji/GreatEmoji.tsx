import { cn } from '@/lib/utils';

interface EmojiProps {
  size: string;
  isSelected?: boolean;
}

// Great mood - Radiant joyful face with sparkles
export function GreatEmoji({ size, isSelected }: EmojiProps) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="greatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="50%" stopColor="#FFD43B" />
          <stop offset="100%" stopColor="#FCC419" />
        </linearGradient>
        <linearGradient id="greatShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <filter id="greatShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#F59F00" floodOpacity="0.4"/>
        </filter>
      </defs>

      {/* Main face */}
      <circle cx="50" cy="50" r="44" fill="url(#greatGrad)" filter={isSelected ? "url(#greatShadow)" : undefined}>
        <animate attributeName="r" values="44;46;44" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Shine overlay */}
      <ellipse cx="35" cy="35" rx="25" ry="20" fill="url(#greatShine)" />

      {/* Happy eyes - curved arcs */}
      <g>
        <path d="M28 42 Q35 32 42 42" fill="none" stroke="#E67700" strokeWidth="4" strokeLinecap="round">
          <animate attributeName="d" values="M28 42 Q35 32 42 42;M28 40 Q35 30 42 40;M28 42 Q35 32 42 42" dur="1.5s" repeatCount="indefinite" />
        </path>
        <path d="M58 42 Q65 32 72 42" fill="none" stroke="#E67700" strokeWidth="4" strokeLinecap="round">
          <animate attributeName="d" values="M58 42 Q65 32 72 42;M58 40 Q65 30 72 40;M58 42 Q65 32 72 42" dur="1.5s" repeatCount="indefinite" />
        </path>
      </g>

      {/* Big smile with teeth */}
      <path d="M25 58 Q50 82 75 58" fill="#E67700" opacity="0.9">
        <animate attributeName="d" values="M25 58 Q50 82 75 58;M25 60 Q50 85 75 60;M25 58 Q50 82 75 58" dur="1.5s" repeatCount="indefinite" />
      </path>
      <path d="M28 60 Q50 75 72 60" fill="#FFF">
        <animate attributeName="d" values="M28 60 Q50 75 72 60;M28 62 Q50 78 72 62;M28 60 Q50 75 72 60" dur="1.5s" repeatCount="indefinite" />
      </path>

      {/* Rosy cheeks */}
      <ellipse cx="22" cy="55" rx="9" ry="6" fill="#FF922B" opacity="0.35">
        <animate attributeName="opacity" values="0.35;0.5;0.35" dur="2s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="78" cy="55" rx="9" ry="6" fill="#FF922B" opacity="0.35">
        <animate attributeName="opacity" values="0.35;0.5;0.35" dur="2s" repeatCount="indefinite" begin="0.3s" />
      </ellipse>

      {/* Sparkles */}
      <g>
        <path d="M12 18 L14 24 L20 24 L15 28 L17 34 L12 30 L7 34 L9 28 L4 24 L10 24 Z" fill="#FFD43B">
          <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="scale" values="1;1.2;1" dur="1s" repeatCount="indefinite" additive="sum" />
        </path>
        <path d="M88 22 L89 26 L93 26 L90 29 L91 33 L88 30 L85 33 L86 29 L83 26 L87 26 Z" fill="#FFD43B">
          <animate attributeName="opacity" values="1;0.4;1" dur="0.8s" repeatCount="indefinite" begin="0.3s" />
          <animateTransform attributeName="transform" type="scale" values="1;1.2;1" dur="0.8s" repeatCount="indefinite" begin="0.3s" additive="sum" />
        </path>
        <circle cx="92" cy="65" r="4" fill="#FFE066">
          <animate attributeName="r" values="4;6;4" dur="1.2s" repeatCount="indefinite" begin="0.5s" />
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.2s" repeatCount="indefinite" begin="0.5s" />
        </circle>
      </g>
    </svg>
  );
}
