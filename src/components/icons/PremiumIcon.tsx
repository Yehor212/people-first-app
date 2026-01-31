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
  | 'medal';

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
 * Helper to convert emoji to PremiumIcon if mapping exists
 * Falls back to emoji if no mapping found
 */
export function EmojiOrIcon({
  emoji,
  size = 'md',
  animated = true,
  className,
}: {
  emoji: string;
  size?: IconProps['size'];
  animated?: boolean;
  className?: string;
}) {
  const iconName = emojiToIconName[emoji];

  if (iconName) {
    return (
      <PremiumIcon
        name={iconName}
        size={size}
        animated={animated}
        className={className}
      />
    );
  }

  // Fallback to emoji
  return <span className={cn('inline-block', className)}>{emoji}</span>;
}

export default PremiumIcon;
