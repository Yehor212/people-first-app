/**
 * Hook that generates stable particle definitions for the SVG tree.
 * Particles are deterministically placed at mount time — no per-frame JS.
 */

import { useMemo } from 'react';
import { Season, TreeStage } from '@/lib/seasonHelper';

export interface SVGParticle {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  size: number;
  duration: number;
  delay: number;
  rotation: number;
  rotationEnd: number;
}

export function useParticleSystem(
  season: Season,
  lowStimulus: boolean,
  stage: TreeStage,
): SVGParticle[] {
  return useMemo(() => {
    const count = lowStimulus ? 3 : stage >= 5 ? 15 : 10;
    const particles: SVGParticle[] = [];

    for (let i = 0; i < count; i++) {
      const startX = 30 + ((i * 37 + 13) % 140);
      const drift = ((i * 7 + 3) % 30) - 15;
      const sizeFactor = lowStimulus ? 0.7 : 1;

      particles.push({
        id: i,
        startX,
        startY: -10 - ((i * 23) % 40),
        endX: startX + drift,
        endY: 255,
        size: (2 + ((i * 11) % 3)) * sizeFactor,
        duration: 8 + ((i * 13) % 6),
        delay: (i * 1.3) % 8,
        rotation: ((i * 47) % 360),
        rotationEnd: ((i * 47) % 360) + (i % 2 === 0 ? 180 : -180),
      });
    }

    return particles;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- regenerate on season change for visual refresh
  }, [season, lowStimulus, stage]);
}
