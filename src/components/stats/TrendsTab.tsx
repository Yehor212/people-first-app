/**
 * TrendsTab — Monthly stats, emotion distribution, weather, crystal, trophies
 * 0 useState — fully controlled via props.
 */

import { MoodEntry } from '@/types';
import { Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SectionHeader } from '@/components/ui/section-header';
import { AnimatedEmotionDistribution } from '@/components/AnimatedStatsComponents';
import { MoodWeather, WeekCrystal, TrophyHall } from '@/components/stats';
import type { StatsRange } from '@/hooks/useStatsCalculations';
import type { UseStatsPageDataReturn } from './useStatsPageData';

interface TrendsTabProps {
  stats: {
    monthName: string;
    thisMonthMoods: number;
    thisMonthFocusMinutes: number;
    thisMonthGratitude: number;
    currentStreak: number;
    allTimeFocusMinutes: number;
    totalHabitCompletions: number;
    emotionCounts: Record<string, number>;
  };
  premiumStats: { weekScore: number; weeklyChange: number };
  filteredMoods: MoodEntry[];
  ringWeeklyData: UseStatsPageDataReturn['ringWeeklyData'];
  currentWeatherInput: UseStatsPageDataReturn['currentWeatherInput'];
  range: StatsRange;
  onRangeChange: (range: StatsRange) => void;
  allTags: string[];
  selectedTag: string;
  onTagChange: (tag: string) => void;
  t: Record<string, string>;
  language: string;
}

export function TrendsTab({
  stats, premiumStats, filteredMoods, ringWeeklyData, currentWeatherInput,
  range, onRangeChange, allTags, selectedTag, onTagChange, t, language,
}: TrendsTabProps) {
  return (
    <>
      {/* Monthly Overview */}
      <Card elevation="elevated" className="p-4 sm:p-6">
        <SectionHeader
          icon={Calendar}
          title={stats.monthName}
          iconGradient="primary"
        />

        <SegmentedControl
          options={[
            { value: 'week' as const, label: t.statsRangeWeek },
            { value: 'month' as const, label: t.statsRangeMonth },
            { value: 'all' as const, label: t.statsRangeAll },
          ]}
          value={range}
          onChange={onRangeChange}
          aria-label={t.statsRange || 'Statistics range'}
          fullWidth
          className="mb-4"
        />

        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-secondary/60 rounded-xl">
            <p className="text-xl sm:text-2xl font-bold text-primary">{stats.thisMonthMoods}</p>
            <p className="whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
              {t.moodEntries}
            </p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-secondary/60 rounded-xl">
            <p className="text-xl sm:text-2xl font-bold text-accent">{stats.thisMonthFocusMinutes}</p>
            <p className="whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
              {t.focusMinutes}
            </p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-secondary/60 rounded-xl">
            <p className="text-xl sm:text-2xl font-bold text-mood-good">{stats.thisMonthGratitude}</p>
            <p className="whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
              {t.gratitudes}
            </p>
          </div>
        </div>
      </Card>

      {/* Emotion Distribution */}
      <AnimatedEmotionDistribution
        emotionCounts={stats.emotionCounts}
        totalEmotions={filteredMoods.length}
        title={t.moodDistribution}
        language={language}
        allTags={allTags}
        selectedTag={selectedTag}
        onTagChange={onTagChange}
        tagFilterLabel={t.moodTagFilter}
        allTagsLabel={t.allTags}
      />

      {/* Mood Weather + Week Crystal */}
      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
        <MoodWeather
          mood={currentWeatherInput.mood}
          emotion={currentWeatherInput.emotion}
        />
        <WeekCrystal
          score={premiumStats.weekScore}
          dailyScores={ringWeeklyData.mood.map(d => ({
            date: d.date,
            score: Math.round((d.value + (ringWeeklyData.habits.find(h => h.date === d.date)?.value || 0) + (ringWeeklyData.focus.find(f => f.date === d.date)?.value || 0)) / 3)
          }))}
          lastWeekScore={premiumStats.weekScore > 0 ? Math.max(0, premiumStats.weekScore - (premiumStats.weeklyChange || 0)) : undefined}
        />
      </div>

      {/* Trophy Hall */}
      <TrophyHall
        streak={stats.currentStreak}
        focusMinutes={stats.allTimeFocusMinutes}
        habitsCompleted={stats.totalHabitCompletions}
      />
    </>
  );
}
