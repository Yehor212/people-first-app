import { memo, Suspense } from "react";
import { getModalToggle, useUIStore } from "@/stores";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { LazyErrorBoundary } from "@/components/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { FeatureAvailabilityDialog } from "@/components/FeatureAvailabilityDialog";

const MindfulMoment = lazyWithRetry(
  () => import("@/components/MindfulMoment").then((m) => ({ default: m.MindfulMoment })),
  "MindfulMoment",
);

interface V2MindfulMomentLayerProps {
  onComplete?: () => void;
}

export const V2MindfulMomentLayer = memo(function V2MindfulMomentLayer({
  onComplete,
}: V2MindfulMomentLayerProps) {
  const { getFeatureAvailability } = useFeatureFlags();
  const showMindfulMoment = useUIStore((s) => s.showMindfulMoment);
  const setShowMindfulMoment = getModalToggle("showMindfulMoment");

  const focusAvailability = getFeatureAvailability("focusTimer");

  if (!focusAvailability.visible) {
    return showMindfulMoment ? (
      <FeatureAvailabilityDialog
        availability={focusAvailability}
        onClose={() => setShowMindfulMoment(false)}
      />
    ) : null;
  }

  return (
    <LazyErrorBoundary componentName="Mindful Moment">
      <Suspense fallback={null}>
        <MindfulMoment
          isOpen={showMindfulMoment}
          onClose={() => setShowMindfulMoment(false)}
          onComplete={onComplete ?? (() => setShowMindfulMoment(false))}
          trigger="focus"
          rewardsEnabled={false}
        />
      </Suspense>
    </LazyErrorBoundary>
  );
});
