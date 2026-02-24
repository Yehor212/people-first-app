/**
 * CompletionBurstLottie — One-shot Lottie burst for goal completion.
 *
 * Uses LazyLottiePlayer to lazy-load goal-complete.json.
 * Plays once and calls onComplete when finished.
 * Absolutely positioned, pointer-events: none.
 *
 * TODO: Replace src/assets/animations/goal-complete.json with a premium confetti burst.
 * Requirements: <50KB, 60fps, ~1s duration, no expressions (CSP: no unsafe-eval).
 * Sources: LottieFiles.com search "confetti", "celebration", "success burst".
 * Drop the .json file into src/assets/animations/ — it is dynamically imported.
 */

import { LazyLottiePlayer } from '@/components/LazyLottiePlayer';

interface CompletionBurstLottieProps {
  onComplete?: () => void;
}

export function CompletionBurstLottie({ onComplete }: CompletionBurstLottieProps) {
  return (
    <div className="absolute inset-[-24px] pointer-events-none">
      <LazyLottiePlayer
        animationImport={() => import('@/assets/animations/goal-complete.json')}
        loop={false}
        onComplete={onComplete}
        width="100%"
        height="100%"
        fallback={null}
      />
    </div>
  );
}
