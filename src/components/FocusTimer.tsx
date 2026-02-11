import { useMemo, useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { logger } from '@/lib/logger';
import { FocusSession } from '@/types';
import { formatTime, getToday, generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { safeJsonParse } from '@/lib/safeJson';
import { safeParseInt } from '@/lib/validation';
import { Play, Pause, RotateCcw, Coffee, Zap, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { useScrollLock } from '@/hooks/useScrollLock';
import { HyperfocusMode } from './HyperfocusMode';
import { RewardedAdPrompt } from '@/components/ads/RewardedAdPrompt';
import { haptics } from '@/lib/haptics';
import { announceSuccess } from '@/lib/a11y';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { getCurrentChannelId } from '@/lib/notificationSounds';

// Star particle for cosmic background
function CosmicStar({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-white"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
      }}
      animate={{
        opacity: [0.2, 0.8, 0.2],
        scale: [1, 1.3, 1],
      }}
      transition={{
        duration: 2 + Math.random() * 2,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// Generate stars for background
const cosmicStars = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 1 + Math.random() * 2,
  delay: Math.random() * 3,
}));

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
  // Session recovery: detect if a focus session expired while app was closed
  const expiredSessionRef = useRef<FocusSession | null>(
    savedState?.endTime && savedState.isRunning && !savedState.isBreak &&
    Math.ceil((savedState.endTime - Date.now()) / 1000) <= 0
      ? {
          id: generateId(),
          duration: savedState.focusMinutes,
          completedAt: savedState.endTime,
          date: new Date(savedState.endTime).toISOString().split('T')[0],
          label: savedState.label?.trim() || undefined,
          status: 'completed' as const,
        }
      : null
  );

  // Bug fix: Initialize timeLeft based on saved or current focusMinutes, not hardcoded default
  const [timeLeft, setTimeLeft] = useState(() => {
    // If session expired while closed, reset to default
    if (expiredSessionRef.current) {
      localStorage.removeItem(TIMER_STORAGE_KEY);
      return (savedState?.focusMinutes || DEFAULT_FOCUS_MINUTES) * 60;
    }
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
  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Flag to prevent interval saves while debounced save is pending
  const savePendingRef = useRef(false);
  const endTimeRef = useRef<number | null>(savedState?.endTime || null);
  const focusStartRef = useRef<number | null>(savedState?.focusStartTime || null);
  const focusAccumulatedRef = useRef(savedState?.focusAccumulated || 0);
  const lastMinuteRef = useRef<number>(0);

  // Fix: Store latest state values in ref for synchronous unmount save
  // This solves the stale closure problem when component unmounts
  const stateRef = useRef({ isRunning, isBreak, focusMinutes, breakMinutes, label, preset });
  stateRef.current = { isRunning, isBreak, focusMinutes, breakMinutes, label, preset };

  // Manage mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Session recovery: if a focus session expired while app was closed, auto-complete it
  useEffect(() => {
    const expired = expiredSessionRef.current;
    if (expired) {
      expiredSessionRef.current = null; // Only fire once
      setPendingSession(expired);
      setShowReflection(true);
      setIsRunning(false);
      setIsBreak(false);
      logger.log('[FocusTimer] Recovered expired session:', expired.duration, 'min');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fix: Synchronous save on unmount to prevent state loss when switching tabs
  // The debounced save effect cancels pending saves on cleanup, so this ensures
  // the final state is always persisted before the component unmounts
  useEffect(() => {
    return () => {
      // Access latest state values via ref to avoid stale closure
      const { isRunning, isBreak, focusMinutes, breakMinutes, label, preset } = stateRef.current;
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
      } catch {
        // Ignore storage errors on unmount
      }
    };
  }, []);

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
  const prevBreakDurationRef = useRef(breakDuration);

  const presets = useMemo(() => ([
    { key: '25' as const, label: t.focusPreset25, focus: 25, break: 5 },
    { key: '50' as const, label: t.focusPreset50, focus: 50, break: 10 },
    { key: 'custom' as const, label: t.focusPresetCustom, focus: focusMinutes, break: breakMinutes },
  ]), [t, focusMinutes, breakMinutes]);

  // Sync timeLeft when focusDuration changes (not running, not break)
  useEffect(() => {
    if (!isRunning && !isBreak && focusDuration !== prevFocusDurationRef.current) {
      setTimeLeft(focusDuration);
    }
    prevFocusDurationRef.current = focusDuration;
  }, [focusDuration, isRunning, isBreak]);

  // Sync timeLeft when breakDuration changes (not running, during break)
  useEffect(() => {
    if (!isRunning && isBreak && breakDuration !== prevBreakDurationRef.current) {
      setTimeLeft(breakDuration);
    }
    prevBreakDurationRef.current = breakDuration;
  }, [breakDuration, isRunning, isBreak]);

  // Save state whenever it changes (debounced to prevent race conditions with interval saves)
  useEffect(() => {
    // Clear any pending save
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }
    // Mark save as pending to prevent interval save conflicts
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
      // Skip if component unmounted
      if (!isMountedRef.current || !endTimeRef.current) return;
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

          // Announce to screen readers
          announceSuccess(t.focusCompletedShort || 'Focus session complete');

          // Schedule local notification (for when app is backgrounded)
          if (Capacitor.isNativePlatform()) {
            LocalNotifications.schedule({
              notifications: [{
                title: 'ZenFlow',
                body: t.focusCompletedShort || 'Focus session complete',
                id: Date.now(),
                channelId: getCurrentChannelId(),
              }],
            }).catch(() => {});
          }

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
      // Skip if a debounced save is pending to prevent race conditions
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

  const throttledToggle = useThrottledCallback(toggleTimer, 800);
  const throttledReset = useThrottledCallback(resetTimer, 800);

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

  useBackHandler(showReflection, () => handleSaveReflection(null));
  useScrollLock(showReflection);
  useBackHandler(showHyperfocus, () => setShowHyperfocus(false));

  const progress = isBreak
    ? ((breakDuration - timeLeft) / breakDuration) * 100
    : ((focusDuration - timeLeft) / focusDuration) * 100;

  // Preset colors for premium styling (using CSS variables)
  const presetColors = {
    '25': { glow: 'hsl(var(--focus-emerald) / 0.5)', ring: 'ring-emerald-500/40', bg: 'from-emerald-500/20 to-emerald-600/10' },
    '50': { glow: 'hsl(var(--focus-violet) / 0.5)', ring: 'ring-violet-500/40', bg: 'from-violet-500/20 to-violet-600/10' },
    'custom': { glow: 'hsl(var(--focus-amber) / 0.5)', ring: 'ring-amber-500/40', bg: 'from-amber-500/20 to-amber-600/10' },
  };

  return (
    <div className={cn(
      "rounded-2xl p-6 animate-fade-in transition-all relative",
      isPrimaryCTA
        ? "ring-2 ring-violet-500/40 shadow-lg shadow-violet-500/20"
        : "bg-card zen-shadow-card"
    )}>
      {/* Cosmic Background - Theme-aware */}
      {isPrimaryCTA && (
        <>
          {/* Light mode background */}
          <div className="absolute inset-0 bg-gradient-to-b from-violet-100 via-indigo-50 to-slate-100 dark:bg-none" />
          {/* Dark mode cosmic gradient */}
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background: `radial-gradient(ellipse at center,
                hsl(var(--focus-cosmic-light)) 0%, hsl(var(--focus-cosmic-mid)) 40%, hsl(var(--focus-cosmic-dark)) 100%)`
            }}
          />
          {/* Star particles */}
          {cosmicStars.map((star) => (
            <CosmicStar key={star.id} {...star} />
          ))}
          {/* Nebula glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 5, repeat: Infinity }}
            style={{
              background: `
                radial-gradient(circle at 30% 30%, hsl(var(--focus-violet) / 0.15) 0%, transparent 40%),
                radial-gradient(circle at 70% 70%, hsl(var(--focus-pink) / 0.1) 0%, transparent 40%)
              `
            }}
          />
        </>
      )}

      {/* Primary CTA Header */}
      {isPrimaryCTA && (
        <motion.div
          className="relative flex items-center justify-center gap-2 mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-violet-500/25 backdrop-blur-sm rounded-full border border-violet-500/30">
            <Sparkles className="w-4 h-4 text-violet-700 dark:text-violet-300" />
            <span className="text-sm font-bold text-violet-700 dark:text-violet-200">{t.startHere}</span>
          </div>
        </motion.div>
      )}

      <div className="mb-4 space-y-3 relative">
        <label className={cn(
          "text-sm",
          isPrimaryCTA ? "text-slate-600 dark:text-white/60" : "text-muted-foreground"
        )}>{t.focusLabelPrompt}</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t.focusLabelPlaceholder}
          className={cn(
            "w-full p-3 rounded-xl focus:outline-none focus:ring-2 transition-colors",
            isPrimaryCTA
              ? "bg-secondary backdrop-blur-sm border border-border text-slate-800 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/40 focus:ring-violet-500/50"
              : "bg-secondary text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
          )}
        />
        <div className="flex flex-wrap gap-2">
          {presets.map((item) => {
            const colors = presetColors[item.key];
            const isSelected = preset === item.key;
            return (
              <motion.button
                key={item.key}
                onClick={() => handlePresetSelect(item.key)}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs font-semibold transition-all",
                  isPrimaryCTA
                    ? isSelected
                      ? `bg-gradient-to-br ${colors.bg} backdrop-blur-sm border border-border text-slate-800 dark:text-white`
                      : "bg-muted backdrop-blur-sm border border-border text-slate-600 dark:text-white/60 hover:bg-secondary hover:text-slate-800 dark:hover:text-white/80"
                    : isSelected
                      ? "bg-primary/10 ring-2 ring-primary text-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-muted"
                )}
                style={isPrimaryCTA && isSelected ? {
                  boxShadow: `0 0 16px ${colors.glow}`
                } : {}}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {item.label}
              </motion.button>
            );
          })}
        </div>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={cn(
                "text-xs",
                isPrimaryCTA ? "text-slate-600 dark:text-white/60" : "text-muted-foreground"
              )}>{t.focusCustomWork}</label>
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
                className={cn(
                  "w-full p-2 rounded-lg focus:outline-none focus:ring-2",
                  isPrimaryCTA
                    ? "bg-secondary backdrop-blur-sm border border-border text-slate-800 dark:text-white focus:ring-amber-500/50"
                    : "bg-secondary text-foreground focus:ring-primary/30"
                )}
              />
            </div>
            <div>
              <label className={cn(
                "text-xs",
                isPrimaryCTA ? "text-slate-600 dark:text-white/60" : "text-muted-foreground"
              )}>{t.focusCustomBreak}</label>
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
                className={cn(
                  "w-full p-2 rounded-lg focus:outline-none focus:ring-2",
                  isPrimaryCTA
                    ? "bg-secondary backdrop-blur-sm border border-border text-slate-800 dark:text-white focus:ring-amber-500/50"
                    : "bg-secondary text-foreground focus:ring-primary/30"
                )}
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mb-6 relative">
        <h3 className={cn(
          "text-lg font-semibold",
          isPrimaryCTA ? "text-slate-800 dark:text-white" : "text-foreground"
        )}>
          {isBreak ? t.breakTime : t.focus}
        </h3>
        <div className={cn(
          "flex items-center gap-2 text-sm",
          isPrimaryCTA
            ? "px-3 py-1.5 bg-secondary backdrop-blur-sm rounded-full text-slate-600 dark:text-white/70"
            : "text-muted-foreground"
        )}>
          <Coffee className="w-4 h-4" />
          <span>{totalMinutesToday} {t.todayMinutes}</span>
        </div>
      </div>

      <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto mb-6">
        {/* Premium multi-layer timer */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Layer 1: Orbit path (dashed) */}
          {isPrimaryCTA && (
            <circle
              cx="50"
              cy="50"
              r="47"
              fill="none"
              stroke="hsl(0 0% 100% / 0.1)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* Layer 2: Background track */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={isPrimaryCTA ? "hsl(0 0% 100% / 0.1)" : "hsl(var(--secondary))"}
            strokeWidth="6"
          />

          {/* Layer 3: Progress ring with glow */}
          <motion.circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={isPrimaryCTA
              ? isBreak ? "url(#breakGradient)" : "url(#focusGradient)"
              : isBreak ? "hsl(var(--accent))" : "hsl(var(--primary))"
            }
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 42}`}
            strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
            style={isPrimaryCTA ? {
              filter: `drop-shadow(0 0 8px ${isBreak ? 'hsl(var(--focus-pink) / 0.6)' : 'hsl(var(--focus-violet) / 0.6)'})`
            } : {}}
            initial={false}
            animate={{ strokeDashoffset: `${2 * Math.PI * 42 * (1 - progress / 100)}` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />

          {/* Gradient definitions */}
          <defs>
            <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--focus-violet))" />
              <stop offset="50%" stopColor="hsl(var(--focus-purple))" />
              <stop offset="100%" stopColor="hsl(var(--focus-pink))" />
            </linearGradient>
            <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--focus-pink))" />
              <stop offset="50%" stopColor="hsl(var(--focus-pink-mid))" />
              <stop offset="100%" stopColor="hsl(var(--focus-rose))" />
            </linearGradient>
          </defs>
        </svg>

        {/* Inner breathing glow */}
        {isPrimaryCTA && isRunning && (
          <motion.div
            className="absolute inset-6 rounded-full pointer-events-none"
            style={{
              background: isBreak
                ? 'radial-gradient(circle, hsl(var(--focus-pink) / 0.15) 0%, transparent 70%)'
                : 'radial-gradient(circle, hsl(var(--focus-violet) / 0.15) 0%, transparent 70%)'
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        <div
          role="timer"
          aria-label={isBreak ? (t.takeRest || 'Break time') : (t.concentrate || 'Focus time')}
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <motion.span
            aria-live="polite"
            aria-atomic="true"
            className={cn(
              "text-5xl font-bold tracking-tight",
              isPrimaryCTA
                ? "text-violet-700 dark:text-white"
                : isBreak ? "text-accent" : "text-primary"
            )}
            style={isPrimaryCTA ? {
              textShadow: isBreak
                ? '0 0 20px hsl(var(--focus-pink) / 0.5)'
                : '0 0 20px hsl(var(--focus-violet) / 0.5)'
            } : {}}
            key={timeLeft}
            initial={{ scale: 0.95, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {formatTime(timeLeft)}
          </motion.span>
          <span className={cn(
            "text-sm mt-2",
            isPrimaryCTA ? "text-slate-600 dark:text-white/60" : "text-muted-foreground"
          )} aria-hidden="true">
            {isBreak ? t.takeRest : t.concentrate}
          </span>
        </div>
      </div>

      <div className="flex justify-center gap-4 mb-4">
        {isPrimaryCTA ? (
          <>
            {/* Premium Play/Pause Button */}
            <motion.button
              onClick={throttledToggle}
              aria-label={isRunning ? (t.pause || 'Pause timer') : (t.start || 'Start timer')}
              className={cn(
                "relative w-16 h-16 rounded-full flex items-center justify-center",
                "transition-all",
                isBreak
                  ? "bg-gradient-to-br from-pink-500 to-rose-600"
                  : "bg-gradient-to-br from-violet-500 to-purple-600"
              )}
              style={{
                boxShadow: isBreak
                  ? '0 0 24px hsl(var(--focus-pink) / 0.5)'
                  : '0 0 24px hsl(var(--focus-violet) / 0.5)'
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Pulse ring when paused */}
              {!isRunning && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-white/30"
                  animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              {isRunning ? (
                <Pause className="w-7 h-7 text-white" aria-hidden="true" />
              ) : (
                <Play className="w-7 h-7 text-white ms-1" aria-hidden="true" />
              )}
            </motion.button>

            {/* Premium Reset Button */}
            <motion.button
              onClick={throttledReset}
              aria-label={t.resetTimer}
              className="w-14 h-14 rounded-full flex items-center justify-center bg-secondary backdrop-blur-sm border border-border text-slate-600 dark:text-white/70 hover:text-slate-800 dark:hover:text-white hover:bg-secondary/80 transition-colors"
              whileHover={{ scale: 1.1, rotate: -90 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw className="w-5 h-5" aria-hidden="true" />
            </motion.button>
          </>
        ) : (
          <>
            <Button
              variant="gradient"
              size="icon-lg"
              onClick={throttledToggle}
              aria-label={isRunning ? (t.pause || 'Pause timer') : (t.start || 'Start timer')}
              className={cn(
                isBreak && "zen-gradient-warm"
              )}
            >
              {isRunning ? <Pause className="w-6 h-6" aria-hidden="true" /> : <Play className="w-6 h-6" aria-hidden="true" />}
            </Button>
            <Button
              variant="secondary"
              size="icon-lg"
              onClick={throttledReset}
              aria-label={t.resetTimer}
            >
              <RotateCcw className="w-6 h-6" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>

      {/* Hyperfocus Mode Button */}
      {isPrimaryCTA ? (
        <motion.button
          onClick={() => setShowHyperfocus(true)}
          disabled={isRunning}
          className={cn(
            "w-full py-3.5 rounded-xl flex items-center justify-center gap-2",
            "font-semibold transition-all relative z-10",
            isRunning
              ? "bg-secondary text-slate-400 dark:text-white/40 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500/80 to-violet-500/80 text-white hover:from-cyan-500 hover:to-violet-500"
          )}
          style={!isRunning ? {
            boxShadow: '0 0 20px hsl(var(--focus-violet) / 0.3)'
          } : {}}
          whileHover={!isRunning ? { scale: 1.02 } : {}}
          whileTap={!isRunning ? { scale: 0.98 } : {}}
        >
          <Zap className="w-5 h-5" />
          {t.hyperfocusMode}
        </motion.button>
      ) : (
        <Button
          variant={isRunning ? "secondary" : "gradient"}
          size="lg"
          onClick={() => setShowHyperfocus(true)}
          disabled={isRunning}
          className={cn(
            "w-full relative z-10",
            !isRunning && "zen-gradient-calm"
          )}
        >
          <Zap className="w-5 h-5" />
          {t.hyperfocusMode}
        </Button>
      )}

      {showReflection && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 z-[60]"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={(e) => {
            // Close on backdrop click
            if (e.target === e.currentTarget) {
              handleSaveReflection(null);
            }
          }}
        >
          <motion.div
            className="w-full max-w-xs sm:max-w-sm relative overflow-hidden rounded-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            {/* Premium background - Theme-aware */}
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-50 via-purple-50 to-slate-100 dark:bg-none" />
            <div
              className="absolute inset-0 hidden dark:block"
              style={{
                background: `radial-gradient(ellipse at top,
                  hsl(var(--focus-cosmic-dark)) 0%, hsl(var(--focus-cosmic-mid)) 60%, hsl(var(--focus-cosmic-deep)) 100%)`
              }}
            />
            {/* Star particles */}
            {cosmicStars.slice(0, 8).map((star) => (
              <CosmicStar key={star.id} {...star} />
            ))}

            <div className="relative p-6">
              {/* Close button */}
              <button
                onClick={() => handleSaveReflection(null)}
                className="absolute top-3 end-3 p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-slate-600 dark:text-white/60 hover:text-slate-800 dark:hover:text-white transition-colors"
                aria-label={t.close}
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                <h4 className="text-lg font-semibold text-slate-800 dark:text-white pe-10">{t.focusReflectionTitle}</h4>
              </div>
              <p className="text-sm text-slate-600 dark:text-white/60 mt-1">{t.focusReflectionQuestion}</p>

              <div className="flex justify-between mt-5">
                {[1, 2, 3, 4, 5].map((value) => {
                  const isSelected = reflectionValue === value;
                  const colors = [
                    'from-red-500 to-red-600',
                    'from-orange-500 to-orange-600',
                    'from-amber-500 to-amber-600',
                    'from-emerald-500 to-emerald-600',
                    'from-violet-500 to-violet-600',
                  ];
                  return (
                    <motion.button
                      key={value}
                      onClick={() => setReflectionValue(value)}
                      className={cn(
                        "w-11 h-11 rounded-full text-sm font-bold transition-all",
                        isSelected
                          ? `bg-gradient-to-br ${colors[value - 1]} text-white`
                          : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                      )}
                      style={isSelected ? {
                        boxShadow: '0 0 16px hsl(var(--focus-violet) / 0.5)'
                      } : {}}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {value}
                    </motion.button>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-6">
                <motion.button
                  onClick={() => handleSaveReflection(null)}
                  className="flex-1 py-3 rounded-xl bg-secondary text-muted-foreground font-medium hover:bg-secondary/80 hover:text-foreground transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  {t.focusReflectionSkip}
                </motion.button>
                <motion.button
                  onClick={() => handleSaveReflection(reflectionValue)}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium"
                  style={{ boxShadow: '0 0 16px hsl(var(--focus-violet) / 0.4)' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {t.focusReflectionSave}
                </motion.button>
              </div>

              {/* Opt-in rewarded ad — earn bonus treats after focus */}
              <div className="mt-4">
                <RewardedAdPrompt context="post_focus" compact />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Hyperfocus Mode Modal — Portal to escape PullToRefresh transform stacking context */}
      {showHyperfocus && createPortal(
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
        />,
        document.body
      )}
    </div>
  );
});
