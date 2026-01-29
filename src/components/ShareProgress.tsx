import { Share2, Download, X, Sparkles, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useRef, useState } from 'react';

// Lazy load html2canvas (~480KB) only when needed
const getHtml2Canvas = async () => {
  const module = await import('html2canvas');
  return module.default;
};
import { formatDate } from '@/lib/utils';

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
  const [downloading, setDownloading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const format = 'square'; // Fixed square format only

  const handleShare = async () => {
    if (!cardRef.current) return;

    try {
      setDownloading(true);
      const scale = 2;
      const html2canvas = await getHtml2Canvas();
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: scale,
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      if (Capacitor.isNativePlatform()) {
        try {
          // Convert blob to base64
          const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              const result = reader.result as string;
              // Remove data:image/png;base64, prefix
              const base64 = result.split(',')[1];
              resolve(base64);
            };
          });

          // Save to cache directory
          const fileName = `zenflow-share-${Date.now()}.png`;
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          });

          // Share using file URI
          await Share.share({
            title: t.shareTitle || 'My ZenFlow Progress',
            text: `${stats.currentStreak} day streak! 🔥`,
            files: [savedFile.uri],
            dialogTitle: t.shareDialogTitle,
          });

          // Clean up cached file after sharing
          try {
            await Filesystem.deleteFile({
              path: fileName,
              directory: Directory.Cache,
            });
          } catch (cleanupError) {
            logger.warn('[ShareProgress] Failed to cleanup cached file:', cleanupError);
          }
        } catch (error) {
          logger.error('[ShareProgress] Native share failed:', error);
          setShareError(t.shareFailed);
          return; // Don't close dialog on error
        }
      } else {
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], 'zenflow-progress.png', { type: 'image/png' });
          await navigator.share({
            title: t.shareTitle || 'My ZenFlow Progress',
            text: `${stats.currentStreak} day streak! 🔥`,
            files: [file],
          });
        } else {
          downloadImage(blob);
        }
      }
      onClose();
    } catch (error) {
      logger.error('Share failed:', error);
      setShareError(t.shareFailed);
    } finally {
      setDownloading(false);
    }
  };

  const downloadImage = async (existingBlob?: Blob) => {
    if (!cardRef.current) return;

    setDownloading(true);
    try {
      let blob = existingBlob;
      if (!blob) {
        const scale = 2;
        const html2canvas = await getHtml2Canvas();
        const canvas = await html2canvas(cardRef.current, {
          backgroundColor: null,
          scale: scale,
        });
        blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/png');
        });
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `zenflow-${format}-${formatDate(new Date())}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  const progressPercent = stats.totalHabits > 0
    ? Math.round((stats.habitsCompleted / stats.totalHabits) * 100)
    : 0;

  // Generate achievement message and emoji
  const getAchievementData = () => {
    if (stats.currentStreak >= 30) return { emoji: '👑', text: t.shareAchievement30, subtext: t.shareSubtext30 };
    if (stats.currentStreak >= 14) return { emoji: '💎', text: t.shareAchievement14, subtext: t.shareSubtext14 };
    if (stats.currentStreak >= 7) return { emoji: '🔥', text: t.shareAchievement7, subtext: t.shareSubtext7 };
    if (stats.currentStreak >= 3) return { emoji: '⭐', text: t.shareAchievement3, subtext: t.shareSubtext3 };
    return { emoji: '🌱', text: t.shareAchievementStart, subtext: t.shareSubtextStart };
  };

  const achievement = getAchievementData();

  return (
    <div role="dialog" aria-modal="true" aria-label={t.shareTitle || 'Share Progress'} className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 pt-safe pb-safe animate-fade-in">
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label={t.close || 'Close'}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      <div className="w-full max-w-sm">
        {/* Share Card */}
        <div
          ref={cardRef}
          className="relative overflow-hidden aspect-square"
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            borderRadius: '24px',
          }}
        >
          {/* Animated gradient orbs */}
          <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full opacity-40"
            style={{ background: 'radial-gradient(circle, #4ade80 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, #22d3ee 0%, transparent 70%)' }} />
          <div className="absolute top-[40%] left-[60%] w-[40%] h-[40%] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }} />

          {/* Content */}
          <div className="relative z-10 h-full flex flex-col p-6 text-white">
            {/* Header */}
            <div className="flex items-center gap-3 mb-auto">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #4ade80, #22d3ee)' }}>
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">ZenFlow</h1>
                <p className="text-xs text-white/60">Wellness Journey</p>
              </div>
            </div>

            {/* Main Achievement */}
            <div className="text-center my-6">
              <div className="text-6xl mb-4">
                {achievement.emoji}
              </div>
              <h2 className="font-black text-3xl mb-2"
                style={{
                  background: 'linear-gradient(135deg, #4ade80, #22d3ee, #a78bfa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                {achievement.text}
              </h2>
              <p className="text-white/60 text-sm">{achievement.subtext}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Streak */}
              <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
                <div className="text-3xl font-black mb-1"
                  style={{
                    background: 'linear-gradient(135deg, #f97316, #ef4444)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                  {stats.currentStreak}
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">
                  {t.streakDays || 'Day Streak'}
                </div>
              </div>

              {/* Habits */}
              <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
                <div className="text-3xl font-black mb-1"
                  style={{
                    background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                  {progressPercent}%
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">
                  {t.habitsToday || 'Habits Done'}
                </div>
              </div>

              {/* Focus */}
              <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
                <div className="text-3xl font-black mb-1"
                  style={{
                    background: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                  {stats.focusMinutes}
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">
                  {t.focusMinutes || 'Focus Min'}
                </div>
              </div>

              {/* Level */}
              <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
                <div className="text-3xl font-black mb-1"
                  style={{
                    background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                  {stats.level}
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">
                  {t.level || 'Level'}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-4">
              <p className="text-xs text-white/40">zenflow.app</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {shareError && (
          <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-center animate-fade-in">
            <p className="text-red-400 text-sm">{shareError}</p>
            <button
              onClick={() => setShareError(null)}
              className="mt-2 text-xs text-red-300 underline"
            >
              {t.dismiss}
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => {
              setShareError(null);
              handleShare();
            }}
            disabled={downloading}
            className="flex-1 py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #4ade80, #22d3ee)' }}
          >
            {downloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t.generating || 'Generating...'}
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                {t.shareButton || 'Share'}
              </>
            )}
          </button>
          <button
            onClick={() => downloadImage()}
            disabled={downloading}
            className="py-4 px-6 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
