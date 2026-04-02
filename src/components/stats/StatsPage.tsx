/**
 * StatsPage — orchestrator for statistics view
 * Decomposed from the original 1,281-line monolith (TD-20).
 * This file: ~200L, 5 useState, delegates data to useStatsPageData hook.
 */

import { useState, useRef, useCallback, useMemo, memo, Suspense } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { getToday } from '@/lib/utils';
import { useStatsCalculations } from '@/hooks/useStatsCalculations';
import { PlayCircle, BarChart2 } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useLanguage } from '@/contexts/LanguageContext';
import { UnifiedShareModal } from '@/components/share';
import { EmptyState } from '@/components/EmptyState';
import { hapticTap } from '@/lib/haptics';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { RingDetailSheet } from '@/components/stats/RingDetailSheet';
import type { RingType } from '@/components/stats/RingDetailSheet';

import { useStatsPageData } from './useStatsPageData';
import { OverviewTab } from './OverviewTab';
import { TrendsTab } from './TrendsTab';
import { CalendarTab } from './CalendarTab';

// Lazy-load ProgressStoriesViewer to isolate DOMPurify CJS into its own chunk
import { lazyWithRetry } from '@/lib/lazyWithRetry';
const ProgressStoriesViewer = lazyWithRetry(
  () => import('@/components/ProgressStoriesViewer').then(m => ({ default: m.ProgressStoriesViewer })),
  'ProgressStoriesViewer'
);

interface StatsPageProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  restDays?: string[];
  currentFocusMinutes?: number;
  onQuickAction?: (action: 'logMood' | 'startFocus') => void;
}

