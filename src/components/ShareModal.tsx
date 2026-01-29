/**
 * ShareModal - Bottom sheet for sharing achievements, streaks, and progress
 * Part of v1.4.0 Social & Sharing
 */

import { useState, useEffect } from 'react';
import { X, Download, Share2, Copy, Check, Loader2, Image } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
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

    generateImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, language]);

  const generateImage = async () => {
    setIsGenerating(true);

    try {
      let blob: Blob;

      switch (mode) {
        case 'achievement':
          blob = await generateAchievementCard(
            (props as AchievementShareProps).badge,
            language,
            username
          );
          break;

        case 'streak':
          blob = await generateStreakCard(
            (props as StreakShareProps).streak,
            (props as StreakShareProps).habitName,
            username
          );
          break;

        case 'weekly':
          blob = await generateWeeklyCard(
            (props as WeeklyShareProps).data,
            username,
            language
          );
          break;

        case 'progress':
        case 'custom':
        default:
          blob = await generateShareCard((props as ProgressShareProps | CustomShareProps).data);
          break;
      }

      setImageBlob(blob);
      setImageUrl(URL.createObjectURL(blob));
    } catch (error) {
      logger.error('Failed to generate share image:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!imageBlob) return;
    hapticTap();

    const filename = `zenflow-${mode}-${Date.now()}.png`;
    downloadImage(imageBlob, filename);
  };

  const handleShare = async () => {
    if (!imageBlob) return;
    hapticTap();

    const title = getShareTitle();
    const text = getShareText();

    const success = await shareImage(imageBlob, title, text);

    if (success) {
      hapticSuccess();
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  const handleCopy = async () => {
    if (!imageBlob) return;
    hapticTap();

    const success = await copyImageToClipboard(imageBlob);

    if (success) {
      hapticSuccess();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getShareTitle = (): string => {
    switch (mode) {
      case 'achievement':
        return t.shareTitle || 'Achievement Unlocked!';
      case 'streak':
        return `${(props as StreakShareProps).streak} ${t.shareStreak || 'Day Streak'}`;
      case 'weekly':
        return t.myProgress || 'My Weekly Progress';
      default:
        return t.myProgress || 'My Progress';
    }
  };

  const getShareText = (): string => {
    switch (mode) {
      case 'achievement':
        const badge = (props as AchievementShareProps).badge;
        return `${badge.title[language] || badge.title['en']} - ZenFlow`;
      case 'streak':
        const streak = (props as StreakShareProps).streak;
        return `${streak} ${t.shareStreak || 'day streak'} 🔥`;
      case 'weekly':
        return t.shareText || 'Check out my weekly wellness progress!';
      default:
        return t.shareText || 'Track your wellness journey with ZenFlow';
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl pb-safe">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center">{getModalTitle()}</SheetTitle>
          <SheetDescription className="text-center text-sm">
            {t.sharePrivacyNote || 'Share your progress with friends'}
          </SheetDescription>
        </SheetHeader>

        {/* Preview */}
        <div className="flex-1 flex items-center justify-center py-4">
          <div className="relative w-full max-w-[300px] aspect-square rounded-2xl overflow-hidden bg-muted shadow-xl">
            {isGenerating ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt="Share preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Image className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-3 pt-4 pb-8">
          <Button
            variant="outline"
            className="flex-col h-20 gap-2"
            onClick={handleDownload}
            disabled={!imageBlob || isGenerating}
          >
            <Download className="w-5 h-5" />
            <span className="text-xs">{t.shareDownload || 'Download'}</span>
          </Button>

          <Button
            variant="outline"
            className={cn(
              "flex-col h-20 gap-2 transition-colors",
              copied && "bg-emerald-500/10 border-emerald-500 text-emerald-600"
            )}
            onClick={handleCopy}
            disabled={!imageBlob || isGenerating}
          >
            {copied ? (
              <>
                <Check className="w-5 h-5" />
                <span className="text-xs">{t.shareCopied || 'Copied!'}</span>
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                <span className="text-xs">{t.shareCopyLink || 'Copy'}</span>
              </>
            )}
          </Button>

          <Button
            className={cn(
              "flex-col h-20 gap-2 transition-colors",
              shared && "bg-emerald-500"
            )}
            onClick={handleShare}
            disabled={!imageBlob || isGenerating}
          >
            {shared ? (
              <>
                <Check className="w-5 h-5" />
                <span className="text-xs">{t.shareCopied || 'Shared!'}</span>
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                <span className="text-xs">{t.shareButton || 'Share'}</span>
              </>
            )}
          </Button>
        </div>

        {/* Tip */}
        <p className="text-xs text-center text-muted-foreground pb-4">
          {t.shareFooter || 'Share your progress on social media to inspire others!'}
        </p>
      </SheetContent>
    </Sheet>
  );
}

export default ShareModal;
