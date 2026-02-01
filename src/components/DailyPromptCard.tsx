/**
 * DailyPromptCard - Daily writing prompt card for the home page
 * ADHD-friendly: Reduces blank page anxiety with directed prompts
 * Shows one prompt per day, with option to shuffle
 *
 * Premium Redesign: Cosmic Amber theme with glow effects
 * - Animated quote marks
 * - Pulsing category badge
 * - Particle burst on shuffle
 * - Shimmer effect on use button
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [showParticles, setShowParticles] = useState(false);
  const [promptKey, setPromptKey] = useState(0); // For animating prompt text change

  const handleShuffle = useCallback(() => {
    hapticTap();
    setShowParticles(true);
    setTimeout(() => setShowParticles(false), 600);
    setCurrentPrompt(getRandomPrompt());
    setPromptKey(prev => prev + 1);
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

      {/* Secondary nebula effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 80% 70%, rgba(249, 115, 22, 0.1) 0%, transparent 45%)',
        }}
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
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

          {/* Pulsing category badge */}
          <motion.div
            className="ml-auto px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background: 'rgba(245, 158, 11, 0.25)',
              color: 'rgb(251, 191, 36)',
              boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)',
            }}
            animate={{
              boxShadow: [
                '0 0 8px rgba(245, 158, 11, 0.3)',
                '0 0 16px rgba(245, 158, 11, 0.5)',
                '0 0 8px rgba(245, 158, 11, 0.3)',
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {categoryLabel}
          </motion.div>
        </div>
      </div>

      {/* Prompt content */}
      <div className="relative p-4">
        {/* Animated opening quote */}
        <motion.span
          className="absolute left-2 top-2 text-amber-400/40 text-3xl font-serif pointer-events-none select-none"
          animate={{
            opacity: [0.3, 0.5, 0.3],
            y: [0, -2, 0],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          "
        </motion.span>

        {/* Prompt text with animation on change */}
        <AnimatePresence mode="wait">
          <motion.p
            key={promptKey}
            className="text-lg text-foreground/90 italic leading-relaxed min-h-[56px] mb-4 pl-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {promptText}"
          </motion.p>
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-2">
          {/* Use button with shimmer */}
          <motion.button
            onClick={handleUse}
            className={cn(
              'flex-1 py-3 rounded-xl font-medium text-sm relative overflow-hidden',
              'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
              'flex items-center justify-center gap-2'
            )}
            style={{ boxShadow: '0 0 18px rgba(245, 158, 11, 0.45)' }}
            whileHover={{
              scale: 1.02,
              boxShadow: '0 0 24px rgba(245, 158, 11, 0.6)',
            }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
              }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
            <PenLine className="w-4 h-4 relative z-10" />
            <span className="relative z-10">{t.usePrompt || 'Use this prompt'}</span>
          </motion.button>

          {/* Shuffle button with particle burst */}
          <motion.button
            onClick={handleShuffle}
            className={cn(
              'p-3 rounded-xl relative overflow-hidden',
              'bg-white/5 border border-white/10',
              'hover:bg-white/10 transition-colors'
            )}
            aria-label={t.shufflePrompt || 'Get another prompt'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9, rotate: 180 }}
            transition={{ duration: 0.3 }}
          >
            {/* Particle burst on click */}
            <AnimatePresence>
              {showParticles && (
                <>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1.5 h-1.5 rounded-full"
                      style={{
                        left: '50%',
                        top: '50%',
                        marginLeft: -3,
                        marginTop: -3,
                        background: i % 2 === 0 ? 'rgb(251, 191, 36)' : 'rgb(249, 115, 22)',
                        boxShadow: `0 0 4px ${i % 2 === 0 ? 'rgb(251, 191, 36)' : 'rgb(249, 115, 22)'}`,
                      }}
                      initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                      animate={{
                        x: Math.cos((i / 8) * Math.PI * 2) * 28,
                        y: Math.sin((i / 8) * Math.PI * 2) * 28,
                        scale: 0,
                        opacity: [1, 1, 0],
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  ))}
                </>
              )}
            </AnimatePresence>
            <Shuffle className="w-5 h-5 text-amber-400 relative z-10" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default DailyPromptCard;
