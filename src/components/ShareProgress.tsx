import { Share2, Download, X, Copy, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import html2canvas from 'html2canvas';
import { useRef, useState } from 'react';

interface ShareProgressProps {
  stats: {
    currentStreak: number;
    habitsCompleted: number;
    totalHabits: number;
    focusMinutes: number;
    level: number;
  };
  onClose: () => void;
}

export function ShareProgress({ stats, onClose }: ShareProgressProps) {
  const { t } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleShare = async (format: 'square' | 'story' = 'square') => {
    if (!cardRef.current) return;

    try {
      // Generate image from card with format-specific dimensions
      const scale = 2;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#1a1a2e',
        scale: scale,
        width: format === 'story' ? 1080 / scale : cardRef.current.offsetWidth,
        height: format === 'story' ? 1920 / scale : cardRef.current.offsetHeight,
        windowWidth: format === 'story' ? 1080 / scale : cardRef.current.offsetWidth,
        windowHeight: format === 'story' ? 1920 / scale : cardRef.current.offsetHeight,
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      if (Capacitor.isNativePlatform()) {
        // Native share on mobile
        const file = new File([blob], 'zenflow-progress.png', { type: 'image/png' });
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          await Share.share({
            title: t.shareTitle || 'My ZenFlow Progress',
            text: t.shareText || `${stats.currentStreak} day streak! 🔥`,
            url: base64,
            dialogTitle: t.shareDialogTitle || 'Share your progress',
          });
        };
      } else {
        // Web share or download
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], 'zenflow-progress.png', { type: 'image/png' });
          await navigator.share({
            title: t.shareTitle || 'My ZenFlow Progress',
            text: t.shareText || `${stats.currentStreak} day streak! 🔥`,
            files: [file],
          });
        } else {
          // Fallback: download image
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `zenflow-${format}-${new Date().toISOString().split('T')[0]}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }

      onClose();
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText('https://yehor212.github.io/people-first-app/');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleDownload = async (format: 'square' | 'story' = 'square') => {
    if (!cardRef.current) return;

    setDownloading(true);
    try {
      const scale = 2;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#1a1a2e',
        scale: scale,
        width: format === 'story' ? 1080 / scale : cardRef.current.offsetWidth,
        height: format === 'story' ? 1920 / scale : cardRef.current.offsetHeight,
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `zenflow-${format}-${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  const progressPercent = stats.totalHabits > 0
    ? Math.round((stats.habitsCompleted / stats.totalHabits) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md">
        {/* Share Card - This will be captured as image */}
        <div
          ref={cardRef}
          className="zen-gradient-hero rounded-3xl p-8 mb-4 relative overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 zen-gradient rounded-full blur-3xl opacity-20" />
          <div className="absolute bottom-0 left-0 w-40 h-40 zen-gradient-sunset rounded-full blur-3xl opacity-20" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 zen-gradient-calm rounded-full blur-3xl opacity-10" />

          {/* Content */}
          <div className="relative z-10">
            {/* Logo */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="w-8 h-8 zen-gradient rounded-xl" />
                <span className="text-2xl font-bold zen-text-gradient">{t.appName}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t.shareSubtitle || 'My Wellness Journey'}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-card/80 backdrop-blur rounded-2xl p-4 text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {stats.currentStreak}
                </div>
                <div className="text-xs text-muted-foreground">{t.streakDays}</div>
              </div>

              <div className="bg-card/80 backdrop-blur rounded-2xl p-4 text-center">
                <div className="text-3xl font-bold text-accent mb-1">
                  {progressPercent}%
                </div>
                <div className="text-xs text-muted-foreground">{t.habitsToday}</div>
              </div>

              <div className="bg-card/80 backdrop-blur rounded-2xl p-4 text-center">
                <div className="text-3xl font-bold text-mood-good mb-1">
                  {stats.focusMinutes}
                </div>
                <div className="text-xs text-muted-foreground">{t.focusToday}</div>
              </div>

              <div className="bg-card/80 backdrop-blur rounded-2xl p-4 text-center">
                <div className="text-3xl font-bold zen-text-gradient mb-1">
                  {stats.level}
                </div>
                <div className="text-xs text-muted-foreground">{t.level || 'Level'}</div>
              </div>
            </div>

            {/* Achievement Message */}
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground mb-1">
                {stats.currentStreak >= 7
                  ? t.shareAchievement7 || '🔥 7+ Day Streak!'
                  : stats.currentStreak >= 3
                  ? t.shareAchievement3 || '⭐ 3+ Day Streak!'
                  : t.shareAchievementStart || '🌱 Building Habits!'}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.shareFooter || 'Track your wellness with ZenFlow'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-card rounded-2xl p-4 zen-shadow-card space-y-3">
          {/* Share to social media */}
          <button
            onClick={() => handleShare('square')}
            className="btn-press w-full py-3 zen-gradient text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Share2 className="w-5 h-5" />
            {t.shareButton || 'Share Progress'}
          </button>

          {/* Format-specific downloads */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleDownload('square')}
              disabled={downloading}
              className="btn-press py-3 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              <Download className="w-4 h-4" />
              {t.shareSquare || 'Post 1:1'}
            </button>
            <button
              onClick={() => handleDownload('story')}
              disabled={downloading}
              className="btn-press py-3 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              <Download className="w-4 h-4" />
              {t.shareStory || 'Story 9:16'}
            </button>
          </div>

          {/* Helper text */}
          <p className="text-xs text-center text-muted-foreground">
            {t.shareFormatHint || '📱 Story format for Instagram/TikTok • Post format for feeds'}
          </p>

          <button
            onClick={handleCopyLink}
            className="btn-press w-full py-3 bg-background text-foreground font-medium rounded-xl hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5" />
                {t.shareCopied || 'Copied!'}
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                {t.shareCopyLink || 'Copy Link'}
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="btn-press w-full py-3 bg-secondary/50 text-secondary-foreground font-medium rounded-xl hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
