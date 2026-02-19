/**
 * JournalStats — Advanced statistics view for journal
 *
 * IMPORTANT: This component imports Recharts (CJS) and MUST be lazy-loaded
 * to avoid TDZ errors. Use lazyWithRetry() or React.lazy() from the parent.
 */

import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { JournalEntry } from './types';
import { countWords } from './types';
import type { MoodType } from '@/types';

const MOOD_COLORS: Record<MoodType, string> = {
  great: '#4ade80',
  good: '#34d399',
  okay: '#fbbf24',
  bad: '#fb923c',
  terrible: '#f87171',
};

const MOOD_SCORE: Record<MoodType, number> = {
  terrible: 1, bad: 2, okay: 3, good: 4, great: 5,
};

interface JournalStatsProps {
  entries: JournalEntry[];
  onBack: () => void;
}

export function JournalStats({ entries, onBack }: JournalStatsProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const moodLabels = useMemo<Record<MoodType, string>>(() => ({
    great: ts.moodGreat || 'Great',
    good: ts.moodGood || 'Good',
    okay: ts.moodOkay || 'Okay',
    bad: ts.moodBad || 'Bad',
    terrible: ts.moodTerrible || 'Terrible',
  }), [ts]);

  const dayNames = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(language, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) =>
      formatter.format(new Date(2025, 0, 5 + i))
    );
  }, [language]);

  // Mood distribution
  const moodDist = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      if (e.mood) counts[e.mood] = (counts[e.mood] || 0) + 1;
    }
    return Object.entries(counts).map(([mood, count]) => ({
      name: moodLabels[mood as MoodType] || mood,
      value: count,
      color: MOOD_COLORS[mood as MoodType] || '#888',
    }));
  }, [entries, moodLabels]);

  // Mood over time (weekly average)
  const moodTimeline = useMemo(() => {
    const entriesWithMood = entries.filter(e => e.mood).sort((a, b) => a.createdAt - b.createdAt);
    if (entriesWithMood.length === 0) return [];

    // Group by week
    const weeks = new Map<string, number[]>();
    for (const e of entriesWithMood) {
      const d = new Date(e.createdAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split('T')[0];
      if (!weeks.has(key)) weeks.set(key, []);
      if (e.mood) weeks.get(key)?.push(MOOD_SCORE[e.mood]);
    }

    return [...weeks.entries()].slice(-12).map(([week, scores]) => ({
      week: new Date(week + 'T00:00:00').toLocaleDateString(language, { month: 'short', day: 'numeric' }),
      avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
    }));
  }, [entries, language]);

  // Writing frequency (entries per week, last 8 weeks)
  const frequency = useMemo(() => {
    const now = Date.now();
    const weeks: { week: string; count: number }[] = [];

    for (let i = 7; i >= 0; i--) {
      const weekStart = now - (i + 1) * 7 * 86400000;
      const weekEnd = now - i * 7 * 86400000;
      const count = entries.filter(e => e.createdAt >= weekStart && e.createdAt < weekEnd).length;
      const label = new Date(weekStart).toLocaleDateString(language, { month: 'short', day: 'numeric' });
      weeks.push({ week: label, count });
    }

    return weeks;
  }, [entries, language]);

  // Tag cloud
  const tagCloud = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      for (const tag of e.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));
  }, [entries]);

  // Streaks
  const streakData = useMemo(() => {
    const dates = [...new Set(entries.map(e => e.date))].sort();
    if (dates.length === 0) return { current: 0, longest: 0, thisMonth: 0, avgPerWeek: 0 };

    // Current streak (from today backwards)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dateSet = new Set(dates);

    let current = 0;
    const checkDate = new Date(today);
    // Allow starting from today or yesterday
    if (!dateSet.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (true) {
      const str = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (dateSet.has(str)) {
        current++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Longest streak
    let longest = 0;
    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00');
      const curr = new Date(dates[i] + 'T00:00:00');
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diff === 1) {
        streak++;
      } else {
        longest = Math.max(longest, streak);
        streak = 1;
      }
    }
    longest = Math.max(longest, streak);

    // This month
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = entries.filter(e => e.date.startsWith(monthStr)).length;

    // Avg per week (over last 4 weeks)
    const fourWeeksAgo = Date.now() - 28 * 86400000;
    const recentCount = entries.filter(e => e.createdAt >= fourWeeksAgo).length;
    const avgPerWeek = Math.round((recentCount / 4) * 10) / 10;

    return { current, longest, thisMonth, avgPerWeek };
  }, [entries]);

  // Most active day of week
  const dayActivity = useMemo(() => {
    const counts = new Array(7).fill(0);
    for (const e of entries) {
      const day = new Date(e.date + 'T00:00:00').getDay();
      counts[day]++;
    }
    return dayNames.map((name, i) => ({ day: name, count: counts[i] }));
  }, [entries, dayNames]);

  const totalWords = useMemo(() => {
    return entries.reduce((sum, e) => sum + countWords(e.content), 0);
  }, [entries]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={ts.back || 'Back'}
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-base font-bold text-foreground">
          {ts.journalStatsTitle || 'Diary Statistics'}
        </h2>
        <div className="w-[44px]" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              {ts.journalStatsEmpty || 'Start writing to see your statistics'}
            </p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {([
                { label: ts.journalStatsTotal || 'Total Entries', value: String(entries.length) },
                { label: ts.journalStatsTotalWords || 'Total Words', value: totalWords.toLocaleString() },
                { label: ts.journalStatsStreaks || 'Current Streak', value: `${streakData.current} ${ts.journalStatsDays || 'days'}` },
                { label: ts.journalStatsLongestStreak || 'Longest Streak', value: `${streakData.longest} ${ts.journalStatsDays || 'days'}` },
                { label: ts.journalStatsThisMonth || 'This Month', value: String(streakData.thisMonth) },
                { label: ts.journalStatsAvgPerWeek || 'Avg / Week', value: String(streakData.avgPerWeek) },
              ]).map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-3 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20"
                >
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{card.label}</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{card.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Mood distribution */}
            {moodDist.length > 0 && (
              <div className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20">
                <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                  {ts.journalStatsMoodDist || 'Mood Distribution'}
                </h3>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie
                        data={moodDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={55}
                        dataKey="value"
                        stroke="none"
                      >
                        {moodDist.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1">
                    {moodDist.map(m => (
                      <div key={m.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                        <span className="text-xs text-foreground flex-1">{m.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Mood over time */}
            {moodTimeline.length > 2 && (
              <div className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20">
                <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                  {ts.journalStatsMoodTime || 'Mood Over Time'}
                </h3>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={moodTimeline}>
                    <XAxis dataKey="week" tick={{ fontSize: 9 }} stroke="#888" />
                    <YAxis domain={[1, 5]} tick={{ fontSize: 9 }} stroke="#888" width={20} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Line type="monotone" dataKey="avg" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Writing frequency */}
            {frequency.some(f => f.count > 0) && (
              <div className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20">
                <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                  {ts.journalStatsFrequency || 'Writing Frequency'}
                </h3>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={frequency}>
                    <XAxis dataKey="week" tick={{ fontSize: 8 }} stroke="#888" />
                    <YAxis tick={{ fontSize: 9 }} stroke="#888" width={20} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Most active day */}
            <div className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20">
              <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                {ts.journalStatsMostActiveDay || 'Most Active Day'}
              </h3>
              <div className="flex items-end gap-1.5 h-16">
                {dayActivity.map(d => {
                  const maxCount = Math.max(...dayActivity.map(x => x.count), 1);
                  const height = (d.count / maxCount) * 100;
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          'w-full rounded-t-md transition-all',
                          d.count > 0 ? 'bg-primary/60' : 'bg-muted/30',
                        )}
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground/60">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tag cloud */}
            {tagCloud.length > 0 && (
              <div className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20">
                <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                  {ts.journalStatsTagCloud || 'Top Tags'}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {tagCloud.map(({ tag, count }) => {
                    const maxCount = tagCloud[0].count;
                    const size = 10 + (count / maxCount) * 6; // 10-16px
                    return (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-primary/8 text-primary/80"
                        style={{ fontSize: `${size}px` }}
                      >
                        #{tag} <span className="text-muted-foreground/50">{count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
