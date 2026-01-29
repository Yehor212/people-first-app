/**
 * FireAnimation - Animated fire effect for streaks
 *
 * Shows a Lottie fire animation when:
 * - User has an active streak
 * - User extends their streak
 * - Celebration moments
 */

import Lottie from 'lottie-react';
import fireAnimation from '@/assets/animations/fire-streak.json';
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
  return (
    <div className={cn(sizes[size], className)}>
      <Lottie
        animationData={fireAnimation}
        loop={loop}
        autoplay={autoplay}
        onComplete={onComplete}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

export default FireAnimation;
