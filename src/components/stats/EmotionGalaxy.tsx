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

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

// 3-layer parallax star system
interface StarData {
  id: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

function Star({ x, y, size, opacity, duration, delay }: Omit<StarData, 'id'>) {
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
        opacity: [opacity * 0.5, opacity, opacity * 0.5],
        scale: [1, 1.3, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// Shooting star component - random occasional effect
function ShootingStar() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ startX: 20, startY: 15, angle: 40 });

  useEffect(() => {
    const triggerStar = () => {
      setPosition({
        startX: 10 + Math.random() * 40,
        startY: 5 + Math.random() * 25,
        angle: 25 + Math.random() * 35,
      });
      setVisible(true);
      setTimeout(() => setVisible(false), 800);
    };

    // Random interval between 6-12 seconds
    const scheduleNext = () => {
      const delay = 6000 + Math.random() * 6000;
      return setTimeout(() => {
        if (Math.random() > 0.4) triggerStar();
        scheduleNext();
      }, delay);
    };

    const timeout = scheduleNext();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute pointer-events-none z-20"
          style={{
            left: `${position.startX}%`,
            top: `${position.startY}%`,
            width: 50,
            height: 2,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 20%, rgba(139, 92, 246, 0.8) 100%)',
            borderRadius: 1,
            transformOrigin: 'left center',
          }}
          initial={{
            scaleX: 0,
            opacity: 0,
            rotate: position.angle,
            x: 0,
            y: 0,
          }}
          animate={{
            scaleX: [0, 1, 1, 0.5],
            opacity: [0, 1, 0.8, 0],
            x: [0, 60, 100],
            y: [0, 40, 70],
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}

// Premium Orbiting Emotion with comet trail and 3D effects
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
  // Elliptical orbit parameters - increased radius to avoid center hub overlap
  const baseRadius = 32 + (orbitIndex / Math.max(totalOrbits - 1, 1)) * 18;
  const rx = baseRadius * 2.8;        // X radius in pixels (wider)
  const ry = baseRadius * 0.65 * 2.8; // Y radius (ellipse - 65% of X for 3D look)

  // Size based on frequency (inner = more frequent = larger) - reduced for better fit
  const sizePx = 32 + (1 - orbitIndex / Math.max(totalOrbits - 1, 1)) * 10;

  // Kepler's law: inner orbits are significantly faster
  const keplerDuration = animationDuration * (0.8 + orbitIndex * 0.25);

  return (
    <>
      {/* Comet Trail - 4 fading segments that follow the emoji */}
      {[0, 1, 2, 3].map((trailIndex) => {
        const trailOffset = (trailIndex + 1) * 12; // Degrees behind
        const trailOpacity = 0.35 - trailIndex * 0.08;
        const trailSize = sizePx * (0.7 - trailIndex * 0.12);
        const trailBlur = 3 + trailIndex * 2;

        return (
          <motion.div
            key={`trail-${orbitIndex}-${trailIndex}`}
            className="absolute pointer-events-none"
            style={{
              left: '50%',
              top: '50%',
              width: 1,
              height: 1,
              transformOrigin: '0 0',
            }}
            animate={{ rotate: [angle - trailOffset, angle - trailOffset + 360] }}
            transition={{
              duration: keplerDuration,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                left: 0,
                top: 0,
                width: trailSize,
                height: trailSize,
                marginLeft: -trailSize / 2,
                marginTop: -trailSize / 2,
                transform: `translateX(${rx}px)`,
                background: `radial-gradient(circle, ${emotion.color}${Math.round(trailOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
                filter: `blur(${trailBlur}px)`,
              }}
            />
          </motion.div>
        );
      })}

      {/* Main Emoji Orb - Rotating wrapper */}
      <motion.div
        className="absolute"
        style={{
          left: '50%',
          top: '50%',
          width: 1,
          height: 1,
          transformOrigin: '0 0',
        }}
        animate={{ rotate: [angle, angle + 360] }}
        transition={{
          duration: keplerDuration,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        {/* Emoji container positioned at elliptical orbit radius */}
        <motion.div
          className="absolute"
          style={{
            left: 0,
            top: 0,
            width: sizePx,
            height: sizePx,
            marginLeft: -sizePx / 2,
            marginTop: -sizePx / 2,
            transform: `translateX(${rx}px)`,
          }}
          // Counter-rotate to keep emoji upright
          animate={{ rotate: [-angle, -angle - 360] }}
          transition={{
            duration: keplerDuration,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {/* Outer glow halo */}
          <motion.div
            className="absolute rounded-full"
            style={{
              inset: -6,
              background: `radial-gradient(circle, ${emotion.color}30 0%, ${emotion.color}10 40%, transparent 70%)`,
              filter: 'blur(6px)',
            }}
            animate={{
              scale: [1.1, 1.4, 1.1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Inner glow ring with multi-layer shadow */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${emotion.color}40 0%, ${emotion.color}20 50%, ${emotion.color}10 100%)`,
              boxShadow: `
                0 0 12px ${emotion.color}70,
                0 0 24px ${emotion.color}40,
                inset 0 0 10px ${emotion.color}30,
                inset 2px 2px 4px rgba(255,255,255,0.15)
              `,
            }}
            animate={{
              boxShadow: [
                `0 0 12px ${emotion.color}70, 0 0 24px ${emotion.color}40, inset 0 0 10px ${emotion.color}30, inset 2px 2px 4px rgba(255,255,255,0.15)`,
                `0 0 18px ${emotion.color}90, 0 0 36px ${emotion.color}50, inset 0 0 14px ${emotion.color}40, inset 2px 2px 6px rgba(255,255,255,0.2)`,
                `0 0 12px ${emotion.color}70, 0 0 24px ${emotion.color}40, inset 0 0 10px ${emotion.color}30, inset 2px 2px 4px rgba(255,255,255,0.15)`,
              ],
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
            style={{
              fontSize: sizePx * 0.52,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            }}
          >
            {emotion.emoji}
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

export function EmotionGalaxy({ emotions, totalEntries, className }: EmotionGalaxyProps) {
  const { t } = useLanguage();

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
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            'radial-gradient(ellipse at 25% 35%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
            'radial-gradient(ellipse at 35% 25%, rgba(139, 92, 246, 0.22) 0%, transparent 55%)',
            'radial-gradient(ellipse at 25% 35%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Animated Nebula Layer 2 - Pink drift (opposite direction) */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            'radial-gradient(ellipse at 75% 65%, rgba(236, 72, 153, 0.1) 0%, transparent 45%)',
            'radial-gradient(ellipse at 65% 75%, rgba(236, 72, 153, 0.16) 0%, transparent 50%)',
            'radial-gradient(ellipse at 75% 65%, rgba(236, 72, 153, 0.1) 0%, transparent 45%)',
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Animated Nebula Layer 3 - Cyan accent */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            'radial-gradient(ellipse at 50% 80%, rgba(6, 182, 212, 0.06) 0%, transparent 40%)',
            'radial-gradient(ellipse at 55% 75%, rgba(6, 182, 212, 0.1) 0%, transparent 45%)',
            'radial-gradient(ellipse at 50% 80%, rgba(6, 182, 212, 0.06) 0%, transparent 40%)',
          ],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Shooting Star */}
      <ShootingStar />

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
        {/* SVG for elliptical orbit paths with 3D tilt */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {/* Center glow gradient */}
          <defs>
            <radialGradient id="centerGlowPremium" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(139, 92, 246, 0.5)" />
              <stop offset="40%" stopColor="rgba(139, 92, 246, 0.2)" />
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

          <circle cx={50} cy={50} r={12} fill="url(#centerGlowPremium)" />

          {/* Elliptical orbit paths with 3D tilt - increased radius to match emoji positions */}
          {sortedEmotions.map((_, i) => {
            const baseRadius = 32 + (i / Math.max(sortedEmotions.length - 1, 1)) * 18;
            const rx = baseRadius;
            const ry = baseRadius * 0.65; // Ellipse ratio for 3D effect
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
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="0.4"
                strokeDasharray="2.5 2"
                filter="url(#orbitGlow)"
              >
                {/* Animated orbit glow pulse */}
                <animate
                  attributeName="stroke-opacity"
                  values="0.1;0.22;0.1"
                  dur={`${4 + i * 0.8}s`}
                  repeatCount="indefinite"
                />
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

        {/* Premium Center Hub - z-10 to appear behind orbiting emojis */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          {/* Outer expanding pulse ring - reduced size */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 75,
              height: 75,
              border: '1px solid rgba(139, 92, 246, 0.25)',
            }}
            animate={{
              scale: [1, 1.35, 1],
              opacity: [0.4, 0, 0.4],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeOut' }}
          />

          {/* Secondary pulse ring (offset timing) - reduced size */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 70,
              height: 70,
              border: '1px solid rgba(139, 92, 246, 0.2)',
            }}
            animate={{
              scale: [1, 1.25, 1],
              opacity: [0.3, 0, 0.3],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeOut', delay: 1.2 }}
          />

          {/* Inner glow orb - reduced size for better emoji visibility */}
          <motion.div
            className="flex flex-col items-center justify-center rounded-full"
            style={{
              width: 64,
              height: 64,
              background: `
                radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.18) 0%, transparent 45%),
                radial-gradient(circle, rgba(139, 92, 246, 0.45) 0%, rgba(139, 92, 246, 0.18) 50%, rgba(139, 92, 246, 0.06) 100%)
              `,
              boxShadow: `
                0 0 30px rgba(139, 92, 246, 0.5),
                0 0 60px rgba(139, 92, 246, 0.3),
                inset 0 0 20px rgba(255, 255, 255, 0.1)
              `,
            }}
            animate={{
              boxShadow: [
                '0 0 30px rgba(139, 92, 246, 0.5), 0 0 60px rgba(139, 92, 246, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)',
                '0 0 40px rgba(139, 92, 246, 0.7), 0 0 80px rgba(139, 92, 246, 0.4), inset 0 0 25px rgba(255, 255, 255, 0.15)',
                '0 0 30px rgba(139, 92, 246, 0.5), 0 0 60px rgba(139, 92, 246, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)',
              ],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.span
              className="text-2xl font-bold text-white"
              style={{ textShadow: '0 0 12px rgba(139, 92, 246, 0.9)' }}
            >
              {totalEntries}
            </motion.span>
            <span className="text-xs text-purple-300/90">{t.entries || 'entries'}</span>
          </motion.div>
        </div>
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
            <motion.span
              className="text-sm"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
            >
              {emotion.emoji}
            </motion.span>
            <span className="text-xs text-white/80 font-medium">{emotion.count}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default EmotionGalaxy;
