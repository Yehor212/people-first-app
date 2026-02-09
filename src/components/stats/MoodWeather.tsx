/**
 * MoodWeather - Premium animated weather card based on mood + emotion
 * 12 weather moods with 4-layer animation system:
 *   Layer 1: Background gradient (inline styles from palette)
 *   Layer 2: Weather effect (sun/clouds/rain/storm/fog/aurora/wind/clear)
 *   Layer 3: Particles (dots/sparkle/rain/fog)
 *   Layer 4: Content overlay (emoji + label + message)
 *
 * Tap opens MoodWeatherCalendar bottom sheet.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/components/ThemeToggle';
import { shouldAnimate } from '@/lib/animationUtils';
import { MoodType, EmotionData } from '@/types';
import {
  deriveWeatherMood,
  getWeatherMoodConfig,
  WeatherEffectType,
  ParticleLayerConfig,
  WeatherMoodPalette,
} from '@/lib/weatherMoodConfig';

// ============================================
// TYPES
// ============================================

interface MoodWeatherProps {
  mood: MoodType;
  emotion?: EmotionData | null;
  onOpenCalendar?: () => void;
  className?: string;
}

// ============================================
// PARTICLE COLOR MAP (name → rgb)
// ============================================

const PARTICLE_RGB: Record<string, string> = {
  teal: '45, 212, 191',
  amber: '251, 191, 36',
  violet: '139, 92, 246',
  slate: '148, 163, 184',
  blue: '59, 130, 246',
  red: '239, 68, 68',
  yellow: '234, 179, 8',
  indigo: '99, 102, 241',
};

// ============================================
// LAYER 2: WEATHER EFFECTS
// ============================================

function SunEffect({ intensity }: { intensity: string }) {
  const rayCount = intensity === 'heavy' ? 10 : intensity === 'medium' ? 8 : 6;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="animate-sun-rays" style={{ transformOrigin: 'center' }}>
        {Array.from({ length: rayCount }, (_, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 w-0.5 rounded-full bg-gradient-to-t from-amber-400/30 to-transparent"
            style={{
              height: intensity === 'heavy' ? 18 : 14,
              transform: `translate(-50%, -50%) rotate(${i * (360 / rayCount)}deg) translateY(-${intensity === 'heavy' ? 18 : 14}px)`,
            }}
          />
        ))}
      </div>
      <div
        className="w-10 h-10 rounded-full animate-sun-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(251,191,36,0.35) 0%, rgba(251,191,36,0.08) 70%, transparent 100%)',
        }}
      />
    </div>
  );
}

function CloudsEffect({ intensity }: { intensity: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className={cn(
          'absolute rounded-full bg-foreground/[0.06]',
          intensity === 'light' ? 'animate-cloud-drift-slow' : 'animate-cloud-drift',
        )}
        style={{ width: 48, height: 20, top: '20%', left: '10%', borderRadius: 20 }}
      />
      <div
        className="absolute rounded-full bg-foreground/[0.08] animate-cloud-drift"
        style={{ width: 56, height: 22, top: '35%', left: '30%', borderRadius: 20, animationDelay: '-2s' }}
      />
      {intensity !== 'light' && (
        <div
          className="absolute rounded-full bg-foreground/[0.05] animate-cloud-drift-slow"
          style={{ width: 40, height: 16, top: '55%', left: '50%', borderRadius: 16 }}
        />
      )}
    </div>
  );
}

function RainEffect({ intensity }: { intensity: string }) {
  const dropCount = intensity === 'heavy' ? 8 : intensity === 'medium' ? 5 : 3;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: dropCount }, (_, i) => (
        <div
          key={i}
          className="absolute w-[1.5px] rounded-full bg-blue-400/50 animate-rain-drop"
          style={{
            height: intensity === 'heavy' ? 12 : 8,
            left: `${12 + i * (76 / dropCount)}%`,
            top: -12,
            animationDelay: `${i * 0.15}s`,
            animationDuration: intensity === 'heavy' ? '0.8s' : '1s',
          }}
        />
      ))}
    </div>
  );
}

function StormEffect() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Dark cloud shapes */}
      <div
        className="absolute rounded-full bg-foreground/[0.1] animate-cloud-drift"
        style={{ width: 56, height: 22, top: '15%', left: '15%', borderRadius: 20 }}
      />
      <div
        className="absolute rounded-full bg-foreground/[0.12] animate-cloud-drift"
        style={{ width: 48, height: 18, top: '25%', left: '40%', borderRadius: 18, animationDelay: '-3s' }}
      />
      {/* Lightning bolt */}
      <svg
        className="absolute animate-lightning"
        style={{ top: '45%', left: '48%', transform: 'translateX(-50%)' }}
        width="14"
        height="18"
        viewBox="0 0 20 24"
        fill="none"
      >
        <path d="M11 1L3 14H10L9 23L17 10H10L11 1Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
      </svg>
      {/* Rain */}
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="absolute w-[1.5px] h-2 rounded-full bg-blue-400/40 animate-rain-drop"
          style={{
            left: `${15 + i * 15}%`,
            top: -8,
            animationDelay: `${i * 0.12}s`,
            animationDuration: '0.7s',
          }}
        />
      ))}
    </div>
  );
}

function FogEffect({ intensity }: { intensity: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute rounded-full animate-fog-drift"
        style={{
          width: '70%',
          height: 16,
          top: '30%',
          left: '10%',
          background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.15), transparent)',
          filter: 'blur(8px)',
        }}
      />
      <div
        className="absolute rounded-full animate-fog-drift-slow"
        style={{
          width: '60%',
          height: 14,
          top: '55%',
          left: '20%',
          background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.12), transparent)',
          filter: 'blur(10px)',
        }}
      />
      {intensity !== 'light' && (
        <div
          className="absolute rounded-full animate-fog-drift"
          style={{
            width: '50%',
            height: 12,
            top: '75%',
            left: '5%',
            background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.1), transparent)',
            filter: 'blur(12px)',
            animationDelay: '-3s',
          }}
        />
      )}
    </div>
  );
}

