/**
 * HabitsSlide - "Лунный сад" (Moonlit Garden)
 *
 * Premium redesign: Central glowing Tree of Life
 * with completion rate integrated into the crown.
 * Minimal, elegant, atmospheric design.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { StarIcon } from '@/components/icons';
import type { StorySlide, HabitStatsData } from '@/lib/progressStories';

interface HabitsSlideProps {
  slide: StorySlide;
  t: Record<string, string>;
}

// Soft particle for atmosphere
function SoftParticle({ delay, x, y }: { delay: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: 4,
        height: 4,
        background: 'radial-gradient(circle, rgba(74,222,128,0.8) 0%, transparent 70%)',
        boxShadow: '0 0 10px rgba(74,222,128,0.5)',
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{
        opacity: [0, 0.8, 0],
        scale: [0.5, 1, 0.5],
        y: [0, -30, 0],
      }}
      transition={{
        duration: 4,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

export function HabitsSlide({ slide, t }: HabitsSlideProps) {
  const data = slide.data as HabitStatsData;
  const _completionRate = data?.completionRate || 0;

  // Generate minimal soft particles (only 4)
  const particles = useMemo(() => [
    { id: 0, x: 25, y: 60, delay: 0 },
    { id: 1, x: 75, y: 55, delay: 1.5 },
    { id: 2, x: 30, y: 40, delay: 3 },
    { id: 3, x: 70, y: 45, delay: 2 },
  ], []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Deep forest cosmos background */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 30%,
            #1a2f1a 0%,
            #0d1a0d 40%,
            #050a05 100%
          )`,
        }}
      />

      {/* Green nebula breathing */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 8, repeat: Infinity }}
        style={{
          background: `
            radial-gradient(circle at 50% 45%, rgba(74,222,128,0.15) 0%, transparent 50%),
            radial-gradient(circle at 30% 30%, rgba(34,197,94,0.1) 0%, transparent 40%)
          `,
        }}
      />

      {/* Corner glows */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at top left, rgba(74,222,128,0.08) 0%, transparent 40%),
            radial-gradient(circle at bottom right, rgba(251,191,36,0.05) 0%, transparent 40%)
          `,
        }}
      />

      {/* Soft particles */}
      {particles.map((p) => (
        <SoftParticle key={p.id} x={p.x} y={p.y} delay={p.delay} />
      ))}

      {/* Central Tree of Life */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
        {/* Tree crown - glowing orb */}
        <motion.div
          className="relative"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 100, delay: 0.3 }}
        >
          {/* Outer glow ring 1 */}
          <motion.div
            className="absolute -inset-8 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(74,222,128,0.15) 0%, transparent 70%)',
            }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4, repeat: Infinity }}
          />

          {/* Outer glow ring 2 */}
          <motion.div
            className="absolute -inset-16 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(74,222,128,0.08) 0%, transparent 70%)',
            }}
            animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 6, repeat: Infinity }}
          />

          {/* Main crown orb */}
          <motion.div
            className="relative w-48 h-48 rounded-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle at 30% 30%,
                rgba(134,239,172,0.4) 0%,
                rgba(74,222,128,0.3) 30%,
                rgba(34,197,94,0.2) 60%,
                rgba(22,163,74,0.1) 100%
              )`,
              boxShadow: `
                0 0 60px rgba(74,222,128,0.4),
                inset 0 0 40px rgba(134,239,172,0.2)
              `,
              border: '1px solid rgba(74,222,128,0.2)',
            }}
            animate={{
              boxShadow: [
                '0 0 60px rgba(74,222,128,0.4), inset 0 0 40px rgba(134,239,172,0.2)',
                '0 0 80px rgba(74,222,128,0.5), inset 0 0 50px rgba(134,239,172,0.3)',
                '0 0 60px rgba(74,222,128,0.4), inset 0 0 40px rgba(134,239,172,0.2)',
              ],
            }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            {/* Completion percentage inside crown */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
            >
              <motion.div
                className="text-6xl font-black text-white"
                style={{
                  textShadow: '0 0 30px rgba(74,222,128,0.6)',
                }}
              >
                {slide.value}
              </motion.div>
              <p className="text-sm text-emerald-200/80 mt-1">
                {t.storyCompletionRate || 'completion rate'}
              </p>
            </motion.div>
          </motion.div>

          {/* Rotating ring around crown */}
          <motion.div
            className="absolute -inset-4 rounded-full border border-emerald-500/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute -inset-12 rounded-full border border-emerald-400/10"
            animate={{ rotate: -360 }}
            transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>

        {/* Tree trunk */}
        <motion.div
          className="relative -mt-2"
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          style={{ transformOrigin: 'top center' }}
        >
          <div
            style={{
              width: 16,
              height: 80,
              background: 'linear-gradient(180deg, #5D4E37 0%, #3D2E1F 50%, #2D1E0F 100%)',
              borderRadius: '4px 4px 8px 8px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
          />
          {/* Trunk glow */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgba(74,222,128,0.1) 0%, transparent 30%)',
              borderRadius: '4px 4px 8px 8px',
            }}
          />
        </motion.div>

        {/* Ground glow */}
        <motion.div
          className="absolute -bottom-4 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7 }}
          style={{
            width: 120,
            height: 20,
            background: 'radial-gradient(ellipse, rgba(74,222,128,0.2) 0%, transparent 70%)',
            filter: 'blur(8px)',
          }}
        />
      </div>

      {/* Title at top */}
      <motion.h2
        className="absolute top-12 left-0 right-0 text-center text-2xl font-bold text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
      >
        {slide.title}
      </motion.h2>

      {/* Top habit card - bottom left */}
      {data?.topHabit && (
        <motion.div
          className="absolute bottom-24 left-6 bg-black/30 backdrop-blur-md rounded-2xl px-5 py-4 border border-emerald-500/20"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1 }}
          style={{
            boxShadow: '0 0 30px rgba(74,222,128,0.1)',
          }}
        >
          <p className="text-xs text-emerald-200/60 mb-1">{t.storyTopHabit || 'Top habit'}</p>
          <p className="text-lg font-semibold text-white">
            {data.topHabit.icon} {data.topHabit.name}
          </p>
          <p className="text-sm text-emerald-200/70">{data.topHabit.completions} {t.storyCompletions || 'completions'}</p>
        </motion.div>
      )}

      {/* Perfect days badge - bottom right */}
      {data?.perfectDays > 0 && (
        <motion.div
          className="absolute bottom-24 right-6 flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-500/30"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.2 }}
          style={{
            boxShadow: '0 0 20px rgba(251,191,36,0.2)',
          }}
        >
          <StarIcon size="sm" animated />
          <span className="text-sm text-white font-medium">
            {data.perfectDays} {t.storyPerfectDays || 'perfect days'}
          </span>
        </motion.div>
      )}
    </div>
  );
}

export default HabitsSlide;
