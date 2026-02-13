/**
 * ShareModal - Bottom sheet for sharing achievements, streaks, and progress
 * Part of v1.4.0 Social & Sharing
 */

import { useState, useEffect } from 'react';
import { X, Download, Share2, Copy, Check, Loader2, Image } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
// Sheet replaced with custom bottom-sheet modal
import { Button } from '@/components/ui/button';
import { cn, interpolate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import {
  ShareCardData,
  WeeklyProgressData,
  generateShareCard,
  generateStreakCard,
  generateWeeklyCard,
  generateAchievementCard,
  downloadImage,
  shareImage,
  copyImageToClipboard
} from '@/lib/shareCards';
import { Badge } from '@/types';

// ============================================
// TYPES
// ============================================

type ShareMode = 'achievement' | 'streak' | 'progress' | 'weekly' | 'custom';

interface BaseShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username?: string;
}

interface AchievementShareProps extends BaseShareModalProps {
  mode: 'achievement';
  badge: Badge;
}

interface StreakShareProps extends BaseShareModalProps {
  mode: 'streak';
  streak: number;
  habitName?: string;
}

interface ProgressShareProps extends BaseShareModalProps {
  mode: 'progress';
  data: ShareCardData;
}

interface WeeklyShareProps extends BaseShareModalProps {
  mode: 'weekly';
  data: WeeklyProgressData;
}

interface CustomShareProps extends BaseShareModalProps {
  mode: 'custom';
  data: ShareCardData;
}

export type ShareModalProps =
  | AchievementShareProps
  | StreakShareProps
  | ProgressShareProps
  | WeeklyShareProps
  | CustomShareProps;

// ============================================
// COMPONENT
// ============================================

