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

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.split(`{${key}}`).join(String(value)),
    template,
  );
}

interface RewardedAdPromptProps {
  /** Context where the prompt is shown */
  context: 'daily_rewards' | 'post_focus' | 'companion' | 'optional_rewards';
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
  const { adsAvailable, canShowRewarded, watchRewardedAd, rewardTreats } = useAds();
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string | undefined>;
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

  const defaultCtaLabel = tx.adWatchToEarn || 'Optional ad: watch for a small bonus';
  const defaultRewardLabel = formatTemplate(
    tx.adRewardLabel || '+{treats} treats',
    { treats: rewardTreats },
  );
  const watchLabel = tx.adWatch || 'Watch optional ad';
  const resolvedCtaLabel = ctaLabel || defaultCtaLabel;
  const resolvedRewardLabel = rewardLabel || defaultRewardLabel;

  const contextIcon = context === 'daily_rewards' ? (
    <Gift className={cn(compact ? 'w-4 h-4' : 'w-5 h-5')} />
  ) : (
    <Play className={cn(compact ? 'w-4 h-4' : 'w-5 h-5')} />
  );

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleWatch}
        disabled={loading}
        aria-busy={loading ? 'true' : undefined}
        aria-label={`${resolvedCtaLabel}. ${resolvedRewardLabel}`}
        className={cn(
          'flex min-h-[44px] items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium motion-safe:transition-all',
          'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95',
          loading && 'opacity-50',
          className,
        )}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : contextIcon}
        <span>{resolvedCtaLabel}</span>
        <span className="font-bold">{resolvedRewardLabel}</span>
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
              {resolvedCtaLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              {resolvedRewardLabel}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleWatch}
          disabled={loading}
          aria-busy={loading ? 'true' : undefined}
          aria-label={`${resolvedCtaLabel}. ${resolvedRewardLabel}`}
          className={cn(
            'min-h-[44px] shrink-0 px-4 py-2 rounded-xl font-medium text-sm motion-safe:transition-all',
            'bg-amber-500 text-white hover:bg-amber-600 active:scale-95',
            loading && 'opacity-50',
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <span className="flex items-center gap-1.5">
              <Play className="w-4 h-4" aria-hidden="true" />
              {watchLabel}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
