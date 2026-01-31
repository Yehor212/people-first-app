/**
 * DailyPromptCard - Daily writing prompt card for the home page
 * ADHD-friendly: Reduces blank page anxiety with directed prompts
 * Shows one prompt per day, with option to shuffle
 *
 * Premium Redesign: Cosmic Amber theme with glow effects
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Shuffle, PenLine } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { hapticTap } from '@/lib/haptics';
import {
  JournalPrompt,
  CATEGORY_LABELS,
  getPromptText,
  getRandomPrompt,
  getDailyPrompt,
} from '@/lib/journalPrompts';

interface DailyPromptCardProps {
  onUsePrompt: (text: string) => void;
  className?: string;
}

export function DailyPromptCard({ onUsePrompt, className }: DailyPromptCardProps) {
  const { language, t } = useLanguage();
  const [currentPrompt, setCurrentPrompt] = useState<JournalPrompt>(() =>
    getDailyPrompt()
  );
  const [isShuffled, setIsShuffled] = useState(false);

  const handleShuffle = useCallback(() => {
    hapticTap();
    setCurrentPrompt(getRandomPrompt());
    setIsShuffled(true);
  }, []);

  const handleUse = useCallback(() => {
    hapticTap();
    const text = getPromptText(currentPrompt, language);
    onUsePrompt(text);
  }, [currentPrompt, language, onUsePrompt]);

  const promptText = getPromptText(currentPrompt, language);
  const categoryLabel = CATEGORY_LABELS[currentPrompt.category][language] || CATEGORY_LABELS[currentPrompt.category].en;

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-gradient-to-br from-amber-500/10 via-card to-orange-500/10',
        'border border-amber-500/20',
        className
      )}
      style={{
        boxShadow: '0 0 20px rgba(245, 158, 11, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)',
      }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      {/* Animated glow background */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(245, 158, 11, 0.15) 0%, transparent 50%)',
        }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Header with gradient icon */}
      <div className="relative p-4 border-b border-amber-500/20">
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(249, 115, 22, 0.2) 100%)',
              boxShadow: '0 0 12px rgba(245, 158, 11, 0.4)',
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Lightbulb className="w-5 h-5 text-amber-400" />
          </motion.div>
          <span className="font-semibold text-foreground">
            {t.dailyPrompt || 'Daily Prompt'}
          </span>
          <div
            className="ml-auto px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background: 'rgba(245, 158, 11, 0.2)',
              color: 'rgb(251, 191, 36)',
              boxShadow: '0 0 8px rgba(245, 158, 11, 0.3)',
            }}
          >
            {categoryLabel}
          </div>
        </div>
      </div>

      {/* Prompt content */}
      <div className="relative p-4">
        <p className="text-lg text-foreground/90 italic leading-relaxed min-h-[56px] mb-4">
          "{promptText}"
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <motion.button
            onClick={handleUse}
            className={cn(
              'flex-1 py-3 rounded-xl font-medium text-sm',
              'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
              'flex items-center justify-center gap-2'
            )}
            style={{ boxShadow: '0 0 16px rgba(245, 158, 11, 0.4)' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <PenLine className="w-4 h-4" />
            {t.usePrompt || 'Use this prompt'}
          </motion.button>

          <motion.button
            onClick={handleShuffle}
            className={cn(
              'p-3 rounded-xl',
              'bg-white/5 border border-white/10',
              'hover:bg-white/10 transition-colors'
            )}
            aria-label={t.shufflePrompt || 'Get another prompt'}
            whileHover={{ scale: 1.05, rotate: 180 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Shuffle className="w-5 h-5 text-amber-400" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default DailyPromptCard;
