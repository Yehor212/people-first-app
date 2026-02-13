/**
 * TreatsBar - Horizontal bar at the top of the garden showing treats balance
 * and quick-action buttons for planting, watering, and feeding.
 */

import { memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface TreatsBarProps {
  treatsBalance: number;
  onPlantSeed: () => void;
  onWaterPlants: () => void;
  onFeedCreatures: () => void;
  plantCost?: number;
  waterCost?: number;
  feedCost?: number;
}

export const TreatsBar = memo(function TreatsBar({
  treatsBalance,
  onPlantSeed,
  onWaterPlants,
  onFeedCreatures,
  plantCost = 5,
  waterCost = 3,
  feedCost = 2,
}: TreatsBarProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const actions = [
    {
      key: 'plant',
      emoji: '\u{1F331}',
      label: ts.gardenActionPlant || 'Plant',
      cost: plantCost,
      onClick: onPlantSeed,
    },
    {
      key: 'water',
      emoji: '\u{1F4A7}',
      label: ts.gardenActionWater || 'Water All',
      cost: waterCost,
      onClick: onWaterPlants,
    },
    {
      key: 'feed',
      emoji: '\u{1F356}',
      label: ts.gardenActionFeed || 'Feed',
      cost: feedCost,
      onClick: onFeedCreatures,
    },
  ];

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
      {/* Treats balance */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span aria-hidden="true">{'\u2728'}</span>
        <span className="text-sm font-bold text-foreground">{treatsBalance}</span>
        <span className="text-xs text-muted-foreground truncate">
          {ts.gardenTreats || 'treats'}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        {actions.map((action) => {
          const disabled = treatsBalance < action.cost;

          return (
            <button
              key={action.key}
              onClick={action.onClick}
              disabled={disabled}
              aria-label={`${action.label} (${action.cost} ${ts.gardenTreats || 'treats'})`}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all',
                'border border-border/50',
                disabled
                  ? 'opacity-40 cursor-not-allowed bg-muted/30'
                  : 'bg-card hover:bg-accent/50 motion-safe:active:scale-95'
              )}
            >
              <span aria-hidden="true">{action.emoji}</span>
              <span className="hidden sm:inline">{action.label}</span>
              <span className="text-muted-foreground">{action.cost}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default TreatsBar;
