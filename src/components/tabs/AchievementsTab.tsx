import { Suspense } from "react";
import { LazyErrorBoundary } from "@/components/ErrorBoundary";
import { PullToRefresh } from "@/components/PullToRefresh";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { SkeletonList } from "@/components/ui/skeleton";
import type { UserStats, AchievementId } from "@/lib/gamification";

const Leaderboard = lazyWithRetry(
  () =>
    import("@/components/Leaderboard").then((m) => ({
      default: m.Leaderboard,
    })),
  "Leaderboard",
);

interface AchievementsTabProps {
  stats: UserStats;
  unlockedAchievements: AchievementId[];
  handlePullToRefresh: () => Promise<void>;
}

export function AchievementsTab({
  stats,
  unlockedAchievements,
  handlePullToRefresh,
}: AchievementsTabProps) {
  return (
    <div className="motion-safe:animate-tab-enter">
      <PullToRefresh onRefresh={handlePullToRefresh}>
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
      </PullToRefresh>
    </div>
  );
}
