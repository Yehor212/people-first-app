/**
 * TreeCanopy — Multi-layer canopy with idle sway animation.
 * Renders overlapping ellipses in 3 depth layers for an organic cloud-like shape.
 * Uses Framer Motion useMotionValue + useAnimationFrame for smooth idle sway.
 */

import { motion, useMotionValue, useAnimationFrame } from 'framer-motion';
import { TreeStage } from '@/lib/seasonHelper';
import { TreeColors } from './useTreeColors';

interface TreeCanopyProps {
  id: string;
  stage: TreeStage;
  stageScale: number;
  colors: TreeColors;
  lowStimulus?: boolean;
}

export function TreeCanopy({
  id,
  stage,
  stageScale,
  colors,
  lowStimulus,
}: TreeCanopyProps) {
  const swayAngle = useMotionValue(0);

  useAnimationFrame((time) => {
    const amplitude = lowStimulus ? 0.3 : 0.8;
    swayAngle.set(Math.sin(time * 0.001 * 1.2) * amplitude);
  });

  const canopyRadius = 50 * stageScale;
  const canopyCenterY = stage === 3 ? 115 : stage === 4 ? 108 : 95;

  return (
    <motion.g style={{ rotate: swayAngle, transformOrigin: '100px 180px' }}>
      {/* DEPTH 1: Back layer (darker, larger) */}
      <ellipse
        cx={100}
        cy={canopyCenterY + 8}
        rx={canopyRadius * 1.05}
        ry={canopyRadius * 0.75}
        fill={`url(#canopyBackGrad-${id})`}
      />

      {/* DEPTH 2: Main layer */}
      {/* Center blob */}
      <ellipse
        cx={100}
        cy={canopyCenterY}
        rx={canopyRadius * 0.95}
        ry={canopyRadius * 0.8}
        fill={`url(#canopyGrad-${id})`}
      />

      {/* Left blob */}
      <ellipse
        cx={100 - canopyRadius * 0.55}
        cy={canopyCenterY + canopyRadius * 0.18}
        rx={canopyRadius * 0.6}
        ry={canopyRadius * 0.5}
        fill={`url(#canopyGrad-${id})`}
        opacity={0.9}
      />

      {/* Right blob */}
      <ellipse
        cx={100 + canopyRadius * 0.55}
        cy={canopyCenterY + canopyRadius * 0.18}
        rx={canopyRadius * 0.6}
        ry={canopyRadius * 0.5}
        fill={`url(#canopyGrad-${id})`}
        opacity={0.9}
      />

      {/* DEPTH 3: Front highlights */}
      {/* Top crown */}
      <ellipse
        cx={100}
        cy={canopyCenterY - canopyRadius * 0.45}
        rx={canopyRadius * 0.6}
        ry={canopyRadius * 0.4}
        fill={`url(#canopyGrad-${id})`}
        opacity={0.85}
      />

      {/* Top-left highlight */}
      <ellipse
        cx={100 - canopyRadius * 0.25}
        cy={canopyCenterY - canopyRadius * 0.2}
        rx={canopyRadius * 0.35}
        ry={canopyRadius * 0.28}
        fill={colors.canopyHighlight}
        opacity={0.25}
      />

      {/* Stage 4+: additional side blobs for fullness */}
      {stage >= 4 && (
        <>
          <ellipse
            cx={100 - canopyRadius * 0.7}
            cy={canopyCenterY - canopyRadius * 0.05}
            rx={canopyRadius * 0.45}
            ry={canopyRadius * 0.38}
            fill={`url(#canopyGrad-${id})`}
            opacity={0.8}
          />
          <ellipse
            cx={100 + canopyRadius * 0.7}
            cy={canopyCenterY - canopyRadius * 0.05}
            rx={canopyRadius * 0.45}
            ry={canopyRadius * 0.38}
            fill={`url(#canopyGrad-${id})`}
            opacity={0.8}
          />
        </>
      )}

      {/* Stage 5: extra crown volume */}
      {stage >= 5 && (
        <>
          <ellipse
            cx={100 - canopyRadius * 0.35}
            cy={canopyCenterY - canopyRadius * 0.55}
            rx={canopyRadius * 0.4}
            ry={canopyRadius * 0.3}
            fill={`url(#canopyGrad-${id})`}
            opacity={0.75}
          />
          <ellipse
            cx={100 + canopyRadius * 0.35}
            cy={canopyCenterY - canopyRadius * 0.55}
            rx={canopyRadius * 0.4}
            ry={canopyRadius * 0.3}
            fill={`url(#canopyGrad-${id})`}
            opacity={0.75}
          />
          {/* Crown top cap */}
          <ellipse
            cx={100}
            cy={canopyCenterY - canopyRadius * 0.7}
            rx={canopyRadius * 0.35}
            ry={canopyRadius * 0.25}
            fill={`url(#canopyGrad-${id})`}
            opacity={0.7}
          />
        </>
      )}
    </motion.g>
  );
}
