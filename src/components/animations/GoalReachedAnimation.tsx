import { LazyLottiePlayer } from '@/components/LazyLottiePlayer';

interface GoalReachedAnimationProps {
  onComplete?: () => void;
}

export function GoalReachedAnimation({ onComplete }: GoalReachedAnimationProps) {
  return (
    <LazyLottiePlayer
      width={200}
      height={200}
      loop={false}
      onComplete={onComplete}
      fallback={null}
    />
  );
}
