/**
 * Weather effect components for MoodWeather
 * Extracted from MoodWeather.tsx for TD-20 decomposition
 *
 * Contains all 8 weather effect components + WeatherEffectLayer dispatcher:
 * SunEffect, CloudsEffect, RainEffect, StormEffect, FogEffect,
 * AuroraEffect, WindEffect, ClearEffect
 */

import { cn } from '@/lib/utils';
import type { WeatherEffectType, WeatherMoodPalette } from '@/lib/weatherMoodConfig';

// ============================================
// WEATHER EFFECT COMPONENTS
// ============================================

function SunEffect({ intensity }: { intensity: string }) {
  const rayCount = intensity === 'heavy' ? 10 : intensity === 'medium' ? 8 : 6;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="animate-sun-rays origin-center">
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
        className="w-10 h-10 rounded-full animate-sun-pulse bg-[radial-gradient(circle,rgba(251,191,36,0.35)_0%,rgba(251,191,36,0.08)_70%,transparent_100%)]"
      />
    </div>
  );
}

function CloudsEffect({ intensity }: { intensity: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className={cn(
          'absolute rounded-full bg-foreground/[0.06] w-12 h-5 top-[20%] left-[10%] rounded-[20px]',
          intensity === 'light' ? 'animate-cloud-drift-slow' : 'animate-cloud-drift',
        )}
      />
      <div
        className="absolute rounded-full bg-foreground/[0.08] animate-cloud-drift w-14 h-[22px] top-[35%] left-[30%] rounded-[20px] [animation-delay:-2s]"
      />
      {intensity !== 'light' && (
        <div
          className="absolute rounded-full bg-foreground/[0.05] animate-cloud-drift-slow w-10 h-4 top-[55%] left-1/2 rounded-[16px]"
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
        className="absolute rounded-full bg-foreground/[0.1] animate-cloud-drift w-14 h-[22px] top-[15%] left-[15%] rounded-[20px]"
      />
      <div
        className="absolute rounded-full bg-foreground/[0.12] animate-cloud-drift w-12 h-[18px] top-[25%] left-[40%] rounded-[18px] [animation-delay:-3s]"
      />
      {/* Lightning bolt */}
      <svg
        className="absolute animate-lightning top-[45%] left-[48%] -translate-x-1/2"
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
        className="absolute rounded-full animate-fog-drift w-[70%] h-4 top-[30%] left-[10%] blur-[8px] bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.15),transparent)]"
      />
      <div
        className="absolute rounded-full animate-fog-drift-slow w-[60%] h-3.5 top-[55%] left-[20%] blur-[10px] bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.12),transparent)]"
      />
      {intensity !== 'light' && (
        <div
          className="absolute rounded-full animate-fog-drift w-1/2 h-3 top-3/4 left-[5%] blur-[12px] [animation-delay:-3s] bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.1),transparent)]"
        />
      )}
    </div>
  );
}

function AuroraEffect({ intensity, palette }: { intensity: string; palette: WeatherMoodPalette }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className={cn('absolute inset-0 bg-[length:200%_200%]', intensity === 'heavy' ? 'animate-aurora-fast' : 'animate-aurora')}
        style={{
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
          className="absolute animate-wind-sway h-[1.5px] rounded-sm bg-[linear-gradient(90deg,transparent,rgba(239,68,68,0.15),transparent)]"
          style={{
            top: `${25 + i * 22}%`,
            left: `${10 + i * 15}%`,
            width: `${40 - i * 8}%`,
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
        className="animate-aurora absolute inset-0 bg-[length:200%_200%] bg-[linear-gradient(135deg,rgba(45,212,191,0.06)_0%,transparent_50%,rgba(45,212,191,0.04)_100%)]"
      />
    </div>
  );
}

// ============================================
// DISPATCHER
// ============================================

export function WeatherEffectLayer({
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
