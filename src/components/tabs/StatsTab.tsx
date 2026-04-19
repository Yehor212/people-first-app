import { Suspense } from "react";
import { LazyErrorBoundary } from "@/components/ErrorBoundary";
import { Header } from "@/components/Header";
import { PullToRefresh } from "@/components/PullToRefresh";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { SkeletonStats } from "@/components/ui/skeleton";
import { useUserDataStore } from "@/stores";

const StatsPage = lazyWithRetry(
  () => import("@/components/StatsPage").then((m) => ({ default: m.StatsPage })),
  "StatsPage"
);

interface StatsTabProps {
  restDays: string[];
  currentFocusMinutes: number | undefined;
  onQuickAction: (action: string) => void;
  handlePullToRefresh: () => Promise<void>;
}

export function StatsTab({
  restDays,
  currentFocusMinutes,
  onQuickAction,
  handlePullToRefresh,
}: StatsTabProps) {
  const moods = useUserDataStore((s) => s.moods);
  const habits = useUserDataStore((s) => s.habits);
  const focusSessions = useUserDataStore((s) => s.focusSessions);
  const gratitudeEntries = useUserDataStore((s) => s.gratitudeEntries);
  const userName = useUserDataStore((s) => s.userName);

  return (
    <div className="motion-safe:animate-tab-enter">
      <Header userName={userName} />
      <PullToRefresh onRefresh={handlePullToRefresh}>
        <LazyErrorBoundary componentName="Stats">
          <Suspense fallback={<SkeletonStats count={4} className="px-4 pt-8" />}>
            <StatsPage
              moods={moods}
              habits={habits}
              focusSessions={focusSessions}
              gratitudeEntries={gratitudeEntries}
              restDays={restDays}
              currentFocusMinutes={currentFocusMinutes}
              onQuickAction={onQuickAction}
            />
          </Suspense>
        </LazyErrorBoundary>
      </PullToRefresh>
    </div>
  );
}
