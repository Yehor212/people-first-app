/**
 * UnifiedShareModal - Single modal for all share card generation and actions
 * Replaces ShareModal.tsx, ShareProgress.tsx, and inline share dialogs
 * Part of v1.8.0 Share System Redesign
 */

import { useCallback, useMemo } from 'react';
import { X, Download, Share2, Copy, Check, Loader2, Image, RefreshCw } from 'lucide-react';
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
        className="fixed bottom-0 start-0 end-0 z-[60] rounded-t-[2rem] bg-background max-h-[85dvh] overflow-hidden motion-safe:animate-slide-up pb-[env(safe-area-inset-bottom)]"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center relative">
          {/* Drag handle */}
          <div className="absolute top-3 start-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/30" />

          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 end-4 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label={t.close || 'Close'}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          <h2 className="text-lg font-semibold mt-2">{getModalTitle()}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t.sharePrivacyNote || 'Share your progress with friends'}
          </p>
        </div>

        {/* Scrollable content */}
        <div className="px-6 overflow-y-auto" style={{ maxHeight: 'calc(85dvh - 100px)' }}>

          {/* Preview Card */}
          <div className="flex items-center justify-center py-4">
            <motion.div
              className="relative w-full max-w-[300px] aspect-square rounded-2xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.05) 100%)',
                boxShadow: '0 0 30px rgba(139, 92, 246, 0.15), 0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
              }}
            >
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.03) 50%, transparent 100%)',
                }}
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: 'linear' }}
              />

              {isGenerating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="w-8 h-8 text-violet-400" aria-label={t.generating || 'Generating...'} />
                  </motion.div>
                  <span className="text-xs text-muted-foreground">
                    {t.shareGeneratingSlow || 'This may take a moment...'}
                  </span>
                </div>
              ) : isError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
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
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image className="w-12 h-12 text-white/30" />
                </div>
              )}
            </motion.div>
          </div>

          {/* Success indicator */}
          {isSuccess && lastAction && (
            <div role="status" aria-live="polite" className="text-center mb-3">
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-sm font-medium"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Check className="w-4 h-4" />
                {getSuccessMessage()}
              </motion.div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3 pt-2 pb-4">
            {/* Download */}
            <motion.button
              onClick={handleDownload}
              disabled={!hasImage || !imageBlob}
              aria-label={t.shareDownload || 'Download'}
              className={cn(
                "flex flex-col items-center justify-center gap-2 h-20 min-h-[44px] rounded-xl transition-all",
                "bg-slate-100 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10",
                "hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.2) 100%)',
                  boxShadow: '0 0 12px rgba(59, 130, 246, 0.3)'
                }}
              >
                {isSuccess && lastAction === 'download' ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Download className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                )}
              </div>
              <span className="text-xs text-slate-600 dark:text-white/70">
                {t.shareDownload || 'Download'}
              </span>
            </motion.button>

            {/* Copy */}
            <motion.button
              onClick={handleCopy}
              disabled={!hasImage || !imageBlob}
              aria-label={isSuccess && lastAction === 'copy' ? (t.shareCopied || 'Copied') : (t.shareCopyLink || 'Copy')}
              className={cn(
                "flex flex-col items-center justify-center gap-2 h-20 min-h-[44px] rounded-xl transition-all",
                isSuccess && lastAction === 'copy'
                  ? "bg-emerald-500/20 border border-emerald-500/40"
                  : "bg-slate-100 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              style={isSuccess && lastAction === 'copy' ? { boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)' } : undefined}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: isSuccess && lastAction === 'copy'
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.4) 0%, rgba(20, 184, 166, 0.3) 100%)'
                    : 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(139, 92, 246, 0.2) 100%)',
                  boxShadow: isSuccess && lastAction === 'copy'
                    ? '0 0 12px rgba(16, 185, 129, 0.4)'
                    : '0 0 12px rgba(168, 85, 247, 0.3)'
                }}
              >
                {isSuccess && lastAction === 'copy' ? (
                  <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                )}
              </div>
              <span className={cn("text-xs", isSuccess && lastAction === 'copy' ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-white/70")}>
                {isSuccess && lastAction === 'copy' ? (t.shareCopied || 'Copied!') : (t.shareCopyLink || 'Copy')}
              </span>
            </motion.button>

            {/* Share */}
            <motion.button
              onClick={handleShare}
              disabled={!hasImage || !imageBlob}
              aria-label={isSuccess && lastAction === 'share' ? (t.shareCopied || 'Shared') : (t.shareButton || 'Share')}
              className={cn(
                "flex flex-col items-center justify-center gap-2 h-20 min-h-[44px] rounded-xl transition-all",
                isSuccess && lastAction === 'share'
                  ? "bg-emerald-500/20 border border-emerald-500/40"
                  : "bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              style={{
                boxShadow: isSuccess && lastAction === 'share'
                  ? '0 0 16px rgba(16, 185, 129, 0.4)'
                  : '0 0 16px rgba(139, 92, 246, 0.3)'
              }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: isSuccess && lastAction === 'share'
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.5) 0%, rgba(20, 184, 166, 0.4) 100%)'
                    : 'linear-gradient(135deg, rgba(139, 92, 246, 0.5) 0%, rgba(168, 85, 247, 0.4) 100%)',
                  boxShadow: isSuccess && lastAction === 'share'
                    ? '0 0 16px rgba(16, 185, 129, 0.5)'
                    : '0 0 16px rgba(139, 92, 246, 0.5)'
                }}
              >
                {isSuccess && lastAction === 'share' ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <Share2 className="w-5 h-5 text-white" />
                )}
              </div>
              <span className={cn("text-xs font-medium", isSuccess && lastAction === 'share' ? "text-emerald-600 dark:text-emerald-400" : "text-violet-700 dark:text-violet-300")}>
                {isSuccess && lastAction === 'share' ? (t.shareCopied || 'Shared!') : (t.shareButton || 'Share')}
              </span>
            </motion.button>
          </div>

          {/* Footer */}
          <p className="text-xs text-center text-muted-foreground pb-4">
            {t.shareFooter || 'Share your progress on social media to inspire others!'}
          </p>
        </div>
      </div>
    </>
  );
}

export default UnifiedShareModal;
