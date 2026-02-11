/**
 * SVG <defs> block: gradients, filters, clip paths.
 * Parameterized by unique ID prefix and computed tree colors.
 */

import { motion } from 'framer-motion';
import { Season, TreeStage } from '@/lib/seasonHelper';
import { TreeColors } from './useTreeColors';

interface TreeDefsProps {
  id: string;
  colors: TreeColors;
  stage: TreeStage;
  season: Season;
}

const colorTransition = { duration: 0.8, ease: 'easeInOut' as const };

export function TreeDefs({ id, colors, stage, season }: TreeDefsProps) {
  return (
    <defs>
      {/* Canopy radial gradient */}
      <radialGradient
        id={`canopyGrad-${id}`}
        cx="40%"
        cy="35%"
        r="65%"
      >
        <motion.stop
          offset="0%"
          animate={{ stopColor: colors.canopyHighlight }}
          transition={colorTransition}
          stopOpacity={0.9}
        />
        <motion.stop
          offset="50%"
          animate={{ stopColor: colors.canopySecondary }}
          transition={colorTransition}
          stopOpacity={0.95}
        />
        <motion.stop
          offset="100%"
          animate={{ stopColor: colors.canopyPrimary }}
          transition={colorTransition}
          stopOpacity={0.9}
        />
      </radialGradient>

      {/* Canopy back layer (darker) */}
      <radialGradient id={`canopyBackGrad-${id}`} cx="50%" cy="50%" r="60%">
        <motion.stop
          offset="0%"
          animate={{ stopColor: colors.canopyBack }}
          transition={colorTransition}
          stopOpacity={0.7}
        />
        <motion.stop
          offset="100%"
          animate={{ stopColor: colors.canopyPrimary }}
          transition={colorTransition}
          stopOpacity={0.6}
        />
      </radialGradient>

      {/* Trunk gradient */}
      <linearGradient id={`trunkGrad-${id}`} x1="0" y1="0" x2="1" y2="1">
        <motion.stop
          offset="0%"
          animate={{ stopColor: colors.trunkLight }}
          transition={colorTransition}
        />
        <motion.stop offset="100%" stopColor={colors.trunkDark} />
      </linearGradient>

      {/* Pot gradient */}
      <linearGradient id={`potGrad-${id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#c9845c" />
        <stop offset="50%" stopColor="#d58c61" />
        <stop offset="100%" stopColor="#b7744d" />
      </linearGradient>

      {/* Pot rim darker shade */}
      <linearGradient id={`potRimGrad-${id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#a06840" />
        <stop offset="50%" stopColor="#9a5a3d" />
        <stop offset="100%" stopColor="#8e5035" />
      </linearGradient>

      {/* Stage 5 crown glow filter */}
      {stage >= 5 && (
        <filter id={`treeGlow-${id}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feFlood floodColor={colors.glowColor} floodOpacity="0.25" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      )}

      {/* Soft ground shadow */}
      <filter id={`shadowBlur-${id}`}>
        <feGaussianBlur stdDeviation="3" />
      </filter>

      {/* Leaf / petal particle shape (reusable) */}
      <path
        id={`leafShape-${id}`}
        d="M0,-4 Q4,0 0,4 Q-4,0 0,-4 Z"
      />

      {/* Season-specific accent gradient */}
      {season === 'spring' && (
        <radialGradient id={`blossomGrad-${id}`} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fff0f5" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffc7d6" stopOpacity="0.7" />
        </radialGradient>
      )}
      {season === 'autumn' && (
        <radialGradient id={`fruitGrad-${id}`} cx="40%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#ff8c42" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#e8601c" stopOpacity="0.8" />
        </radialGradient>
      )}
    </defs>
  );
}
