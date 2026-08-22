import { memo, Suspense } from "react";
import { useShallow } from "zustand/react/shallow";
import { FeatureUnlock } from "@/components/FeatureUnlock";
import { LazyErrorBoundary } from "@/components/ErrorBoundary";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { getModalToggle, useUIStore, useUserDataStore } from "@/stores";

const ChallengeModal = lazyWithRetry(
  () => import("@/components/ChallengeModal").then((m) => ({ default: m.ChallengeModal })),
  "ChallengeModal"
);
const FriendsPanel = lazyWithRetry(
  () => import("@/components/FriendsPanel").then((m) => ({ default: m.FriendsPanel })),
  "FriendsPanel"
);

const setShowChallengeModal = getModalToggle("showChallengeModal");
const setShowFriendsPanel = getModalToggle("showFriendsPanel");

export const V2ProgressionModalLayer = memo(function V2ProgressionModalLayer() {
  const { isFeatureVisible } = useFeatureFlags();
  const {
    featureToUnlock,
    setFeatureToUnlock,
    showChallengeModal,
    showFriendsPanel,
    challengeInvite,
    setChallengeInvite,
    friendInvite,
    setFriendInvite,
    challengeHabit,
    setChallengeHabit,
  } = useUIStore(
    useShallow((s) => ({
      featureToUnlock: s.featureToUnlock,
      setFeatureToUnlock: s.setFeatureToUnlock,
      showChallengeModal: s.showChallengeModal,
      showFriendsPanel: s.showFriendsPanel,
      challengeInvite: s.challengeInvite,
      setChallengeInvite: s.setChallengeInvite,
      friendInvite: s.friendInvite,
      setFriendInvite: s.setFriendInvite,
      challengeHabit: s.challengeHabit,
      setChallengeHabit: s.setChallengeHabit,
    }))
  );
  const userName = useUserDataStore((s) => s.userName);

  const openFriends = () => {
    useUIStore.setState({
      showChallengeModal: false,
      showFriendsPanel: true,
      friendInvite: undefined,
      challengeInvite: undefined,
      challengeHabit: undefined,
    });
  };

  const openChallenges = () => {
    useUIStore.setState({
      showFriendsPanel: false,
      showChallengeModal: true,
      friendInvite: undefined,
    });
  };

  return (
    <>
      {featureToUnlock && (
        <FeatureUnlock feature={featureToUnlock} onClose={() => setFeatureToUnlock(null)} />
      )}

      {!featureToUnlock && !showFriendsPanel && isFeatureVisible("challenges") && (
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
              onOpenFriends={openFriends}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {!featureToUnlock && showFriendsPanel && (
        <LazyErrorBoundary componentName="Friends">
          <Suspense fallback={null}>
            <FriendsPanel
              onClose={() => {
                setShowFriendsPanel(false);
                setFriendInvite(undefined);
              }}
              onOpenChallenges={openChallenges}
              initialFriendCode={friendInvite?.code}
              userName={userName}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}
    </>
  );
});
