import { cn } from '@/lib/utils';

interface AnimatedMoodEmojiProps {
  mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSelected?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

// Great mood - Radiant joyful face with sparkles
function GreatEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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

// Good mood - Content peaceful smile
function GoodEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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

// Okay mood - Thoughtful neutral face
function OkayEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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

// Bad mood - Sad worried face
function BadEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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

// Terrible mood - Deeply sad crying face
function TerribleEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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
        <animate attributeName="d" values="M56 46 Q65 40 74 46;M56 48 Q65 42 74 48;M56 46 Q65 40 74 46" dur="1.2s" repeatCount="indefinite" />
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

export function AnimatedMoodEmoji({ mood, size = 'lg', isSelected, className }: AnimatedMoodEmojiProps) {
  const sizeClass = sizeClasses[size];

  const emojiComponents = {
    great: GreatEmoji,
    good: GoodEmoji,
    okay: OkayEmoji,
    bad: BadEmoji,
    terrible: TerribleEmoji,
  };

  const EmojiComponent = emojiComponents[mood];

  return (
    <div className={cn(
      "transition-all duration-300",
      isSelected && "scale-110 drop-shadow-xl",
      className
    )}>
      <EmojiComponent size={sizeClass} isSelected={isSelected} />
    </div>
  );
}
