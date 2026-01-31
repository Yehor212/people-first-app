import { useMemo } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { safeAverage } from '@/lib/validation';
import { useLanguage } from '@/contexts/LanguageContext';
import { TrendingUp, TrendingDown, Minus, Flame, Brain, Heart, Target, Calendar, Award, Sparkles, CalendarDays, X } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { motion } from 'framer-motion';

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
    dates.push(formatDate(date));
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
    dates.push(formatDate(date));
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
      (h.completedDates || []).filter(d => thisWeek.includes(d))
    );
    const thisWeekFocus = focusSessions
      .filter(s => thisWeek.includes(s.date))
      .reduce((acc, s) => acc + s.duration, 0);
    const thisWeekGratitude = gratitudeEntries.filter(e => thisWeek.includes(e.date)).length;

    const thisWeekMoods = moods.filter(m => thisWeek.includes(m.date));
    const moodValues: Record<string, number> = { great: 5, good: 4, okay: 3, bad: 2, terrible: 1 };
    const moodScores = thisWeekMoods.map(m => moodValues[m.mood] || 3);
    const avgMood = moodScores.length > 0 ? safeAverage(moodScores) : 3;

    // Previous week stats for comparison
    const lastWeekHabits = habits.flatMap(h =>
      (h.completedDates || []).filter(d => lastWeek.includes(d))
    ).length;

    const improvement = lastWeekHabits > 0
      ? ((thisWeekHabits.length - lastWeekHabits) / lastWeekHabits) * 100
      : 0;

    // Find best day
    const dayStats = thisWeek.map(date => ({
      date,
      count: habits.filter(h => h.completedDates?.includes(date)).length
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
        title: t.incredibleWeek,
        message: t.pathToMastery
      };
    } else if (completion >= 70) {
      return {
        emoji: '🌟',
        title: t.greatWork,
        message: t.keepMomentum
      };
    } else if (completion >= 50) {
      return {
        emoji: '💪',
        title: t.goodProgress,
        message: t.everyStepCounts
      };
    } else {
      return {
        emoji: '🌱',
        title: t.newWeekOpportunities,
        message: t.startSmall
      };
    }
  };

  const motivation = getMotivationalMessage();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-report-title"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative max-w-2xl w-full bg-card rounded-3xl shadow-2xl border border-border/50 max-h-[90vh] overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={t.close || 'Close'}
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Scrollable content */}
        <div className="max-h-[90vh] overflow-y-auto">
          {/* Premium Header with gradient background */}
          <div className="relative overflow-hidden">
            {/* Gradient background layers */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_50%)]" />

            {/* Header content */}
            <div className="relative p-8 pb-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-background/80 backdrop-blur-sm shadow-lg mb-4"
              >
                <span className="text-5xl">{motivation.emoji}</span>
              </motion.div>
              <h2 id="weekly-report-title" className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {t.weeklyReport}
              </h2>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString(language, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Motivational Message */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mx-6 mb-6 p-5 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent rounded-2xl border border-primary/20"
          >
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold mb-1">{motivation.title}</h3>
                <p className="text-sm text-muted-foreground">{motivation.message}</p>
              </div>
            </div>
          </motion.div>

          {/* Stats Grid - Premium cards */}
          <div className="grid grid-cols-2 gap-3 px-6 mb-6">
            {/* Habits */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              whileHover={{ y: -2 }}
              className="relative overflow-hidden rounded-xl bg-card border border-border/50 p-4 shadow-[0_2px_8px_-2px_hsl(var(--foreground)/0.08)] hover:shadow-[0_8px_20px_-4px_hsl(var(--primary)/0.15)] transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-3">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <p className="text-2xl font-bold tabular-nums">{weekStats.habitsCompleted}/{weekStats.totalHabitsGoal}</p>
              <p className="text-xs text-muted-foreground">{t.habits}</p>
              {weekStats.improvement !== 0 && (
                <div className={cn(
                  "absolute top-3 right-3 flex items-center gap-1 text-xs font-medium",
                  weekStats.improvement > 0 ? "text-[hsl(var(--mood-good))]" : "text-destructive"
                )}>
                  {weekStats.improvement > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(Math.round(weekStats.improvement))}%
                </div>
              )}
            </motion.div>

            {/* Focus */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ y: -2 }}
              className="relative overflow-hidden rounded-xl bg-card border border-border/50 p-4 shadow-[0_2px_8px_-2px_hsl(var(--foreground)/0.08)] hover:shadow-[0_8px_20px_-4px_hsl(var(--primary)/0.15)] transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center mb-3">
                <Brain className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold tabular-nums">{weekStats.focusMinutes}</p>
              <p className="text-xs text-muted-foreground">{t.focusMinutes || t.min}</p>
            </motion.div>

            {/* Gratitude */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              whileHover={{ y: -2 }}
              className="relative overflow-hidden rounded-xl bg-card border border-border/50 p-4 shadow-[0_2px_8px_-2px_hsl(var(--foreground)/0.08)] hover:shadow-[0_8px_20px_-4px_hsl(var(--primary)/0.15)] transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/10 flex items-center justify-center mb-3">
                <Heart className="w-5 h-5 text-pink-500" />
              </div>
              <p className="text-2xl font-bold tabular-nums">{weekStats.gratitudeCount}</p>
              <p className="text-xs text-muted-foreground">{t.gratitude}</p>
            </motion.div>

            {/* Best Day */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ y: -2 }}
              className="relative overflow-hidden rounded-xl bg-card border border-border/50 p-4 shadow-[0_2px_8px_-2px_hsl(var(--foreground)/0.08)] hover:shadow-[0_8px_20px_-4px_hsl(var(--primary)/0.15)] transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center mb-3">
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-lg font-bold capitalize truncate">{weekStats.bestDay}</p>
              <p className="text-xs text-muted-foreground">{t.bestDay}</p>
            </motion.div>
          </div>

          {/* Close Button */}
          <div className="px-6 pb-6">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              onClick={onClose}
              className="w-full py-4 bg-gradient-to-r from-primary to-accent text-white font-bold rounded-xl hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t.continueBtn}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
