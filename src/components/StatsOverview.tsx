import { useState, useEffect } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { getToday, calculateStreak } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { StreakCelebration } from './StreakCelebration';
import { shouldShowStreakMessage } from '@/lib/motivationalMessages';
import { safeParseInt } from '@/lib/validation';

interface StatsOverviewProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  restDays?: string[];
  currentFocusMinutes?: number;
}

export function StatsOverview({ moods, habits, focusSessions, gratitudeEntries, restDays = [], currentFocusMinutes }: StatsOverviewProps) {
  const { t } = useLanguage();
  const today = getToday();
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastShownStreak, setLastShownStreak] = useState<number>(() => {
    const saved = localStorage.getItem('zenflow-last-shown-streak');
    return saved ? safeParseInt(saved, 0, 0) : 0;
  });

  const todayHabitsCompleted = habits.filter(h => h.completedDates.includes(today)).length;
  const totalHabits = habits.length;

  // Calculate streak based on ANY activity (mood, habits, focus, gratitude, rest days)
  // User has until 00:00 next day to continue streak
  const allActivityDates = [
    ...moods.map(m => m.date),
    ...habits.flatMap(h => h.completedDates),
    ...focusSessions.map(f => f.date),
    ...gratitudeEntries.map(g => g.date),
    ...restDays, // Rest days count towards streak!
  ];
  const uniqueActivityDates = [...new Set(allActivityDates)].sort();
  const streak = calculateStreak(uniqueActivityDates);

  useEffect(() => {
    if (shouldShowStreakMessage(streak, lastShownStreak)) {
      setShowCelebration(true);
      setLastShownStreak(streak);
      localStorage.setItem('zenflow-last-shown-streak', streak.toString());
    }
  }, [streak, lastShownStreak]);

  const todayFocusMinutes = currentFocusMinutes !== undefined
    ? currentFocusMinutes
    : focusSessions.filter(s => s.date === today).reduce((acc, s) => acc + s.duration, 0);

  const totalGratitude = gratitudeEntries.length;

  const stats = [
    {
      emoji: '🔥',
      label: t.streakDays,
      value: streak,
      suffix: t.days,
      gradient: 'from-orange-500/20 to-red-500/20',
      borderColor: 'border-orange-500/30',
      valueColor: 'text-orange-400',
    },
    {
      emoji: '🎯',
      label: t.habitsToday,
      value: `${todayHabitsCompleted}/${totalHabits}`,
      suffix: '',
      gradient: 'from-emerald-500/20 to-teal-500/20',
      borderColor: 'border-emerald-500/30',
      valueColor: 'text-emerald-400',
    },
    {
      emoji: '🧠',
      label: t.focusToday,
      value: todayFocusMinutes,
      suffix: t.min,
      gradient: 'from-violet-500/20 to-purple-500/20',
      borderColor: 'border-violet-500/30',
      valueColor: 'text-violet-400',
    },
    {
      emoji: '💜',
      label: t.gratitudes,
      value: totalGratitude,
      suffix: '',
      gradient: 'from-pink-500/20 to-rose-500/20',
      borderColor: 'border-pink-500/30',
      valueColor: 'text-pink-400',
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`
              stat-card-animated relative overflow-hidden
              bg-gradient-to-br ${stat.gradient}
              border ${stat.borderColor}
              rounded-2xl p-4
              hover:scale-[1.02] transition-all duration-300
              cursor-default group
            `}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Emoji */}
            <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
              {stat.emoji}
            </div>

            {/* Value */}
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${stat.valueColor}`}>
                {stat.value}
              </span>
              {stat.suffix && (
                <span className="text-xs text-muted-foreground">{stat.suffix}</span>
              )}
            </div>

            {/* Label */}
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {showCelebration && (
        <StreakCelebration
          streak={streak}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </>
  );
}
