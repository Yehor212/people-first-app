/**
 * Cool emotion SVG emojis: Fear, Sadness, Disgust, Anger
 * Each is a self-contained animated SVG component
 */

import { cn } from '@/lib/utils';

// Fear - Worried teal face with wide eyes
export function FearEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="fearGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#99F6E4" />
          <stop offset="50%" stopColor="#5EEAD4" />
          <stop offset="100%" stopColor="#2DD4BF" />
        </linearGradient>
        <linearGradient id="fearShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <filter id="fearShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0D9488" floodOpacity="0.4"/>
        </filter>
      </defs>

      {/* Main face with trembling */}
      <circle cx="50" cy="50" r="44" fill="url(#fearGrad)" filter={isSelected ? "url(#fearShadow)" : undefined}>
        <animate attributeName="cx" values="50;51;49;50" dur="0.3s" repeatCount="indefinite" />
      </circle>

      {/* Shine */}
      <ellipse cx="35" cy="35" rx="25" ry="20" fill="url(#fearShine)" />

      {/* Raised worried eyebrows */}
      <path d="M24 32 Q35 26 46 32" fill="none" stroke="#0F766E" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="d" values="M24 32 Q35 26 46 32;M24 30 Q35 24 46 30;M24 32 Q35 26 46 32" dur="0.5s" repeatCount="indefinite" />
      </path>
      <path d="M54 32 Q65 26 76 32" fill="none" stroke="#0F766E" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="d" values="M54 32 Q65 26 76 32;M54 30 Q65 24 76 30;M54 32 Q65 26 76 32" dur="0.5s" repeatCount="indefinite" />
      </path>

      {/* Wide scared eyes */}
      <g>
        <circle cx="35" cy="46" r="10" fill="#FFF" />
        <circle cx="35" cy="46" r="6" fill="#0F766E">
          <animate attributeName="r" values="6;7;6" dur="0.4s" repeatCount="indefinite" />
        </circle>
        <circle cx="33" cy="44" r="2" fill="#FFF" />
      </g>
      <g>
        <circle cx="65" cy="46" r="10" fill="#FFF" />
        <circle cx="65" cy="46" r="6" fill="#0F766E">
          <animate attributeName="r" values="6;7;6" dur="0.4s" repeatCount="indefinite" begin="0.1s" />
        </circle>
        <circle cx="63" cy="44" r="2" fill="#FFF" />
      </g>

      {/* Small worried mouth */}
      <ellipse cx="50" cy="68" rx="8" ry="5" fill="#0F766E">
        <animate attributeName="ry" values="5;6;5" dur="0.4s" repeatCount="indefinite" />
      </ellipse>

      {/* Sweat drops */}
      <ellipse cx="82" cy="40" rx="3" ry="6" fill="#67E8F9" opacity="0.8">
        <animate attributeName="cy" values="40;50;40" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="18" cy="45" rx="2" ry="4" fill="#67E8F9" opacity="0.6">
        <animate attributeName="cy" values="45;55;45" dur="1.8s" repeatCount="indefinite" begin="0.5s" />
        <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.8s" repeatCount="indefinite" begin="0.5s" />
      </ellipse>
    </svg>
  );
}

