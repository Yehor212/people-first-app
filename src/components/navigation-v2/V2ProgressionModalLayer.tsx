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

const setShowChallengeModal = getModalToggle("showChallengeModal");

export const V2ProgressionModalLayer = memo(function V2ProgressionModalLayer() {
  const { isFeatureVisible } = useFeatureFlags();
  const {
    featureToUnlock,
    setFeatureToUnlock,
    showChallengeModal,
    challengeInvite,
    setChallengeInvite,
    challengeHabit,
    setChallengeHabit,
  } = useUIStore(
    useShallow((s) => ({
      featureToUnlock: s.featureToUnlock,
      setFeatureToUnlock: s.setFeatureToUnlock,
      showChallengeModal: s.showChallengeModal,
      challengeInvite: s.challengeInvite,
      setChallengeInvite: s.setChallengeInvite,
      challengeHabit: s.challengeHabit,
      setChallengeHabit: s.setChallengeHabit,
    }))
  );
  const userName = useUserDataStore((s) => s.userName);

  return (
    <>
      {featureToUnlock && (
        <FeatureUnlock feature={featureToUnlock} onClose={() => setFeatureToUnlock(null)} />
      )}

      {!featureToUnlock && isFeatureVisible("challenges") && (
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
    </>
  );
});
