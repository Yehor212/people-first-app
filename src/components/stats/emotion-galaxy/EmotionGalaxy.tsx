/**
 * EmotionGalaxy - "Галактика Емоцій" (Emotion Galaxy)
 *
 * PREMIUM Orbital visualization of emotion distribution with:
 * - 3-layer parallax star field for depth
 * - Animated drifting nebula clouds
 * - Elliptical 3D-tilted orbits (not circles)
 * - Comet trails following emojis
 * - Kepler's Laws (inner orbits faster)
 * - 3D scale effect (closer = larger)
 * - Multi-layer glow effects
 * - Shooting stars (random occasional)
 * - Premium pulsing center hub
 */

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useShouldAnimate } from '@/hooks/useShouldAnimate';
import { SparklesIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

import type { EmotionGalaxyProps, StarData } from './types';
import { Star } from './Star';
import { ShootingStar } from './ShootingStar';
import { OrbitingEmotion } from './OrbitingEmotion';

export function EmotionGalaxy({ emotions, totalEntries: _totalEntries, className }: EmotionGalaxyProps) {
  const { t } = useLanguage();
  const animate = useShouldAnimate();

  // Sort emotions by count (most frequent first = inner orbit)
  const sortedEmotions = useMemo(
    () => [...emotions].sort((a, b) => b.count - a.count).slice(0, 6),
    [emotions]
  );

  // Generate 3-layer parallax star field
  const starLayers = useMemo(() => {
    // Layer 1: Distant stars (smallest, slowest twinkle)
    const distant: StarData[] = Array.from({ length: 25 }, (_, i) => ({
      id: `distant-${i}`,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 0.8 + Math.random() * 0.7,
      opacity: 0.3 + Math.random() * 0.25,
      duration: 4 + Math.random() * 2,
      delay: Math.random() * 3,
    }));

    // Layer 2: Mid-distance stars
    const mid: StarData[] = Array.from({ length: 15 }, (_, i) => ({
      id: `mid-${i}`,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1.2 + Math.random() * 1,
      opacity: 0.4 + Math.random() * 0.3,
      duration: 2.5 + Math.random() * 1.5,
      delay: Math.random() * 2,
    }));

    // Layer 3: Near stars (largest, fastest twinkle)
    const near: StarData[] = Array.from({ length: 8 }, (_, i) => ({
      id: `near-${i}`,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1.8 + Math.random() * 1.5,
      opacity: 0.5 + Math.random() * 0.4,
      duration: 1.5 + Math.random() * 1,
      delay: Math.random() * 1.5,
    }));

    return { distant, mid, near };
  }, []);

  // Calculate angle offsets for each emotion to spread them around
  const emotionAngles = useMemo(() => {
    return sortedEmotions.map((_, i) => (360 / Math.max(sortedEmotions.length, 1)) * i + 30);
  }, [sortedEmotions]);

  // Animation durations (base duration, Kepler adjustment happens in component)
  const animationDurations = useMemo(() => {
    return sortedEmotions.map((_, i) => 12 + i * 4);
  }, [sortedEmotions]);

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl",
      "shadow-lg shadow-black/10 dark:shadow-none",
      "ring-1 ring-black/5 dark:ring-0",
      className
    )}>
      {/* Theme-aware deep space background */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-violet-50 via-purple-50/60 to-indigo-50 dark:bg-none"
      />
      <div className="zf-emotion-galaxy-cosmic-background absolute inset-0 hidden dark:block" />

      {/* 3-Layer Parallax Stars */}
      {/* Layer 1: Distant (back) */}
      {starLayers.distant.map((star) => (
        <Star key={star.id} {...star} />
      ))}
      {/* Layer 2: Mid */}
      {starLayers.mid.map((star) => (
        <Star key={star.id} {...star} />
      ))}
      {/* Layer 3: Near (front) */}
      {starLayers.near.map((star) => (
        <Star key={star.id} {...star} />
      ))}

      {/* Animated Nebula Layer 1 - Purple drift */}
      <div
        className="absolute inset-0 pointer-events-none animate-zen-loop-fade-scale"
        style={{
          background: 'radial-gradient(ellipse at 30% 30%, hsl(var(--cosmic-nebula-purple) / 0.18) 0%, transparent 52%)',
          opacity: 0.9,
          '--zen-loop-min-opacity': 0.8,
          '--zen-loop-max-opacity': 1,
          '--zen-loop-scale': 1.03,
          '--zen-loop-duration': '8s',
        } as CSSProperties}
      />

      {/* Animated Nebula Layer 2 - Pink drift (opposite direction) */}
      <div
        className="absolute inset-0 pointer-events-none animate-zen-loop-fade-scale"
        style={{
          background: 'radial-gradient(ellipse at 70% 70%, hsl(var(--cosmic-nebula-pink) / 0.13) 0%, transparent 47%)',
          opacity: 0.9,
          '--zen-loop-min-opacity': 0.75,
          '--zen-loop-max-opacity': 1,
          '--zen-loop-scale': 1.03,
          '--zen-loop-duration': '10s',
        } as CSSProperties}
      />

      {/* Animated Nebula Layer 3 - Cyan accent */}
      <div
        className="absolute inset-0 pointer-events-none animate-zen-loop-fade-scale"
        style={{
          background: 'radial-gradient(ellipse at 52% 77%, hsl(var(--cosmic-nebula-cyan) / 0.08) 0%, transparent 42%)',
          opacity: 0.9,
          '--zen-loop-min-opacity': 0.75,
          '--zen-loop-max-opacity': 1,
          '--zen-loop-scale': 1.03,
          '--zen-loop-duration': '12s',
        } as CSSProperties}
      />

      {/* Shooting Star */}
      <ShootingStar />

      {/* Title */}
      <motion.div
        className="absolute top-4 start-4 z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-200 flex items-center gap-2">
          <SparklesIcon size="sm" animated />
          {t.emotionDistribution || 'Emotion Distribution'}
        </h3>
      </motion.div>

      {/* Galaxy Container */}
      <div className="relative min-h-[280px] w-full">
        {/* SVG for elliptical orbit paths with 3D tilt */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {/* Center glow gradient */}
          <defs>
            <radialGradient id="centerGlowPremium" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--cosmic-nebula-purple) / 0.5)" />
              <stop offset="40%" stopColor="hsl(var(--cosmic-nebula-purple) / 0.2)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            {/* Orbit glow filter */}
            <filter id="orbitGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* CENTER GLOW REMOVED - empty center now */}

          {/* Elliptical orbit paths with 3D tilt - matches HTML emoji positions */}
          {sortedEmotions.map((_, i) => {
            // SVG units: viewBox is 0-100, so divide HTML pixels by ~2.8
            const rx = (80 + i * 15) / 2.8;  // ~29-55 in SVG units
            const ry = rx * 0.5;             // Flatter ellipse
            const tilt = -12; // Tilt angle for 3D perspective

            return (
              <ellipse
                key={`orbit-${i}`}
                cx={50}
                cy={50}
                rx={rx}
                ry={ry}
                transform={`rotate(${tilt} 50 50)`}
                fill="none"
                stroke="hsl(var(--cosmic-orbit-stroke))"
                strokeOpacity="0.2"
                strokeWidth="0.4"
                strokeDasharray="2.5 2"
                filter="url(#orbitGlow)"
              >
                {/* Animated orbit glow pulse — SMIL is outside the CSS
                    kill-switch, so it is gated explicitly (WCAG 2.2.2). */}
                {animate && (
                  <animate
                    attributeName="stroke-opacity"
                    values="0.1;0.22;0.1"
                    dur={`${4 + i * 0.8}s`}
                    repeatCount="indefinite"
                  />
                )}
              </ellipse>
            );
          })}
        </svg>

        {/* HTML overlay for orbiting emojis with comet trails - z-20 to appear above center hub */}
        <div className="absolute inset-0 z-20">
          {sortedEmotions.map((emotion, i) => (
            <OrbitingEmotion
              key={emotion.emotion}
              emotion={emotion}
              orbitIndex={i}
              totalOrbits={sortedEmotions.length}
              angle={emotionAngles[i]}
              animationDuration={animationDurations[i]}
            />
          ))}
        </div>

        {/* CENTER HUB REMOVED - only orbiting emojis now */}
      </div>

      {/* Premium Legend at bottom */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 px-3 flex-wrap">
        {sortedEmotions.slice(0, 4).map((emotion, index) => (
          <motion.div
            key={emotion.emotion}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-default"
            style={{
              background: `linear-gradient(135deg, ${emotion.color}25 0%, ${emotion.color}15 100%)`,
              boxShadow: `0 0 8px ${emotion.color}30`,
            }}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{
              scale: 1.08,
              boxShadow: `0 0 14px ${emotion.color}50`,
            }}
          >
            <span
              className="text-sm animate-zen-loop-scale"
              style={{ '--zen-loop-scale': 1.1, '--zen-loop-duration': '2s', '--zen-loop-delay': `${index * 0.3}s` } as CSSProperties}
            >
              {emotion.emoji}
            </span>
            <span className="text-xs text-slate-700 dark:text-white/80 font-medium">{emotion.count}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default EmotionGalaxy;
