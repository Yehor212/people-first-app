/**
 * TimerRing - SVG circular timer with progress ring and time display
 */

import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface TimerRingProps {
  timeLeft: number;
  progress: number;
  isRunning: boolean;
  isBreak: boolean;
  isPrimaryCTA: boolean;
  concentrateLabel: string;
  takeRestLabel: string;
}

export function TimerRing({
  timeLeft,
  progress,
  isRunning,
  isBreak,
  isPrimaryCTA,
  concentrateLabel,
  takeRestLabel,
}: TimerRingProps) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const boundedProgress = Math.min(100, Math.max(0, progress));
  const strokeDashoffset = circumference * (1 - boundedProgress / 100);
  const strokeWidth = isPrimaryCTA ? 7 : 6;

  return (
    <div className="relative mx-auto mb-6 h-44 w-44 sm:h-52 sm:w-52">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500 motion-safe:ease-out"
        />
      </svg>

      <div
        role="timer"
        aria-label={isBreak ? takeRestLabel : concentrateLabel}
        className="absolute inset-0 flex flex-col items-center justify-center"
      >
        <span
          aria-live={isRunning ? "off" : "polite"}
          aria-atomic="true"
          className={cn(
            "text-5xl font-bold tracking-tight",
            isBreak ? "text-foreground" : "text-primary"
          )}
        >
          {formatTime(timeLeft)}
        </span>
        <span className="mt-2 text-sm text-muted-foreground" aria-hidden="true">
          {isBreak ? takeRestLabel : concentrateLabel}
        </span>
      </div>
    </div>
  );
}
