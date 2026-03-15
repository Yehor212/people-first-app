/**
 * AllCompleteCelebration - Celebration card when all daily activities are complete
 * Provides positive reinforcement and reduces pressure to do more
 * ADHD-friendly: Clear visual indication of "done for today"
 *
 * Wave 3 refactor: 16 motion elements → 6. Ambient loops moved to CSS.
 * Only transform/opacity animated for 60fps guarantee on Android.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Star, Sparkles, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { EmojiOrIcon, IconName } from '@/components/icons';
import { zenMotion } from '@/lib/animationUtils';

interface AllCompleteCelebrationProps {
  streak?: number;
}

// Pre-computed sparkle positions (avoid Math.random in render)
const SPARKLE_POSITIONS = [
  { left: '12%', top: '18%', delay: '0s' },
  { left: '78%', top: '25%', delay: '0.4s' },
  { left: '35%', top: '8%', delay: '0.8s' },
  { left: '88%', top: '65%', delay: '1.2s' },
  { left: '20%', top: '75%', delay: '1.6s' },
  { left: '60%', top: '85%', delay: '2.0s' },
];

export const AllCompleteCelebration = memo(function AllCompleteCelebration({ streak = 0 }: AllCompleteCelebrationProps) {
  const { t } = useLanguage();

  const getMessage = (): { emoji: string; iconName: IconName; text: string } => {
    if (streak >= 30) return { emoji: '👑', iconName: 'crown', text: t.allCompleteLegend || 'Legendary day!' };
    if (streak >= 14) return { emoji: '💎', iconName: 'diamond', text: t.allCompleteAmazing || 'Amazing work!' };
    if (streak >= 7) return { emoji: '🌟', iconName: 'star', text: t.allCompleteGreat || 'Great job!' };
    if (streak >= 3) return { emoji: '✨', iconName: 'sparkles', text: t.allCompleteNice || 'Nice work!' };
    return { emoji: '🎉', iconName: 'celebration', text: t.allComplete || 'All done!' };
  };

  const message = getMessage();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500/20 via-primary/15 to-teal-500/20 p-8 text-center border border-emerald-500/30 will-change-transform"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={zenMotion.bouncy}
    >
      {/* CSS-driven sparkles — offloaded from JS thread */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {SPARKLE_POSITIONS.map((pos, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: pos.left,
              top: pos.top,
              animation: `zen-sparkle 2.5s ease-in-out ${pos.delay} infinite`,
            }}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
        ))}
      </div>

      {/* Main icon — CSS float instead of FM loop */}
      <div className="relative mb-6 inline-block animate-zen-float">
        <div className="flex items-center justify-center">
          <EmojiOrIcon emoji={message.emoji} iconName={message.iconName} size="xl" />
        </div>
        <div
          className="absolute -end-2 -top-2 [animation:zen-wobble_2s_ease-in-out_infinite]"
        >
          <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
        </div>
      </div>

      {/* Title */}
      <motion.h2
        className="text-2xl font-bold text-foreground mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, ...zenMotion.gentle }}
      >
        {message.text}
      </motion.h2>

      {/* Subtitle */}
      <motion.p
        className="text-muted-foreground mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...zenMotion.gentle, delay: 0.3 }}
      >
        {t.allCompleteMessage || 'You\'ve completed all activities for today'}
      </motion.p>

      {/* Streak badge */}
      {streak > 0 && (
        <motion.div
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500/20 rounded-full border border-orange-500/30 mb-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, ...zenMotion.gentle }}
        >
          <EmojiOrIcon emoji="🔥" iconName="fire" size="sm" />
          <span className="font-bold text-orange-500 text-lg">{streak}</span>
          <span className="text-sm text-orange-600 dark:text-orange-400">{t.daysStreak || 'days streak'}</span>
        </motion.div>
      )}

      {/* Supportive message */}
      <motion.div
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...zenMotion.gentle, delay: 0.5 }}
      >
        <Heart className="w-4 h-4 text-pink-500" />
        <span>{t.allCompleteSupportive || 'See you tomorrow!'}</span>
        <EmojiOrIcon emoji="💚" iconName="heart" size="xs" />
      </motion.div>
    </motion.div>
  );
});
