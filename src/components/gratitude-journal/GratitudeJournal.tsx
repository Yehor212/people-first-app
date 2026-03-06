import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GratitudeEntry } from '@/types';
import { getToday, generateId, cn } from '@/lib/utils';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { Plus, Zap, AlertCircle, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { gratitudeTextSchema } from '@/lib/validation';
import { sanitizeString } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import { JournalPrompt } from '@/components/JournalPrompt';
import { EmptyState } from '@/components/EmptyState';
import { CosmicBackground, FloatingParticles } from './GratitudeEffects';
import { RecentEntries } from './RecentEntries';

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
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

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
      const errorMessage = trimmedText.length > 500
        ? t.textTooLong
        : t.invalidInput;
      setValidationError(errorMessage);
      // Auto-clear error after 3 seconds
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
      validationTimerRef.current = setTimeout(() => setValidationError(null), 3000);
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

  const throttledSubmit = useThrottledCallback(handleSubmit, 1000);

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-2xl',
        isPrimaryCTA
          ? 'bg-gradient-to-br from-pink-500/15 via-card to-rose-500/15 border border-pink-500/30'
          : 'bg-card border border-border zen-shadow-card'
      )}
      style={isPrimaryCTA ? {
        boxShadow: '0 0 25px rgba(236, 72, 153, 0.2), 0 4px 12px rgba(0, 0, 0, 0.1)',
      } : {}}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Cosmic background for primary CTA */}
      {isPrimaryCTA && <CosmicBackground />}

      {/* Floating particles when expanded in CTA mode */}
      {isPrimaryCTA && <FloatingParticles isExpanded={isExpanded} />}

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
            animate={{
              scale: [1, 1.05, 1],
              boxShadow: [
                '0 0 12px rgba(236, 72, 153, 0.3)',
                '0 0 18px rgba(236, 72, 153, 0.5)',
                '0 0 12px rgba(236, 72, 153, 0.3)',
              ],
            }}
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
                <Plus className="w-5 h-5 inline me-2" />
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
                    ? 'bg-foreground/5 backdrop-blur-sm border border-foreground/20 text-foreground placeholder:text-foreground/40'
                    : 'bg-secondary border border-border text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/30',
                  validationError && 'ring-2 ring-destructive/50'
                )}
                style={isPrimaryCTA ? {
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                } : {}}
                rows={3}
                autoFocus
                onFocus={(e) => { const el = e.target; scrollTimeoutRef.current = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
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

                {/* Premium save button with shimmer effect */}
                <motion.button
                  onClick={throttledSubmit}
                  disabled={!text.trim()}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl font-medium relative overflow-hidden',
                    'bg-gradient-to-r from-pink-500 to-rose-500 text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  style={{
                    boxShadow: text.trim()
                      ? '0 0 20px rgba(236, 72, 153, 0.5), 0 4px 12px rgba(236, 72, 153, 0.3)'
                      : 'none'
                  }}
                  whileHover={text.trim() ? {
                    scale: 1.02,
                    boxShadow: '0 0 25px rgba(236, 72, 153, 0.6), 0 4px 15px rgba(236, 72, 153, 0.4)'
                  } : undefined}
                  whileTap={text.trim() ? { scale: 0.98 } : undefined}
                >
                  {/* Shimmer effect when button is enabled */}
                  {text.trim() && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                      }}
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                  <span className="relative z-10">{t.save}</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Empty state when no entries at all */}
      {todayEntries.length === 0 && recentEntries.length === 0 && !isExpanded && (
        <div className="px-4 pb-4">
          <EmptyState
            icon={<Heart className="w-6 h-6 text-pink-500" />}
            title={t.gratitude || 'Gratitude'}
            message={t.whatAreYouGratefulFor || 'Take a moment to appreciate the good things in your life.'}
            size="compact"
          />
        </div>
      )}

      {/* Recent entries with premium styling */}
      <RecentEntries entries={recentEntries} label={t.recentEntries} />
    </motion.div>
  );
}
