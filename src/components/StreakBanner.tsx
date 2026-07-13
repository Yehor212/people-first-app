/**
 * StreakBanner - Prominent streak display for home tab
 * Shows current activity streak with motivational messaging
 * Includes Rest Mode button for low-energy days
 */

import { memo, useMemo, useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { zenMotion } from '@/lib/animationUtils';
import { Flame, Zap, Trophy, Moon, Share2, Check, Heart, Target, Brain, Sparkles } from 'lucide-react';
import { hapticTap } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useLanguage } from '@/contexts/LanguageContext';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { getToday, calculateStreak } from '@/lib/utils';
import { isHabitCompletedOnDate, getHabitCompletedDates } from '@/lib/habits';
import { useShouldAnimate } from '@/hooks/useShouldAnimate';
import { UnifiedShareModal } from '@/components/share';

const FireAnimation = lazyWithRetry(() => import('./FireAnimation'), 'FireAnimation');

interface StreakBannerProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  restDays?: string[];
  onRestMode?: () => void;
  isRestMode?: boolean;
  canActivateRestMode?: boolean;
  daysUntilRestAvailable?: number;
}

export const StreakBanner = memo(function StreakBanner({ moods, habits, focusSessions, gratitudeEntries, restDays = [], onRestMode, isRestMode = false, canActivateRestMode = true, daysUntilRestAvailable = 0 }: StreakBannerProps) {
  const { t } = useLanguage();
  const showAnimations = useShouldAnimate();
  const today = getToday();
  const [showShareModal, setShowShareModal] = useState(false);

  // Animation flags
  const showStreakFire = showAnimations;

  // Calculate streak based on ANY activity (including rest days)
  const streak = useMemo(() => {
    const allActivityDates = [
      ...moods.map(m => m.date),
      ...habits.flatMap(h => getHabitCompletedDates(h)),
      ...focusSessions.map(f => f.date),
      ...gratitudeEntries.map(g => g.date),
      ...restDays, // Rest days count towards streak!
    ];
    const uniqueActivityDates = [...new Set(allActivityDates)].sort();
    return calculateStreak(uniqueActivityDates);
  }, [moods, habits, focusSessions, gratitudeEntries, restDays]);

  // Check today's progress
  const todayProgress = useMemo(() => {
    const hasMood = moods.some(m => m.date === today);
    const hasHabits = habits.length === 0 || habits.some(h => isHabitCompletedOnDate(h, today));
    const hasFocus = focusSessions.some(s => s.date === today);
    const hasGratitude = gratitudeEntries.some(g => g.date === today);

    const completed = [hasMood, hasHabits, hasFocus, hasGratitude].filter(Boolean).length;
    return { completed, total: 4, hasMood, hasHabits, hasFocus, hasGratitude };
  }, [moods, habits, focusSessions, gratitudeEntries, today]);

  // Get streak message
  const getMessage = () => {
    if (streak === 0) {
      return t.startStreak;
    }
    if (streak >= 30) {
      return t.legendaryStreak;
    }
    if (streak >= 7) {
      return t.amazingStreak;
    }
    if (streak >= 3) {
      return t.keepItUp;
    }
    return t.goodStart;
  };

  // Get icon based on streak
  const Icon = streak >= 7 ? Trophy : streak >= 3 ? Flame : Zap;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-3 motion-safe:transition-all",
      streak >= 7
        ? "bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20 dark:from-yellow-500/30 dark:via-orange-500/30 dark:to-red-500/30 ring-1 ring-yellow-500/30"
        : streak >= 3
          ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 dark:from-orange-500/30 dark:to-red-500/30 ring-1 ring-orange-500/30"
          : "bg-gradient-to-r from-primary/10 to-accent/10 dark:from-primary/20 dark:to-accent/20 ring-1 ring-primary/20"
    )}>
      {/* Background glow for high streaks */}
      {streak >= 7 && (
        <div className={cn(
          "absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-orange-500/10",
          showAnimations && "motion-safe:animate-pulse"
        )} />
      )}

      <div className="relative flex items-center gap-3">
        {/* Icon / Fire Animation */}
        {streak >= 3 && showStreakFire ? (
          <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 -ms-1">
            <Suspense fallback={<div className="w-12 h-16" />}>
              <FireAnimation size="md" />
            </Suspense>
          </div>
        ) : (
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
            streak >= 3 ? "bg-orange-500/20 text-orange-500" : "bg-primary/20 text-primary"
          )}>
            <Icon className="w-5 h-5" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className={cn(
              "text-2xl font-bold",
              streak >= 7 ? "text-yellow-500" : streak >= 3 ? "text-orange-500" : "text-primary"
            )}>
              {streak}
            </span>
            <span className="text-xs text-muted-foreground">
              {t.daysInRow}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {getMessage()}
          </p>
        </div>

        {/* Premium Progress Orbs */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0" role="group" aria-label={t.todayProgress}>
          <div className="flex gap-1.5">
            {[
              {
                id: 'mood',
                Icon: Heart,
                done: todayProgress.hasMood,
                gradient: 'from-purple-500/60 to-violet-600/60',
                glowColor: 'rgba(139, 92, 246, 0.5)',
                label: t.moodToday
              },
              {
                id: 'habits',
                Icon: Target,
                done: todayProgress.hasHabits,
                gradient: 'from-emerald-500/60 to-teal-600/60',
                glowColor: 'rgba(16, 185, 129, 0.5)',
                label: t.habits
              },
              {
                id: 'focus',
                Icon: Brain,
                done: todayProgress.hasFocus,
                gradient: 'from-amber-500/60 to-orange-600/60',
                glowColor: 'rgba(245, 158, 11, 0.5)',
                label: t.focus
              },
              {
                id: 'gratitude',
                Icon: Sparkles,
                done: todayProgress.hasGratitude,
                gradient: 'from-pink-500/60 to-rose-600/60',
                glowColor: 'rgba(236, 72, 153, 0.5)',
                label: t.gratitude
              }
            ].map((activity) => (
              showAnimations ? (
                <motion.div
                  key={activity.id}
                  className={cn(
                    "relative w-7 h-7 rounded-full flex items-center justify-center",
                    "border motion-safe:transition-all",
                    activity.done
                      ? `bg-gradient-to-br ${activity.gradient} border-white/30`
                      : "bg-foreground/5 dark:bg-foreground/5 border-foreground/10"
                  )}
                  style={activity.done ? {
                    boxShadow: `0 0 12px ${activity.glowColor}`
                  } : {}}
                  initial={false}
                  animate={activity.done ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                  transition={zenMotion.snappy}
                  role="img"
                  aria-label={`${activity.label}: ${activity.done ? t.completed : ''}`}
                >
                  {activity.done ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <activity.Icon className="w-3.5 h-3.5 text-foreground/60" />
                  )}

                  {/* Pulse ring animation when done */}
                  {activity.done && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2"
                      style={{ borderColor: activity.glowColor }}
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeOut'
                      }}
                    />
                  )}
                </motion.div>
              ) : (
                <div
                  key={activity.id}
                  className={cn(
                    "relative w-7 h-7 rounded-full flex items-center justify-center",
                    "border",
                    activity.done
                      ? `bg-gradient-to-br ${activity.gradient} border-white/30`
                      : "bg-foreground/5 dark:bg-foreground/5 border-foreground/10"
                  )}
                  style={activity.done ? {
                    boxShadow: `0 0 12px ${activity.glowColor}`
                  } : {}}
                  role="img"
                  aria-label={`${activity.label}: ${activity.done ? t.completed : ''}`}
                >
                  {activity.done ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <activity.Icon className="w-3.5 h-3.5 text-foreground/60" />
                  )}
                </div>
              )
            ))}
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {todayProgress.completed} / 4
          </span>
        </div>

        {/* Share button */}
        {streak >= 3 && (
          <button
            onClick={() => {
              void hapticTap();
              setShowShareModal(true);
            }}
            className={cn(
              "p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg motion-safe:transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              streak >= 7
                ? "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500"
                : "bg-orange-500/20 hover:bg-orange-500/30 text-orange-500"
            )}
            aria-label={t.shareButton || 'Share'}
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress bar for today — GPU-accelerated via scaleX */}
      <div className="mt-2 h-1 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full motion-safe:transition-transform motion-safe:duration-500 origin-left rtl:origin-right",
            todayProgress.completed === 4
              ? "bg-gradient-to-r from-green-500 to-emerald-500"
              : "bg-gradient-to-r from-primary to-accent"
          )}
          style={{ transform: `scaleX(${todayProgress.completed / 4})` }}
        />
      </div>

      {/* Rest Mode Button - shown when no progress today and not already in rest mode */}
      {onRestMode && todayProgress.completed === 0 && !isRestMode && (
        <div className="mt-3">
          {canActivateRestMode ? (
            <button
              onClick={onRestMode}
              className="w-full py-2.5 flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl motion-safe:transition-colors text-sm font-medium"
            >
              <Moon className="w-4 h-4" aria-hidden="true" />
              {t.restDayButton}
            </button>
          ) : (
            <div className="py-2.5 flex items-center justify-center gap-2 bg-muted/30 text-muted-foreground rounded-xl text-sm">
              <Moon className="w-4 h-4 opacity-50" />
              <span>{t.restDayAvailableIn} {daysUntilRestAvailable} {t.days}</span>
            </div>
          )}
        </div>
      )}

      {/* Share Streak Modal */}
      <UnifiedShareModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        mode="streak"
        streak={streak}
      />
    </div>
  );
});
