/**
 * SeasonalTree — Premium animated SVG tree with seasonal variation and growth stages.
 *
 * Replaces canvas-based implementation with SVG + Framer Motion:
 * - viewBox="0 0 200 250" scales perfectly on all screens
 * - Framer Motion for interactive animations (color transitions, sway)
 * - Native SVG <animate> for ambient particles (zero JS cost)
 * - 5 stages x 4 seasons = 20 unique visual variants
 *
 * Props interface unchanged — zero consumer changes required.
 */

import { useId } from 'react';
import { cn } from '@/lib/utils';
import { Season, TreeStage, getCurrentSeason } from '@/lib/seasonHelper';
import { sizeConfig, stageScaleMap } from './seasonal-tree/constants';
import { useTreeColors } from './seasonal-tree/useTreeColors';
import { TreeDefs } from './seasonal-tree/TreeDefs';
import { TreePot } from './seasonal-tree/TreePot';
import { TreeTrunk } from './seasonal-tree/TreeTrunk';
import { TreeCanopy } from './seasonal-tree/TreeCanopy';
import { TreeAccents } from './seasonal-tree/TreeAccents';
import { TreeParticles } from './seasonal-tree/TreeParticles';
import { TreeGlow } from './seasonal-tree/TreeGlow';
import { WaterBar } from './seasonal-tree/WaterBar';
import { WateringEffect } from './seasonal-tree/WateringEffect';
import { ThirstyIndicator } from './seasonal-tree/ThirstyIndicator';

interface SeasonalTreeProps {
  stage: TreeStage;
  waterLevel: number; // 0-100
  xp?: number;
  season?: Season;
  isWatering?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  lowStimulus?: boolean;
}

export function SeasonalTree({
  stage,
  waterLevel,
  season: propSeason,
  isWatering = false,
  onClick,
  className,
  size = 'md',
  lowStimulus = false,
}: SeasonalTreeProps) {
  const id = useId();
  const season = propSeason || getCurrentSeason();
  const { width, height } = sizeConfig[size];
  const stageScale = stageScaleMap[stage];
  const colors = useTreeColors(season, waterLevel, stage);

  const isThirsty = waterLevel < 30;

  return (
    <div
      className={cn(
        'relative cursor-pointer select-none',
        onClick && 'hover:scale-105 transition-transform',
        className,
      )}
      onClick={onClick}
      style={{ width, height }}
    >
      <svg
        viewBox="0 0 200 250"
        width={width}
        height={height}
        aria-hidden="true"
        className="block"
      >
        <TreeDefs id={id} colors={colors} stage={stage} season={season} />

        {/* Ground shadow */}
        <ellipse
          cx={100}
          cy={212}
          rx={44 * stageScale}
          ry={7}
          fill="rgba(0,0,0,0.12)"
        />

        {/* Stage 5 glow (behind everything) */}
        {stage >= 5 && (
          <TreeGlow
            id={id}
            stageScale={stageScale}
            colors={colors}
            lowStimulus={lowStimulus}
          />
        )}

        {/* Tree body: pot (1-2) or trunk+canopy (3-5) */}
        {stage <= 2 ? (
          <TreePot
            id={id}
            stage={stage}
            colors={colors}
            lowStimulus={lowStimulus}
          />
        ) : (
          <>
            <TreeTrunk id={id} stage={stage} />
            <TreeCanopy
              id={id}
              stage={stage}
              stageScale={stageScale}
              colors={colors}
              lowStimulus={lowStimulus}
            />
            <TreeAccents
              season={season}
              stage={stage}
              stageScale={stageScale}
              lowStimulus={lowStimulus}
            />
          </>
        )}

        {/* Falling particles */}
        <TreeParticles
          season={season}
          lowStimulus={lowStimulus}
          stage={stage}
          colors={colors}
        />
      </svg>

      {/* HTML overlays */}
      <WaterBar waterLevel={waterLevel} />
      <WateringEffect isWatering={isWatering} height={height} />
      {isThirsty && !isWatering && <ThirstyIndicator />}
    </div>
  );
}
