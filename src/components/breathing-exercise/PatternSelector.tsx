import { Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { zenTap } from '@/lib/animationUtils';
import { cn } from '@/lib/utils';
import {
  type BreathingPattern,
  formatDuration,
  getTotalDuration,
} from '@/lib/breathingPatterns';

interface PatternSelectorProps {
  patterns: BreathingPattern[];
  selected: BreathingPattern;
  onSelect: (pattern: BreathingPattern) => void;
  onStart: () => void;
  t: Record<string, string>;
}

export function PatternSelector({ patterns, selected, onSelect, onStart, t }: PatternSelectorProps) {
  return (
    <>
      <div className="space-y-2 mb-6">
        {patterns.map((pattern) => (
          <motion.button
            key={pattern.id}
            onClick={() => onSelect(pattern)}
            className={cn(
              "w-full p-4 rounded-xl flex items-center gap-3 text-start relative overflow-hidden",
              "motion-safe:transition-all motion-safe:duration-300",
              selected.id === pattern.id
                ? "bg-secondary border border-cyan-500/40"
                : "bg-muted border border-border hover:bg-secondary hover:border-border"
            )}
            style={selected.id === pattern.id ? {
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            } : {
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
            whileHover={{ scale: 1.01 }}
            whileTap={zenTap.card}
          >
            {selected.id === pattern.id && (
              <motion.div
                className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_50%,rgba(6,182,212,0.15)_0%,transparent_50%)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            )}

            <motion.span
              className="text-2xl relative z-10"
              animate={selected.id === pattern.id ? {
                scale: [1, 1.1, 1],
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {pattern.emoji}
            </motion.span>

            <div className="flex-1 relative z-10">
              <p className="font-medium text-foreground">
                {t[pattern.nameKey] || pattern.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDuration(getTotalDuration(pattern))} • {pattern.cycles} {t.cycles || 'cycles'}
              </p>
            </div>

            <div
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium relative z-10",
                "backdrop-blur-sm border",
                pattern.effect === 'calming' && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                pattern.effect === 'focusing' && "bg-violet-500/20 text-violet-400 border-violet-500/30",
                pattern.effect === 'energizing' && "bg-orange-500/20 text-orange-400 border-orange-500/30",
                pattern.effect === 'sleeping' && "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
              )}
              style={{
                boxShadow: 'var(--zen-shadow-sm)',
              }}
            >
              {pattern.effect === 'calming' && (t.effectCalming || 'Calming')}
              {pattern.effect === 'focusing' && (t.effectFocusing || 'Focus')}
              {pattern.effect === 'energizing' && (t.effectEnergizing || 'Energy')}
              {pattern.effect === 'sleeping' && (t.effectSleeping || 'Sleep')}
            </div>
          </motion.button>
        ))}
      </div>

      <motion.button
        onClick={onStart}
        className={cn(
          "w-full py-4 rounded-xl font-semibold text-white relative overflow-hidden",
          "bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-500",
          "bg-[length:200%_100%]",
          "shadow-[0_0_25px_rgba(6,182,212,0.5),0_4px_15px_rgba(0,0,0,0.2)]"
        )}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear',
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={zenTap.card}
      >
        <div
          className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.2)_0%,transparent_50%)]"
        />
        <span className="relative z-10 flex items-center justify-center gap-2">
          <Play className="w-5 h-5" />
          {t.startBreathing || 'Start'}
        </span>
      </motion.button>
    </>
  );
}
