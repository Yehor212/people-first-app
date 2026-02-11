/**
 * TreeGlow — Stage 5 crown glow + sparkle shimmer.
 * Renders a radial glow behind the canopy and subtle sparkle points.
 */

import { TreeColors } from './useTreeColors';

interface TreeGlowProps {
  id: string;
  stageScale: number;
  colors: TreeColors;
  lowStimulus?: boolean;
}

export function TreeGlow({ id, stageScale, colors, lowStimulus }: TreeGlowProps) {
  const canopyRadius = 50 * stageScale;
  const canopyCenterY = 95;

  return (
    <g>
      {/* Radial glow behind canopy */}
      <ellipse
        cx={100}
        cy={canopyCenterY}
        rx={canopyRadius * 1.3}
        ry={canopyRadius * 1.1}
        fill={colors.glowColor}
        opacity={0.12}
        filter={`url(#treeGlow-${id})`}
      />

      {/* Sparkle shimmer points */}
      {!lowStimulus && (
        <>
          <circle cx={80} cy={canopyCenterY - canopyRadius * 0.5} r={1.8} fill="#fff">
            <animate
              attributeName="opacity"
              values="0;0.7;0"
              dur="2.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={115} cy={canopyCenterY - canopyRadius * 0.4} r={1.5} fill="#fff">
            <animate
              attributeName="opacity"
              values="0;0.6;0"
              dur="3s"
              begin="0.8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={95} cy={canopyCenterY - canopyRadius * 0.65} r={2} fill="#fff">
            <animate
              attributeName="opacity"
              values="0;0.8;0"
              dur="2.8s"
              begin="1.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={108} cy={canopyCenterY - canopyRadius * 0.6} r={1.3} fill={colors.glowColor}>
            <animate
              attributeName="opacity"
              values="0;0.5;0"
              dur="3.5s"
              begin="0.3s"
              repeatCount="indefinite"
            />
          </circle>
        </>
      )}
    </g>
  );
}
