import { useState, useEffect } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { getToday, calculateStreak } from '@/lib/utils';
import { Flame, Brain, Heart, Target } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { StreakCelebration } from './StreakCelebration';
import { shouldShowStreakMessage } from '@/lib/motivationalMessages';

interface StatsOverviewProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  currentFocusMinutes?: number;
}

export function StatsOverview({ moods, habits, focusSessions, gratitudeEntries, currentFocusMinutes }: StatsOverviewProps) {
  const { t } = useLanguage();
  const today = getToday();
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastShownStreak, setLastShownStreak] = useState<number>(() => {
    const saved = localStorage.getItem('zenflow-last-shown-streak');
    return saved ? parseInt(saved) : 0;
  });

  const todayHabitsCompleted = habits.filter(h => h.completedDates.includes(today)).length;
  const totalHabits = habits.length;

  const allCompletedDates = habits.flatMap(h => h.completedDates);
  const uniqueDates = [...new Set(allCompletedDates)].sort();
  const streak = calculateStreak(uniqueDates);

  // Check if we should show celebration
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
      icon: Flame,
      label: t.streakDays,
      value: streak,
      suffix: t.days,
      gradient: 'from-orange-500 to-red-500',
      shadowColor: 'shadow-orange-500/30',
      iconAnimation: 'streak-icon-animated',
    },
    {
      icon: Target,
      label: t.habitsToday,
      value: `${todayHabitsCompleted}/${totalHabits}`,
      suffix: '',
      gradient: 'from-emerald-500 to-teal-500',
      shadowColor: 'shadow-emerald-500/30',
      iconAnimation: 'habits-icon-animated',
    },
    {
      icon: Brain,
      label: t.focusToday,
      value: todayFocusMinutes,
      suffix: t.min,
      gradient: 'from-violet-500 to-purple-500',
      shadowColor: 'shadow-violet-500/30',
      iconAnimation: 'focus-icon-animated',
    },
    {
      icon: Heart,
      label: t.gratitudes,
      value: totalGratitude,
      suffix: '',
      gradient: 'from-pink-500 to-rose-500',
      shadowColor: 'shadow-pink-500/30',
      iconAnimation: 'gratitude-icon-animated',
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="stat-card-animated bg-card rounded-2xl p-4 zen-shadow-card hover:scale-[1.02] transition-all cursor-default group"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={`relative w-12 h-12 bg-gradient-to-br ${stat.gradient} rounded-xl flex items-center justify-center mb-3 shadow-lg ${stat.shadowColor} group-hover:scale-110 transition-transform`}>
              <stat.icon className={`w-6 h-6 text-white ${stat.iconAnimation}`} />
              {/* Pulse ring */}
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-30 animate-ping`} />
            </div>
            <p className="stat-value text-2xl font-bold text-foreground transition-all">
              <span className={`number-animated inline-block bg-clip-text text-transparent bg-gradient-to-r ${stat.gradient}`} style={{ animationDelay: `${index * 100 + 200}ms` }}>
                {stat.value}
              </span>
              {stat.suffix && <span className="text-sm text-muted-foreground ml-1">{stat.suffix}</span>}
            </p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Streak Celebration Modal */}
      {showCelebration && (
        <StreakCelebration
          streak={streak}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </>
  );
}
