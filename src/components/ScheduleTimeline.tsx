/**
 * Schedule Timeline - Horizontal day view for ADHD users
 * Shows current time, planned activities, and helps with time awareness
 * Supports ±30 days planning with auto-synced day selector
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Clock, X, Check, Home } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn, getToday, formatDate } from '@/lib/utils';
import { ScheduleEvent } from '@/types';
import { safeParseInt } from '@/lib/validation';
import { Task } from '@/lib/taskMomentum';
import { safeJsonParse } from '@/lib/safeJson';

const TASKS_STORAGE_KEY = 'zenflow_tasks';

interface ScheduleTimelineProps {
  events: ScheduleEvent[];
  onAddEvent?: (event: Omit<ScheduleEvent, 'id'>) => void;
  onDeleteEvent?: (id: string) => void;
}

// Get array of dates for ±30 days range
function getExtendedDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  // 30 days back + today + 30 days forward = 61 days total
  for (let i = -30; i <= 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(formatDate(date));
  }
  return dates;
}

// Format date for display
function formatDayShort(dateStr: string, language: string): { day: string; weekday: string; isToday: boolean } {
  const date = new Date(dateStr);
  const isToday = dateStr === getToday();

  const weekdayNames: Record<string, string[]> = {
    ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    uk: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    fr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  };

  const names = weekdayNames[language] || weekdayNames.en;

  return {
    day: date.getDate().toString(),
    weekday: names[date.getDay()],
    isToday,
  };
}

// Preset event types with colors
const EVENT_PRESETS = [
  { id: 'work', emoji: '💼', color: '#3b82f6', labelKey: 'scheduleWork' },
  { id: 'meal', emoji: '🍽️', color: '#22c55e', labelKey: 'scheduleMeal' },
  { id: 'rest', emoji: '😴', color: '#8b5cf6', labelKey: 'scheduleRest' },
  { id: 'exercise', emoji: '🏃', color: '#f97316', labelKey: 'scheduleExercise' },
  { id: 'study', emoji: '📚', color: '#06b6d4', labelKey: 'scheduleStudy' },
  { id: 'meeting', emoji: '👥', color: '#ec4899', labelKey: 'scheduleMeeting' },
];

// Time blocks for the day - now full 24 hours
const HOURS_PER_DAY = 24;
const HOURS = Array.from({ length: HOURS_PER_DAY }, (_, i) => i);

// Width in pixels for one hour in timeline
const HOUR_WIDTH_PX = 60;
const DAY_WIDTH_PX = HOURS_PER_DAY * HOUR_WIDTH_PX; // 1440px per day

export function ScheduleTimeline({ events, onAddEvent, onDeleteEvent }: ScheduleTimelineProps) {
  const { t, language } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [tasks, setTasks] = useState<Task[]>([]);
  const timelineRef = useRef<HTMLDivElement>(null);
  const daySelectorRef = useRef<HTMLDivElement>(null);
  const isScrollingProgrammatically = useRef(false);

  // Load tasks from localStorage
  useEffect(() => {
    const loadTasks = () => {
      const stored = localStorage.getItem(TASKS_STORAGE_KEY);
      if (stored) {
        const parsed = safeJsonParse<Task[]>(stored, []);
        setTasks(Array.isArray(parsed) ? parsed : []);
      }
    };
    loadTasks();

    // Listen for storage changes (when tasks are updated elsewhere)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TASKS_STORAGE_KEY) loadTasks();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Generate auto-schedule events from incomplete tasks
  const taskEvents = useMemo((): ScheduleEvent[] => {
    const today = getToday();
    const incompleteTasks = tasks.filter(t => !t.completed);
    if (incompleteTasks.length === 0) return [];

    const generatedEvents: ScheduleEvent[] = [];
    let currentTimestamp = Date.now();

    incompleteTasks.forEach(task => {
      const workDuration = task.estimatedMinutes * 60 * 1000; // in ms
      const breakDuration = (task.breakMinutes || 0) * 60 * 1000;

      const workStart = new Date(currentTimestamp);
      const workEnd = new Date(currentTimestamp + workDuration);

      // Work block
      generatedEvents.push({
        id: `task-work-${task.id}`,
        title: task.name,
        startHour: workStart.getHours(),
        startMinute: workStart.getMinutes(),
        endHour: workEnd.getHours(),
        endMinute: workEnd.getMinutes(),
        color: task.urgent ? '#ef4444' : '#3b82f6', // red for urgent, blue for normal
        emoji: '💼',
        date: today,
        source: 'task',
        taskId: task.id,
        isAutoGenerated: true,
        isEditable: false,
      });

      currentTimestamp += workDuration;

      // Break block (if break time specified)
      if (task.breakMinutes && task.breakMinutes > 0) {
        const breakStart = new Date(currentTimestamp);
        const breakEnd = new Date(currentTimestamp + breakDuration);

        generatedEvents.push({
          id: `task-break-${task.id}`,
          title: t.breakTime || 'Break',
          startHour: breakStart.getHours(),
          startMinute: breakStart.getMinutes(),
          endHour: breakEnd.getHours(),
          endMinute: breakEnd.getMinutes(),
          color: '#06b6d4', // cyan for breaks
          emoji: '☕',
          date: today,
          source: 'task',
          taskId: task.id,
          isAutoGenerated: true,
          isEditable: false,
        });

        currentTimestamp += breakDuration;
      }
    });

    return generatedEvents;
  }, [tasks, t.breakTime]);

  // Combine manual events with auto-generated task events
  const safeEvents = useMemo(() => {
    const manual = Array.isArray(events) ? events : [];
    return [...manual, ...taskEvents];
  }, [events, taskEvents]);

  // Get all dates (±30 days)
  const allDates = useMemo(() => getExtendedDates(), []);

  // Find index of a date in allDates
  const getDateIndex = useCallback((date: string) => {
    return allDates.indexOf(date);
  }, [allDates]);

  // Filter events for selected date
  const filteredEvents = useMemo(() => {
    return safeEvents.filter(e => e.date === selectedDate);
  }, [safeEvents, selectedDate]);

  // Check if a date has events
  const dateHasEvents = useCallback((date: string) => {
    return safeEvents.some(e => e.date === date);
  }, [safeEvents]);

  // Check if selected date is today
  const isToday = selectedDate === getToday();

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Scroll day selector to center the selected date
  const scrollDaySelectorToDate = useCallback((date: string) => {
    if (!daySelectorRef.current) return;
    const index = getDateIndex(date);
    if (index === -1) return;

    const buttonWidth = 56; // min-w-[52px] + gap
    const containerWidth = daySelectorRef.current.clientWidth;
    const scrollPosition = (index * buttonWidth) - (containerWidth / 2) + (buttonWidth / 2);

    daySelectorRef.current.scrollTo({
      left: Math.max(0, scrollPosition),
      behavior: 'smooth'
    });
  }, [getDateIndex]);

  // Scroll timeline to specific date
  const scrollTimelineToDate = useCallback((date: string, centerOnCurrentHour = false) => {
    if (!timelineRef.current) return;
    const index = getDateIndex(date);
    if (index === -1) return;

    isScrollingProgrammatically.current = true;

    let scrollPosition = index * DAY_WIDTH_PX;

    // If centering on current hour (for today), add hour offset
    if (centerOnCurrentHour && date === getToday()) {
      const currentHour = new Date().getHours();
      scrollPosition += currentHour * HOUR_WIDTH_PX;
    }

    // Center in viewport
    scrollPosition -= timelineRef.current.clientWidth / 2;

    timelineRef.current.scrollTo({
      left: Math.max(0, scrollPosition),
      behavior: 'smooth'
    });

    // Reset flag after animation
    setTimeout(() => {
      isScrollingProgrammatically.current = false;
    }, 500);
  }, [getDateIndex]);

  // Initial scroll to today and center on current time
  useEffect(() => {
    const today = getToday();
    setSelectedDate(today);
    scrollTimelineToDate(today, true);
    scrollDaySelectorToDate(today);
  }, [scrollTimelineToDate, scrollDaySelectorToDate]);

  // Handle timeline scroll - update selected date based on scroll position
  const handleTimelineScroll = useCallback(() => {
    if (!timelineRef.current || isScrollingProgrammatically.current) return;

    const scrollLeft = timelineRef.current.scrollLeft;
    const viewportCenter = scrollLeft + timelineRef.current.clientWidth / 2;

    // Determine which day is in the center of viewport
    const dayIndex = Math.floor(viewportCenter / DAY_WIDTH_PX);
    const clampedIndex = Math.max(0, Math.min(dayIndex, allDates.length - 1));
    const newSelectedDate = allDates[clampedIndex];

    if (newSelectedDate && newSelectedDate !== selectedDate) {
      setSelectedDate(newSelectedDate);
      scrollDaySelectorToDate(newSelectedDate);
    }
  }, [allDates, selectedDate, scrollDaySelectorToDate]);

  // Handle day button click - scroll timeline to that day
  const handleDayClick = useCallback((date: string) => {
    setSelectedDate(date);
    scrollTimelineToDate(date, date === getToday());
  }, [scrollTimelineToDate]);

  // Go to today button
  const goToToday = useCallback(() => {
    const today = getToday();
    setSelectedDate(today);
    scrollTimelineToDate(today, true);
    scrollDaySelectorToDate(today);
  }, [scrollTimelineToDate, scrollDaySelectorToDate]);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  // Format time
  const formatTime = (hour: number, minute: number = 0) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Get current time formatted
  const currentTimeFormatted = formatTime(currentHour, currentMinute);

  // Calculate event position and width (within a single day)
  const getEventStyle = (event: ScheduleEvent) => {
    const startMinutes = event.startHour * 60 + event.startMinute;
    const endMinutes = event.endHour * 60 + event.endMinute;
    const totalMinutes = HOURS_PER_DAY * 60;

    const left = (startMinutes / totalMinutes) * 100;
    const width = ((endMinutes - startMinutes) / totalMinutes) * 100;

    return {
      left: `${left}%`,
      width: `${Math.max(width, 2)}%`,
      backgroundColor: event.color,
    };
  };

  // Check if event is current
  const isEventCurrent = (event: ScheduleEvent) => {
    const nowMinutes = currentHour * 60 + currentMinute;
    const startMinutes = event.startHour * 60 + event.startMinute;
    const endMinutes = event.endHour * 60 + event.endMinute;
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  };

  // Find current event (only on today)
  const currentEvent = isToday ? filteredEvents.find(isEventCurrent) : null;

  // Calculate current time position within a day (percentage)
  const currentTimePositionPercent = useMemo(() => {
    const totalMinutes = currentHour * 60 + currentMinute;
    return (totalMinutes / (HOURS_PER_DAY * 60)) * 100;
  }, [currentHour, currentMinute]);

  // Get events grouped by date for rendering
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    events.forEach(event => {
      const existing = map.get(event.date) || [];
      existing.push(event);
      map.set(event.date, existing);
    });
    return map;
  }, [events]);

  // Get today's index in allDates
  const todayIndex = useMemo(() => getDateIndex(getToday()), [getDateIndex]);

  return (
    <div className="bg-card rounded-3xl p-4 zen-shadow-card animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              {t.scheduleTitle || 'Your Schedule'}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">{currentTimeFormatted}</span>
              {currentEvent && (
                <span className="text-xs text-muted-foreground px-2 py-0.5 bg-primary/10 rounded-full">
                  {currentEvent.emoji} {currentEvent.title}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Go to Today button */}
          {selectedDate !== getToday() && (
            <button
              onClick={goToToday}
              className="p-2 bg-secondary/50 hover:bg-secondary rounded-xl transition-colors"
              aria-label={t.today || 'Today'}
            >
              <Home className="w-5 h-5 text-muted-foreground" />
            </button>
          )}

          {onAddEvent && (
            <button
              onClick={() => setShowAddModal(true)}
              aria-label={t.scheduleAddEvent || 'Add event'}
              className="p-2 bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors"
            >
              <Plus className="w-5 h-5 text-primary" />
            </button>
          )}
        </div>
      </div>

      {/* Extended Day Selector (±30 days with horizontal scroll) */}
      <div
        ref={daySelectorRef}
        className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide"
      >
        {allDates.map((date) => {
          const { day, weekday, isToday: dayIsToday } = formatDayShort(date, language);
          const isSelected = date === selectedDate;
          const hasEvents = dateHasEvents(date);

          return (
            <button
              key={date}
              onClick={() => handleDayClick(date)}
              className={cn(
                "flex-shrink-0 flex flex-col items-center py-2 px-3 rounded-xl transition-all min-w-[52px]",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : dayIsToday
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary/50 hover:bg-secondary text-foreground"
              )}
            >
              <span className="text-[10px] uppercase opacity-70">{weekday}</span>
              <span className="text-lg font-bold">{day}</span>
              {hasEvents && !isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />
              )}
              {hasEvents && isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground mt-0.5" />
              )}
              {!hasEvents && <div className="h-1.5 mt-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Continuous Timeline (all days in one scrollable view) */}
      <div className="relative">
        <div
          ref={timelineRef}
          onScroll={handleTimelineScroll}
          className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-primary/20"
        >
          {/* Total width = number of days * day width */}
          <div
            className="relative h-24"
            style={{ width: `${allDates.length * DAY_WIDTH_PX}px` }}
          >
            {/* Render each day segment */}
            {allDates.map((date, dayIndex) => {
              const dayOffset = dayIndex * DAY_WIDTH_PX;
              const dayEvents = eventsByDate.get(date) || [];
              const isDayToday = date === getToday();
              const isDaySelected = date === selectedDate;

              return (
                <div
                  key={date}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${dayOffset}px`, width: `${DAY_WIDTH_PX}px` }}
                >
                  {/* Hour markers */}
                  <div className="absolute inset-x-0 top-0 flex">
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="text-center"
                        style={{ width: `${HOUR_WIDTH_PX}px` }}
                      >
                        <span className={cn(
                          "text-xs",
                          isDayToday && hour === currentHour
                            ? "text-primary font-bold"
                            : hour === 0
                              ? "text-muted-foreground/70 font-medium"
                              : "text-muted-foreground"
                        )}>
                          {hour === 0 ? formatDayShort(date, language).day : formatTime(hour)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Timeline track */}
                  <div className={cn(
                    "absolute left-0 right-0 top-6 h-12 rounded-xl overflow-hidden",
                    isDaySelected ? "bg-secondary/70" : "bg-secondary/40"
                  )}>
                    {/* Hour grid lines */}
                    <div className="absolute inset-0 flex">
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          className={cn(
                            "border-r",
                            hour === 0
                              ? "border-primary/30 border-r-2"
                              : hour % 6 === 0
                                ? "border-border/50"
                                : "border-border/20"
                          )}
                          style={{ width: `${HOUR_WIDTH_PX}px` }}
                        />
                      ))}
                    </div>

                    {/* Events for this day */}
                    {dayEvents.map((event) => {
                      const isHabitEvent = event.source === 'habit';
                      const isTaskEvent = event.source === 'task';
                      const isAutoGenerated = event.isAutoGenerated;
                      return (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          style={getEventStyle(event)}
                          className={cn(
                            "absolute top-1 bottom-1 rounded-lg flex items-center justify-center gap-1 text-white text-xs font-medium transition-all",
                            // Visual distinction for auto-generated events
                            isHabitEvent
                              ? "opacity-90 border-2 border-dashed border-white/40"
                              : isAutoGenerated
                                ? "opacity-85 border-2 border-dashed border-white/50"
                                : "hover:scale-[1.02] hover:z-10",
                            isDayToday && isEventCurrent(event) && "ring-2 ring-white ring-offset-2 ring-offset-card animate-pulse"
                          )}
                        >
                          {/* Habit indicator badge */}
                          {isHabitEvent && (
                            <span className="absolute -top-1 -left-1 text-[10px] bg-white/30 rounded-full w-4 h-4 flex items-center justify-center backdrop-blur-sm">
                              🎯
                            </span>
                          )}
                          {/* Task indicator badge */}
                          {isTaskEvent && (
                            <span className="absolute -top-1 -left-1 text-[10px] bg-white/30 rounded-full w-4 h-4 flex items-center justify-center backdrop-blur-sm">
                              📋
                            </span>
                          )}
                          <span>{event.emoji}</span>
                          <span className="truncate px-1">{event.title}</span>
                        </button>
                      );
                    })}

                    {/* Current time indicator - only show for today */}
                    {isDayToday && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                        style={{ left: `${currentTimePositionPercent}%` }}
                      >
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Period labels */}
                  <div className="absolute left-0 right-0 bottom-0 flex text-[10px] text-muted-foreground">
                    <div className="flex-1 text-center">{t.night || 'Night'}</div>
                    <div className="flex-1 text-center">{t.morning || 'Morning'}</div>
                    <div className="flex-1 text-center">{t.afternoon || 'Afternoon'}</div>
                    <div className="flex-1 text-center">{t.evening || 'Evening'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scroll indicators */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 bg-gradient-to-r from-card to-transparent pointer-events-none" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none" />
      </div>

      {/* Quick info */}
      {filteredEvents.length === 0 && (
        <div className="mt-3 text-center py-3 bg-secondary/30 rounded-xl">
          <p className="text-sm text-muted-foreground">
            {isToday
              ? (t.scheduleEmpty || 'No events planned. Tap + to add your schedule!')
              : (t.scheduleEmptyDay || 'No events for this day')}
          </p>
        </div>
      )}

      {/* Add Event Modal */}
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

      {/* Event Details Modal */}
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
    </div>
  );
}

// Add Event Modal
function AddEventModal({
  selectedDate: initialDate,
  allDates,
  onClose,
  onAdd,
}: {
  selectedDate: string;
  allDates: string[];
  onClose: () => void;
  onAdd: (event: Omit<ScheduleEvent, 'id'>) => void;
}) {
  const { t, language } = useLanguage();
  const [selectedPreset, setSelectedPreset] = useState(EVENT_PRESETS[0]);
  const [eventDate, setEventDate] = useState(initialDate);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [customTitle, setCustomTitle] = useState('');
  const [note, setNote] = useState('');

  // Format date for display in select
  const formatDateOption = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = getToday();
    const tomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return formatDate(d);
    })();

    if (dateStr === today) return t.today || 'Today';
    if (dateStr === tomorrow) return t.tomorrow || 'Tomorrow';

    const locale = language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : language === 'es' ? 'es-ES' : language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : 'en-US';
    return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const handleAdd = () => {
    const title = customTitle || (t[selectedPreset.labelKey as keyof typeof t] as string) || selectedPreset.id;
    onAdd({
      title,
      startHour,
      startMinute,
      endHour,
      endMinute,
      color: selectedPreset.color,
      emoji: selectedPreset.emoji,
      date: eventDate,
      note: note.trim() || undefined,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-event-title"
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4"
      style={{ zIndex: 'var(--z-overlay)', marginBottom: 'var(--nav-height)' }}
    >
      <div
        className="bg-card rounded-3xl p-5 w-full max-w-sm animate-slide-up max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom))' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="add-event-title" className="text-lg font-semibold">{t.scheduleAddEvent || 'Add Event'}</h3>
          <button onClick={onClose} aria-label={t.close || 'Close'} className="p-2 hover:bg-muted rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date picker - now with all ±30 days */}
        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1 block">{t.scheduleDate || 'Date'}</label>
          <select
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full p-3 bg-secondary/50 rounded-xl text-sm"
          >
            {allDates.map((date) => (
              <option key={date} value={date}>{formatDateOption(date)}</option>
            ))}
          </select>
        </div>

        {/* Event type presets */}
        <div className="grid grid-cols-3 gap-2 mb-4" role="group" aria-label={t.scheduleEventType || 'Event type'}>
          {EVENT_PRESETS.map((preset) => {
            const label = (t[preset.labelKey as keyof typeof t] as string) || preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setSelectedPreset(preset)}
                aria-pressed={selectedPreset.id === preset.id}
                aria-label={label}
                className={cn(
                  "p-3 rounded-xl flex flex-col items-center gap-1 transition-all",
                  selectedPreset.id === preset.id
                    ? "ring-2 ring-primary bg-primary/10"
                    : "bg-secondary/50 hover:bg-secondary"
                )}
              >
                <span className="text-xl" aria-hidden="true">{preset.emoji}</span>
                <span className="text-xs">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Custom title */}
        <input
          type="text"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder={t.scheduleCustomTitle || 'Custom title (optional)'}
          className="w-full p-3 bg-secondary/50 rounded-xl text-sm mb-4"
        />

        {/* Time pickers - now with all 24 hours */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">{t.scheduleStart || 'Start'}</label>
            <div className="flex gap-1">
              <select
                value={startHour}
                onChange={(e) => setStartHour(safeParseInt(e.target.value, 9, 0, 23))}
                className="flex-1 p-2 bg-secondary/50 rounded-lg text-sm"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <select
                value={startMinute}
                onChange={(e) => setStartMinute(safeParseInt(e.target.value, 0, 0, 59))}
                className="flex-1 p-2 bg-secondary/50 rounded-lg text-sm"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">{t.scheduleEnd || 'End'}</label>
            <div className="flex gap-1">
              <select
                value={endHour}
                onChange={(e) => setEndHour(safeParseInt(e.target.value, 10, 0, 23))}
                className="flex-1 p-2 bg-secondary/50 rounded-lg text-sm"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <select
                value={endMinute}
                onChange={(e) => setEndMinute(safeParseInt(e.target.value, 0, 0, 59))}
                className="flex-1 p-2 bg-secondary/50 rounded-lg text-sm"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Note (optional) */}
        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1 block">{t.scheduleNote || 'Note (optional)'}</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.scheduleNotePlaceholder || 'Add details or reminders...'}
            className="w-full p-3 bg-secondary/50 rounded-xl text-sm resize-none"
            rows={2}
          />
        </div>

        {/* Add button */}
        <button
          onClick={handleAdd}
          className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          {t.scheduleAdd || 'Add to Schedule'}
        </button>
      </div>
    </div>
  );
}

// Event Details Modal
function EventDetailsModal({
  event,
  onClose,
  onDelete,
}: {
  event: ScheduleEvent;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const { t } = useLanguage();
  const isHabitEvent = event.source === 'habit';
  const isTaskEvent = event.source === 'task';
  const isAutoGenerated = event.isAutoGenerated;

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="event-details-title" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-card rounded-3xl p-5 w-full max-w-xs animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl relative"
            style={{ backgroundColor: event.color }}
          >
            <span aria-hidden="true">{event.emoji}</span>
            {/* Habit indicator badge */}
            {isHabitEvent && (
              <span className="absolute -top-1 -right-1 text-sm bg-primary rounded-full w-6 h-6 flex items-center justify-center" aria-hidden="true">
                🎯
              </span>
            )}
            {/* Task indicator badge */}
            {isTaskEvent && (
              <span className="absolute -top-1 -right-1 text-sm bg-blue-500 rounded-full w-6 h-6 flex items-center justify-center" aria-hidden="true">
                📋
              </span>
            )}
          </div>
          <h3 id="event-details-title" className="text-lg font-semibold">{event.title}</h3>
          <p className="text-sm text-muted-foreground">
            {formatTime(event.startHour, event.startMinute)} - {formatTime(event.endHour, event.endMinute)}
          </p>

          {/* Habit event indicator */}
          {isHabitEvent && (
            <div className="mt-2 px-3 py-1.5 bg-primary/10 rounded-full inline-flex items-center gap-1.5">
              <span>🎯</span>
              <span className="text-xs text-primary font-medium">
                {t.habitReminder || 'Habit Reminder'}
              </span>
            </div>
          )}

          {/* Task event indicator */}
          {isTaskEvent && (
            <div className="mt-2 px-3 py-1.5 bg-blue-500/10 rounded-full inline-flex items-center gap-1.5">
              <span>📋</span>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {t.autoScheduled || 'Auto-scheduled'}
              </span>
            </div>
          )}
        </div>

        {/* Note display */}
        {event.note && (
          <div className="mb-4 p-3 bg-secondary/50 rounded-xl">
            <p className="text-sm text-muted-foreground">{event.note}</p>
          </div>
        )}

        {/* Habit event explanation */}
        {isHabitEvent && (
          <div className="mb-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t.habitEventExplanation || 'This event is from your habit. Edit the habit to change it.'}
            </p>
          </div>
        )}

        {/* Task event explanation */}
        {isTaskEvent && (
          <div className="mb-4 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {t.taskEventExplanation || 'This block is auto-generated from your tasks. Complete the task to remove it.'}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-secondary rounded-xl font-medium"
          >
            {t.close || 'Close'}
          </button>
          {/* Hide delete button for auto-generated events */}
          {onDelete && !isHabitEvent && !isAutoGenerated && (
            <button
              onClick={onDelete}
              className="flex-1 py-3 bg-red-500/20 text-red-500 rounded-xl font-medium"
            >
              {t.delete || 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
