/**
 * Trends View - Long-term Analytics
 *
 * Shows mood trends, habit completion heatmap, and focus time patterns
 * over 7/30/90 day periods to help users see their progress.
 */

import { useMemo, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Calendar, Clock, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocale } from '@/lib/timeUtils';
import { MoodEntry, Habit, FocusSession } from '@/types';
import { safeAverage } from '@/lib/validation';

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
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{t.trendsTitle || 'Your Trends'}</h2>
        <div className="flex gap-2" role="group" aria-label={t.trendsTimeRange || 'Time range'}>
          {(['7', '30', '90'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              aria-pressed={timeRange === range}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {range}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-card border border-border rounded-xl">
          <div className="text-xs text-muted-foreground mb-1">{t.trendsAvgMood || 'Avg Mood'}</div>
          <div className="text-2xl font-bold text-primary">{stats.avgMood}</div>
          <div className="text-xs text-muted-foreground">/5</div>
        </div>
        <div className="p-3 bg-card border border-border rounded-xl">
          <div className="text-xs text-muted-foreground mb-1">{t.trendsHabitRate || 'Habit Rate'}</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.avgHabitRate}%</div>
        </div>
        <div className="p-3 bg-card border border-border rounded-xl">
          <div className="text-xs text-muted-foreground mb-1">{t.trendsFocusTime || 'Focus'}</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.avgFocusMinutes}</div>
          <div className="text-xs text-muted-foreground">{t.minPerDay || 'min/day'}</div>
        </div>
      </div>

      {/* Mood Trend Chart */}
      <div className="bg-card rounded-2xl p-4 zen-shadow-card border border-border">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{t.trendsMoodChart || 'Mood Over Time'}</h3>
        </div>
        <div role="img" aria-label={t.trendsMoodChart || 'Mood Over Time'}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={moodTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={timeRange === '7' ? 0 : timeRange === '30' ? 5 : 14}
              />
              <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Habit Completion Rate Chart */}
      <div className="bg-card rounded-2xl p-4 zen-shadow-card border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-foreground">{t.trendsHabitChart || 'Habit Completion'}</h3>
        </div>
        <div role="img" aria-label={t.trendsHabitChart || 'Habit Completion'}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={habitCompletionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={timeRange === '7' ? 0 : timeRange === '30' ? 5 : 14}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="rate" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Focus Time Chart */}
      <div className="bg-card rounded-2xl p-4 zen-shadow-card border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-foreground">{t.trendsFocusChart || 'Focus Time'}</h3>
        </div>
        <div role="img" aria-label={t.trendsFocusChart || 'Focus Time'}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={focusTimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={timeRange === '7' ? 0 : timeRange === '30' ? 5 : 14}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 text-center text-sm text-muted-foreground">
          {t.trendsTotalFocus || 'Total'}: {stats.totalFocusMinutes} {t.minutes || 'minutes'}
        </div>
      </div>

      {/* Insights hint */}
      <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
        <div className="flex items-start gap-3">
          <ChevronRight className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              {t.trendsInsightHint || 'Want personalized insights?'}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.trendsInsightHintDesc || 'Check the Insights panel on the home tab to discover patterns in your data.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
