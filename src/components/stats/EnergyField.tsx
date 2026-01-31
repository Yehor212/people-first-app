/**
 * EnergyField - "Поле Енергії" (Energy Field)
 *
 * Fire-based activity heatmap with:
 * - Glowing fire cells instead of green squares
 * - Ember particles rising from hot cells
 * - Pulsing glow effect on active days
 * - Heat shimmer/distortion effect
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface DayData {
  date: string;
  level: 0 | 1 | 2 | 3 | 4;
}

interface EnergyFieldProps {
  data: DayData[];
  className?: string;
}

// Ember particle rising from hot cells
function EmberParticle({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <motion.div
      className="absolute w-1.5 h-1.5 rounded-full"
      style={{
        left: x,
        top: y,
        background: 'radial-gradient(circle, #fbbf24 0%, #f97316 50%, transparent 100%)',
      }}
      initial={{ y: 0, opacity: 1, scale: 1 }}
      animate={{
        y: -40,
        x: [0, Math.random() * 10 - 5, Math.random() * 15 - 7.5],
        opacity: [1, 0.8, 0],
        scale: [1, 0.8, 0.3],
      }}
      transition={{
        duration: 1.5 + Math.random() * 0.5,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

// Single fire cell
function FireCell({
  day,
  index,
  onHover,
}: {
  day: DayData;
  index: number;
  onHover?: (day: DayData | null) => void;
}) {
  const isToday = day.date === new Date().toISOString().split('T')[0];
  const isFuture = day.date > new Date().toISOString().split('T')[0];

  // Fire gradient colors based on level
  const levelStyles = {
    0: {
      bg: 'bg-zinc-800/50',
      shadow: 'none',
      glow: false,
    },
    1: {
      bg: 'bg-gradient-to-t from-orange-900/60 to-orange-700/40',
      shadow: '0 0 6px rgba(249, 115, 22, 0.3)',
      glow: true,
    },
    2: {
      bg: 'bg-gradient-to-t from-orange-700/70 to-orange-500/50',
      shadow: '0 0 10px rgba(249, 115, 22, 0.4)',
      glow: true,
    },
    3: {
      bg: 'bg-gradient-to-t from-orange-600/80 to-yellow-500/60',
      shadow: '0 0 14px rgba(251, 191, 36, 0.5)',
      glow: true,
    },
    4: {
      bg: 'bg-gradient-to-t from-yellow-600 to-yellow-400',
      shadow: '0 0 20px rgba(251, 191, 36, 0.7), 0 0 30px rgba(249, 115, 22, 0.4)',
      glow: true,
    },
  }[day.level];

  return (
    <motion.div
      className="relative"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        delay: index * 0.003,
        type: 'spring',
        stiffness: 500,
        damping: 25,
      }}
    >
      <motion.div
        className={cn(
          "w-3 h-3 rounded-sm cursor-pointer transition-transform",
          levelStyles.bg,
          isToday && "ring-1 ring-white/60",
          isFuture && "opacity-30"
        )}
        style={{ boxShadow: levelStyles.shadow }}
        whileHover={{ scale: 1.4 }}
        animate={
          levelStyles.glow && !isFuture
            ? {
                boxShadow: [
                  levelStyles.shadow,
                  levelStyles.shadow.replace(/[\d.]+(?=\))/g, (m) =>
                    String(parseFloat(m) * 1.3)
                  ),
                  levelStyles.shadow,
                ],
              }
            : {}
        }
        transition={{ duration: 1.5, repeat: Infinity }}
        onMouseEnter={() => onHover?.(day)}
        onMouseLeave={() => onHover?.(null)}
      />

      {/* Ember particles for high activity */}
      {day.level >= 3 && !isFuture && (
        <>
          <EmberParticle x={6} y={0} delay={Math.random() * 2} />
          {day.level === 4 && (
            <>
              <EmberParticle x={2} y={2} delay={Math.random() * 2 + 0.5} />
              <EmberParticle x={10} y={1} delay={Math.random() * 2 + 1} />
            </>
          )}
        </>
      )}
    </motion.div>
  );
}

export function EnergyField({ data, className }: EnergyFieldProps) {
  const { t } = useLanguage();

  // Organize data into weeks (7 columns)
  const weeks = useMemo(() => {
    const result: DayData[][] = [];
    let currentWeek: DayData[] = [];

    // Fill in missing days at the start
    if (data.length > 0) {
      const firstDay = new Date(data[0].date).getDay();
      for (let i = 0; i < firstDay; i++) {
        currentWeek.push({ date: '', level: 0 });
      }
    }

    data.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [data]);

  // Day labels
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-4",
      // Light mode: add shadow and ring for visual separation
      "shadow-lg shadow-black/10 dark:shadow-none",
      "ring-1 ring-black/5 dark:ring-0",
      className
    )}>
      {/* Dark volcanic background */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center bottom,
            rgba(127, 29, 29, 0.3) 0%,
            rgba(24, 24, 27, 0.95) 50%,
            #18181b 100%)`,
        }}
      />

      {/* Heat shimmer effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(0deg, transparent 0%, rgba(251, 191, 36, 0.02) 50%, transparent 100%)',
        }}
        animate={{
          y: [0, -10, 0],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Title */}
      <motion.div
        className="relative flex items-center gap-2 mb-4"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <motion.span
          className="text-xl"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          🔥
        </motion.span>
        <h3 className="text-sm font-semibold text-amber-100">
          {t.activityOverview || 'Activity Overview'}
        </h3>
      </motion.div>

      {/* Grid container */}
      <div className="relative flex gap-2">
        {/* Day labels column */}
        <div className="flex flex-col gap-0.5 pt-0.5">
          {dayLabels.map((label, i) => (
            <div
              key={i}
              className="h-3 flex items-center text-[10px] text-zinc-500"
            >
              {i % 2 === 1 ? label : ''}
            </div>
          ))}
        </div>

        {/* Weeks grid */}
        <div className="flex gap-0.5 overflow-x-auto pb-2">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-0.5">
              {week.map((day, dayIndex) => (
                <FireCell
                  key={`${weekIndex}-${dayIndex}`}
                  day={day}
                  index={weekIndex * 7 + dayIndex}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="relative flex items-center justify-end gap-2 mt-4">
        <span className="text-xs text-zinc-500">{t.less || 'Less'}</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <motion.div
            key={level}
            className={cn(
              "w-3 h-3 rounded-sm",
              level === 0 && "bg-zinc-800/50",
              level === 1 && "bg-gradient-to-t from-orange-900/60 to-orange-700/40",
              level === 2 && "bg-gradient-to-t from-orange-700/70 to-orange-500/50",
              level === 3 && "bg-gradient-to-t from-orange-600/80 to-yellow-500/60",
              level === 4 && "bg-gradient-to-t from-yellow-600 to-yellow-400"
            )}
            whileHover={{ scale: 1.3 }}
          />
        ))}
        <span className="text-xs text-zinc-500">{t.more || 'More'}</span>
      </div>

      {/* Bottom lava glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at bottom, rgba(249, 115, 22, 0.15) 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}

export default EnergyField;
