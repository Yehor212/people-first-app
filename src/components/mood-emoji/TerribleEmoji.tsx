import { cn } from '@/lib/utils';

interface EmojiProps {
  size: string;
  isSelected?: boolean;
}

// Terrible mood - Deeply sad crying face
export function TerribleEmoji({ size, isSelected }: EmojiProps) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="terribleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E9ECEF" />
          <stop offset="50%" stopColor="#DEE2E6" />
          <stop offset="100%" stopColor="#CED4DA" />
        </linearGradient>
        <linearGradient id="terribleShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <filter id="terribleShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#495057" floodOpacity="0.3"/>
        </filter>
        <linearGradient id="tearGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#74C0FC" />
          <stop offset="100%" stopColor="#339AF0" />
        </linearGradient>
      </defs>

      {/* Main face */}
      <circle cx="50" cy="50" r="44" fill="url(#terribleGrad)" filter={isSelected ? "url(#terribleShadow)" : undefined}>
        <animate attributeName="cx" values="50;51;50;49;50" dur="0.8s" repeatCount="indefinite" />
      </circle>

      {/* Shine */}
      <ellipse cx="35" cy="35" rx="25" ry="20" fill="url(#terribleShine)" />

      {/* Very sad eyebrows */}
      <path d="M22 32 L42 40" fill="none" stroke="#495057" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M58 40 L78 32" fill="none" stroke="#495057" strokeWidth="2.5" strokeLinecap="round" />

      {/* Closed crying eyes */}
      <path d="M26 46 Q35 40 44 46" fill="none" stroke="#495057" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M26 46 Q35 40 44 46;M26 48 Q35 42 44 48;M26 46 Q35 40 44 46" dur="1.2s" repeatCount="indefinite" />
      </path>
      <path d="M56 46 Q65 40 74 46" fill="none" stroke="#495057" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M56 46 Q65 40 74 46;M56 48 Q65 42 74 48;M56 46 Q65 40 44 46" dur="1.2s" repeatCount="indefinite" />
      </path>

      {/* Tears - left side */}
      <ellipse cx="30" cy="55" rx="4" ry="10" fill="url(#tearGrad)" opacity="0.8">
        <animate attributeName="cy" values="55;72;55" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="38" cy="58" rx="3" ry="7" fill="url(#tearGrad)" opacity="0.6">
        <animate attributeName="cy" values="58;78;58" dur="1.8s" repeatCount="indefinite" begin="0.4s" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="1.8s" repeatCount="indefinite" begin="0.4s" />
      </ellipse>

      {/* Tears - right side */}
      <ellipse cx="70" cy="55" rx="4" ry="10" fill="url(#tearGrad)" opacity="0.8">
        <animate attributeName="cy" values="55;72;55" dur="1.5s" repeatCount="indefinite" begin="0.2s" />
        <animate attributeName="opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite" begin="0.2s" />
      </ellipse>
      <ellipse cx="62" cy="58" rx="3" ry="7" fill="url(#tearGrad)" opacity="0.6">
        <animate attributeName="cy" values="58;78;58" dur="1.8s" repeatCount="indefinite" begin="0.6s" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="1.8s" repeatCount="indefinite" begin="0.6s" />
      </ellipse>

      {/* Open crying mouth */}
      <ellipse cx="50" cy="72" rx="14" ry="9" fill="#495057">
        <animate attributeName="ry" values="9;11;9" dur="1s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="50" cy="70" rx="10" ry="5" fill="#ADB5BD" />

      {/* Sob motion lines */}
      <g opacity="0.3">
        <path d="M12 55 L8 65" stroke="#495057" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="0.6s" repeatCount="indefinite" />
        </path>
        <path d="M88 55 L92 65" stroke="#495057" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="0.6s" repeatCount="indefinite" begin="0.2s" />
        </path>
      </g>
    </svg>
  );
}
