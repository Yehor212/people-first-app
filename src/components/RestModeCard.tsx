/**
 * RestModeCard - Beautiful rest mode UI
 * Shows when user activates "Rest Day" to preserve streak without activity
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sparkles, Flame } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { zenMotion } from '@/lib/animationUtils';

// Pre-computed star positions — avoids Math.random() on every render
const REST_STAR_POSITIONS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  x: [12, 78, 45, 88, 25, 62, 8, 92][i],
  y: [15, 42, 75, 20, 55, 85, 35, 65][i],
  duration: 3 + (i % 3),
  delay: i * 0.3,
}));

interface RestModeCardProps {
  streak: number;
  onCancel: () => void;
}

export const RestModeCard = memo(function RestModeCard({ streak, onCancel }: RestModeCardProps) {
  const { t } = useLanguage();

  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-violet-500/20 p-8 text-center border border-indigo-500/30 will-change-transform"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={zenMotion.gentle}
    >
      {/* Background stars — CSS-driven for battery savings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {REST_STAR_POSITIONS.map((star) => (
          <div
            key={star.id}
            className="absolute"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              animation: `zen-sparkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
            }}
          >
            <Sparkles className="w-4 h-4 text-yellow-400" />
          </div>
        ))}
      </div>

      {/* Moon icon — CSS-driven float + sparkle */}
      <div
        className="relative mb-6 [animation:zen-float_4s_ease-in-out_infinite]"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/20 border border-indigo-400/30">
          <Moon className="w-10 h-10 text-indigo-400" />
        </div>
        <div
          className="absolute -end-1 -top-1"
          style={{
            animation: 'zen-pulse 2s ease-in-out infinite',
            '--zen-pulse-scale': '1.2',
          } as React.CSSProperties}
        >
          <Sparkles className="w-6 h-6 text-yellow-400" />
        </div>
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-foreground mb-2">
        {t.restDayTitle}
      </h2>

      {/* Message */}
      <p className="text-muted-foreground mb-6">
        {t.restDayMessage}
      </p>

      {/* Streak preserved badge — CSS-driven pulse */}
      <div
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500/20 rounded-full mb-6 border border-orange-500/30"
        style={{
          animation: 'zen-pulse 2s ease-in-out infinite',
          '--zen-pulse-scale': '1.02',
        } as React.CSSProperties}
      >
        <Flame className="w-5 h-5 text-orange-500" />
        <span className="font-bold text-orange-500 text-lg">{streak}</span>
        <span className="text-sm text-orange-600 dark:text-orange-400">{t.daysSaved}</span>
      </div>

      {/* Supportive message */}
      <p className="text-sm text-muted-foreground mb-6">
        {t.restDaySupportive}
      </p>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="w-full py-3 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-xl transition-colors"
      >
        {t.restDayCancel}
      </button>
    </motion.div>
  );
});
