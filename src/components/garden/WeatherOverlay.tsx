/**
 * WeatherOverlay - CSS-only particle animation overlay for the garden.
 * Renders subtle background weather effects based on the current GardenWeather.
 * All animations gated behind motion-safe: to respect reduced-motion preferences.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { GardenWeather } from '@/types';

interface WeatherOverlayProps {
  weather: GardenWeather;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1.5 + Math.random() * 2.5,
    delay: Math.random() * 6,
    duration: 4 + Math.random() * 8,
    opacity: 0.1 + Math.random() * 0.3,
  }));
}

export function WeatherOverlay({ weather }: WeatherOverlayProps) {
  const particles = useMemo(() => generateParticles(8), []);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {weather === 'sunny' && particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-amber-300/40 blur-[1px]"
          style={{
            insetInlineStart: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animation: `garden-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}

      {weather === 'cloudy' && particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-gray-400/30 blur-sm"
          style={{
            insetInlineStart: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size + 4}px`,
            height: `${p.size + 4}px`,
            opacity: p.opacity * 0.6,
            animation: `garden-drift ${p.duration + 4}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}

      {weather === 'rainy' && particles.map((p) => (
        <div
          key={p.id}
          className="absolute bg-blue-400/40 rounded-full"
          style={{
            insetInlineStart: `${p.x}%`,
            top: `${p.y}%`,
            width: `${Math.max(1, p.size * 0.3)}px`,
            height: `${p.size + 6}px`,
            opacity: p.opacity * 0.7,
            animation: `garden-rain ${p.duration * 0.4}s linear ${p.delay}s infinite`,
          }}
        />
      ))}

      {weather === 'starry' && particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-white/60"
          style={{
            insetInlineStart: `${p.x}%`,
            top: `${p.y}%`,
            width: `${Math.max(2, p.size * 0.5)}px`,
            height: `${Math.max(2, p.size * 0.5)}px`,
            opacity: p.opacity,
            animation: `garden-twinkle ${p.duration * 0.6}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}

      {weather === 'aurora' && (
        <div
          className={cn(
            'absolute inset-0 opacity-20',
            'bg-gradient-to-b from-green-400/30 via-purple-400/20 to-transparent'
          )}
          style={{
            animation: 'garden-aurora 10s ease-in-out infinite',
          }}
        />
      )}

      {weather === 'magical' && particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full blur-[0.5px]"
          style={{
            insetInlineStart: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            background: `hsl(${(p.id * 30) % 360}, 80%, 70%)`,
            animation: `garden-sparkle ${p.duration * 0.5}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}

      {/* Keyframes injected via style tag — only rendered once */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes garden-float {
            0%, 100% { transform: translateY(0) scale(1); opacity: var(--tw-opacity, 0.4); }
            50% { transform: translateY(-12px) scale(1.2); opacity: 0.7; }
          }
          @keyframes garden-drift {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(20px); }
          }
          @keyframes garden-rain {
            0% { transform: translateY(-10px); opacity: 0; }
            20% { opacity: 0.7; }
            100% { transform: translateY(100vh); opacity: 0; }
          }
          @keyframes garden-twinkle {
            0%, 100% { opacity: 0.2; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.3); }
          }
          @keyframes garden-aurora {
            0%, 100% {
              background: linear-gradient(to bottom, rgba(74,222,128,0.25), rgba(192,132,252,0.15), transparent);
            }
            50% {
              background: linear-gradient(to bottom, rgba(192,132,252,0.25), rgba(56,189,248,0.15), transparent);
            }
          }
          @keyframes garden-sparkle {
            0%, 100% { transform: scale(0.6) rotate(0deg); opacity: 0.3; }
            50% { transform: scale(1.4) rotate(180deg); opacity: 0.9; }
          }
        }
      `}</style>
    </div>
  );
}

export default WeatherOverlay;
