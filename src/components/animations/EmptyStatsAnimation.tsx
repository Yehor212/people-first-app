/**
 * EmptyStatsAnimation — Animated illustration for empty stats/analytics state.
 *
 * TODO: Replace src/assets/animations/empty-stats.json with a premium Lottie.
 * Requirements: <40KB, 60fps, 2-3s loop, no expressions (CSP: no unsafe-eval).
 * Search on LottieFiles.com: "empty chart", "analytics", "no data graph", "statistics".
 * Drop the .json file into src/assets/animations/empty-stats.json.
 *
 * Usage in EmptyState:
 *   <EmptyState animationSlot={<EmptyStatsAnimation />} icon={...} title="..." />
 */

import { LazyLottiePlayer } from '@/components/LazyLottiePlayer';

export function EmptyStatsAnimation() {
  return (
    <LazyLottiePlayer
      animationImport={() => import('@/assets/animations/empty-stats.json')}
      width={160}
      height={160}
      loop
      fallback={null}
    />
  );
}
