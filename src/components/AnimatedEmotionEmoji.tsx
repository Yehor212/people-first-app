/**
 * AnimatedEmotionEmoji - SVG animated emojis for Plutchik's 8 primary emotions
 * Each emotion has unique colors, animations and visual design
 */

import { cn } from '@/lib/utils';
import { PrimaryEmotion, EmotionIntensity } from '@/types';

interface AnimatedEmotionEmojiProps {
  emotion: PrimaryEmotion;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSelected?: boolean;
  intensity?: EmotionIntensity;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

// Joy - Radiant sunny face with golden sparkles
function JoyEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="joyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#FACC15" />
        </linearGradient>
        <linearGradient id="joyShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <filter id="joyShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#EAB308" floodOpacity="0.5"/>
        </filter>
      </defs>

      {/* Sun rays */}
      <g opacity="0.6">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <line
            key={angle}
            x1="50"
            y1="50"
            x2={50 + Math.cos(angle * Math.PI / 180) * 55}
            y2={50 + Math.sin(angle * Math.PI / 180) * 55}
            stroke="#FDE047"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <animate attributeName="opacity" values="0.4;0.8;0.4" dur={`${1.5 + i * 0.1}s`} repeatCount="indefinite" />
          </line>
        ))}
      </g>

      {/* Main face */}
      <circle cx="50" cy="50" r="40" fill="url(#joyGrad)" filter={isSelected ? "url(#joyShadow)" : undefined}>
        <animate attributeName="r" values="40;42;40" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Shine */}
      <ellipse cx="35" cy="35" rx="20" ry="15" fill="url(#joyShine)" />

      {/* Happy curved eyes */}
      <path d="M28 42 Q35 32 42 42" fill="none" stroke="#B45309" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M28 42 Q35 32 42 42;M28 40 Q35 30 42 40;M28 42 Q35 32 42 42" dur="1.5s" repeatCount="indefinite" />
      </path>
      <path d="M58 42 Q65 32 72 42" fill="none" stroke="#B45309" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M58 42 Q65 32 72 42;M58 40 Q65 30 72 40;M58 42 Q65 32 72 42" dur="1.5s" repeatCount="indefinite" />
      </path>

      {/* Big radiant smile */}
      <path d="M25 55 Q50 80 75 55" fill="#B45309" opacity="0.9">
        <animate attributeName="d" values="M25 55 Q50 80 75 55;M25 57 Q50 83 75 57;M25 55 Q50 80 75 55" dur="1.5s" repeatCount="indefinite" />
      </path>
      <path d="M28 57 Q50 72 72 57" fill="#FFF" />

      {/* Rosy cheeks */}
      <ellipse cx="22" cy="52" rx="8" ry="5" fill="#FB923C" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.6;0.4" dur="2s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="78" cy="52" rx="8" ry="5" fill="#FB923C" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.6;0.4" dur="2s" repeatCount="indefinite" begin="0.3s" />
      </ellipse>

      {/* Sparkles */}
      <path d="M12 18 L14 24 L20 24 L15 28 L17 34 L12 30 L7 34 L9 28 L4 24 L10 24 Z" fill="#FDE047">
        <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
        <animateTransform attributeName="transform" type="scale" values="1;1.3;1" dur="1s" repeatCount="indefinite" additive="sum" />
      </path>
      <path d="M88 15 L89 19 L93 19 L90 22 L91 26 L88 23 L85 26 L86 22 L83 19 L87 19 Z" fill="#FDE047">
        <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" begin="0.3s" />
      </path>
    </svg>
  );
}

