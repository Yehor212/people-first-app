/**
 * GardenStageLabel - Small badge showing the current garden stage and plant count.
 * Color-coded by stage for quick visual identification.
 */

import { memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { GardenStage } from '@/types';

interface GardenStageLabelProps {
  stage: GardenStage;
  plantCount: number;
}

const STAGE_STYLES: Record<GardenStage, string> = {
  empty: 'bg-gray-500/15 text-gray-500 border-gray-500/30',
  sprouting: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
  growing: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  flourishing: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  magical: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  legendary: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
};

const STAGE_EMOJIS: Record<GardenStage, string> = {
  empty: '\u{1F3DC}\u{FE0F}',
  sprouting: '\u{1F33F}',
  growing: '\u{1F331}',
  flourishing: '\u{1F338}',
  magical: '\u{2728}',
  legendary: '\u{1F451}',
};

export const GardenStageLabel = memo(function GardenStageLabel({
  stage,
  plantCount,
}: GardenStageLabelProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const stageNames: Record<GardenStage, string> = {
    empty: ts.gardenStageEmpty || 'Empty',
    sprouting: ts.gardenStageSprouting || 'Sprouting',
    growing: ts.gardenStageGrowing || 'Growing',
    flourishing: ts.gardenStageFlourishing || 'Flourishing',
    magical: ts.gardenStageMagical || 'Magical',
    legendary: ts.gardenStageLegendary || 'Legendary',
  };

  const plantsLabel = ts.gardenPlants || 'plants';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border',
        STAGE_STYLES[stage]
      )}
    >
      <span aria-hidden="true">{STAGE_EMOJIS[stage]}</span>
      <span>{stageNames[stage]}</span>
      <span className="opacity-60" aria-hidden="true">{'\u00B7'}</span>
      <span>{plantCount} {plantsLabel}</span>
    </span>
  );
});

export default GardenStageLabel;
