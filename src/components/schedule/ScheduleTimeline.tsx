/**
 * Schedule Timeline - "My World" orchestrator
 * Decomposed from the original 1,647-line monolith (TD-20).
 * This file: ~390L, 2 useState, delegates data to useScheduleData hook.
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Home, Sparkles, Calendar } from 'lucide-react';
import { getToday } from '@/lib/utils';
import { ScheduleEvent } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { ParticleBackground } from '@/components/stats';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { zenTap } from '@/lib/animationUtils';

import { ScheduleTimelineProps, HOURS_PER_DAY, DAY_WIDTH_PX } from './constants';
import { AnimatedClockRing, PremiumDayPill } from './ScheduleVisuals';
import { TimelineDayColumn } from './TimelineDayColumn';
import { useScheduleData } from './useScheduleData';
import { AddEventModal } from './AddEventModal';
import { EventDetailsModal } from './EventDetailsModal';
import { TaskFocusPanel } from './TaskFocusPanel';

export function ScheduleTimeline({ events, onAddEvent, onDeleteEvent }: ScheduleTimelineProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const daySelectorRef = useRef<HTMLDivElement>(null);

  useBackHandler(showAddModal, () => setShowAddModal(false));
  useBackHandler(selectedEvent !== null, () => setSelectedEvent(null));
  useScrollLock(showAddModal || selectedEvent !== null);

  // Escape key: close modals (event details first, then add modal)
  useEffect(() => {
    if (!showAddModal && selectedEvent === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (selectedEvent !== null) {
          setSelectedEvent(null);
        } else {
          setShowAddModal(false);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showAddModal, selectedEvent]);

  const {
    currentTime,
    selectedDate,
    setSelectedDate,
    tasks,
    isLoadingGoogle,
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
  } = useScheduleData(events, timelineRef, daySelectorRef);

  // --- Local derived state ---

  const handleTimelineScroll = useCallback(() => {
    if (!timelineRef.current || isScrollingProgrammatically.current) return;

    const scrollLeft = timelineRef.current.scrollLeft;
    const viewportCenter = scrollLeft + timelineRef.current.clientWidth / 2;
    const dayIndex = Math.floor(viewportCenter / DAY_WIDTH_PX);
    const clampedIndex = Math.max(0, Math.min(dayIndex, allDates.length - 1));
    const newSelectedDate = allDates[clampedIndex];

    if (newSelectedDate && newSelectedDate !== selectedDate) {
      setSelectedDate(newSelectedDate);
      scrollDaySelectorToDate(newSelectedDate);
    }
  }, [allDates, selectedDate, setSelectedDate, scrollDaySelectorToDate, isScrollingProgrammatically]);

  const handleDayClick = useCallback((date: string) => {
    setSelectedDate(date);
    scrollTimelineToDate(date, date === getToday());
  }, [setSelectedDate, scrollTimelineToDate]);

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
    safeEvents.forEach(event => {
      const existing = map.get(event.date) || [];
      existing.push(event);
      map.set(event.date, existing);
    });
    return map;
  }, [safeEvents]);

  // --- JSX ---

  return (
    <div className="relative overflow-hidden rounded-3xl animate-fade-in">
      {/* Cosmic background - Theme-aware */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50/80 via-sky-50/60 to-indigo-50/40 dark:bg-none" />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background: `linear-gradient(135deg,
            #0f0f23 0%,
            #1a1a3e 25%,
            #2d1b4e 50%,
            #1a1a3e 75%,
            #0f0f23 100%)`,
        }}
      />

      {/* Floating particles */}
      <ParticleBackground count={15} color="purple" />

      {/* Nebula glow effects */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity }}
        style={{
          background: `
            radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.1) 0%, transparent 40%)
          `,
        }}
      />

      {/* Content container */}
      <div className="relative z-10 p-4">
        {/* Premium Header */}
        <motion.div
          className="flex items-center justify-between mb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4">
            {/* Animated Clock Ring */}
            <AnimatedClockRing currentHour={currentHour} currentMinute={currentMinute} />

            <div>
              {/* Title with sparkle */}
              <motion.h3
                className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 [text-shadow:0_0_10px_rgba(139,92,246,0.3)]"
              >
                <motion.span
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </motion.span>
                {t.myWorld}
              </motion.h3>

              {/* Current event badge */}
              {currentEvent && (
                <motion.div
                  className="mt-1 px-3 py-1 bg-secondary backdrop-blur-sm rounded-full inline-flex items-center gap-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <span>{currentEvent.emoji}</span>
                  <span className="text-sm text-slate-600 dark:text-white/80">{currentEvent.title}</span>
                </motion.div>
              )}

              {/* Google Calendar sync indicator */}
              {isLoadingGoogle && (
                <motion.div
                  className="mt-1 px-2 py-0.5 bg-blue-500/10 backdrop-blur-sm rounded-full inline-flex items-center gap-1.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    className="w-2 h-2 rounded-full bg-blue-500"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span className="text-[10px] text-blue-600 dark:text-blue-400">
                    {t.googleCalendar || 'Google Calendar'}...
                  </span>
                </motion.div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Go to Today button */}
            {selectedDate !== getToday() && (
              <motion.button
                onClick={goToToday}
                whileHover={{ scale: 1.1 }}
                whileTap={zenTap.button}
                className="p-2.5 bg-secondary hover:bg-secondary/80 backdrop-blur-sm rounded-xl border border-border transition-colors"
                aria-label={t.today || 'Today'}
              >
                <Home className="w-5 h-5 text-slate-600 dark:text-white/80" />
              </motion.button>
            )}

            {/* Add event button */}
            {onAddEvent && (
              <motion.button
                onClick={() => setShowAddModal(true)}
                whileHover={{ scale: 1.1 }}
                whileTap={zenTap.button}
                className="p-2.5 bg-gradient-to-br from-primary/40 to-accent/40 hover:from-primary/60 hover:to-accent/60 backdrop-blur-sm rounded-xl border border-primary/30 transition-all shadow-lg shadow-primary/20"
                aria-label={t.scheduleAddEvent || 'Add event'}
              >
                <Plus className="w-5 h-5 text-white" />
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Premium Day Selector */}
        <div
          ref={daySelectorRef}
          className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
        >
          {allDates.map((date) => (
            <PremiumDayPill
              key={date}
              date={date}
              isSelected={date === selectedDate}
              isToday={date === getToday()}
              hasEvents={dateHasEvents(date)}
              onClick={() => handleDayClick(date)}
              language={language}
            />
          ))}
        </div>

        {/* Cosmic Timeline */}
        <div className="relative">
          <div
            ref={timelineRef}
            onScroll={handleTimelineScroll}
            className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-primary/30"
          >
            <div
              className="relative h-28"
              style={{ width: `${allDates.length * DAY_WIDTH_PX}px` }}
            >
              {allDates.map((date, dayIndex) => (
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

          {/* Scroll fade indicators - Theme-aware */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 dark:from-[#0f0f23] to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 dark:from-[#0f0f23] to-transparent pointer-events-none" />
        </div>

        {/* Empty state */}
        {filteredEvents.length === 0 && (
          <div className="mt-3">
            <EmptyState
              icon={<Calendar className="w-5 h-5 text-primary" />}
              title={isToday
                ? (t.scheduleEmpty || 'No events planned')
                : (t.scheduleEmptyDay || 'No events for this day')}
              message={isToday ? (t.scheduleAddEvent || 'Tap + to add your first event') : undefined}
              size="compact"
              action={isToday && onAddEvent ? {
                label: t.scheduleAdd || 'Add Event',
                onClick: () => setShowAddModal(true),
                icon: <Plus className="w-4 h-4" />,
              } : undefined}
            />
          </div>
        )}

        {/* Task Focus Panel */}
        <TaskFocusPanel tasks={tasks} t={t} />
      </div>

      {/* Bottom glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none bg-[radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.15)_0%,transparent_70%)]"
      />

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
            onDelete={onDeleteEvent ? () => {
              onDeleteEvent(selectedEvent.id);
              setSelectedEvent(null);
            } : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
