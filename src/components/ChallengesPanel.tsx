import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Trophy, Target, Lock, CheckCircle2, Plus, X, Share2, Download, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocale } from '@/lib/timeUtils';
import { Challenge, Badge } from '@/types';
import { challengeTemplates, createChallengeFromTemplate } from '@/lib/challenges';
import { badgeDefinitions, getBadgeById, getRarityColor, getRarityGradient } from '@/lib/badges';
import { hapticTap } from '@/lib/haptics';
import { VirtualGrid, shouldVirtualize } from '@/components/ui/virtual-list';
import { EmojiOrIcon } from '@/components/icons';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { logger } from '@/lib/logger';
import { useBackHandler } from '@/hooks/useBackHandler';

// Lazy load html2canvas
const getHtml2Canvas = async () => {
  const module = await import('html2canvas');
  return module.default;
};

interface ChallengesPanelProps {
  activeChallenges: Challenge[];
  badges: Badge[];
  onStartChallenge: (challenge: Challenge) => void;
  onClose: () => void;
}

export function ChallengesPanel({
  activeChallenges,
  badges,
  onStartChallenge,
  onClose
}: ChallengesPanelProps) {
  const { t, language } = useLanguage();
  const [selectedTab, setSelectedTab] = useState<'active' | 'available' | 'badges'>('active');
  const [showShareDialog, setShowShareDialog] = useState(false);

  useBackHandler(showShareDialog, () => setShowShareDialog(false));
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const handleShareBadge = (badge: Badge) => {
    hapticTap();
    setSelectedBadge(badge);
    setShowShareDialog(true);
    setShareError(null);
  };

  const handleShare = async () => {
    if (!shareCardRef.current || !selectedBadge) return;

    try {
      setIsSharing(true);
      setShareError(null);
      const html2canvas = await getHtml2Canvas();
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 2,
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });

      if (Capacitor.isNativePlatform()) {
        try {
          const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
          });

          const fileName = `zenflow-badge-${Date.now()}.png`;
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          });

          await Share.share({
            title: selectedBadge.title[language] || 'Badge Unlocked!',
            text: `${selectedBadge.title[language]} - ZenFlow Achievement! 🏆`,
            files: [savedFile.uri],
            dialogTitle: t.shareDialogTitle,
          });

          try {
            await Filesystem.deleteFile({ path: fileName, directory: Directory.Cache });
          } catch (e) {
            logger.warn('[ChallengesPanel] Cleanup failed:', e);
          }
        } catch (error) {
          logger.error('[ChallengesPanel] Native share failed:', error);
          setShareError(t.shareFailed || 'Share failed');
          // P1 Fix: Show toast for better visibility
          toast.error(t.shareFailed || 'Share failed');
          return;
        }
      } else {
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], 'zenflow-badge.png', { type: 'image/png' });
          await navigator.share({
            title: selectedBadge.title[language] || 'Badge Unlocked!',
            text: `${selectedBadge.title[language]} - ZenFlow Achievement! 🏆`,
            files: [file],
          });
        } else {
          downloadImage(blob);
        }
      }
      setShowShareDialog(false);
    } catch (error) {
      logger.error('[ChallengesPanel] Share failed:', error);
      setShareError(t.shareFailed || 'Share failed');
      // P1 Fix: Show toast for better visibility
      toast.error(t.shareFailed || 'Share failed');
    } finally {
      setIsSharing(false);
    }
  };

  const downloadImage = async (existingBlob?: Blob) => {
    if (!shareCardRef.current) return;
    setIsSharing(true);
    try {
      let blob = existingBlob;
      if (!blob) {
        const html2canvas = await getHtml2Canvas();
        const canvas = await html2canvas(shareCardRef.current, { backgroundColor: null, scale: 2 });
        blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `zenflow-badge-${selectedBadge?.id || 'achievement'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('[ChallengesPanel] Download failed:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const getProgressPercent = (challenge: Challenge) => {
    return Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
  };

  const getChallengeTypeIcon = (type: Challenge['type']) => {
    switch (type) {
      case 'streak': return '🔥';
      case 'focus': return '🎯';
      case 'gratitude': return '🙏';
      case 'total': return '💪';
      default: return '⭐';
    }
  };

  const getChallengeTypeLabel = (type: Challenge['type']) => {
    switch (type) {
      case 'streak': return t.challengeTypeStreak || 'Streak';
      case 'focus': return t.challengeTypeFocus || 'Focus';
      case 'gratitude': return t.challengeTypeGratitude || 'Gratitude';
      case 'total': return t.challengeTypeTotal || 'Total';
      default: return 'Challenge';
    }
  };

  const isTemplateActive = (templateIndex: number) => {
    const template = challengeTemplates[templateIndex];
    return activeChallenges.some(
      c => c.type === template.type &&
           c.target === template.target &&
           !c.completed
    );
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="challenges-title" className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-card rounded-3xl zen-shadow-card overflow-hidden">
        {/* Header */}
        <div className="zen-gradient p-6 flex items-center justify-between">
          <div>
            <h2 id="challenges-title" className="text-2xl font-bold text-primary-foreground mb-1">
              {t.challengesTitle || 'Challenges & Badges'}
            </h2>
            <p className="text-sm text-primary-foreground/80">
              {t.challengesSubtitle || 'Take on challenges and earn badges'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.close || 'Close'}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6 text-primary-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 border-b border-border overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedTab('active')}
            className={`flex-shrink-0 py-2.5 px-3 rounded-xl font-medium text-sm transition-all ${
              selectedTab === 'active'
                ? 'bg-primary text-primary-foreground zen-shadow'
                : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Target className="w-4 h-4" />
              {t.activeChallenges || 'Active'}
              {activeChallenges.length > 0 && (
                <span className="bg-primary-foreground/20 px-1.5 py-0.5 rounded-full text-xs">
                  {activeChallenges.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setSelectedTab('available')}
            className={`flex-shrink-0 py-2.5 px-3 rounded-xl font-medium text-sm transition-all ${
              selectedTab === 'available'
                ? 'bg-primary text-primary-foreground zen-shadow'
                : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" />
              {t.availableChallenges || 'Available'}
            </div>
          </button>
          <button
            onClick={() => setSelectedTab('badges')}
            className={`flex-shrink-0 py-2.5 px-3 rounded-xl font-medium text-sm transition-all ${
              selectedTab === 'badges'
                ? 'bg-primary text-primary-foreground zen-shadow'
                : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Trophy className="w-4 h-4" />
              {t.badges || 'Badges'}
              {badges.filter(b => b.unlocked).length > 0 && (
                <span className="bg-primary-foreground/20 px-1.5 py-0.5 rounded-full text-xs">
                  {badges.filter(b => b.unlocked).length}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Active Challenges Tab */}
          {selectedTab === 'active' && (
            <>
              {activeChallenges.length === 0 ? (
                <EmptyState
                  icon={<Trophy className="w-6 h-6 text-primary" />}
                  title={t.noChallengesActive || 'No Active Challenges'}
                  message={t.noChallengesActiveHint || 'Start a challenge to track your progress'}
                  action={{
                    label: t.availableChallenges || 'Browse Challenges',
                    onClick: () => setSelectedTab('available'),
                  }}
                />
              ) : (
                activeChallenges.map((challenge) => {
                  const progressPercent = getProgressPercent(challenge);
                  const badge = challenge.reward ? getBadgeById(challenge.reward) : undefined;

                  return (
                    <div
                      key={challenge.id}
                      className="bg-secondary rounded-2xl p-4 zen-shadow-card hover:zen-shadow-hover transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">{challenge.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-semibold text-foreground">
                                {challenge.title[language]}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {challenge.description[language]}
                              </p>
                            </div>
                            <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                              {getChallengeTypeLabel(challenge.type)}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="mt-3 mb-2">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-muted-foreground">
                                {t.progress || 'Progress'}
                              </span>
                              <span className="font-semibold text-foreground">
                                {challenge.progress} / {challenge.target}
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full zen-gradient transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>

                          {/* Reward Badge */}
                          {badge && (
                            <div className="flex items-center gap-2 mt-3 p-2 bg-card rounded-xl">
                              <EmojiOrIcon emoji={badge.icon} iconName={badge.iconName} size="md" />
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground">
                                  {t.reward || 'Reward'}
                                </p>
                                <p className={`text-sm font-semibold ${getRarityColor(badge.rarity)}`}>
                                  {badge.title[language]}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* Available Challenges Tab */}
          {selectedTab === 'available' && (
            <>
              {challengeTemplates.map((template, index) => {
                const isActive = isTemplateActive(index);
                const badge = template.reward ? getBadgeById(template.reward) : undefined;

                return (
                  <div
                    key={index}
                    className={`bg-secondary rounded-2xl p-4 zen-shadow-card transition-all ${
                      isActive ? 'opacity-50' : 'hover:zen-shadow-hover'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{template.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-foreground">
                              {template.title[language]}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {template.description[language]}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                            {getChallengeTypeLabel(template.type)}
                          </span>
                        </div>

                        {/* Target */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Target className="w-4 h-4" />
                          <span>
                            {t.target || 'Target'}: <span className="font-semibold text-foreground">{template.target}</span>
                          </span>
                        </div>

                        {/* Reward Badge */}
                        {badge && (
                          <div className="flex items-center gap-2 mb-3 p-2 bg-card rounded-xl">
                            <EmojiOrIcon emoji={badge.icon} iconName={badge.iconName} size="md" />
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground">
                                {t.reward || 'Reward'}
                              </p>
                              <p className={`text-sm font-semibold ${getRarityColor(badge.rarity)}`}>
                                {badge.title[language]}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Start Button */}
                        <button
                          onClick={() => {
                            if (!isActive) {
                              const newChallenge = createChallengeFromTemplate(index);
                              onStartChallenge(newChallenge);
                            }
                          }}
                          disabled={isActive}
                          className={`w-full py-2 rounded-xl font-medium transition-all ${
                            isActive
                              ? 'bg-muted text-muted-foreground cursor-not-allowed'
                              : 'bg-primary text-primary-foreground hover:opacity-90 zen-shadow'
                          }`}
                        >
                          {isActive ? (
                            <span className="flex items-center justify-center gap-2">
                              <CheckCircle2 className="w-4 h-4" />
                              {t.challengeActive || 'Active'}
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <Plus className="w-4 h-4" />
                              {t.startChallenge || 'Start Challenge'}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Badges Tab */}
          {selectedTab === 'badges' && (
            <>
              {shouldVirtualize(badges.length) ? (
                // Use virtualized grid for large badge lists
                <VirtualGrid
                  items={badges}
                  columns={2}
                  itemHeight={180}
                  gap={12}
                  containerClassName="h-full"
                  getItemKey={(badge) => badge.id}
                  renderItem={(badge) => (
                    <div
                      className={`relative bg-secondary rounded-2xl p-4 zen-shadow-card transition-all h-full ${
                        badge.unlocked ? 'hover:zen-shadow-hover' : 'opacity-50'
                      }`}
                    >
                      {badge.unlocked && (
                        <button
                          onClick={() => handleShareBadge(badge)}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          aria-label={t.shareButton || 'Share'}
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="text-center">
                        <div className={`flex items-center justify-center mb-3 ${!badge.unlocked && 'grayscale'}`}>
                          {badge.unlocked ? (
                            <EmojiOrIcon emoji={badge.icon} iconName={badge.iconName} size="xl" />
                          ) : (
                            <Lock className="w-12 h-12 text-muted-foreground" />
                          )}
                        </div>
                        <h3 className={`font-semibold mb-1 ${badge.unlocked ? getRarityColor(badge.rarity) : 'text-muted-foreground'}`}>
                          {badge.title[language]}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {badge.description[language]}
                        </p>
                        {badge.unlocked && badge.unlockedDate && (
                          <p className="text-xs text-primary">
                            {new Date(badge.unlockedDate).toLocaleDateString(getLocale(language))}
                          </p>
                        )}
                        {!badge.unlocked && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {t.requirement || 'Requirement'}: {badge.requirement}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                />
              ) : (
                // Regular grid for small badge lists
                <div className="grid grid-cols-2 gap-3">
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`relative bg-secondary rounded-2xl p-4 zen-shadow-card transition-all ${
                        badge.unlocked ? 'hover:zen-shadow-hover' : 'opacity-50'
                      }`}
                    >
                      {badge.unlocked && (
                        <button
                          onClick={() => handleShareBadge(badge)}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          aria-label={t.shareButton || 'Share'}
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="text-center">
                        <div className={`flex items-center justify-center mb-3 ${!badge.unlocked && 'grayscale'}`}>
                          {badge.unlocked ? (
                            <EmojiOrIcon emoji={badge.icon} iconName={badge.iconName} size="xl" />
                          ) : (
                            <Lock className="w-12 h-12 text-muted-foreground" />
                          )}
                        </div>
                        <h3 className={`font-semibold mb-1 ${badge.unlocked ? getRarityColor(badge.rarity) : 'text-muted-foreground'}`}>
                          {badge.title[language]}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-2">
                          {badge.description[language]}
                        </p>
                        {badge.unlocked && badge.unlockedDate && (
                          <p className="text-xs text-primary">
                            {new Date(badge.unlockedDate).toLocaleDateString(getLocale(language))}
                          </p>
                        )}
                        {!badge.unlocked && (
                          <p className="text-xs text-muted-foreground">
                            {t.requirement || 'Requirement'}: {badge.requirement}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Inline Share Dialog for badges */}
      {showShareDialog && selectedBadge && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-4 animate-fade-in">
          {/* Close button */}
          <button
            onClick={() => setShowShareDialog(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div className="w-full max-w-sm">
            {/* Share Card */}
            <div
              ref={shareCardRef}
              className="relative overflow-hidden aspect-square"
              style={{
                background: `linear-gradient(135deg, ${getRarityGradient(selectedBadge.rarity)})`,
                borderRadius: '24px',
              }}
            >
              {/* Decorative elements */}
              <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full opacity-30"
                style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
              <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-20"
                style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col items-center justify-center p-6 text-white">
                {/* Header */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold opacity-80">ZenFlow</span>
                </div>

                {/* Badge Icon */}
                <div className="text-8xl mb-4">
                  <EmojiOrIcon emoji={selectedBadge.icon} iconName={selectedBadge.iconName} size="xl" />
                </div>

                {/* Badge Title */}
                <h2 className="font-black text-2xl text-center mb-2 drop-shadow-lg">
                  {selectedBadge.title[language]}
                </h2>

                {/* Badge Description */}
                <p className="text-white/80 text-center text-sm max-w-[80%] mb-4">
                  {selectedBadge.description[language]}
                </p>

                {/* Rarity Badge */}
                <div className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {selectedBadge.rarity}
                  </span>
                </div>

                {/* Unlock Date */}
                {selectedBadge.unlockedDate && (
                  <p className="absolute bottom-4 text-xs text-white/60">
                    {new Date(selectedBadge.unlockedDate).toLocaleDateString(getLocale(language))}
                  </p>
                )}
              </div>
            </div>

            {/* Error Message */}
            {shareError && (
              <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-center">
                <p className="text-red-400 text-sm">{shareError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="flex-1 py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 bg-white text-slate-900"
              >
                {isSharing ? (
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
                disabled={isSharing}
                className="py-4 px-6 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
