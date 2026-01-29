/**
 * StreakBanner - Prominent streak display for home tab
 * Shows current activity streak with motivational messaging
 * Includes Rest Mode button for low-energy days
 */

import { memo, useMemo, useState } from 'react';
import { Flame, Zap, Trophy, Moon, Share2 } from 'lucide-react';
import { ShareModal } from './ShareModal';
import { FireAnimation } from './FireAnimation';
import { hapticTap } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { getToday, calculateStreak } from '@/lib/utils';

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
  const today = getToday();
  const [showShareModal, setShowShareModal] = useState(false);

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

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-3 transition-all",
      streak >= 7
        ? "bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20 ring-1 ring-yellow-500/30"
        : streak >= 3
          ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 ring-1 ring-orange-500/30"
          : "bg-gradient-to-r from-primary/10 to-accent/10 ring-1 ring-primary/20"
    )}>
      {/* Background glow for high streaks */}
      {streak >= 7 && (
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-orange-500/10 animate-pulse" />
      )}

      <div className="relative flex items-center gap-3">
        {/* Icon / Fire Animation */}
        {streak >= 3 ? (
          <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 -ml-1">
            <FireAnimation size="md" />
          </div>
        ) : (
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
            "bg-primary/20 text-primary"
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

        {/* Today's progress indicator */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0" role="group" aria-label={t.todayProgress}>
          <div className="flex gap-0.5">
            {[
              { emoji: '💜', label: t.moodToday, done: todayProgress.hasMood },
              { emoji: '🎯', label: t.habits, done: todayProgress.hasHabits },
              { emoji: '🧠', label: t.focus, done: todayProgress.hasFocus },
              { emoji: '💖', label: t.gratitude, done: todayProgress.hasGratitude }
            ].map((item, i) => (
              <span
                key={i}
                className={cn(
                  "text-sm transition-all",
                  item.done ? "opacity-100 scale-100" : "opacity-30 scale-90"
                )}
                role="img"
                aria-label={`${item.label}: ${item.done ? t.completed : ''}`}
              >
                {item.done ? '✅' : item.emoji}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {todayProgress.completed}/4
          </span>
        </div>

        {/* Share button */}
        {streak >= 3 && (
          <button
            onClick={() => {
              hapticTap();
              setShowShareModal(true);
            }}
            className={cn(
              "p-2 rounded-lg transition-colors flex-shrink-0",
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

      {/* Share Modal */}
      <ShareModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        mode="streak"
        streak={streak}
      />
    </div>
  );
});
