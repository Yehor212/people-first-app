import { useMemo } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { calculateStreak } from '@/lib/utils';
import { TrendingUp, Calendar, Zap, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface StatsPageProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
}

const moodEmojis: Record<string, string> = {
  great: '😄',
  good: '🙂',
  okay: '😐',
  bad: '😔',
  terrible: '😢',
};

export function StatsPage({ moods, habits, focusSessions, gratitudeEntries }: StatsPageProps) {
  const { t } = useLanguage();
  
  const monthNames = [
    t.january, t.february, t.march, t.april, t.may, t.june,
    t.july, t.august, t.september, t.october, t.november, t.december
  ];
  
  const moodLabels: Record<string, string> = {
    great: t.great,
    good: t.good,
    okay: t.okay,
    bad: t.bad,
    terrible: t.terrible,
  };

  const stats = useMemo(() => {
    const totalFocusMinutes = focusSessions.reduce((acc, s) => acc + s.duration, 0);
    const totalHabitCompletions = habits.reduce((acc, h) => acc + h.completedDates.length, 0);
    
    const allDates = habits.flatMap(h => h.completedDates);
    const uniqueDates = [...new Set(allDates)].sort();
    const currentStreak = calculateStreak(uniqueDates);
    
    const moodCounts = moods.reduce((acc, m) => {
      acc[m.mood] = (acc[m.mood] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const thisMonthMoods = moods.filter(m => m.date.startsWith(thisMonth));
    const thisMonthFocus = focusSessions.filter(s => s.date.startsWith(thisMonth));
    const thisMonthGratitude = gratitudeEntries.filter(g => g.date.startsWith(thisMonth));
    
    return {
      totalFocusMinutes,
      totalHabitCompletions,
      currentStreak,
      moodCounts,
      thisMonthMoods: thisMonthMoods.length,
      thisMonthFocusMinutes: thisMonthFocus.reduce((acc, s) => acc + s.duration, 0),
      thisMonthGratitude: thisMonthGratitude.length,
      monthName: monthNames[now.getMonth()],
    };
  }, [moods, habits, focusSessions, gratitudeEntries, monthNames]);

  const topHabit = habits.length > 0
    ? habits.reduce((a, b) => a.completedDates.length > b.completedDates.length ? a : b)
    : null;

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      <h2 className="text-2xl font-bold text-foreground">{t.statistics}</h2>

      {/* Monthly Overview */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 zen-gradient rounded-xl">
            <Calendar className="w-5 h-5 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{stats.monthName}</h3>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-2xl font-bold text-primary">{stats.thisMonthMoods}</p>
            <p className="text-xs text-muted-foreground">{t.moodEntries}</p>
          </div>
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-2xl font-bold text-accent">{stats.thisMonthFocusMinutes}</p>
            <p className="text-xs text-muted-foreground">{t.focusMinutes}</p>
          </div>
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-2xl font-bold text-mood-good">{stats.thisMonthGratitude}</p>
            <p className="text-xs text-muted-foreground">{t.gratitudes}</p>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 zen-gradient-sunset rounded-xl">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{t.achievements}</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
            <div>
              <p className="font-medium text-foreground">{t.currentStreak}</p>
              <p className="text-sm text-muted-foreground">{t.daysInRow}</p>
            </div>
            <div className="text-3xl font-bold text-accent">
              🔥 {stats.currentStreak}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
            <div>
              <p className="font-medium text-foreground">{t.totalFocus}</p>
              <p className="text-sm text-muted-foreground">{t.allTime}</p>
            </div>
            <div className="text-3xl font-bold text-primary">
              ⏱️ {stats.totalFocusMinutes}{t.min}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
            <div>
              <p className="font-medium text-foreground">{t.habitsCompleted}</p>
              <p className="text-sm text-muted-foreground">{t.totalTimes}</p>
            </div>
            <div className="text-3xl font-bold text-mood-good">
              ✅ {stats.totalHabitCompletions}
            </div>
          </div>
        </div>
      </div>

      {/* Mood Distribution */}
      {Object.keys(stats.moodCounts).length > 0 && (
        <div className="bg-card rounded-2xl p-6 zen-shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 zen-gradient-calm rounded-xl">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t.moodDistribution}</h3>
          </div>

          <div className="space-y-3">
            {(['great', 'good', 'okay', 'bad', 'terrible'] as const).map((mood) => {
              const count = stats.moodCounts[mood] || 0;
              const total = moods.length;
              const percentage = total > 0 ? (count / total) * 100 : 0;
              
              return (
                <div key={mood} className="flex items-center gap-3">
                  <span className="text-2xl w-10">{moodEmojis[mood]}</span>
                  <div className="flex-1">
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-mood-${mood} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Habit */}
      {topHabit && (
        <div className="bg-card rounded-2xl p-6 zen-shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 zen-gradient-warm rounded-xl">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t.topHabit}</h3>
          </div>

          <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
            <div className={`w-14 h-14 ${topHabit.color} rounded-xl flex items-center justify-center text-2xl`}>
              {topHabit.icon}
            </div>
            <div>
              <p className="font-semibold text-foreground">{topHabit.name}</p>
              <p className="text-sm text-muted-foreground">
                {t.completedTimes} {topHabit.completedDates.length} {t.completedTimes2}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
