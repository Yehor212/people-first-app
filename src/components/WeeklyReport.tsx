import { useMemo } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { TrendingUp, TrendingDown, Minus, Flame, Brain, Heart, Target, Calendar, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeeklyReportProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  onClose: () => void;
}

interface WeekStats {
  habitsCompleted: number;
  totalHabitsGoal: number;
  focusMinutes: number;
  gratitudeCount: number;
  moodAverage: number;
  bestDay: string;
  improvement: number;
}

function getWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

function getPreviousWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - (dayOfWeek === 0 ? 13 : dayOfWeek + 6));
  lastMonday.setHours(0, 0, 0, 0);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(lastMonday);
    date.setDate(lastMonday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

export function WeeklyReport({ moods, habits, focusSessions, gratitudeEntries, onClose }: WeeklyReportProps) {
  const { t, language } = useLanguage();

  const weekStats = useMemo(() => {
    const thisWeek = getWeekDates();
    const lastWeek = getPreviousWeekDates();

    // This week stats
    const thisWeekHabits = habits.flatMap(h =>
      h.completedDates.filter(d => thisWeek.includes(d))
    );
    const thisWeekFocus = focusSessions
      .filter(s => thisWeek.includes(s.date))
      .reduce((acc, s) => acc + s.duration, 0);
    const thisWeekGratitude = gratitudeEntries.filter(e => thisWeek.includes(e.date)).length;

    const thisWeekMoods = moods.filter(m => thisWeek.includes(m.date));
    const moodValues = { great: 5, good: 4, okay: 3, bad: 2, terrible: 1 };
    const avgMood = thisWeekMoods.length > 0
      ? thisWeekMoods.reduce((acc, m) => acc + moodValues[m.mood], 0) / thisWeekMoods.length
      : 3;

    // Previous week stats for comparison
    const lastWeekHabits = habits.flatMap(h =>
      h.completedDates.filter(d => lastWeek.includes(d))
    ).length;

    const improvement = lastWeekHabits > 0
      ? ((thisWeekHabits.length - lastWeekHabits) / lastWeekHabits) * 100
      : 0;

    // Find best day
    const dayStats = thisWeek.map(date => ({
      date,
      count: habits.filter(h => h.completedDates.includes(date)).length
    }));
    const bestDay = dayStats.reduce((max, day) => day.count > max.count ? day : max, dayStats[0]);

    return {
      habitsCompleted: thisWeekHabits.length,
      totalHabitsGoal: habits.length * 7,
      focusMinutes: thisWeekFocus,
      gratitudeCount: thisWeekGratitude,
      moodAverage: avgMood,
      bestDay: new Date(bestDay.date).toLocaleDateString(language, { weekday: 'long' }),
      improvement
    };
  }, [moods, habits, focusSessions, gratitudeEntries, language]);

  const getMotivationalMessage = () => {
    const completion = weekStats.totalHabitsGoal > 0
      ? (weekStats.habitsCompleted / weekStats.totalHabitsGoal) * 100
      : 0;

    if (completion >= 90) {
      return {
        emoji: '🏆',
        title: language === 'ru' ? 'Невероятная неделя!' :
               language === 'en' ? 'Incredible Week!' :
               language === 'uk' ? 'Неймовірний тиждень!' :
               language === 'es' ? '¡Semana increíble!' :
               language === 'de' ? 'Unglaubliche Woche!' :
               'Semaine incroyable!',
        message: language === 'ru' ? 'Вы на пути к мастерству!' :
                 language === 'en' ? 'You\'re on the path to mastery!' :
                 language === 'uk' ? 'Ви на шляху до майстерності!' :
                 language === 'es' ? '¡Estás en el camino hacia la maestría!' :
                 language === 'de' ? 'Du bist auf dem Weg zur Meisterschaft!' :
                 'Vous êtes sur la voie de la maîtrise!'
      };
    } else if (completion >= 70) {
      return {
        emoji: '🌟',
        title: language === 'ru' ? 'Отличная работа!' :
               language === 'en' ? 'Great Work!' :
               language === 'uk' ? 'Чудова робота!' :
               language === 'es' ? '¡Gran trabajo!' :
               language === 'de' ? 'Großartige Arbeit!' :
               'Excellent travail!',
        message: language === 'ru' ? 'Продолжайте в том же духе!' :
                 language === 'en' ? 'Keep up the momentum!' :
                 language === 'uk' ? 'Продовжуйте в тому ж дусі!' :
                 language === 'es' ? '¡Mantén el impulso!' :
                 language === 'de' ? 'Halte den Schwung!' :
                 'Gardez le rythme!'
      };
    } else if (completion >= 50) {
      return {
        emoji: '💪',
        title: language === 'ru' ? 'Хороший прогресс!' :
               language === 'en' ? 'Good Progress!' :
               language === 'uk' ? 'Гарний прогрес!' :
               language === 'es' ? '¡Buen progreso!' :
               language === 'de' ? 'Guter Fortschritt!' :
               'Bon progrès!',
        message: language === 'ru' ? 'Каждый шаг имеет значение!' :
                 language === 'en' ? 'Every step counts!' :
                 language === 'uk' ? 'Кожен крок має значення!' :
                 language === 'es' ? '¡Cada paso cuenta!' :
                 language === 'de' ? 'Jeder Schritt zählt!' :
                 'Chaque pas compte!'
      };
    } else {
      return {
        emoji: '🌱',
        title: language === 'ru' ? 'Новая неделя - новые возможности!' :
               language === 'en' ? 'New Week - New Opportunities!' :
               language === 'uk' ? 'Новий тиждень - нові можливості!' :
               language === 'es' ? '¡Nueva semana - Nuevas oportunidades!' :
               language === 'de' ? 'Neue Woche - Neue Möglichkeiten!' :
               'Nouvelle semaine - Nouvelles opportunités!',
        message: language === 'ru' ? 'Начните с малого, двигайтесь вперед!' :
                 language === 'en' ? 'Start small, move forward!' :
                 language === 'uk' ? 'Почніть з малого, рухайтеся вперед!' :
                 language === 'es' ? '¡Comienza poco a poco, avanza!' :
                 language === 'de' ? 'Fang klein an, geh vorwärts!' :
                 'Commencez petit, avancez!'
      };
    }
  };

  const motivation = getMotivationalMessage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative max-w-2xl w-full bg-card rounded-3xl p-8 shadow-2xl border border-primary/20 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{motivation.emoji}</div>
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {language === 'ru' ? 'Недельный отчет' :
             language === 'en' ? 'Weekly Report' :
             language === 'uk' ? 'Тижневий звіт' :
             language === 'es' ? 'Informe semanal' :
             language === 'de' ? 'Wochenbericht' :
             'Rapport hebdomadaire'}
          </h2>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString(language, { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Motivational Message */}
        <div className="mb-8 p-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl border-2 border-primary/20">
          <h3 className="text-xl font-bold mb-2">{motivation.title}</h3>
          <p className="text-muted-foreground">{motivation.message}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Habits */}
          <div className="bg-secondary rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-primary" />
              <p className="text-sm text-muted-foreground">
                {language === 'ru' ? 'Привычки' :
                 language === 'en' ? 'Habits' :
                 language === 'uk' ? 'Звички' :
                 language === 'es' ? 'Hábitos' :
                 language === 'de' ? 'Gewohnheiten' :
                 'Habitudes'}
              </p>
            </div>
            <p className="text-2xl font-bold">{weekStats.habitsCompleted}/{weekStats.totalHabitsGoal}</p>
            {weekStats.improvement !== 0 && (
              <div className={cn("flex items-center gap-1 text-sm mt-1",
                weekStats.improvement > 0 ? "text-mood-good" : "text-mood-bad"
              )}>
                {weekStats.improvement > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{Math.abs(Math.round(weekStats.improvement))}%</span>
              </div>
            )}
          </div>

          {/* Focus */}
          <div className="bg-secondary rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-primary" />
              <p className="text-sm text-muted-foreground">
                {language === 'ru' ? 'Фокус' :
                 language === 'en' ? 'Focus' :
                 language === 'uk' ? 'Фокус' :
                 language === 'es' ? 'Enfoque' :
                 language === 'de' ? 'Fokus' :
                 'Focus'}
              </p>
            </div>
            <p className="text-2xl font-bold">{weekStats.focusMinutes} {t.min}</p>
          </div>

          {/* Gratitude */}
          <div className="bg-secondary rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-primary" />
              <p className="text-sm text-muted-foreground">
                {language === 'ru' ? 'Благодарности' :
                 language === 'en' ? 'Gratitude' :
                 language === 'uk' ? 'Вдячності' :
                 language === 'es' ? 'Gratitud' :
                 language === 'de' ? 'Dankbarkeit' :
                 'Gratitude'}
              </p>
            </div>
            <p className="text-2xl font-bold">{weekStats.gratitudeCount}</p>
          </div>

          {/* Best Day */}
          <div className="bg-secondary rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-primary" />
              <p className="text-sm text-muted-foreground">
                {language === 'ru' ? 'Лучший день' :
                 language === 'en' ? 'Best Day' :
                 language === 'uk' ? 'Кращий день' :
                 language === 'es' ? 'Mejor día' :
                 language === 'de' ? 'Bester Tag' :
                 'Meilleur jour'}
              </p>
            </div>
            <p className="text-lg font-bold capitalize">{weekStats.bestDay}</p>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-4 bg-gradient-to-r from-primary to-accent text-white font-bold rounded-xl hover:shadow-lg transition-all"
        >
          {language === 'ru' ? 'Продолжить' :
           language === 'en' ? 'Continue' :
           language === 'uk' ? 'Продовжити' :
           language === 'es' ? 'Continuar' :
           language === 'de' ? 'Weiter' :
           'Continuer'}
        </button>
      </div>
    </div>
  );
}
