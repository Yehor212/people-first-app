/**
 * Welcome Back Modal
 *
 * Shows when user returns after 3+ days of absence.
 * Features:
 * - Friendly welcome message
 * - Streak status (protected or lost)
 * - Habit suggestions based on past success rate
 * - Quick mood check-in option
 */

import { useState } from 'react';
import { Heart, TrendingUp, Calendar, Sparkles, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { MoodEntry, Habit } from '@/types';

interface WelcomeBackModalProps {
  daysAway: number;
  streakBroken: boolean;
  currentStreak: number;
  topHabits: Array<{ habit: Habit; successRate: number }>;
  onClose: () => void;
  onQuickMoodLog?: (mood: MoodEntry['mood']) => void;
}

export function WelcomeBackModal({
  daysAway,
  streakBroken,
  currentStreak,
  topHabits,
  onClose,
  onQuickMoodLog,
}: WelcomeBackModalProps) {
  const { t } = useLanguage();
  const [selectedMood, setSelectedMood] = useState<MoodEntry['mood'] | null>(null);

  const moods: Array<{ emoji: string; value: MoodEntry['mood']; label: string }> = [
    { emoji: '😊', value: 'great', label: t.moodGreat || 'Great' },
    { emoji: '🙂', value: 'good', label: t.moodGood || 'Good' },
    { emoji: '😐', value: 'okay', label: t.moodOkay || 'Okay' },
    { emoji: '😕', value: 'bad', label: t.moodBad || 'Bad' },
    { emoji: '😢', value: 'terrible', label: t.moodTerrible || 'Terrible' },
  ];

  const handleMoodSelect = (mood: MoodEntry['mood']) => {
    setSelectedMood(mood);
    if (onQuickMoodLog) {
      onQuickMoodLog(mood);
    }
  };

  const handleContinue = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative m-4 max-w-lg w-full bg-card rounded-2xl zen-shadow-card border border-border overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/20 rounded-full">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {t.reengageTitle || 'Welcome Back!'} 👋
                </h2>
                <p className="text-sm text-muted-foreground">
                  {(t.reengageSubtitle || "You've been away for {days} days").replace('{days}', String(daysAway))}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Streak Status */}
          <div className={`p-4 rounded-xl border ${
            streakBroken
              ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'
              : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <Calendar className={`w-5 h-5 ${
                streakBroken ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'
              }`} />
              <h3 className="font-semibold text-foreground">
                {streakBroken
                  ? (t.reengageStreakBroken || 'Streak Status')
                  : (t.reengageStreakProtected || 'Streak Protected!')}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {streakBroken
                ? ((t.reengageStreakBrokenMsg || 'Your streak was reset, but you can start fresh today! Previous streak: {streak} days.').replace('{streak}', String(currentStreak)))
                : ((t.reengageStreakProtectedMsg || 'Your {streak}-day streak is safe! Keep going!').replace('{streak}', String(currentStreak)))}
            </p>
          </div>

          {/* Top Habits */}
          {topHabits.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">
                  {t.reengageBestHabits || 'Your Best Habits'}
                </h3>
              </div>
              <div className="space-y-2">
                {topHabits.slice(0, 3).map(({ habit, successRate }) => (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between p-3 bg-accent rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{habit.icon}</span>
                      <span className="font-medium text-foreground">{habit.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-primary">
                      {Math.round(successRate)}% {t.reengageSuccessRate || 'success'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Mood Check-in */}
          {onQuickMoodLog && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-5 h-5 text-pink-500" />
                <h3 className="font-semibold text-foreground">
                  {t.reengageQuickMood || 'How are you feeling?'}
                </h3>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {moods.map((mood) => (
                  <button
                    key={mood.value}
                    onClick={() => handleMoodSelect(mood.value)}
                    className={`p-3 rounded-xl transition-all ${
                      selectedMood === mood.value
                        ? 'bg-primary text-primary-foreground scale-110 zen-shadow-sm'
                        : 'bg-accent hover:bg-accent/80'
                    }`}
                  >
                    <div className="text-2xl mb-1">{mood.emoji}</div>
                    <div className="text-xs font-medium">{mood.label}</div>
                  </button>
                ))}
              </div>
              {selectedMood && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400 text-center">
                  ✓ {t.reengageMoodLogged || 'Mood logged!'}
                </p>
              )}
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors zen-shadow-sm"
          >
            {t.reengageContinue || "Let's continue!"}
          </button>
        </div>
      </div>
    </div>
  );
}
