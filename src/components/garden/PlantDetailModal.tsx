/**
 * PlantDetailModal - Full-screen overlay modal showing detailed info about a garden plant.
 * Displays plant emoji, type, growth stage, progress bar, source activity, and water action.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useBackHandler } from '@/hooks/useBackHandler';
import { hapticTap } from '@/lib/haptics';
import { GROWTH_THRESHOLDS } from '@/lib/innerWorldConstants';
import { cn } from '@/lib/utils';
import type { GardenPlant, PlantStage } from '@/types';

interface PlantDetailModalProps {
  plant: GardenPlant;
  treatsBalance: number;
  waterCost?: number;
  onWater: () => void;
  onClose: () => void;
  getPlantEmoji: (plant: GardenPlant) => string;
}

const STAGE_ORDER: PlantStage[] = ['seed', 'sprout', 'growing', 'blooming', 'magnificent'];

function getNextThreshold(stage: PlantStage): number {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < STAGE_ORDER.length - 1) {
    return GROWTH_THRESHOLDS[STAGE_ORDER[idx + 1]];
  }
  return GROWTH_THRESHOLDS.magnificent;
}

export const PlantDetailModal = memo(function PlantDetailModal({
  plant,
  treatsBalance,
  waterCost = 3,
  onWater,
  onClose,
  getPlantEmoji,
}: PlantDetailModalProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  // State declarations BEFORE hooks (TDZ prevention)
  const canWater = treatsBalance >= waterCost;

  useScrollLock(true);
  useBackHandler(true, onClose);

  const daysAgo = useMemo(() => {
    return Math.floor((Date.now() - plant.plantedAt) / (1000 * 60 * 60 * 24));
  }, [plant.plantedAt]);

  const currentThreshold = GROWTH_THRESHOLDS[plant.stage];
  const nextThreshold = getNextThreshold(plant.stage);
  const isMaxStage = plant.stage === 'magnificent';
  const progressPercent = isMaxStage
    ? 100
    : Math.min(100, Math.max(0, ((plant.growthPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100));

  const stageLabel = ts[`plantStage_${plant.stage}`] || plant.stage;
  const typeLabel = ts[`plantType_${plant.type}`] || plant.type;
  const sourceLabel = ts[`gardenSource_${plant.sourceActivity}`] || plant.sourceActivity;

  const handleWater = () => {
    if (!canWater) return;
    hapticTap().catch(() => {});
    onWater();
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[61] max-w-md mx-auto rounded-3xl bg-card border border-border/50 shadow-xl overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label={ts.close || 'Close'}
          className="absolute top-3 end-3 p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors z-10"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="p-6 text-center">
          {/* Plant emoji */}
          <span className="text-7xl block mb-4 motion-safe:animate-bounce" aria-hidden="true">
            {getPlantEmoji(plant)}
          </span>

          {/* Type name + special badge */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-foreground capitalize">{typeLabel}</h2>
            {plant.isSpecial && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/30">
                {ts.gardenSpecial || 'Special'}
              </span>
            )}
          </div>

          {/* Stage name */}
          <p className="text-sm text-muted-foreground capitalize mb-4">{stageLabel}</p>

          {/* Growth progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{ts.gardenGrowth || 'Growth'}</span>
              <span>{plant.growthPoints} / {isMaxStage ? plant.growthPoints : nextThreshold}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-6">
            <span>
              {ts.gardenPlantedAgo || 'Planted'} {daysAgo} {daysAgo === 1 ? (ts.dayAgo || 'day ago') : (ts.daysAgo || 'days ago')}
            </span>
            <span className="opacity-40" aria-hidden="true">{'\u00B7'}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/50 capitalize">
              {sourceLabel}
            </span>
          </div>

          {/* Water action */}
          <button
            onClick={handleWater}
            disabled={!canWater}
            className={cn(
              'w-full py-3 rounded-2xl font-semibold text-sm transition-all',
              canWater
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 motion-safe:active:scale-[0.98]'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
            )}
          >
            {'\u{1F4A7}'} {ts.gardenWaterPlant || 'Water Plant'} ({waterCost} {ts.gardenTreats || 'treats'})
          </button>
        </div>
      </motion.div>
    </>
  );
});

export default PlantDetailModal;
