import { Suspense } from 'react';
import { LazyErrorBoundary } from '@/components/ErrorBoundary';
import { AchievementsPanel } from '@/components/AchievementsPanel';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { SkeletonList } from '@/components/ui/skeleton';

const Leaderboard = lazyWithRetry(() => import('@/components/Leaderboard').then(m => ({ default: m.Leaderboard })), 'Leaderboard');

interface AchievementsTabProps {
  stats: Record<string, number>;
  unlockedAchievements: string[];
}

export function AchievementsTab({ stats, unlockedAchievements }: AchievementsTabProps) {
  return (
    <div className="animate-tab-enter">
      <div className="content-with-nav px-4">
        <LazyErrorBoundary componentName="Achievements">
          <AchievementsPanel
            stats={stats}
            unlockedAchievements={unlockedAchievements}
          />
        </LazyErrorBoundary>
        <LazyErrorBoundary componentName="Leaderboard">
          <Suspense fallback={<SkeletonList count={3} />}>
            <div className="mt-6">
              <Leaderboard />
            </div>
          </Suspense>
        </LazyErrorBoundary>
      </div>
    </div>
  );
}
