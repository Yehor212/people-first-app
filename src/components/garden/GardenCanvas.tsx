/**
 * GardenCanvas - The visual garden scene renderer.
 * Renders plants and creatures on a relative-positioned canvas with seasonal backgrounds,
 * weather effects, and interactive elements. Plants and creatures are positioned using
 * percentage-based coordinates (0-100 range) for responsive layout.
 *
 * NOTE: left/top % positioning for absolute elements within the canvas is intentional
 * and does NOT need RTL conversion — these are spatial coordinates, not directional.
 */

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { WeatherOverlay } from './WeatherOverlay';
import { GardenStageLabel } from './GardenStageLabel';
import type {
  GardenPlant,
  GardenCreature,
  GardenWeather,
  GardenStage,
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

/**
 * Season-specific ground gradient classes.
 */
const GROUND_GRADIENTS: Record<Season, string> = {
  spring: 'from-green-900/25 to-green-800/10 dark:from-green-950/40 dark:to-green-900/20',
  summer: 'from-amber-900/20 to-amber-800/10 dark:from-amber-950/35 dark:to-amber-900/15',
  autumn: 'from-orange-900/25 to-amber-800/10 dark:from-orange-950/40 dark:to-orange-900/20',
  winter: 'from-slate-400/25 to-blue-300/10 dark:from-slate-800/40 dark:to-blue-900/20',
};

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

  // Memoize labels so they only recalculate on language change
  const ariaLabels = useMemo(() => ({
    gardenScene: ts.gardenScene || 'Garden scene',
  }), [ts.gardenScene]);

  return (
    <div
      className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-border/30 shadow-sm"
      role="img"
      aria-label={ariaLabels.gardenScene}
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

      {/* Ground area */}
      <div
        className={cn(
          'absolute bottom-0 inset-x-0 h-1/4 bg-gradient-to-t',
          GROUND_GRADIENTS[season]
        )}
        aria-hidden="true"
      />

      {/* Plants rendered at their positions */}
      {plants.map((plant) => {
        const stageLabel = ts[`plantStage_${plant.stage}`] || plant.stage;
        const typeLabel = ts[`plantType_${plant.type}`] || plant.type;

        return (
          <button
            key={plant.id}
            onClick={() => onSelectPlant(plant)}
            style={{
              position: 'absolute',
              left: `${plant.position.x}%`,
              top: `${plant.position.y}%`,
            }}
            className={cn(
              'transform -translate-x-1/2 -translate-y-1/2',
              'text-2xl cursor-pointer',
              'motion-safe:hover:scale-110 transition-transform',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full',
              plant.isSpecial && 'text-3xl'
            )}
            aria-label={`${typeLabel} - ${stageLabel}`}
          >
            <span aria-hidden="true">{getPlantEmoji(plant)}</span>
          </button>
        );
      })}

      {/* Creatures rendered at their positions with subtle floating animation */}
      {creatures.map((creature) => {
        const stageLabel = ts[`creatureStage_${creature.stage}`] || creature.stage;
        const typeLabel = ts[`creatureType_${creature.type}`] || creature.type;

        return (
          <button
            key={creature.id}
            onClick={() => onSelectCreature(creature)}
            style={{
              position: 'absolute',
              left: `${creature.position.x}%`,
              top: `${creature.position.y}%`,
            }}
            className={cn(
              'transform -translate-x-1/2 -translate-y-1/2',
              'text-2xl cursor-pointer',
              'motion-safe:hover:scale-110 motion-safe:animate-[garden-float_4s_ease-in-out_infinite] transition-transform',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full',
              creature.isSpecial && 'text-3xl'
            )}
            aria-label={`${typeLabel} - ${stageLabel}`}
          >
            <span aria-hidden="true">{getCreatureEmoji(creature)}</span>
          </button>
        );
      })}

      {/* Garden stage label positioned at top-start */}
      <div className="absolute top-3 start-3 z-10">
        <GardenStageLabel stage={gardenStage} plantCount={plants.length} />
      </div>

      {/* Creature count badge at top-end (only if creatures exist) */}
      {creatures.length > 0 && (
        <div className="absolute top-3 end-3 z-10">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
              'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
            )}
          >
            <span aria-hidden="true">{'\u{1F98B}'}</span>
            <span>{creatures.length}</span>
          </span>
        </div>
      )}
    </div>
  );
});

export default GardenCanvas;
