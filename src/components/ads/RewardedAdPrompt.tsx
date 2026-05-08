/**
 * RewardedAdPrompt — opt-in "Watch to earn" button
 *
 * Non-intrusive: only renders when ads are available AND allowed.
 * User must explicitly tap to watch. Never auto-plays.
 */

import { useState } from 'react';
import { Play, Gift, Loader2 } from 'lucide-react';
import { useAds } from '@/contexts/AdContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface RewardedAdPromptProps {
  /** Context where the prompt is shown */
  context: 'daily_rewards' | 'post_focus' | 'companion' | 'general';
  /** Custom CTA label override */
  ctaLabel?: string;
  /** Custom reward description override */
  rewardLabel?: string;
  /** Callback after successful reward */
  onRewarded?: (treats: number) => void;
  /** Compact mode (smaller button) */
  compact?: boolean;
  /** Additional CSS class */
  className?: string;
}

export function RewardedAdPrompt({
  context,
  ctaLabel,
  rewardLabel,
  onRewarded,
  compact = false,
  className,
}: RewardedAdPromptProps) {
  const { adsAvailable, canShowRewarded, watchRewardedAd, rewardTreats, remainingToday } = useAds();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [justRewarded, setJustRewarded] = useState(false);

  // Don't render if ads aren't available or can't show
  if (!adsAvailable || !canShowRewarded || justRewarded) return null;

  const handleWatch = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const earned = await watchRewardedAd();
      if (earned) {
        setJustRewarded(true);
        onRewarded?.(rewardTreats);
      }
    } finally {
      setLoading(false);
    }
  };

  const defaultCtaLabel = t.adWatchToEarn || 'Watch to earn';
  const defaultRewardLabel = `+${rewardTreats} ${t.treats || 'treats'}`;

  const contextIcon = context === 'daily_rewards' ? (
    <Gift className={cn(compact ? 'w-4 h-4' : 'w-5 h-5')} />
  ) : (
    <Play className={cn(compact ? 'w-4 h-4' : 'w-5 h-5')} />
  );

  if (compact) {
    return (
      <button
        onClick={handleWatch}
        disabled={loading}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium motion-safe:transition-all',
          'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95',
          loading && 'opacity-50',
          className,
        )}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : contextIcon}
        <span>{ctaLabel || defaultCtaLabel}</span>
        <span className="font-bold">{rewardLabel || defaultRewardLabel}</span>
      </button>
    );
  }

  return (
    <div className={cn(
      'bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl p-4 border border-amber-500/20',
      className,
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-amber-500/20 rounded-xl shrink-0">
            {contextIcon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {ctaLabel || defaultCtaLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              {rewardLabel || defaultRewardLabel}
              {remainingToday > 0 && ` · ${remainingToday} ${t.adRemaining || 'left today'}`}
            </p>
          </div>
        </div>

        <button
          onClick={handleWatch}
          disabled={loading}
          className={cn(
            'shrink-0 px-4 py-2 rounded-xl font-medium text-sm motion-safe:transition-all',
            'bg-amber-500 text-white hover:bg-amber-600 active:scale-95',
            loading && 'opacity-50',
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <span className="flex items-center gap-1.5">
              <Play className="w-4 h-4" aria-hidden="true" />
              {t.adWatch || 'Watch'}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
