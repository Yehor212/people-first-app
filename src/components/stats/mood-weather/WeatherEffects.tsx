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