export function ShareModal(props: ShareModalProps) {
  const { open, onOpenChange, username, mode } = props;
  const { t, language } = useLanguage();

  // Android back button: close the share sheet
  useBackHandler(open, () => onOpenChange(false));
  useScrollLock(open);

  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  // Generate image when modal opens
  useEffect(() => {
    if (!open) {
      // Cleanup on close
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      setImageBlob(null);
      setCopied(false);
      setShared(false);
      return;
    }

    void generateImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, language]);

  const generateImage = async () => {
    setIsGenerating(true);

    try {
      let blob: Blob;

      switch (mode) {
        case 'achievement':
          blob = await generateAchievementCard(
            (props).badge,
            language,
            username
          );
          break;

        case 'streak':
          blob = await generateStreakCard(
            (props).streak,
            (props).habitName,
            username
          );
          break;

        case 'weekly':
          blob = await generateWeeklyCard(
            (props).data,
            username,
            language
          );
          break;

        case 'progress':
        case 'custom':
        default:
          blob = await generateShareCard((props).data);
          break;
      }

      setImageBlob(blob);
      setImageUrl(URL.createObjectURL(blob));
    } catch (error) {
      logger.error('Failed to generate share image:', error);
      toast.error(t.shareGenerateError || 'Failed to generate image. Try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = useThrottledCallback(() => {
    if (!imageBlob) return;
    void hapticTap();

    const filename = `zenflow-${mode}-${Date.now()}.png`;
    downloadImage(imageBlob, filename);
  }, 1000);

  const handleShare = useThrottledCallback(async () => {
    if (!imageBlob) return;
    void hapticTap();

    const title = getShareTitle();
    const text = getShareText();

    try {
      const success = await shareImage(imageBlob, title, text);

      if (success) {
        void hapticSuccess();
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } else {
        // shareImage already downloaded the file as fallback
        // Show success toast - the image was saved
        toast.success(t.imageSaved || 'Image saved to downloads!');
        void hapticSuccess();
      }
    } catch (error) {
      logger.error('Share failed:', error);
      toast.error(t.shareError || 'Could not share. Try downloading instead.');
    }
  }, 1000);

  const handleCopy = useThrottledCallback(async () => {
    if (!imageBlob) return;
    void hapticTap();

    try {
      const success = await copyImageToClipboard(imageBlob);

      if (success) {
        void hapticSuccess();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error(t.copyError || 'Could not copy to clipboard.');
      }
    } catch (error) {
      logger.error('Copy failed:', error);
      toast.error(t.copyError || 'Could not copy to clipboard.');
    }
  }, 1000);

  const getShareTitle = (): string => {
    switch (mode) {
      case 'achievement':
        return t.shareTitle || 'Achievement Unlocked!';
      case 'streak':
        return `${(props).streak} ${t.shareStreak || 'Day Streak'}`;
      case 'weekly':
        return t.myProgress || 'My Weekly Progress';
      default:
        return t.myProgress || 'My Progress';
    }
  };

  const getShareText = (): string => {
    switch (mode) {
      case 'achievement': {
        const badge = (props).badge;
        return `${badge.title[language] || badge.title['en']} - ZenFlow`;
      }
      case 'streak': {
        const streak = (props).streak;
        return `${streak} ${t.shareStreak || 'day streak'} 🔥`;
      }
      case 'weekly': {
        const weeklyData = props.data;
        return interpolate(t.shareText || '{streak} day streak! {habits} habits completed, {focus} minutes of focus.', {
          streak: weeklyData.streak,
          habits: weeklyData.habitsCompleted,
          focus: weeklyData.focusMinutes,
        });
      }
      default: {
        const progressData = (props as ProgressShareProps).data;
        return interpolate(t.shareText || '{streak} day streak! {habits} habits completed, {focus} minutes of focus.', {
          streak: progressData.stats?.find(s => s.label.toLowerCase().includes('streak'))?.value || 0,
          habits: progressData.stats?.find(s => s.label.toLowerCase().includes('habit'))?.value || 0,
          focus: progressData.stats?.find(s => s.label.toLowerCase().includes('focus'))?.value || 0,
        });
      }
    }
  };

  const getModalTitle = (): string => {
    switch (mode) {
      case 'achievement':
        return t.shareAchievements || 'Share Achievement';
      case 'streak':
        return `${t.shareStreak || 'Share Streak'}`;
      case 'weekly':
        return t.myProgress || 'Share Weekly Report';
      default:
        return t.shareAchievements || 'Share Progress';
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => onOpenChange(false)} />
      <div role="dialog" aria-modal="true" className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-[2rem] bg-background max-h-[85dvh] overflow-hidden animate-slide-up pb-safe">
        <div className="pb-4 px-6 pt-6 text-center relative">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 end-4 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label={t.close || 'Close'}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
          <h2 className="text-lg font-semibold">{getModalTitle()}</h2>
          <p className="text-center text-sm text-muted-foreground">
            {t.sharePrivacyNote || 'Share your progress with friends'}
          </p>
        </div>

        <div className="px-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>

        {/* Premium Preview Card */}
        <div className="flex-1 flex items-center justify-center py-4">
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
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="w-8 h-8 text-violet-400" />
                </motion.div>
              </div>
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt={t.sharePreview}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Image className="w-12 h-12 text-white/30" />
              </div>
            )}
          </motion.div>
        </div>

        {/* Premium Action Buttons */}
        <div className="grid grid-cols-3 gap-3 pt-4 pb-8">
          {/* Download Button */}
          <motion.button
            onClick={handleDownload}
            disabled={!imageBlob || isGenerating}
            aria-label={t.shareDownload || 'Download'}
            className={cn(
              "flex flex-col items-center justify-center gap-2 h-20 rounded-xl transition-all",
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
              <Download className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
            <span className="text-xs text-slate-600 dark:text-white/70">{t.shareDownload || 'Download'}</span>
          </motion.button>

          {/* Copy Button */}
          <motion.button
            onClick={handleCopy}
            disabled={!imageBlob || isGenerating}
            aria-label={copied ? (t.shareCopied || 'Copied') : (t.shareCopyLink || 'Copy')}
            className={cn(
              "flex flex-col items-center justify-center gap-2 h-20 rounded-xl transition-all",
              copied
                ? "bg-emerald-500/20 border border-emerald-500/40"
                : "bg-slate-100 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            style={copied ? { boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)' } : undefined}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: copied
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.4) 0%, rgba(20, 184, 166, 0.3) 100%)'
                  : 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(139, 92, 246, 0.2) 100%)',
                boxShadow: copied
                  ? '0 0 12px rgba(16, 185, 129, 0.4)'
                  : '0 0 12px rgba(168, 85, 247, 0.3)'
              }}
            >
              {copied ? (
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <span className={cn("text-xs", copied ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-white/70")}>
              {copied ? (t.shareCopied || 'Copied!') : (t.shareCopyLink || 'Copy')}
            </span>
          </motion.button>

          {/* Share Button */}
          <motion.button
            onClick={handleShare}
            disabled={!imageBlob || isGenerating}
            aria-label={shared ? (t.shareCopied || 'Shared') : (t.shareButton || 'Share')}
            className={cn(
              "flex flex-col items-center justify-center gap-2 h-20 rounded-xl transition-all",
              shared
                ? "bg-emerald-500/20 border border-emerald-500/40"
                : "bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            style={{
              boxShadow: shared
                ? '0 0 16px rgba(16, 185, 129, 0.4)'
                : '0 0 16px rgba(139, 92, 246, 0.3)'
            }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: shared
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.5) 0%, rgba(20, 184, 166, 0.4) 100%)'
                  : 'linear-gradient(135deg, rgba(139, 92, 246, 0.5) 0%, rgba(168, 85, 247, 0.4) 100%)',
                boxShadow: shared
                  ? '0 0 16px rgba(16, 185, 129, 0.5)'
                  : '0 0 16px rgba(139, 92, 246, 0.5)'
              }}
            >
              {shared ? (
                <Check className="w-5 h-5 text-white" />
              ) : (
                <Share2 className="w-5 h-5 text-white" />
              )}
            </div>
            <span className={cn("text-xs font-medium", shared ? "text-emerald-600 dark:text-emerald-400" : "text-violet-700 dark:text-violet-300")}>
              {shared ? (t.shareCopied || 'Shared!') : (t.shareButton || 'Share')}
            </span>
          </motion.button>
        </div>

        {/* Tip */}
        <p className="text-xs text-center text-muted-foreground pb-4">
          {t.shareFooter || 'Share your progress on social media to inspire others!'}
        </p>
        </div>
      </div>
    </>
  );
}

export default ShareModal;
