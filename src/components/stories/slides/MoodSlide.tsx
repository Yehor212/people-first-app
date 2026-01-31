/**
 * MoodSlide - "Живое небо" (Living Sky)
 *
 * Displays mood as an animated weather scene.
 * Great mood = sunny, Bad mood = stormy, etc.
 * The entire sky IS the visualization.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AnimatedMoodEmoji } from '@/components/AnimatedMoodEmoji';
import type { StorySlide, MoodTrendData } from '@/lib/progressStories';

interface MoodSlideProps {
  slide: StorySlide;
  t: Record<string, string>;
}

type WeatherType = 'sunny' | 'partlyCloudy' | 'cloudy' | 'rainy' | 'stormy';

const getWeatherType = (moodAverage: number): WeatherType => {
  if (moodAverage >= 4.5) return 'sunny';
  if (moodAverage >= 3.5) return 'partlyCloudy';
  if (moodAverage >= 2.5) return 'cloudy';
  if (moodAverage >= 1.5) return 'rainy';
  return 'stormy';
};

const weatherGradients: Record<WeatherType, string> = {
  sunny: 'linear-gradient(180deg, #87CEEB 0%, #FDB813 50%, #FF6B35 100%)',
  partlyCloudy: 'linear-gradient(180deg, #87CEEB 0%, #B8D4E3 50%, #E8E8E8 100%)',
  cloudy: 'linear-gradient(180deg, #7B8794 0%, #9CA3AF 50%, #6B7280 100%)',
  rainy: 'linear-gradient(180deg, #374151 0%, #4B5563 50%, #1F2937 100%)',
  stormy: 'linear-gradient(180deg, #1F2937 0%, #111827 50%, #000000 100%)',
};

// Sun Component
function Sun({ intensity }: { intensity: number }) {
  return (
    <motion.div
      className="absolute"
      style={{ top: '15%', left: '50%', transform: 'translateX(-50%)' }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 1, delay: 0.3 }}
    >
      {/* Sun rays */}
      <motion.div
        className="absolute -inset-16"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      >
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 w-1 origin-bottom"
            style={{
              height: 60 + Math.random() * 20,
              background: `linear-gradient(to top, rgba(255,215,0,${0.8 * intensity}), transparent)`,
              transform: `rotate(${i * 30}deg) translateX(-50%)`,
              transformOrigin: 'bottom center',
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
              scaleY: [0.9, 1.1, 0.9],
            }}
            transition={{
              duration: 2 + Math.random(),
              repeat: Infinity,
              delay: i * 0.1,
            }}
          />
        ))}
      </motion.div>

      {/* Sun core */}
      <motion.div
        className="relative w-24 h-24 rounded-full"
        style={{
          background: 'radial-gradient(circle, #FFF7E0 0%, #FFD93D 50%, #FF9500 100%)',
          boxShadow: `0 0 60px 20px rgba(255, 215, 0, ${0.6 * intensity})`,
        }}
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}

