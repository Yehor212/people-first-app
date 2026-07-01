import { Dispatch, SetStateAction, Suspense, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUIStore, useUserDataStore, useAppStore, getModalToggle } from "@/stores";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { LazyErrorBoundary } from "@/components/ErrorBoundary";
// Lazy-loaded static modals — keeps these out of the main bundle
const WeeklyReport = lazyWithRetry(
  () => import("@/components/WeeklyReport").then((m) => ({ default: m.WeeklyReport })),
  "WeeklyReport"
);
const TimeHelper = lazyWithRetry(
  () => import("@/components/TimeHelper").then((m) => ({ default: m.TimeHelper })),
  "TimeHelper"
);
const ChallengeModal = lazyWithRetry(
  () => import("@/components/ChallengeModal").then((m) => ({ default: m.ChallengeModal })),
  "ChallengeModal"
);
const MindfulMoment = lazyWithRetry(
  () => import("@/components/MindfulMoment").then((m) => ({ default: m.MindfulMoment })),
  "MindfulMoment"
);
import { SkeletonList, SkeletonSection } from "@/components/ui/skeleton";
import { PremiumLoader } from "@/components/PremiumLoader";
import { getChallenges, getBadges, addChallenge } from "@/lib/challengeStorage";
import { getToday } from "@/lib/utils";
import type { Challenge, Badge, TreatSource } from "@/types";
import type { XpAction } from "@/lib/gamification";

// Lazy-loaded modal/panel components with retry logic
const ChallengesPanel = lazyWithRetry(
  () => import("@/components/ChallengesPanel").then((m) => ({ default: m.ChallengesPanel })),
  "ChallengesPanel"
);
const AddEventModal = lazyWithRetry(
  () => import("@/components/schedule/AddEventModal").then((m) => ({ default: m.AddEventModal })),
  "AddEventModal"
);
const QuestsPanel = lazyWithRetry(
  () => import("@/components/QuestsPanel").then((m) => ({ default: m.QuestsPanel })),
  "QuestsPanel"
);
const WidgetSettings = lazyWithRetry(
  () => import("@/pages/WidgetSettings").then((m) => ({ default: m.WidgetSettings })),
  "WidgetSettings"
);
const FriendsPanel = lazyWithRetry(
  () => import("@/components/FriendsPanel").then((m) => ({ default: m.FriendsPanel })),
  "FriendsPanel"
);

interface ModalLayerProps {
  // Challenge data (local state in Index.tsx)
  challenges: Challenge[];
  setChallenges: Dispatch<SetStateAction<Challenge[]>>;
  setBadges: Dispatch<SetStateAction<Badge[]>>;
  // Gamification hooks (from useGamification/useInnerWorld - can't be called again)
  awardXp: (action: XpAction) => void;
  earnTreats: (
    source: TreatSource,
    baseAmount: number,
    description?: string
  ) => { earned: number; bonus: number; multiplier: number; newBalance: number };
  // Handler from hook
  handleMindfulMomentComplete: () => void;
  // Schedule event handler shared by schedule entry points
  handleAddScheduleEvent: (event: Omit<import("@/types").ScheduleEvent, "id">) => void;
  // Data from hooks that can't be called again in this component
  currentStreak: number;
  userLevel: number;
}

