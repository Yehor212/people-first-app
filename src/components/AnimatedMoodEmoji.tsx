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

// Great mood - Excited face with stars
function GreatEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "animated-emoji-great")}>
      <defs>
        <linearGradient id="greatGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD93D" />
          <stop offset="100%" stopColor="#FF9500" />
        </linearGradient>
        <filter id="greatGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Face */}
      <circle cx="50" cy="50" r="45" fill="url(#greatGradient)" filter={isSelected ? "url(#greatGlow)" : undefined}>
        <animate attributeName="r" values="45;47;45" dur="1s" repeatCount="indefinite" />
      </circle>

      {/* Left eye - star */}
      <g className="great-eye-left">
        <path d="M30 38 L33 44 L40 44 L35 48 L37 55 L30 51 L23 55 L25 48 L20 44 L27 44 Z" fill="#FF6B35">
          <animate attributeName="opacity" values="1;0.7;1" dur="0.5s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" values="0 30 46;10 30 46;0 30 46" dur="2s" repeatCount="indefinite" />
        </path>
      </g>

      {/* Right eye - star */}
      <g className="great-eye-right">
        <path d="M70 38 L73 44 L80 44 L75 48 L77 55 L70 51 L63 55 L65 48 L60 44 L67 44 Z" fill="#FF6B35">
          <animate attributeName="opacity" values="1;0.7;1" dur="0.5s" repeatCount="indefinite" begin="0.1s" />
          <animateTransform attributeName="transform" type="rotate" values="0 70 46;-10 70 46;0 70 46" dur="2s" repeatCount="indefinite" />
        </path>
      </g>

      {/* Big smile */}
      <path d="M25 60 Q50 85 75 60" fill="none" stroke="#5D4037" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M25 60 Q50 85 75 60;M25 58 Q50 88 75 58;M25 60 Q50 85 75 60" dur="1s" repeatCount="indefinite" />
      </path>

      {/* Teeth */}
      <path d="M30 63 Q50 75 70 63" fill="#FFF" opacity="0.9">
        <animate attributeName="d" values="M30 63 Q50 75 70 63;M30 61 Q50 78 70 61;M30 63 Q50 75 70 63" dur="1s" repeatCount="indefinite" />
      </path>

      {/* Blush left */}
      <ellipse cx="22" cy="58" rx="8" ry="5" fill="#FF8A80" opacity="0.6">
        <animate attributeName="opacity" values="0.6;0.8;0.6" dur="2s" repeatCount="indefinite" />
      </ellipse>

      {/* Blush right */}
      <ellipse cx="78" cy="58" rx="8" ry="5" fill="#FF8A80" opacity="0.6">
        <animate attributeName="opacity" values="0.6;0.8;0.6" dur="2s" repeatCount="indefinite" begin="0.5s" />
      </ellipse>

      {/* Sparkles around */}
      <g className="sparkles">
        <circle cx="15" cy="20" r="3" fill="#FFD700">
          <animate attributeName="r" values="3;5;3" dur="0.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.5;1" dur="0.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="85" cy="25" r="2" fill="#FFD700">
          <animate attributeName="r" values="2;4;2" dur="0.6s" repeatCount="indefinite" begin="0.2s" />
          <animate attributeName="opacity" values="1;0.5;1" dur="0.6s" repeatCount="indefinite" begin="0.2s" />
        </circle>
        <circle cx="90" cy="70" r="2.5" fill="#FFD700">
          <animate attributeName="r" values="2.5;4.5;2.5" dur="0.7s" repeatCount="indefinite" begin="0.4s" />
          <animate attributeName="opacity" values="1;0.5;1" dur="0.7s" repeatCount="indefinite" begin="0.4s" />
        </circle>
      </g>
    </svg>
  );
}