// Cloud Component
function Cloud({ x, y, size, speed, opacity }: { x: number; y: number; size: number; speed: number; opacity: number }) {
  return (
    <motion.div
      className="absolute"
      style={{ top: `${y}%`, left: `${x}%` }}
      initial={{ x: -100 }}
      animate={{ x: [0, 30, 0] }}
      transition={{ duration: speed, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg
        width={size}
        height={size * 0.6}
        viewBox="0 0 100 60"
        style={{ opacity }}
      >
        <ellipse cx="30" cy="40" rx="25" ry="18" fill="white" />
        <ellipse cx="50" cy="30" rx="30" ry="22" fill="white" />
        <ellipse cx="70" cy="40" rx="25" ry="18" fill="white" />
        <ellipse cx="50" cy="45" rx="35" ry="15" fill="white" />
      </svg>
    </motion.div>
  );
}

// Rain Drop Component
function RainDrop({ delay, x }: { delay: number; x: number }) {
  return (
    <motion.div
      className="absolute w-0.5 h-4 bg-gradient-to-b from-blue-300 to-transparent rounded-full"
      style={{ left: `${x}%`, top: -20 }}
      initial={{ y: 0, opacity: 0 }}
      animate={{
        y: [0, window.innerHeight + 50],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration: 1.5,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// Lightning Component
function Lightning() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
      }}
      transition={{
        duration: 5,
        repeat: Infinity,
        times: [0, 0.1, 0.15, 0.18, 0.2, 0.25, 0.3, 0.5, 0.7, 1],
      }}
    >
      <svg
        className="absolute"
        style={{ top: '10%', left: '60%', width: 80, height: 200 }}
        viewBox="0 0 80 200"
      >
        <path
          d="M40 0 L30 80 L50 80 L25 200 L55 100 L35 100 L45 0 Z"
          fill="#FFE066"
          filter="url(#lightningGlow)"
        />
        <defs>
          <filter id="lightningGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    </motion.div>
  );
}

export function MoodSlide({ slide, t }: MoodSlideProps) {
  const data = slide.data as MoodTrendData;
  const moodAverage = data?.average || 3;
  const weather = getWeatherType(moodAverage);
  const moodTypes = ['terrible', 'bad', 'okay', 'good', 'great'] as const;

  // Generate weather elements based on type
  const clouds = useMemo(() => {
    const count = weather === 'sunny' ? 2 : weather === 'partlyCloudy' ? 4 : 6;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 10 + i * 15 + Math.random() * 10,
      y: 5 + Math.random() * 20,
      size: 80 + Math.random() * 40,
      speed: 15 + Math.random() * 10,
      opacity: weather === 'sunny' ? 0.3 : weather === 'cloudy' ? 0.9 : 0.7,
    }));
  }, [weather]);

  const rainDrops = useMemo(() => {
    if (weather !== 'rainy' && weather !== 'stormy') return [];
    const count = weather === 'stormy' ? 40 : 25;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
    }));
  }, [weather]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Sky gradient background */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        style={{ background: weatherGradients[weather] }}
      />

      {/* Sun (for sunny and partly cloudy) */}
      {(weather === 'sunny' || weather === 'partlyCloudy') && (
        <Sun intensity={weather === 'sunny' ? 1 : 0.7} />
      )}

      {/* Clouds */}
      {clouds.map((cloud) => (
        <Cloud key={cloud.id} {...cloud} />
      ))}

      {/* Rain drops */}
      {rainDrops.map((drop) => (
        <RainDrop key={drop.id} delay={drop.delay} x={drop.x} />
      ))}

      {/* Lightning (for stormy) */}
      {weather === 'stormy' && <Lightning />}

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
        {/* Title */}
        <motion.h2
          className="text-2xl font-bold text-white mb-2 drop-shadow-lg"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {slide.title}
        </motion.h2>

        {/* Big mood value */}
        <motion.div
          className="text-7xl font-black text-white mb-6"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 100, delay: 0.5 }}
          style={{
            textShadow: weather === 'sunny'
              ? '0 0 40px rgba(255, 215, 0, 0.5)'
              : '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          {slide.value}
        </motion.div>

        <motion.p
          className="text-lg text-white/80 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {t.storyAverageMoodScore || 'average mood score'}
        </motion.p>

        {/* Mood scale */}
        <motion.div
          className="flex gap-4 p-4 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          {moodTypes.map((mood, i) => {
            const isSelected = Math.round(moodAverage) === i + 1;
            return (
              <motion.div
                key={mood}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1 + i * 0.1, type: 'spring' }}
                className={`relative transition-transform duration-300 ${
                  isSelected ? 'scale-125 z-10' : 'opacity-50'
                }`}
              >
                <AnimatedMoodEmoji mood={mood} size="md" isSelected={isSelected} />
                {isSelected && (
                  <motion.div
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white"
                    layoutId="moodIndicator"
                  />
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Horizon line for grounding */}
      {weather !== 'stormy' && (
        <div
          className="absolute bottom-0 left-0 right-0 h-24"
          style={{
            background: `linear-gradient(to top, rgba(0,0,0,0.3), transparent)`,
          }}
        />
      )}
    </div>
  );
}

export default MoodSlide;
