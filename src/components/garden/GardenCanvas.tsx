/**
 * GardenCanvas - The visual garden scene renderer.
 * Renders plants and creatures in a responsive CSS Grid of card tiles
 * with seasonal backgrounds, weather effects, and interactive elements.
 */

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { WeatherOverlay } from './WeatherOverlay';
import { GardenStageLabel } from './GardenStageLabel';
import { GROWTH_THRESHOLDS } from '@/lib/innerWorldConstants';
import type {
  GardenPlant,
  GardenCreature,
  GardenWeather,
  GardenStage,
  PlantStage,
  Season,
} from '@/types';

interface GardenCanvasProps {
  plants: GardenPlant[];
  creatures: GardenCreature[];
  weather: GardenWeather;
  season: Season;
  gardenStage: GardenStage;
  onSelectPlant: (plant: GardenPlant) => void;
  onSelectCreature: (creature: GardenCreature) => void;
  getPlantEmoji: (plant: GardenPlant) => string;
  getCreatureEmoji: (creature: GardenCreature) => string;
}

/**
 * Season-specific background gradient classes.
 * spring  = green
 * summer  = amber/gold
 * autumn  = orange/brown
 * winter  = blue/slate
 */
const SEASON_GRADIENTS: Record<Season, string> = {
  spring: 'from-green-200/80 via-emerald-100/60 to-green-50/40 dark:from-green-900/40 dark:via-emerald-900/30 dark:to-green-950/20',
  summer: 'from-amber-200/80 via-yellow-100/60 to-amber-50/40 dark:from-amber-900/40 dark:via-yellow-900/30 dark:to-amber-950/20',
  autumn: 'from-orange-200/80 via-amber-100/60 to-orange-50/40 dark:from-orange-900/40 dark:via-amber-900/30 dark:to-orange-950/20',
  winter: 'from-blue-200/80 via-slate-100/60 to-blue-50/40 dark:from-blue-900/40 dark:via-slate-900/30 dark:to-blue-950/20',
};

const STAGE_ORDER: PlantStage[] = ['seed', 'sprout', 'growing', 'blooming', 'magnificent'];

function getGrowthPercent(plant: GardenPlant): number {
  const idx = STAGE_ORDER.indexOf(plant.stage);
  if (plant.stage === 'magnificent') return 100;
  const current = GROWTH_THRESHOLDS[plant.stage];
  const next = GROWTH_THRESHOLDS[STAGE_ORDER[idx + 1]];
  return Math.min(100, Math.max(0, ((plant.growthPoints - current) / (next - current)) * 100));
}

export const GardenCanvas = memo(function GardenCanvas({
  plants,
  creatures,
  weather,
  season,
  gardenStage,
  onSelectPlant,
  onSelectCreature,
  getPlantEmoji,
  getCreatureEmoji,
}: GardenCanvasProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  // Memoize the scene aria-label so it only recalculates on language change
  const sceneLabel = useMemo(() => ts.gardenScene || 'World scene', [ts.gardenScene]);

  return (
    <div
      className="relative w-full min-h-[200px] rounded-2xl overflow-hidden border border-border/30 shadow-sm"
      role="region"
      aria-label={sceneLabel}
    >
      {/* Season background gradient */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-b transition-colors duration-1000',
          SEASON_GRADIENTS[season]
        )}
        aria-hidden="true"
      />

      {/* Weather overlay (particles) */}
      <WeatherOverlay weather={weather} />

      {/* Header: stage label */}
      <div className="relative z-10 px-3 pt-3">
        <GardenStageLabel stage={gardenStage} plantCount={plants.length} />
      </div>

      {/* Plants grid */}
      <div className="relative z-10 grid grid-cols-3 sm:grid-cols-4 gap-2 p-3">
        {plants.map((plant) => {
          const stageLabel = ts[`plantStage_${plant.stage}`] || plant.stage;
          const typeLabel = ts[`plantType_${plant.type}`] || plant.type;
          const growthPercent = getGrowthPercent(plant);

          return (
            <button
              key={plant.id}
              onClick={() => onSelectPlant(plant)}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-xl',
                'bg-white/10 dark:bg-white/5 backdrop-blur-sm',
                'border border-white/20 dark:border-white/10',
                'motion-safe:hover:scale-[1.03] transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                plant.isSpecial && 'ring-1 ring-amber-400/40'
              )}
              aria-label={`${typeLabel} - ${stageLabel}`}
            >
              <span className="text-2xl" aria-hidden="true">{getPlantEmoji(plant)}</span>
              <span className="text-[10px] font-medium text-white/80 truncate max-w-full capitalize">
                {typeLabel}
              </span>
              {/* Thin growth progress bar */}
              <div className="w-full h-1 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${growthPercent}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Creatures section (if any, with separator) */}
      {creatures.length > 0 && (
        <>
          <div className="relative z-10 mx-3 border-t border-white/10" />
          <div className="relative z-10 grid grid-cols-3 sm:grid-cols-4 gap-2 p-3 pt-2">
            {creatures.map((creature) => {
              const stageLabel = ts[`creatureStage_${creature.stage}`] || creature.stage;
              const typeLabel = ts[`creatureType_${creature.type}`] || creature.type;

              return (
                <button
                  key={creature.id}
                  onClick={() => onSelectCreature(creature)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl',
                    'bg-white/10 dark:bg-white/5 backdrop-blur-sm',
                    'border border-white/20 dark:border-white/10',
                    'motion-safe:hover:scale-[1.03] transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
                  )}
                  aria-label={`${typeLabel} - ${stageLabel}`}
                >
                  <span className="text-2xl" aria-hidden="true">{getCreatureEmoji(creature)}</span>
                  <span className="text-[10px] font-medium text-white/80 truncate max-w-full capitalize">
                    {typeLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});

export default GardenCanvas;
