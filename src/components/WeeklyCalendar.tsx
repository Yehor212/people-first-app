import { useMemo } from 'react';
import { MoodEntry, Habit } from '@/types';
import { cn, getToday } from '@/lib/utils';
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

export function WeeklyCalendar({ moods, habits }: WeeklyCalendarProps) {
  const { t } = useLanguage();
  
  const dayNames = [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];
  
  const weekDays = useMemo(() => {
    const today = new Date();
    const days = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const mood = moods.find(m => m.date === dateStr);
      const completedHabits = habits.filter(h => h.completedDates.includes(dateStr)).length;
      
      days.push({
        date: dateStr,
        dayName: dayNames[date.getDay()],
        dayNum: date.getDate(),
        isToday: dateStr === getToday(),
        mood: mood?.mood,
        completedHabits,
      });
    }
    
    return days;
  }, [moods, habits, dayNames]);

  return (
    <div className="bg-card rounded-2xl p-6 zen-shadow-card animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground mb-4">{t.thisWeek}</h3>
      
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <div
            key={day.date}
            className={cn(
              "flex flex-col items-center p-2 rounded-xl transition-all",
              day.isToday ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-secondary"
            )}
          >
            <span className="text-xs text-muted-foreground mb-1">{day.dayName}</span>
            <span className={cn(
              "text-lg font-semibold mb-2",
              day.isToday ? "text-primary" : "text-foreground"
            )}>
              {day.dayNum}
            </span>
            
            {day.mood ? (
              <div className={cn(
                "w-6 h-6 rounded-full mb-1",
                moodColors[day.mood]
              )} />
            ) : (
              <div className="w-6 h-6 rounded-full bg-secondary mb-1" />
            )}
            
            <div className="flex gap-0.5">
              {habits.slice(0, 3).map((habit) => (
                <div
                  key={habit.id}
                  className={cn(
                    "w-2 h-2 rounded-full",
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
}
