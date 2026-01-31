/**
 * HabitsSlide - "Волшебный сад" (Magic Garden)
 *
 * Habits visualized as a growing garden.
 * Completion rate determines garden density.
 * Butterflies and fireflies add magic atmosphere.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { StarIcon } from '@/components/icons';
import type { StorySlide, HabitStatsData } from '@/lib/progressStories';

interface HabitsSlideProps {
  slide: StorySlide;
  t: Record<string, string>;
}

// Plant SVG Component based on growth stage
function Plant({ x, stage, delay }: { x: number; stage: 'seed' | 'sprout' | 'bush' | 'tree'; delay: number }) {
  const heights = { seed: 10, sprout: 30, bush: 60, tree: 100 };
  const height = heights[stage];

  return (
    <motion.g
      initial={{ scale: 0, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100, delay }}
      style={{ transformOrigin: `${x}px bottom` }}
    >
      {stage === 'tree' && (
        <>
          {/* Tree trunk */}
          <motion.rect
            x={x - 4}
            y={180 - height}
            width={8}
            height={height * 0.4}
            fill="#8B4513"
            rx={2}
          />
          {/* Tree foliage */}
          <motion.ellipse
            cx={x}
            cy={180 - height}
            rx={25}
            ry={30}
            fill="#228B22"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <motion.ellipse
            cx={x - 15}
            cy={180 - height + 15}
            rx={18}
            ry={22}
            fill="#2E8B2E"
          />
          <motion.ellipse
            cx={x + 15}
            cy={180 - height + 15}
            rx={18}
            ry={22}
            fill="#3CB371"
          />
          {/* Flowers on tree */}
          {[...Array(3)].map((_, i) => (
            <motion.circle
              key={i}
              cx={x - 10 + i * 10}
              cy={180 - height - 10 + (i % 2) * 15}
              r={4}
              fill="#FFB6C1"
              animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </>
      )}

      {stage === 'bush' && (
        <>
          {/* Bush stem */}
          <rect x={x - 2} y={180 - height * 0.3} width={4} height={height * 0.3} fill="#6B8E23" rx={1} />
          {/* Bush leaves */}
          <ellipse cx={x} cy={180 - height * 0.5} rx={20} ry={25} fill="#32CD32" />
          <ellipse cx={x - 10} cy={180 - height * 0.35} rx={15} ry={18} fill="#3CB371" />
          <ellipse cx={x + 10} cy={180 - height * 0.35} rx={15} ry={18} fill="#2E8B57" />
        </>
      )}

      {stage === 'sprout' && (
        <>
          {/* Stem */}
          <motion.path
            d={`M${x} 180 Q${x - 5} ${180 - height * 0.5} ${x} ${180 - height}`}
            stroke="#6B8E23"
            strokeWidth={3}
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay }}
          />
          {/* Leaves */}
          <ellipse cx={x - 8} cy={180 - height * 0.6} rx={8} ry={5} fill="#90EE90" transform={`rotate(-30 ${x - 8} ${180 - height * 0.6})`} />
          <ellipse cx={x + 8} cy={180 - height * 0.7} rx={8} ry={5} fill="#98FB98" transform={`rotate(30 ${x + 8} ${180 - height * 0.7})`} />
        </>
      )}

      {stage === 'seed' && (
        <motion.circle
          cx={x}
          cy={178}
          r={5}
          fill="#8B4513"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.g>
  );
}

// Butterfly Component
function Butterfly({ id }: { id: number }) {
  const startX = 20 + Math.random() * 60;
  const startY = 30 + Math.random() * 40;

  return (
    <motion.g
      initial={{ x: startX, y: startY }}
      animate={{
        x: [startX, startX + 30, startX - 20, startX + 10, startX],
        y: [startY, startY - 20, startY - 10, startY - 30, startY],
      }}
      transition={{ duration: 8 + id * 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Wing animation */}
      <motion.path
        d="M0 0 Q-15 -10 -20 0 Q-15 10 0 0"
        fill={id % 2 === 0 ? '#FFB6C1' : '#DDA0DD'}
        animate={{ scaleX: [1, 0.3, 1] }}
        transition={{ duration: 0.15, repeat: Infinity }}
      />
      <motion.path
        d="M0 0 Q15 -10 20 0 Q15 10 0 0"
        fill={id % 2 === 0 ? '#FFC0CB' : '#EE82EE'}
        animate={{ scaleX: [1, 0.3, 1] }}
        transition={{ duration: 0.15, repeat: Infinity }}
      />
      <circle cx={0} cy={0} r={2} fill="#333" />
    </motion.g>
  );
}

// Firefly Component
function Firefly({ id }: { id: number }) {
  const x = 10 + Math.random() * 80;
  const y = 20 + Math.random() * 60;

  return (
    <motion.circle
      cx={`${x}%`}
      cy={`${y}%`}
      r={3}
      fill="#FFFF99"
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 2 + Math.random() * 2,
        repeat: Infinity,
        delay: id * 0.3,
      }}
      style={{
        filter: 'blur(1px)',
        boxShadow: '0 0 10px 5px rgba(255, 255, 0, 0.5)',
      }}
    />
  );
}