function AuroraEffect({ intensity, palette }: { intensity: string; palette: WeatherMoodPalette }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className={cn(intensity === 'heavy' ? 'animate-aurora-fast' : 'animate-aurora')}
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, hsl(${palette.accent} / 0.12) 0%, transparent 40%, hsl(${palette.accent} / 0.08) 60%, transparent 100%)`,
          backgroundSize: '200% 200%',
        }}
      />
    </div>
  );
}

function WindEffect() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="absolute animate-wind-sway"
          style={{
            top: `${25 + i * 22}%`,
            left: `${10 + i * 15}%`,
            width: `${40 - i * 8}%`,
            height: 1.5,
            background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.15), transparent)',
            borderRadius: 2,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}

function ClearEffect() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="animate-aurora"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(45,212,191,0.06) 0%, transparent 50%, rgba(45,212,191,0.04) 100%)',
          backgroundSize: '200% 200%',
        }}
      />
    </div>
  );
}

function WeatherEffectLayer({
  type,
  intensity,
  palette,
}: {
  type: WeatherEffectType;
  intensity: 'light' | 'medium' | 'heavy';
  palette: WeatherMoodPalette;
}) {
  switch (type) {
    case 'sun': return <SunEffect intensity={intensity} />;
    case 'clouds': return <CloudsEffect intensity={intensity} />;
    case 'rain': return <RainEffect intensity={intensity} />;
    case 'storm': return <StormEffect />;
    case 'fog': return <FogEffect intensity={intensity} />;
    case 'aurora': return <AuroraEffect intensity={intensity} palette={palette} />;
    case 'wind': return <WindEffect />;
    case 'clear': return <ClearEffect />;
    case 'none': return null;
  }
}

// ============================================
// LAYER 3: PARTICLES
// ============================================

function MoodParticles({ config, budget }: { config: ParticleLayerConfig; budget: number }) {
  const count = Math.min(config.count, budget);
  const rgb = PARTICLE_RGB[config.color] || '148, 163, 184';

  const { type, sizeRange, speedRange, opacity } = config;

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 90 + 5,
        top: type === 'rain' ? -(Math.random() * 20) : Math.random() * 85 + 5,
        size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
        delay: Math.random() * speedRange[1],
        duration: speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]),
        op: opacity[0] + Math.random() * (opacity[1] - opacity[0]),
      })),
    [count, type, sizeRange, speedRange, opacity],
  );

  const animClass =
    config.type === 'sparkle'
      ? 'animate-sparkle-twinkle'
      : config.type === 'rain'
        ? 'animate-rain-drop'
        : config.type === 'fog'
          ? 'animate-fog-drift'
          : 'animate-sparkle-twinkle'; // dots use twinkle too

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
      {particles.map((p) => (
        <div
          key={p.id}
          className={cn('absolute rounded-full', animClass)}
          style={{
            left: `${p.left}%`,
            top: type === 'rain' ? p.top : `${p.top}%`,
            width: p.size,
            height: type === 'rain' ? p.size * 3 : p.size,
            backgroundColor: `rgba(${rgb}, ${p.op})`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function MoodWeather({ mood, emotion, onOpenCalendar, className }: MoodWeatherProps) {
  const { t } = useLanguage();
  const { effectiveTheme } = useTheme();
  const animate = shouldAnimate();

  const weatherMoodId = useMemo(() => deriveWeatherMood(mood, emotion), [mood, emotion]);
  const config = getWeatherMoodConfig(weatherMoodId);
  const isDark = effectiveTheme === 'dark' || effectiveTheme === 'oled';
  const palette = isDark ? config.palette.dark : config.palette.light;

  const label = (t as Record<string, string>)[config.labelKey] || config.labelKey;
  const message = (t as Record<string, string>)[config.messageKey] || '';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={onOpenCalendar ? { scale: 0.97 } : undefined}
      onClick={onOpenCalendar}
      className={cn(
        'relative overflow-hidden rounded-2xl p-4 min-h-[140px]',
        'border border-border/30 backdrop-blur-sm',
        onOpenCalendar && 'cursor-pointer active:brightness-95',
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${palette.surface}), hsl(${palette.accent} / 0.18))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 12px ${palette.glow}`,
      }}
    >
      {/* Layer 2: Weather Effect */}
      {animate && (
        <WeatherEffectLayer
          type={config.layers.weatherEffect.type}
          intensity={config.layers.weatherEffect.intensity}
          palette={palette}
        />
      )}

      {/* Layer 3: Particles */}
      {animate && config.layers.particles.type !== 'none' && (
        <MoodParticles
          config={config.layers.particles}
          budget={config.performanceBudget.maxParticles}
        />
      )}

      {/* Layer 4: Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        {/* Emoji */}
        <motion.span
          className="text-3xl mb-1 block"
          initial={animate ? { scale: 0, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
        >
          {config.emoji}
        </motion.span>

        {/* Label */}
        <h3 className="text-[11px] font-bold text-foreground text-center uppercase tracking-wider leading-tight">
          {label}
        </h3>

        {/* Message */}
        <p className="text-[9px] text-muted-foreground text-center mt-1 leading-tight line-clamp-2 px-1">
          {message}
        </p>
      </div>

      {/* Reduced motion fallback: just static gradient + emoji is already shown via inline styles */}
    </motion.div>
  );
}

export default MoodWeather;
