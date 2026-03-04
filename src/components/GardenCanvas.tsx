/**
 * GardenCanvas — Abstract premium visualization of the user's inner garden
 *
 * Renders plants/creatures as positioned lucide-react icons over an
 * atmosphere-driven gradient background. All infinite animations use
 * CSS @keyframes (Constitution §14: 60fps Android guarantee).
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Flower2, TreePine, Gem, Clover, BookOpen, Wind, Moon,
  Bird, Bug, Sparkles, Ghost,
  Heart, Sprout,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motionPresets } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { InnerWorld, GardenPlant, GardenCreature, PlantType, PlantStage, CreatureType, Season, GardenStage } from '@/types';
import type { GardenAtmosphere } from '@/lib/gardenAtmosphere';

// ── Icon Maps (lucide-react ONLY, NO emojis) ──

export const PLANT_ICON_MAP: Record<PlantType, LucideIcon> = {
  flower: Flower2,
  tree: TreePine,
  crystal: Gem,
  mushroom: Clover,
  story: BookOpen,
  air_plant: Wind,
  rest_flower: Moon,
};

export const CREATURE_ICON_MAP: Record<CreatureType, LucideIcon> = {
  butterfly: Bug,
  bird: Bird,
  firefly: Sparkles,
  spirit: Ghost,
};

// ── Stage → visual scaling ──

export const STAGE_SCALE: Record<PlantStage, { scale: number; opacity: number }> = {
  seed: { scale: 0.6, opacity: 0.5 },
  sprout: { scale: 0.75, opacity: 0.65 },
  growing: { scale: 0.9, opacity: 0.8 },
  blooming: { scale: 1.0, opacity: 1.0 },
  magnificent: { scale: 1.15, opacity: 1.0 },
};

// ── Atmosphere → gradient classes ──

const SEASONAL_GRADIENTS: Record<Season, string> = {
  spring: 'from-emerald-50 to-green-100 dark:from-emerald-950/60 dark:to-green-950/40',
  summer: 'from-amber-50 to-yellow-100 dark:from-amber-950/60 dark:to-yellow-950/40',
  autumn: 'from-orange-50 to-amber-100 dark:from-orange-950/60 dark:to-amber-950/40',
  winter: 'from-sky-50 to-slate-100 dark:from-sky-950/60 dark:to-slate-950/40',
};

const ATMOSPHERE_GRADIENTS: Record<GardenAtmosphere, string> = {
  default: '', // filled dynamically by season
  focused: 'from-slate-100 to-blue-50 dark:from-slate-900 dark:to-blue-950',
  restful: 'from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950',
  social: 'from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950',
  energetic: 'from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950',
  creative: 'from-violet-50 to-fuchsia-50 dark:from-violet-950 dark:to-fuchsia-950',
};

// ── Component ──

interface GardenCanvasProps {
  world: InnerWorld;
  atmosphere: GardenAtmosphere;
}

const STAGE_I18N_KEYS: Record<GardenStage, string> = {
  empty: 'gardenStageEmpty',
  sprouting: 'gardenStageSprouting',
  growing: 'gardenStageGrowing',
  flourishing: 'gardenStageFlourishing',
  magical: 'gardenStageMagical',
  legendary: 'gardenStageLegendary',
};

export function GardenCanvas({ world, atmosphere }: GardenCanvasProps) {
  const { t } = useLanguage();
  const { plants, creatures, companion, season, gardenStage, activeEffects } = world;

  const isWindActive = useMemo(() => {
    if (!activeEffects?.wind?.until) return false;
    return Date.now() < activeEffects.wind.until;
  }, [activeEffects?.wind?.until]);

  const gradientClass = atmosphere === 'default'
    ? SEASONAL_GRADIENTS[season] || SEASONAL_GRADIENTS.spring
    : ATMOSPHERE_GRADIENTS[atmosphere];

  return (
    <motion.div
      {...motionPresets.slideUp}
      className="rounded-2xl bg-surface-glass backdrop-blur-[var(--surface-glass-blur)] border border-[var(--surface-glass-border)] zen-shadow-card overflow-hidden"
    >
      {/* Atmosphere gradient background */}
      <div className={cn('relative min-h-[280px] bg-gradient-to-br', gradientClass)}>
        {/* Garden stage badge */}
        <div className="absolute top-3 end-3 z-10 rounded-full bg-background/80 backdrop-blur-sm px-2.5 py-1 border border-border/40">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {(t as unknown as Record<string, string>)[STAGE_I18N_KEYS[gardenStage]] || gardenStage}
          </span>
        </div>

        {/* Flora container — wind sway applies to all plants when active */}
        <div className={cn('absolute inset-0', isWindActive && 'animate-wind-sway')}>
          {plants.map((plant) => (
            <PlantIcon key={plant.id} plant={plant} />
          ))}
        </div>

        {/* Creature layer — floats independently */}
        <div className="absolute inset-0">
          {creatures.map((creature) => (
            <CreatureIcon key={creature.id} creature={creature} />
          ))}
        </div>

        {/* Companion indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1">
          <div className="animate-garden-breathe rounded-full bg-background/70 backdrop-blur-sm p-2 border border-border/30">
            <Heart
              className={cn(
                'w-5 h-5',
                companion.mood === 'celebrating' || companion.mood === 'excited'
                  ? 'text-rose-500'
                  : companion.mood === 'sleeping'
                    ? 'text-indigo-400'
                    : 'text-pink-400'
              )}
              fill="currentColor"
            />
          </div>
          <span className="text-[9px] text-foreground/60 font-medium">
            {companion.name}
          </span>
        </div>

        {/* Empty state */}
        {plants.length === 0 && creatures.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Sprout className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-xs text-muted-foreground/60">
                {t.gardenGrowsHint || 'Your garden grows with every action'}
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Sub-components ──

function PlantIcon({ plant }: { plant: GardenPlant }) {
  const Icon = PLANT_ICON_MAP[plant.type] || Flower2;
  const { scale, opacity } = STAGE_SCALE[plant.stage] || STAGE_SCALE.growing;
  const isMagnificent = plant.stage === 'magnificent';
  const baseSize = 20; // px
  const iconSize = Math.round(baseSize * scale);

  return (
    <div
      className={cn(
        'absolute -translate-x-1/2 -translate-y-1/2 transition-none',
        isMagnificent ? 'animate-zen-glow-breathe' : 'animate-garden-breathe',
      )}
      style={{
        left: `${plant.position.x}%`,
        top: `${plant.position.y}%`,
        opacity,
        // Stagger animations to avoid uniform pulsing
        animationDelay: `${(plant.position.x * 37) % 4000}ms`,
      }}
    >
      <Icon
        className={cn(
          plant.isSpecial && 'drop-shadow-[0_0_6px_currentColor]',
        )}
        style={{ color: plant.color, width: iconSize, height: iconSize }}
      />
    </div>
  );
}

function CreatureIcon({ creature }: { creature: GardenCreature }) {
  const Icon = CREATURE_ICON_MAP[creature.type] || Sparkles;
  const isLegendary = creature.stage === 'legendary';
  const size = isLegendary ? 18 : 14;

  return (
    <div
      className={cn(
        'absolute -translate-x-1/2 -translate-y-1/2 animate-zen-float',
        isLegendary && 'drop-shadow-[0_0_8px_currentColor]',
      )}
      style={{
        left: `${creature.position.x}%`,
        top: `${creature.position.y}%`,
        color: creature.color,
        animationDelay: `${(creature.position.y * 53) % 3000}ms`,
      }}
    >
      <Icon style={{ width: size, height: size }} />
    </div>
  );
}
