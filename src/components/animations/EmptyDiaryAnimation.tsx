import { LazyLottiePlayer } from '@/components/LazyLottiePlayer';

export function EmptyDiaryAnimation() {
  return (
    <LazyLottiePlayer
      width={160}
      height={160}
      loop
      fallback={null}
    />
  );
}