// Trust - Warm green face with gentle heart
function TrustEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="trustGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#86EFAC" />
          <stop offset="50%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#22C55E" />
        </linearGradient>
        <linearGradient id="trustShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <filter id="trustShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#16A34A" floodOpacity="0.4"/>
        </filter>
      </defs>

      {/* Main face */}
      <circle cx="50" cy="50" r="44" fill="url(#trustGrad)" filter={isSelected ? "url(#trustShadow)" : undefined}>
        <animate attributeName="cy" values="50;48;50" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* Shine */}
      <ellipse cx="35" cy="35" rx="25" ry="20" fill="url(#trustShine)" />

      {/* Warm trusting eyes */}
      <g>
        <ellipse cx="35" cy="45" rx="6" ry="7" fill="#166534">
          <animate attributeName="ry" values="7;3;7" dur="4s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="33" cy="43" r="2" fill="#FFF" opacity="0.7" />
      </g>
      <g>
        <ellipse cx="65" cy="45" rx="6" ry="7" fill="#166534">
          <animate attributeName="ry" values="7;3;7" dur="4s" repeatCount="indefinite" begin="0.1s" />
        </ellipse>
        <circle cx="63" cy="43" r="2" fill="#FFF" opacity="0.7" />
      </g>

      {/* Gentle warm smile */}
      <path d="M30 60 Q50 75 70 60" fill="none" stroke="#166534" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M30 60 Q50 75 70 60;M30 62 Q50 78 70 62;M30 60 Q50 75 70 60" dur="3s" repeatCount="indefinite" />
      </path>

      {/* Soft blush */}
      <ellipse cx="24" cy="54" rx="7" ry="4" fill="#15803D" opacity="0.3" />
      <ellipse cx="76" cy="54" rx="7" ry="4" fill="#15803D" opacity="0.3" />

      {/* Small heart */}
      <path d="M85 20 C85 15 80 12 77 16 C74 12 69 15 69 20 C69 26 77 32 77 32 C77 32 85 26 85 20" fill="#F472B6">
        <animate attributeName="transform" type="scale" values="1;1.15;1" dur="1.5s" repeatCount="indefinite" />
        <animateTransform attributeName="transform" type="translate" values="0,0;0,-2;0,0" dur="1.5s" repeatCount="indefinite" additive="sum" />
      </path>
    </svg>
  );
}

// Fear - Worried teal face with wide eyes
function FearEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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

// Surprise - Wide-eyed amazed blue face
function SurpriseEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="surpriseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="50%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="surpriseShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <filter id="surpriseShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#2563EB" floodOpacity="0.4"/>
        </filter>
      </defs>

      {/* Main face with pop effect */}
      <circle cx="50" cy="50" r="44" fill="url(#surpriseGrad)" filter={isSelected ? "url(#surpriseShadow)" : undefined}>
        <animate attributeName="r" values="44;46;44" dur="0.6s" repeatCount="indefinite" />
      </circle>

      {/* Shine */}
      <ellipse cx="35" cy="35" rx="25" ry="20" fill="url(#surpriseShine)" />

      {/* High raised eyebrows */}
      <path d="M22 30 Q35 22 48 30" fill="none" stroke="#1E40AF" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="d" values="M22 30 Q35 22 48 30;M22 28 Q35 20 48 28;M22 30 Q35 22 48 30" dur="0.8s" repeatCount="indefinite" />
      </path>
      <path d="M52 30 Q65 22 78 30" fill="none" stroke="#1E40AF" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="d" values="M52 30 Q65 22 78 30;M52 28 Q65 20 78 28;M52 30 Q65 22 78 30" dur="0.8s" repeatCount="indefinite" />
      </path>

      {/* Big surprised eyes */}
      <g>
        <circle cx="35" cy="45" r="11" fill="#FFF" />
        <circle cx="35" cy="45" r="7" fill="#1E40AF">
          <animate attributeName="cy" values="45;44;45" dur="0.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="33" cy="43" r="2.5" fill="#FFF" />
      </g>
      <g>
        <circle cx="65" cy="45" r="11" fill="#FFF" />
        <circle cx="65" cy="45" r="7" fill="#1E40AF">
          <animate attributeName="cy" values="45;44;45" dur="0.5s" repeatCount="indefinite" begin="0.1s" />
        </circle>
        <circle cx="63" cy="43" r="2.5" fill="#FFF" />
      </g>

      {/* Big O mouth */}
      <ellipse cx="50" cy="68" rx="12" ry="14" fill="#1E40AF">
        <animate attributeName="ry" values="14;16;14" dur="0.6s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="50" cy="66" rx="8" ry="9" fill="#BFDBFE" />

      {/* Star sparkles */}
      <g>
        <path d="M85 20 L87 26 L93 26 L88 30 L90 36 L85 32 L80 36 L82 30 L77 26 L83 26 Z" fill="#FDE047">
          <animate attributeName="opacity" values="1;0.3;1" dur="0.7s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="scale" values="1;1.2;1" dur="0.7s" repeatCount="indefinite" additive="sum" />
        </path>
        <path d="M10 25 L11 29 L15 29 L12 31 L13 35 L10 33 L7 35 L8 31 L5 29 L9 29 Z" fill="#FDE047">
          <animate attributeName="opacity" values="1;0.3;1" dur="0.6s" repeatCount="indefinite" begin="0.2s" />
        </path>
      </g>
    </svg>
  );
}

// Sadness - Melancholic indigo face with tears
function SadnessEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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
function DisgustEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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
function AngerEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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

