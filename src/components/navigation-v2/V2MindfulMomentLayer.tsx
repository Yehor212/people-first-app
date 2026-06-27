import { memo, Suspense } from "react";
import { getModalToggle, useUIStore } from "@/stores";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { LazyErrorBoundary } from "@/components/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

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
  const { isFeatureVisible } = useFeatureFlags();
  const showMindfulMoment = useUIStore((s) => s.showMindfulMoment);
  const setShowMindfulMoment = getModalToggle("showMindfulMoment");

  if (!isFeatureVisible("focusTimer")) {
    return null;
  }

  return (
    <LazyErrorBoundary componentName="Mindful Moment">
      <Suspense fallback={null}>
        <MindfulMoment
          isOpen={showMindfulMoment}
          onClose={() => setShowMindfulMoment(false)}
          onComplete={onComplete ?? (() => setShowMindfulMoment(false))}
          trigger="focus"
        />
      </Suspense>
    </LazyErrorBoundary>
  );
});
