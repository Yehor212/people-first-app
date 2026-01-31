/**
 * PremiumIcon - Universal wrapper for premium SVG icons
 * Part of Premium Icons Library - Phase 11.2
 *
 * Usage:
 * <PremiumIcon name="fire" size="lg" animated />
 * <PremiumIcon name="star" size="md" />
 */

import { cn } from '@/lib/utils';
import { FireIcon, IconProps } from './FireIcon';
import { StarIcon } from './StarIcon';
import { DiamondIcon } from './DiamondIcon';
import { TrophyIcon } from './TrophyIcon';
import { CrownIcon } from './CrownIcon';
import { TargetIcon } from './TargetIcon';
import { LightningIcon } from './LightningIcon';
import { HeartIcon } from './HeartIcon';
import { MedalIcon } from './MedalIcon';
import { BrainIcon } from './BrainIcon';
import { MuscleIcon } from './MuscleIcon';
import { SparklesIcon } from './SparklesIcon';
import { CelebrationIcon } from './CelebrationIcon';
import { SeedlingIcon } from './SeedlingIcon';

// All available icon names
export type IconName =
  | 'fire'
  | 'star'
  | 'diamond'
  | 'trophy'
  | 'crown'
  | 'target'
  | 'lightning'
  | 'heart'
  | 'medal'
  | 'brain'
  | 'muscle'
  | 'sparkles'
  | 'celebration'
  | 'seedling';

// Map icon names to components
const iconMap: Record<IconName, React.ComponentType<IconProps>> = {
  fire: FireIcon,
  star: StarIcon,
  diamond: DiamondIcon,
  trophy: TrophyIcon,
  crown: CrownIcon,
  target: TargetIcon,
  lightning: LightningIcon,
  heart: HeartIcon,
  medal: MedalIcon,
  brain: BrainIcon,
  muscle: MuscleIcon,
  sparkles: SparklesIcon,
  celebration: CelebrationIcon,
  seedling: SeedlingIcon,
};

// Emoji to icon name mapping for migration
export const emojiToIconName: Record<string, IconName> = {
  '🔥': 'fire',
  '⭐': 'star',
  '🌟': 'star',
  '💎': 'diamond',
  '🏆': 'trophy',
  '👑': 'crown',
  '🎯': 'target',
  '⚡': 'lightning',
  '❤️': 'heart',
  '💖': 'heart',
  '💗': 'heart',
  '🎖️': 'medal',
  '🧠': 'brain',
  '💪': 'muscle',
  '✨': 'sparkles',
  '🎉': 'celebration',
  '🌱': 'seedling',
};

interface PremiumIconProps extends IconProps {
  name: IconName;
}

/**
 * Universal wrapper for premium SVG icons
 *
 * @param name - Icon name from IconName type
 * @param size - Icon size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 * @param animated - Enable/disable animations (default: true)
 * @param className - Additional CSS classes
 */
export function PremiumIcon({
  name,
  size = 'md',
  animated = true,
  className,
}: PremiumIconProps) {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    console.warn(`PremiumIcon: Unknown icon name "${name}"`);
    return null;
  }

  return (
    <IconComponent
      size={size}
      animated={animated}
      className={className}
    />
  );
}

/**
 * Helper to render PremiumIcon or fallback to emoji
 * Priority: iconName > emojiToIconName mapping > raw emoji
 */
export function EmojiOrIcon({
  emoji,
  iconName,
  size = 'md',
  animated = true,
  className,
}: {
  emoji: string;
  iconName?: string;
  size?: IconProps['size'];
  animated?: boolean;
  className?: string;
}) {
  // Priority 1: Direct iconName prop
  if (iconName && iconMap[iconName as IconName]) {
    return (
      <PremiumIcon
        name={iconName as IconName}
        size={size}
        animated={animated}
        className={className}
      />
    );
  }

  // Priority 2: Emoji to icon mapping
  const mappedIconName = emojiToIconName[emoji];
  if (mappedIconName) {
    return (
      <PremiumIcon
        name={mappedIconName}
        size={size}
        animated={animated}
        className={className}
      />
    );
  }

  // Fallback: Raw emoji
  return <span className={cn('inline-block', className)}>{emoji}</span>;
}

export default PremiumIcon;