// Anticipation - Orange face looking forward with excitement
function AnticipationEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn(size, "drop-shadow-lg")}>
      <defs>
        <linearGradient id="anticipationGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FED7AA" />
          <stop offset="50%" stopColor="#FDBA74" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id="anticipationShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <filter id="anticipationShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#EA580C" floodOpacity="0.4"/>
        </filter>
      </defs>

      {/* Main face */}
      <circle cx="50" cy="50" r="44" fill="url(#anticipationGrad)" filter={isSelected ? "url(#anticipationShadow)" : undefined}>
        <animate attributeName="cx" values="50;52;50" dur="1.5s" repeatCount="indefinite" />
      </circle>

      {/* Shine */}
      <ellipse cx="35" cy="35" rx="25" ry="20" fill="url(#anticipationShine)" />

      {/* Slightly raised excited eyebrows */}
      <path d="M24 35 Q35 30 46 35" fill="none" stroke="#C2410C" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="d" values="M24 35 Q35 30 46 35;M24 33 Q35 28 46 33;M24 35 Q35 30 46 35" dur="1.5s" repeatCount="indefinite" />
      </path>
      <path d="M54 35 Q65 30 76 35" fill="none" stroke="#C2410C" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="d" values="M54 35 Q65 30 76 35;M54 33 Q65 28 76 33;M54 35 Q65 30 76 35" dur="1.5s" repeatCount="indefinite" />
      </path>

      {/* Eyes looking to the side (anticipating) */}
      <g>
        <circle cx="35" cy="48" r="9" fill="#FFF" />
        <circle cx="38" cy="48" r="5" fill="#C2410C">
          <animate attributeName="cx" values="38;40;38" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="36" cy="46" r="2" fill="#FFF" opacity="0.8" />
      </g>
      <g>
        <circle cx="65" cy="48" r="9" fill="#FFF" />
        <circle cx="68" cy="48" r="5" fill="#C2410C">
          <animate attributeName="cx" values="68;70;68" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="66" cy="46" r="2" fill="#FFF" opacity="0.8" />
      </g>

      {/* Excited small smile */}
      <path d="M35 62 Q50 72 65 62" fill="none" stroke="#C2410C" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="d" values="M35 62 Q50 72 65 62;M35 64 Q50 75 65 64;M35 62 Q50 72 65 62" dur="1.5s" repeatCount="indefinite" />
      </path>

      {/* Sparkle of anticipation */}
      <g>
        <circle cx="85" cy="25" r="5" fill="#FDE047" opacity="0.8">
          <animate attributeName="r" values="5;7;5" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1s" repeatCount="indefinite" />
        </circle>
        <circle cx="15" cy="30" r="4" fill="#FDE047" opacity="0.6">
          <animate attributeName="r" values="4;6;4" dur="1.2s" repeatCount="indefinite" begin="0.3s" />
          <animate attributeName="opacity" values="0.6;0.3;0.6" dur="1.2s" repeatCount="indefinite" begin="0.3s" />
        </circle>
      </g>

      {/* Forward motion lines */}
      <g opacity="0.3">
        <line x1="90" y1="45" x2="98" y2="45" stroke="#C2410C" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="x2" values="98;102;98" dur="0.8s" repeatCount="indefinite" />
        </line>
        <line x1="90" y1="50" x2="100" y2="50" stroke="#C2410C" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="x2" values="100;105;100" dur="0.8s" repeatCount="indefinite" begin="0.1s" />
        </line>
        <line x1="90" y1="55" x2="98" y2="55" stroke="#C2410C" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="x2" values="98;102;98" dur="0.8s" repeatCount="indefinite" begin="0.2s" />
        </line>
      </g>
    </svg>
  );
}

const emotionComponents: Record<PrimaryEmotion, React.FC<{ size: string; isSelected?: boolean }>> = {
  joy: JoyEmoji,
  trust: TrustEmoji,
  fear: FearEmoji,
  surprise: SurpriseEmoji,
  sadness: SadnessEmoji,
  disgust: DisgustEmoji,
  anger: AngerEmoji,
  anticipation: AnticipationEmoji,
};

export function AnimatedEmotionEmoji({
  emotion,
  size = 'lg',
  isSelected,
  intensity,
  className
}: AnimatedEmotionEmojiProps) {
  const sizeClass = sizeClasses[size];
  const EmojiComponent = emotionComponents[emotion];

  // Intensity affects scale
  const intensityScale = intensity === 'intense' ? 'scale-110' : intensity === 'mild' ? 'scale-95' : '';

  return (
    <div className={cn(
      "transition-all duration-300",
      isSelected && "scale-110 drop-shadow-xl",
      intensityScale,
      className
    )}>
      <EmojiComponent size={sizeClass} isSelected={isSelected} />
    </div>
  );
}