export const StatsPage = memo(function StatsPage({
  moods, habits, focusSessions, gratitudeEntries,
  restDays = [], currentFocusMinutes, onQuickAction,
}: StatsPageProps) {
  const { t, language } = useLanguage();
  const todayKey = getToday();

  // --- State ---
  const [statsTab, setStatsTab] = useState<'overview' | 'trends' | 'calendar'>('calendar');
  const [range, setRange] = useState<'week' | 'month' | 'all'>('month');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [activeModal, setActiveModal] = useState<'share' | 'story' | null>(null);
  const [selectedRing, setSelectedRing] = useState<RingType | null>(null);
  const statsContainerRef = useRef<HTMLDivElement>(null);

  useBackHandler(activeModal === 'story', () => setActiveModal(null));
  useScrollLock(activeModal === 'story' || selectedRing !== null);

  const monthNames = [
    t.january, t.february, t.march, t.april, t.may, t.june,
    t.july, t.august, t.september, t.october, t.november, t.december
  ];

  // --- Hooks ---
  const {
    completedFocusSessions,
    filteredMoods,
    stats,
    premiumStats,
    moodInsights,
  } = useStatsCalculations({
    moods, habits, focusSessions, gratitudeEntries,
    restDays, currentFocusMinutes, range, selectedTag, monthNames,
  });

  const pageData = useStatsPageData({
    moods, habits, focusSessions, gratitudeEntries,
    completedFocusSessions, stats, t: t as unknown as Record<string, string>, language,
  });

  const handleStatsTabChange = useCallback((tab: 'overview' | 'trends' | 'calendar') => {
    setStatsTab(tab);
    statsContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Memoize ring detail values to avoid inline .reduce() in JSX
  const ringCurrentValue = useMemo(() => {
    if (!selectedRing) return 0;
    const data = selectedRing === 'mood' ? pageData.ringWeeklyData.mood :
      selectedRing === 'habits' ? pageData.ringWeeklyData.habits :
      selectedRing === 'focus' ? pageData.ringWeeklyData.focus : [];
    return Math.round(data.reduce((a, b) => a + b.value, 0) / 7);
  }, [selectedRing, pageData.ringWeeklyData]);

  const ringWeeklyData = useMemo(() => {
    if (!selectedRing) return [];
    return selectedRing === 'mood' ? pageData.ringWeeklyData.mood :
      selectedRing === 'habits' ? pageData.ringWeeklyData.habits :
      selectedRing === 'focus' ? pageData.ringWeeklyData.focus : [];
  }, [selectedRing, pageData.ringWeeklyData]);

  const ringPreviousAverage = useMemo(() => {
    if (!selectedRing) return 0;
    return selectedRing === 'mood' ? pageData.ringWeeklyData.prevMoodAvg :
      selectedRing === 'habits' ? pageData.ringWeeklyData.prevHabitsAvg :
      selectedRing === 'focus' ? pageData.ringWeeklyData.prevFocusAvg : 0;
  }, [selectedRing, pageData.ringWeeklyData]);

  // --- JSX ---
  return (
    <div className="space-y-4 animate-fade-in content-with-nav px-4" ref={statsContainerRef}>
      {/* Header with Weekly Story button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">{t.statistics}</h2>
        {pageData.canShowStory && (
          <button
            onClick={() => {
              void hapticTap();
              setActiveModal('story');
            }}
            aria-label={t.weeklyStory || 'Weekly Story'}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary to-accent text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all zen-shadow-soft"
          >
            <PlayCircle className="w-4 h-4" />
            {t.weeklyStory || 'Weekly Story'}
          </button>
        )}
      </div>

      {/* Empty state when no data exists */}
      {moods.length === 0 && habits.length === 0 && focusSessions.length === 0 && (
        <EmptyState
          icon={<BarChart2 className="w-6 h-6 text-primary" />}
          title={t.statistics || 'Statistics'}
          message={t.moodNoData || 'Start tracking to see your statistics.'}
          hint={t.moodNoData || 'Log your mood, complete habits, or start a focus session to see data here.'}
        />
      )}

      {/* Stats Inner Tabs */}
      <SegmentedControl
        options={[
          { value: 'overview' as const, label: t.statsOverview },
          { value: 'trends' as const, label: t.statsTrends },
          { value: 'calendar' as const, label: t.statsCalendar },
        ]}
        value={statsTab}
        onChange={handleStatsTabChange}
        fullWidth
        aria-label={t.statistics}
      />

      {/* Tab Content */}
      {statsTab === 'overview' && (
        <OverviewTab
          premiumStats={premiumStats}
          stats={stats}
          ringWeeklyData={pageData.ringWeeklyData}
          emotionGalaxyData={pageData.emotionGalaxyData}
          todayMoods={pageData.todayMoods}
          canShowStory={pageData.canShowStory}
          moods={moods}
          habits={habits}
          completedFocusSessions={completedFocusSessions}
          gratitudeEntries={gratitudeEntries}
          restDays={restDays}
          moodInsights={moodInsights}
          onQuickAction={onQuickAction}
          onShowStory={() => setActiveModal('story')}
          onRingClick={(ringId) => setSelectedRing(ringId)}
          t={t as unknown as Record<string, string>}
        />
      )}

      {statsTab === 'trends' && (
        <TrendsTab
          stats={stats}
          premiumStats={premiumStats}
          filteredMoods={filteredMoods}
          ringWeeklyData={pageData.ringWeeklyData}
          currentWeatherInput={pageData.currentWeatherInput}
          range={range}
          onRangeChange={setRange}
          allTags={pageData.allTags}
          selectedTag={selectedTag}
          onTagChange={setSelectedTag}
          t={t as unknown as Record<string, string>}
          language={language}
        />
      )}

      {statsTab === 'calendar' && (
        <CalendarTab
          moodsByDate={pageData.moodsByDate}
          moodByDate={pageData.moodByDate}
          focusMinutesByDate={pageData.focusMinutesByDate}
          gratitudeByDate={pageData.gratitudeByDate}
          habitCompletionMap={pageData.habitCompletionMap}
          habits={habits}
          emotionLabels={pageData.emotionLabels}
          todayKey={todayKey}
          monthNames={monthNames}
          t={t as unknown as Record<string, string>}
          language={language}
        />
      )}

      {/* Share Progress Dialog */}
      <UnifiedShareModal
        open={activeModal === 'share'}
        onOpenChange={(open) => !open && setActiveModal(null)}
        mode="progress"
        data={{
          type: 'progress',
          title: t.myProgress || 'My Progress',
          stats: [
            { label: t.currentStreak || 'Streak', value: stats.currentStreak },
            { label: t.habitsCompleted || 'Habits', value: habits.filter(h => h.entries?.[todayKey]?.value === 2).length },
            { label: t.focusMinutes || 'Focus', value: stats.totalFocusMinutes },
          ],
        }}
      />

      {/* Weekly Progress Stories Viewer */}
      {activeModal === 'story' && pageData.storySlides.length > 0 && (
        <Suspense fallback={null}>
          <ProgressStoriesViewer
            slides={pageData.storySlides}
            onClose={() => setActiveModal(null)}
            weekRange={pageData.weekRange}
            streak={stats.currentStreak}
          />
        </Suspense>
      )}

      {/* Ring Detail Sheet */}
      <RingDetailSheet
        open={selectedRing !== null}
        onOpenChange={(open) => !open && setSelectedRing(null)}
        ringType={selectedRing}
        currentValue={ringCurrentValue}
        weeklyData={ringWeeklyData}
        previousAverage={ringPreviousAverage}
        onAction={() => {
          const ring = selectedRing;
          setSelectedRing(null);
          if (ring === 'mood') onQuickAction?.('logMood');
          else if (ring === 'focus') onQuickAction?.('startFocus');
          // habits ring: no quick action (user navigates to habits tab separately)
        }}
      />
    </div>
  );
});
