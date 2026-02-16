import { Suspense } from 'react';
import { LazyErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from '@/components/Header';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { SkeletonStats } from '@/components/ui/skeleton';
import { useUserDataStore } from '@/stores';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';

const StatsPage = lazyWithRetry(() => import('@/components/StatsPage').then(m => ({ default: m.StatsPage })), 'StatsPage');

interface StatsTabProps {
  safeMoods: MoodEntry[];
  safeHabits: Habit[];
  safeFocusSessions: FocusSession[];
  safeGratitudeEntries: GratitudeEntry[];
  restDays: string[];
  currentFocusMinutes: number | undefined;
  onQuickAction: (action: string) => void;
}

export function StatsTab({
  safeMoods, safeHabits, safeFocusSessions, safeGratitudeEntries,
  restDays, currentFocusMinutes, onQuickAction,
}: StatsTabProps) {
  const userName = useUserDataStore(s => s.userName);

  return (
    <div className="animate-tab-enter">
      <Header userName={userName} />
      <LazyErrorBoundary componentName="Stats">
        <Suspense fallback={<SkeletonStats count={4} className="px-4 pt-8" />}>
          <StatsPage
            moods={safeMoods}
            habits={safeHabits}
            focusSessions={safeFocusSessions}
            gratitudeEntries={safeGratitudeEntries}
            restDays={restDays}
            currentFocusMinutes={currentFocusMinutes}
            onQuickAction={onQuickAction}
          />
        </Suspense>
      </LazyErrorBoundary>
    </div>
  );
}
