/**
 * Schedule Timeline - "Мій Світ" (My World)
 * Premium cosmic-themed schedule visualization for ADHD users
 * Features: Animated clock ring, cosmic background, 3D event cards
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Clock, X, Check, Home, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn, getToday, formatDate, parseLocalDate } from '@/lib/utils';
import { ScheduleEvent } from '@/types';
import { safeParseInt } from '@/lib/validation';
import { Task } from '@/lib/taskMomentum';
import { safeJsonParse } from '@/lib/safeJson';
import { ParticleBackground } from '@/components/stats';

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
  for (let i = -30; i <= 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(formatDate(date));
  }
  return dates;
}

// Format date for display
function formatDayShort(dateStr: string, language: string): { day: string; weekday: string; isToday: boolean } {
  const date = parseLocalDate(dateStr);
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

// Event color system
const EVENT_COLORS = {
  work: 'hsl(var(--event-work))',
  meal: 'hsl(var(--event-meal))',
  rest: 'hsl(var(--event-rest))',
  exercise: 'hsl(var(--event-exercise))',
  study: 'hsl(var(--event-study))',
  meeting: 'hsl(var(--event-meeting))',
  break: 'hsl(var(--event-break))',
  urgent: 'hsl(var(--event-urgent))',
} as const;

// Event gradient mappings for premium cards
const EVENT_GRADIENTS = {
  work: 'from-blue-500/40 to-blue-600/30',
  meal: 'from-green-500/40 to-green-600/30',
  rest: 'from-purple-500/40 to-purple-600/30',
  exercise: 'from-orange-500/40 to-orange-600/30',
  study: 'from-cyan-500/40 to-cyan-600/30',
  meeting: 'from-pink-500/40 to-pink-600/30',
  break: 'from-amber-500/40 to-amber-600/30',
  urgent: 'from-red-500/40 to-red-600/30',
} as const;

const getEventColor = (colorVar?: string, isUrgent?: boolean): string => {
  if (isUrgent) return EVENT_COLORS.urgent;
  if (colorVar && colorVar in EVENT_COLORS) {
    return EVENT_COLORS[colorVar as keyof typeof EVENT_COLORS];
  }
  return EVENT_COLORS.work;
};

const getEventGradient = (colorVar?: string, isUrgent?: boolean): string => {
  if (isUrgent) return EVENT_GRADIENTS.urgent;
  if (colorVar && colorVar in EVENT_GRADIENTS) {
    return EVENT_GRADIENTS[colorVar as keyof typeof EVENT_GRADIENTS];
  }
  return EVENT_GRADIENTS.work;
};

// Event presets
const EVENT_PRESETS = [
  { id: 'work', emoji: '💼', colorVar: 'work', labelKey: 'scheduleWork' },
  { id: 'meal', emoji: '🍽️', colorVar: 'meal', labelKey: 'scheduleMeal' },
  { id: 'rest', emoji: '😴', colorVar: 'rest', labelKey: 'scheduleRest' },
  { id: 'exercise', emoji: '🏃', colorVar: 'exercise', labelKey: 'scheduleExercise' },
  { id: 'study', emoji: '📚', colorVar: 'study', labelKey: 'scheduleStudy' },
  { id: 'meeting', emoji: '👥', colorVar: 'meeting', labelKey: 'scheduleMeeting' },
];

// Timeline constants
const HOURS_PER_DAY = 24;
const HOURS = Array.from({ length: HOURS_PER_DAY }, (_, i) => i);
const HOUR_WIDTH_PX = 60;
const DAY_WIDTH_PX = HOURS_PER_DAY * HOUR_WIDTH_PX;

// Animated Clock Ring component
function AnimatedClockRing({ currentHour, currentMinute }: { currentHour: number; currentMinute: number }) {
  const dayProgress = ((currentHour * 60 + currentMinute) / (24 * 60)) * 100;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (dayProgress / 100) * circumference;

  return (
    <div className="relative w-20 h-20">
      {/* Outer glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: [
            '0 0 20px rgba(139, 92, 246, 0.3)',
            '0 0 40px rgba(139, 92, 246, 0.5)',
            '0 0 20px rgba(139, 92, 246, 0.3)',
          ],
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="clockGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        {/* Background ring */}
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="4"
        />

        {/* Progress ring */}
        <motion.circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="url(#clockGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />

        {/* Hour markers */}
        {[0, 6, 12, 18].map((hour) => {
          const angle = (hour / 24) * 360 - 90;
          const x = 50 + 35 * Math.cos((angle * Math.PI) / 180);
          const y = 50 + 35 * Math.sin((angle * Math.PI) / 180);
          return (
            <circle
              key={hour}
              cx={x}
              cy={y}
              r="2"
              fill="rgba(255, 255, 255, 0.4)"
            />
          );
        })}
      </svg>

      {/* Center time */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-xl font-bold text-white"
          style={{ textShadow: '0 0 10px rgba(139, 92, 246, 0.5)' }}
          animate={{ opacity: [1, 0.8, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {currentHour.toString().padStart(2, '0')}:{currentMinute.toString().padStart(2, '0')}
        </motion.span>
      </div>
    </div>
  );
}

// Premium Day Pill component
function PremiumDayPill({
  date,
  isSelected,
  isToday,
  hasEvents,
  onClick,
  language,
}: {
  date: string;
  isSelected: boolean;
  isToday: boolean;
  hasEvents: boolean;
  onClick: () => void;
  language: string;
}) {
  const { day, weekday } = formatDayShort(date, language);

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.1, y: -4 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "relative flex-shrink-0 flex flex-col items-center py-3 px-4 rounded-2xl transition-all duration-300 min-w-[60px]",
        "backdrop-blur-md border",
        isSelected
          ? "bg-gradient-to-br from-primary/40 to-accent/30 border-primary/50 shadow-lg shadow-primary/30"
          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
      )}
      style={{ perspective: 500 }}
    >
      {/* Today glow ring */}
      {isToday && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              '0 0 10px rgba(34, 197, 94, 0.3)',
              '0 0 20px rgba(34, 197, 94, 0.5)',
              '0 0 10px rgba(34, 197, 94, 0.3)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <span className={cn(
        "text-xs font-medium uppercase",
        isSelected ? "text-white" : "text-white/60"
      )}>
        {weekday}
      </span>
      <span className={cn(
        "text-lg font-bold",
        isSelected ? "text-white" : "text-white/90"
      )}>
        {day}
      </span>

      {/* Event indicator */}
      {hasEvents && (
        <motion.div
          className={cn(
            "absolute -top-1 -right-1 w-3 h-3 rounded-full",
            isSelected ? "bg-white" : "bg-accent"
          )}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}

// 3D Event Card component
function EventCard3D({
  event,
  isCurrent,
  onClick,
}: {
  event: ScheduleEvent;
  isCurrent: boolean;
  onClick: () => void;
}) {
  const gradient = getEventGradient(event.colorVar, event.urgent);
  const isHabitEvent = event.source === 'habit';
  const isTaskEvent = event.source === 'task';
  const isAutoGenerated = event.isAutoGenerated;

  // Calculate position and width
  const startMinutes = event.startHour * 60 + event.startMinute;
  const endMinutes = event.endHour * 60 + event.endMinute;
  const totalMinutes = HOURS_PER_DAY * 60;
  const left = (startMinutes / totalMinutes) * 100;
  const width = ((endMinutes - startMinutes) / totalMinutes) * 100;

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "absolute top-1.5 bottom-1.5 rounded-xl overflow-hidden",
        "backdrop-blur-md border border-white/20",
        "flex items-center justify-center gap-1.5",
        "text-white text-sm font-medium",
        "bg-gradient-to-br",
        gradient,
        isHabitEvent && "border-2 border-dashed border-white/40",
        isAutoGenerated && "border-2 border-dashed border-white/50"
      )}
      style={{
        left: `${left}%`,
        width: `${Math.max(width, 2)}%`,
      }}
      whileHover={{
        scale: 1.03,
        rotateX: -3,
        rotateY: 3,
        boxShadow: '0 15px 30px rgba(0, 0, 0, 0.3)',
        zIndex: 20,
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Current event glow */}
      {isCurrent && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-white/60 pointer-events-none"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Source badges */}
      {isHabitEvent && (
        <span className="absolute -top-1 -left-1 text-xs bg-white/30 rounded-full w-4 h-4 flex items-center justify-center backdrop-blur-sm">
          🎯
        </span>
      )}
      {isTaskEvent && (
        <span className="absolute -top-1 -left-1 text-xs bg-white/30 rounded-full w-4 h-4 flex items-center justify-center backdrop-blur-sm">
          📋
        </span>
      )}

      {/* Emoji with glow */}
      <motion.span
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ filter: 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.5))' }}
      >
        {event.emoji}
      </motion.span>

      <span className="truncate px-1">{event.title}</span>
    </motion.button>
  );
}

