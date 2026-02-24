import { Dispatch, SetStateAction, Suspense, useMemo } from 'react';
import { useUIStore, useUserDataStore, useAppStore, getModalToggle } from '@/stores';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { LazyErrorBoundary } from '@/components/ErrorBoundary';
import { WeeklyReport } from '@/components/WeeklyReport';
import { TimeHelper } from '@/components/TimeHelper';
import { ChallengeModal } from '@/components/ChallengeModal';
import { WhatsNewModal } from '@/components/WhatsNewModal';
import { MindfulMoment } from '@/components/MindfulMoment';
import { SkeletonList, SkeletonSection } from '@/components/ui/skeleton';
import { PremiumLoader } from '@/components/PremiumLoader';
import { getChallenges, getBadges, addChallenge } from '@/lib/challengeStorage';
import { triggerSync } from '@/storage/cloudSync';
import type { Challenge, Badge } from '@/types';

// Lazy-loaded modal/panel components with retry logic
const ChallengesPanel = lazyWithRetry(() => import('@/components/ChallengesPanel').then(m => ({ default: m.ChallengesPanel })), 'ChallengesPanel');
const TasksPanel = lazyWithRetry(() => import('@/components/TasksPanel').then(m => ({ default: m.TasksPanel })), 'TasksPanel');
const QuestsPanel = lazyWithRetry(() => import('@/components/QuestsPanel').then(m => ({ default: m.QuestsPanel })), 'QuestsPanel');
const WidgetSettings = lazyWithRetry(() => import('@/pages/WidgetSettings').then(m => ({ default: m.WidgetSettings })), 'WidgetSettings');
const FriendsPanel = lazyWithRetry(() => import('@/components/FriendsPanel').then(m => ({ default: m.FriendsPanel })), 'FriendsPanel');

interface ModalLayerProps {
  // Challenge data (local state in Index.tsx)
  challenges: Challenge[];
  setChallenges: Dispatch<SetStateAction<Challenge[]>>;
  setBadges: Dispatch<SetStateAction<Badge[]>>;
  // Gamification hooks (from useGamification/useInnerWorld - can't be called again)
  awardXp: (activity: string) => void;
  earnTreats: (source: string, amount: number, reason?: string) => { earned: number };
  // Handler from hook
  handleMindfulMomentComplete: () => void;
  // Data from hooks that can't be called again in this component
  currentStreak: number;
  userLevel: number;
}

