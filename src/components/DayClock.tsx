import { useState, useEffect, useMemo } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { getToday, cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sun, Sunrise, Moon, Clock, Sparkles, Target, Brain, Heart } from 'lucide-react';

interface DayClockProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  onTimeBlockClick?: (period: 'morning' | 'afternoon' | 'evening') => void;
}

// Time configuration
const DAY_START = 6; // 6 AM
const DAY_END = 23; // 11 PM
const TOTAL_HOURS = DAY_END - DAY_START;

// Time periods with colors
const TIME_PERIODS = [
  {
    id: 'morning',
    start: 6,
    end: 12,
    label: 'Утро',
    labelEn: 'Morning',
    icon: Sunrise,
    gradient: 'from-amber-400/30 via-orange-300/20 to-yellow-200/30',
    activeGradient: 'from-amber-400/50 via-orange-300/40 to-yellow-200/50',
    iconColor: 'text-amber-500',
  },
  {
    id: 'afternoon',
    start: 12,
    end: 18,
    label: 'День',
    labelEn: 'Afternoon',
    icon: Sun,
    gradient: 'from-blue-400/30 via-cyan-300/20 to-sky-200/30',
    activeGradient: 'from-blue-400/50 via-cyan-300/40 to-sky-200/50',
    iconColor: 'text-blue-500',
  },
  {
    id: 'evening',
    start: 18,
    end: 23,
    label: 'Вечер',
    labelEn: 'Evening',
    icon: Moon,
    gradient: 'from-purple-400/30 via-indigo-300/20 to-violet-200/30',
    activeGradient: 'from-purple-400/50 via-indigo-300/40 to-violet-200/50',
    iconColor: 'text-purple-500',
  },
];

// Activity icons
const ACTIVITY_ICONS = {
  mood: { icon: Sparkles, color: 'text-purple-400', bg: 'bg-purple-500' },
  habit: { icon: Target, color: 'text-green-400', bg: 'bg-green-500' },
  focus: { icon: Brain, color: 'text-blue-400', bg: 'bg-blue-500' },
  gratitude: { icon: Heart, color: 'text-pink-400', bg: 'bg-pink-500' },
};

interface ActivityMarker {
  id: string;
  type: 'mood' | 'habit' | 'focus' | 'gratitude';
  hour: number;
  minute: number;
  emoji?: string;
  label?: string;
}

