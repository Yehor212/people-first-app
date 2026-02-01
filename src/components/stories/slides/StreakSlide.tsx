/**
 * StreakSlide - "Священное пламя" (Sacred Flame)
 *
 * Premium redesign v2: Organic SVG-based flame
 * with multiple animated layers and rotating energy rings.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { StorySlide } from '@/lib/progressStories';

interface StreakSlideProps {
  slide: StorySlide;
}

// Ember particle with better visibility
function Ember({ delay, startX }: { delay: number; startX: number }) {
  const size = 4 + Math.random() * 5;

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: `${startX}%`,
        bottom: '40%',
        width: size,
        height: size,
        background: `radial-gradient(circle, #fff 0%, #ffd700 30%, #ff6b00 70%, transparent 100%)`,
        boxShadow: `0 0 ${size * 3}px rgba(255,200,0,0.8)`,
      }}
      animate={{
        y: [0, -300],
        x: [0, (Math.random() - 0.5) * 80],
        opacity: [0, 1, 1, 0],
        scale: [0.5, 1, 0.8, 0.3],
      }}
      transition={{
        duration: 3 + Math.random() * 2,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

// Animated flame tongue component
function FlameTongue({
  delay,
  scale,
  offsetX,
  duration,
}: {
  delay: number;
  scale: number;
  offsetX: number;
  duration: number;
}) {
  return (
    <motion.div
      className="absolute bottom-0 left-1/2"
      style={{
        width: 60 * scale,
        marginLeft: -30 * scale + offsetX,
        transformOrigin: 'bottom center',
      }}
      animate={{
        scaleX: [1, 0.9, 1.1, 0.95, 1],
        scaleY: [1, 1.05, 0.95, 1.02, 1],
      }}
      transition={{
        duration: duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <svg
        viewBox="0 0 60 180"
        className="w-full"
        style={{ height: 220 * scale }}
      >
        <defs>
          <linearGradient id={`flameGrad-${delay}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ff4500" stopOpacity="0.9" />
            <stop offset="25%" stopColor="#ff6b00" />
            <stop offset="50%" stopColor="#ffa500" />
            <stop offset="75%" stopColor="#ffd700" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
          </linearGradient>
          <filter id={`flameBlur-${delay}`}>
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>
        <motion.path
          d="M30 180
             Q15 140 20 100
             Q22 70 25 50
             Q28 25 30 5
             Q32 25 35 50
             Q38 70 40 100
             Q45 140 30 180"
          fill={`url(#flameGrad-${delay})`}
          filter={`url(#flameBlur-${delay})`}
          animate={{
            d: [
              "M30 180 Q15 140 20 100 Q22 70 25 50 Q28 25 30 5 Q32 25 35 50 Q38 70 40 100 Q45 140 30 180",
              "M30 180 Q12 145 18 95 Q20 65 28 45 Q30 20 30 0 Q30 20 32 45 Q40 65 42 95 Q48 145 30 180",
              "M30 180 Q18 138 22 105 Q25 72 27 52 Q29 28 30 8 Q31 28 33 52 Q35 72 38 105 Q42 138 30 180",
              "M30 180 Q15 140 20 100 Q22 70 25 50 Q28 25 30 5 Q32 25 35 50 Q38 70 40 100 Q45 140 30 180",
            ],
          }}
          transition={{
            duration: duration * 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </svg>
    </motion.div>
  );
}

export function StreakSlide({ slide }: StreakSlideProps) {
  const streak = Number(slide.value) || 0;

  // Generate embers spread around the flame
  const embers = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      delay: i * 0.3,
      startX: 45 + Math.random() * 10,
    })),
  []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Deep cosmic background */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 70%,
            #1a0a0a 0%,
            #0d0303 40%,
            #050000 70%,
            #000000 100%
          )`,
        }}
      />

      {/* Animated fire nebula */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 4, repeat: Infinity }}
        style={{
          background: `
            radial-gradient(ellipse at 50% 55%, rgba(255,100,0,0.25) 0%, transparent 45%),
            radial-gradient(circle at 50% 70%, rgba(255,50,0,0.2) 0%, transparent 35%),
            radial-gradient(circle at 40% 60%, rgba(255,150,0,0.1) 0%, transparent 30%),
            radial-gradient(circle at 60% 60%, rgba(255,150,0,0.1) 0%, transparent 30%)
          `,
        }}
      />

      {/* Rotating energy rings - like FocusSlide */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: '32%',
          width: 280,
          height: 70,
          border: '1px solid rgba(255,150,0,0.25)',
          borderRadius: '50%',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: '30%',
          width: 220,
          height: 55,
          border: '1px solid rgba(255,200,0,0.3)',
          borderRadius: '50%',
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: '28%',
          width: 160,
          height: 40,
          border: '1px solid rgba(255,220,0,0.35)',
          borderRadius: '50%',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      />

      {/* Flame container */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[18%]" style={{ width: 200, height: 300 }}>
        {/* Outer glow */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 bottom-0"
          style={{
            width: 160,
            height: 280,
            background: `radial-gradient(ellipse at 50% 80%,
              rgba(255,150,0,0.4) 0%,
              rgba(255,100,0,0.2) 40%,
              transparent 70%
            )`,
            filter: 'blur(30px)',
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.6, 0.9, 0.6],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Multiple flame tongues with different phases */}
        <FlameTongue delay={0} scale={1.2} offsetX={0} duration={0.4} />
        <FlameTongue delay={0.1} scale={0.9} offsetX={-15} duration={0.35} />
        <FlameTongue delay={0.15} scale={0.9} offsetX={15} duration={0.38} />
        <FlameTongue delay={0.05} scale={0.7} offsetX={-25} duration={0.32} />
        <FlameTongue delay={0.08} scale={0.7} offsetX={25} duration={0.36} />

        {/* Inner bright core */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 bottom-0"
          style={{
            width: 30,
            height: 100,
            background: `linear-gradient(180deg,
              rgba(255,255,255,0.95) 0%,
              #fffacd 20%,
              #ffd700 50%,
              #ff8c00 80%,
              transparent 100%
            )`,
            borderRadius: '15px 15px 5px 5px',
            boxShadow: '0 0 40px rgba(255,255,255,0.5), 0 0 80px rgba(255,200,0,0.6)',
          }}
          animate={{
            height: [95, 110, 95],
            opacity: [0.9, 1, 0.9],
          }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />

        {/* Base glow */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 -bottom-2"
          style={{
            width: 180,
            height: 40,
            background: 'radial-gradient(ellipse, rgba(255,150,0,0.6) 0%, rgba(255,100,0,0.3) 50%, transparent 70%)',
            filter: 'blur(10px)',
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>

      {/* Embers */}
      {embers.map((ember) => (
        <Ember key={ember.id} delay={ember.delay} startX={ember.startX} />
      ))}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center pt-12 pointer-events-none">
        {/* Streak number with glow */}
        <motion.div
          className="relative"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 100, delay: 0.3 }}
        >
          {/* Glow behind number */}
          <motion.div
            className="absolute -inset-12 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,180,0,0.4) 0%, transparent 60%)',
            }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />

          <motion.div
            className="relative text-8xl font-black"
            style={{
              color: '#fff',
              textShadow: `
                0 0 20px rgba(255,200,0,1),
                0 0 40px rgba(255,150,0,0.8),
                0 0 60px rgba(255,100,0,0.6),
                0 0 80px rgba(255,50,0,0.4)
              `,
            }}
            animate={{
              textShadow: [
                '0 0 20px rgba(255,200,0,1), 0 0 40px rgba(255,150,0,0.8), 0 0 60px rgba(255,100,0,0.6)',
                '0 0 30px rgba(255,200,0,1), 0 0 60px rgba(255,150,0,1), 0 0 80px rgba(255,100,0,0.8)',
                '0 0 20px rgba(255,200,0,1), 0 0 40px rgba(255,150,0,0.8), 0 0 60px rgba(255,100,0,0.6)',
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {streak}
          </motion.div>
        </motion.div>

        {/* Label */}
        <motion.h2
          className="text-2xl font-bold text-white mt-3 tracking-widest uppercase"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{ textShadow: '0 0 20px rgba(255,150,0,0.5)' }}
        >
          Day Streak
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          className="text-lg text-orange-200/80 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {slide.subtitle}
        </motion.p>
      </div>

      {/* Corner accents */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at top left, rgba(255,100,0,0.08) 0%, transparent 35%),
            radial-gradient(circle at bottom right, rgba(255,50,0,0.08) 0%, transparent 35%)
          `,
        }}
      />
    </div>
  );
}

export default StreakSlide;