// Sadness - Melancholic indigo face with tears
export function SadnessEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="sadnessGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A5B4FC" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="sadnessShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sadTearGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <filter id="sadnessShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#4338CA" floodOpacity="0.4"/>
        </filter>
      </defs>

      {/* Main face */}
      <circle cx="50" cy="50" r="44" fill="url(#sadnessGrad)" filter={isSelected ? "url(#sadnessShadow)" : undefined}>
        <animate attributeName="cy" values="50;52;50" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* Shine */}
      <ellipse cx="35" cy="35" rx="25" ry="20" fill="url(#sadnessShine)" />

      {/* Sad droopy eyebrows */}
      <path d="M24 38 L44 44" fill="none" stroke="#3730A3" strokeWidth="3" strokeLinecap="round" />
      <path d="M56 44 L76 38" fill="none" stroke="#3730A3" strokeWidth="3" strokeLinecap="round" />

      {/* Sad eyes */}
      <g>
        <ellipse cx="35" cy="50" rx="6" ry="7" fill="#3730A3">
          <animate attributeName="ry" values="7;5;7" dur="3s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="33" cy="48" r="2" fill="#FFF" opacity="0.5" />
      </g>
      <g>
        <ellipse cx="65" cy="50" rx="6" ry="7" fill="#3730A3">
          <animate attributeName="ry" values="7;5;7" dur="3s" repeatCount="indefinite" begin="0.2s" />
        </ellipse>
        <circle cx="63" cy="48" r="2" fill="#FFF" opacity="0.5" />
      </g>

      {/* Sad frown */}
      <path d="M32 72 Q50 62 68 72" fill="none" stroke="#3730A3" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M32 72 Q50 62 68 72;M32 74 Q50 64 68 74;M32 72 Q50 62 68 72" dur="3s" repeatCount="indefinite" />
      </path>

      {/* Tears */}
      <ellipse cx="30" cy="58" rx="4" ry="8" fill="url(#sadTearGrad)" opacity="0.8">
        <animate attributeName="cy" values="58;75;58" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="70" cy="58" rx="4" ry="8" fill="url(#sadTearGrad)" opacity="0.8">
        <animate attributeName="cy" values="58;75;58" dur="2s" repeatCount="indefinite" begin="0.5s" />
        <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" begin="0.5s" />
      </ellipse>

      {/* Rain drops around */}
      <g opacity="0.4">
        <line x1="15" y1="15" x2="12" y2="25" stroke="#818CF8" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="y2" values="25;35;25" dur="1.5s" repeatCount="indefinite" />
        </line>
        <line x1="85" y1="20" x2="88" y2="30" stroke="#818CF8" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="y2" values="30;40;30" dur="1.8s" repeatCount="indefinite" begin="0.3s" />
        </line>
      </g>
    </svg>
  );
}

// Disgust - Purple face with scrunched nose
export function DisgustEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="disgustGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D8B4FE" />
          <stop offset="50%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id="disgustShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <filter id="disgustShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#7C3AED" floodOpacity="0.4"/>
        </filter>
      </defs>

      {/* Main face */}
      <circle cx="50" cy="50" r="44" fill="url(#disgustGrad)" filter={isSelected ? "url(#disgustShadow)" : undefined}>
        <animate attributeName="cx" values="50;51;50;49;50" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Shine */}
      <ellipse cx="35" cy="35" rx="25" ry="20" fill="url(#disgustShine)" />

      {/* Scrunched eyebrows */}
      <path d="M24 38 Q35 42 44 36" fill="none" stroke="#6B21A8" strokeWidth="3" strokeLinecap="round" />
      <path d="M56 36 Q65 42 76 38" fill="none" stroke="#6B21A8" strokeWidth="3" strokeLinecap="round" />

      {/* Squinting disgusted eyes */}
      <path d="M28 48 Q35 42 42 48" fill="none" stroke="#6B21A8" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M28 48 Q35 42 42 48;M28 46 Q35 40 42 46;M28 48 Q35 42 42 48" dur="2s" repeatCount="indefinite" />
      </path>
      <path d="M58 48 Q65 42 72 48" fill="none" stroke="#6B21A8" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M58 48 Q65 42 72 48;M58 46 Q65 40 72 46;M58 48 Q65 42 72 48" dur="2s" repeatCount="indefinite" />
      </path>

      {/* Scrunched nose */}
      <path d="M45 56 Q50 52 55 56" fill="none" stroke="#6B21A8" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="d" values="M45 56 Q50 52 55 56;M45 54 Q50 50 55 54;M45 56 Q50 52 55 56" dur="1.5s" repeatCount="indefinite" />
      </path>

      {/* Disgusted wavy mouth */}
      <path d="M30 68 Q40 72 50 66 Q60 60 70 68" fill="none" stroke="#6B21A8" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M30 68 Q40 72 50 66 Q60 60 70 68;M30 70 Q40 74 50 68 Q60 62 70 70;M30 68 Q40 72 50 66 Q60 60 70 68" dur="2s" repeatCount="indefinite" />
      </path>

      {/* Stink waves */}
      <g opacity="0.5">
        <path d="M82 30 Q85 25 82 20" fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="opacity" values="0.5;0.2;0.5" dur="1.5s" repeatCount="indefinite" />
        </path>
        <path d="M88 35 Q91 30 88 25" fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="opacity" values="0.5;0.2;0.5" dur="1.5s" repeatCount="indefinite" begin="0.3s" />
        </path>
      </g>
    </svg>
  );
}