export function ModalLayer({
  challenges,
  setChallenges,
  setBadges,
  awardXp: _awardXp,
  earnTreats: _earnTreats,
  handleMindfulMomentComplete,
  handleAddScheduleEvent,
  currentStreak,
  userLevel,
}: ModalLayerProps) {
  const { isFeatureVisible } = useFeatureFlags();

  // UI modal/panel state — single subscription (was 13 individual)
  const {
    showWeeklyReport, showWidgetSettings, showChallenges, showChallengeModal,
    challengeInvite, setChallengeInvite, challengeHabit, setChallengeHabit,
    showTimeHelper, showAddEvent, showQuestsPanel, showFriendsPanel, showMindfulMoment,
  } = useUIStore(useShallow((s) => ({
    showWeeklyReport: s.showWeeklyReport,
    showWidgetSettings: s.showWidgetSettings,
    showChallenges: s.showChallenges,
    showChallengeModal: s.showChallengeModal,
    challengeInvite: s.challengeInvite,
    setChallengeInvite: s.setChallengeInvite,
    challengeHabit: s.challengeHabit,
    setChallengeHabit: s.setChallengeHabit,
    showTimeHelper: s.showTimeHelper,
    showAddEvent: s.showAddEvent,
    showQuestsPanel: s.showQuestsPanel,
    showFriendsPanel: s.showFriendsPanel,
    showMindfulMoment: s.showMindfulMoment,
  })));

  // Modal toggle functions (stable references via getModalToggle utility)
  const setShowWeeklyReport = getModalToggle("showWeeklyReport");
  const setShowWidgetSettings = getModalToggle("showWidgetSettings");
  const setShowChallenges = getModalToggle("showChallenges");
  const setShowChallengeModal = getModalToggle("showChallengeModal");
  const setShowTimeHelper = getModalToggle("showTimeHelper");
  const setShowAddEvent = getModalToggle("showAddEvent");
  const setShowQuestsPanel = getModalToggle("showQuestsPanel");
  const setShowFriendsPanel = getModalToggle("showFriendsPanel");
  const setShowMindfulMoment = getModalToggle("showMindfulMoment");

  // User data — single subscription (was 5 individual)
  const {
    userName, moods, habits, focusSessions, gratitudeEntries,
  } = useUserDataStore(useShallow((s) => ({
    userName: s.userName,
    moods: s.moods,
    habits: s.habits,
    focusSessions: s.focusSessions,
    gratitudeEntries: s.gratitudeEntries,
  })));

  // Navigation (for MindfulMoment onViewProgress)
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  // Defensive array guards
  const safeMoods = useMemo(() => (Array.isArray(moods) ? moods : []), [moods]);
  const safeHabits = useMemo(() => (Array.isArray(habits) ? habits : []), [habits]);
  const safeFocusSessions = useMemo(
    () => (Array.isArray(focusSessions) ? focusSessions : []),
    [focusSessions]
  );
  const safeGratitudeEntries = useMemo(
    () => (Array.isArray(gratitudeEntries) ? gratitudeEntries : []),
    [gratitudeEntries]
  );

  // NOTE: useBackHandler calls removed — WeeklyReport, TimeHelper, ChallengeModal,
  // and MindfulMoment each have their own internal useBackHandler / useModalA11y.

  return (
    <>
      {/* Weekly Report Modal */}
      {showWeeklyReport && (
        <LazyErrorBoundary componentName="Weekly Report">
          <Suspense fallback={<SkeletonSection />}>
            <WeeklyReport
              moods={safeMoods}
              habits={safeHabits}
              focusSessions={safeFocusSessions}
              gratitudeEntries={safeGratitudeEntries}
              onClose={() => setShowWeeklyReport(false)}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Widget Settings Modal */}
      {showWidgetSettings && (
        <LazyErrorBoundary componentName="Widget Settings">
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[70] bg-background flex items-center justify-center">
                <PremiumLoader size="lg" />
              </div>
            }
          >
            <div className="fixed inset-0 z-[70] bg-background">
              <WidgetSettings onBack={() => setShowWidgetSettings(false)} />
            </div>
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Challenges Panel Modal (Progressive: Day 4) */}
      {showChallenges && isFeatureVisible("challenges") && (
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
      {isFeatureVisible("focusTimer") && showTimeHelper && (
        <LazyErrorBoundary componentName="Time Helper">
          <Suspense fallback={<SkeletonSection />}>
            <TimeHelper onClose={() => setShowTimeHelper(false)} />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Add Event Modal */}
      {showAddEvent && (
        <LazyErrorBoundary componentName="AddEvent">
          <Suspense fallback={<SkeletonSection />}>
            <AddEventModal
              selectedDate={getToday()}
              allDates={[getToday()]}
              onClose={() => setShowAddEvent(false)}
              onAdd={(event) => {
                handleAddScheduleEvent(event);
                setShowAddEvent(false);
              }}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* Quests Panel Modal (Progressive: Day 3) */}
      {showQuestsPanel && isFeatureVisible("quests") && (
        <LazyErrorBoundary componentName="Quests">
          <Suspense fallback={<SkeletonList />}>
            <QuestsPanel onClose={() => setShowQuestsPanel(false)} />
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
      {isFeatureVisible("challenges") && (
        <LazyErrorBoundary componentName="Challenge">
          <Suspense fallback={null}>
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
          </Suspense>
        </LazyErrorBoundary>
      )}

      {/* MindfulMoment - shows after focus session completion */}
      {isFeatureVisible("focusTimer") && (
        <LazyErrorBoundary componentName="Mindful Moment">
          <Suspense fallback={null}>
            <MindfulMoment
              isOpen={showMindfulMoment}
              onClose={() => setShowMindfulMoment(false)}
              onComplete={handleMindfulMomentComplete}
              onViewProgress={() => setActiveTab("stats")}
              trigger="focus"
            />
          </Suspense>
        </LazyErrorBoundary>
      )}
    </>
  );
}
