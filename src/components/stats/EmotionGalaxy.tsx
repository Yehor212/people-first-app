/**
 * EmotionGalaxy - "Галактика Емоцій" (Emotion Galaxy)
 *
 * Orbital visualization of emotion distribution with:
 * - Emojis orbiting around center
 * - Size = frequency (more emotions = larger & closer)
 * - Dashed orbit paths
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

// Orbiting emotion component - uses SVG units (viewBox 0-100)
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
  // Calculate orbit radius in SVG units (viewBox is 0-100, center is 50,50)
  const minRadius = 18;
  const maxRadius = 40;
  const radius = minRadius + (orbitIndex / Math.max(totalOrbits - 1, 1)) * (maxRadius - minRadius);

  // Size based on frequency (inner = more frequent = larger)
  const size = 12 + (1 - orbitIndex / Math.max(totalOrbits - 1, 1)) * 8;

  // Calculate position using trigonometry (angle in degrees -> radians)
  const angleRad = (angle * Math.PI) / 180;
  const cx = 50 + radius * Math.cos(angleRad);
  const cy = 50 + radius * Math.sin(angleRad);

  return (
    <motion.g
      style={{ transformOrigin: '50 50' }}
      animate={{ rotate: 360 }}
      transition={{
        duration: animationDuration,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {/* Orbit path (dashed circle) */}
      <circle
        cx={50}
        cy={50}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />

      {/* Emotion glow background */}
      <circle
        cx={cx}
        cy={cy}
        r={size / 2 + 2}
        fill={`${emotion.color}30`}
        style={{ filter: `drop-shadow(0 0 3px ${emotion.color})` }}
      >
        <animate
          attributeName="r"
          values={`${size / 2 + 1};${size / 2 + 3};${size / 2 + 1}`}
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Emoji via foreignObject with proper SVG coordinates */}
      <foreignObject
        x={cx - size / 2}
        y={cy - size / 2}
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ fontSize: `${size * 0.7}px` }}
        >
          {emotion.emoji}
        </div>
      </foreignObject>
    </motion.g>
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

      {/* Galaxy SVG */}
      <svg className="w-full h-full" viewBox="0 0 100 100" style={{ minHeight: 280 }}>
        {/* Center glow */}
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(139, 92, 246, 0.4)" />
            <stop offset="50%" stopColor="rgba(139, 92, 246, 0.1)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle cx={50} cy={50} r={15} fill="url(#centerGlow)" />

        {/* Orbiting emotions */}
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

        {/* Center content */}
        <foreignObject x={35} y={38} width={30} height={24}>
          <motion.div
            className="w-full h-full flex flex-col items-center justify-center rounded-full"
            style={{
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
            <span className="text-lg font-bold text-white">{totalEntries}</span>
            <span className="text-[10px] text-purple-300">{t.entries || 'entries'}</span>
          </motion.div>
        </foreignObject>
      </svg>

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
