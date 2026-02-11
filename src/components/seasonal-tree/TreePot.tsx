/**
 * TreePot — Stages 1-2: terracotta pot with seed or sprout.
 * Stage 1: seed peeking from soil.
 * Stage 2: curved stem with 2 leaves.
 */

import { motion } from 'framer-motion';
import { TreeStage } from '@/lib/seasonHelper';
import { TreeColors } from './useTreeColors';

interface TreePotProps {
  id: string;
  stage: TreeStage;
  colors: TreeColors;
  lowStimulus?: boolean;
}

export function TreePot({ id, stage, colors, lowStimulus }: TreePotProps) {
  const potCenterX = 100;
  const potTopY = 172;
  const potWidth = 60;
  const potHeight = 48;
  const rimHeight = 10;

  return (
    <g>
      {/* Pot body */}
      <rect
        x={potCenterX - potWidth / 2}
        y={potTopY}
        width={potWidth}
        height={potHeight}
        rx={8}
        ry={8}
        fill={`url(#potGrad-${id})`}
      />

      {/* Pot bottom taper highlight */}
      <rect
        x={potCenterX - potWidth / 2 + 6}
        y={potTopY + potHeight - 12}
        width={potWidth - 12}
        height={12}
        rx={6}
        ry={6}
        fill="#b7744d"
        opacity={0.6}
      />

      {/* Pot rim */}
      <rect
        x={potCenterX - (potWidth + 8) / 2}
        y={potTopY - rimHeight + 2}
        width={potWidth + 8}
        height={rimHeight}
        rx={5}
        ry={5}
        fill={`url(#potRimGrad-${id})`}
      />

      {/* Rim top highlight */}
      <rect
        x={potCenterX - (potWidth + 4) / 2}
        y={potTopY - rimHeight + 1}
        width={potWidth + 4}
        height={3}
        rx={1.5}
        fill="#d4946a"
        opacity={0.5}
      />

      {/* Soil surface */}
      <ellipse
        cx={potCenterX}
        cy={potTopY + 4}
        rx={potWidth / 2 - 4}
        ry={6}
        fill="#3b2a22"
      />
      <ellipse
        cx={potCenterX}
        cy={potTopY + 2}
        rx={potWidth / 2 - 8}
        ry={4}
        fill="#4a3530"
        opacity={0.6}
      />

      {stage === 1 ? (
        /* Stage 1: Seed */
        <g>
          {/* Seed body */}
          <motion.path
            d="M100 165 Q106 172 100 180 Q94 172 100 165 Z"
            fill="#6b4e3d"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
          {/* Seed highlight */}
          <ellipse cx={99} cy={171} rx={2} ry={3} fill="#8a6b55" opacity={0.6} />

          {/* Pot rim pulsing glow */}
          {!lowStimulus && (
            <ellipse
              cx={potCenterX}
              cy={potTopY - rimHeight + 5}
              rx={potWidth / 2 + 6}
              ry={4}
              fill="#d58c61"
              opacity={0.3}
            >
              <animate
                attributeName="opacity"
                values="0.15;0.35;0.15"
                dur="3s"
                repeatCount="indefinite"
              />
            </ellipse>
          )}
        </g>
      ) : (
        /* Stage 2: Sprout */
        <g>
          {/* Stem */}
          <motion.path
            d="M100 172 Q103 152 101 135"
            stroke="#2f7b3a"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6 }}
          />

          {/* Left leaf */}
          <motion.ellipse
            cx={88}
            cy={142}
            rx={13}
            ry={6}
            fill={colors.canopySecondary}
            transform="rotate(-30 88 142)"
            animate={{ rotate: [-30, -25, -30] }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: '95px 145px' }}
          />

          {/* Right leaf */}
          <motion.ellipse
            cx={112}
            cy={142}
            rx={13}
            ry={6}
            fill={colors.canopySecondary}
            transform="rotate(30 112 142)"
            animate={{ rotate: [30, 25, 30] }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: '105px 145px' }}
          />

          {/* Leaf vein lines */}
          <line x1={88} y1={142} x2={80} y2={139} stroke="#1f6b2a" strokeWidth={0.8} opacity={0.4} />
          <line x1={112} y1={142} x2={120} y2={139} stroke="#1f6b2a" strokeWidth={0.8} opacity={0.4} />

          {/* Sparkle dots at leaf tips */}
          {!lowStimulus && (
            <>
              <circle cx={78} cy={138} r={1.5} fill="#FFD700">
                <animate
                  attributeName="opacity"
                  values="0;0.8;0"
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="r"
                  values="1;2;1"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx={122} cy={138} r={1.5} fill="#FFD700">
                <animate
                  attributeName="opacity"
                  values="0;0.8;0"
                  dur="2.3s"
                  begin="0.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="r"
                  values="1;2;1"
                  dur="2.3s"
                  begin="0.5s"
                  repeatCount="indefinite"
                />
              </circle>
            </>
          )}
        </g>
      )}
    </g>
  );
}