// Good mood - Happy relaxed face
function GoodEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "animated-emoji-good")}>
      <defs>
        <linearGradient id="goodGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#81C784" />
          <stop offset="100%" stopColor="#4CAF50" />
        </linearGradient>
        <filter id="goodGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Face */}
      <circle cx="50" cy="50" r="45" fill="url(#goodGradient)" filter={isSelected ? "url(#goodGlow)" : undefined}>
        <animate attributeName="cy" values="50;48;50" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Left eye - happy curved */}
      <path d="M28 42 Q35 35 42 42" fill="none" stroke="#2E7D32" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M28 42 Q35 35 42 42;M28 40 Q35 33 42 40;M28 42 Q35 35 42 42" dur="3s" repeatCount="indefinite" />
      </path>

      {/* Right eye - happy curved */}
      <path d="M58 42 Q65 35 72 42" fill="none" stroke="#2E7D32" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M58 42 Q65 35 72 42;M58 40 Q65 33 72 40;M58 42 Q65 35 72 42" dur="3s" repeatCount="indefinite" />
      </path>

      {/* Gentle smile */}
      <path d="M30 62 Q50 78 70 62" fill="none" stroke="#2E7D32" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M30 62 Q50 78 70 62;M30 64 Q50 80 70 64;M30 62 Q50 78 70 62" dur="2s" repeatCount="indefinite" />
      </path>

      {/* Soft blush */}
      <ellipse cx="25" cy="55" rx="7" ry="4" fill="#A5D6A7" opacity="0.7">
        <animate attributeName="opacity" values="0.7;0.9;0.7" dur="3s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="75" cy="55" rx="7" ry="4" fill="#A5D6A7" opacity="0.7">
        <animate attributeName="opacity" values="0.7;0.9;0.7" dur="3s" repeatCount="indefinite" begin="0.5s" />
      </ellipse>

      {/* Floating leaf */}
      <g>
        <path d="M85 15 Q90 20 85 25 Q80 20 85 15" fill="#4CAF50">
          <animateTransform attributeName="transform" type="translate" values="0,0;-5,10;0,0" dur="3s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" values="0 85 20;20 85 20;0 85 20" dur="3s" repeatCount="indefinite" additive="sum" />
        </path>
      </g>
    </svg>
  );
}

// Okay mood - Neutral thinking face
function OkayEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "animated-emoji-okay")}>
      <defs>
        <linearGradient id="okayGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="100%" stopColor="#FFB74D" />
        </linearGradient>
        <filter id="okayGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Face */}
      <circle cx="50" cy="50" r="45" fill="url(#okayGradient)" filter={isSelected ? "url(#okayGlow)" : undefined}>
        <animate attributeName="cx" values="50;52;50;48;50" dur="4s" repeatCount="indefinite" />
      </circle>

      {/* Left eye - looking around */}
      <g>
        <circle cx="35" cy="42" r="8" fill="#FFF" />
        <circle cx="35" cy="42" r="5" fill="#5D4037">
          <animate attributeName="cx" values="35;37;35;33;35" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="36" cy="40" r="2" fill="#FFF" opacity="0.8" />
      </g>

      {/* Right eye - looking around */}
      <g>
        <circle cx="65" cy="42" r="8" fill="#FFF" />
        <circle cx="65" cy="42" r="5" fill="#5D4037">
          <animate attributeName="cx" values="65;67;65;63;65" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="66" cy="40" r="2" fill="#FFF" opacity="0.8" />
      </g>

      {/* Eyebrows - slightly raised */}
      <path d="M25 32 L45 30" fill="none" stroke="#8D6E63" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="d" values="M25 32 L45 30;M25 30 L45 28;M25 32 L45 30" dur="4s" repeatCount="indefinite" />
      </path>
      <path d="M55 30 L75 32" fill="none" stroke="#8D6E63" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="d" values="M55 30 L75 32;M55 28 L75 30;M55 30 L75 32" dur="4s" repeatCount="indefinite" />
      </path>

      {/* Straight/wavy mouth */}
      <path d="M35 65 Q50 68 65 65" fill="none" stroke="#5D4037" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M35 65 Q50 68 65 65;M35 65 Q50 62 65 65;M35 65 Q50 68 65 65" dur="3s" repeatCount="indefinite" />
      </path>

      {/* Thinking bubble */}
      <g opacity="0.6">
        <circle cx="85" cy="25" r="4" fill="#FFF">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="92" cy="15" r="3" fill="#FFF">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" begin="0.3s" />
        </circle>
        <circle cx="96" cy="8" r="2" fill="#FFF">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" begin="0.6s" />
        </circle>
      </g>
    </svg>
  );
}

