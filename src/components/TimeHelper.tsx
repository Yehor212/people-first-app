// Optional visual timer with configurable audio cues.

import { useState, useEffect, useRef } from "react";
import { Clock, Bell, BellOff, Play, Pause, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { safeParseInt } from "@/lib/validation";
import { playComplete, playNotification } from "@/lib/audioManager";
import { getLocale } from "@/lib/timeUtils";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";

interface TimeHelperProps {
  onClose: () => void;
}

export function TimeHelper({ onClose }: TimeHelperProps) {
  const { t, language } = useLanguage();
  useBackHandler(true, onClose);
  useScrollLock(true);
  const { modalRef, handleKeyDown: modalKeyDown } = useModalKeyboard({
    isOpen: true,
    onClose,
    closeOnEscape: true,
    trapFocus: true,
  });
  const [duration, setDuration] = useState(60); // minutes
  const [timeLeft, setTimeLeft] = useState(duration * 60); // seconds
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [pingInterval, setPingInterval] = useState(15); // minutes
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    setTimeLeft(duration * 60);
  }, [duration]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          const interval = intervalRef.current;
          if (interval) clearInterval(interval);
          if (soundEnabled) playComplete();
          return 0;
        }

        const newTimeLeft = prev - 1;
        const elapsed = duration * 60 - newTimeLeft;

        // Play ping at intervals
        if (soundEnabled && elapsed > 0 && elapsed % (pingInterval * 60) === 0) {
          const timeSinceLastPing = Date.now() - lastPingRef.current;
          if (timeSinceLastPing > 1000) {
            // Prevent double pings
            playNotification();
            lastPingRef.current = Date.now();
          }
        }

        return newTimeLeft;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, duration, soundEnabled, pingInterval]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimeRemaining = () => {
    const hours = Math.floor(timeLeft / 3600);
    const mins = Math.floor((timeLeft % 3600) / 60);

    if (hours > 0) {
      return (t.hoursMinutesLeft || "{hours}h {mins}m left")
        .replace("{hours}", String(hours))
        .replace("{mins}", String(mins));
    }
    return (t.minutesLeft || "{mins}m left").replace("{mins}", String(mins));
  };

  const getEndTime = () => {
    const end = new Date(Date.now() + timeLeft * 1000);
    return end.toLocaleTimeString(getLocale(language), {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;
  const progressColor =
    timeLeft < 300 ? "text-red-500" : timeLeft < 900 ? "text-yellow-500" : "text-primary";

  return (
    <>
      {/* Desktop backdrop */}
      <div
        className="hidden md:block fixed inset-0 z-[59] bg-black/50 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 ps-[max(1rem,var(--safe-inline-start))] pe-[max(1rem,var(--safe-inline-end))] pb-[max(1rem,var(--safe-bottom))] pt-[max(1rem,var(--safe-top))] backdrop-blur-sm md:mx-auto md:my-6 md:max-w-lg md:rounded-2xl md:shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-helper-title"
      >
        <div
          ref={modalRef}
          onKeyDown={modalKeyDown}
          tabIndex={-1}
          role="document"
          className="max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-2rem)] w-full max-w-lg overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl bg-card p-6 shadow-2xl"
        >
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 rounded-xl p-2 zen-gradient">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h2 id="time-helper-title" className="break-words hyphens-manual text-xl font-bold">
                  {t.timeBlindnessHelper}
                </h2>
                <p className="break-words hyphens-manual text-sm text-muted-foreground">
                  {t.visualTimeAwareness}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-2 hover:bg-muted motion-safe:transition-colors"
              aria-label={t.close || "Close"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Circular Timer */}
          <div className="mb-6">
            <div className="relative mx-auto aspect-square w-full max-w-64">
              <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 256 256">
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  fill="none"
                  stroke="hsl(var(--cosmic-clock-ring) / 0.2)"
                  strokeWidth="12"
                />
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  fill="none"
                  stroke="url(#timeGradient)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 120}`}
                  strokeDashoffset={`${2 * Math.PI * 120 * (1 - progress / 100)}`}
                  className="motion-safe:transition-all motion-safe:duration-1000"
                />
                <defs>
                  <linearGradient id="timeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--cosmic-nebula-purple))" />
                    <stop offset="100%" stopColor="hsl(var(--cosmic-nebula-pink))" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Time Display */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={cn("mb-2 break-words text-3xl font-bold min-[420px]:text-5xl", progressColor)}>
                    {formatTime(timeLeft)}
                  </div>
                  <div className="break-words hyphens-manual text-sm text-muted-foreground">
                    {timeLeft > 0 ? getTimeRemaining() : t.timesUp || "Time's up!"}
                  </div>
                </div>
              </div>
            </div>

            {/* End Time Prediction */}
            {isRunning && timeLeft > 0 && (
              <div className="text-center mt-4 p-3 bg-primary/10 rounded-xl">
                <p className="mb-1 break-words hyphens-manual text-sm text-muted-foreground">
                  {t.youllFinishAt || "🎯 You'll finish at:"}
                </p>
                <p className="text-xl font-bold text-primary">{getEndTime()}</p>
              </div>
            )}
          </div>

          {/* Controls */}
          {!isRunning ? (
            <>
              {/* Duration Selector */}
              <div className="mb-4">
                <label className="mb-2 block break-words hyphens-manual text-sm font-medium">
                  {t.durationMinutes || "Duration (minutes)"}
                </label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setDuration(mins)}
                      className={cn(
                        "min-h-[44px] h-auto whitespace-normal rounded-lg py-2 font-medium motion-safe:transition-all",
                        duration === mins
                          ? "zen-gradient text-white zen-shadow"
                          : "bg-muted hover:bg-muted/70"
                      )}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="5"
                  max="180"
                  step="5"
                  value={duration}
                  onChange={(e) => setDuration(safeParseInt(e.target.value, 60, 5, 180))}
                  className="w-full"
                  aria-label={t.ariaDurationMinutes}
                />
                <div className="text-center text-sm text-muted-foreground mt-1">
                  {(t.nMinutes || "{n} minutes").replace("{n}", String(duration))}
                </div>
              </div>

              {/* Ping Interval */}
              <div className="mb-4">
                <label className="mb-2 block break-words hyphens-manual text-sm font-medium">
                  {t.pingEveryMinutes || "Ping Every (minutes)"}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 30].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setPingInterval(mins)}
                      className={cn(
                        "min-h-[44px] h-auto whitespace-normal rounded-lg py-2 text-sm font-medium motion-safe:transition-all",
                        pingInterval === mins
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/70"
                      )}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Toggle */}
              <div className="mb-4 flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                <span className="break-words hyphens-manual text-sm font-medium">
                  {t.audioPings || "Audio Pings"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={playNotification}
                    className="min-h-[44px] h-auto min-w-0 flex-1 whitespace-normal break-words hyphens-manual rounded-lg bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/70 motion-safe:transition-colors"
                    title={t.testSound}
                  >
                    {t.testSound || "🔊 Test"}
                  </button>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={cn(
                      "flex min-h-[44px] h-auto min-w-0 flex-1 items-center justify-center gap-2 whitespace-normal break-words hyphens-manual rounded-lg px-3 py-2 motion-safe:transition-colors",
                      soundEnabled
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {soundEnabled ? <Bell className="w-4 h-4" aria-hidden="true" /> : <BellOff className="w-4 h-4" aria-hidden="true" />}
                    <span className="text-sm">
                      {soundEnabled ? t.soundOn || "On" : t.soundOff || "Off"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={() => setIsRunning(true)}
                className="flex min-h-[44px] h-auto w-full items-center justify-center gap-2 whitespace-normal break-words hyphens-manual rounded-xl py-3 font-bold text-white zen-gradient hover:opacity-90 motion-safe:transition-opacity"
              >
                <Play className="w-5 h-5" aria-hidden="true" />
                {t.startTimer || "Start Timer"}
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 min-[360px]:flex-row">
              <button
                onClick={() => setIsRunning(false)}
                className="flex min-h-[44px] h-auto min-w-0 flex-1 items-center justify-center gap-2 whitespace-normal break-words hyphens-manual rounded-xl bg-muted py-3 font-medium hover:bg-muted/70 motion-safe:transition-colors"
              >
                <Pause className="w-5 h-5" aria-hidden="true" />
                {t.pauseTimer || "Pause"}
              </button>
              <button
                onClick={() => {
                  setIsRunning(false);
                  setTimeLeft(duration * 60);
                }}
                className="min-h-[44px] h-auto min-w-0 flex-1 whitespace-normal break-words hyphens-manual rounded-xl bg-destructive/10 py-3 font-medium text-destructive hover:bg-destructive/20 motion-safe:transition-colors"
              >
                {t.resetTimer || "Reset"}
              </button>
            </div>
          )}

          {/* Info */}
          <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="shrink-0 text-2xl">💡</div>
              <div className="min-w-0 text-sm">
                <div className="mb-1 break-words hyphens-manual font-medium">
                  {t.adhdTimeManagement}
                </div>
                <ul className="list-inside list-disc space-y-1 break-words hyphens-manual text-muted-foreground">
                  <li>{t.adhdTip1}</li>
                  <li>{t.adhdTip2}</li>
                  <li>{t.adhdTip3}</li>
                  <li>{t.adhdTip4}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
