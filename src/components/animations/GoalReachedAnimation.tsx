/**
 * GoalReachedAnimation — Success burst for goal completion.
 *
 * Reuses the existing goal-complete.json. When a premium version is available,
 * replace src/assets/animations/goal-complete.json (see CompletionBurstLottie TODO).
 *
 * Usage:
 *   <GoalReachedAnimation onComplete={() => setShowCelebration(false)} />
 */

import { LazyLottiePlayer } from '@/components/LazyLottiePlayer';

interface GoalReachedAnimationProps {
  onComplete?: () => void;
}

export function GoalReachedAnimation({ onComplete }: GoalReachedAnimationProps) {
  return (
    <LazyLottiePlayer
      animationImport={() => import('@/assets/animations/goal-complete.json')}
      width={200}
      height={200}
      loop={false}
      onComplete={onComplete}
      fallback={null}
    />
  );
}
