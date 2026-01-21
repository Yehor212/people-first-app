/**
 * AllCompleteCelebration - Celebration card when all daily activities are complete
 * Provides positive reinforcement and reduces pressure to do more
 * ADHD-friendly: Clear visual indication of "done for today"
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Star, Sparkles, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AllCompleteCelebrationProps {
  streak?: number;
}

export const AllCompleteCelebration = memo(function AllCompleteCelebration({ streak = 0 }: AllCompleteCelebrationProps) {
  const { t } = useLanguage();

  // Celebration messages based on streak
  const getMessage = () => {
    if (streak >= 30) return { emoji: '👑', text: t.allCompleteLegend || 'Legendary day!' };
    if (streak >= 14) return { emoji: '💎', text: t.allCompleteAmazing || 'Amazing work!' };
    if (streak >= 7) return { emoji: '🌟', text: t.allCompleteGreat || 'Great job!' };
    if (streak >= 3) return { emoji: '✨', text: t.allCompleteNice || 'Nice work!' };
    return { emoji: '🎉', text: t.allComplete || 'All done!' };
  };

  const message = getMessage();

  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500/20 via-primary/15 to-teal-500/20 p-8 text-center border border-emerald-500/30"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      {/* Animated sparkles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            initial={{
              x: `${Math.random() * 100}%`,
              y: `${Math.random() * 100}%`,
              scale: 0
            }}
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 2 + Math.random(),
              delay: i * 0.2,
              repeat: Infinity,
              repeatDelay: Math.random() * 2,
            }}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </motion.div>
        ))}
      </div>

      {/* Main icon */}
      <motion.div
        className="relative mb-6 inline-block"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="text-7xl">{message.emoji}</div>
        <motion.div
          className="absolute -right-2 -top-2"
          animate={{ rotate: [0, 15, 0, -15, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
        </motion.div>
      </motion.div>

      {/* Title */}
      <motion.h2
        className="text-2xl font-bold text-foreground mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {message.text}
      </motion.h2>

      {/* Subtitle */}
      <motion.p
        className="text-muted-foreground mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {t.allCompleteMessage || 'You\'ve completed all activities for today'}
      </motion.p>

      {/* Streak badge (if streak > 0) */}
      {streak > 0 && (
        <motion.div
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500/20 rounded-full border border-orange-500/30 mb-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <span className="text-xl">🔥</span>
          <span className="font-bold text-orange-500 text-lg">{streak}</span>
          <span className="text-sm text-orange-400">{t.daysStreak || 'days streak'}</span>
        </motion.div>
      )}

      {/* Supportive message */}
      <motion.div
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Heart className="w-4 h-4 text-pink-500" />
        <span>{t.allCompleteSupportive || 'See you tomorrow!'}</span>
        <span>💚</span>
      </motion.div>
    </motion.div>
  );
});
