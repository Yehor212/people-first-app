import { cn } from '@/lib/utils';
import { ScheduleEvent } from '@/types';
import type { Translations } from '@/i18n/translations';
import { formatDayShort, HOURS, HOUR_WIDTH_PX, DAY_WIDTH_PX } from './constants';
import { EventCard3D, CurrentTimeOrb } from './ScheduleVisuals';

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
  const formatTime = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

  return (
    <div
      className="absolute top-0 bottom-0"
      style={{ left: `${dayOffset}px`, width: `${DAY_WIDTH_PX}px` }}
    >
      {/* Hour markers */}
      <div className="absolute inset-x-0 top-0 flex">
        {HOURS.map((hour) => (
          <div key={hour} className="text-center" style={{ width: `${HOUR_WIDTH_PX}px` }}>
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                isDayToday && hour === currentHour && "text-purple-700 dark:text-purple-300 font-bold"
              )}
              style={!(isDayToday && hour === currentHour) ? {
                color: hour === 0
                  ? 'hsl(var(--cosmic-text-primary))'
                  : 'hsl(var(--cosmic-text-muted))'
              } : undefined}
            >
              {hour === 0 ? formatDayShort(date, language).day : formatTime(hour)}
            </span>
          </div>
        ))}
      </div>

      {/* Timeline track */}
      <div className={cn(
        "absolute left-0 right-0 top-8 h-16 rounded-2xl overflow-hidden",
        "backdrop-blur-sm border",
        isDaySelected ? "bg-secondary border-border" : "bg-muted border-border"
      )}>
        {/* Gradient river */}
        <div
          className="absolute inset-0 opacity-30 bg-[linear-gradient(90deg,rgba(99,102,241,0.3)_0%,rgba(168,85,247,0.3)_50%,rgba(236,72,153,0.3)_100%)]"
        />

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
                {isMajor && (
                  <div
                    className="absolute top-0 bottom-0 end-0 pointer-events-none w-2 translate-x-1/2 blur-[2px] bg-[linear-gradient(180deg,hsl(var(--timeline-divider-glow)/0.25)_0%,hsl(var(--timeline-divider-glow)/0.08)_40%,hsl(var(--timeline-divider-glow)/0.08)_60%,hsl(var(--timeline-divider-glow)/0.25)_100%)]"
                  />
                )}
                <div className="absolute top-0 end-0" style={{ width: '2px', height: isMajor ? '10px' : '6px', backgroundColor: isMajor ? 'hsl(var(--timeline-tick) / 0.8)' : 'hsl(var(--timeline-tick) / 0.4)' }} />
                <div className="absolute bottom-0 end-0" style={{ width: '2px', height: isMajor ? '10px' : '6px', backgroundColor: isMajor ? 'hsl(var(--timeline-tick) / 0.8)' : 'hsl(var(--timeline-tick) / 0.4)' }} />
              </div>
            );
          })}
        </div>

        {/* Event cards */}
        {dayEvents.map((event) => (
          <EventCard3D
            key={event.id}
            event={event}
            isCurrent={isDayToday && isEventCurrent(event)}
            onClick={() => onEventClick(event)}
          />
        ))}

        {/* Current time orb */}
        {isDayToday && <CurrentTimeOrb positionPercent={currentTimePositionPercent} />}
      </div>

      {/* Period labels */}
      <div className="absolute left-0 right-0 bottom-0 flex text-xs" style={{ color: 'hsl(var(--cosmic-text-muted))' }}>
        <div className="flex-1 text-center">{t.night || 'Night'}</div>
        <div className="flex-1 text-center">{t.morning || 'Morning'}</div>
        <div className="flex-1 text-center">{t.afternoon || 'Afternoon'}</div>
        <div className="flex-1 text-center">{t.evening || 'Evening'}</div>
      </div>
    </div>
  );
}
