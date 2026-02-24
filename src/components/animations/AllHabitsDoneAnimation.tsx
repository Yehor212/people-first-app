/**
 * AllHabitsDoneAnimation — Celebration for completing all daily habits.
 *
 * TODO: Replace src/assets/animations/all-habits-done.json with a premium Lottie.
 * Requirements: <40KB, 60fps, 1-2s single-shot, no expressions (CSP: no unsafe-eval).
 * Search on LottieFiles.com: "confetti", "celebration", "success stars", "fireworks".
 * Drop the .json file into src/assets/animations/all-habits-done.json.
 *
 * Usage:
 *   <AllHabitsDoneAnimation onComplete={() => setShowCelebration(false)} />
 */

import { LazyLottiePlayer } from '@/components/LazyLottiePlayer';

interface AllHabitsDoneAnimationProps {
  onComplete?: () => void;
}

export function AllHabitsDoneAnimation({ onComplete }: AllHabitsDoneAnimationProps) {
  return (
    <LazyLottiePlayer
      animationImport={() => import('@/assets/animations/all-habits-done.json')}
      width={200}
      height={200}
      loop={false}
      onComplete={onComplete}
      fallback={null}
    />
  );
}
