/**
 * CompletionBurstLottie — One-shot Lottie burst for goal completion.
 *
 * Lazy-loads goal-complete.json (same pattern as OrbLottie).
 * Plays once and calls onComplete when finished.
 * Absolutely positioned, pointer-events: none.
 *
 * Replace src/assets/animations/goal-complete.json with a premium
 * Lottie from LottieFiles for a different burst effect.
 */

import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';

interface CompletionBurstLottieProps {
  onComplete?: () => void;
}

export function CompletionBurstLottie({ onComplete }: CompletionBurstLottieProps) {
  const [animData, setAnimData] = useState<object | null>(null);

  useEffect(() => {
    import('@/assets/animations/goal-complete.json')
      .then(m => setAnimData(m.default))
      .catch(() => {}); // graceful — falls back to nothing
  }, []);

  if (!animData) return null;

  return (
    <div className="absolute inset-[-24px] pointer-events-none">
      <Lottie
        animationData={animData}
        loop={false}
        autoplay
        onComplete={onComplete}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