// Current Time Orb indicator
function CurrentTimeOrb({ positionPercent }: { positionPercent: number }) {
  return (
    <motion.div
      className="absolute top-0 bottom-0 z-20"
      style={{ left: `${positionPercent}%` }}
    >
      {/* Trailing glow line */}
      <div
        className="absolute right-full top-1/2 -translate-y-1/2 w-16 h-0.5"
        style={{
          background: 'linear-gradient(to left, rgba(239, 68, 68, 0.8), transparent)',
        }}
      />

      {/* Main line */}
      <div className="absolute inset-y-0 left-0 w-0.5 bg-red-500" />

      {/* Top orb */}
      <motion.div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full"
        animate={{
          boxShadow: [
            '0 0 10px rgba(239, 68, 68, 0.5)',
            '0 0 20px rgba(239, 68, 68, 0.8)',
            '0 0 10px rgba(239, 68, 68, 0.5)',
          ],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />

      {/* Bottom orb */}
      <motion.div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full"
        animate={{
          boxShadow: [
            '0 0 10px rgba(239, 68, 68, 0.5)',
            '0 0 20px rgba(239, 68, 68, 0.8)',
            '0 0 10px rgba(239, 68, 68, 0.5)',
          ],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
      />
    </motion.div>
  );
}

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
      } else {
        setTasks([]);
      }
    };
    loadTasks();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === TASKS_STORAGE_KEY) loadTasks();
    };
    window.addEventListener('storage', handleStorage);

    const handleTasksUpdate = () => loadTasks();
    window.addEventListener('zenflow-tasks-updated', handleTasksUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('zenflow-tasks-updated', handleTasksUpdate);
    };
  }, []);

  // Generate auto-schedule events from tasks
  const taskEvents = useMemo((): ScheduleEvent[] => {
    const today = getToday();
    const incompleteTasks = tasks.filter(t => !t.completed);
    if (incompleteTasks.length === 0) return [];

    const generatedEvents: ScheduleEvent[] = [];
    let currentTimestamp = Date.now();

    incompleteTasks.forEach(task => {
      const workDuration = task.estimatedMinutes * 60 * 1000;
      const breakDuration = (task.breakMinutes || 0) * 60 * 1000;

      const workStart = new Date(currentTimestamp);
      const workEnd = new Date(currentTimestamp + workDuration);

      generatedEvents.push({
        id: `task-work-${task.id}`,
        title: task.name,
        startHour: workStart.getHours(),
        startMinute: workStart.getMinutes(),
        endHour: workEnd.getHours(),
        endMinute: workEnd.getMinutes(),
        colorVar: task.urgent ? 'urgent' : 'work',
        color: getEventColor('work', task.urgent),
        urgent: task.urgent,
        emoji: '💼',
        date: today,
        source: 'task',
        taskId: task.id,
        isAutoGenerated: true,
        isEditable: false,
      });

      currentTimestamp += workDuration;

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
          colorVar: 'break',
          color: EVENT_COLORS.break,
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

  const safeEvents = useMemo(() => {
    const manual = Array.isArray(events) ? events : [];
    return [...manual, ...taskEvents];
  }, [events, taskEvents]);

  const allDates = useMemo(() => getExtendedDates(), []);

  const getDateIndex = useCallback((date: string) => {
    return allDates.indexOf(date);
  }, [allDates]);

  const filteredEvents = useMemo(() => {
    return safeEvents.filter(e => e.date === selectedDate);
  }, [safeEvents, selectedDate]);

  const dateHasEvents = useCallback((date: string) => {
    return safeEvents.some(e => e.date === date);
  }, [safeEvents]);

  const isToday = selectedDate === getToday();

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Scroll helpers
  const scrollDaySelectorToDate = useCallback((date: string) => {
    if (!daySelectorRef.current) return;
    const index = getDateIndex(date);
    if (index === -1) return;

    const buttonWidth = 68;
    const containerWidth = daySelectorRef.current.clientWidth;
    const scrollPosition = (index * buttonWidth) - (containerWidth / 2) + (buttonWidth / 2);

    daySelectorRef.current.scrollTo({
      left: Math.max(0, scrollPosition),
      behavior: 'smooth'
    });
  }, [getDateIndex]);

  const scrollTimelineToDate = useCallback((date: string, centerOnCurrentHour = false) => {
    if (!timelineRef.current) return;
    const index = getDateIndex(date);
    if (index === -1) return;

    isScrollingProgrammatically.current = true;

    let scrollPosition = index * DAY_WIDTH_PX;

    if (centerOnCurrentHour && date === getToday()) {
      const currentHour = new Date().getHours();
      scrollPosition += currentHour * HOUR_WIDTH_PX;
    }

    scrollPosition -= timelineRef.current.clientWidth / 2;

    timelineRef.current.scrollTo({
      left: Math.max(0, scrollPosition),
      behavior: 'smooth'
    });

    setTimeout(() => {
      isScrollingProgrammatically.current = false;
    }, 500);
  }, [getDateIndex]);

  // Initial scroll to today
  useEffect(() => {
    const today = getToday();
    setSelectedDate(today);
    scrollTimelineToDate(today, true);
    scrollDaySelectorToDate(today);
  }, [scrollTimelineToDate, scrollDaySelectorToDate]);

  // Handle timeline scroll
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
  }, [allDates, selectedDate, scrollDaySelectorToDate]);

  const handleDayClick = useCallback((date: string) => {
    setSelectedDate(date);
    scrollTimelineToDate(date, date === getToday());
  }, [scrollTimelineToDate]);

  const goToToday = useCallback(() => {
    const today = getToday();
    setSelectedDate(today);
    scrollTimelineToDate(today, true);
    scrollDaySelectorToDate(today);
  }, [scrollTimelineToDate, scrollDaySelectorToDate]);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  const formatTime = (hour: number, minute: number = 0) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

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
    events.forEach(event => {
      const existing = map.get(event.date) || [];
      existing.push(event);
      map.set(event.date, existing);
    });
    return map;
  }, [events]);

  return (
    <div className="relative overflow-hidden rounded-3xl animate-fade-in">
      {/* Cosmic background */}
      <div
        className="absolute inset-0"
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
                className="text-lg font-bold text-white flex items-center gap-2"
                style={{ textShadow: '0 0 10px rgba(139, 92, 246, 0.3)' }}
              >
                <motion.span
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </motion.span>
                {t.myWorld || 'Мій Світ'}
              </motion.h3>

              {/* Current event badge */}
              {currentEvent && (
                <motion.div
                  className="mt-1 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full inline-flex items-center gap-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <span>{currentEvent.emoji}</span>
                  <span className="text-sm text-white/80">{currentEvent.title}</span>
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
                whileTap={{ scale: 0.95 }}
                className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/10 transition-colors"
                aria-label={t.today || 'Today'}
              >
                <Home className="w-5 h-5 text-white/80" />
              </motion.button>
            )}

            {/* Add event button */}
            {onAddEvent && (
              <motion.button
                onClick={() => setShowAddModal(true)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
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
                            "text-sm font-medium tabular-nums",
                            isDayToday && hour === currentHour
                              ? "text-purple-700 dark:text-purple-300 font-bold"
                              : hour === 0
                                ? "text-white/90 font-semibold"
                                : "text-white/50"
                          )}>
                            {hour === 0 ? formatDayShort(date, language).day : formatTime(hour)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Timeline track with gradient */}
                    <div className={cn(
                      "absolute left-0 right-0 top-8 h-16 rounded-2xl overflow-hidden",
                      "backdrop-blur-sm border",
                      isDaySelected
                        ? "bg-white/10 border-white/20"
                        : "bg-white/5 border-white/10"
                    )}>
                      {/* Gradient river background */}
                      <div
                        className="absolute inset-0 opacity-30"
                        style={{
                          background: 'linear-gradient(90deg, rgba(99,102,241,0.3) 0%, rgba(168,85,247,0.3) 50%, rgba(236,72,153,0.3) 100%)',
                        }}
                      />

                      {/* Hour grid lines */}
                      <div className="absolute inset-0 flex">
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            className={cn(
                              "border-r",
                              hour === 0
                                ? "border-purple-500/40 border-r-2"
                                : hour % 6 === 0
                                  ? "border-white/20"
                                  : "border-white/10"
                            )}
                            style={{ width: `${HOUR_WIDTH_PX}px` }}
                          />
                        ))}
                      </div>

                      {/* 3D Event Cards */}
                      {dayEvents.map((event) => (
                        <EventCard3D
                          key={event.id}
                          event={event}
                          isCurrent={isDayToday && isEventCurrent(event)}
                          onClick={() => setSelectedEvent(event)}
                        />
                      ))}

                      {/* Current time orb - only for today */}
                      {isDayToday && (
                        <CurrentTimeOrb positionPercent={currentTimePositionPercent} />
                      )}
                    </div>

                    {/* Period labels */}
                    <div className="absolute left-0 right-0 bottom-0 flex text-xs text-white/40">
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

          {/* Scroll fade indicators */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0f0f23] to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0f0f23] to-transparent pointer-events-none" />
        </div>

        {/* Empty state */}
        {filteredEvents.length === 0 && (
          <motion.div
            className="mt-3 text-center py-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm text-white/60">
              {isToday
                ? (t.scheduleEmpty || 'No events planned. Tap + to add your schedule!')
                : (t.scheduleEmptyDay || 'No events for this day')}
            </p>
          </motion.div>
        )}

        {/* Task Focus Panel */}
        <TaskFocusPanel tasks={tasks} t={t} />
      </div>

      {/* Bottom glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at bottom, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
        }}
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

// Premium Add Event Modal
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

  const formatDateOption = (dateStr: string): string => {
    const date = parseLocalDate(dateStr);
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
      colorVar: selectedPreset.colorVar,
      color: getEventColor(selectedPreset.colorVar),
      emoji: selectedPreset.emoji,
      date: eventDate,
      note: note.trim() || undefined,
    });
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-event-title"
      className="fixed inset-0 flex items-end sm:items-center justify-center p-4"
      style={{ zIndex: 'var(--z-overlay)', marginBottom: 'var(--nav-height)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Modal content */}
      <motion.div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom))' }}
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
      >
        {/* Cosmic background */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg,
              #0f0f23 0%,
              #1a1a3e 50%,
              #2d1b4e 100%)`,
          }}
        />

        <ParticleBackground count={10} color="purple" />

        {/* Content */}
        <div className="relative z-10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 id="add-event-title" className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              {t.scheduleAddEvent || 'Add Event'}
            </h3>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              aria-label={t.close || 'Close'}
            >
              <X className="w-5 h-5 text-white/80" />
            </motion.button>
          </div>

          {/* Date picker */}
          <div className="mb-4">
            <label className="text-xs text-white/60 mb-1 block">{t.scheduleDate || 'Date'}</label>
            <select
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full p-3 bg-white/10 backdrop-blur-sm rounded-xl text-sm text-white border border-white/20 focus:border-primary/50 focus:outline-none"
            >
              {allDates.map((date) => (
                <option key={date} value={date} className="bg-slate-900">{formatDateOption(date)}</option>
              ))}
            </select>
          </div>

          {/* Event type presets - 3D cards */}
          <div className="grid grid-cols-3 gap-2 mb-4" role="group" aria-label={t.scheduleEventType || 'Event type'}>
            {EVENT_PRESETS.map((preset) => {
              const label = (t[preset.labelKey as keyof typeof t] as string) || preset.id;
              const isSelected = selectedPreset.id === preset.id;
              const gradient = getEventGradient(preset.colorVar);

              return (
                <motion.button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset)}
                  whileHover={{ scale: 1.05, rotateY: 5 }}
                  whileTap={{ scale: 0.95 }}
                  aria-pressed={isSelected}
                  aria-label={label}
                  className={cn(
                    "p-3 rounded-xl flex flex-col items-center gap-1 transition-all",
                    "backdrop-blur-sm border",
                    isSelected
                      ? `bg-gradient-to-br ${gradient} border-white/30 shadow-lg`
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  )}
                >
                  <motion.span
                    className="text-2xl"
                    animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.5 }}
                    style={isSelected ? { filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))' } : {}}
                  >
                    {preset.emoji}
                  </motion.span>
                  <span className="text-xs text-white/80">{label}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Custom title */}
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder={t.scheduleCustomTitle || 'Custom title (optional)'}
            className="w-full p-3 bg-white/10 backdrop-blur-sm rounded-xl text-sm text-white border border-white/20 focus:border-primary/50 focus:outline-none mb-4 placeholder:text-white/40"
          />

          {/* Time pickers */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <label className="text-xs text-white/60 mb-1 block">{t.scheduleStart || 'Start'}</label>
              <div className="flex gap-1">
                <select
                  value={startHour}
                  onChange={(e) => setStartHour(safeParseInt(e.target.value, 9, 0, 23))}
                  className="flex-1 p-2 bg-white/10 backdrop-blur-sm rounded-lg text-sm text-white border border-white/20"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h} className="bg-slate-900">{h.toString().padStart(2, '0')}</option>
                  ))}
                </select>
                <select
                  value={startMinute}
                  onChange={(e) => setStartMinute(safeParseInt(e.target.value, 0, 0, 59))}
                  className="flex-1 p-2 bg-white/10 backdrop-blur-sm rounded-lg text-sm text-white border border-white/20"
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m} className="bg-slate-900">{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-white/60 mb-1 block">{t.scheduleEnd || 'End'}</label>
              <div className="flex gap-1">
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(safeParseInt(e.target.value, 10, 0, 23))}
                  className="flex-1 p-2 bg-white/10 backdrop-blur-sm rounded-lg text-sm text-white border border-white/20"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h} className="bg-slate-900">{h.toString().padStart(2, '0')}</option>
                  ))}
                </select>
                <select
                  value={endMinute}
                  onChange={(e) => setEndMinute(safeParseInt(e.target.value, 0, 0, 59))}
                  className="flex-1 p-2 bg-white/10 backdrop-blur-sm rounded-lg text-sm text-white border border-white/20"
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m} className="bg-slate-900">{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="mb-4">
            <label className="text-xs text-white/60 mb-1 block">{t.scheduleNote || 'Note (optional)'}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.scheduleNotePlaceholder || 'Add details or reminders...'}
              className="w-full p-3 bg-white/10 backdrop-blur-sm rounded-xl text-sm text-white border border-white/20 focus:border-primary/50 focus:outline-none resize-none placeholder:text-white/40"
              rows={2}
            />
          </div>

          {/* Add button */}
          <motion.button
            onClick={handleAdd}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
          >
            <Check className="w-5 h-5" />
            {t.addToMyWorld || 'Додати в Мій Світ'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Task Focus Panel - detailed minute view for active tasks
function TaskFocusPanel({ tasks, t }: { tasks: Task[]; t: Record<string, string> }) {
  const [now, setNow] = useState(Date.now());
  const initialTimeRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const incompleteTasks = tasks.filter(task => !task.completed);
  if (incompleteTasks.length === 0) return null;

  let currentTimestamp = initialTimeRef.current;
  const blocks: Array<{
    id: string;
    title: string;
    emoji: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    color: string;
    type: 'work' | 'break';
  }> = [];

  incompleteTasks.forEach(task => {
    const workStart = new Date(currentTimestamp);
    const workEnd = new Date(currentTimestamp + task.estimatedMinutes * 60000);

    blocks.push({
      id: `work-${task.id}`,
      title: task.name,
      emoji: '💼',
      startTime: workStart,
      endTime: workEnd,
      duration: task.estimatedMinutes,
      color: getEventColor('work', task.urgent),
      type: 'work',
    });

    currentTimestamp += task.estimatedMinutes * 60000;

    if (task.breakMinutes && task.breakMinutes > 0) {
      const breakStart = new Date(currentTimestamp);
      const breakEnd = new Date(currentTimestamp + task.breakMinutes * 60000);

      blocks.push({
        id: `break-${task.id}`,
        title: t.breakTime || 'Отдых',
        emoji: '☕',
        startTime: breakStart,
        endTime: breakEnd,
        duration: task.breakMinutes,
        color: EVENT_COLORS.break,
        type: 'break',
      });

      currentTimestamp += task.breakMinutes * 60000;
    }
  });

  const formatTime = (date: Date) =>
    `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

  const totalMinutes = blocks.reduce((sum, b) => sum + b.duration, 0);

  const getBlockProgress = (block: typeof blocks[0], index: number): number => {
    if (index > 0) return 0;
    const elapsed = now - block.startTime.getTime();
    const total = block.duration * 60000;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  return (
    <motion.div
      className="mt-3 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📋</span>
        <span className="text-sm font-medium text-white/90">
          {t.yourTasksNow || 'Your tasks now'}
        </span>
      </div>

      {/* Progress bar showing all blocks */}
      <div className="flex gap-1 h-12 rounded-xl overflow-hidden mb-2">
        {blocks.map((block, index) => {
          const progress = getBlockProgress(block, index);
          const isActive = index === 0;
          const remainingMinutes = Math.ceil(block.duration - (progress / 100 * block.duration));

          return (
            <motion.div
              key={block.id}
              className="relative flex items-center justify-center gap-1 text-white text-xs font-medium overflow-hidden rounded-lg"
              style={{
                backgroundColor: block.color,
                width: `${(block.duration / totalMinutes) * 100}%`,
                minWidth: '70px',
              }}
              whileHover={{ scale: 1.02 }}
            >
              {/* Progress overlay */}
              {isActive && progress > 0 && (
                <motion.div
                  className="absolute inset-y-0 left-0 bg-black/30"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1 }}
                />
              )}

              <span className="relative z-10">{block.emoji}</span>
              <span className="relative z-10 truncate">{block.title}</span>

              {isActive && progress > 0 && (
                <span className="absolute bottom-1 right-1 text-xs bg-black/40 px-1.5 py-0.5 rounded z-10">
                  {remainingMinutes} {t.min || 'min'}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Time labels */}
      <div className="flex gap-1">
        {blocks.map(block => (
          <div
            key={`time-${block.id}`}
            className="text-xs text-white/50 text-center"
            style={{ width: `${(block.duration / totalMinutes) * 100}%`, minWidth: '70px' }}
          >
            {formatTime(block.startTime)} — {formatTime(block.endTime)}
            <br />
            ({block.duration} {t.min || 'min'})
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Premium Event Details Modal
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
  const gradient = getEventGradient(event.colorVar, event.urgent);

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-details-title"
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 60 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Modal content */}
      <motion.div
        className="relative w-full max-w-xs rounded-3xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cosmic background */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg,
              #0f0f23 0%,
              #1a1a3e 50%,
              #2d1b4e 100%)`,
          }}
        />

        <ParticleBackground count={8} color="purple" />

        {/* Content */}
        <div className="relative z-10 p-5">
          <div className="text-center mb-4">
            {/* Event icon with glow */}
            <motion.div
              className={cn(
                "w-20 h-20 rounded-2xl mx-auto mb-3 flex items-center justify-center text-4xl relative",
                "bg-gradient-to-br",
                gradient,
                "backdrop-blur-sm border border-white/20"
              )}
              animate={{
                boxShadow: [
                  '0 0 20px rgba(139, 92, 246, 0.3)',
                  '0 0 40px rgba(139, 92, 246, 0.5)',
                  '0 0 20px rgba(139, 92, 246, 0.3)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {event.emoji}
              </motion.span>

              {isHabitEvent && (
                <span className="absolute -top-1 -right-1 text-sm bg-primary rounded-full w-6 h-6 flex items-center justify-center">
                  🎯
                </span>
              )}
              {isTaskEvent && (
                <span className="absolute -top-1 -right-1 text-sm bg-primary rounded-full w-6 h-6 flex items-center justify-center">
                  📋
                </span>
              )}
            </motion.div>

            <h3 id="event-details-title" className="text-lg font-bold text-white">{event.title}</h3>
            <p className="text-sm text-white/60">
              {formatTime(event.startHour, event.startMinute)} - {formatTime(event.endHour, event.endMinute)}
            </p>

            {isHabitEvent && (
              <div className="mt-2 px-3 py-1.5 bg-primary/20 rounded-full inline-flex items-center gap-1.5">
                <span>🎯</span>
                <span className="text-xs text-primary font-medium">
                  {t.habitReminder || 'Habit Reminder'}
                </span>
              </div>
            )}

            {isTaskEvent && (
              <div className="mt-2 px-3 py-1.5 bg-primary/20 rounded-full inline-flex items-center gap-1.5">
                <span>📋</span>
                <span className="text-xs text-primary font-medium">
                  {t.autoScheduled || 'Auto-scheduled'}
                </span>
              </div>
            )}
          </div>

          {event.note && (
            <div className="mb-4 p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
              <p className="text-sm text-white/80">{event.note}</p>
            </div>
          )}

          {isHabitEvent && (
            <div className="mb-4 p-3 bg-green-500/10 rounded-xl border border-green-500/20">
              <p className="text-xs text-green-400">
                {t.habitEventExplanation || 'This event is from your habit. Edit the habit to change it.'}
              </p>
            </div>
          )}

          {isTaskEvent && (
            <div className="mb-4 p-3 bg-primary/10 rounded-xl border border-primary/20">
              <p className="text-xs text-primary">
                {t.taskEventExplanation || 'This block is auto-generated from your tasks. Complete the task to remove it.'}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-3 bg-white/10 backdrop-blur-sm rounded-xl font-medium text-white border border-white/20"
            >
              {t.close || 'Close'}
            </motion.button>

            {onDelete && !isHabitEvent && !isAutoGenerated && (
              <motion.button
                onClick={onDelete}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-3 bg-red-500/20 text-red-400 rounded-xl font-medium border border-red-500/30"
              >
                {t.delete || 'Delete'}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
