/**
 * StreakMilestoneBadge - Milestone badge for habit streaks
 * Extracted from CompactHabitCard (v1.3.0 Premium Phase 8)
 */

import { memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Crown, Star, Zap } from "lucide-react";
import { haptics } from "@/lib/haptics";

export const StreakMilestoneBadge = memo(function StreakMilestoneBadge({ streak }: { streak: number }) {
  const hasTriggeredHaptic = useRef(false);

  useEffect(() => {
    if (!hasTriggeredHaptic.current && streak >= 7) {
      hasTriggeredHaptic.current = true;
      void haptics.medium();
    }
  }, [streak]);
  // Determine milestone
  if (streak >= 100) {
    return (
      <motion.div
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Crown className="w-3 h-3 text-white" />
        <span className="text-xs font-bold leading-tight text-white">100+</span>
      </motion.div>
    );
  }

  if (streak >= 30) {
    return (
      <motion.div
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Star className="w-3 h-3 text-white" />
        <span className="text-xs font-bold leading-tight text-white">30+</span>
      </motion.div>
    );
  }

  if (streak >= 7) {
    return (
      <motion.div
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Zap className="w-3 h-3 text-white" />
        <span className="text-xs font-bold leading-tight text-white">7+</span>
      </motion.div>
    );
  }

  return null;
});
