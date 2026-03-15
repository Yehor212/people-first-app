/**
 * FocusMiniPlayer — Persistent global timer bar above bottom navigation.
 *
 * Reads timer state from uiStore bridge (set by useFocusTimer on state transitions).
 * Computes countdown locally via 1-second setInterval from focusEndTime.
 * Controls (play/pause/stop) call non-reactive module-level refs registered by useFocusTimer.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore, getFocusControls } from '@/stores';
import { useLanguage } from '@/contexts/LanguageContext';
import { zenMotion } from '@/lib/animationUtils';
import { haptics } from '@/lib/haptics';

export function formatFocusTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface FocusMiniPlayerProps {
  onNavigateToTimer: () => void;
}

export function FocusMiniPlayer({ onNavigateToTimer }: FocusMiniPlayerProps) {
  const { t } = useLanguage();
  const endTime = useUIStore(s => s.focusEndTime);
  const isRunning = useUIStore(s => s.focusIsRunning);
  const isBreak = useUIStore(s => s.focusIsBreak);
  const label = useUIStore(s => s.focusLabel);

  const [timeLeft, setTimeLeft] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Compute countdown from absolute endTime (drift-proof)
  useEffect(() => {
    if (!endTime || !isRunning) {
      setTimeLeft(0);
      return;
    }
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime, isRunning]);

  // Hide when software keyboard is open (same pattern as Navigation.tsx)
  useEffect(() => {
    const threshold = window.screen.height * 0.75;
    const onResize = () => setKeyboardOpen(window.innerHeight < threshold);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const visible = !keyboardOpen && (isRunning || endTime !== null);

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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={zenMotion.gentle}
          className={cn(
            'fixed left-4 right-4 z-50 max-w-lg mx-auto',
            'rounded-2xl bg-surface-glass backdrop-blur-[var(--surface-glass-blur)]',
            'border border-[var(--surface-glass-border)] zen-shadow-card',
            'flex items-center gap-3 px-4 py-2.5',
            'bottom-[calc(var(--nav-height)+var(--safe-bottom)+0.5rem)]',
          )}
        >
          {/* Label area — tap to navigate to full timer */}
          <button
            onClick={onNavigateToTimer}
            className="flex items-center gap-2 flex-1 min-w-0 text-start"
            aria-label={t.focus}
          >
            <Timer className={cn('w-4 h-4 shrink-0', isBreak ? 'text-indigo-400' : 'text-violet-500')} />
            <div className="flex flex-col min-w-0">
              <span className={cn('text-xs font-semibold', isBreak ? 'text-indigo-500 dark:text-indigo-400' : 'text-violet-600 dark:text-violet-400')}>
                {isBreak ? t.breakTime : t.focus}
              </span>
              {label && (
                <span className="text-[10px] text-muted-foreground truncate">
                  {label}
                </span>
              )}
            </div>
          </button>

          {/* Countdown */}
          <span className={cn(
            'font-mono text-sm font-bold tabular-nums',
            isRunning ? 'text-foreground' : 'text-muted-foreground',
          )}>
            {isRunning ? formatFocusTime(timeLeft) : '--:--'}
          </span>

          {/* Play / Pause */}
          <button
            onClick={handleToggle}
            className={cn(
              'w-9 h-9 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              isRunning
                ? 'bg-secondary text-foreground hover:bg-secondary/80'
                : 'bg-violet-500 text-white hover:bg-violet-600',
            )}
            aria-label={isRunning ? (t.pause || 'Pause') : (t.play || 'Play')}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ms-0.5" />}
          </button>

          {/* Stop */}
          <button
            onClick={handleStop}
            className="w-9 h-9 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center bg-secondary text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={t.stop || 'Stop'}
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
