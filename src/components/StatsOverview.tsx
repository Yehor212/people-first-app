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
      color: 'zen-gradient-sunset',
    },
    {
      icon: Target,
      label: t.habitsToday,
      value: `${todayHabitsCompleted}/${totalHabits}`,
      suffix: '',
      color: 'zen-gradient',
    },
    {
      icon: Brain,
      label: t.focusToday,
      value: todayFocusMinutes,
      suffix: t.min,
      color: 'zen-gradient-calm',
    },
    {
      icon: Heart,
      label: t.gratitudes,
      value: totalGratitude,
      suffix: '',
      color: 'zen-gradient-warm',
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="bg-card rounded-2xl p-4 zen-shadow-card"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stat.value}{stat.suffix && <span className="text-sm text-muted-foreground ml-1">{stat.suffix}</span>}
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
