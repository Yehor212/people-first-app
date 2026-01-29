/**
 * TimeAwarenessBadge - Persistent time awareness widget for ADHD
 * Shows time remaining until key events (end of workday, next scheduled event)
 * Helps combat "time blindness" by keeping users aware of time passing
 */

import { useState, useEffect, useMemo } from 'react';
import { Clock, Sunset, Coffee, Moon, Sun, Calendar } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn, formatDate } from '@/lib/utils';
import { ScheduleEvent } from '@/types';
import { getLocale } from '@/lib/timeUtils';

interface TimeAwarenessBadgeProps {
  scheduleEvents?: ScheduleEvent[];
  workdayEnd?: { hour: number; minute: number }; // Default: 18:00
  onClick?: () => void;
}

// Get time of day context
function getTimeContext(hour: number): {
  period: 'morning' | 'afternoon' | 'evening' | 'night';
  icon: typeof Sun;
  emoji: string;
} {
  if (hour >= 5 && hour < 12) return { period: 'morning', icon: Sun, emoji: '🌅' };
  if (hour >= 12 && hour < 17) return { period: 'afternoon', icon: Coffee, emoji: '☀️' };
  if (hour >= 17 && hour < 21) return { period: 'evening', icon: Sunset, emoji: '🌆' };
  return { period: 'night', icon: Moon, emoji: '🌙' };
}

// Format time remaining in a human-friendly way
function formatTimeRemaining(minutes: number, t: Record<string, string>): string {
  if (minutes < 0) return t.timePassed || 'Time passed';
  if (minutes === 0) return t.timeNow || 'Now!';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}${t.minutesShort || 'm'}`;
  }
  if (mins === 0) {
    return `${hours}${t.hoursShort || 'h'}`;
  }
  return `${hours}${t.hoursShort || 'h'} ${mins}${t.minutesShort || 'm'}`;
}

export function TimeAwarenessBadge({
  scheduleEvents = [],
  workdayEnd = { hour: 18, minute: 0 },
  onClick,
}: TimeAwarenessBadgeProps) {
  const { t, language } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const now = currentTime;
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const timeContext = getTimeContext(currentHour);
  const TimeIcon = timeContext.icon;

  // Calculate minutes until workday end
  const minutesUntilWorkdayEnd = useMemo(() => {
    const workdayEndMinutes = workdayEnd.hour * 60 + workdayEnd.minute;
    const currentMinutes = currentHour * 60 + currentMinute;
    return workdayEndMinutes - currentMinutes;
  }, [currentHour, currentMinute, workdayEnd]);

  // Find next scheduled event
  const nextEvent = useMemo(() => {
    const today = formatDate(now);
    const todayEvents = scheduleEvents
      .filter(e => e.date === today)
      .filter(e => {
        const eventMinutes = e.startHour * 60 + e.startMinute;
        const currentMinutes = currentHour * 60 + currentMinute;
        return eventMinutes > currentMinutes;
      })
      .sort((a, b) => {
        const aMinutes = a.startHour * 60 + a.startMinute;
        const bMinutes = b.startHour * 60 + b.startMinute;
        return aMinutes - bMinutes;
      });

    if (todayEvents.length === 0) return null;

    const event = todayEvents[0];
    const eventMinutes = event.startHour * 60 + event.startMinute;
    const currentMinutes = currentHour * 60 + currentMinute;

    return {
      ...event,
      minutesUntil: eventMinutes - currentMinutes,
    };
  }, [scheduleEvents, currentHour, currentMinute, now]);

  // Determine what to show
  const isWorkHours = currentHour >= 9 && currentHour < workdayEnd.hour;
  const isAlmostDone = minutesUntilWorkdayEnd <= 60 && minutesUntilWorkdayEnd > 0;
  const urgencyClass = isAlmostDone ? 'animate-pulse' : '';

  // Get dynamic message
  const getMessage = () => {
    if (nextEvent && nextEvent.minutesUntil <= 30) {
      const timeStr = formatTimeRemaining(nextEvent.minutesUntil, t);
      return {
        primary: `${nextEvent.emoji || '📅'} ${nextEvent.title}`,
        secondary: `${t.timeIn || 'in'} ${timeStr}`,
        urgent: nextEvent.minutesUntil <= 10,
      };
    }

    if (isWorkHours && minutesUntilWorkdayEnd > 0) {
      const timeStr = formatTimeRemaining(minutesUntilWorkdayEnd, t);
      return {
        primary: t.timeUntilEndOfDay || 'Until end of day',
        secondary: timeStr,
        urgent: isAlmostDone,
      };
    }

    // Time of day context
    const periodLabels = {
      morning: t.morning || 'Morning',
      afternoon: t.afternoon || 'Afternoon',
      evening: t.evening || 'Evening',
      night: t.night || 'Night',
    };

    return {
      primary: periodLabels[timeContext.period],
      secondary: now.toLocaleTimeString(getLocale(language), { hour: '2-digit', minute: '2-digit' }),
      urgent: false,
    };
  };

  const message = getMessage();

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
        "bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20",
        "border border-primary/20 hover:border-primary/30",
        urgencyClass
      )}
    >
      {/* Time icon */}
      <div className={cn(
        "p-2 rounded-xl",
        message.urgent ? "bg-amber-500/20 text-amber-600" : "bg-primary/20 text-primary"
      )}>
        {nextEvent && nextEvent.minutesUntil <= 30 ? (
          <Calendar className="w-5 h-5" />
        ) : (
          <TimeIcon className="w-5 h-5" />
        )}
      </div>

      {/* Time info */}
      <div className="text-left">
        <div className={cn(
          "text-xs font-medium",
          message.urgent ? "text-amber-600" : "text-muted-foreground"
        )}>
          {message.primary}
        </div>
        <div className={cn(
          "text-lg font-bold",
          message.urgent ? "text-amber-600" : "text-foreground"
        )}>
          {message.secondary}
        </div>
      </div>

      {/* Visual time indicator */}
      {isWorkHours && minutesUntilWorkdayEnd > 0 && (
        <div className="ml-auto">
          <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isAlmostDone ? "bg-amber-500" : "bg-gradient-to-r from-primary to-accent"
              )}
              style={{
                width: `${Math.max(0, Math.min(100, (1 - minutesUntilWorkdayEnd / (9 * 60)) * 100))}%`
              }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
