import { useEffect } from "react";

import { shouldAnimate } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";

interface LazyLottiePlayerProps {
  loop?: boolean;
  autoplay?: boolean;
  width?: number | string;
  height?: number | string;
  onComplete?: () => void;
  className?: string;
  fallback?: React.ReactNode;
  opacity?: number;
}

export function LazyLottiePlayer({
  loop = true,
  autoplay = true,
  width = "100%",
  height = "100%",
  onComplete,
  className,
  fallback = null,
  opacity = 1,
}: LazyLottiePlayerProps) {
  useEffect(() => {
    if (!autoplay || loop || !onComplete || !shouldAnimate()) return;

    const timer = window.setTimeout(onComplete, 1100);
    return () => window.clearTimeout(timer);
  }, [autoplay, loop, onComplete]);

  if (!shouldAnimate()) {
    return <>{fallback}</>;
  }

  return (
    <div
      className={cn(
        "pointer-events-none relative overflow-hidden rounded-full",
        "bg-[radial-gradient(circle_at_50%_42%,hsl(var(--primary)/0.28),hsl(var(--accent)/0.12)_38%,transparent_70%)]",
        "motion-safe:animate-zen-glow-breathe",
        className,
      )}
      style={{ width, height, opacity }}
      aria-hidden="true"
    >
      <span className="zen-particle absolute left-[16%] top-[22%] h-2 w-2 rounded-full bg-primary/60" />
      <span className="zen-particle absolute right-[18%] top-[30%] h-1.5 w-1.5 rounded-full bg-accent/70 [--particle-delay:120ms] [--particle-duration:3.2s]" />
      <span className="zen-particle absolute bottom-[18%] left-[42%] h-2.5 w-2.5 rounded-full bg-secondary/80 [--particle-delay:220ms] [--particle-duration:2.8s]" />
    </div>
  );
}
