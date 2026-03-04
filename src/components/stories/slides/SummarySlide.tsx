/**
 * SummarySlide - "Кристальная сфера" (Crystal Sphere)
 *
 * ZenScore-style visualization with a central crystal/sphere
 * and orbiting metrics for mood, habits, and focus.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import type { StorySlide, MoodTrendData, HabitStatsData, FocusStatsData } from '@/lib/progressStories';

interface SummarySlideProps {
  slide: StorySlide;
}

// Floating sparkle inside crystal
function CrystalSparkle({ delay }: { delay: number }) {
  const x = 30 + Math.random() * 40;
  const y = 30 + Math.random() * 40;

  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full bg-white"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        boxShadow: '0 0 10px 3px rgba(255, 255, 255, 0.5)',
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0.5, 1, 0.5],
        y: [0, -20, 0],
      }}
      transition={{
        duration: 3,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// Orbiting metric display - actually orbits around the sphere!
function OrbitingMetric({
  icon,
  label,
  value,
  angle,
  radius,
  color,
  delay,
}: {
  icon: string;
  label: string;
  value: string;
  angle: number;
  radius: number;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2"
      style={{
        width: radius * 2,
        height: radius * 2,
        marginLeft: -radius,
        marginTop: -radius,
      }}
      initial={{ opacity: 0, rotate: angle }}
      animate={{ opacity: 1, rotate: angle + 360 }}
      transition={{
        opacity: { delay, duration: 0.5 },
        rotate: { duration: 40, repeat: Infinity, ease: 'linear', delay },
      }}
    >
      {/* Positioned at the edge of the orbit */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: 0,
          transform: 'translateX(-50%)',
        }}
      >
        {/* Counter-rotate to keep content upright */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        >
          <motion.div
            className="flex flex-col items-center px-3 py-2 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${color}20, ${color}10)`,
              border: `1px solid ${color}40`,
              boxShadow: `0 0 20px ${color}30`,
            }}
            whileHover={{ scale: 1.1 }}
            animate={{
              boxShadow: [
                `0 0 20px ${color}30`,
                `0 0 30px ${color}50`,
                `0 0 20px ${color}30`,
              ],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <span className="text-xl">{icon}</span>
            <span className="text-lg font-bold text-white">{value}</span>
            <span className="text-xs text-white/60">{label}</span>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function SummarySlide({ slide }: SummarySlideProps) {
  const { t } = useLanguage();
  // Generate sparkles
  const sparkles = useMemo(() => Array.from({ length: 8 }, (_, i) => i * 0.3), []);

  // Extract real data from slide.data
  const slideData = slide.data as { moodStats?: MoodTrendData; habitStats?: HabitStatsData; focusStats?: FocusStatsData } | undefined;
  const moodValue = slideData?.moodStats ? slideData.moodStats.average.toFixed(1) : '–';
  const habitsValue = slideData?.habitStats ? `${Math.round(slideData.habitStats.completionRate)}%` : '–';
  const focusValue = slideData?.focusStats
    ? (slideData.focusStats.totalMinutes >= 60
        ? `${Math.round(slideData.focusStats.totalMinutes / 60)}h`
        : `${slideData.focusStats.totalMinutes}m`)
    : '–';

  const metrics = [
    { icon: '😊', label: t.storyMood || 'Mood', value: moodValue, angle: -60, color: '#a855f7' },
    { icon: '✅', label: t.storyHabits || 'Habits', value: habitsValue, angle: 60, color: '#22c55e' },
    { icon: '⏱️', label: t.storyFocus || 'Focus', value: focusValue, angle: 180, color: '#3b82f6' },
  ];

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Cosmic gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center,
            #1a1a3e 0%,
            #0d0d2a 40%,
            #050510 100%
          )`,
        }}
      />

      {/* Ambient glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 5, repeat: Infinity }}
        style={{
          background: `
            radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.2) 0%, transparent 50%),
            radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.1) 0%, transparent 40%),
            radial-gradient(circle at 70% 70%, rgba(236, 72, 153, 0.1) 0%, transparent 40%)
          `,
        }}
      />

      {/* Central crystal visualization */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: 280, height: 280 }}>
          {/* Outer glow ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{
              boxShadow: [
                '0 0 60px 20px rgba(139, 92, 246, 0.2)',
                '0 0 80px 30px rgba(139, 92, 246, 0.3)',
                '0 0 60px 20px rgba(139, 92, 246, 0.2)',
              ],
            }}
            transition={{ duration: 4, repeat: Infinity }}
          />

          {/* Rotating ring 1 */}
          <motion.div
            className="absolute inset-4 rounded-full border border-purple-500/30"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />

          {/* Rotating ring 2 (reverse) */}
          <motion.div
            className="absolute inset-10 rounded-full border border-blue-500/20"
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          />

          {/* Rotating ring 3 - innermost, fastest */}
          <motion.div
            className="absolute inset-16 rounded-full border border-cyan-400/25"
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />

          {/* Crystal sphere */}
          <motion.div
            className="absolute rounded-full"
            style={{
              inset: 50,
              background: `radial-gradient(circle at 30% 30%,
                rgba(255, 255, 255, 0.3) 0%,
                rgba(139, 92, 246, 0.4) 30%,
                rgba(59, 130, 246, 0.3) 60%,
                rgba(139, 92, 246, 0.2) 100%
              )`,
              boxShadow: `
                0 0 40px rgba(139, 92, 246, 0.4),
                inset 0 0 60px rgba(255, 255, 255, 0.1),
                inset -20px -20px 40px rgba(0, 0, 0, 0.2)
              `,
            }}
            animate={{
              scale: [1, 1.03, 1],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Sparkles inside crystal */}
            {sparkles.map((delay, i) => (
              <CrystalSparkle key={i} delay={delay} />
            ))}

            {/* Content inside crystal */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
              >
                <SparklesIcon size="md" animated />
              </motion.div>

              <motion.h2
                className="text-2xl font-bold text-white mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                style={{
                  textShadow: '0 0 20px rgba(139, 92, 246, 0.5)',
                }}
              >
                {slide.title}
              </motion.h2>
            </div>
          </motion.div>

          {/* Orbiting metrics */}
          {metrics.map((metric, i) => (
            <OrbitingMetric
              key={metric.label}
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
              angle={metric.angle}
              radius={130}
              color={metric.color}
              delay={1 + i * 0.2}
            />
          ))}
        </div>
      </div>

      {/* Title at top */}
      <motion.div
        className="absolute top-16 left-1/2 -translate-x-1/2 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-white/60 text-sm">{t.storyWeekAtGlance || 'Your week at a glance'}</p>
      </motion.div>

      {/* Subtitle */}
      <motion.p
        className="absolute bottom-24 left-1/2 -translate-x-1/2 text-lg text-white/80 text-center px-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
      >
        {slide.subtitle}
      </motion.p>
    </div>
  );
}

export default SummarySlide;
