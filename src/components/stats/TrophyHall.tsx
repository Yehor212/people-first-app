/**
 * TrophyHall - "Зала Слави" (Hall of Fame)
 *
 * Temple-style achievements display with:
 * - Central pedestal with main achievement
 * - Spotlight beams with dust particles
 * - 3D flip cards for each achievement
 */

import { useState, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Share2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { FireIcon, StarIcon, TrophyIcon, TargetIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { UnifiedShareModal } from '@/components/share';
import { hapticTap } from '@/lib/haptics';
import { zenMotion, zenTap } from '@/lib/animationUtils';

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
  // Stable per-mount drift so parent re-renders do not restart the loop
  // (10-agent review, Role 10).
  const [seed] = useState(() => ({
    drift: Math.random() * 40 - 20,
    duration: 4 + Math.random() * 2,
  }));
  return (
    <div
      className="absolute w-1 h-1 rounded-full bg-amber-200/60 animate-zen-loop-fall"
      style={{
        insetInlineStart: `${x}%`,
        top: '10%',
        opacity: 0,
        '--zen-loop-drift': `${seed.drift}px`,
        '--zen-loop-drift-mid': `${seed.drift / 2}px`,
        '--zen-loop-duration': `${seed.duration}s`,
        '--zen-loop-delay': `${delay}s`,
        '--zen-loop-timing': 'linear',
      } as CSSProperties}
    />
  );
}

// Spotlight beam component
function Spotlight({ side }: { side: 'left' | 'right' }) {
  const angle = side === 'left' ? 15 : -15;

  return (
    <div
      className="absolute top-0 w-24 h-full pointer-events-none animate-zen-loop-fade"
      style={{
        [side === 'left' ? 'insetInlineStart' : 'insetInlineEnd']: '5%',
        background: `linear-gradient(${angle}deg,
          hsl(var(--temple-spotlight) / 0.15) 0%,
          hsl(var(--temple-spotlight) / 0.05) 50%,
          transparent 100%)`,
        opacity: 0.45,
        '--zen-loop-min-opacity': 0.3,
        '--zen-loop-max-opacity': 0.6,
        '--zen-loop-duration': '4s',
      } as CSSProperties}
    />
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
        "relative cursor-pointer [perspective:1000px]",
        isMain ? "w-32 h-40" : "w-28 h-36"
      )}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.15, ...zenMotion.gentle }}
      onClick={() => setIsFlipped(!isFlipped)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsFlipped(!isFlipped); } }}
      role="button"
      tabIndex={0}
      aria-label={`${achievement.label}: ${achievement.value}`}
      aria-pressed={isFlipped}
    >
      <motion.div
        className="relative w-full h-full [transform-style:preserve-3d]"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={zenMotion.gentle}
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
          }}
        >
          <div
            className="animate-zen-loop-scale"
            style={{ '--zen-loop-scale': 1.1, '--zen-loop-duration': '2s' } as CSSProperties}
          >
            <IconComponent size={isMain ? "lg" : "md"} animated />
          </div>
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
            "backface-hidden [transform:rotateY(180deg)]"
          )}
          style={{
            boxShadow: `0 0 20px ${colors.glow}`,
          }}
        >
          <IconComponent size="sm" animated />
          <span className="text-xs text-amber-700/80 dark:text-amber-200/80 text-center mt-2 leading-tight">
            {achievement.label}
          </span>
        </div>
      </motion.div>

      {/* Pedestal */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-full">
        <div
          className={cn(
            "mx-auto rounded-t-sm bg-[linear-gradient(180deg,hsl(var(--trophy-gold-bright))_0%,hsl(var(--trophy-gold-mid))_50%,hsl(var(--trophy-gold-dark))_100%)]",
            isMain ? "w-24 h-3" : "w-20 h-2"
          )}
        />
        <div
          className={cn(
            "mx-auto rounded-b-sm bg-[linear-gradient(180deg,hsl(var(--trophy-gold-dark))_0%,hsl(var(--trophy-gold-deep))_100%)]",
            isMain ? "w-28 h-2" : "w-24 h-1.5"
          )}
        />
      </div>
    </motion.div>
  );
}

