import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, getToday } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { MoodType } from '@/types';

const MOOD_COLORS: Record<string, string> = {
  great: 'bg-green-400',
  good: 'bg-emerald-400',
  okay: 'bg-amber-400',
  bad: 'bg-orange-400',
  terrible: 'bg-red-400',
};

const MOOD_RING: Record<string, string> = {
  great: 'ring-green-400/20',
  good: 'ring-emerald-400/20',
  okay: 'ring-amber-400/20',
  bad: 'ring-orange-400/20',
  terrible: 'ring-red-400/20',
};

/** RTL locales where week starts on Saturday */
const RTL_WEEK_START_SATURDAY = new Set(['ar', 'he']);

/** Get localized single-letter day names, starting from correct day of week */
function getLocalizedDayNames(locale: string, startSaturday: boolean): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  // Jan 5 2025 = Sunday (0), so we shift for startSaturday (6)
  const offset = startSaturday ? 6 : 0;
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(new Date(2025, 0, 5 + ((i + offset) % 7)))
  );
}

interface JournalCalendarFullProps {
  entryDates: Map<string, MoodType | undefined>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onToggleMode: () => void;
}

export function JournalCalendarFull({
  entryDates,
  selectedDate,
  onSelectDate,
  onToggleMode,
}: JournalCalendarFullProps) {
  const today = getToday();
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  // Current viewing month
  const [viewYear, setViewYear] = useState(() => parseInt(today.split('-')[0]));
  const [viewMonth, setViewMonth] = useState(() => parseInt(today.split('-')[1]) - 1); // 0-indexed
  const [direction, setDirection] = useState(0); // -1 = prev, 1 = next

  const startSaturday = RTL_WEEK_START_SATURDAY.has(language);
  const dayNames = useMemo(() => getLocalizedDayNames(language, startSaturday), [language, startSaturday]);

  // Count entries per date for the current month
  const entryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    entryDates.forEach((_, date) => {
      counts.set(date, (counts.get(date) || 0) + 1);
    });
    return counts;
  }, [entryDates]);

  // Generate calendar grid for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Compute day-of-week offset for first day
    let firstDayOfWeek = firstDay.getDay(); // 0 = Sunday
    if (startSaturday) {
      firstDayOfWeek = (firstDayOfWeek + 1) % 7; // Shift so Saturday = 0
    }

    const days: { date: string | null; day: number; isToday: boolean }[] = [];

    // Empty cells before first day
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ date: null, day: 0, isToday: false });
    }

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ date: dateStr, day: d, isToday: dateStr === today });
    }

    return days;
  }, [viewYear, viewMonth, today, startSaturday]);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString(language, {
    month: 'long',
    year: 'numeric',
  });

  const isCurrentMonth = viewYear === parseInt(today.split('-')[0]) &&
    viewMonth === parseInt(today.split('-')[1]) - 1;

  const navigateMonth = (delta: number) => {
    setDirection(delta);
    let newMonth = viewMonth + delta;
    let newYear = viewYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    // Don't go past current month
    const todayYear = parseInt(today.split('-')[0]);
    const todayMonth = parseInt(today.split('-')[1]) - 1;
    if (newYear > todayYear || (newYear === todayYear && newMonth > todayMonth)) return;
    setViewYear(newYear);
    setViewMonth(newMonth);
  };

  const goToToday = () => {
    setDirection(1);
    setViewYear(parseInt(today.split('-')[0]));
    setViewMonth(parseInt(today.split('-')[1]) - 1);
    onSelectDate(null);
  };

  const canGoForward = !isCurrentMonth;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-1.5 rounded-lg hover:bg-muted/50 min-w-[32px] min-h-[32px] flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground capitalize">{monthLabel}</span>
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              className="text-[10px] font-medium text-primary px-2 py-0.5 rounded-full bg-primary/10"
            >
              {ts.journalCalendarToday || 'Today'}
            </button>
          )}
          <button
            onClick={onToggleMode}
            className="p-1 rounded-md hover:bg-muted/50"
            aria-label="Switch to strip view"
          >
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground/60" />
          </button>
        </div>

        <button
          onClick={() => navigateMonth(1)}
          disabled={!canGoForward}
          className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-30 min-w-[32px] min-h-[32px] flex items-center justify-center"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map((name, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-muted-foreground/60 py-0.5">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${viewYear}-${viewMonth}`}
          initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="grid grid-cols-7 gap-0.5"
        >
          {calendarDays.map((cell, idx) => {
            if (!cell.date) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const mood = entryDates.get(cell.date);
            const hasEntry = entryDates.has(cell.date);
            const count = entryCounts.get(cell.date) || 0;
            const isSelected = cell.date === selectedDate;
            const isFuture = cell.date > today;

            return (
              <button
                key={cell.date}
                onClick={() => {
                  if (isFuture) return;
                  onSelectDate(isSelected ? null : cell.date);
                }}
                disabled={isFuture}
                className={cn(
                  'aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5',
                  'transition-all duration-150 relative',
                  'min-h-[36px]',
                  isFuture && 'opacity-30',
                  isSelected
                    ? 'bg-primary/15 shadow-sm ring-1 ring-primary/30'
                    : 'hover:bg-muted/40',
                  cell.isToday && !isSelected && 'ring-1 ring-primary/40',
                )}
              >
                <span className={cn(
                  'text-[11px] font-medium leading-none',
                  cell.isToday ? 'text-primary font-bold' : 'text-foreground',
                  isFuture && 'text-muted-foreground/50',
                )}>
                  {cell.day}
                </span>
                {hasEntry && (
                  <div className="flex items-center gap-px">
                    <div className={cn(
                      'w-2 h-2 rounded-full ring-1',
                      mood ? MOOD_COLORS[mood] : 'bg-primary/60',
                      mood ? MOOD_RING[mood] : 'ring-primary/20',
                      cell.isToday && 'animate-pulse-subtle',
                    )} />
                    {count > 1 && (
                      <span className="text-[7px] text-muted-foreground/60 font-medium leading-none">
                        {count}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
