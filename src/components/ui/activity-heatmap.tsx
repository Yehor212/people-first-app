/**
 * ActivityHeatMap - GitHub-style activity contribution graph
 * Phase 12: Premium upgrade with glow effects and staggered animations
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ActivityData {
  date: string; // YYYY-MM-DD format
  level: number; // 0-4 (0 = no activity, 4 = highest activity)
}

interface ActivityHeatMapProps {
  data: ActivityData[];
  months?: number; // Number of months to show (default: 3)
  className?: string;
  labels: {
    title: string;
    less: string;
    more: string;
    dayNames?: string[]; // ['S', 'M', 'T', 'W', 'T', 'F', 'S'] or translated
    monthNames?: string[]; // ['Jan', 'Feb', ...] or translated
  };
}

// Premium level colors with glow shadows
const LEVEL_STYLES = {
  0: {
    bg: 'bg-secondary',
    shadow: ''
  },
  1: {
    bg: 'bg-[hsl(var(--chart-activity-1))]',
    shadow: 'shadow-[0_0_6px_hsl(var(--chart-activity-1)/0.5)]'
  },
  2: {
    bg: 'bg-[hsl(var(--chart-activity-2))]',
    shadow: 'shadow-[0_0_8px_hsl(var(--chart-activity-2)/0.6)]'
  },
  3: {
    bg: 'bg-[hsl(var(--chart-activity-3))]',
    shadow: 'shadow-[0_0_10px_hsl(var(--chart-activity-3)/0.7)]'
  },
  4: {
    bg: 'bg-[hsl(var(--chart-activity-4))]',
    shadow: 'shadow-[0_0_12px_hsl(var(--chart-activity-4)/0.8)]'
  }
} as const;

// Keep simple array for legend
const LEVEL_COLORS = [
  'bg-secondary',
  'bg-[hsl(var(--chart-activity-1))]',
  'bg-[hsl(var(--chart-activity-2))]',
  'bg-[hsl(var(--chart-activity-3))]',
  'bg-[hsl(var(--chart-activity-4))]',
] as const;

const DEFAULT_DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DEFAULT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ActivityHeatMap({
  data,
  months = 3,
  className,
  labels
}: ActivityHeatMapProps) {
  // Calculate the date range
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    const endDate = new Date(today);

    // Go back n months
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);

    // Adjust to start from Sunday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    // Build activity map for O(1) lookup
    const activityMap = new Map<string, number>();
    data.forEach(d => activityMap.set(d.date, d.level));

    // Generate weeks array
    const weeks: Array<Array<{ date: string; level: number; day: number }>> = [];
    let currentWeek: Array<{ date: string; level: number; day: number }> = [];
    const monthLabels: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = -1;

    const currentDate = new Date(startDate);
    let weekIndex = 0;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const month = currentDate.getMonth();
      const day = currentDate.getDate();

      // Track month labels
      if (month !== lastMonth && day <= 7) {
        const monthNamesArray = labels.monthNames || DEFAULT_MONTH_NAMES;
        monthLabels.push({ label: monthNamesArray[month], weekIndex });
        lastMonth = month;
      }

      currentWeek.push({
        date: dateStr,
        level: activityMap.get(dateStr) || 0,
        day: currentDate.getDay(),
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
        weekIndex++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Add remaining days
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return { weeks, monthLabels };
  }, [data, months, labels.monthNames]);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn('relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl p-4 zen-shadow-card border border-border/50', className)}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-activity-4)/0.03)] to-transparent pointer-events-none" />

      <div className="relative">
        <h3 className="text-sm font-semibold text-foreground mb-4">{labels.title}</h3>

        <div className="overflow-x-auto">
          <div className="inline-flex flex-col gap-1 min-w-max">
            {/* Month labels row */}
            <div className="flex ml-7">
              {monthLabels.map((m, i) => (
                <div
                  key={i}
                  className="text-xs text-muted-foreground"
                  style={{
                    position: 'relative',
                    left: `${m.weekIndex * 12}px`,
                    marginRight: i < monthLabels.length - 1
                      ? `${(monthLabels[i + 1]?.weekIndex - m.weekIndex - 3) * 12}px`
                      : 0
                  }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Grid with staggered entrance */}
            <div className="flex gap-[2px]">
              {/* Day labels column */}
              <div className="flex flex-col gap-[2px] mr-1 justify-center">
                {(labels.dayNames || DEFAULT_DAY_NAMES).map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-3 h-3 text-xs text-muted-foreground text-right leading-3",
                      i % 2 === 0 ? "opacity-100" : "opacity-0"
                    )}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Weeks with animation */}
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[2px]">
                  {week.map((day, dayIndex) => {
                    const levelStyle = LEVEL_STYLES[day.level as keyof typeof LEVEL_STYLES];
                    const isFuture = day.date > todayStr;
                    const isToday = day.date === todayStr;

                    return (
                      <motion.div
                        key={`${weekIndex}-${dayIndex}`}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          delay: (weekIndex * 7 + dayIndex) * 0.003,
                          type: 'spring',
                          stiffness: 500,
                          damping: 30
                        }}
                        whileHover={{
                          scale: 1.4,
                          transition: { duration: 0.15 }
                        }}
                        className={cn(
                          'w-[10px] h-[10px] rounded-[2px] transition-shadow duration-200 cursor-pointer',
                          levelStyle.bg,
                          day.level > 0 && levelStyle.shadow,
                          isFuture && 'opacity-30',
                          isToday && 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background',
                          'hover:ring-2 hover:ring-primary/50'
                        )}
                        title={`${day.date}: Level ${day.level}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Premium Legend */}
            <div className="flex items-center justify-end gap-1.5 mt-3 text-xs text-muted-foreground">
              <span>{labels.less}</span>
              {[0, 1, 2, 3, 4].map((level) => {
                const style = LEVEL_STYLES[level as keyof typeof LEVEL_STYLES];
                return (
                  <motion.div
                    key={level}
                    whileHover={{ scale: 1.3 }}
                    className={cn(
                      'w-[10px] h-[10px] rounded-[2px] transition-all duration-200',
                      style.bg,
                      level > 0 && style.shadow
                    )}
                  />
                );
              })}
              <span>{labels.more}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Helper function to calculate activity level from various data sources
 */
export function calculateActivityLevel(
  date: string,
  data: {
    hasMood: boolean;
    habitsCompleted: number;
    habitsTotal: number;
    hasFocus: boolean;
    hasGratitude: boolean;
  }
): number {
  let score = 0;

  if (data.hasMood) score += 1;
  if (data.hasFocus) score += 1;
  if (data.hasGratitude) score += 1;
  if (data.habitsTotal > 0 && data.habitsCompleted >= data.habitsTotal) {
    score += 1;
  } else if (data.habitsCompleted > 0) {
    score += 0.5;
  }

  // Convert to 0-4 scale
  if (score >= 3.5) return 4;
  if (score >= 2.5) return 3;
  if (score >= 1.5) return 2;
  if (score > 0) return 1;
  return 0;
}
