/**
 * Trends View - Long-term Analytics
 * Phase 12: Premium Redesign with glassmorphism, animations, and hover effects
 *
 * Shows mood trends, habit completion heatmap, and focus time patterns
 * over 7/30/90 day periods to help users see their progress.
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Calendar, Clock, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocale } from '@/lib/timeUtils';
import { MoodEntry, Habit, FocusSession } from '@/types';
import { safeAverage } from '@/lib/validation';
import { cn } from '@/lib/utils';

// Animation variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 15 }
  }
};

interface TrendsViewProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
}

type TimeRange = '7' | '30' | '90';

const MOOD_VALUES = {
  terrible: 1,
  bad: 2,
  okay: 3,
  good: 4,
  great: 5
};

export function TrendsView({ moods, habits, focusSessions }: TrendsViewProps) {
  const { t, language } = useLanguage();
  const locale = getLocale(language);
  const [timeRange, setTimeRange] = useState<TimeRange>('30');

  // Calculate mood trend data
  const moodTrendData = useMemo(() => {
    const days = parseInt(timeRange);
    const today = new Date();
    const data: Array<{ date: string; value: number; label: string }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Find moods for this day
      const dayMoods = moods.filter(m => m.date === dateStr);

      if (dayMoods.length > 0) {
        // Average mood for the day
        const avgValue = dayMoods.reduce((sum, m) => sum + MOOD_VALUES[m.mood], 0) / dayMoods.length;
        data.push({
          date: dateStr,
          value: avgValue,
          label: date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
        });
      } else {
        data.push({
          date: dateStr,
          value: 0, // No data
          label: date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
        });
      }
    }

    return data;
  }, [moods, timeRange, locale]);

  // Calculate habit completion rate data
  const habitCompletionData = useMemo(() => {
    const days = parseInt(timeRange);
    const today = new Date();
    const data: Array<{ date: string; rate: number; label: string }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Count how many habits were completed on this day
      const completedCount = habits.filter(h => h.completedDates?.includes(dateStr)).length;
      const totalHabits = habits.length;

      const rate = totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0;

      data.push({
        date: dateStr,
        rate,
        label: date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
      });
    }

    return data;
  }, [habits, timeRange, locale]);

  // Calculate focus time data (minutes per day)
  const focusTimeData = useMemo(() => {
    const days = parseInt(timeRange);
    const today = new Date();
    const data: Array<{ date: string; minutes: number; label: string }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Sum focus session minutes for this day (exclude aborted sessions)
      const dayMinutes = focusSessions
        .filter(s => s.date === dateStr && s.status !== 'aborted')
        .reduce((sum, s) => sum + (s.duration || 0), 0);

      data.push({
        date: dateStr,
        minutes: dayMinutes,
        label: date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
      });
    }

    return data;
  }, [focusSessions, timeRange, locale]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const moodsInRange = moodTrendData.filter(d => d.value > 0);
    const avgMood = safeAverage(moodsInRange.map(d => d.value));

    const avgHabitRate = safeAverage(habitCompletionData.map(d => d.rate));

    const totalFocusMinutes = focusTimeData.reduce((sum, d) => sum + d.minutes, 0);
    const avgFocusMinutes = safeAverage(focusTimeData.map(d => d.minutes));

    return {
      avgMood: avgMood.toFixed(1),
      avgHabitRate: Math.round(avgHabitRate),
      totalFocusMinutes,
      avgFocusMinutes: Math.round(avgFocusMinutes)
    };
  }, [moodTrendData, habitCompletionData, focusTimeData]);

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Time Range Selector */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{t.trendsTitle || 'Your Trends'}</h2>
        <div className="flex gap-2" role="group" aria-label={t.trendsTimeRange || 'Time range'}>
          {(['7', '30', '90'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              aria-pressed={timeRange === range}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                timeRange === range
                  ? 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              )}
            >
              {range}d
            </button>
          ))}
        </div>
      </motion.div>

      {/* Summary Stats Cards - Premium with hover effects */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <motion.div
          whileHover={{ y: -2 }}
          className="relative overflow-hidden p-4 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl
                     hover:shadow-[0_8px_25px_-5px_hsl(var(--primary)/0.15)] transition-shadow duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="text-xs text-muted-foreground mb-1">{t.trendsAvgMood || 'Avg Mood'}</div>
            <div className="text-2xl font-bold text-primary">{stats.avgMood}</div>
            <div className="text-xs text-muted-foreground">/5</div>
          </div>
        </motion.div>
        <motion.div
          whileHover={{ y: -2 }}
          className="relative overflow-hidden p-4 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl
                     hover:shadow-[0_8px_25px_-5px_hsl(var(--chart-habit)/0.15)] transition-shadow duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-habit)/0.05)] to-transparent pointer-events-none" />
          <div className="relative">
            <div className="text-xs text-muted-foreground mb-1">{t.trendsHabitRate || 'Habit Rate'}</div>
            <div className="text-2xl font-bold text-[hsl(var(--chart-habit))]">{stats.avgHabitRate}%</div>
          </div>
        </motion.div>
        <motion.div
          whileHover={{ y: -2 }}
          className="relative overflow-hidden p-4 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl
                     hover:shadow-[0_8px_25px_-5px_hsl(var(--chart-focus)/0.15)] transition-shadow duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-focus)/0.05)] to-transparent pointer-events-none" />
          <div className="relative">
            <div className="text-xs text-muted-foreground mb-1">{t.trendsFocusTime || 'Focus'}</div>
            <div className="text-2xl font-bold text-[hsl(var(--chart-focus))]">{stats.avgFocusMinutes}</div>
            <div className="text-xs text-muted-foreground">{t.minPerDay || 'min/day'}</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Mood Trend Chart - Premium Glassmorphism */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl p-4 zen-shadow-card border border-border/50"
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">{t.trendsMoodChart || 'Mood Over Time'}</h3>
          </div>
          <div role="img" aria-label={t.trendsMoodChart || 'Mood Over Time'}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={moodTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={timeRange === '7' ? 0 : timeRange === '30' ? 5 : 14}
                  className="text-muted-foreground"
                />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card) / 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid hsl(var(--border) / 0.5)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 8px 20px -4px hsl(var(--foreground) / 0.15)'
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--chart-mood))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--chart-mood))' }}
                  activeDot={{ r: 6, fill: 'hsl(var(--chart-mood))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Habit Completion Rate Chart - Premium Glassmorphism */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl p-4 zen-shadow-card border border-border/50"
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-habit)/0.05)] via-transparent to-transparent pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--chart-habit)/0.2)] to-[hsl(var(--chart-habit)/0.1)] flex items-center justify-center">
              <Calendar className="w-4 h-4 text-[hsl(var(--chart-habit))]" />
            </div>
            <h3 className="font-semibold text-foreground">{t.trendsHabitChart || 'Habit Completion'}</h3>
          </div>
          <div role="img" aria-label={t.trendsHabitChart || 'Habit Completion'}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={habitCompletionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={timeRange === '7' ? 0 : timeRange === '30' ? 5 : 14}
                  className="text-muted-foreground"
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card) / 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid hsl(var(--border) / 0.5)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 8px 20px -4px hsl(var(--foreground) / 0.15)'
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="rate" fill="hsl(var(--chart-habit))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Focus Time Chart - Premium Glassmorphism */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl p-4 zen-shadow-card border border-border/50"
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-focus)/0.05)] via-transparent to-transparent pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--chart-focus)/0.2)] to-[hsl(var(--chart-focus)/0.1)] flex items-center justify-center">
              <Clock className="w-4 h-4 text-[hsl(var(--chart-focus))]" />
            </div>
            <h3 className="font-semibold text-foreground">{t.trendsFocusChart || 'Focus Time'}</h3>
          </div>
          <div role="img" aria-label={t.trendsFocusChart || 'Focus Time'}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={focusTimeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={timeRange === '7' ? 0 : timeRange === '30' ? 5 : 14}
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card) / 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid hsl(var(--border) / 0.5)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 8px 20px -4px hsl(var(--foreground) / 0.15)'
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="minutes" fill="hsl(var(--chart-focus))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-center text-sm text-muted-foreground">
            {t.trendsTotalFocus || 'Total'}: <span className="font-semibold text-[hsl(var(--chart-focus))]">{stats.totalFocusMinutes}</span> {t.minutes || 'minutes'}
          </div>
        </div>
      </motion.div>

      {/* Insights hint - Premium */}
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.01 }}
        className="relative overflow-hidden p-4 bg-primary/10 rounded-xl border border-primary/20 cursor-pointer
                   hover:shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.3)] transition-shadow duration-300"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        <div className="relative flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <ChevronRight className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              {t.trendsInsightHint || 'Want personalized insights?'}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.trendsInsightHintDesc || 'Check the Insights panel on the home tab to discover patterns in your data.'}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
