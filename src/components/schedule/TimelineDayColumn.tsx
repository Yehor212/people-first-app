import { cn } from '@/lib/utils';
import { ScheduleEvent } from '@/types';
import type { Translations } from '@/i18n/translations';
import { formatDayShort, HOURS, HOUR_WIDTH_PX, DAY_WIDTH_PX } from './constants';
import { CurrentTimeIndicator, ScheduleEventCard } from './ScheduleVisuals';
import { formatScheduleTime } from './scheduleFormatting';

// Timeline Day Column — renders one day in the horizontal timeline (pure, 0 state)
export function TimelineDayColumn({
  date, dayOffset, dayEvents, isDayToday, isDaySelected,
  currentHour, currentTimePositionPercent, language, t,
  onEventClick, isEventCurrent,
}: {
  date: string; dayOffset: number; dayEvents: ScheduleEvent[];
  isDayToday: boolean; isDaySelected: boolean;
  currentHour: number; currentTimePositionPercent: number;
  language: string; t: Translations;
  onEventClick: (event: ScheduleEvent) => void;
  isEventCurrent: (event: ScheduleEvent) => boolean;
}) {
  return (
    <div
      dir="ltr"
      className="absolute top-0 bottom-0"
      style={{ left: `${dayOffset}px`, width: `${DAY_WIDTH_PX}px` }}
    >
      {/* Hour markers */}
      <div className="absolute inset-x-0 top-0 flex" data-schedule-hour-markers>
        {HOURS.map((hour) => (
          <div key={hour} className="text-center" style={{ width: `${HOUR_WIDTH_PX}px` }}>
            <span
              data-schedule-hour-label
              className={cn(
                "whitespace-nowrap text-sm font-medium tabular-nums text-muted-foreground",
                isDayToday && hour === currentHour && "text-purple-700 dark:text-purple-300 font-bold"
              )}
              style={!(isDayToday && hour === currentHour) ? {
                color: hour === 0
                  ? 'hsl(var(--cosmic-text-primary))'
                  : 'hsl(var(--cosmic-text-muted))'
              } : undefined}
            >
              {hour === 0
                ? formatDayShort(date, language).day
                : formatScheduleTime(language, hour, 0)}
            </span>
          </div>
        ))}
      </div>

      {/* Timeline track */}
      <div className={cn(
        "absolute left-0 right-0 top-8 h-16 rounded-2xl overflow-hidden",
        "border border-border/60",
        isDaySelected ? "bg-secondary" : "bg-muted/60"
      )}>
        {/* Hour grid lines */}
        <div className="absolute inset-0 flex" aria-hidden="true">
          {HOURS.map((hour) => {
            const isMajor = hour % 6 === 0;
            const isOdd = hour % 2 === 1;
            return (
              <div key={hour} className="relative h-full" style={{ width: `${HOUR_WIDTH_PX}px` }}>
                {isOdd && (
                  <div className="absolute inset-0" style={{ backgroundColor: 'hsl(var(--timeline-stripe) / 0.04)' }} />
                )}
                <div
                  className="absolute top-0 bottom-0 end-0"
                  style={{
                    width: isMajor ? '2px' : '1px',
                    backgroundColor: isMajor ? 'hsl(var(--timeline-divider-major) / 0.6)' : 'hsl(var(--timeline-divider) / 0.35)',
                  }}
                />
                <div className="absolute top-0 end-0" style={{ width: '2px', height: isMajor ? '10px' : '6px', backgroundColor: isMajor ? 'hsl(var(--timeline-tick) / 0.8)' : 'hsl(var(--timeline-tick) / 0.4)' }} />
                <div className="absolute bottom-0 end-0" style={{ width: '2px', height: isMajor ? '10px' : '6px', backgroundColor: isMajor ? 'hsl(var(--timeline-tick) / 0.8)' : 'hsl(var(--timeline-tick) / 0.4)' }} />
              </div>
            );
          })}
        </div>

        {/* Event cards */}
        {dayEvents.map((event) => (
          <ScheduleEventCard
            key={event.id}
            event={event}
            isCurrent={isDayToday && isEventCurrent(event)}
            timeRangeLabel={`${formatScheduleTime(language, event.startHour, event.startMinute)}–${formatScheduleTime(language, event.endHour, event.endMinute)}`}
            onClick={() => onEventClick(event)}
          />
        ))}

        {/* Current time orb */}
        {isDayToday && <CurrentTimeIndicator positionPercent={currentTimePositionPercent} />}
      </div>

      {/* Period labels */}
      <div className="absolute bottom-0 left-0 right-0 flex text-xs text-muted-foreground">
        <div dir="auto" className="flex-1 text-center">{t.night || 'Night'}</div>
        <div dir="auto" className="flex-1 text-center">{t.morning || 'Morning'}</div>
        <div dir="auto" className="flex-1 text-center">{t.afternoon || 'Afternoon'}</div>
        <div dir="auto" className="flex-1 text-center">{t.evening || 'Evening'}</div>
      </div>
    </div>
  );
}