export function DayClock({
  moods,
  habits,
  focusSessions,
  gratitudeEntries,
  onTimeBlockClick
}: DayClockProps) {
  const { t, language } = useLanguage();
  const today = getToday();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  // Calculate progress percentage (0-100)
  const dayProgress = useMemo(() => {
    const totalMinutes = (currentHour - DAY_START) * 60 + currentMinute;
    const maxMinutes = TOTAL_HOURS * 60;
    return Math.max(0, Math.min(100, (totalMinutes / maxMinutes) * 100));
  }, [currentHour, currentMinute]);

  // Get current period
  const currentPeriod = useMemo(() => {
    if (currentHour >= 6 && currentHour < 12) return 'morning';
    if (currentHour >= 12 && currentHour < 18) return 'afternoon';
    return 'evening';
  }, [currentHour]);

  // Collect activity markers for today
  const activityMarkers = useMemo(() => {
    const markers: ActivityMarker[] = [];

    // Mood entries
    moods
      .filter(m => m.date === today)
      .forEach(m => {
        const date = new Date(m.timestamp);
        const moodEmojis: Record<string, string> = {
          great: '😄', good: '🙂', okay: '😐', bad: '😔', terrible: '😢'
        };
        markers.push({
          id: m.id,
          type: 'mood',
          hour: date.getHours(),
          minute: date.getMinutes(),
          emoji: moodEmojis[m.mood],
        });
      });

    // Completed habits
    habits
      .filter(h => h.completedDates?.includes(today))
      .forEach(h => {
        // Use noon as default time for habits
        markers.push({
          id: h.id,
          type: 'habit',
          hour: 12 + Math.random() * 6, // Spread across afternoon
          minute: Math.floor(Math.random() * 60),
          emoji: h.emoji,
          label: h.name,
        });
      });

    // Focus sessions
    focusSessions
      .filter(s => s.date === today)
      .forEach((s, index) => {
        markers.push({
          id: s.id,
          type: 'focus',
          hour: 9 + index * 2, // Spread across day
          minute: 30,
          label: `${s.duration}min`,
        });
      });

    // Gratitude entries
    gratitudeEntries
      .filter(g => g.date === today)
      .forEach(g => {
        markers.push({
          id: g.id,
          type: 'gratitude',
          hour: 21, // Usually evening
          minute: 0,
        });
      });

    return markers;
  }, [moods, habits, focusSessions, gratitudeEntries, today]);

  // Convert hour to position percentage
  const hourToPosition = (hour: number, minute: number = 0) => {
    const totalMinutes = (hour - DAY_START) * 60 + minute;
    const maxMinutes = TOTAL_HOURS * 60;
    return Math.max(0, Math.min(100, (totalMinutes / maxMinutes) * 100));
  };

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(language === 'ru' ? 'ru-RU' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="bg-card rounded-2xl p-4 zen-shadow-card animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">
              {t.dayTimeline || 'Your Day'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {formatTime(currentTime)}
            </p>
          </div>
        </div>

        {/* Activity summary */}
        <div className="flex items-center gap-1.5">
          {activityMarkers.length > 0 && (
            <div className="flex -space-x-1">
              {Array.from(new Set(activityMarkers.map(a => a.type))).slice(0, 4).map(type => {
                const config = ACTIVITY_ICONS[type];
                return (
                  <div
                    key={type}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center",
                      config.bg, "bg-opacity-20 ring-2 ring-card"
                    )}
                  >
                    <config.icon className={cn("w-3 h-3", config.color)} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Timeline bar */}
      <div className="relative h-14 rounded-xl overflow-hidden bg-secondary/30">
        {/* Time period backgrounds */}
        {TIME_PERIODS.map(period => {
          const startPos = hourToPosition(period.start);
          const endPos = hourToPosition(period.end);
          const width = endPos - startPos;
          const isCurrentPeriod = period.id === currentPeriod;
          const PeriodIcon = period.icon;

          return (
            <button
              key={period.id}
              onClick={() => onTimeBlockClick?.(period.id as 'morning' | 'afternoon' | 'evening')}
              className={cn(
                "absolute top-0 h-full transition-all duration-300",
                "bg-gradient-to-r",
                isCurrentPeriod ? period.activeGradient : period.gradient,
                "hover:brightness-110 cursor-pointer",
                "border-r border-white/10 last:border-r-0"
              )}
              style={{
                left: `${startPos}%`,
                width: `${width}%`
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center opacity-60">
                <PeriodIcon className={cn("w-5 h-5", period.iconColor)} />
              </div>

              {/* Period label - only show on wider blocks */}
              <span className={cn(
                "absolute bottom-1 left-1/2 -translate-x-1/2",
                "text-[10px] font-medium text-foreground/60 whitespace-nowrap",
                width < 20 && "hidden"
              )}>
                {language === 'ru' ? period.label : period.labelEn}
              </span>
            </button>
          );
        })}

        {/* Activity markers */}
        {activityMarkers.map((marker, index) => {
          const position = hourToPosition(marker.hour, marker.minute);
          if (position < 0 || position > 100) return null;

          const config = ACTIVITY_ICONS[marker.type];

          return (
            <div
              key={`${marker.id}-${index}`}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 group"
              style={{ left: `${position}%` }}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center",
                "bg-card shadow-md ring-2 ring-white/20",
                "transition-transform hover:scale-125 cursor-pointer"
              )}>
                {marker.emoji ? (
                  <span className="text-sm">{marker.emoji}</span>
                ) : (
                  <config.icon className={cn("w-3.5 h-3.5", config.color)} />
                )}
              </div>

              {/* Tooltip */}
              <div className={cn(
                "absolute bottom-full left-1/2 -translate-x-1/2 mb-2",
                "px-2 py-1 bg-popover text-popover-foreground rounded-lg text-xs",
                "opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
                "whitespace-nowrap shadow-lg z-20"
              )}>
                {marker.label || marker.type}
              </div>
            </div>
          );
        })}

        {/* Current time indicator */}
        {dayProgress > 0 && dayProgress < 100 && (
          <div
            className="absolute top-0 h-full w-0.5 z-20 transition-all duration-1000"
            style={{ left: `${dayProgress}%` }}
          >
            {/* Glowing line */}
            <div className="absolute inset-0 bg-primary shadow-[0_0_10px_2px] shadow-primary/50" />

            {/* Pulse dot at top */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse shadow-lg shadow-primary/50" />
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-primary animate-ping opacity-50" />
            </div>

            {/* Time label */}
            <div className={cn(
              "absolute -top-6 left-1/2 -translate-x-1/2",
              "px-1.5 py-0.5 bg-primary text-primary-foreground rounded text-[10px] font-bold",
              "whitespace-nowrap shadow-md"
            )}>
              {formatTime(currentTime)}
            </div>
          </div>
        )}

        {/* Progress fill (past time) */}
        <div
          className="absolute top-0 left-0 h-full bg-foreground/5 transition-all duration-1000"
          style={{ width: `${dayProgress}%` }}
        />
      </div>

      {/* Hour markers */}
      <div className="relative h-4 mt-1">
        {[6, 9, 12, 15, 18, 21].map(hour => {
          const position = hourToPosition(hour);
          return (
            <span
              key={hour}
              className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
              style={{ left: `${position}%` }}
            >
              {hour}:00
            </span>
          );
        })}
      </div>

      {/* Quick stats row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-4">
          {Object.entries(ACTIVITY_ICONS).map(([type, config]) => {
            const count = activityMarkers.filter(a => a.type === type).length;
            if (count === 0) return null;

            return (
              <div key={type} className="flex items-center gap-1.5">
                <config.icon className={cn("w-3.5 h-3.5", config.color)} />
                <span className="text-xs font-medium text-foreground">{count}</span>
              </div>
            );
          })}
        </div>

        <span className="text-xs text-muted-foreground">
          {Math.round(dayProgress)}% {t.dayComplete || 'of day'}
        </span>
      </div>
    </div>
  );
}
