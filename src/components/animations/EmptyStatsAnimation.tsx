import { LazyLottiePlayer } from '@/components/LazyLottiePlayer';

export function EmptyStatsAnimation() {
  return (
    <LazyLottiePlayer
      width={160}
      height={160}
      loop
      fallback={null}
    />
  );
}
