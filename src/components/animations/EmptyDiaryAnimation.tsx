/**
 * EmptyDiaryAnimation — Animated illustration for empty diary/journal state.
 *
 * TODO: Replace src/assets/animations/empty-diary.json with a premium Lottie.
 * Requirements: <40KB, 60fps, 2-3s loop, no expressions (CSP: no unsafe-eval).
 * Search on LottieFiles.com: "empty notebook", "journal", "diary", "open book".
 * Drop the .json file into src/assets/animations/empty-diary.json.
 *
 * Usage in EmptyState:
 *   <EmptyState animationSlot={<EmptyDiaryAnimation />} icon={...} title="..." />
 */

import { LazyLottiePlayer } from '@/components/LazyLottiePlayer';

export function EmptyDiaryAnimation() {
  return (
    <LazyLottiePlayer
      animationImport={() => import('@/assets/animations/empty-diary.json')}
      width={160}
      height={160}
      loop
      fallback={null}
    />
  );
}