export function TrophyHall({ streak, focusMinutes, habitsCompleted, className }: TrophyHallProps) {
  const { t } = useLanguage();
  const [showShareModal, setShowShareModal] = useState(false);

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

  // Dust particles — fewer on mobile for performance
  const dustParticles = useMemo(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches
      || window.matchMedia('(pointer: coarse)').matches;
    const count = isMobile ? 8 : 15;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 20 + Math.random() * 60,
      delay: Math.random() * 3,
    }));
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        // Light mode: add shadow and ring for visual separation
        "shadow-lg shadow-black/10 dark:shadow-none",
        "ring-1 ring-black/5 dark:ring-0",
        className
      )}
    >
      {/* Share button */}
      <motion.button
        onClick={() => { void hapticTap(); setShowShareModal(true); }}
        className={cn(
          "absolute top-3 end-3 z-20 p-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full motion-safe:transition-all",
          "bg-amber-500/20 hover:bg-amber-500/40",
          "backdrop-blur-sm border border-amber-500/30",
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={zenTap.button}
        aria-label={t.shareAchievements || 'Share achievements'}
      >
        <Share2 className="w-4 h-4 text-amber-700 dark:text-amber-200" aria-hidden="true" />
      </motion.button>

      {/* Theme-aware temple background */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-amber-50 via-orange-100/80 to-amber-100 dark:bg-none"
      />
      <div
        className="absolute inset-0 hidden dark:block bg-[linear-gradient(180deg,hsl(var(--temple-bg-top))_0%,hsl(var(--temple-bg-mid))_20%,hsl(var(--temple-bg-bottom))_50%,hsl(var(--temple-bg-mid))_80%,hsl(var(--temple-bg-top))_100%)]"
      />

      {/* Spotlights */}
      <Spotlight side="left" />
      <Spotlight side="right" />

      {/* Dust particles in light */}
      {dustParticles.map((p) => (
        <DustParticle key={p.id} x={p.x} delay={p.delay} />
      ))}

      {/* Marble floor reflection */}
      <div
        className="absolute bottom-0 inset-x-0 h-16 block dark:hidden bg-[linear-gradient(180deg,transparent_0%,hsl(38_60%_85%/0.15)_50%,hsl(38_60%_80%/0.25)_100%)]"
      />
      <div
        className="absolute bottom-0 inset-x-0 h-16 hidden dark:block bg-[linear-gradient(180deg,transparent_0%,hsl(var(--temple-marble)/0.1)_50%,hsl(var(--temple-marble)/0.2)_100%)]"
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center py-6 px-6">
        {/* Title */}
        <motion.div
          className="flex items-center gap-2 mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TrophyIcon size="md" animated />
          <h3 className="text-lg font-bold text-amber-800 dark:text-amber-100">
            {t.hallOfFame || 'Hall of Fame'}
          </h3>
        </motion.div>

        {/* Achievement cards */}
        <div className="flex items-end justify-center gap-5">
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
          className="text-xs text-amber-700/40 dark:text-amber-200/40 mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {t.tapToFlip || 'Tap cards to flip'}
        </motion.p>
      </div>

      {/* Golden ambient glow at bottom */}
      <div
        className="absolute bottom-0 inset-x-0 h-24 pointer-events-none bg-[radial-gradient(ellipse_at_bottom,hsl(var(--temple-ambient-glow)/0.08)_0%,transparent_70%)]"
      />

      {/* Share modal */}
      <UnifiedShareModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        mode="trophy"
        data={{ streak, focusMinutes, habitsCompleted }}
      />
    </div>
  );
}

export default TrophyHall;
