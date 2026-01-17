/**
 * GlobalScheduleBar - Compact schedule display visible on all tabs
 * Shows current time and upcoming/current event
 */

import { useState, useEffect, useMemo } from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { ScheduleEvent } from '@/types';

interface GlobalScheduleBarProps {
  events: ScheduleEvent[];
  onTap?: () => void;
}

export function GlobalScheduleBar({ events, onTap }: GlobalScheduleBarProps) {
  const { t } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  // Format time
  const formatTime = (hour: number, minute: number = 0) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Find current event
  const currentEvent = useMemo(() => {
    const nowMinutes = currentHour * 60 + currentMinute;
    return events.find(event => {
      const startMinutes = event.startHour * 60 + event.startMinute;
      const endMinutes = event.endHour * 60 + event.endMinute;
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    });
  }, [events, currentHour, currentMinute]);

  // Find next upcoming event
  const nextEvent = useMemo(() => {
    const nowMinutes = currentHour * 60 + currentMinute;
    const upcoming = events
      .filter(event => {
        const startMinutes = event.startHour * 60 + event.startMinute;
        return startMinutes > nowMinutes;
      })
      .sort((a, b) => {
        const aStart = a.startHour * 60 + a.startMinute;
        const bStart = b.startHour * 60 + b.startMinute;
        return aStart - bStart;
      });
    return upcoming[0] || null;
  }, [events, currentHour, currentMinute]);

  // Calculate time until next event
  const timeUntilNext = useMemo(() => {
    if (!nextEvent) return null;
    const nowMinutes = currentHour * 60 + currentMinute;
    const startMinutes = nextEvent.startHour * 60 + nextEvent.startMinute;
    const diff = startMinutes - nowMinutes;
    if (diff <= 0) return null;

    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;

    if (hours > 0) {
      return `${hours}${t.hoursShort || 'h'} ${minutes}${t.minutesShort || 'm'}`;
    }
    return `${minutes}${t.minutesShort || 'm'}`;
  }, [nextEvent, currentHour, currentMinute, t]);

  // Don't show if no events
  if (events.length === 0) return null;

  return (
    <button
      onClick={onTap}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all",
        "bg-card/80 backdrop-blur-sm border border-border/50",
        "hover:bg-card hover:border-primary/30",
        "active:scale-[0.98]"
      )}
    >
      {/* Clock icon with time */}
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center",
          currentEvent ? "bg-primary/20" : "bg-muted"
        )}>
          <Clock className={cn(
            "w-4 h-4",
            currentEvent ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
        <span className="text-lg font-bold text-foreground">
          {formatTime(currentHour, currentMinute)}
        </span>
      </div>

      {/* Current or next event */}
      <div className="flex-1 min-w-0">
        {currentEvent ? (
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: currentEvent.color }}
            />
            <span className="text-sm font-medium truncate">
              {currentEvent.emoji} {currentEvent.title}
            </span>
            <span className="text-xs text-muted-foreground">
              {t.timeNow || 'now'}
            </span>
          </div>
        ) : nextEvent ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground truncate">
              {nextEvent.emoji} {nextEvent.title}
            </span>
            <span className="text-xs text-primary font-medium">
              {t.timeIn || 'in'} {timeUntilNext}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            {t.scheduleEmpty || 'No upcoming events'}
          </span>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}
