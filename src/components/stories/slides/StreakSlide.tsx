/**
 * StreakSlide - "Пламенный столб" (Flame Pillar)
 *
 * Premium redesign: Central vertical flame pillar
 * with streak number integrated into the fire.
 * Powerful, minimal, atmospheric design.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { StorySlide } from '@/lib/progressStories';

interface StreakSlideProps {
  slide: StorySlide;
}

// Ember particle rising from flame
function Ember({ id, baseX }: { id: number; baseX: number }) {
  const x = baseX + (Math.random() - 0.5) * 20;
  const size = 3 + Math.random() * 4;
  const duration = 4 + Math.random() * 3;
  const delay = Math.random() * 3;

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: `${x}%`,
        bottom: '35%',
        width: size,
        height: size,
        background: `radial-gradient(circle, #ffd700 0%, #ff6b00 50%, #ff4500 100%)`,
        boxShadow: `0 0 ${size * 2}px rgba(255,150,0,0.6)`,
      }}
      initial={{ y: 0, opacity: 0, scale: 1 }}
      animate={{
        y: [0, -200],
        opacity: [0, 1, 1, 0],
        scale: [1, 0.5],
        x: [0, (Math.random() - 0.5) * 60],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

export function StreakSlide({ slide }: StreakSlideProps) {
  const streak = Number(slide.value) || 0;

  // Generate embers (12 particles, centered around flame)
  const embers = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      baseX: 50, // centered
    })),
  []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Deep red-black cosmos background */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 80%,
            #2a0a0a 0%,
            #150303 40%,
            #0a0000 70%,
            #000000 100%
          )`,
        }}
      />

      {/* Fire nebula breathing */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
        style={{
          background: `
            radial-gradient(ellipse at 50% 60%, rgba(255,100,0,0.2) 0%, transparent 50%),
            radial-gradient(circle at 50% 80%, rgba(255,50,0,0.15) 0%, transparent 40%)
          `,
        }}
      />

      {/* Corner glows */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at top left, rgba(255,100,0,0.05) 0%, transparent 40%),
            radial-gradient(circle at bottom right, rgba(255,50,0,0.05) 0%, transparent 40%)
          `,
        }}
      />

      {/* Central flame pillar */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[15%] flex flex-col items-center">
        {/* Outer flame glow (blurred) */}
        <motion.div
          className="absolute"
          style={{
            width: 140,
            height: 320,
            bottom: 0,
            background: `linear-gradient(180deg,
              transparent 0%,
              rgba(255,200,50,0.2) 20%,
              rgba(255,150,0,0.4) 50%,
              rgba(255,100,0,0.6) 80%,
              rgba(255,50,0,0.8) 100%
            )`,
            borderRadius: '70px 70px 30px 30px',
            filter: 'blur(25px)',
          }}
          animate={{
            height: [300, 340, 300],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Middle flame layer */}
        <motion.div
          className="absolute"
          style={{
            width: 80,
            height: 260,
            bottom: 0,
            background: `linear-gradient(180deg,
              transparent 0%,
              rgba(255,220,100,0.4) 15%,
              rgba(255,180,50,0.7) 40%,
              rgba(255,120,0,0.9) 70%,
              #ff6b00 100%
            )`,
            borderRadius: '40px 40px 15px 15px',
            filter: 'blur(10px)',
          }}
          animate={{
            height: [250, 280, 250],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Core flame (brightest) */}
        <motion.div
          className="absolute"
          style={{
            width: 50,
            height: 200,
            bottom: 0,
            background: `linear-gradient(180deg,
              rgba(255,255,255,0.9) 0%,
              #fff8dc 15%,
              #ffd700 35%,
              #ff8c00 60%,
              #ff6b00 85%,
              #ff4500 100%
            )`,
            borderRadius: '25px 25px 10px 10px',
            boxShadow: `
              0 0 60px rgba(255,200,0,0.6),
              0 0 100px rgba(255,150,0,0.4),
              inset 0 -20px 40px rgba(255,100,0,0.5)
            `,
          }}
          animate={{
            height: [190, 220, 190],
            boxShadow: [
              '0 0 60px rgba(255,200,0,0.6), 0 0 100px rgba(255,150,0,0.4)',
              '0 0 80px rgba(255,200,0,0.8), 0 0 120px rgba(255,150,0,0.5)',
              '0 0 60px rgba(255,200,0,0.6), 0 0 100px rgba(255,150,0,0.4)',
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Base glow on ground */}
        <motion.div
          className="absolute -bottom-4"
          style={{
            width: 200,
            height: 30,
            background: 'radial-gradient(ellipse, rgba(255,100,0,0.5) 0%, transparent 70%)',
            filter: 'blur(15px)',
          }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      {/* Shockwave rings from flame base */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: `${12 + i * 3}%`,
            width: 180 + i * 50,
            height: 25 + i * 8,
            border: `1px solid rgba(255,150,0,${0.25 - i * 0.06})`,
            borderRadius: '50%',
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.25, 0.08, 0.25],
          }}
          transition={{
            duration: 3,
            delay: i * 0.6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Embers */}
      {embers.map((ember) => (
        <Ember key={ember.id} id={ember.id} baseX={ember.baseX} />
      ))}

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col items-center pt-16 pointer-events-none">
        {/* Streak number with flame glow */}
        <motion.div
          className="relative"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 100, delay: 0.3 }}
        >
          {/* Number glow background */}
          <motion.div
            className="absolute -inset-8 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,150,0,0.3) 0%, transparent 70%)',
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          <motion.div
            className="relative text-8xl font-black text-white"
            style={{
              textShadow: `
                0 0 40px rgba(255,200,0,0.8),
                0 0 80px rgba(255,150,0,0.5),
                0 4px 20px rgba(0,0,0,0.3)
              `,
            }}
            animate={{
              textShadow: [
                '0 0 40px rgba(255,200,0,0.8), 0 0 80px rgba(255,150,0,0.5)',
                '0 0 60px rgba(255,200,0,1), 0 0 100px rgba(255,150,0,0.7)',
                '0 0 40px rgba(255,200,0,0.8), 0 0 80px rgba(255,150,0,0.5)',
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            textShadow: '0 2px 15px rgba(0,0,0,0.5)',
          }}
        >
          Day Streak
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          className="text-lg text-orange-200/70 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {slide.subtitle}
        </motion.p>
      </div>

      {/* Top ambient heat glow */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(255,50,0,0.05) 0%, transparent 100%)',
        }}
      />
    </div>
  );
}

export default StreakSlide;
