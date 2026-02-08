/**
 * StreakBanner - Prominent streak display for home tab
 * Shows current activity streak with motivational messaging
 * Includes Rest Mode button for low-energy days
 */

import { memo, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Flame, Zap, Trophy, Moon, Share2, Check, Heart, Target, Brain, Sparkles, X, Download, Loader2 } from 'lucide-react';
import { FireAnimation } from './FireAnimation';
import { hapticTap } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { getToday, calculateStreak } from '@/lib/utils';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { logger } from '@/lib/logger';
import { useDopamineSettings } from './DopamineSettings';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';

// Lazy load html2canvas
const getHtml2Canvas = async () => {
  const module = await import('html2canvas');
  return module.default;
};

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
  const dopamine = useDopamineSettings();
  const today = getToday();
  const [showShareDialog, setShowShareDialog] = useState(false);

  useBackHandler(showShareDialog, () => setShowShareDialog(false));
  useScrollLock(showShareDialog);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);

  // Animation flags
  const showAnimations = dopamine.animations;
  const showStreakFire = dopamine.streakFire && showAnimations;

  // Calculate streak based on ANY activity (including rest days)
  const streak = useMemo(() => {
    const allActivityDates = [
      ...moods.map(m => m.date),
      ...habits.flatMap(h => h.completedDates),
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
    const hasHabits = habits.length === 0 || habits.some(h => h.completedDates?.includes(today));
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

  // Get achievement data for share card
  const getAchievementData = () => {
    if (streak >= 30) return { emoji: '👑', text: t.shareAchievement30 || 'Legendary!', subtext: t.shareSubtext30 || '30+ day streak' };
    if (streak >= 14) return { emoji: '💎', text: t.shareAchievement14 || 'Diamond!', subtext: t.shareSubtext14 || '14+ day streak' };
    if (streak >= 7) return { emoji: '🔥', text: t.shareAchievement7 || 'On Fire!', subtext: t.shareSubtext7 || '7+ day streak' };
    if (streak >= 3) return { emoji: '⭐', text: t.shareAchievement3 || 'Rising Star!', subtext: t.shareSubtext3 || '3+ day streak' };
    return { emoji: '🌱', text: t.shareAchievementStart || 'Just Started!', subtext: t.shareSubtextStart || 'Beginning the journey' };
  };

  const achievement = getAchievementData();

  // Handle share action
  const handleShare = async () => {
    if (!shareCardRef.current) return;

    try {
      setIsSharing(true);
      setShareError(null);
      const html2canvas = await getHtml2Canvas();
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 2,
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });

      if (Capacitor.isNativePlatform()) {
        try {
          const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
          });

          const fileName = `zenflow-streak-${Date.now()}.png`;
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          });

          await Share.share({
            title: t.shareTitle || 'My ZenFlow Streak',
            text: `${streak} ${t.shareStreak || 'day streak'}! 🔥`,
            files: [savedFile.uri],
            dialogTitle: t.shareDialogTitle,
          });

          try {
            await Filesystem.deleteFile({ path: fileName, directory: Directory.Cache });
          } catch (e) {
            logger.warn('[StreakBanner] Cleanup failed:', e);
          }
        } catch (error) {
          logger.error('[StreakBanner] Native share failed:', error);
          setShareError(t.shareFailed || 'Share failed');
          return;
        }
      } else {
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], 'zenflow-streak.png', { type: 'image/png' });
          await navigator.share({
            title: t.shareTitle || 'My ZenFlow Streak',
            text: `${streak} ${t.shareStreak || 'day streak'}! 🔥`,
            files: [file],
          });
        } else {
          downloadImage(blob);
        }
      }
      setShowShareDialog(false);
    } catch (error) {
      logger.error('[StreakBanner] Share failed:', error);
      setShareError(t.shareFailed || 'Share failed');
    } finally {
      setIsSharing(false);
    }
  };

  const downloadImage = async (existingBlob?: Blob) => {
    if (!shareCardRef.current) return;
    setIsSharing(true);
    try {
      let blob = existingBlob;
      if (!blob) {
        const html2canvas = await getHtml2Canvas();
        const canvas = await html2canvas(shareCardRef.current, { backgroundColor: null, scale: 2 });
        blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `zenflow-streak-${streak}-days.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('[StreakBanner] Download failed:', error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-3 transition-all",
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
          showAnimations && "animate-pulse"
        )} />
      )}

      <div className="relative flex items-center gap-3">
        {/* Icon / Fire Animation */}
        {streak >= 3 && showStreakFire ? (
          <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 -ml-1">
            <FireAnimation size="md" />
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
                    "border transition-all",
                    activity.done
                      ? `bg-gradient-to-br ${activity.gradient} border-white/30`
                      : "bg-white/5 dark:bg-white/5 border-white/10"
                  )}
                  style={activity.done ? {
                    boxShadow: `0 0 12px ${activity.glowColor}`
                  } : {}}
                  initial={false}
                  animate={activity.done ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                  role="img"
                  aria-label={`${activity.label}: ${activity.done ? t.completed : ''}`}
                >
                  {activity.done ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <activity.Icon className="w-3.5 h-3.5 text-white/40" />
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
                      : "bg-white/5 dark:bg-white/5 border-white/10"
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
                    <activity.Icon className="w-3.5 h-3.5 text-white/40" />
                  )}
                </div>
              )
            ))}
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {todayProgress.completed} of 4
          </span>
        </div>

        {/* Share button */}
        {streak >= 3 && (
          <button
            onClick={() => {
              hapticTap();
              setShowShareDialog(true);
            }}
            className={cn(
              "p-2 rounded-lg transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
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

      {/* Progress bar for today */}
      <div className="mt-2 h-1 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            todayProgress.completed === 4
              ? "bg-gradient-to-r from-green-500 to-emerald-500"
              : "bg-gradient-to-r from-primary to-accent"
          )}
          style={{ width: `${(todayProgress.completed / 4) * 100}%` }}
        />
      </div>

      {/* Rest Mode Button - shown when no progress today and not already in rest mode */}
      {onRestMode && todayProgress.completed === 0 && !isRestMode && (
        <div className="mt-3">
          {canActivateRestMode ? (
            <button
              onClick={onRestMode}
              className="w-full py-2.5 flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-colors text-sm font-medium"
            >
              <Moon className="w-4 h-4" />
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

      {/* Inline Share Dialog */}
      {showShareDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true">
          {/* Close button */}
          <button
            onClick={() => setShowShareDialog(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            aria-label={t.close || 'Close'}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div className="w-full max-w-sm">
            {/* Share Card */}
            <div
              ref={shareCardRef}
              className="relative overflow-hidden aspect-square"
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                borderRadius: '24px',
              }}
            >
              {/* Animated gradient orbs */}
              <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full opacity-40"
                style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />
              <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-30"
                style={{ background: 'radial-gradient(circle, #ef4444 0%, transparent 70%)' }} />

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col p-6 text-white">
                {/* Header */}
                <div className="flex items-center gap-3 mb-auto">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)' }}>
                    <Flame className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">ZenFlow</h1>
                    <p className="text-xs text-white/60">Streak Achievement</p>
                  </div>
                </div>

                {/* Main Achievement */}
                <div className="text-center my-6">
                  <div className="text-7xl mb-4">{achievement.emoji}</div>
                  <h2 className="font-black text-4xl mb-2"
                    style={{
                      background: 'linear-gradient(135deg, #f97316, #ef4444, #fbbf24)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                    {streak} {t.days || 'Days'}
                  </h2>
                  <p className="text-white/60 text-lg">{achievement.text}</p>
                </div>

                {/* Stats */}
                <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">{t.todayProgress || "Today's Progress"}</span>
                    <span className="font-bold text-lg">{todayProgress.completed}/4</span>
                  </div>
                  <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(todayProgress.completed / 4) * 100}%`,
                        background: 'linear-gradient(90deg, #f97316, #ef4444)',
                      }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-4">
                  <p className="text-xs text-white/40">zenflow.app</p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {shareError && (
              <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-center">
                <p className="text-red-400 text-sm">{shareError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="flex-1 py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)' }}
              >
                {isSharing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t.generating || 'Generating...'}
                  </>
                ) : (
                  <>
                    <Share2 className="w-5 h-5" />
                    {t.shareButton || 'Share'}
                  </>
                )}
              </button>
              <button
                onClick={() => downloadImage()}
                disabled={isSharing}
                className="py-4 px-6 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
