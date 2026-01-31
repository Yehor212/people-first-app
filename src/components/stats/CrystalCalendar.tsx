/**
 * CrystalCalendar - "Кристальний Календар" (Crystal Calendar)
 *
 * Diamond-shaped calendar visualization with:
 * - Crystal/diamond shapes instead of circles
 * - Glow intensity based on activity level
 * - Perfect day sparkle effects
 * - Today with pulse ring
 * - Hover 3D rotation effect
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DiamondIcon, SparklesIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface DayData {
  date: string;
  mood?: number; // 1-5
  habitsCompleted?: number;
  totalHabits?: number;
  focusMinutes?: number;
  isPerfect?: boolean;
}

interface CrystalCalendarProps {
  data: Record<string, DayData>;
  onDayClick?: (date: string, data: DayData) => void;
  className?: string;
}

// Sparkle effect for perfect days
function PerfectSparkle({ delay }: { delay: number }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-white"
      style={{
        left: `${20 + Math.random() * 60}%`,
        top: `${20 + Math.random() * 60}%`,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [0, 1.5, 0],
        opacity: [0, 1, 0],
      }}
      transition={{
        duration: 1.5,
        delay,
        repeat: Infinity,
        repeatDelay: 2,
      }}
    />
  );
}

// Single crystal day
function CrystalDay({
  date,
  data,
  isToday,
  isCurrentMonth,
  onClick,
}: {
  date: Date;
  data?: DayData;
  isToday: boolean;
  isCurrentMonth: boolean;
  onClick?: () => void;
}) {
  const dayNum = date.getDate();

  // Calculate activity level (0-4) based on data
  const activityLevel = useMemo(() => {
    if (!data) return 0;
    let score = 0;
    if (data.mood) score += data.mood / 5;
    if (data.habitsCompleted && data.totalHabits) {
      score += data.habitsCompleted / data.totalHabits;
    }
    if (data.focusMinutes) score += Math.min(data.focusMinutes / 60, 1);
    return Math.min(Math.round((score / 3) * 4), 4) as 0 | 1 | 2 | 3 | 4;
  }, [data]);

  // Crystal styles based on activity
  const crystalStyles = {
    0: {
      bg: 'from-zinc-800/30 to-zinc-700/20',
      glow: 'none',
      border: 'border-zinc-700/30',
    },
    1: {
      bg: 'from-teal-900/40 to-teal-800/30',
      glow: '0 0 8px rgba(20, 184, 166, 0.3)',
      border: 'border-teal-700/40',
    },
    2: {
      bg: 'from-teal-700/50 to-emerald-600/40',
      glow: '0 0 12px rgba(16, 185, 129, 0.4)',
      border: 'border-emerald-600/50',
    },
    3: {
      bg: 'from-emerald-600/60 to-green-500/50',
      glow: '0 0 16px rgba(34, 197, 94, 0.5)',
      border: 'border-green-500/60',
    },
    4: {
      bg: 'from-green-500/70 to-emerald-400/60',
      glow: '0 0 20px rgba(52, 211, 153, 0.6), 0 0 30px rgba(16, 185, 129, 0.3)',
      border: 'border-emerald-400/70',
    },
  }[activityLevel];

  return (
    <motion.button
      className={cn(
        "relative w-10 h-10 flex items-center justify-center",
        "transition-all duration-200",
        !isCurrentMonth && "opacity-30",
        isCurrentMonth && "cursor-pointer"
      )}
      whileHover={isCurrentMonth ? { scale: 1.2, rotateY: 15, rotateX: -10 } : {}}
      whileTap={isCurrentMonth ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={!isCurrentMonth}
      style={{ perspective: 200 }}
    >
      {/* Crystal shape (rotated square) */}
      <motion.div
        className={cn(
          "absolute inset-1 rotate-45 rounded-sm border",
          "bg-gradient-to-br",
          crystalStyles.bg,
          crystalStyles.border
        )}
        style={{ boxShadow: crystalStyles.glow }}
        animate={
          activityLevel >= 2
            ? {
                boxShadow: [
                  crystalStyles.glow,
                  crystalStyles.glow.replace(/[\d.]+(?=\))/g, (m) =>
                    String(parseFloat(m) * 1.3)
                  ),
                  crystalStyles.glow,
                ],
              }
            : {}
        }
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Today indicator - pulse ring */}
      {isToday && (
        <motion.div
          className="absolute inset-0 rotate-45 rounded-sm border-2 border-white/60"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.6, 0.3, 0.6],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Day number */}
      <span
        className={cn(
          "relative z-10 text-xs font-medium",
          isToday ? "text-white font-bold" : "text-white/80"
        )}
      >
        {dayNum}
      </span>

      {/* Perfect day sparkles */}
      {data?.isPerfect && isCurrentMonth && (
        <>
          <PerfectSparkle delay={0} />
          <PerfectSparkle delay={0.5} />
          <PerfectSparkle delay={1} />
        </>
      )}
    </motion.button>
  );
}

