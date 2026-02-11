/**
 * Hook that computes all tree colors based on season, water level, and stage.
 * Handles water desaturation: canopy grays out when waterLevel < 40.
 */

import { useMemo } from 'react';
import { Season, TreeStage, getSeasonColors } from '@/lib/seasonHelper';
import { clamp, mixColor } from './constants';

export interface TreeColors {
  canopyPrimary: string;
  canopySecondary: string;
  canopyHighlight: string;
  canopyBack: string;
  accent: string;
  particle: string;
  glowColor: string;
  trunkLight: string;
  trunkDark: string;
}

export function useTreeColors(
  season: Season,
  waterLevel: number,
  stage: TreeStage,
): TreeColors {
  return useMemo(() => {
    const base = getSeasonColors(season);
    const dryness = clamp((40 - waterLevel) / 40, 0, 0.6);

    return {
      canopyPrimary: mixColor(base.primary, '#9ca3af', dryness),
      canopySecondary: mixColor(base.secondary, '#9ca3af', dryness),
      canopyHighlight: mixColor(base.secondary, '#ffffff', 0.3),
      canopyBack: mixColor(base.primary, '#000000', 0.15),
      accent: base.accent,
      particle: base.particle,
      glowColor: base.accent,
      trunkLight: mixColor('#8b5a2b', '#6b3f1f', (stage - 1) / 6),
      trunkDark: '#5c3a1f',
    };
  }, [season, waterLevel, stage]);
}
