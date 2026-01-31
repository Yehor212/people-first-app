/**
 * TrophyHall - "Зала Слави" (Hall of Fame)
 *
 * Temple-style achievements display with:
 * - Decorative columns on sides
 * - Central pedestal with main achievement
 * - Spotlight beams with dust particles
 * - 3D flip cards for each achievement
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { FireIcon, StarIcon, TrophyIcon, TargetIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface Achievement {
  id: string;
  type: 'streak' | 'focus' | 'habits';
  value: number;
  label: string;
  icon: 'fire' | 'star' | 'trophy' | 'target';
}

interface TrophyHallProps {
  streak: number;
  focusMinutes: number;
  habitsCompleted: number;
  className?: string;
}

// Dust particle floating in spotlight
function DustParticle({ delay, x }: { delay: number; x: number }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-amber-200/60"
      style={{ left: `${x}%`, top: '10%' }}
      initial={{ y: 0, opacity: 0 }}
      animate={{
        y: [0, 150, 200],
        opacity: [0, 0.8, 0],
        x: [0, Math.random() * 30 - 15, Math.random() * 40 - 20],
      }}
      transition={{
        duration: 4 + Math.random() * 2,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// Spotlight beam component
function Spotlight({ side }: { side: 'left' | 'right' }) {
  const angle = side === 'left' ? 15 : -15;

  return (
    <motion.div
      className="absolute top-0 w-24 h-full pointer-events-none"
      style={{
        [side]: '5%',
        background: `linear-gradient(${angle}deg,
          rgba(255, 215, 0, 0.15) 0%,
          rgba(255, 215, 0, 0.05) 50%,
          transparent 100%)`,
      }}
      animate={{
        opacity: [0.3, 0.6, 0.3],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// Temple column SVG
function TempleColumn({ side }: { side: 'left' | 'right' }) {
  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 w-12 pointer-events-none",
        side === 'left' ? 'left-0' : 'right-0'
      )}
    >
      <svg className="w-full h-full" viewBox="0 0 48 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`columnGrad-${side}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5a4530" />
            <stop offset="50%" stopColor="#8b7355" />
            <stop offset="100%" stopColor="#5a4530" />
          </linearGradient>
        </defs>
        {/* Column capital */}
        <rect x="4" y="0" width="40" height="12" fill="#6b5b45" rx="2" />
        <rect x="2" y="10" width="44" height="6" fill="#7a6a54" />
        {/* Column shaft */}
        <rect x="8" y="16" width="32" height="168" fill={`url(#columnGrad-${side})`} />
        {/* Column base */}
        <rect x="2" y="184" width="44" height="6" fill="#7a6a54" />
        <rect x="0" y="188" width="48" height="12" fill="#6b5b45" rx="2" />
      </svg>
    </div>
  );
}

