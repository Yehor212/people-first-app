import type { CSSProperties } from 'react';
import type { EmotionData } from './types';

// Premium Orbiting Emotion with comet trail and 3D effects
export function OrbitingEmotion({
  emotion,
  orbitIndex,
  totalOrbits,
  angle,
  animationDuration,
}: {
  emotion: EmotionData;
  orbitIndex: number;
  totalOrbits: number;
  angle: number;
  animationDuration: number;
}) {
  // Elliptical orbit parameters - VERY large radius to guarantee empty center
  // Min radius = 80px, ensures NO emoji can be in center
  const rx = 80 + orbitIndex * 15;    // X radius: 80-155px (ALWAYS far from center!)
  const _ry = rx * 0.5;                // Y radius: 40-78px

  // Size based on frequency (inner = more frequent = larger)
  const sizePx = 38 + (1 - orbitIndex / Math.max(totalOrbits - 1, 1)) * 14;

  // Kepler's law: inner orbits are significantly faster
  const keplerDuration = animationDuration * (0.8 + orbitIndex * 0.25);

  // Inner glow ring — base and peak states for the CSS glow loop.
  const glowA = `0 0 12px ${emotion.color}70, 0 0 24px ${emotion.color}40, inset 0 0 10px ${emotion.color}30, inset 2px 2px 4px rgba(255,255,255,0.15)`;
  const glowB = `0 0 18px ${emotion.color}90, 0 0 36px ${emotion.color}50, inset 0 0 14px ${emotion.color}40, inset 2px 2px 6px rgba(255,255,255,0.2)`;

  return (
    <>
      {/* Comet Trail - 4 fading segments that follow the emoji */}
      {[0, 1, 2, 3].map((trailIndex) => {
        const trailOffset = (trailIndex + 1) * 12; // Degrees behind
        const trailOpacity = 0.35 - trailIndex * 0.08;
        const trailSize = sizePx * (0.7 - trailIndex * 0.12);
        const trailBlur = 3 + trailIndex * 2;

        return (
          <div
            key={`trail-${orbitIndex}-${trailIndex}`}
            className="absolute pointer-events-none left-1/2 top-1/2 h-px w-px origin-top-left animate-zen-loop-orbit"
            style={{
              transform: `rotate(${angle - trailOffset}deg)`,
              '--zen-orbit-start': `${angle - trailOffset}deg`,
              '--zen-loop-duration': `${keplerDuration}s`,
              '--zen-loop-timing': 'linear',
            } as CSSProperties}
          >
            <div
              className="absolute rounded-full"
              style={{
                left: rx,  // Position at orbit radius
                top: 0,
                width: trailSize,
                height: trailSize,
                marginLeft: -trailSize / 2,
                marginTop: -trailSize / 2,
                background: `radial-gradient(circle, ${emotion.color}${Math.round(trailOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
                filter: `blur(${trailBlur}px)`,
              }}
            />
          </div>
        );
      })}

      {/* Main Emoji Orb - Rotating wrapper */}
      <div
        className="absolute left-1/2 top-1/2 h-px w-px origin-top-left animate-zen-loop-orbit"
        style={{
          transform: `rotate(${angle}deg)`,
          '--zen-orbit-start': `${angle}deg`,
          '--zen-loop-duration': `${keplerDuration}s`,
          '--zen-loop-timing': 'linear',
        } as CSSProperties}
      >
        {/* Emoji container positioned at orbit radius using calc() */}
        <div
          className="absolute animate-zen-loop-orbit-reverse"
          style={{
            left: rx,      // Position directly at rx pixels from rotation center
            top: 0,
            width: sizePx,
            height: sizePx,
            marginLeft: -sizePx / 2,
            marginTop: -sizePx / 2,
            // Counter-rotate to keep emoji upright
            transform: `rotate(${-angle}deg)`,
            '--zen-orbit-start': `${-angle}deg`,
            '--zen-loop-duration': `${keplerDuration}s`,
            '--zen-loop-timing': 'linear',
          } as CSSProperties}
        >
          {/* Outer glow halo - NO BLUR for clarity */}
          <div
            className="absolute rounded-full -inset-1 animate-zen-loop-fade-scale"
            style={{
              background: `radial-gradient(circle, ${emotion.color}20 0%, transparent 70%)`,
              opacity: 0.4,
              '--zen-loop-min-opacity': 0.3,
              '--zen-loop-max-opacity': 0.5,
              '--zen-loop-scale': 1.2,
              '--zen-loop-duration': '2.5s',
            } as CSSProperties}
          />

          {/* Inner glow ring with multi-layer shadow */}
          <div
            className="absolute inset-0 rounded-full animate-zen-loop-glow"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${emotion.color}40 0%, ${emotion.color}20 50%, ${emotion.color}10 100%)`,
              boxShadow: glowA,
              '--zen-glow-a': glowA,
              '--zen-glow-b': glowB,
              '--zen-loop-duration': '2s',
            } as CSSProperties}
          />

          {/* Emoji */}
          <div
            className="absolute inset-0 flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
            style={{
              fontSize: sizePx * 0.52,
            }}
          >
            {emotion.emoji}
          </div>
        </div>
      </div>
    </>
  );
}
