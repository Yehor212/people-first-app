/**
 * TimerControls - Play/pause, reset, and hyperfocus mode buttons
 */

import { Play, Pause, RotateCcw, Focus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TimerControlsProps {
  isPrimaryCTA: boolean;
  isRunning: boolean;
  isBreak: boolean;
  onToggle: () => void;
  onReset: () => void;
  onShowHyperfocus: () => void;
  labels: {
    pause: string;
    start: string;
    resetTimer: string;
    hyperfocusMode: string;
  };
}

export function TimerControls({
  isPrimaryCTA,
  isRunning,
  onToggle,
  onReset,
  onShowHyperfocus,
  labels,
}: TimerControlsProps) {
  return (
    <>
      <div className="mb-4 flex justify-center gap-4">
        <Button
          type="button"
          variant="default"
          size="icon-lg"
          onClick={onToggle}
          aria-label={isRunning ? labels.pause : labels.start}
          className={cn("rounded-full", isPrimaryCTA && "min-h-16 min-w-16")}
        >
          {isRunning ? (
            <Pause className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Play className="h-6 w-6" aria-hidden="true" />
          )}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon-lg"
          onClick={onReset}
          aria-label={labels.resetTimer}
          className="rounded-full"
        >
          <RotateCcw className="h-6 w-6" aria-hidden="true" />
        </Button>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={onShowHyperfocus}
        disabled={isRunning}
        className="relative z-10 w-full"
      >
        <Focus className="h-5 w-5" aria-hidden="true" />
        {labels.hyperfocusMode}
      </Button>
    </>
  );
}
