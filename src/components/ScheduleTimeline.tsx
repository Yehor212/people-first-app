/**
 * Schedule Timeline - Horizontal day view for ADHD users
 * Shows current time, planned activities, and helps with time awareness
 * Supports week planning with day selector
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Clock, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn, getToday } from '@/lib/utils';
import { ScheduleEvent } from '@/types';

interface ScheduleTimelineProps {
  events: ScheduleEvent[];
  onAddEvent?: (event: Omit<ScheduleEvent, 'id'>) => void;
  onDeleteEvent?: (id: string) => void;
}

// Get array of dates for the week (today + 6 days ahead)
function getWeekDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

// Format date for display
function formatDayShort(dateStr: string, language: string): { day: string; weekday: string; isToday: boolean } {
  const date = new Date(dateStr);
  const today = new Date();
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

// Time blocks for the day (6am to 11pm)
const START_HOUR = 6;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

export function ScheduleTimeline({ events, onAddEvent, onDeleteEvent }: ScheduleTimelineProps) {
  const { t, language } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const timelineRef = useRef<HTMLDivElement>(null);

  // Get week dates
  const weekDates = useMemo(() => getWeekDates(), []);

  // Filter events for selected date
  const filteredEvents = useMemo(() => {
    return events.filter(e => e.date === selectedDate);
  }, [events, selectedDate]);

  // Check if a date has events
  const dateHasEvents = (date: string) => {
    return events.some(e => e.date === date);
  };

  // Check if selected date is today
  const isToday = selectedDate === getToday();

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    if (timelineRef.current) {
      const currentHour = currentTime.getHours();
      const scrollPosition = ((currentHour - START_HOUR) / (END_HOUR - START_HOUR)) * timelineRef.current.scrollWidth;
      timelineRef.current.scrollLeft = Math.max(0, scrollPosition - timelineRef.current.clientWidth / 2);
    }
  }, []);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  // Calculate position percentage for current time indicator
  const currentTimePosition = useMemo(() => {
    const totalMinutes = (currentHour - START_HOUR) * 60 + currentMinute;
    const maxMinutes = (END_HOUR - START_HOUR) * 60;
    return Math.max(0, Math.min(100, (totalMinutes / maxMinutes) * 100));
  }, [currentHour, currentMinute]);

  // Format time
  const formatTime = (hour: number, minute: number = 0) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Get current time formatted
  const currentTimeFormatted = formatTime(currentHour, currentMinute);

  // Calculate event position and width
  const getEventStyle = (event: ScheduleEvent) => {
    const startMinutes = (event.startHour - START_HOUR) * 60 + event.startMinute;
    const endMinutes = (event.endHour - START_HOUR) * 60 + event.endMinute;
    const totalMinutes = (END_HOUR - START_HOUR) * 60;

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

        {onAddEvent && (
          <button
            onClick={() => setShowAddModal(true)}
            className="p-2 bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5 text-primary" />
          </button>
        )}
      </div>

      {/* Week Day Selector */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
        {weekDates.map((date) => {
          const { day, weekday, isToday: dayIsToday } = formatDayShort(date, language);
          const isSelected = date === selectedDate;
          const hasEvents = dateHasEvents(date);

          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
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

      {/* Timeline */}
      <div className="relative">
        {/* Scrollable timeline container */}
        <div
          ref={timelineRef}
          className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-primary/20"
        >
          <div className="relative min-w-[600px] h-24">
            {/* Hour markers */}
            <div className="absolute inset-x-0 top-0 flex">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="flex-1 text-center"
                >
                  <span className={cn(
                    "text-xs",
                    hour === currentHour ? "text-primary font-bold" : "text-muted-foreground"
                  )}>
                    {formatTime(hour)}
                  </span>
                </div>
              ))}
            </div>

            {/* Timeline track */}
            <div className="absolute left-0 right-0 top-6 h-12 bg-secondary/50 rounded-xl overflow-hidden">
              {/* Hour grid lines */}
              <div className="absolute inset-0 flex">
                {HOURS.map((hour, i) => (
                  <div
                    key={hour}
                    className={cn(
                      "flex-1 border-r border-border/30",
                      i === HOURS.length - 1 && "border-r-0"
                    )}
                  />
                ))}
              </div>

              {/* Events */}
              {filteredEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  style={getEventStyle(event)}
                  className={cn(
                    "absolute top-1 bottom-1 rounded-lg flex items-center justify-center gap-1 text-white text-xs font-medium transition-all hover:scale-[1.02] hover:z-10",
                    isToday && isEventCurrent(event) && "ring-2 ring-white ring-offset-2 ring-offset-card animate-pulse"
                  )}
                >
                  <span>{event.emoji}</span>
                  <span className="truncate px-1">{event.title}</span>
                </button>
              ))}

              {/* Current time indicator - only show for today */}
              {isToday && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                  style={{ left: `${currentTimePosition}%` }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                </div>
              )}
            </div>

            {/* Period labels */}
            <div className="absolute left-0 right-0 bottom-0 flex text-[10px] text-muted-foreground">
              <div className="flex-1 text-center">{t.morning || 'Morning'}</div>
              <div className="flex-1 text-center">{t.afternoon || 'Afternoon'}</div>
              <div className="flex-1 text-center">{t.evening || 'Evening'}</div>
            </div>
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
  onClose,
  onAdd,
}: {
  selectedDate: string;
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

  // Generate next 14 days for date picker
  const dateOptions = useMemo(() => {
    const dates: { value: string; label: string }[] = [];
    const today = new Date();
    const locale = language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : language === 'es' ? 'es-ES' : language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : 'en-US';

    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const value = date.toISOString().split('T')[0];
      const label = i === 0
        ? (t.today || 'Today')
        : i === 1
          ? (t.tomorrow || 'Tomorrow')
          : date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
      dates.push({ value, label });
    }
    return dates;
  }, [language, t.today, t.tomorrow]);

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
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-card rounded-3xl p-5 w-full max-w-sm animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t.scheduleAddEvent || 'Add Event'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date picker */}
        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1 block">{t.scheduleDate || 'Date'}</label>
          <select
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full p-3 bg-secondary/50 rounded-xl text-sm"
          >
            {dateOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Event type presets */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {EVENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelectedPreset(preset)}
              className={cn(
                "p-3 rounded-xl flex flex-col items-center gap-1 transition-all",
                selectedPreset.id === preset.id
                  ? "ring-2 ring-primary bg-primary/10"
                  : "bg-secondary/50 hover:bg-secondary"
              )}
            >
              <span className="text-xl">{preset.emoji}</span>
              <span className="text-xs">{(t[preset.labelKey as keyof typeof t] as string) || preset.id}</span>
            </button>
          ))}
        </div>

        {/* Custom title */}
        <input
          type="text"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder={t.scheduleCustomTitle || 'Custom title (optional)'}
          className="w-full p-3 bg-secondary/50 rounded-xl text-sm mb-4"
        />

        {/* Time pickers */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">{t.scheduleStart || 'Start'}</label>
            <div className="flex gap-1">
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="flex-1 p-2 bg-secondary/50 rounded-lg text-sm"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <select
                value={startMinute}
                onChange={(e) => setStartMinute(Number(e.target.value))}
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
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="flex-1 p-2 bg-secondary/50 rounded-lg text-sm"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <select
                value={endMinute}
                onChange={(e) => setEndMinute(Number(e.target.value))}
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

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-3xl p-5 w-full max-w-xs animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl"
            style={{ backgroundColor: event.color }}
          >
            {event.emoji}
          </div>
          <h3 className="text-lg font-semibold">{event.title}</h3>
          <p className="text-sm text-muted-foreground">
            {formatTime(event.startHour, event.startMinute)} - {formatTime(event.endHour, event.endMinute)}
          </p>
        </div>

        {/* Note display */}
        {event.note && (
          <div className="mb-4 p-3 bg-secondary/50 rounded-xl">
            <p className="text-sm text-muted-foreground">{event.note}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-secondary rounded-xl font-medium"
          >
            {t.close || 'Close'}
          </button>
          {onDelete && (
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
