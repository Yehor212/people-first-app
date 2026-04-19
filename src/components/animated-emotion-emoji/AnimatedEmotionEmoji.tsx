/**
 * AnimatedEmotionEmoji - Dispatcher component for Plutchik's 8 primary emotions
 * Maps each emotion to its animated SVG emoji component
 */

import { cn } from '@/lib/utils';
import { PrimaryEmotion, EmotionIntensity } from '@/types';
import { JoyEmoji, TrustEmoji, SurpriseEmoji, AnticipationEmoji } from './warmEmojis';
import { FearEmoji, SadnessEmoji, DisgustEmoji, AngerEmoji } from './coolEmojis';

interface AnimatedEmotionEmojiProps {
  emotion: PrimaryEmotion;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSelected?: boolean;
  intensity?: EmotionIntensity;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const emotionComponents: Record<PrimaryEmotion, React.FC<{ size: string; isSelected?: boolean }>> = {
  joy: JoyEmoji,
  trust: TrustEmoji,
  fear: FearEmoji,
  surprise: SurpriseEmoji,
  sadness: SadnessEmoji,
  disgust: DisgustEmoji,
  anger: AngerEmoji,
  anticipation: AnticipationEmoji,
};

export function AnimatedEmotionEmoji({
  emotion,
  size = 'lg',
  isSelected,
  intensity,
  className
}: AnimatedEmotionEmojiProps) {
  const sizeClass = sizeClasses[size];
  const EmojiComponent = emotionComponents[emotion];

  // Intensity affects scale
  const intensityScale = intensity === 'intense' ? 'scale-110' : intensity === 'mild' ? 'scale-95' : '';

  return (
    <div className={cn(
      "motion-safe:transition-all motion-safe:duration-300",
      isSelected && "scale-110 drop-shadow-xl",
      intensityScale,
      className
    )}>
      <EmojiComponent size={sizeClass} isSelected={isSelected} />
    </div>
  );
}