// Anger - Red face with furrowed brows and fire
export function AngerEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="angerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FCA5A5" />
          <stop offset="50%" stopColor="#F87171" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
        <linearGradient id="angerShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fireGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#EF4444" />
          <stop offset="50%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>
        <filter id="angerShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#DC2626" floodOpacity="0.5"/>
        </filter>
      </defs>

      {/* Main face with shake */}
      <circle cx="50" cy="50" r="44" fill="url(#angerGrad)" filter={isSelected ? "url(#angerShadow)" : undefined}>
        <animate attributeName="cx" values="50;52;48;50" dur="0.2s" repeatCount="indefinite" />
      </circle>

      {/* Shine */}
      <ellipse cx="35" cy="35" rx="25" ry="20" fill="url(#angerShine)" />

      {/* Angry furrowed eyebrows */}
      <path d="M22 42 L44 34" fill="none" stroke="#991B1B" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M22 42 L44 34;M22 40 L44 32;M22 42 L44 34" dur="0.3s" repeatCount="indefinite" />
      </path>
      <path d="M56 34 L78 42" fill="none" stroke="#991B1B" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M56 34 L78 42;M56 32 L78 40;M56 34 L78 42" dur="0.3s" repeatCount="indefinite" />
      </path>

      {/* Angry narrowed eyes */}
      <g>
        <ellipse cx="35" cy="48" rx="7" ry="4" fill="#991B1B">
          <animate attributeName="ry" values="4;3;4" dur="0.3s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="35" cy="47" r="2" fill="#FFF" opacity="0.5" />
      </g>
      <g>
        <ellipse cx="65" cy="48" rx="7" ry="4" fill="#991B1B">
          <animate attributeName="ry" values="4;3;4" dur="0.3s" repeatCount="indefinite" begin="0.1s" />
        </ellipse>
        <circle cx="65" cy="47" r="2" fill="#FFF" opacity="0.5" />
      </g>

      {/* Angry gritting teeth mouth */}
      <rect x="32" y="62" width="36" height="12" rx="3" fill="#991B1B">
        <animate attributeName="height" values="12;14;12" dur="0.3s" repeatCount="indefinite" />
      </rect>
      <line x1="38" y1="62" x2="38" y2="74" stroke="#FCA5A5" strokeWidth="2" />
      <line x1="50" y1="62" x2="50" y2="74" stroke="#FCA5A5" strokeWidth="2" />
      <line x1="62" y1="62" x2="62" y2="74" stroke="#FCA5A5" strokeWidth="2" />

      {/* Fire on head */}
      <g>
        <ellipse cx="30" cy="12" rx="6" ry="12" fill="url(#fireGrad)">
          <animate attributeName="ry" values="12;15;12" dur="0.4s" repeatCount="indefinite" />
          <animate attributeName="cy" values="12;10;12" dur="0.4s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="50" cy="8" rx="8" ry="16" fill="url(#fireGrad)">
          <animate attributeName="ry" values="16;20;16" dur="0.3s" repeatCount="indefinite" begin="0.1s" />
          <animate attributeName="cy" values="8;5;8" dur="0.3s" repeatCount="indefinite" begin="0.1s" />
        </ellipse>
        <ellipse cx="70" cy="12" rx="6" ry="12" fill="url(#fireGrad)">
          <animate attributeName="ry" values="12;15;12" dur="0.35s" repeatCount="indefinite" begin="0.2s" />
          <animate attributeName="cy" values="12;10;12" dur="0.35s" repeatCount="indefinite" begin="0.2s" />
        </ellipse>
      </g>

      {/* Steam from ears */}
      <g opacity="0.4">
        <path d="M8 50 Q3 45 8 40" fill="none" stroke="#FCA5A5" strokeWidth="3" strokeLinecap="round">
          <animate attributeName="d" values="M8 50 Q3 45 8 40;M6 48 Q1 43 6 38;M8 50 Q3 45 8 40" dur="0.5s" repeatCount="indefinite" />
        </path>
        <path d="M92 50 Q97 45 92 40" fill="none" stroke="#FCA5A5" strokeWidth="3" strokeLinecap="round">
          <animate attributeName="d" values="M92 50 Q97 45 92 40;M94 48 Q99 43 94 38;M92 50 Q97 45 92 40" dur="0.5s" repeatCount="indefinite" begin="0.2s" />
        </path>
      </g>
    </svg>
  );
}