// Bad mood - Sad droopy face
function BadEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "animated-emoji-bad")}>
      <defs>
        <linearGradient id="badGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFAB91" />
          <stop offset="100%" stopColor="#FF7043" />
        </linearGradient>
        <filter id="badGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Face */}
      <circle cx="50" cy="50" r="45" fill="url(#badGradient)" filter={isSelected ? "url(#badGlow)" : undefined}>
        <animate attributeName="cy" values="50;52;50" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* Sad eyebrows */}
      <path d="M25 35 L40 40" fill="none" stroke="#BF360C" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="d" values="M25 35 L40 40;M25 33 L40 38;M25 35 L40 40" dur="3s" repeatCount="indefinite" />
      </path>
      <path d="M60 40 L75 35" fill="none" stroke="#BF360C" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="d" values="M60 40 L75 35;M60 38 L75 33;M60 40 L75 35" dur="3s" repeatCount="indefinite" />
      </path>

      {/* Left eye - droopy */}
      <ellipse cx="35" cy="48" rx="6" ry="7" fill="#5D4037">
        <animate attributeName="ry" values="7;5;7" dur="4s" repeatCount="indefinite" />
      </ellipse>
      <circle cx="33" cy="46" r="2" fill="#FFF" opacity="0.6" />

      {/* Right eye - droopy */}
      <ellipse cx="65" cy="48" rx="6" ry="7" fill="#5D4037">
        <animate attributeName="ry" values="7;5;7" dur="4s" repeatCount="indefinite" begin="0.5s" />
      </ellipse>
      <circle cx="63" cy="46" r="2" fill="#FFF" opacity="0.6" />

      {/* Sad frown */}
      <path d="M30 72 Q50 60 70 72" fill="none" stroke="#5D4037" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M30 72 Q50 60 70 72;M30 74 Q50 62 70 74;M30 72 Q50 60 70 72" dur="3s" repeatCount="indefinite" />
      </path>

      {/* Small sweat drop */}
      <ellipse cx="78" cy="35" rx="3" ry="5" fill="#81D4FA" opacity="0.7">
        <animate attributeName="cy" values="35;40;35" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2s" repeatCount="indefinite" />
      </ellipse>
    </svg>
  );
}

// Terrible mood - Crying sad face
function TerribleEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "animated-emoji-terrible")}>
      <defs>
        <linearGradient id="terribleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EF9A9A" />
          <stop offset="100%" stopColor="#E57373" />
        </linearGradient>
        <filter id="terribleGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Face */}
      <circle cx="50" cy="50" r="45" fill="url(#terribleGradient)" filter={isSelected ? "url(#terribleGlow)" : undefined}>
        <animate attributeName="cx" values="50;51;50;49;50" dur="0.5s" repeatCount="indefinite" />
      </circle>

      {/* Very sad eyebrows */}
      <path d="M22 30 L42 38" fill="none" stroke="#C62828" strokeWidth="3" strokeLinecap="round" />
      <path d="M58 38 L78 30" fill="none" stroke="#C62828" strokeWidth="3" strokeLinecap="round" />

      {/* Crying eyes - closed with tears */}
      <path d="M28 45 Q35 40 42 45" fill="none" stroke="#5D4037" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M28 45 Q35 40 42 45;M28 47 Q35 42 42 47;M28 45 Q35 40 42 45" dur="1s" repeatCount="indefinite" />
      </path>
      <path d="M58 45 Q65 40 72 45" fill="none" stroke="#5D4037" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M58 45 Q65 40 72 45;M58 47 Q65 42 72 47;M58 45 Q65 40 72 45" dur="1s" repeatCount="indefinite" />
      </path>

      {/* Tears - left */}
      <ellipse cx="30" cy="55" rx="4" ry="8" fill="#64B5F6" opacity="0.8">
        <animate attributeName="cy" values="55;70;55" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="38" cy="58" rx="3" ry="6" fill="#64B5F6" opacity="0.6">
        <animate attributeName="cy" values="58;75;58" dur="1.8s" repeatCount="indefinite" begin="0.3s" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="1.8s" repeatCount="indefinite" begin="0.3s" />
      </ellipse>

      {/* Tears - right */}
      <ellipse cx="70" cy="55" rx="4" ry="8" fill="#64B5F6" opacity="0.8">
        <animate attributeName="cy" values="55;70;55" dur="1.5s" repeatCount="indefinite" begin="0.2s" />
        <animate attributeName="opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite" begin="0.2s" />
      </ellipse>
      <ellipse cx="62" cy="58" rx="3" ry="6" fill="#64B5F6" opacity="0.6">
        <animate attributeName="cy" values="58;75;58" dur="1.8s" repeatCount="indefinite" begin="0.5s" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="1.8s" repeatCount="indefinite" begin="0.5s" />
      </ellipse>

      {/* Very sad mouth - open crying */}
      <ellipse cx="50" cy="72" rx="12" ry="8" fill="#5D4037">
        <animate attributeName="ry" values="8;10;8" dur="0.8s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="50" cy="70" rx="8" ry="4" fill="#E57373" />

      {/* Sob lines */}
      <g opacity="0.4">
        <line x1="15" y1="60" x2="10" y2="70" stroke="#C62828" strokeWidth="2">
          <animate attributeName="opacity" values="0.4;0.1;0.4" dur="0.5s" repeatCount="indefinite" />
        </line>
        <line x1="85" y1="60" x2="90" y2="70" stroke="#C62828" strokeWidth="2">
          <animate attributeName="opacity" values="0.4;0.1;0.4" dur="0.5s" repeatCount="indefinite" begin="0.1s" />
        </line>
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
      "transition-transform",
      isSelected && "scale-110",
      className
    )}>
      <EmojiComponent size={sizeClass} isSelected={isSelected} />
    </div>
  );
}
