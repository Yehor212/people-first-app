import { motion } from 'framer-motion';
import { zenMotion } from '@/lib/animationUtils';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Habit } from '@/types';

interface PremiumProgressBarProps {
  habitsDueToday: Habit[];
  completionStatusMap: Map<string, boolean>;
  completedTodayCount: number;
  allDoneLabel: string;
}

/** Premium CTA daily progress bar with individual habit segments */
export function PremiumProgressBar({
  habitsDueToday,
  completionStatusMap,
  completedTodayCount,
  allDoneLabel,
}: PremiumProgressBarProps) {
  return (
    <div className="relative mb-5">
      <div className="flex gap-1.5">
        {habitsDueToday.map((habit, index) => {
          const isComplete = completionStatusMap.get(habit.id) ?? false;
          return (
            <motion.div
              key={habit.id}
              className={cn("flex-1 h-3 rounded-full motion-safe:transition-all", isComplete ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-foreground/10")}
              style={isComplete ? { boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)' } : {}}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ ...zenMotion.gentle, delay: index * 0.05 }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-xs text-emerald-700/70 dark:text-emerald-300/70">{completedTodayCount} / {habitsDueToday.length}</span>
        {completedTodayCount === habitsDueToday.length && habitsDueToday.length > 0 && (
          <motion.span className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <Sparkles className="w-3 h-3" />
            {allDoneLabel}
          </motion.span>
        )}
      </div>
    </div>
  );
}