export function ModalLayer({
  challenges,
  setChallenges,
  setBadges,
  awardXp,
  earnTreats,
  handleMindfulMomentComplete,
  currentStreak,
  userLevel,
}: ModalLayerProps) {
  const { isFeatureVisible } = useFeatureFlags();

  // UI modal/panel state from Zustand
  const showWeeklyReport = useUIStore(s => s.showWeeklyReport);
  const showWidgetSettings = useUIStore(s => s.showWidgetSettings);
  const showChallenges = useUIStore(s => s.showChallenges);
  const showChallengeModal = useUIStore(s => s.showChallengeModal);
  const challengeInvite = useUIStore(s => s.challengeInvite);
  const setChallengeInvite = useUIStore(s => s.setChallengeInvite);
  const challengeHabit = useUIStore(s => s.challengeHabit);
  const setChallengeHabit = useUIStore(s => s.setChallengeHabit);
  const showTimeHelper = useUIStore(s => s.showTimeHelper);
  const showTasksPanel = useUIStore(s => s.showTasksPanel);
  const showQuestsPanel = useUIStore(s => s.showQuestsPanel);
  const showFriendsPanel = useUIStore(s => s.showFriendsPanel);
  const showMindfulMoment = useUIStore(s => s.showMindfulMoment);

  // Modal toggle functions (stable references via getModalToggle utility)
  const setShowWeeklyReport = getModalToggle('showWeeklyReport');
  const setShowWidgetSettings = getModalToggle('showWidgetSettings');
  const setShowChallenges = getModalToggle('showChallenges');
  const setShowChallengeModal = getModalToggle('showChallengeModal');
  const setShowTimeHelper = getModalToggle('showTimeHelper');
  const setShowTasksPanel = getModalToggle('showTasksPanel');
  const setShowQuestsPanel = getModalToggle('showQuestsPanel');
  const setShowFriendsPanel = getModalToggle('showFriendsPanel');
  const setShowMindfulMoment = getModalToggle('showMindfulMoment');

  // User data from store
  const userName = useUserDataStore(s => s.userName);
  const moods = useUserDataStore(s => s.moods);
  const habits = useUserDataStore(s => s.habits);
  const focusSessions = useUserDataStore(s => s.focusSessions);
  const gratitudeEntries = useUserDataStore(s => s.gratitudeEntries);

  // Navigation (for MindfulMoment onViewProgress)
  const setActiveTab = useAppStore(s => s.setActiveTab);

  // Defensive array guards
  const safeMoods = useMemo(() => Array.isArray(moods) ? moods : [], [moods]);
  const safeHabits = useMemo(() => Array.isArray(habits) ? habits : [], [habits]);
  const safeFocusSessions = useMemo(() => Array.isArray(focusSessions) ? focusSessions : [], [focusSessions]);
  const safeGratitudeEntries = useMemo(() => Array.isArray(gratitudeEntries) ? gratitudeEntries : [], [gratitudeEntries]);

  return (
    <>
      {/* Weekly Report Modal */}
      {showWeeklyReport && (
        <WeeklyReport
          moods={safeMoods}
          habits={safeHabits}
          focusSessions={safeFocusSessions}
          gratitudeEntries={safeGratitudeEntries}
          onClose={() => setShowWeeklyReport(false)}
        />
      )}

      {/* Widget Settings Modal */}
      {showWidgetSettings && (
        <LazyErrorBoundary componentName="Widget Settings">
          <Suspense fallback={<div className="fixed inset-0 z-50 bg-background flex items-center justify-center"><PremiumLoader size="lg" /></div>}>
            <div className="fixed inset-0 z-50 bg-background">
              <WidgetSettings onBack={() => setShowWidgetSettings(false)} />
            </div>
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Challenges Panel Modal (Progressive: Day 4) */}
      {showChallenges && isFeatureVisible('challenges') && (
        <LazyErrorBoundary componentName="Challenges">
          <Suspense fallback={<SkeletonSection />}>
            <ChallengesPanel
              activeChallenges={challenges}
              badges={getBadges()}
              onStartChallenge={(challenge) => {
                addChallenge(challenge);
                setChallenges(getChallenges());
                setBadges(getBadges());
              }}
              onClose={() => setShowChallenges(false)}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Time Helper Modal */}
      {isFeatureVisible('focusTimer') && showTimeHelper && (
        <TimeHelper onClose={() => setShowTimeHelper(false)} />
      )}

      {/* Tasks Panel Modal (Progressive: Day 4) */}
      {showTasksPanel && isFeatureVisible('tasks') && (
        <LazyErrorBoundary componentName="Tasks">
          <Suspense fallback={<SkeletonList />}>
            <TasksPanel
              onClose={() => setShowTasksPanel(false)}
              onAwardXp={(_source, amount) => {
                // Award XP through gamification (using habit as proxy for task)
                for (let i = 0; i < Math.ceil(amount / 15); i++) {
                  awardXp('habit');
                }
              }}
              onEarnTreats={(_source, amount, reason) => {
                // Use 'habit' as treat source since 'task' is not a valid TreatSource
                earnTreats('habit', amount, reason);
                triggerSync(); // Sync inner world treats
              }}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Quests Panel Modal (Progressive: Day 3) */}
      {showQuestsPanel && isFeatureVisible('quests') && (
        <LazyErrorBoundary componentName="Quests">
          <Suspense fallback={<SkeletonList />}>
            <QuestsPanel
              onClose={() => setShowQuestsPanel(false)}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Friends Panel */}
      {showFriendsPanel && (
        <LazyErrorBoundary componentName="Friends">
          <Suspense fallback={<SkeletonList />}>
            <FriendsPanel
              onClose={() => setShowFriendsPanel(false)}
              userName={userName}
              currentStreak={currentStreak}
              level={userLevel}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Challenge Modal - for deep link invites and habit challenges */}
      {isFeatureVisible('challenges') && (
        <ChallengeModal
          open={showChallengeModal}
          onOpenChange={(open) => {
            setShowChallengeModal(open);
            if (!open) {
              setChallengeInvite(undefined);
              setChallengeHabit(undefined);
            }
          }}
          habit={challengeHabit}
          initialInvite={challengeInvite}
          username={userName}
        />
      )}

      {/* What's New Modal - shows after app update */}
      <WhatsNewModal />

      {/* MindfulMoment - shows after focus session completion */}
      {isFeatureVisible('focusTimer') && (
        <MindfulMoment
          isOpen={showMindfulMoment}
          onClose={() => setShowMindfulMoment(false)}
          onComplete={handleMindfulMomentComplete}
          onViewProgress={() => setActiveTab('stats')}
          trigger="focus"
        />
      )}
    </>
  );
}
