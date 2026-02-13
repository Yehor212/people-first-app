/**
 * EmptyGardenPrompt - Shown when the garden has no plants yet.
 * Encourages the user to plant their first seed using treats.
 */

import { memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface EmptyGardenPromptProps {
  onPlantSeed: () => void;
  treatsBalance: number;
}

export const EmptyGardenPrompt = memo(function EmptyGardenPrompt({
  onPlantSeed,
  treatsBalance,
}: EmptyGardenPromptProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {/* Garden emoji */}
      <span
        className="text-7xl mb-6 block motion-safe:animate-bounce"
        role="img"
        aria-hidden="true"
      >
        {'\u{1F331}'}
      </span>

      {/* Title */}
      <h2 className="text-xl font-bold text-foreground mb-2">
        {ts.gardenEmptyTitle || 'Your Garden Awaits'}
      </h2>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        {ts.gardenEmptyDescription || 'Earn treats by logging moods, completing habits, and finishing focus sessions. Then plant your first seed!'}
      </p>

      {/* Treats balance hint */}
      <p className="text-xs text-muted-foreground mb-4">
        {ts.gardenTreatsBalance || 'Treats'}: <span className="font-semibold text-foreground">{treatsBalance}</span>
      </p>

      {/* CTA button */}
      <button
        onClick={onPlantSeed}
        disabled={treatsBalance < 5}
        className={cn(
          'px-6 py-3 rounded-2xl font-semibold text-white transition-all',
          'bg-gradient-to-r from-green-500 to-emerald-500',
          'hover:from-green-600 hover:to-emerald-600',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'motion-safe:active:scale-95'
        )}
      >
        {ts.gardenPlantFirstSeed || 'Plant Your First Seed'}
      </button>
    </div>
  );
});

export default EmptyGardenPrompt;