export function CrystalCalendar({ data, onDayClick, className }: CrystalCalendarProps) {
  const { t, language } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get calendar data for current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }

    // Next month padding
    const remaining = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  // Weekday labels
  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Month navigation
  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Format month name
  const monthName = currentDate.toLocaleDateString(language, { month: 'long', year: 'numeric' });

  // Today's date string for comparison
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className={cn("relative overflow-hidden rounded-2xl p-4", className)}>
      {/* Crystal cave background */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at top,
            rgba(20, 184, 166, 0.1) 0%,
            #0f172a 40%,
            #020617 100%)`,
        }}
      />

      {/* Crystal formations decoration */}
      <div className="absolute top-0 left-0 right-0 h-20 pointer-events-none opacity-30">
        <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
          <polygon points="5,20 10,5 15,20" fill="rgba(20, 184, 166, 0.3)" />
          <polygon points="20,20 27,0 34,20" fill="rgba(16, 185, 129, 0.2)" />
          <polygon points="50,20 55,8 60,20" fill="rgba(52, 211, 153, 0.25)" />
          <polygon points="75,20 80,3 85,20" fill="rgba(20, 184, 166, 0.3)" />
          <polygon points="90,20 95,10 100,20" fill="rgba(16, 185, 129, 0.2)" />
        </svg>
      </div>

      {/* Header with month navigation */}
      <div className="relative flex items-center justify-between mb-4">
        <motion.button
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={goToPrevMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </motion.button>

        <motion.h3
          key={monthName}
          className="text-sm font-semibold text-emerald-200 flex items-center gap-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <DiamondIcon size="sm" />
          {monthName}
        </motion.h3>

        <motion.button
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={goToNextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Weekday headers */}
      <div className="relative grid grid-cols-7 gap-1 mb-2">
        {weekdays.map((day, i) => (
          <div
            key={i}
            className="text-center text-xs text-emerald-400/60 font-medium py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentDate.toISOString()}
          className="relative grid grid-cols-7 gap-1"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {calendarDays.map((day, i) => {
            const dateStr = day.date.toISOString().split('T')[0];
            return (
              <CrystalDay
                key={i}
                date={day.date}
                data={data[dateStr]}
                isToday={dateStr === todayStr}
                isCurrentMonth={day.isCurrentMonth}
                onClick={() => {
                  if (day.isCurrentMonth && onDayClick && data[dateStr]) {
                    onDayClick(dateStr, data[dateStr]);
                  }
                }}
              />
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Legend */}
      <div className="relative flex items-center justify-center gap-4 mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rotate-45 rounded-sm bg-gradient-to-br from-green-500/70 to-emerald-400/60 border border-emerald-400/70" />
          <span className="text-xs text-emerald-300/70">{t.active || 'Active'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rotate-45 rounded-sm bg-gradient-to-br from-zinc-800/30 to-zinc-700/20 border border-zinc-700/30" />
          <span className="text-xs text-zinc-400/70">{t.empty || 'Empty'}</span>
        </div>
        <div className="flex items-center gap-2">
          <SparklesIcon size="xs" />
          <span className="text-xs text-amber-300/70">{t.perfect || 'Perfect'}</span>
        </div>
      </div>

      {/* Bottom crystal glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at bottom, rgba(20, 184, 166, 0.1) 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}

export default CrystalCalendar;
