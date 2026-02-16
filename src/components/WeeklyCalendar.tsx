import { memo, useMemo } from 'react';
import { MoodEntry, Habit } from '@/types';
import { cn, getToday, formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface WeeklyCalendarProps {
  moods: MoodEntry[];
  habits: Habit[];
}

const moodColors: Record<string, string> = {
  great: 'bg-mood-great',
  good: 'bg-mood-good',
  okay: 'bg-mood-okay',
  bad: 'bg-mood-bad',
  terrible: 'bg-mood-terrible',
};

export const WeeklyCalendar = memo(function WeeklyCalendar({ moods, habits }: WeeklyCalendarProps) {
  const { t } = useLanguage();
  
  const dayNames = [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];
  
  // Use Map for O(1) mood lookups instead of O(n) find()
  const moodsByDate = useMemo(() =>
    new Map(moods.map(m => [m.date, m])),
  [moods]);

  // Pre-compute habit completion sets for O(1) lookups
  const habitCompletionsByDate = useMemo(() => {
    const map = new Map<string, number>();
    habits.forEach(habit => {
      habit.completedDates.forEach(date => {
        map.set(date, (map.get(date) || 0) + 1);
      });
    });
    return map;
  }, [habits]);

  const weekDays = useMemo(() => {
    const today = new Date();
    const todayStr = getToday();
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = formatDate(date);

      // O(1) lookups with Map
      const mood = moodsByDate.get(dateStr);
      const completedHabits = habitCompletionsByDate.get(dateStr) || 0;

      days.push({
        date: dateStr,
        dayName: dayNames[date.getDay()],
        dayNum: date.getDate(),
        isToday: dateStr === todayStr,
        mood: mood?.mood,
        completedHabits,
      });
    }

    return days;
  }, [moodsByDate, habitCompletionsByDate, dayNames]);

  return (
    <div className="bg-card rounded-2xl p-3 sm:p-6 zen-shadow-card animate-fade-in">
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">{t.thisWeek}</h3>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {weekDays.map((day) => (
          <div
            key={day.date}
            className={cn(
              "flex flex-col items-center p-1 sm:p-2 rounded-lg sm:rounded-xl transition-all",
              day.isToday ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-secondary"
            )}
          >
            <span className="text-xs sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">{day.dayName.slice(0, 2)}</span>
            <span className={cn(
              "text-sm sm:text-lg font-semibold mb-1 sm:mb-2",
              day.isToday ? "text-primary" : "text-foreground"
            )}>
              {day.dayNum}
            </span>

            {day.mood ? (
              <div className={cn(
                "w-4 h-4 sm:w-6 sm:h-6 rounded-full mb-0.5 sm:mb-1",
                moodColors[day.mood]
              )} />
            ) : (
              <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-secondary mb-0.5 sm:mb-1" />
            )}

            <div className="flex gap-0.5">
              {habits.slice(0, 3).map((habit) => (
                <div
                  key={habit.id}
                  className={cn(
                    "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full",
                    habit.completedDates.includes(day.date)
                      ? habit.color
                      : "bg-secondary"
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
