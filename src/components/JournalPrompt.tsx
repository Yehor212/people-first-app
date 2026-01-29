/**
 * JournalPrompt - Daily writing prompt card
 * ADHD-friendly: Reduces blank page anxiety with directed prompts
 */

import { useState, useCallback } from 'react';
import { Lightbulb, Shuffle, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  JournalPrompt as JournalPromptType,
  PromptCategory,
  CATEGORY_LABELS,
  getPromptText,
  getRandomPrompt,
  getDailyPrompt,
} from '@/lib/journalPrompts';

interface JournalPromptProps {
  onUsePrompt: (text: string) => void;
  category?: PromptCategory;
  compact?: boolean;
}

export function JournalPrompt({ onUsePrompt, category, compact = false }: JournalPromptProps) {
  const { language, t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [currentPrompt, setCurrentPrompt] = useState<JournalPromptType>(() =>
    category ? getRandomPrompt(category) : getDailyPrompt()
  );

  const handleShuffle = useCallback(() => {
    setCurrentPrompt(getRandomPrompt(category));
  }, [category]);

  const handleUse = useCallback(() => {
    const text = getPromptText(currentPrompt, language);
    onUsePrompt(text);
  }, [currentPrompt, language, onUsePrompt]);

  const promptText = getPromptText(currentPrompt, language);
  const categoryLabel = CATEGORY_LABELS[currentPrompt.category][language] || CATEGORY_LABELS[currentPrompt.category].en;

  // Compact mode - just a small button
  if (compact && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-lg transition-colors"
      >
        <Lightbulb className="w-4 h-4" />
        <span>{t.needInspiration || 'Need inspiration?'}</span>
        <ChevronDown className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="bg-gradient-to-r from-accent/10 to-primary/10 rounded-xl p-4 border border-accent/20 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-accent">
            {t.journalPrompt || 'Prompt'}
          </span>
          <span className="text-xs px-2 py-0.5 bg-secondary rounded-full text-muted-foreground">
            {categoryLabel}
          </span>
        </div>
        {compact && (
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 hover:bg-secondary/50 rounded transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Prompt text */}
      <p className={cn(
        "text-foreground leading-relaxed mb-4",
        compact ? "text-sm" : "text-base"
      )}>
        "{promptText}"
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleUse}
          className="flex-1 py-2 px-4 bg-accent/20 text-accent hover:bg-accent/30 rounded-lg font-medium text-sm transition-colors"
        >
          {t.usePrompt || 'Use this prompt'}
        </button>
        <button
          onClick={handleShuffle}
          className="p-2 bg-secondary hover:bg-muted rounded-lg transition-colors"
          title={t.shufflePrompt || 'Get another prompt'}
        >
          <Shuffle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
