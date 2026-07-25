import { motion } from "framer-motion";
import { zenTap } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";
import { ScheduleEvent } from "@/types";
import { formatDayShort, getEventGradient, HOURS_PER_DAY } from "./constants";

// Animated Clock Ring component
export function AnimatedClockRing({
  currentHour,
  currentMinute,
}: {
  currentHour: number;
  currentMinute: number;
}) {
  const dayProgress = ((currentHour * 60 + currentMinute) / (24 * 60)) * 100;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (dayProgress / 100) * circumference;

  return (
    <div
      className="relative h-20 w-20 shrink-0"
      data-testid="schedule-clock-ring"
    >
      {/* Outer glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 20px rgba(139, 92, 246, 0.3)",
            "0 0 40px rgba(139, 92, 246, 0.5)",
            "0 0 20px rgba(139, 92, 246, 0.3)",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <defs>
          <linearGradient
            id="clockGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        {/* Background ring - theme-aware */}
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="hsl(var(--cosmic-clock-ring))"
          strokeOpacity="0.2"
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
          transition={{ duration: 1, ease: "easeOut" }}
        />

        {/* Hour markers - theme-aware */}
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
              fill="hsl(var(--cosmic-clock-marker))"
              fillOpacity="0.5"
            />
          );
        })}
      </svg>

      {/* Center time - theme-aware */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="min-w-0 max-w-full whitespace-nowrap text-center text-sm font-bold leading-none tracking-tight [font-variant-numeric:tabular-nums] [text-shadow:0_0_10px_rgba(139,92,246,0.5)] md:text-base"
          data-testid="schedule-clock-time"
          style={{
            color: "hsl(var(--cosmic-text-primary))",
          }}
          animate={{ opacity: [1, 0.8, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {currentHour.toString().padStart(2, "0")}:
          {currentMinute.toString().padStart(2, "0")}
        </motion.span>
      </div>
    </div>
  );
}

// Premium Day Pill component
export function PremiumDayPill({
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
      aria-pressed={isSelected}
      aria-current={isToday ? "date" : undefined}
      whileHover={{ scale: 1.1, y: -4 }}
      whileTap={zenTap.button}
      className={cn(
        "snap-start relative flex-shrink-0 flex flex-col items-center py-3 px-4 rounded-2xl motion-safe:transition-all motion-safe:duration-300 min-w-[60px]",
        "backdrop-blur-md border [perspective:500px]",
        isSelected
          ? "bg-gradient-to-br from-primary/40 to-accent/30 border-primary/50 shadow-lg shadow-primary/30"
          : "bg-secondary border-border hover:bg-secondary/80 hover:border-border",
      )}
    >
      {/* Today glow ring */}
      {isToday && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              "0 0 10px rgba(34, 197, 94, 0.3)",
              "0 0 20px rgba(34, 197, 94, 0.5)",
              "0 0 10px rgba(34, 197, 94, 0.3)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <span
        className={cn(
          "text-xs font-medium uppercase",
          isSelected && "text-white",
        )}
        style={
          !isSelected ? { color: "hsl(var(--cosmic-pill-text))" } : undefined
        }
      >
        {weekday}
      </span>
      <span
        className={cn("text-lg font-bold", isSelected && "text-white")}
        style={
          !isSelected ? { color: "hsl(var(--cosmic-text-primary))" } : undefined
        }
      >
        {day}
      </span>

      {/* Event indicator */}
      {hasEvents && (
        <motion.div
          className={cn(
            "absolute -top-1 -end-1 w-3 h-3 rounded-full",
            isSelected ? "bg-white dark:bg-white" : "bg-accent",
          )}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}

// 3D Event Card component
export function EventCard3D({
  event,
  isCurrent,
  onClick,
}: {
  event: ScheduleEvent;
  isCurrent: boolean;
  onClick: () => void;
}) {
  const gradient = getEventGradient(event.colorVar, event.urgent);
  const isHabitEvent = event.source === "habit";
  const isTaskEvent = event.source === "task";
  const isGoogleEvent = event.source === "google";
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
        "backdrop-blur-md border border-white/20 dark:border-white/20",
        "flex items-center justify-center gap-1.5",
        "text-white text-sm font-medium",
        "bg-gradient-to-br",
        gradient,
        isHabitEvent && "border-2 border-dashed border-white/40 dark:border-white/40",
        isAutoGenerated && "border-2 border-dashed border-white/50 dark:border-white/50",
      )}
      style={{
        left: `${left}%`,
        width: `${Math.max(width, 2)}%`,
      }}
      whileHover={{
        scale: 1.03,
        rotateX: -3,
        rotateY: 3,
        boxShadow: "0 15px 30px rgba(0, 0, 0, 0.3)",
        zIndex: 20,
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {/* Current event glow */}
      {isCurrent && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-white/60 dark:border-white/60 pointer-events-none"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Source badges */}
      {isHabitEvent && (
        <span className="absolute -top-1 -start-1 text-xs bg-white/30 dark:bg-white/30 rounded-full w-4 h-4 flex items-center justify-center backdrop-blur-sm">
          🎯
        </span>
      )}
      {isTaskEvent && (
        <span className="absolute -top-1 -start-1 text-xs bg-white/30 dark:bg-white/30 rounded-full w-4 h-4 flex items-center justify-center backdrop-blur-sm">
          📋
        </span>
      )}
      {isGoogleEvent && (
        <span className="absolute -top-1 -start-1 text-xs bg-white/30 dark:bg-white/30 rounded-full w-4 h-4 flex items-center justify-center backdrop-blur-sm">
          G
        </span>
      )}

      {/* Emoji with glow */}
      <motion.span
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]"
      >
        {event.emoji}
      </motion.span>

      <span className="truncate px-1">{event.title}</span>
    </motion.button>
  );
}

// Current Time Orb indicator
export function CurrentTimeOrb({
  positionPercent,
}: {
  positionPercent: number;
}) {
  return (
    <motion.div
      className="absolute top-0 bottom-0 z-20"
      style={{ left: `${positionPercent}%` }}
    >
      {/* Trailing glow line */}
      <div className="absolute right-full top-1/2 -translate-y-1/2 w-16 h-0.5 bg-[linear-gradient(to_left,rgba(239,68,68,0.8),transparent)]" />

      {/* Main line */}
      <div className="absolute inset-y-0 start-0 w-0.5 bg-red-500" />

      {/* Top orb */}
      <motion.div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full"
        animate={{
          boxShadow: [
            "0 0 10px rgba(239, 68, 68, 0.5)",
            "0 0 20px rgba(239, 68, 68, 0.8)",
            "0 0 10px rgba(239, 68, 68, 0.5)",
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
            "0 0 10px rgba(239, 68, 68, 0.5)",
            "0 0 20px rgba(239, 68, 68, 0.8)",
            "0 0 10px rgba(239, 68, 68, 0.5)",
          ],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
      />
    </motion.div>
  );
}
