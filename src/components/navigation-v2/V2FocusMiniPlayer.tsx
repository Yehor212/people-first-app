import { memo, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, Square, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { zenMotion } from "@/lib/animationUtils";
import { getFocusControls, useUIStore } from "@/stores";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatFocusTime } from "@/components/FocusMiniPlayer";
import type { NavV2Page } from "@/hooks/useNavigationV2";

interface V2FocusMiniPlayerProps {
  activePage: NavV2Page;
  onNavigateToPlanning: () => void;
}

export const V2FocusMiniPlayer = memo(function V2FocusMiniPlayer({
  activePage,
  onNavigateToPlanning,
}: V2FocusMiniPlayerProps) {
  const { t } = useLanguage();
  const endTime = useUIStore((s) => s.focusEndTime);
  const isRunning = useUIStore((s) => s.focusIsRunning);
  const isBreak = useUIStore((s) => s.focusIsBreak);
  const label = useUIStore((s) => s.focusLabel);
  const [timeLeft, setTimeLeft] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!endTime || !isRunning) {
      setTimeLeft(0);
      return;
    }
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));
    tick();
    const timerId = window.setInterval(tick, 1000);
    return () => window.clearInterval(timerId);
  }, [endTime, isRunning]);

  useEffect(() => {
    const threshold = window.screen.height * 0.75;
    const onResize = () => setKeyboardOpen(window.innerHeight < threshold);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const visible = activePage !== "planning" && !keyboardOpen && (isRunning || endTime !== null);

  const handleToggle = () => {
    getFocusControls()?.toggle();
    void haptics.light();
  };

  const handleStop = () => {
    getFocusControls()?.reset();
    void haptics.light();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={zenMotion.gentle}
          className={cn(
            "fixed start-[max(1rem,var(--safe-inline-start))] end-[max(1rem,var(--safe-inline-end))] bottom-[calc(var(--safe-bottom)+1rem)] z-[57] mx-auto grid max-w-md grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2",
            "rounded-2xl border border-border/50 bg-card/88 px-3 py-2 text-foreground shadow-[0_18px_48px_hsl(var(--foreground)/0.18)]",
            "backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]",
            "min-[420px]:grid-cols-[minmax(0,1fr)_auto_auto_auto] min-[420px]:gap-3 md:start-auto md:end-[max(1.25rem,var(--safe-inline-end))] md:w-[24rem]",
          )}
          data-testid="v2-focus-mini-player"
        >
          <button
            type="button"
            onClick={onNavigateToPlanning}
            className="col-span-3 flex min-h-[44px] min-w-0 items-start gap-2 rounded-xl px-2 py-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-[420px]:col-span-1"
            aria-label={t.focus || "Focus"}
          >
            <Timer
              aria-hidden="true"
              className={cn("h-4 w-4 shrink-0", isBreak ? "text-indigo-400" : "text-violet-500")}
            />
            <span className="min-w-0 flex-1">
              <span className="block whitespace-normal break-words text-xs font-semibold">
                {isBreak ? t.breakTime : t.focus}
              </span>
              {label && (
                <span className="block whitespace-normal break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {label}
                </span>
              )}
            </span>
          </button>

          <span className="justify-self-start font-mono text-sm font-bold tabular-nums" aria-live="polite">
            {isRunning ? formatFocusTime(timeLeft) : "--:--"}
          </span>

          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isRunning
                ? "bg-secondary text-foreground hover:bg-secondary/80"
                : "bg-violet-500 text-white hover:bg-violet-600",
            )}
            aria-label={isRunning ? t.pause || "Pause" : t.play || "Play"}
          >
            {isRunning ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="ms-0.5 h-4 w-4" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={handleStop}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={t.stop || "Stop"}
          >
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
