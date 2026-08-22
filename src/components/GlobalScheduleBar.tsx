/**
 * GlobalScheduleBar - Compact schedule display visible on all tabs
 * Shows current time and upcoming/current event
 */

import { memo, useState, useEffect, useMemo } from "react";
import { Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScheduleEvent } from "@/types";

interface GlobalScheduleBarProps {
  events: ScheduleEvent[];
  onTap?: () => void;
}

export const GlobalScheduleBar = memo(function GlobalScheduleBar({
  events,
  onTap,
}: GlobalScheduleBarProps) {
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
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  };

  // Find current event
  const currentEvent = useMemo(() => {
    const nowMinutes = currentHour * 60 + currentMinute;
    return events.find((event) => {
      if (event.completed) return false;
      const startMinutes = event.startHour * 60 + event.startMinute;
      const endMinutes = event.endHour * 60 + event.endMinute;
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    });
  }, [events, currentHour, currentMinute]);

  // Find next upcoming event
  const nextEvent = useMemo(() => {
    const nowMinutes = currentHour * 60 + currentMinute;
    const upcoming = events
      .filter((event) => {
        if (event.completed) return false;
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
      return `${hours}${t.hoursShort || "h"} ${minutes}${t.minutesShort || "m"}`;
    }
    return `${minutes}${t.minutesShort || "m"}`;
  }, [nextEvent, currentHour, currentMinute, t]);

  // Don't show if no events
  if (events.length === 0) return null;

  return (
    <button
      onClick={onTap}
      aria-label={t.viewSchedule || "View schedule"}
      className={cn(
        "@container min-h-[48px] w-full rounded-2xl px-4 py-2.5 text-start motion-safe:transition-all",
        "bg-card/80 backdrop-blur-sm border border-border/50",
        "hover:bg-card hover:border-primary/30",
        "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 @sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        {/* Clock icon with time */}
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              "w-8 h-8 shrink-0 rounded-xl flex items-center justify-center",
              currentEvent ? "bg-primary/20" : "bg-muted"
            )}
          >
            <Clock
              aria-hidden="true"
              className={cn("w-4 h-4", currentEvent ? "text-primary" : "text-muted-foreground")}
            />
          </div>
          <span className="whitespace-nowrap text-lg font-bold text-foreground">
            {formatTime(currentHour, currentMinute)}
          </span>
        </div>

        {/* Current or next event moves to a full-width row when the component is constrained. */}
        <div className="order-3 col-span-2 min-w-0 text-start @sm:order-none @sm:col-span-1">
          {currentEvent ? (
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 @xs:grid-cols-[auto_minmax(0,1fr)_auto]">
              <span
                className="mt-[0.4em] h-2 w-2 shrink-0 rounded-full motion-safe:animate-pulse"
                style={{ backgroundColor: currentEvent.color }}
                aria-hidden="true"
              />
              <span className="flex min-w-0 items-start gap-1.5">
                {currentEvent.emoji && (
                  <span className="shrink-0" aria-hidden="true">
                    {currentEvent.emoji}
                  </span>
                )}
                <span className="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">
                  {currentEvent.title}
                </span>
              </span>
              <span className="col-start-2 break-words text-xs text-muted-foreground @xs:col-start-auto">
                {t.timeNow || "now"}
              </span>
            </div>
          ) : nextEvent ? (
            <div className="grid min-w-0 grid-cols-1 items-start gap-x-2 gap-y-1 @xs:grid-cols-[minmax(0,1fr)_auto]">
              <span className="flex min-w-0 items-start gap-1.5">
                {nextEvent.emoji && (
                  <span className="shrink-0" aria-hidden="true">
                    {nextEvent.emoji}
                  </span>
                )}
                <span className="min-w-0 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {nextEvent.title}
                </span>
              </span>
              <span className="break-words text-xs font-medium text-primary">
                {t.timeIn || "in"} {timeUntilNext}
              </span>
            </div>
          ) : (
            <span className="block break-words text-sm text-muted-foreground">
              {t.scheduleEmpty || "No upcoming events"}
            </span>
          )}
        </div>

        {/* Arrow */}
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground rtl:scale-x-[-1]"
          aria-hidden="true"
        />
      </div>
    </button>
  );
});
