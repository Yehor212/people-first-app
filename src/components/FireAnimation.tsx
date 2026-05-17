import { useEffect } from 'react';

import { cn } from '@/lib/utils';

interface FireAnimationProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  loop?: boolean;
  autoplay?: boolean;
  onComplete?: () => void;
}

const sizes = {
  sm: 'w-8 h-11',
  md: 'w-12 h-16',
  lg: 'w-16 h-22',
};

export function FireAnimation({
  className,
  size = 'md',
  loop = true,
  autoplay = true,
  onComplete,
}: FireAnimationProps) {
  useEffect(() => {
    if (loop || !autoplay || !onComplete) return;

    const timer = window.setTimeout(onComplete, 900);
    return () => window.clearTimeout(timer);
  }, [autoplay, loop, onComplete]);

  return (
    <div
      className={cn(
        sizes[size],
        "relative flex items-end justify-center overflow-visible",
        className,
      )}
      aria-hidden="true"
    >
      <span className="absolute bottom-0 h-[82%] w-[58%] rounded-[60%_40%_55%_45%] bg-[radial-gradient(circle_at_50%_72%,hsl(var(--background)/0.95)_0_10%,hsl(var(--accent))_18%,hsl(var(--primary))_58%,transparent_72%)] blur-[0.2px] motion-safe:animate-[flame-flicker_900ms_ease-in-out_infinite]" />
      <span className="absolute bottom-[10%] h-[58%] w-[36%] rounded-[55%_45%_60%_40%] bg-[radial-gradient(circle_at_50%_70%,hsl(var(--background))_0_10%,hsl(var(--accent))_24%,transparent_68%)] opacity-80 motion-safe:animate-[flame-flicker_760ms_ease-in-out_120ms_infinite]" />
    </div>
  );
}

export default FireAnimation;