// Achievement card with 3D flip
function AchievementCard({
  achievement,
  index,
  isMain = false
}: {
  achievement: Achievement;
  index: number;
  isMain?: boolean;
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  const IconComponent = {
    fire: FireIcon,
    star: StarIcon,
    trophy: TrophyIcon,
    target: TargetIcon,
  }[achievement.icon];

  const colors = {
    streak: { bg: 'from-orange-500/20 to-red-500/20', glow: 'rgba(249, 115, 22, 0.4)', text: 'text-orange-400' },
    focus: { bg: 'from-violet-500/20 to-purple-500/20', glow: 'rgba(139, 92, 246, 0.4)', text: 'text-violet-400' },
    habits: { bg: 'from-emerald-500/20 to-teal-500/20', glow: 'rgba(16, 185, 129, 0.4)', text: 'text-emerald-400' },
  }[achievement.type];

  return (
    <motion.div
      className={cn(
        "relative cursor-pointer",
        isMain ? "w-28 h-36" : "w-24 h-32"
      )}
      style={{ perspective: 1000 }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.15, type: 'spring', stiffness: 100 }}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
      >
        {/* Front side */}
        <div
          className={cn(
            "absolute inset-0 rounded-xl border border-amber-500/30",
            "bg-gradient-to-br", colors.bg,
            "flex flex-col items-center justify-center gap-2",
            "backface-hidden"
          )}
          style={{
            boxShadow: `0 0 20px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
            backfaceVisibility: 'hidden',
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <IconComponent size={isMain ? "lg" : "md"} animated />
          </motion.div>
          <span className={cn("text-2xl font-bold", colors.text)}>
            {achievement.value}
          </span>
        </div>

        {/* Back side */}
        <div
          className={cn(
            "absolute inset-0 rounded-xl border border-amber-500/30",
            "bg-gradient-to-br from-amber-900/40 to-amber-950/40",
            "flex flex-col items-center justify-center p-3",
            "backface-hidden"
          )}
          style={{
            boxShadow: `0 0 20px ${colors.glow}`,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <IconComponent size="sm" animated />
          <span className="text-xs text-amber-200/80 text-center mt-2 leading-tight">
            {achievement.label}
          </span>
        </div>
      </motion.div>

      {/* Pedestal */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-full">
        <div
          className={cn(
            "mx-auto rounded-t-sm",
            isMain ? "w-20 h-3" : "w-16 h-2"
          )}
          style={{
            background: 'linear-gradient(180deg, #d4af37 0%, #b8960c 50%, #8b7200 100%)',
          }}
        />
        <div
          className={cn(
            "mx-auto rounded-b-sm",
            isMain ? "w-24 h-2" : "w-20 h-1.5"
          )}
          style={{
            background: 'linear-gradient(180deg, #8b7200 0%, #6b5500 100%)',
          }}
        />
      </div>
    </motion.div>
  );
}

export function TrophyHall({ streak, focusMinutes, habitsCompleted, className }: TrophyHallProps) {
  const { t } = useLanguage();

  const achievements: Achievement[] = useMemo(() => [
    { id: 'streak', type: 'streak', value: streak, label: t.currentStreak || 'Current Streak', icon: 'fire' },
    { id: 'focus', type: 'focus', value: focusMinutes, label: t.focusMinutes || 'Focus Minutes', icon: 'target' },
    { id: 'habits', type: 'habits', value: habitsCompleted, label: t.habitsCompleted || 'Habits Done', icon: 'trophy' },
  ], [streak, focusMinutes, habitsCompleted, t]);

  // Find the "main" achievement (highest relative to typical values)
  const mainIndex = useMemo(() => {
    const scores = [
      streak / 7, // Streak relative to a week
      focusMinutes / 120, // Focus relative to 2 hours
      habitsCompleted / 5, // Habits relative to 5
    ];
    return scores.indexOf(Math.max(...scores));
  }, [streak, focusMinutes, habitsCompleted]);

  // Dust particles
  const dustParticles = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: 20 + Math.random() * 60,
      delay: Math.random() * 3,
    })),
  []);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      {/* Dark temple background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg,
            #0a0a0a 0%,
            #1a1510 20%,
            #2a2015 50%,
            #1a1510 80%,
            #0a0a0a 100%)`,
        }}
      />

      {/* Temple columns */}
      <TempleColumn side="left" />
      <TempleColumn side="right" />

      {/* Spotlights */}
      <Spotlight side="left" />
      <Spotlight side="right" />

      {/* Dust particles in light */}
      {dustParticles.map((p) => (
        <DustParticle key={p.id} x={p.x} delay={p.delay} />
      ))}

      {/* Marble floor reflection */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16"
        style={{
          background: `linear-gradient(180deg,
            transparent 0%,
            rgba(139, 115, 85, 0.1) 50%,
            rgba(139, 115, 85, 0.2) 100%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center py-6 px-4">
        {/* Title */}
        <motion.div
          className="flex items-center gap-2 mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TrophyIcon size="md" animated />
          <h3 className="text-lg font-bold text-amber-100">
            {t.hallOfFame || 'Hall of Fame'}
          </h3>
        </motion.div>

        {/* Achievement cards */}
        <div className="flex items-end justify-center gap-4">
          {achievements.map((achievement, i) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              index={i}
              isMain={i === mainIndex}
            />
          ))}
        </div>

        {/* Tap hint */}
        <motion.p
          className="text-xs text-amber-200/40 mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {t.tapToFlip || 'Tap cards to flip'}
        </motion.p>
      </div>

      {/* Golden ambient glow at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at bottom, rgba(255, 215, 0, 0.08) 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}

export default TrophyHall;
