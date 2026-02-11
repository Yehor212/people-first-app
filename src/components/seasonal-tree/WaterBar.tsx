/**
 * WaterBar — Pill-shaped water level indicator.
 * Positioned at the bottom center of the tree container.
 * Blue >= 70, Yellow >= 30, Red < 30.
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface WaterBarProps {
  waterLevel: number;
}

export function WaterBar({ waterLevel }: WaterBarProps) {
  const barColor =
    waterLevel >= 70
      ? 'bg-blue-400'
      : waterLevel >= 30
        ? 'bg-yellow-400'
        : 'bg-red-400';

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/20 backdrop-blur-sm rounded-full px-2 py-1">
      <span className="text-sm">💧</span>
      <div className="w-12 h-2 bg-white/30 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${waterLevel}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}
