/**
 * UnifiedShareModal - Single modal for all share card generation and actions
 * Duolingo-style UX: big preview + prominent Share button + secondary actions
 */

import { useCallback, useMemo } from 'react';
import { X, Download, Share2, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, interpolate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/components/ThemeToggle';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useShareFlow } from '@/hooks/useShareFlow';
import {
  ShareCardData,
  WeeklyProgressData,
  ShareCardTranslations,
  DEFAULT_CARD_TRANSLATIONS,
  generateShareCard,
  generateStreakCard,
  generateWeeklyCard,
  generateAchievementCard,
} from '@/lib/shareCards';
import type { Badge } from '@/types';

// ============================================
// TYPES
// ============================================

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username?: string;
}

interface AchievementProps extends BaseProps {
  mode: 'achievement';
  badge: Badge;
}

interface StreakProps extends BaseProps {
  mode: 'streak';
  streak: number;
  habitName?: string;
}

interface ProgressProps extends BaseProps {
  mode: 'progress';
  data: ShareCardData;
}

interface WeeklyProps extends BaseProps {
  mode: 'weekly';
  data: WeeklyProgressData;
}

export type UnifiedShareModalProps =
  | AchievementProps
  | StreakProps
  | ProgressProps
  | WeeklyProps;

// ============================================
// TRANSLATION BRIDGE
// ============================================

function buildCardTranslations(t: Record<string, string>): ShareCardTranslations {
  return {
    dayStreak: t.shareCardDayStreak || DEFAULT_CARD_TRANSLATIONS.dayStreak,
    weeklyReview: t.shareCardWeeklyReview || DEFAULT_CARD_TRANSLATIONS.weeklyReview,
    mood: t.shareCardMood || DEFAULT_CARD_TRANSLATIONS.mood,
    habits: t.shareCardHabits || DEFAULT_CARD_TRANSLATIONS.habits,
    focus: t.shareCardFocus || DEFAULT_CARD_TRANSLATIONS.focus,
    streak: t.shareCardStreak || DEFAULT_CARD_TRANSLATIONS.streak,
    days: t.shareCardDays || DEFAULT_CARD_TRANSLATIONS.days,
    newAchievements: t.shareCardNewAchievements || DEFAULT_CARD_TRANSLATIONS.newAchievements,
    trackHabits: t.shareCardTrackHabits || DEFAULT_CARD_TRANSLATIONS.trackHabits,
    moodGreat: t.shareCardMoodGreat || DEFAULT_CARD_TRANSLATIONS.moodGreat,
    moodGood: t.shareCardMoodGood || DEFAULT_CARD_TRANSLATIONS.moodGood,
    moodOkay: t.shareCardMoodOkay || DEFAULT_CARD_TRANSLATIONS.moodOkay,
    moodLow: t.shareCardMoodLow || DEFAULT_CARD_TRANSLATIONS.moodLow,
    moodTough: t.shareCardMoodTough || DEFAULT_CARD_TRANSLATIONS.moodTough,
  };
}

// ============================================
// COMPONENT
// ============================================

