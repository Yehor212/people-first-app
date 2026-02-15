/**
 * TrophyHall - "Зала Слави" (Hall of Fame)
 *
 * Temple-style achievements display with:
 * - Central pedestal with main achievement
 * - Spotlight beams with dust particles
 * - 3D flip cards for each achievement
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Share2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/components/ThemeToggle';
import { FireIcon, StarIcon, TrophyIcon, TargetIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { shareImage } from '@/lib/shareActions';
import { generateTrophyCard, DEFAULT_CARD_TRANSLATIONS, ShareCardTranslations } from '@/lib/shareCards';
import { hapticError } from '@/lib/haptics';

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
      style={{ insetInlineStart: `${x}%`, top: '10%' }}
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
        [side === 'left' ? 'insetInlineStart' : 'insetInlineEnd']: '5%',
        background: `linear-gradient(${angle}deg,
          hsl(var(--temple-spotlight) / 0.15) 0%,
          hsl(var(--temple-spotlight) / 0.05) 50%,
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
        isMain ? "w-32 h-40" : "w-28 h-36"
      )}
      style={{ perspective: 1000 }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.15, type: 'spring', stiffness: 100 }}
      onClick={() => setIsFlipped(!isFlipped)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsFlipped(!isFlipped); } }}
      role="button"
      tabIndex={0}
      aria-label={`${achievement.label}: ${achievement.value}`}
      aria-pressed={isFlipped}
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
          <span className="text-xs text-amber-700/80 dark:text-amber-200/80 text-center mt-2 leading-tight">
            {achievement.label}
          </span>
        </div>
      </motion.div>

      {/* Pedestal */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-full">
        <div
          className={cn(
            "mx-auto rounded-t-sm",
            isMain ? "w-24 h-3" : "w-20 h-2"
          )}
          style={{
            background: 'linear-gradient(180deg, hsl(var(--trophy-gold-bright)) 0%, hsl(var(--trophy-gold-mid)) 50%, hsl(var(--trophy-gold-dark)) 100%)',
          }}
        />
        <div
          className={cn(
            "mx-auto rounded-b-sm",
            isMain ? "w-28 h-2" : "w-24 h-1.5"
          )}
          style={{
            background: 'linear-gradient(180deg, hsl(var(--trophy-gold-dark)) 0%, hsl(var(--trophy-gold-deep)) 100%)',
          }}
        />
      </div>
    </motion.div>
  );
}

export function TrophyHall({ streak, focusMinutes, habitsCompleted, className }: TrophyHallProps) {
  const { t, language } = useLanguage();
  const { effectiveTheme } = useTheme();
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const errorTimerRef = useRef<number | null>(null);

  // Cleanup error timer on unmount
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    };
  }, []);

  // Share achievements as Canvas 2D generated image
  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    setShareError(false);

    try {
      const cardTranslations: ShareCardTranslations = {
        ...DEFAULT_CARD_TRANSLATIONS,
        streak: t.shareCardStreak || DEFAULT_CARD_TRANSLATIONS.streak,
        focus: t.shareCardFocus || DEFAULT_CARD_TRANSLATIONS.focus,
        habits: t.shareCardHabits || DEFAULT_CARD_TRANSLATIONS.habits,
        trackHabits: t.shareCardTrackHabits || DEFAULT_CARD_TRANSLATIONS.trackHabits,
      };
      const theme = effectiveTheme === 'dark' ? 'dark' : 'light';
      const blob = await generateTrophyCard(
        { streak, focusMinutes, habitsCompleted },
        cardTranslations,
        theme,
        language,
      );

      await shareImage(
        blob,
        t.shareAchievements || 'My ZenFlow Achievements',
        `${streak} ${t.daysInRow || 'day streak'} | ${focusMinutes} ${t.focusMinutes || 'focus mins'} | ${habitsCompleted} ${t.habitsCompleted || 'habits'}`
      );
    } catch (error) {
      logger.error('Share failed:', error);
      void hapticError();
      setShareError(true);
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = window.setTimeout(() => setShareError(false), 3000);
    } finally {
      setIsSharing(false);
    }
  };

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
      ref={cardRef}
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
        onClick={handleShare}
        disabled={isSharing}
        className={cn(
          "absolute top-3 end-3 z-20 p-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-all",
          "bg-amber-500/20 hover:bg-amber-500/40",
          "backdrop-blur-sm border border-amber-500/30",
          isSharing && "opacity-50 cursor-wait"
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isSharing ? (t.sharing || 'Sharing...') : (t.shareAchievements || 'Share achievements')}
      >
        {isSharing ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Share2 className="w-4 h-4 text-amber-700 dark:text-amber-200" aria-hidden="true" />
          </motion.div>
        ) : (
          <Share2 className="w-4 h-4 text-amber-700 dark:text-amber-200" aria-hidden="true" />
        )}
      </motion.button>

      {/* Share error toast */}
      {shareError && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-14 end-3 z-20 px-3 py-2 rounded-lg bg-destructive/90 text-destructive-foreground text-xs font-medium backdrop-blur-sm animate-fade-in"
        >
          {t.shareGenerateError || 'Failed to share. Try again.'}
        </div>
      )}

      {/* Theme-aware temple background */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-amber-50 via-orange-100/80 to-amber-100 dark:bg-none"
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background: `linear-gradient(180deg,
            hsl(var(--temple-bg-top)) 0%,
            hsl(var(--temple-bg-mid)) 20%,
            hsl(var(--temple-bg-bottom)) 50%,
            hsl(var(--temple-bg-mid)) 80%,
            hsl(var(--temple-bg-top)) 100%)`,
        }}
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
        className="absolute bottom-0 inset-x-0 h-16 hidden dark:block"
        style={{
          background: `linear-gradient(180deg,
            transparent 0%,
            hsl(var(--temple-marble) / 0.1) 50%,
            hsl(var(--temple-marble) / 0.2) 100%)`,
        }}
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
        className="absolute bottom-0 inset-x-0 h-24 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at bottom, hsl(var(--temple-ambient-glow) / 0.08) 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}

export default TrophyHall;
