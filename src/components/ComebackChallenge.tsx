/**
 * ComebackChallenge - Premium Comeback Challenge Component
 *
 * Shows a special challenge after 3+ days of absence:
 * - Animated welcome back message
 * - Bonus XP challenge with progress tracking
 * - Motivational design with cosmic effects
 * - Dismissable once completed or declined
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Gift,
  Target,
  X,
  Trophy,
  Flame,
  Star,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { cn, formatDate, getToday } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Habit } from '@/types';
import { isHabitCompletedOnDate } from '@/lib/habits';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import { announceSuccess } from '@/lib/a11y';

interface ComebackChallengeProps {
  habits: Habit[];
  lastActiveDate: string | null;
  onDismiss: () => void;
  onComplete: (xpEarned: number) => void;
  className?: string;
}

interface ChallengeProgress {
  daysActive: number;
  habitsCompletedToday: number;
  totalRequired: number;
  daysRequired: number;
}

// Sparkle particle for ambient effects
function SparkleParticle({ delay, color }: { delay: number; color: string }) {
  return (
    <motion.div
      className="absolute"
      style={{
        left: `${5 + Math.random() * 90}%`,
        top: `${5 + Math.random() * 90}%`,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [0, 1, 0],
        opacity: [0, 1, 0],
        rotate: [0, 180],
      }}
      transition={{
        duration: 2.5,
        delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 4,
      }}
    >
      <Sparkles className="w-3 h-3" style={{ color }} />
    </motion.div>
  );
}

// Mini progress ring
function ProgressRing({
  progress,
  size = 64,
  strokeWidth = 4,
  color,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-muted/20"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        stroke={color}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      />
    </svg>
  );
}

export function ComebackChallenge({
  habits,
  lastActiveDate,
  onDismiss,
  onComplete,
  className,
}: ComebackChallengeProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [challengeAccepted, setChallengeAccepted] = useState(false);
  const [challengeStartDate, setChallengeStartDate] = useState<string | null>(null);
  const today = getToday();

  // Calculate days since last activity
  const daysSinceActive = useMemo(() => {
    if (!lastActiveDate) return 999;
    const last = new Date(lastActiveDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - last.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }, [lastActiveDate]);

  // Challenge configuration
  const challengeConfig = useMemo(() => {
    if (daysSinceActive >= 14) {
      return { habitsRequired: 2, daysRequired: 5, xpReward: 200, tier: 'gold' };
    } else if (daysSinceActive >= 7) {
      return { habitsRequired: 2, daysRequired: 3, xpReward: 100, tier: 'silver' };
    } else {
      return { habitsRequired: 3, daysRequired: 3, xpReward: 50, tier: 'bronze' };
    }
  }, [daysSinceActive]);

  // Calculate progress
  const progress = useMemo((): ChallengeProgress => {
    if (!challengeAccepted || !challengeStartDate) {
      return {
        daysActive: 0,
        habitsCompletedToday: 0,
        totalRequired: challengeConfig.habitsRequired,
        daysRequired: challengeConfig.daysRequired,
      };
    }

    // Get dates from challenge start to today
    const dates: string[] = [];
    const start = new Date(challengeStartDate);
    const end = new Date(today);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(formatDate(d));
    }

    // Count active days (days with at least N habits completed)
    let daysActive = 0;
    dates.forEach(date => {
      const completedHabits = habits.filter(h => isHabitCompletedOnDate(h, date)).length;
      if (completedHabits >= challengeConfig.habitsRequired) {
        daysActive++;
      }
    });

    // Count habits completed today
    const habitsCompletedToday = habits.filter(h => isHabitCompletedOnDate(h, today)).length;

    return {
      daysActive,
      habitsCompletedToday,
      totalRequired: challengeConfig.habitsRequired,
      daysRequired: challengeConfig.daysRequired,
    };
  }, [challengeAccepted, challengeStartDate, habits, today, challengeConfig]);

  // Check if challenge is complete
  const isComplete = progress.daysActive >= challengeConfig.daysRequired;

  // Auto-complete handler
  useEffect(() => {
    if (isComplete && challengeAccepted) {
      hapticSuccess();
      announceSuccess(t.challengeCompleted || 'Challenge completed!');
      onComplete(challengeConfig.xpReward);
    }
  }, [isComplete, challengeAccepted, challengeConfig.xpReward, onComplete, t.challengeCompleted]);

  // Don't show if less than 3 days
  if (daysSinceActive < 3) {
    return null;
  }

  const handleAcceptChallenge = () => {
    hapticTap();
    setChallengeAccepted(true);
    setChallengeStartDate(today);
    setIsExpanded(true);
  };

  const handleDismiss = () => {
    hapticTap();
    onDismiss();
  };

  const tierColors = {
    gold: { primary: '#fbbf24', secondary: '#f59e0b', glow: 'rgba(251, 191, 36, 0.3)' },
    silver: { primary: '#94a3b8', secondary: '#64748b', glow: 'rgba(148, 163, 184, 0.3)' },
    bronze: { primary: '#f97316', secondary: '#ea580c', glow: 'rgba(249, 115, 22, 0.3)' },
  };

  const colors = tierColors[challengeConfig.tier as keyof typeof tierColors];
  const progressPercent = challengeAccepted
    ? (progress.daysActive / challengeConfig.daysRequired) * 100
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -20 }}
      className={cn(
        'relative overflow-hidden rounded-3xl',
        'bg-gradient-to-br from-card via-card to-card/90',
        'border border-border/50',
        'shadow-xl',
        className
      )}
    >
      {/* Animated cosmic background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full"
          style={{
            background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-1/2 -left-1/2 w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 60%)',
          }}
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />

        {/* Sparkle particles */}
        {[0, 0.6, 1.2, 1.8, 2.4].map((delay, i) => (
          <SparkleParticle
            key={i}
            delay={delay}
            color={i % 2 === 0 ? colors.primary : '#8b5cf6'}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors"
        aria-label={t.dismiss || 'Dismiss'}
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <motion.div
            className="relative p-3 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}30, ${colors.secondary}20)`,
              boxShadow: `0 0 20px ${colors.glow}`,
            }}
            animate={{
              boxShadow: [
                `0 0 15px ${colors.glow}`,
                `0 0 30px ${colors.glow}`,
                `0 0 15px ${colors.glow}`,
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Gift className="w-6 h-6" style={{ color: colors.primary }} />

            {/* Badge for tier */}
            <motion.div
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: colors.primary }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {challengeConfig.tier === 'gold' ? (
                <Crown className="w-3 h-3 text-black" />
              ) : challengeConfig.tier === 'silver' ? (
                <Star className="w-3 h-3 text-white" />
              ) : (
                <Zap className="w-3 h-3 text-white" />
              )}
            </motion.div>
          </motion.div>

          <div className="flex-1">
            <motion.h3
              className="text-lg font-bold text-foreground mb-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              {t.welcomeBack || 'Welcome Back!'}
            </motion.h3>
            <motion.p
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              {daysSinceActive >= 14
                ? t.missedYouLong || "We've missed you! Here's a special challenge."
                : daysSinceActive >= 7
                ? t.missedYouWeek || "It's been a week! Let's get back on track."
                : t.letsGetBackOnTrack || "Let's get back on track together!"}
            </motion.p>
          </div>
        </div>

        {/* Challenge card */}
        <motion.div
          className="p-4 rounded-2xl bg-gradient-to-br from-muted/40 to-muted/20 border border-border/30"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" style={{ color: colors.primary }} />
              <span className="text-sm font-medium text-foreground">
                {t.comebackChallenge || 'Comeback Challenge'}
              </span>
            </div>
            <div
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{
                background: `${colors.primary}20`,
                color: colors.primary,
              }}
            >
              +{challengeConfig.xpReward} XP
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            {t.comebackChallengeDesc?.replace('{habits}', String(challengeConfig.habitsRequired))
              .replace('{days}', String(challengeConfig.daysRequired)) ||
              `Complete ${challengeConfig.habitsRequired}+ habits for ${challengeConfig.daysRequired} days`}
          </p>

          {/* Progress visualization */}
          {challengeAccepted ? (
            <div className="flex items-center gap-4">
              <div className="relative">
                <ProgressRing
                  progress={progressPercent}
                  size={56}
                  strokeWidth={5}
                  color={colors.primary}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-foreground">
                    {progress.daysActive}/{challengeConfig.daysRequired}
                  </span>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">
                    {t.todayProgress || 'Today'}: {progress.habitsCompletedToday}/{challengeConfig.habitsRequired} {t.habits || 'habits'}
                  </span>
                </div>

                {/* Day indicators */}
                <div className="flex gap-1.5">
                  {Array.from({ length: challengeConfig.daysRequired }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-8 h-2 rounded-full"
                      style={{
                        background:
                          i < progress.daysActive
                            ? `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`
                            : 'var(--muted)',
                        opacity: i < progress.daysActive ? 1 : 0.3,
                      }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <motion.button
              onClick={handleAcceptChallenge}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm"
              style={{
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                color: challengeConfig.tier === 'silver' ? '#1e293b' : '#fff',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Trophy className="w-4 h-4" />
              {t.acceptChallenge || 'Accept Challenge'}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          )}
        </motion.div>

        {/* Completion celebration */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-3xl"
            >
              <motion.div
                className="text-center p-6"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
              >
                <motion.div
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                    boxShadow: `0 0 40px ${colors.glow}`,
                  }}
                  animate={{
                    scale: [1, 1.1, 1],
                    boxShadow: [
                      `0 0 30px ${colors.glow}`,
                      `0 0 50px ${colors.glow}`,
                      `0 0 30px ${colors.glow}`,
                    ],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Trophy className="w-8 h-8 text-white" />
                </motion.div>
                <h4 className="text-xl font-bold text-foreground mb-2">
                  {t.challengeCompleted || 'Challenge Completed!'}
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {t.youEarned || 'You earned'}{' '}
                  <span className="font-bold" style={{ color: colors.primary }}>
                    +{challengeConfig.xpReward} XP
                  </span>
                </p>
                <motion.button
                  onClick={handleDismiss}
                  className="px-6 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t.awesome || 'Awesome!'}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Crown icon for gold tier
function Crown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
    </svg>
  );
}

export default ComebackChallenge;
