import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { shouldAnimate } from '@/lib/animationUtils';
import { GreatEmoji } from './GreatEmoji';
import { GoodEmoji } from './GoodEmoji';
import { OkayEmoji } from './OkayEmoji';
import { BadEmoji } from './BadEmoji';
import { TerribleEmoji } from './TerribleEmoji';

interface AnimatedMoodEmojiProps {
  mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSelected?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const emojiComponents = {
  great: GreatEmoji,
  good: GoodEmoji,
  okay: OkayEmoji,
  bad: BadEmoji,
  terrible: TerribleEmoji,
};

export function AnimatedMoodEmoji({ mood, size = 'lg', isSelected, className }: AnimatedMoodEmojiProps) {
  const sizeClass = sizeClasses[size];
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animate = shouldAnimate();

  // Pause/unpause SVG SMIL animations based on Dopamine Settings
  useEffect(() => {
    if (!wrapperRef.current) return;
    const svg = wrapperRef.current.querySelector('svg');
    if (!svg) return;
    if (animate) {
      svg.unpauseAnimations();
    } else {
      svg.pauseAnimations();
    }
  }, [animate]);

  const EmojiComponent = emojiComponents[mood];

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "transition-all duration-300",
        isSelected && "scale-110 drop-shadow-xl",
        className
      )}
    >
      <EmojiComponent size={sizeClass} isSelected={isSelected} />
    </div>
  );
}
