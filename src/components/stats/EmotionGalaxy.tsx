/**
 * EmotionGalaxy - "Галактика Емоцій" (Emotion Galaxy)
 *
 * Orbital visualization of emotion distribution with:
 * - Emojis orbiting around center using HTML overlays + Framer Motion
 * - Size = frequency (more emotions = larger & closer)
 * - Dashed orbit paths (SVG)
 * - Star field background
 * - Glow effects per emotion color
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { SparklesIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface EmotionData {
  emotion: string;
  emoji: string;
  count: number;
  color: string;
}

interface EmotionGalaxyProps {
  emotions: EmotionData[];
  totalEntries: number;
  className?: string;
}

// Star in background
function Star({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-white"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
      }}
      animate={{
        opacity: [0.3, 0.8, 0.3],
        scale: [1, 1.2, 1],
      }}
      transition={{
        duration: 2 + Math.random() * 2,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// Orbiting emotion component - uses HTML with Framer Motion for reliable animation
// Approach: A wrapper div rotates around the galaxy center, with emoji positioned at orbit radius
function OrbitingEmotion({
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
  // Calculate orbit radius as percentage (matching SVG viewBox 0-100, scaled to container)
  const minRadiusPercent = 18;
  const maxRadiusPercent = 40;
  const radiusPercent = minRadiusPercent + (orbitIndex / Math.max(totalOrbits - 1, 1)) * (maxRadiusPercent - minRadiusPercent);

  // Size based on frequency (inner = more frequent = larger)
  const sizePx = 32 + (1 - orbitIndex / Math.max(totalOrbits - 1, 1)) * 12;

  return (
    // Orbit wrapper: positioned at center, rotates around its own center
    <motion.div
      className="absolute"
      style={{
        left: '50%',
        top: '50%',
        width: 1,           // Must have dimensions for Framer Motion rotation
        height: 1,          // Must have dimensions for Framer Motion rotation
        transformOrigin: '0 0',  // Rotate around the center point (50%, 50% of parent)
      }}
      animate={{ rotate: [angle, angle + 360] }}
      transition={{
        duration: animationDuration,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {/* Emoji positioned at orbit radius (translate outward from center) */}
      <motion.div
        className="absolute"
        style={{
          // Translate to orbit position (radius as % of parent, but parent is 280px)
          // We use transform to position at the orbit radius
          left: 0,
          top: 0,
          width: sizePx,
          height: sizePx,
          marginLeft: -sizePx / 2,
          marginTop: -sizePx / 2,
          // Position at orbit radius (radiusPercent of 280px container ≈ radius * 2.8)
          transform: `translateX(${radiusPercent * 2.8}px)`,
        }}
        // Counter-rotate to keep emoji upright
        animate={{ rotate: [-angle, -angle - 360] }}
        transition={{
          duration: animationDuration,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        {/* Glow background */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `${emotion.color}30`,
            boxShadow: `0 0 12px ${emotion.color}60`,
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.6, 0.9, 0.6],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Emoji */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontSize: sizePx * 0.55 }}
        >
          {emotion.emoji}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function EmotionGalaxy({ emotions, totalEntries, className }: EmotionGalaxyProps) {
  const { t } = useLanguage();

  // Sort emotions by count (most frequent first = inner orbit)
  const sortedEmotions = useMemo(
    () => [...emotions].sort((a, b) => b.count - a.count).slice(0, 6),
    [emotions]
  );

  // Generate stars
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2,
        delay: Math.random() * 3,
      })),
    []
  );

  // Calculate angle offsets for each emotion to spread them around
  const emotionAngles = useMemo(() => {
    return sortedEmotions.map((_, i) => (360 / sortedEmotions.length) * i);
  }, [sortedEmotions]);

  // Animation durations (slower for outer orbits)
  const animationDurations = useMemo(() => {
    return sortedEmotions.map((_, i) => 15 + i * 5);
  }, [sortedEmotions]);

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl",
      // Light mode: add shadow and ring for visual separation
      "shadow-lg shadow-black/10 dark:shadow-none",
      "ring-1 ring-black/5 dark:ring-0",
      className
    )}>
      {/* Deep space background */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center,
            #1a1a3e 0%,
            #0d0d2a 40%,
            #050510 100%)`,
        }}
      />

      {/* Stars */}
      {stars.map((star) => (
        <Star key={star.id} {...star} />
      ))}

      {/* Nebula glow effects */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
        style={{
          background: `
            radial-gradient(circle at 30% 30%, rgba(139, 92, 246, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 70% 70%, rgba(236, 72, 153, 0.1) 0%, transparent 40%)
          `,
        }}
      />

      {/* Title */}
      <motion.div
        className="absolute top-4 left-4 z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-sm font-semibold text-purple-200 flex items-center gap-2">
          <SparklesIcon size="sm" animated />
          {t.emotionDistribution || 'Emotion Distribution'}
        </h3>
      </motion.div>

      {/* Galaxy Container */}
      <div className="relative w-full" style={{ minHeight: 280 }}>
        {/* SVG for orbit paths only */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {/* Center glow */}
          <defs>
            <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(139, 92, 246, 0.4)" />
              <stop offset="50%" stopColor="rgba(139, 92, 246, 0.1)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <circle cx={50} cy={50} r={15} fill="url(#centerGlow)" />

          {/* Orbit paths (dashed circles) */}
          {sortedEmotions.map((_, i) => {
            const minRadius = 18;
            const maxRadius = 40;
            const radius = minRadius + (i / Math.max(sortedEmotions.length - 1, 1)) * (maxRadius - minRadius);
            return (
              <circle
                key={`orbit-${i}`}
                cx={50}
                cy={50}
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
            );
          })}
        </svg>

        {/* HTML overlay for orbiting emojis */}
        <div className="absolute inset-0">
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

        {/* Center content (HTML) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            className="flex flex-col items-center justify-center rounded-full"
            style={{
              width: 70,
              height: 70,
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 100%)',
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
            }}
            animate={{
              scale: [1, 1.05, 1],
              boxShadow: [
                '0 0 20px rgba(139, 92, 246, 0.4)',
                '0 0 30px rgba(139, 92, 246, 0.6)',
                '0 0 20px rgba(139, 92, 246, 0.4)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <span className="text-xl font-bold text-white">{totalEntries}</span>
            <span className="text-xs text-purple-300">{t.entries || 'entries'}</span>
          </motion.div>
        </div>
      </div>

      {/* Legend at bottom */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3 px-4">
        {sortedEmotions.slice(0, 4).map((emotion) => (
          <motion.div
            key={emotion.emotion}
            className="flex items-center gap-1 px-2 py-1 rounded-full"
            style={{ background: `${emotion.color}20` }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.1 }}
          >
            <span className="text-sm">{emotion.emoji}</span>
            <span className="text-xs text-white/70">{emotion.count}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default EmotionGalaxy;
