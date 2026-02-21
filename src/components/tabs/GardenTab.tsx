import { Suspense } from 'react';
import { LazyErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from '@/components/Header';
import { SkeletonCard } from '@/components/ui/skeleton';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { useUserDataStore, getModalToggle } from '@/stores';

const JournalModule = lazyWithRetry(() => import('@/features/journal').then(m => ({ default: m.JournalModule })), 'JournalModule');

const setShowChallenges = getModalToggle('showChallenges');
const setShowTasksPanel = getModalToggle('showTasksPanel');
const setShowQuestsPanel = getModalToggle('showQuestsPanel');
const setShowFriendsPanel = getModalToggle('showFriendsPanel');

export function GardenTab() {
  const { isFeatureVisible } = useFeatureFlags();
  const userName = useUserDataStore(s => s.userName);

  return (
    <div className="animate-tab-enter">
      <div className="space-y-4">
        <Header
          userName={userName}
          onOpenChallenges={isFeatureVisible('challenges') ? () => setShowChallenges(true) : undefined}
          onOpenTasks={isFeatureVisible('tasks') ? () => setShowTasksPanel(true) : undefined}
          onOpenQuests={isFeatureVisible('quests') ? () => setShowQuestsPanel(true) : undefined}
          onOpenFriends={() => setShowFriendsPanel(true)}
        />

        {/* Diary — self-contained JournalModule */}
        <div id="journal-section" className="min-h-[160px]">
          <LazyErrorBoundary componentName="Journal">
            <Suspense fallback={<SkeletonCard />}>
              <JournalModule />
            </Suspense>
          </LazyErrorBoundary>
        </div>
      </div>
    </div>
  );
}
