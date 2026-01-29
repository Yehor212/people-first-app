import { useMemo, useState, useEffect, useRef, memo } from 'react';
import { logger } from '@/lib/logger';
import { FocusSession } from '@/types';
import { formatTime, getToday, generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { safeJsonParse } from '@/lib/safeJson';
import { safeParseInt } from '@/lib/validation';
import { Play, Pause, RotateCcw, Coffee, Zap, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { HyperfocusMode } from './HyperfocusMode';
import { haptics } from '@/lib/haptics';

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const TIMER_STORAGE_KEY = 'zenflow-timer-state';

interface TimerState {
  endTime: number | null;
  focusMinutes: number;
  breakMinutes: number;
  isRunning: boolean;
  isBreak: boolean;
  label: string;
  focusStartTime: number | null;
  focusAccumulated: number;
  preset: '25' | '50' | 'custom';
}

// Load timer state from localStorage - outside component to avoid recreation on every render
function loadTimerState(): TimerState | null {
  const stored = localStorage.getItem(TIMER_STORAGE_KEY);
  if (stored) {
    return safeJsonParse<TimerState | null>(stored, null);
  }
  return null;
}

interface FocusTimerProps {
  sessions: FocusSession[];
  onCompleteSession: (session: FocusSession) => void;
  onMinuteUpdate?: (minutes: number) => void;
  isPrimaryCTA?: boolean;
}

export const FocusTimer = memo(function FocusTimer({ sessions, onCompleteSession, onMinuteUpdate, isPrimaryCTA = false }: FocusTimerProps) {
  const { t } = useLanguage();

  // Hyperfocus Mode state
  const [showHyperfocus, setShowHyperfocus] = useState(false);

  // Load persisted state once on mount
  const savedStateRef = useRef<TimerState | null>(null);
  if (savedStateRef.current === null) {
    savedStateRef.current = loadTimerState();
  }
  const savedState = savedStateRef.current;

  const [preset, setPreset] = useState<'25' | '50' | 'custom'>(savedState?.preset || '25');
  const [focusMinutes, setFocusMinutes] = useState(savedState?.focusMinutes || DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(savedState?.breakMinutes || DEFAULT_BREAK_MINUTES);

  // Bug fix: Store custom values separately to restore when switching back to 'custom'
  const [savedCustomFocus, setSavedCustomFocus] = useState(savedState?.focusMinutes || 30);
  const [savedCustomBreak, setSavedCustomBreak] = useState(savedState?.breakMinutes || 5);

  // Bug fix: Use string state for inputs to allow free typing, validate on blur
  const [focusInputValue, setFocusInputValue] = useState(String(focusMinutes));
  const [breakInputValue, setBreakInputValue] = useState(String(breakMinutes));
  // Bug fix: Initialize timeLeft based on saved or current focusMinutes, not hardcoded default
  const [timeLeft, setTimeLeft] = useState(() => {
    if (savedState?.endTime && savedState.isRunning) {
      const remaining = Math.ceil((savedState.endTime - Date.now()) / 1000);
      if (remaining > 0) return remaining;
    }
    const minutes = savedState?.focusMinutes || DEFAULT_FOCUS_MINUTES;
    return minutes * 60;
  });
  const [isRunning, setIsRunning] = useState(savedState?.isRunning || false);
  const [isBreak, setIsBreak] = useState(savedState?.isBreak || false);
  const [label, setLabel] = useState(savedState?.label || '');
  const [focusElapsed, setFocusElapsed] = useState(0);
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionValue, setReflectionValue] = useState<number | null>(null);
  const [pendingSession, setPendingSession] = useState<FocusSession | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const intervalTickRef = useRef<number>(0);
  // P0 Fix: Flag to prevent interval saves while debounced save is pending
  const savePendingRef = useRef(false);
  const endTimeRef = useRef<number | null>(savedState?.endTime || null);
  const focusStartRef = useRef<number | null>(savedState?.focusStartTime || null);
  const focusAccumulatedRef = useRef(savedState?.focusAccumulated || 0);
  const lastMinuteRef = useRef<number>(0);
  
  // Persist timer state
  const saveTimerState = () => {
    const state: TimerState = {
      endTime: endTimeRef.current,
      focusMinutes,
      breakMinutes,
      isRunning,
      isBreak,
      label,
      focusStartTime: focusStartRef.current,
      focusAccumulated: focusAccumulatedRef.current,
      preset,
    };
    try {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      logger.error('Failed to save timer state:', e);
    }
  };

  const todaySessions = sessions.filter(s => s.date === getToday() && s.status !== 'aborted');
  const todayMinutes = todaySessions.reduce((acc, s) => acc + s.duration, 0);

  // Calculate current running minutes
  const getCurrentRunningMinutes = () => {
    if (!isRunning || isBreak) return 0;
    const runningElapsed = focusStartRef.current ? Date.now() - focusStartRef.current : 0;
    const totalElapsed = focusAccumulatedRef.current + runningElapsed;
    return Math.floor(totalElapsed / 60000);
  };

  const totalMinutesToday = todayMinutes + getCurrentRunningMinutes();

  const focusDuration = focusMinutes * 60;
  const breakDuration = breakMinutes * 60;
  const prevFocusDurationRef = useRef(focusDuration);

  const presets = useMemo(() => ([
    { key: '25' as const, label: t.focusPreset25, focus: 25, break: 5 },
    { key: '50' as const, label: t.focusPreset50, focus: 50, break: 10 },
    { key: 'custom' as const, label: t.focusPresetCustom, focus: focusMinutes, break: breakMinutes },
  ]), [t, focusMinutes, breakMinutes]);

  useEffect(() => {
    if (!isRunning && !isBreak && focusDuration !== prevFocusDurationRef.current) {
      setTimeLeft(focusDuration);
    }
    prevFocusDurationRef.current = focusDuration;
  }, [focusDuration, isRunning, isBreak]);

  // Save state whenever it changes (debounced to prevent race conditions with interval saves)
  useEffect(() => {
    // Clear any pending save
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }
    // P0 Fix: Mark save as pending to prevent interval save conflicts
    savePendingRef.current = true;
    // Debounce save by 300ms (increased from 100ms) to avoid conflicts with interval saves
    saveDebounceRef.current = setTimeout(() => {
      saveTimerState();
      savePendingRef.current = false;
    }, 300);

    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, [isRunning, isBreak, focusMinutes, breakMinutes, label, preset]);

  // Restore state on mount
  useEffect(() => {
    const saved = loadTimerState();
    if (saved && saved.endTime && saved.isRunning) {
      const now = Date.now();
      if (saved.endTime > now) {
        const remaining = Math.ceil((saved.endTime - now) / 1000);
        setTimeLeft(remaining);
      } else {
        // Timer expired while tab was inactive
        localStorage.removeItem(TIMER_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      saveTimerState();
      return;
    }

    intervalRef.current = setInterval(() => {
      if (!endTimeRef.current) return;
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      setTimeLeft(remaining);

      if (!isBreak) {
        const runningElapsed = focusStartRef.current ? now - focusStartRef.current : 0;
        const totalElapsed = focusAccumulatedRef.current + runningElapsed;
        const currentMinutes = Math.floor(totalElapsed / 60000);
        setFocusElapsed(Math.floor(totalElapsed / 1000));

        // Notify parent every minute (only current running minutes, not total)
        if (currentMinutes !== lastMinuteRef.current) {
          lastMinuteRef.current = currentMinutes;
          if (onMinuteUpdate) {
            onMinuteUpdate(currentMinutes);
          }
        }
      }

      if (remaining === 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        endTimeRef.current = null;
        if (!isBreak) {
          // Focus session completed
          const session: FocusSession = {
            id: generateId(),
            duration: focusMinutes,
            completedAt: Date.now(),
            date: getToday(),
            label: label.trim() || undefined,
            status: 'completed',
          };
          setPendingSession(session);
          setShowReflection(true);

          // Switch to break mode
          focusStartRef.current = null;
          focusAccumulatedRef.current = 0;
          setFocusElapsed(0);
          setIsRunning(false);
          setIsBreak(true);
          setTimeLeft(breakDuration);
          lastMinuteRef.current = 0;

          // Reset current minutes counter
          if (onMinuteUpdate) {
            onMinuteUpdate(0);
          }
        } else {
          // Break completed, switch back to focus mode
          setIsRunning(false);
          setIsBreak(false);
          setTimeLeft(focusDuration);
        }
        localStorage.removeItem(TIMER_STORAGE_KEY);
      }

      // Save state every 10 ticks (5 seconds) to reduce localStorage writes
      // P0 Fix: Skip if a debounced save is pending to prevent race conditions
      intervalTickRef.current++;
      if (intervalTickRef.current >= 10) {
        intervalTickRef.current = 0;
        if (!savePendingRef.current) {
          saveTimerState();
        }
      }
    }, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isBreak, focusMinutes, focusDuration, breakDuration, label, todayMinutes, onMinuteUpdate]);

  const toggleTimer = () => {
    if (isRunning) {
      if (endTimeRef.current) {
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);
      }
      endTimeRef.current = null;
      if (!isBreak && focusStartRef.current) {
        focusAccumulatedRef.current += Date.now() - focusStartRef.current;
        focusStartRef.current = null;
        setFocusElapsed(Math.floor(focusAccumulatedRef.current / 1000));
      }
      setIsRunning(false);
      haptics.focusPaused();
      return;
    }

    if (timeLeft <= 0) {
      setTimeLeft(isBreak ? breakDuration : focusDuration);
    }
    endTimeRef.current = Date.now() + (timeLeft > 0 ? timeLeft : (isBreak ? breakDuration : focusDuration)) * 1000;
    if (!isBreak) {
      focusStartRef.current = Date.now();
      haptics.focusStarted();
    }
    setIsRunning(true);
  };

  const resetTimer = () => {
    if (isRunning && !isBreak) {
      const runningElapsed = focusStartRef.current ? Date.now() - focusStartRef.current : 0;
      const totalElapsed = focusAccumulatedRef.current + runningElapsed;
      const minutes = Math.max(1, Math.round(totalElapsed / 60000));
      const session: FocusSession = {
        id: generateId(),
        duration: minutes,
        completedAt: Date.now(),
        date: getToday(),
        label: label.trim() || undefined,
        status: 'aborted',
      };
      onCompleteSession(session);
    }
    endTimeRef.current = null;
    focusStartRef.current = null;
    focusAccumulatedRef.current = 0;
    lastMinuteRef.current = 0;
    setIsRunning(false);
    setIsBreak(false);
    setTimeLeft(focusDuration);
    setFocusElapsed(0);
    localStorage.removeItem(TIMER_STORAGE_KEY);
    saveTimerState();
  };

  const handlePresetSelect = (key: '25' | '50' | 'custom') => {
    // Save current custom values before switching away from custom
    if (preset === 'custom' && key !== 'custom') {
      setSavedCustomFocus(focusMinutes);
      setSavedCustomBreak(breakMinutes);
    }

    setPreset(key);
    if (key === '25') {
      setFocusMinutes(25);
      setBreakMinutes(5);
      setFocusInputValue('25');
      setBreakInputValue('5');
    } else if (key === '50') {
      setFocusMinutes(50);
      setBreakMinutes(10);
      setFocusInputValue('50');
      setBreakInputValue('10');
    } else if (key === 'custom') {
      // Restore saved custom values
      setFocusMinutes(savedCustomFocus);
      setBreakMinutes(savedCustomBreak);
      setFocusInputValue(String(savedCustomFocus));
      setBreakInputValue(String(savedCustomBreak));
    }
  };

  const handleSaveReflection = (value: number | null) => {
    if (pendingSession) {
      onCompleteSession({ ...pendingSession, reflection: value ?? undefined });
    }
    setPendingSession(null);
    setShowReflection(false);
    setReflectionValue(null);
  };

  const progress = isBreak 
    ? ((breakDuration - timeLeft) / breakDuration) * 100
    : ((focusDuration - timeLeft) / focusDuration) * 100;

  return (
    <div className={cn(
      "rounded-2xl p-6 animate-fade-in transition-all relative overflow-hidden",
      isPrimaryCTA
        ? "bg-gradient-to-br from-violet-500/15 via-card to-purple-500/15 ring-2 ring-violet-500/40 shadow-lg shadow-violet-500/20"
        : "bg-card zen-shadow-card"
    )}>
      {/* Animated background glow for CTA */}
      {isPrimaryCTA && (
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-purple-500/5 animate-pulse pointer-events-none" />
      )}

      {/* Primary CTA Header */}
      {isPrimaryCTA && (
        <div className="relative flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-violet-500/25 rounded-full border border-violet-500/30">
            <Zap className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{t.startHere}</span>
          </div>
        </div>
      )}

      <div className="mb-4 space-y-3 relative">
        <label className="text-sm text-muted-foreground">{t.focusLabelPrompt}</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t.focusLabelPlaceholder}
          className="w-full p-3 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex flex-wrap gap-2">
          {presets.map((item) => (
            <button
              key={item.key}
              onClick={() => handlePresetSelect(item.key)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                preset === item.key
                  ? "bg-primary/10 ring-2 ring-primary text-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-muted"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">{t.focusCustomWork}</label>
              <input
                type="number"
                min={5}
                max={120}
                value={focusInputValue}
                onChange={(e) => setFocusInputValue(e.target.value)}
                onBlur={(e) => {
                  const validated = safeParseInt(e.target.value, 25, 5, 120);
                  setFocusMinutes(validated);
                  setSavedCustomFocus(validated);
                  setFocusInputValue(String(validated));
                }}
                className="w-full p-2 bg-secondary rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t.focusCustomBreak}</label>
              <input
                type="number"
                min={1}
                max={60}
                value={breakInputValue}
                onChange={(e) => setBreakInputValue(e.target.value)}
                onBlur={(e) => {
                  const validated = safeParseInt(e.target.value, 5, 1, 60);
                  setBreakMinutes(validated);
                  setSavedCustomBreak(validated);
                  setBreakInputValue(String(validated));
                }}
                className="w-full p-2 bg-secondary rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          {isBreak ? t.breakTime : t.focus}
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coffee className="w-4 h-4" />
          <span>{totalMinutesToday} {t.todayMinutes}</span>
        </div>
      </div>

      <div className="relative w-48 h-48 mx-auto mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={isBreak ? "hsl(var(--accent))" : "hsl(var(--primary))"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            className="transition-all duration-1000"
          />
        </svg>
        
        <div
          role="timer"
          aria-label={isBreak ? (t.takeRest || 'Break time') : (t.concentrate || 'Focus time')}
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <span
            aria-live="polite"
            aria-atomic="true"
            className={cn(
              "text-4xl font-bold",
              isBreak ? "text-accent" : "text-primary"
            )}
          >
            {formatTime(timeLeft)}
          </span>
          <span className="text-sm text-muted-foreground mt-1" aria-hidden="true">
            {isBreak ? t.takeRest : t.concentrate}
          </span>
        </div>
      </div>

      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={toggleTimer}
          aria-label={isRunning ? (t.pause || 'Pause timer') : (t.start || 'Start timer')}
          className={cn(
            "p-4 min-w-[56px] min-h-[56px] rounded-full transition-all zen-shadow-soft active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            isBreak ? "zen-gradient-warm" : "zen-gradient",
            "text-primary-foreground hover:opacity-90"
          )}
        >
          {isRunning ? <Pause className="w-6 h-6" aria-hidden="true" /> : <Play className="w-6 h-6" aria-hidden="true" />}
        </button>
        <button
          onClick={resetTimer}
          aria-label={t.resetTimer}
          className="p-4 min-w-[56px] min-h-[56px] rounded-full bg-secondary text-secondary-foreground hover:bg-muted transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <RotateCcw className="w-6 h-6" aria-hidden="true" />
        </button>
      </div>

      {/* Hyperfocus Mode Button */}
      <button
        onClick={() => setShowHyperfocus(true)}
        disabled={isRunning}
        className={cn(
          "w-full py-3 min-h-[48px] rounded-xl font-medium transition-all flex items-center justify-center gap-2 active:scale-[0.98]",
          isRunning
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "zen-gradient-calm text-primary-foreground hover:opacity-90 zen-shadow"
        )}
      >
        <Zap className="w-5 h-5" />
        {t.hyperfocusMode}
      </button>

      {showReflection && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-[60]"
          onClick={(e) => {
            // Close on backdrop click
            if (e.target === e.currentTarget) {
              handleSaveReflection(null);
            }
          }}
        >
          <div className="w-full max-w-sm bg-card rounded-2xl p-6 zen-shadow-card relative">
            {/* Close button */}
            <button
              onClick={() => handleSaveReflection(null)}
              className="absolute top-3 right-3 p-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t.close}
            >
              <X className="w-4 h-4" />
            </button>
            <h4 className="text-lg font-semibold text-foreground pr-10">{t.focusReflectionTitle}</h4>
            <p className="text-sm text-muted-foreground mt-1">{t.focusReflectionQuestion}</p>
            <div className="flex justify-between mt-4">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => setReflectionValue(value)}
                  className={cn(
                    "w-10 h-10 rounded-full text-sm font-semibold",
                    reflectionValue === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-muted"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => handleSaveReflection(null)}
                className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-muted transition-colors"
              >
                {t.focusReflectionSkip}
              </button>
              <button
                onClick={() => handleSaveReflection(reflectionValue)}
                className="flex-1 py-2 zen-gradient text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                {t.focusReflectionSave}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hyperfocus Mode Modal */}
      {showHyperfocus && (
        <HyperfocusMode
          duration={focusMinutes}
          onComplete={() => {
            setShowHyperfocus(false);
            // Save completed session
            const session: FocusSession = {
              id: generateId(),
              duration: focusMinutes,
              completedAt: Date.now(),
              date: getToday(),
              label: label.trim() || undefined,
              status: 'completed',
            };
            onCompleteSession(session);
          }}
          onExit={() => setShowHyperfocus(false)}
        />
      )}
    </div>
  );
});
