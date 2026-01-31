import { useState, useCallback, useEffect } from 'react';
import { GratitudeEntry } from '@/types';
import { getToday, generateId, cn } from '@/lib/utils';
import { Sparkles, Plus, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { gratitudeTextSchema, sanitizeString } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { JournalPrompt } from '@/components/JournalPrompt';

interface GratitudeJournalProps {
  entries: GratitudeEntry[];
  onAddEntry: (entry: GratitudeEntry) => void;
  isPrimaryCTA?: boolean;
  initialText?: string;
  onInitialTextUsed?: () => void;
}

export function GratitudeJournal({ entries, onAddEntry, isPrimaryCTA = false, initialText, onInitialTextUsed }: GratitudeJournalProps) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Handle initial text from DailyPromptCard
  useEffect(() => {
    if (initialText) {
      setText(initialText + '\n\n');
      setIsExpanded(true);
      onInitialTextUsed?.();
    }
  }, [initialText, onInitialTextUsed]);

  const today = getToday();
  const todayEntries = entries.filter(e => e.date === today);
  const recentEntries = entries.slice(-5).reverse();

  // Handle using a journal prompt
  const handleUsePrompt = useCallback((promptText: string) => {
    setText(promptText + '\n\n');
  }, []);

  const handleSubmit = () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    // Clear any previous error
    setValidationError(null);

    // Validate and sanitize input to prevent XSS
    const validationResult = gratitudeTextSchema.safeParse(trimmedText);
    if (!validationResult.success) {
      logger.warn('[GratitudeJournal] Invalid gratitude text:', validationResult.error.message);
      // Show user-friendly error message
      const errorMessage = trimmedText.length > 2000
        ? t.textTooLong
        : t.invalidInput;
      setValidationError(errorMessage);
      // Auto-clear error after 3 seconds
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    const sanitizedText = sanitizeString(validationResult.data);

    const entry: GratitudeEntry = {
      id: generateId(),
      text: sanitizedText,
      date: today,
      timestamp: Date.now(),
    };

    onAddEntry(entry);
    setText('');
    setIsExpanded(false);
  };

  return (
    <div className={cn(
      "rounded-2xl p-6 animate-fade-in transition-all relative overflow-hidden",
      isPrimaryCTA
        ? "bg-gradient-to-br from-pink-500/15 via-card to-rose-500/15 ring-2 ring-pink-500/40 shadow-lg shadow-pink-500/20"
        : "bg-card zen-shadow-card"
    )}>
      {/* Animated background glow for CTA */}
      {isPrimaryCTA && (
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/5 via-transparent to-rose-500/5 animate-pulse" />
      )}

      {/* Primary CTA Header */}
      {isPrimaryCTA && (
        <div className="relative flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-pink-500/25 rounded-full border border-pink-500/30">
            <Zap className="w-4 h-4 text-pink-500" />
            <span className="text-sm font-bold text-pink-600 dark:text-pink-400">{t.startHere}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 relative">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className={cn(
            "font-semibold text-foreground",
            isPrimaryCTA ? "text-xl" : "text-lg"
          )}>{t.gratitude}</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {todayEntries.length} {t.today}
        </span>
      </div>

      {!isExpanded ? (
        <Button
          variant="outline"
          size="lg"
          onClick={() => setIsExpanded(true)}
          className="w-full border-2 border-dashed hover:border-primary"
        >
          <Plus className="w-5 h-5" />
          <span>{t.whatAreYouGratefulFor}</span>
        </Button>
      ) : (
        <div className="animate-scale-in space-y-3">
          {/* Journal Prompt - helps with blank page anxiety */}
          {!text.trim() && (
            <JournalPrompt
              onUsePrompt={handleUsePrompt}
              category="gratitude"
              compact
            />
          )}

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder={t.iAmGratefulFor}
            className={cn(
              "w-full p-4 bg-secondary rounded-lg text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 transition-all",
              validationError ? "ring-2 ring-destructive/50 focus:ring-destructive/50" : "focus:ring-accent/30"
            )}
            rows={3}
            autoFocus
          />
          {/* Validation error message */}
          {validationError && (
            <div className="flex items-center gap-2 px-3 py-2 mt-2 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <Button
              variant="secondary"
              onClick={() => setIsExpanded(false)}
              className="flex-1"
            >
              {t.cancel}
            </Button>
            <Button
              variant="gradient"
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="flex-1"
            >
              {t.save}
            </Button>
          </div>
        </div>
      )}

      {recentEntries.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">{t.recentEntries}:</p>
          {recentEntries.map((entry) => (
            <div
              key={entry.id}
              className="p-3 bg-secondary/50 rounded-lg text-sm text-foreground"
            >
              ✨ {entry.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
