/**
 * CalendarTab — Year/month calendar with crystal grid + selected day panel
 * 4 useState, 4 useMemo (calendar-specific only).
 */

import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { getDaysInMonth, cn } from '@/lib/utils';
import { MoodEntry, Habit, GratitudeEntry } from '@/types';
import { safeParseInt } from '@/lib/validation';
import { CalendarGrid } from './CalendarGrid';
import { SelectedDayPanel } from './SelectedDayPanel';

interface CalendarTabProps {
  moodsByDate: Map<string, MoodEntry[]>;
  moodByDate: Map<string, MoodEntry>;
  focusMinutesByDate: Map<string, number>;
  gratitudeByDate: Map<string, GratitudeEntry[]>;
  habitCompletionMap: Map<string, string[]>;
  habits: Habit[];
  emotionLabels: Record<string, string>;
  todayKey: string;
  monthNames: string[];
  t: Record<string, string>;
  language: string;
}

export function CalendarTab({
  moodsByDate, moodByDate, focusMinutesByDate, gratitudeByDate, habitCompletionMap,
  habits, emotionLabels, todayKey, monthNames, t, language,
}: CalendarTabProps) {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey);
  const [showMonthSelector, setShowMonthSelector] = useState(false);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    const currentYear = new Date().getFullYear();
    const addYear = (date: string) => {
      const year = safeParseInt(date.split('-')[0], currentYear, 2000, 2100);
      set.add(year);
    };
    [...moodByDate.keys()].forEach(addYear);
    [...focusMinutesByDate.keys()].forEach(addYear);
    [...gratitudeByDate.keys()].forEach(addYear);
    [...habitCompletionMap.keys()].forEach(addYear);
    set.add(currentYear);
    set.add(selectedYear);
    const years = Array.from(set).sort((a, b) => b - a);
    return years.length > 0 ? years : [currentYear];
  }, [moodByDate, focusMinutesByDate, gratitudeByDate, habitCompletionMap, selectedYear]);

  const yearStats = useMemo(() => {
    const prefix = `${selectedYear}-`;
    let moodCount = 0;
    let focusMinutes = 0;
    let habitCompletions = 0;
    let gratitudeCount = 0;

    moodByDate.forEach((_, date) => {
      if (date.startsWith(prefix)) moodCount += 1;
    });
    focusMinutesByDate.forEach((minutes, date) => {
      if (date.startsWith(prefix)) focusMinutes += minutes;
    });
    habitCompletionMap.forEach((list, date) => {
      if (date.startsWith(prefix)) habitCompletions += list.length;
    });
    gratitudeByDate.forEach((list, date) => {
      if (date.startsWith(prefix)) gratitudeCount += list.length;
    });

    return { moodCount, focusMinutes, habitCompletions, gratitudeCount };
  }, [selectedYear, moodByDate, focusMinutesByDate, habitCompletionMap, gratitudeByDate]);

  const calendarDays = useMemo(() => {
    const days = getDaysInMonth(selectedYear, selectedMonth);
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

    const cells: Array<{ dateKey?: string; day?: number }> = [];
    for (let i = 0; i < firstDay; i += 1) {
      cells.push({});
    }
    for (let day = 1; day <= days; day += 1) {
      const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
      cells.push({ dateKey, day });
    }
    return cells;
  }, [selectedYear, selectedMonth]);

  const selectedDayData = useMemo(() => {
    if (!selectedDate) return null;
    return {
      moods: moodsByDate.get(selectedDate) || [],
      mood: moodByDate.get(selectedDate),
      focusMinutes: focusMinutesByDate.get(selectedDate) || 0,
      habits: habitCompletionMap.get(selectedDate) || [],
      gratitude: gratitudeByDate.get(selectedDate) || []
    };
  }, [selectedDate, moodsByDate, moodByDate, focusMinutesByDate, habitCompletionMap, gratitudeByDate]);

  const handleMonthShift = (delta: number) => {
    setSelectedDate(null);
    setSelectedMonth((prev) => {
      const next = prev + delta;
      if (next < 0) {
        setSelectedYear((year) => year - 1);
        return 11;
      }
      if (next > 11) {
        setSelectedYear((year) => year + 1);
        return 0;
      }
      return next;
    });
  };

  return (
    <>
      {/* Year Calendar - Crystal Premium Design */}
      <div className="relative overflow-hidden rounded-2xl p-3 sm:p-6 shadow-lg shadow-black/10 dark:shadow-none ring-1 ring-black/5 dark:ring-0">
        {/* Theme-aware crystal cave background */}
        <div className="absolute inset-0 bg-gradient-to-b from-teal-50 via-emerald-50/80 to-slate-100 dark:bg-none" />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background: `radial-gradient(ellipse at top,
              rgba(20, 184, 166, 0.1) 0%,
              #0f172a 40%,
              #020617 100%)`,
          }}
        />
        {/* Content wrapper */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="relative">
              <div className="p-2.5 bg-gradient-to-br from-primary to-accent rounded-xl shadow-lg shadow-primary/20">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-1 -end-1 w-2 h-2 bg-primary/80 rounded-full animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-foreground">{t.calendarTitle}</h3>
          </div>

          {/* Year & Month Selector */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <label className="text-sm text-muted-foreground">{t.calendarYear}</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(safeParseInt(e.target.value, new Date().getFullYear(), 2000, 2100))}
              className="p-2 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <div className="ms-auto flex items-center gap-2">
              <button
                onClick={() => handleMonthShift(-1)}
                aria-label={t.calendarPrevMonth}
                className="p-2 rounded-xl bg-secondary hover:bg-primary/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowMonthSelector(!showMonthSelector)}
                aria-expanded={showMonthSelector}
                aria-label={t.calendarSelectMonth || 'Select month'}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 text-sm font-medium hover:from-primary/30 hover:to-accent/30 transition-all flex items-center gap-2"
              >
                {monthNames[selectedMonth]} {selectedYear}
                {showMonthSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleMonthShift(1)}
                aria-label={t.calendarNextMonth}
                className="p-2 rounded-xl bg-secondary hover:bg-primary/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Month Selector Grid */}
          {showMonthSelector && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5 animate-fade-in" role="listbox" aria-label={t.calendarSelectMonth || 'Select month'}>
              {monthNames.map((month, index) => (
                <button
                  key={month}
                  onClick={() => {
                    setSelectedMonth(index);
                    setSelectedDate(null);
                    setShowMonthSelector(false);
                  }}
                  aria-selected={selectedMonth === index}
                  role="option"
                  className={cn(
                    "px-2 py-2.5 rounded-xl text-xs font-medium transition-all",
                    selectedMonth === index
                      ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg"
                      : "bg-secondary text-muted-foreground hover:bg-primary/10"
                  )}
                >
                  {month}
                </button>
              ))}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
            <div className="text-center p-2 sm:p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors">
              <p className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--chart-mood))] to-[hsl(var(--chart-mood)/0.7)]">{yearStats.moodCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{t.moodEntries}</p>
            </div>
            <div className="text-center p-2 sm:p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors">
              <p className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--chart-focus))] to-[hsl(var(--chart-focus)/0.7)]">{yearStats.focusMinutes}</p>
              <p className="text-xs text-muted-foreground mt-1">{t.focusMinutes}</p>
            </div>
            <div className="text-center p-2 sm:p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors">
              <p className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--chart-habit))] to-[hsl(var(--chart-habit)/0.7)]">{yearStats.habitCompletions}</p>
              <p className="text-xs text-muted-foreground mt-1">{t.habitsCompleted}</p>
            </div>
            <div className="text-center p-2 sm:p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors">
              <p className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent/70">{yearStats.gratitudeCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{t.gratitudes}</p>
            </div>
          </div>

          <CalendarGrid
            calendarDays={calendarDays}
            moodByDate={moodByDate}
            focusMinutesByDate={focusMinutesByDate}
            habitCompletionMap={habitCompletionMap}
            gratitudeByDate={gratitudeByDate}
            todayKey={todayKey}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            monthNames={monthNames}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            t={t}
          />

          <SelectedDayPanel
            selectedDate={selectedDate}
            selectedDayData={selectedDayData}
            habits={habits}
            emotionLabels={emotionLabels}
            t={t}
            language={language}
          />
        </div>{/* End content wrapper */}
      </div>
    </>
  );
}
