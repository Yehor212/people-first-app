import { LazyLottiePlayer } from '@/components/LazyLottiePlayer';

interface CompletionBurstLottieProps {
  onComplete?: () => void;
}

export function CompletionBurstLottie({ onComplete }: CompletionBurstLottieProps) {
  return (
    <div className="absolute inset-[-24px] pointer-events-none">
      <LazyLottiePlayer
        loop={false}
        onComplete={onComplete}
        width="100%"
        height="100%"
        fallback={null}
      />
    </div>
  );
}
