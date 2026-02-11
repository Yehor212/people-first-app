/**
 * TreeParticles — Falling particles rendered with native SVG <animate>.
 * Spring: pink petals, Summer: green leaves, Autumn: orange leaves, Winter: snowflakes.
 * Zero JavaScript cost — all animation runs on the compositor thread.
 */

import { Season, TreeStage } from '@/lib/seasonHelper';
import { TreeColors } from './useTreeColors';
import { useParticleSystem } from './useParticleSystem';

interface TreeParticlesProps {
  season: Season;
  lowStimulus: boolean;
  stage: TreeStage;
  colors: TreeColors;
}

export function TreeParticles({ season, lowStimulus, stage, colors }: TreeParticlesProps) {
  const particles = useParticleSystem(season, lowStimulus, stage);

  const particleOpacity = lowStimulus ? 0.35 : 0.55;
  const isSnow = season === 'winter';

  return (
    <g>
      {particles.map((p) => (
        <g key={p.id}>
          {isSnow ? (
            /* Snowflake: simple animated circle */
            <circle
              r={p.size * 0.6}
              fill="white"
              opacity={0}
            >
              <animate
                attributeName="opacity"
                values={`0;${particleOpacity + 0.15};${particleOpacity + 0.15};0`}
                dur={`${p.duration}s`}
                begin={`${p.delay}s`}
                repeatCount="indefinite"
              />
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`${p.startX} ${p.startY};${p.endX} ${p.endY}`}
                dur={`${p.duration}s`}
                begin={`${p.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          ) : (
            /* Leaf / Petal: teardrop shape with rotation */
            <g opacity={0}>
              <animate
                attributeName="opacity"
                values={`0;${particleOpacity};${particleOpacity};0`}
                dur={`${p.duration}s`}
                begin={`${p.delay}s`}
                repeatCount="indefinite"
              />
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`${p.startX} ${p.startY};${p.endX} ${p.endY}`}
                dur={`${p.duration}s`}
                begin={`${p.delay}s`}
                repeatCount="indefinite"
              />
              <path
                d={`M0,${-p.size} Q${p.size},0 0,${p.size} Q${-p.size},0 0,${-p.size} Z`}
                fill={colors.particle}
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values={`${p.rotation};${p.rotationEnd}`}
                  dur={`${p.duration}s`}
                  begin={`${p.delay}s`}
                  repeatCount="indefinite"
                />
              </path>
            </g>
          )}
        </g>
      ))}
    </g>
  );
}
