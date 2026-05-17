import { LazyLottiePlayer } from '@/components/LazyLottiePlayer';

interface AllHabitsDoneAnimationProps {
  onComplete?: () => void;
}

export function AllHabitsDoneAnimation({ onComplete }: AllHabitsDoneAnimationProps) {
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
