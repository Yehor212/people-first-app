import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GratitudeEntry } from '@/types';
import { getToday, generateId, cn } from '@/lib/utils';
import { Plus, Zap, AlertCircle } from 'lucide-react';
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
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-2xl',
        isPrimaryCTA
          ? 'bg-gradient-to-br from-pink-500/15 via-card to-rose-500/15 border border-pink-500/30'
          : 'bg-card border border-border'
      )}
      style={isPrimaryCTA ? {
        boxShadow: '0 0 25px rgba(236, 72, 153, 0.2), 0 4px 12px rgba(0, 0, 0, 0.1)',
      } : {}}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Cosmic background for primary CTA */}
      {isPrimaryCTA && (
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 70% 30%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)',
            }}
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      )}

      {/* Header */}
      <div className="relative p-4 flex items-center gap-3">
        <motion.div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
            isPrimaryCTA
              ? 'bg-gradient-to-br from-pink-500/30 to-rose-500/20'
              : 'bg-pink-500/20'
          )}
          style={isPrimaryCTA ? {
            boxShadow: '0 0 16px rgba(236, 72, 153, 0.4)',
          } : undefined}
          animate={isPrimaryCTA ? { scale: [1, 1.05, 1] } : undefined}
          transition={isPrimaryCTA ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : undefined}
        >
          🙏
        </motion.div>

        <div className="flex-1">
          <h3 className={cn(
            'font-semibold text-foreground',
            isPrimaryCTA ? 'text-lg' : 'text-base'
          )}>
            {t.gratitude}
          </h3>
          <p className="text-sm text-muted-foreground">
            {todayEntries.length} {t.today}
          </p>
        </div>

        {/* Start Here badge for CTA */}
        {isPrimaryCTA && (
          <motion.div
            className="flex items-center gap-1 px-3 py-1.5 rounded-full"
            style={{
              background: 'rgba(236, 72, 153, 0.25)',
              border: '1px solid rgba(236, 72, 153, 0.3)',
              boxShadow: '0 0 12px rgba(236, 72, 153, 0.3)',
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Zap className="w-3 h-3 text-pink-400" />
            <span className="text-xs font-medium text-pink-400">{t.startHere}</span>
          </motion.div>
        )}
      </div>

      {/* Content */}
      <div className="relative px-4 pb-4">
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.button
                onClick={() => setIsExpanded(true)}
                className={cn(
                  'w-full py-3.5 rounded-xl font-medium',
                  'border-2 border-dashed transition-colors',
                  isPrimaryCTA
                    ? 'border-pink-500/40 hover:border-pink-500/60 text-pink-400'
                    : 'border-border hover:border-primary text-foreground'
                )}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Plus className="w-5 h-5 inline mr-2" />
                {t.whatAreYouGratefulFor}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              {/* Journal Prompt - helps with blank page anxiety */}
              {!text.trim() && (
                <JournalPrompt
                  onUsePrompt={handleUsePrompt}
                  category="gratitude"
                  compact
                />
              )}

              {/* Premium textarea */}
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder={t.iAmGratefulFor}
                className={cn(
                  'w-full p-4 rounded-xl resize-none transition-all',
                  isPrimaryCTA
                    ? 'bg-white/5 backdrop-blur-sm border border-white/20 text-foreground placeholder:text-white/40'
                    : 'bg-secondary border border-border text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/30',
                  validationError && 'ring-2 ring-destructive/50'
                )}
                style={isPrimaryCTA ? {
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                } : {}}
                rows={3}
                autoFocus
              />

              {/* Validation error message */}
              {validationError && (
                <motion.div
                  className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{validationError}</span>
                </motion.div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setIsExpanded(false)}
                  className="flex-1"
                >
                  {t.cancel}
                </Button>
                <motion.button
                  onClick={handleSubmit}
                  disabled={!text.trim()}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl font-medium',
                    'bg-gradient-to-r from-pink-500 to-rose-500 text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  style={{ boxShadow: text.trim() ? '0 0 16px rgba(236, 72, 153, 0.4)' : 'none' }}
                  whileHover={text.trim() ? { scale: 1.02 } : {}}
                  whileTap={text.trim() ? { scale: 0.98 } : {}}
                >
                  {t.save}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recent entries with premium styling */}
      {recentEntries.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-sm text-muted-foreground">{t.recentEntries}:</p>
          {recentEntries.map((entry, index) => (
            <motion.div
              key={entry.id}
              className={cn(
                'p-3 rounded-xl text-sm',
                'bg-gradient-to-r from-pink-500/10 to-transparent',
                'border-l-2 border-pink-500/40'
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <span className="text-pink-400 mr-2">✨</span>
              <span className="text-foreground/80">{entry.text}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
