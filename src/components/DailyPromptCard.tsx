/**
 * DailyPromptCard - Daily writing prompt card for the home page
 * ADHD-friendly: Reduces blank page anxiety with directed prompts
 * Shows one prompt per day, with option to shuffle
 */

import { useState, useCallback } from 'react';
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
    <div className={cn(
      'bg-card rounded-2xl zen-shadow-card border border-border overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-foreground">
              {t.dailyPrompt || 'Daily Prompt'}
            </h3>
          </div>
          <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full font-medium">
            {categoryLabel}
          </span>
        </div>
      </div>

      {/* Prompt */}
      <div className="p-4">
        <p className="text-foreground text-base leading-relaxed mb-4 min-h-[48px]">
          "{promptText}"
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleUse}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all',
              'bg-amber-500/20 text-amber-600 dark:text-amber-400',
              'hover:bg-amber-500/30 active:scale-[0.98]',
              'flex items-center justify-center gap-2'
            )}
          >
            <PenLine className="w-4 h-4" />
            {t.usePrompt || 'Use this prompt'}
          </button>
          <button
            onClick={handleShuffle}
            className={cn(
              'p-2.5 rounded-xl transition-all',
              'bg-secondary hover:bg-muted active:scale-[0.98]',
              isShuffled && 'animate-spin-once'
            )}
            aria-label={t.shufflePrompt || 'Get another prompt'}
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DailyPromptCard;
