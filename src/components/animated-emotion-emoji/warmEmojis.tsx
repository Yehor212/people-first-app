/**
 * Warm emotion SVG emojis: Joy, Trust, Surprise, Anticipation
 * Each is a self-contained animated SVG component
 */

import { cn } from '@/lib/utils';

// Joy - Radiant sunny face with golden sparkles
export function JoyEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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
export function TrustEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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

// Surprise - Wide-eyed amazed blue face
export function SurpriseEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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

// Anticipation - Orange face looking forward with excitement
export function AnticipationEmoji({ size, isSelected }: { size: string; isSelected?: boolean }) {
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
