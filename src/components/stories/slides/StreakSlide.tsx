/**
 * StreakSlide - "Вулкан силы" (Volcano of Power)
 *
 * Streak visualized as a powerful volcano with flowing lava,
 * rising embers, and heat distortion effects.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FireIcon } from '@/components/icons';
import type { StorySlide } from '@/lib/progressStories';

interface StreakSlideProps {
  slide: StorySlide;
}

// Ember Particle Component
function Ember({ id, intensity }: { id: number; intensity: number }) {
  const startX = 30 + Math.random() * 40;
  const duration = 2 + Math.random() * 2;
  const delay = Math.random() * 2;
  const size = 2 + Math.random() * 4;

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: `${startX}%`,
        bottom: '35%',
        width: size,
        height: size,
        background: `radial-gradient(circle, #FFD700 0%, #FF6B00 50%, #FF4500 100%)`,
        boxShadow: `0 0 ${size * 2}px #FF6B00`,
      }}
      initial={{ y: 0, opacity: 0, scale: 1 }}
      animate={{
        y: [-50, -250 * intensity],
        x: [0, (Math.random() - 0.5) * 100],
        opacity: [0, 1, 1, 0],
        scale: [1, 0.5],
      }}
      transition={{
        duration: duration / intensity,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

// Lava Flow Component
function LavaFlow({ x, width }: { x: number; width: number }) {
  return (
    <motion.div
      className="absolute"
      style={{
        left: `${x}%`,
        top: '50%',
        width: width,
        height: '50%',
        background: `linear-gradient(180deg,
          #FF4500 0%,
          #FF6B00 20%,
          #CC3300 40%,
          #991100 60%,
          #660000 80%,
          transparent 100%
        )`,
        borderRadius: '50% 50% 0 0',
        filter: 'blur(2px)',
      }}
      animate={{
        scaleY: [1, 1.1, 1],
        opacity: [0.8, 1, 0.8],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

export function StreakSlide({ slide }: StreakSlideProps) {
  const streak = Number(slide.value) || 0;
  const intensity = Math.min(streak / 30, 1) + 0.5; // Scale intensity with streak

  // Generate embers based on streak
  const embers = useMemo(() => {
    const count = Math.min(20 + streak * 2, 50);
    return Array.from({ length: count }, (_, i) => i);
  }, [streak]);

  // Generate fire icons
  const fireCount = Math.min(Math.max(3, Math.floor(streak / 3)), 7);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Dark sky with red glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg,
            #0a0000 0%,
            #1a0505 20%,
            #2d0a0a 40%,
            #4a1010 60%,
            #662020 80%,
            #883030 100%
          )`,
        }}
      />

      {/* Volcano glow on sky */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 3, repeat: Infinity }}
        style={{
          background: `radial-gradient(ellipse at 50% 80%, rgba(255, 100, 0, 0.4) 0%, transparent 50%)`,
        }}
      />

      {/* Volcano silhouette */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMax slice"
        style={{ height: '60%' }}
      >
        <defs>
          {/* Volcano gradient */}
          <linearGradient id="volcanoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2d1810" />
            <stop offset="50%" stopColor="#1a0f0a" />
            <stop offset="100%" stopColor="#0d0705" />
          </linearGradient>
          {/* Lava glow */}
          <filter id="lavaGlow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Main volcano shape */}
        <path
          d="M0 200 L100 200 L150 80 L180 60 L200 70 L220 60 L250 80 L300 200 L400 200 L400 0 L0 0 Z"
          fill="url(#volcanoGrad)"
        />

        {/* Crater opening with lava */}
        <motion.ellipse
          cx="200"
          cy="65"
          rx="30"
          ry="10"
          fill="#FF4500"
          filter="url(#lavaGlow)"
          animate={{
            fill: ['#FF4500', '#FF6B00', '#FF4500'],
            ry: [10, 12, 10],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Inner crater glow */}
        <motion.ellipse
          cx="200"
          cy="65"
          rx="20"
          ry="6"
          fill="#FFD700"
          animate={{
            opacity: [0.6, 1, 0.6],
            ry: [6, 8, 6],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />

        {/* Rock texture */}
        <circle cx="130" cy="150" r="8" fill="#1a0f0a" />
        <circle cx="270" cy="160" r="10" fill="#1a0f0a" />
        <circle cx="180" cy="180" r="6" fill="#0d0705" />
        <circle cx="220" cy="175" r="7" fill="#1a0f0a" />
      </svg>

      {/* Lava flows */}
      <LavaFlow x={45} width={15} />
      <LavaFlow x={52} width={8} />

      {/* Embers */}
      {embers.map((id) => (
        <Ember key={id} id={id} intensity={intensity} />
      ))}

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-start pt-12 px-8">
        {/* Fire icons row */}
        <motion.div
          className="flex gap-1 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {[...Array(fireCount)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1, type: 'spring' }}
              style={{
                filter: `drop-shadow(0 0 10px #FF6B00)`,
              }}
            >
              <FireIcon size="lg" animated />
            </motion.div>
          ))}
        </motion.div>

        {/* Big streak number */}
        <motion.div
          className="relative"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, delay: 0.5 }}
        >
          {/* Stone texture background */}
          <div
            className="absolute -inset-6 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, #3d2817 0%, #2a1810 50%, #1a0f0a 100%)`,
              boxShadow: `
                inset 0 2px 10px rgba(255, 200, 100, 0.2),
                0 0 40px rgba(255, 100, 0, 0.3)
              `,
            }}
          />

          {/* Glowing number */}
          <motion.div
            className="relative text-8xl font-black"
            style={{
              background: `linear-gradient(180deg, #FFD700 0%, #FF6B00 50%, #FF4500 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 40px rgba(255, 107, 0, 0.5)',
            }}
            animate={{
              textShadow: [
                '0 0 40px rgba(255, 107, 0, 0.5)',
                '0 0 60px rgba(255, 107, 0, 0.7)',
                '0 0 40px rgba(255, 107, 0, 0.5)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {streak}
          </motion.div>
        </motion.div>

        {/* "Day Streak" label */}
        <motion.h2
          className="text-2xl font-bold text-white mt-4 tracking-wider uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          style={{
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
          }}
        >
          Day Streak
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          className="text-lg text-orange-200/80 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          {slide.subtitle}
        </motion.p>
      </div>

      {/* Heat distortion overlay (subtle) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, transparent 0%, rgba(255, 100, 0, 0.05) 100%)`,
        }}
      />
    </div>
  );
}

export default StreakSlide;
