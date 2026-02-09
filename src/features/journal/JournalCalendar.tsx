import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
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

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface JournalCalendarProps {
  entryDates: Map<string, MoodType | undefined>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export function JournalCalendar({ entryDates, selectedDate, onSelectDate }: JournalCalendarProps) {
  const today = getToday();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t, isRTL } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [startOffset, setStartOffset] = useState(0);

  // Generate 28 days based on offset
  const days = useMemo(() => {
    const result: { date: string; day: number; dayOfWeek: number }[] = [];
    for (let i = 27 + startOffset; i >= startOffset; i--) {
      if (i < 0) continue;
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      result.push({ date: dateStr, day: d.getDate(), dayOfWeek: d.getDay() });
    }
    return result;
  }, [startOffset]);

  // Month label
  const monthLabel = useMemo(() => {
    if (days.length === 0) return '';
    const first = new Date(days[0].date + 'T00:00:00');
    const last = new Date(days[days.length - 1].date + 'T00:00:00');
    const opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    const firstMonth = first.toLocaleDateString(undefined, opts);
    const lastMonth = last.toLocaleDateString(undefined, opts);
    if (firstMonth === lastMonth) return firstMonth;
    return `${first.toLocaleDateString(undefined, { month: 'short' })} \u2014 ${last.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
  }, [days]);

  const canGoForward = startOffset > 0;

  // Scroll to end (today) on mount / offset change — RTL aware
  useEffect(() => {
    if (!scrollRef.current) return;
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      if (isRTL) {
        scrollRef.current.scrollLeft = 0;
      } else {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }
    });
  }, [isRTL, startOffset]);

  return (
    <div>
      {/* Header: month label + navigation */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => setStartOffset(prev => prev + 7)}
          className="p-1.5 rounded-lg hover:bg-muted/50 min-w-[32px] min-h-[32px] flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground capitalize">{monthLabel}</span>
          {startOffset > 0 && (
            <button
              onClick={() => { setStartOffset(0); onSelectDate(null); }}
              className="text-[10px] font-medium text-primary px-2 py-0.5 rounded-full bg-primary/10"
            >
              {ts.journalCalendarToday || 'Today'}
            </button>
          )}
        </div>

        <button
          onClick={() => setStartOffset(prev => Math.max(0, prev - 7))}
          disabled={!canGoForward}
          className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-30 min-w-[32px] min-h-[32px] flex items-center justify-center"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Day strip */}
      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1"
      >
        {days.map((d, index) => {
          const isToday = d.date === today;
          const isSelected = d.date === selectedDate;
          const mood = entryDates.get(d.date);
          const hasEntry = entryDates.has(d.date);

          return (
            <motion.button
              key={d.date}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.01, type: 'spring', stiffness: 500, damping: 30 }}
              onClick={() => onSelectDate(isSelected ? null : d.date)}
              className={cn(
                'flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] py-1.5 rounded-xl transition-all duration-200',
                isSelected
                  ? 'bg-gradient-to-b from-primary/20 to-primary/10 shadow-sm'
                  : 'hover:bg-muted/50',
                isToday && !isSelected && 'ring-1 ring-primary/40',
              )}
            >
              <span className="text-[9px] text-muted-foreground leading-none">
                {DAY_NAMES[d.dayOfWeek]}
              </span>
              <span className={cn(
                'text-xs font-semibold leading-none',
                isToday ? 'text-primary' : 'text-foreground',
              )}>
                {d.day}
              </span>
              {hasEntry ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    mood ? MOOD_COLORS[mood] : 'bg-primary/60',
                  )}
                />
              ) : (
                <div className="w-1.5 h-1.5" />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