export function HabitsSlide({ slide, t }: HabitsSlideProps) {
  const data = slide.data as HabitStatsData;
  const completionRate = data?.completionRate || 0;

  // Generate plants based on completion rate
  const plants = useMemo(() => {
    const plantCount = Math.max(3, Math.floor(completionRate / 10));
    return Array.from({ length: plantCount }, (_, i) => {
      const normalizedRate = completionRate / 100;
      let stage: 'seed' | 'sprout' | 'bush' | 'tree';

      if (i < plantCount * normalizedRate * 0.3) stage = 'tree';
      else if (i < plantCount * normalizedRate * 0.6) stage = 'bush';
      else if (i < plantCount * normalizedRate * 0.9) stage = 'sprout';
      else stage = 'seed';

      return {
        id: i,
        x: 30 + (i * 250) / plantCount + Math.random() * 20,
        stage,
        delay: 0.5 + i * 0.15,
      };
    });
  }, [completionRate]);

  const butterflies = useMemo(() => Array.from({ length: 3 }, (_, i) => i), []);
  const fireflies = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Sky gradient - dusk/magical hour */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg,
            #1a1a2e 0%,
            #2d1b4e 20%,
            #4a2c6e 40%,
            #7b4b94 60%,
            #c97b84 80%,
            #f0c38e 100%
          )`,
        }}
      />

      {/* Stars in upper sky */}
      <div className="absolute top-0 left-0 right-0 h-1/3">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.3,
            }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2 + Math.random() * 2, repeat: Infinity }}
          />
        ))}
      </div>

      {/* Ground */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/4"
        style={{
          background: `linear-gradient(180deg, #2d5016 0%, #1a3009 50%, #0d1a04 100%)`,
        }}
      />

      {/* Garden SVG */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 200" preserveAspectRatio="xMidYMax slice">
        {/* Grass texture */}
        <defs>
          <pattern id="grass" patternUnits="userSpaceOnUse" width="20" height="20">
            <path d="M10 20 Q9 10 10 0" stroke="#3a7d10" strokeWidth="1" fill="none" />
            <path d="M5 20 Q4 12 5 5" stroke="#4a9d20" strokeWidth="1" fill="none" />
            <path d="M15 20 Q16 12 15 5" stroke="#3a7d10" strokeWidth="1" fill="none" />
          </pattern>
        </defs>
        <rect x="0" y="160" width="300" height="40" fill="url(#grass)" opacity={0.5} />

        {/* Plants */}
        {plants.map((plant) => (
          <Plant key={plant.id} x={plant.x} stage={plant.stage} delay={plant.delay} />
        ))}

        {/* Butterflies */}
        {butterflies.map((id) => (
          <Butterfly key={id} id={id} />
        ))}
      </svg>

      {/* Fireflies overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {fireflies.map((id) => (
          <Firefly key={id} id={id} />
        ))}
      </svg>

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-start pt-16 px-8">
        <motion.h2
          className="text-2xl font-bold text-white mb-4 drop-shadow-lg"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {slide.title}
        </motion.h2>

        {/* Big percentage */}
        <motion.div
          className="text-7xl font-black text-white mb-2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, delay: 0.5 }}
          style={{
            textShadow: '0 0 30px rgba(74, 222, 128, 0.5)',
          }}
        >
          {slide.value}
        </motion.div>

        <motion.p
          className="text-lg text-white/80 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {t.storyCompletionRate || 'completion rate'}
        </motion.p>

        {/* Top habit card */}
        {data?.topHabit && (
          <motion.div
            className="bg-black/30 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <p className="text-sm text-white/60 mb-1">{t.storyTopHabit || 'Top habit'}</p>
            <p className="text-xl font-semibold text-white">
              {data.topHabit.icon} {data.topHabit.name}
            </p>
            <p className="text-sm text-white/70">{data.topHabit.completions} {t.storyCompletions || 'completions'}</p>
          </motion.div>
        )}

        {/* Perfect days badge */}
        {data?.perfectDays > 0 && (
          <motion.div
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            <StarIcon size="sm" animated />
            <span className="text-sm text-white font-medium">
              {data.perfectDays} {t.storyPerfectDays || 'perfect days'}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default HabitsSlide;
