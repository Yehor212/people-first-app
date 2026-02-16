/**
 * OverviewTab — Stats overview with ZenScore, quick actions, insights, galaxy
 * Pure component, 0 useState.
 */

import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { Heart, Target, PlayCircle } from 'lucide-react';
import { ZenScoreHub, EmotionGalaxy } from '@/components/stats';
import { WeeklyInsightsCard } from '@/components/WeeklyInsightsCard';
import { InsightsPanel } from '@/components/InsightsPanel';
import { hapticTap } from '@/lib/haptics';
import type { RingType } from '@/components/stats';
import type { UseStatsPageDataReturn } from './useStatsPageData';

interface OverviewTabProps {
  premiumStats: { moodScore: number; habitRate: number; focusScore: number; weeklyChange: number; weekScore: number };
  stats: { currentStreak: number };
  ringWeeklyData: UseStatsPageDataReturn['ringWeeklyData'];
  emotionGalaxyData: UseStatsPageDataReturn['emotionGalaxyData'];
  todayMoods: MoodEntry[];
  canShowStory: boolean;
  moods: MoodEntry[];
  habits: Habit[];
  completedFocusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  onQuickAction?: (action: 'logMood' | 'startFocus') => void;
  onShowStory: () => void;
  onRingClick: (ringId: RingType) => void;
  t: Record<string, string>;
}

export function OverviewTab({
  premiumStats, stats, ringWeeklyData, emotionGalaxyData, todayMoods, canShowStory,
  moods, habits, completedFocusSessions, gratitudeEntries,
  onQuickAction, onShowStory, onRingClick, t,
}: OverviewTabProps) {
  return (
    <>
      <ZenScoreHub
        moodScore={premiumStats.moodScore}
        habitRate={premiumStats.habitRate}
        focusScore={premiumStats.focusScore}
        streakDays={stats.currentStreak}
        weeklyChange={premiumStats.weeklyChange}
        weeklyData={{
          mood: ringWeeklyData.mood,
          habits: ringWeeklyData.habits,
          focus: ringWeeklyData.focus,
          streak: ringWeeklyData.mood.map((d, i) => ({
            date: d.date,
            value: Math.min(i + 1, stats.currentStreak)
          })),
        }}
        onRingClick={(ringId) => onRingClick(ringId)}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => { void hapticTap(); onQuickAction?.('logMood'); }}
          className="flex flex-col items-center gap-1.5 p-3 bg-secondary/80 hover:bg-secondary rounded-xl transition-colors"
        >
          <Heart className="w-5 h-5 text-pink-500" />
          <span className="text-xs font-medium text-foreground truncate w-full text-center">{t.quickActionLogMood}</span>
        </button>
        <button
          onClick={() => { void hapticTap(); onQuickAction?.('startFocus'); }}
          className="flex flex-col items-center gap-1.5 p-3 bg-secondary/80 hover:bg-secondary rounded-xl transition-colors"
        >
          <Target className="w-5 h-5 text-blue-500" />
          <span className="text-xs font-medium text-foreground truncate w-full text-center">{t.quickActionStartFocus}</span>
        </button>
        {canShowStory && (
          <button
            onClick={() => { void hapticTap(); onShowStory(); }}
            className="flex flex-col items-center gap-1.5 p-3 bg-secondary/80 hover:bg-secondary rounded-xl transition-colors"
          >
            <PlayCircle className="w-5 h-5 text-primary" />
            <span className="text-xs font-medium text-foreground truncate w-full text-center">{t.weeklyStory || 'Weekly Story'}</span>
          </button>
        )}
      </div>

      {/* Weekly Insights */}
      <WeeklyInsightsCard
        moods={moods}
        habits={habits}
        focusSessions={completedFocusSessions}
        gratitudeEntries={gratitudeEntries}
        onRecommendationAction={(_actionId) => {
          void hapticTap();
        }}
      />

      {/* Personal Insights */}
      <InsightsPanel
        moods={moods}
        habits={habits}
        focusSessions={completedFocusSessions}
      />

      {/* Emotion Galaxy - Today's snapshot */}
      {emotionGalaxyData.length > 0 && (
        <EmotionGalaxy
          emotions={emotionGalaxyData}
          totalEntries={todayMoods.length}
          className="mb-4"
        />
      )}
    </>
  );
}