export function UnifiedShareModal(props: UnifiedShareModalProps) {
  const { open, onOpenChange, username, mode } = props;
  const { t, language } = useLanguage();
  const { effectiveTheme } = useTheme();

  // All state declarations BEFORE hooks that reference them (TDZ)
  const cardTranslations = useMemo(
    () => buildCardTranslations(t as unknown as Record<string, string>),
    [t]
  );

  const theme = effectiveTheme === 'dark' ? 'dark' : 'light';

  // Build the generate function for this mode
  const generateFn = useCallback(async (): Promise<Blob> => {
    switch (props.mode) {
      case 'achievement':
        return generateAchievementCard(
          props.badge,
          language,
          username
        );

      case 'streak':
        return generateStreakCard(
          props.streak,
          cardTranslations,
          props.habitName,
          username,
          language
        );

      case 'weekly':
        return generateWeeklyCard(
          props.data,
          cardTranslations,
          theme,
          username,
          language
        );

      case 'progress':
        return generateShareCard(props.data, language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, language, username, theme, cardTranslations]);

  const {
    status,
    imageUrl,
    imageBlob,
    error,
    lastAction,
    generate,
    download,
    copy,
    share,
  } = useShareFlow({
    open,
    generateFn,
    errorMessage: t.shareGenerateError || 'Failed to generate image. Try again.',
  });

  // Hooks that use state (after all declarations)
  useBackHandler(open, () => onOpenChange(false));
  useScrollLock(open);

  // Derived state
  const isGenerating = status === 'generating';
  const hasImage = status === 'preview' || status === 'success';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  // Actions
  const handleDownload = useCallback(() => {
    const filename = `zenflow-${mode}-${Date.now()}.png`;
    download(filename);
  }, [mode, download]);

  const handleShare = useCallback(() => {
    const title = getShareTitle();
    const text = getShareText();
    void share(title, text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, share, language]);

  const handleCopy = useCallback(() => {
    void copy();
  }, [copy]);

  // Title/text helpers
  function getShareTitle(): string {
    switch (props.mode) {
      case 'achievement':
        return t.shareTitle || 'Achievement Unlocked!';
      case 'streak':
        return `${props.streak} ${t.shareStreak || 'Day Streak'}`;
      case 'weekly':
        return t.myProgress || 'My Weekly Progress';
      case 'progress':
        return t.myProgress || 'My Progress';
    }
  }

  function getShareText(): string {
    switch (props.mode) {
      case 'achievement':
        return `${props.badge.title[language] || props.badge.title['en']} - ZenFlow`;
      case 'streak':
        return `${props.streak} ${t.shareStreak || 'day streak'}`;
      case 'weekly':
        return interpolate(t.shareText || '{streak} day streak! {habits} habits completed, {focus} minutes of focus.', {
          streak: props.data.streak,
          habits: props.data.habitsCompleted,
          focus: props.data.focusMinutes,
        });
      case 'progress':
        return interpolate(t.shareText || '{streak} day streak! {habits} habits completed, {focus} minutes of focus.', {
          streak: props.data.stats?.find(s => s.label.toLowerCase().includes('streak'))?.value || 0,
          habits: props.data.stats?.find(s => s.label.toLowerCase().includes('habit'))?.value || 0,
          focus: props.data.stats?.find(s => s.label.toLowerCase().includes('focus'))?.value || 0,
        });
    }
  }

  function getModalTitle(): string {
    switch (props.mode) {
      case 'achievement':
        return t.shareAchievements || 'Share Achievement';
      case 'streak':
        return t.shareStreak || 'Share Streak';
      case 'weekly':
        return t.myProgress || 'Share Weekly Report';
      case 'progress':
        return t.shareAchievements || 'Share Progress';
    }
  }

  function getSuccessMessage(): string {
    switch (lastAction) {
      case 'download':
        return t.shareDownloadSuccess || t.imageSaved || 'Image saved!';
      case 'copy':
        return t.shareCopySuccess || t.shareCopied || 'Copied to clipboard!';
      case 'share':
        return t.shareSharedSuccess || 'Shared successfully!';
      default:
        return '';
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm motion-safe:animate-fade-in"
        onClick={() => onOpenChange(false)}
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed bottom-0 start-0 end-0 z-[60] rounded-t-[2rem] bg-background max-h-[90dvh] overflow-hidden motion-safe:animate-slide-up pb-[env(safe-area-inset-bottom)]"
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 text-center relative">
          {/* Drag handle */}
          <div className="absolute top-3 start-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/30" />

          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 end-4 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label={t.close || 'Close'}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          <h2 className="text-lg font-semibold mt-2">{getModalTitle()}</h2>
        </div>

        {/* Scrollable content */}
        <div className="px-4 overflow-y-auto" style={{ maxHeight: 'calc(90dvh - 80px)' }}>

          {/* Preview Card — large, full-width */}
          <div className="flex items-center justify-center py-2">
            <motion.div
              className={cn(
                "relative w-full rounded-2xl overflow-hidden",
                mode === 'weekly' ? 'max-w-[360px]' : 'max-w-[360px] aspect-square'
              )}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              style={{
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
              }}
            >
              {isGenerating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/50">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" aria-label={t.generating || 'Generating...'} />
                </div>
              ) : isError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 bg-muted/50">
                  <div className="text-sm text-destructive text-center" role="status" aria-live="polite">
                    {error}
                  </div>
                  <button
                    onClick={() => void generate()}
                    className="flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t.shareRetry || 'Retry'}
                  </button>
                </div>
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt={t.sharePreview || 'Share preview'}
                  className="w-full h-full object-contain"
                />
              ) : null}
            </motion.div>
          </div>

          {/* Success indicator */}
          {isSuccess && lastAction && (
            <div role="status" aria-live="polite" className="text-center mb-2">
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-sm font-medium"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Check className="w-4 h-4" />
                {getSuccessMessage()}
              </motion.div>
            </div>
          )}

          {/* Primary action: Share button — full width, prominent */}
          <div className="pt-2 pb-2">
            <motion.button
              onClick={handleShare}
              disabled={!hasImage || !imageBlob}
              aria-label={t.shareButton || 'Share'}
              className={cn(
                "w-full flex items-center justify-center gap-3 h-14 min-h-[44px] rounded-2xl text-base font-semibold transition-all",
                isSuccess && lastAction === 'share'
                  ? "bg-emerald-500 text-white"
                  : "bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "shadow-lg"
              )}
              style={{
                boxShadow: isSuccess && lastAction === 'share'
                  ? '0 4px 20px rgba(16, 185, 129, 0.4)'
                  : '0 4px 20px rgba(139, 92, 246, 0.4)'
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSuccess && lastAction === 'share' ? (
                <Check className="w-5 h-5" />
              ) : (
                <Share2 className="w-5 h-5" />
              )}
              {isSuccess && lastAction === 'share'
                ? (t.shareSharedSuccess || 'Shared!')
                : (t.shareButton || 'Share')}
            </motion.button>
          </div>

          {/* Secondary actions: Download + Copy */}
          <div className="grid grid-cols-2 gap-3 pb-4">
            {/* Download */}
            <motion.button
              onClick={handleDownload}
              disabled={!hasImage || !imageBlob}
              aria-label={t.shareDownload || 'Download'}
              className={cn(
                "flex items-center justify-center gap-2 h-12 min-h-[44px] rounded-xl text-sm font-medium transition-all",
                "bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10",
                "hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSuccess && lastAction === 'download' ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Download className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-foreground/80">
                {isSuccess && lastAction === 'download'
                  ? (t.imageSaved || 'Saved!')
                  : (t.shareDownload || 'Download')}
              </span>
            </motion.button>

            {/* Copy */}
            <motion.button
              onClick={handleCopy}
              disabled={!hasImage || !imageBlob}
              aria-label={isSuccess && lastAction === 'copy' ? (t.shareCopied || 'Copied') : (t.shareCopyLink || 'Copy')}
              className={cn(
                "flex items-center justify-center gap-2 h-12 min-h-[44px] rounded-xl text-sm font-medium transition-all",
                isSuccess && lastAction === 'copy'
                  ? "bg-emerald-500/15 border border-emerald-500/30"
                  : "bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSuccess && lastAction === 'copy' ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
              <span className={cn(
                isSuccess && lastAction === 'copy' ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/80"
              )}>
                {isSuccess && lastAction === 'copy' ? (t.shareCopied || 'Copied!') : (t.shareCopyLink || 'Copy')}
              </span>
            </motion.button>
          </div>
        </div>
      </div>
    </>
  );
}

export default UnifiedShareModal;
