/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The bounded timeline region must receive focus so keyboard users can scroll it even when no events are present. */
/**
 * Schedule Timeline - "My World" orchestrator
 * Decomposed from the original 1,647-line monolith (TD-20).
 * This file: ~390L, 2 useState, delegates data to useScheduleData hook.
 */

import {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Home, Calendar } from "lucide-react";
import { getToday, parseLocalDate } from "@/lib/utils";
import { ScheduleEvent } from "@/types";
import { EmptyState } from "@/components/EmptyState";
import { useScrollLock } from "@/hooks/useScrollLock";
import { zenTap } from "@/lib/animationUtils";

import {
  ScheduleTimelineProps,
  HOURS_PER_DAY,
  DAY_WIDTH_PX,
} from "./constants";
import { ScheduleClock, ScheduleDayButton } from "./ScheduleVisuals";
import { TimelineDayColumn } from "./TimelineDayColumn";
import { useScheduleData } from "./useScheduleData";
import { AddEventModal } from "./AddEventModal";
import { EventDetailsModal } from "./EventDetailsModal";
import { TaskFocusPanel } from "./TaskFocusPanel";
import { getTimelineRenderWindow } from "./timelineWindowing";
import { domToPhysicalScrollLeft } from "./timelineScrollCoordinates";

export function ScheduleTimeline({
  events,
  initialSelectedDate,
  onAddEvent,
  onDeleteEvent,
}: ScheduleTimelineProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(
    null,
  );
  const timelineRef = useRef<HTMLDivElement>(null);
  const daySelectorRef = useRef<HTMLDivElement>(null);

  useScrollLock(showAddModal || selectedEvent !== null);

  // Escape key: close modals (event details first, then add modal)
  useEffect(() => {
    if (!showAddModal && selectedEvent === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (selectedEvent !== null) {
          setSelectedEvent(null);
        } else {
          setShowAddModal(false);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showAddModal, selectedEvent]);

  const {
    currentTime,
    selectedDate,
    setSelectedDate,
    tasks,
    isLoadingGoogle,
    googleCalendarStatus,
    retryGoogleCalendar,
    safeEvents,
    allDates,
    filteredEvents,
    dateHasEvents,
    isToday,
    scrollDaySelectorToDate,
    scrollTimelineToDate,
    isScrollingProgrammatically,
    t,
    language,
    isRTL,
  } = useScheduleData(events, timelineRef, daySelectorRef, initialSelectedDate);

  // --- Local derived state ---

  const handleTimelineScroll = useCallback(() => {
    if (!timelineRef.current || isScrollingProgrammatically.current) return;

    const timeline = timelineRef.current;
    const maxScroll = timeline.scrollWidth - timeline.clientWidth;
    const physicalScrollLeft = domToPhysicalScrollLeft(
      timeline.scrollLeft,
      maxScroll,
      isRTL,
    );
    const viewportCenter = physicalScrollLeft + timeline.clientWidth / 2;
    const dayIndex = Math.floor(viewportCenter / DAY_WIDTH_PX);
    const clampedIndex = Math.max(0, Math.min(dayIndex, allDates.length - 1));
    const newSelectedDate = allDates[clampedIndex];

    if (newSelectedDate && newSelectedDate !== selectedDate) {
      setSelectedDate(newSelectedDate);
      scrollDaySelectorToDate(newSelectedDate);
    }
  }, [
    allDates,
    selectedDate,
    setSelectedDate,
    scrollDaySelectorToDate,
    isScrollingProgrammatically,
    isRTL,
  ]);

  const handleDayClick = useCallback(
    (date: string) => {
      setSelectedDate(date);
      scrollTimelineToDate(date, date === getToday());
    },
    [setSelectedDate, scrollTimelineToDate],
  );

  const handleDayKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, date: string) => {
      const currentIndex = allDates.indexOf(date);
      if (currentIndex < 0) return;

      let nextIndex: number | null = null;
      if (event.key === "ArrowRight") {
        nextIndex = currentIndex + (isRTL ? -1 : 1);
      } else if (event.key === "ArrowLeft") {
        nextIndex = currentIndex + (isRTL ? 1 : -1);
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = allDates.length - 1;
      }

      if (nextIndex === null) return;
      event.preventDefault();
      const nextDate = allDates[Math.max(0, Math.min(nextIndex, allDates.length - 1))];
      if (!nextDate) return;

      setSelectedDate(nextDate);
      scrollTimelineToDate(nextDate, nextDate === getToday());
      scrollDaySelectorToDate(nextDate);
      daySelectorRef.current
        ?.querySelector<HTMLElement>(`[data-schedule-date="${nextDate}"]`)
        ?.focus();
    },
    [allDates, isRTL, scrollDaySelectorToDate, scrollTimelineToDate, setSelectedDate],
  );

  const goToToday = useCallback(() => {
    const today = getToday();
    setSelectedDate(today);
    scrollTimelineToDate(today, true);
    scrollDaySelectorToDate(today);
  }, [setSelectedDate, scrollTimelineToDate, scrollDaySelectorToDate]);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  const isEventCurrent = (event: ScheduleEvent) => {
    const nowMinutes = currentHour * 60 + currentMinute;
    const startMinutes = event.startHour * 60 + event.startMinute;
    const endMinutes = event.endHour * 60 + event.endMinute;
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  };

  const currentEvent = isToday ? filteredEvents.find(isEventCurrent) : null;

  const currentTimePositionPercent = useMemo(() => {
    const totalMinutes = currentHour * 60 + currentMinute;
    return (totalMinutes / (HOURS_PER_DAY * 60)) * 100;
  }, [currentHour, currentMinute]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    safeEvents.forEach((event) => {
      const existing = map.get(event.date) || [];
      existing.push(event);
      map.set(event.date, existing);
    });
    return map;
  }, [safeEvents]);

  const timelineRenderWindow = useMemo(
    () => getTimelineRenderWindow(allDates, selectedDate),
    [allDates, selectedDate],
  );

  // --- JSX ---

  return (
    <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-border/50 bg-card text-card-foreground">
      <div className="min-w-0 p-4">
        <div className="mb-4 flex min-w-0 flex-col items-stretch gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ScheduleClock
              currentHour={currentHour}
              currentMinute={currentMinute}
              language={language}
            />

            <div className="min-w-0 flex-1">
              <h2 className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-bold text-foreground">
                <span className="min-w-0 break-words [overflow-wrap:normal]">{t.myWorld}</span>
              </h2>

              {/* Current event badge */}
              {currentEvent && (
                <div className="mt-1 inline-flex max-w-full min-w-0 flex-wrap items-center gap-2 rounded-full bg-muted px-3 py-1">
                  <span aria-hidden="true" className="shrink-0">{currentEvent.emoji}</span>
                  <bdi dir="auto" className="min-w-0 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {currentEvent.title}
                  </bdi>
                </div>
              )}

              {/* Google Calendar sync indicator */}
              {isLoadingGoogle && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-1 inline-flex max-w-full min-w-0 flex-wrap items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
                  />
                  <span className="min-w-0 whitespace-normal break-words text-xs [hyphens:manual] [overflow-wrap:normal]">
                    {t.googleCalendarEventsLoading}
                  </span>
                </div>
              )}

              {googleCalendarStatus === "error" && (
                <div
                  role="alert"
                  className="mt-2 flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {t.googleCalendarEventsUnavailable}
                  </span>
                  <button
                    type="button"
                    onClick={retryGoogleCalendar}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-current/35 px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                  >
                    {t.retry}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 self-end">
            {/* Go to Today button */}
            {selectedDate !== getToday() && (
              <motion.button
                onClick={goToToday}
                whileTap={zenTap.button}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-secondary p-2.5 text-secondary-foreground motion-safe:transition-colors hover:bg-secondary/80"
                aria-label={t.today || "Today"}
              >
                <Home className="h-5 w-5" aria-hidden="true" />
              </motion.button>
            )}

            {/* Add event button */}
            {onAddEvent && (
              <motion.button
                onClick={() => setShowAddModal(true)}
                whileTap={zenTap.button}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-primary p-2.5 text-primary-foreground motion-safe:transition-colors hover:bg-primary/90"
                aria-label={t.scheduleAddEvent || "Add event"}
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Premium Day Selector */}
        <div
          ref={daySelectorRef}
          role="toolbar"
          aria-label={t.scheduleDate || t.scheduleTitle || "Date"}
          className="-mx-1 mb-4 flex min-w-0 max-w-full snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2 scrollbar-hide"
        >
          {allDates.map((date) => {
            const hasEvents = dateHasEvents(date);
            return (
              <ScheduleDayButton
                key={date}
                date={date}
                isSelected={date === selectedDate}
                isToday={date === getToday()}
                hasEvents={hasEvents}
                onClick={() => handleDayClick(date)}
                onKeyDown={(event) => handleDayKeyDown(event, date)}
                tabIndex={date === selectedDate ? 0 : -1}
                language={language}
                accessibleDateLabel={new Intl.DateTimeFormat(language, {
                  dateStyle: "full",
                }).format(parseLocalDate(date))}
                eventPresenceLabel={hasEvents ? t.scheduleDayHasEvents : undefined}
              />
            );
          })}
        </div>

        {/* Cosmic Timeline */}
        <div className="relative min-w-0 max-w-full">
          <div
            ref={timelineRef}
            onScroll={handleTimelineScroll}
            role="region"
            aria-label={t.scheduleTitle || "Your Schedule"}
            tabIndex={0}
            className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg pb-2 scrollbar-thin scrollbar-thumb-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <div
              className="relative h-28"
              style={{ width: `${allDates.length * DAY_WIDTH_PX}px` }}
            >
              {timelineRenderWindow.map(({ date, index: dayIndex }) => (
                <TimelineDayColumn
                  key={date}
                  date={date}
                  dayOffset={dayIndex * DAY_WIDTH_PX}
                  dayEvents={eventsByDate.get(date) || []}
                  isDayToday={date === getToday()}
                  isDaySelected={date === selectedDate}
                  currentHour={currentHour}
                  currentTimePositionPercent={currentTimePositionPercent}
                  language={language}
                  t={t}
                  onEventClick={setSelectedEvent}
                  isEventCurrent={isEventCurrent}
                />
              ))}
            </div>
          </div>

        </div>

        {/* Empty state */}
        {filteredEvents.length === 0 &&
          googleCalendarStatus !== "loading" &&
          googleCalendarStatus !== "error" && (
          <div className="mt-3">
            <EmptyState
              icon={<Calendar className="w-5 h-5 text-primary" />}
              title={
                isToday
                  ? t.scheduleEmpty || "No events planned"
                  : t.scheduleEmptyDay || "No events for this day"
              }
              size="compact"
              action={
                isToday && onAddEvent
                  ? {
                      label: t.scheduleAdd || "Add Event",
                      onClick: () => setShowAddModal(true),
                      icon: <Plus className="w-4 h-4" />,
                    }
                  : undefined
              }
            />
          </div>
          )}

        {/* Task Focus Panel */}
        <TaskFocusPanel tasks={tasks} t={t} language={language} />
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddModal && onAddEvent && (
          <AddEventModal
            selectedDate={selectedDate}
            allDates={allDates}
            onClose={() => setShowAddModal(false)}
            onAdd={(event) => {
              onAddEvent(event);
              setShowAddModal(false);
            }}
          />
        )}

        {selectedEvent && (
          <EventDetailsModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onDelete={
              onDeleteEvent
                ? () => {
                    onDeleteEvent(selectedEvent.id);
                    setSelectedEvent(null);
                  }
                : undefined
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}
