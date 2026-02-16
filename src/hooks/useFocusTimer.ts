import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { FocusSession } from '@/types';
import { getToday, generateId } from '@/lib/utils';
import { safeJsonParse, safeLocalStorageSet, storageGetRaw, storageRemove } from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';
import { safeParseInt } from '@/lib/validation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { useScrollLock } from '@/hooks/useScrollLock';
import { haptics } from '@/lib/haptics';
import { announceSuccess } from '@/lib/a11y';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { getCurrentChannelId } from '@/lib/notificationSounds';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
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

// Load timer state from localStorage - outside hook to avoid recreation on every render
function loadTimerState(): TimerState | null {
  const stored = storageGetRaw(SK.TIMER_STATE);
  if (stored) {
    return safeJsonParse<TimerState | null>(stored, null);
  }
  return null;
}

export const presetColors = {
  '25': { glow: 'hsl(var(--focus-emerald) / 0.5)', ring: 'ring-emerald-500/40', bg: 'from-emerald-500/20 to-emerald-600/10' },
  '50': { glow: 'hsl(var(--focus-violet) / 0.5)', ring: 'ring-violet-500/40', bg: 'from-violet-500/20 to-violet-600/10' },
  'custom': { glow: 'hsl(var(--focus-amber) / 0.5)', ring: 'ring-amber-500/40', bg: 'from-amber-500/20 to-amber-600/10' },
} as const;

// ============================================
// HOOK
// ============================================

interface UseFocusTimerOptions {
  sessions: FocusSession[];
  onCompleteSession: (session: FocusSession) => void;
  onMinuteUpdate?: (minutes: number) => void;
}

export function useFocusTimer({ sessions, onCompleteSession, onMinuteUpdate }: UseFocusTimerOptions) {
  const { t } = useLanguage();

  // Hyperfocus Mode state
  const [showHyperfocus, setShowHyperfocus] = useState(false);

  // Load persisted state once on mount
  const savedStateRef = useRef<TimerState | null>(null);
  if (savedStateRef.current === null) {
    savedStateRef.current = loadTimerState();
  }
  const savedState = savedStateRef.current;

  // Config state
  const [preset, setPreset] = useState<'25' | '50' | 'custom'>(savedState?.preset || '25');
  const [focusMinutes, setFocusMinutes] = useState(savedState?.focusMinutes || DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(savedState?.breakMinutes || DEFAULT_BREAK_MINUTES);
  const [savedCustomFocus, setSavedCustomFocus] = useState(savedState?.focusMinutes || 30);
  const [savedCustomBreak, setSavedCustomBreak] = useState(savedState?.breakMinutes || 5);
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

  // Timer state
  const [timeLeft, setTimeLeft] = useState(() => {
    if (expiredSessionRef.current) {
      storageRemove(SK.TIMER_STATE);
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

  // Reflection state
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionValue, setReflectionValue] = useState<number | null>(null);
  const [pendingSession, setPendingSession] = useState<FocusSession | null>(null);

  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const intervalTickRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const savePendingRef = useRef(false);
  const endTimeRef = useRef<number | null>(savedState?.endTime || null);
  const focusStartRef = useRef<number | null>(savedState?.focusStartTime || null);
  const focusAccumulatedRef = useRef(savedState?.focusAccumulated || 0);
  const lastMinuteRef = useRef<number>(0);

  // Store latest state in ref for synchronous unmount save (avoids stale closure)
  const stateRef = useRef({ isRunning, isBreak, focusMinutes, breakMinutes, label, preset });
  stateRef.current = { isRunning, isBreak, focusMinutes, breakMinutes, label, preset };

  // Derived values
  const focusDuration = focusMinutes * 60;
  const breakDuration = breakMinutes * 60;
  const prevFocusDurationRef = useRef(focusDuration);
  const prevBreakDurationRef = useRef(breakDuration);

  const todaySessions = sessions.filter(s => s.date === getToday() && s.status !== 'aborted');
  const todayMinutes = todaySessions.reduce((acc, s) => acc + s.duration, 0);

  const getCurrentRunningMinutes = () => {
    if (!isRunning || isBreak) return 0;
    const runningElapsed = focusStartRef.current ? Date.now() - focusStartRef.current : 0;
    const totalElapsed = focusAccumulatedRef.current + runningElapsed;
    return Math.floor(totalElapsed / 60000);
  };

  const totalMinutesToday = todayMinutes + getCurrentRunningMinutes();

  const progress = isBreak
    ? ((breakDuration - timeLeft) / breakDuration) * 100
    : ((focusDuration - timeLeft) / focusDuration) * 100;

  const presets = useMemo(() => ([
    { key: '25' as const, label: t.focusPreset25, focus: 25, break: 5 },
    { key: '50' as const, label: t.focusPreset50, focus: 50, break: 10 },
    { key: 'custom' as const, label: t.focusPresetCustom, focus: focusMinutes, break: breakMinutes },
  ]), [t, focusMinutes, breakMinutes]);

  // ============================================
  // EFFECTS
  // ============================================

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
      expiredSessionRef.current = null;
      setPendingSession(expired);
      setShowReflection(true);
      setIsRunning(false);
      setIsBreak(false);
      logger.log('[FocusTimer] Recovered expired session:', expired.duration, 'min');
    }
  }, []);

  // Synchronous save on unmount to prevent state loss when switching tabs
  useEffect(() => {
    return () => {
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
      safeLocalStorageSet(SK.TIMER_STATE, state);
    };
  }, []);

  // Persist timer state
  const saveTimerState = useCallback(() => {
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
    if (!safeLocalStorageSet(SK.TIMER_STATE, state)) {
      logger.error('Failed to save timer state');
    }
  }, [focusMinutes, breakMinutes, isRunning, isBreak, label, preset]);

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
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }
    savePendingRef.current = true;
    saveDebounceRef.current = setTimeout(() => {
      saveTimerState();
      savePendingRef.current = false;
    }, 300);

    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, [saveTimerState]);

  // Restore state on mount
  useEffect(() => {
    const saved = loadTimerState();
    if (saved && saved.endTime && saved.isRunning) {
      const now = Date.now();
      if (saved.endTime > now) {
        const remaining = Math.ceil((saved.endTime - now) / 1000);
        setTimeLeft(remaining);
      } else {
        storageRemove(SK.TIMER_STATE);
      }
    }
  }, []);

  // Main timer interval loop
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      saveTimerState();
      return;
    }

    intervalRef.current = setInterval(() => {
      if (!isMountedRef.current || !endTimeRef.current) return;
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      setTimeLeft(remaining);

      if (!isBreak) {
        const runningElapsed = focusStartRef.current ? now - focusStartRef.current : 0;
        const totalElapsed = focusAccumulatedRef.current + runningElapsed;
        const currentMinutes = Math.floor(totalElapsed / 60000);

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

          announceSuccess(t.focusCompletedShort || 'Focus session complete');

          if (Capacitor.isNativePlatform()) {
            LocalNotifications.schedule({
              notifications: [{
                title: 'ZenFlow',
                body: t.focusCompletedShort || 'Focus session complete',
                id: Date.now(),
                channelId: getCurrentChannelId(),
              }],
            }).catch(err => logger.warn('[Focus]', 'Notification failed:', err));
          }

          // Switch to break mode
          focusStartRef.current = null;
          focusAccumulatedRef.current = 0;
          setIsRunning(false);
          setIsBreak(true);
          setTimeLeft(breakDuration);
          lastMinuteRef.current = 0;

          if (onMinuteUpdate) {
            onMinuteUpdate(0);
          }
        } else {
          // Break completed, switch back to focus mode
          setIsRunning(false);
          setIsBreak(false);
          setTimeLeft(focusDuration);
        }
        storageRemove(SK.TIMER_STATE);
      }

      // Save state every 10 ticks (5 seconds) to reduce localStorage writes
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
  }, [isRunning, isBreak, focusMinutes, focusDuration, breakDuration, label, todayMinutes, onMinuteUpdate, saveTimerState]);

  // ============================================
  // HANDLERS
  // ============================================

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
      }
      setIsRunning(false);
      void haptics.focusPaused();
      return;
    }

    if (timeLeft <= 0) {
      setTimeLeft(isBreak ? breakDuration : focusDuration);
    }
    endTimeRef.current = Date.now() + (timeLeft > 0 ? timeLeft : (isBreak ? breakDuration : focusDuration)) * 1000;
    if (!isBreak) {
      focusStartRef.current = Date.now();
      void haptics.focusStarted();
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
    storageRemove(SK.TIMER_STATE);
    saveTimerState();
  };

  const throttledToggle = useThrottledCallback(toggleTimer, 800);
  const throttledReset = useThrottledCallback(resetTimer, 800);

  const handlePresetSelect = (key: '25' | '50' | 'custom') => {
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

  const handleHyperfocusComplete = () => {
    setShowHyperfocus(false);
    const session: FocusSession = {
      id: generateId(),
      duration: focusMinutes,
      completedAt: Date.now(),
      date: getToday(),
      label: label.trim() || undefined,
      status: 'completed',
    };
    onCompleteSession(session);
  };

  const handleFocusInputBlur = (value: string) => {
    const validated = safeParseInt(value, 25, 5, 120);
    setFocusMinutes(validated);
    setSavedCustomFocus(validated);
    setFocusInputValue(String(validated));
  };

  const handleBreakInputBlur = (value: string) => {
    const validated = safeParseInt(value, 5, 1, 60);
    setBreakMinutes(validated);
    setSavedCustomBreak(validated);
    setBreakInputValue(String(validated));
  };

  useBackHandler(showReflection, () => handleSaveReflection(null));
  useScrollLock(showReflection);
  useBackHandler(showHyperfocus, () => setShowHyperfocus(false));

  return {
    // Config
    preset, focusMinutes, breakMinutes,
    focusInputValue, breakInputValue, label,
    setLabel, setFocusInputValue, setBreakInputValue,
    // Timer
    timeLeft, isRunning, isBreak,
    // Reflection
    showReflection, reflectionValue, setReflectionValue,
    // UI
    showHyperfocus, setShowHyperfocus,
    // Derived
    totalMinutesToday, progress, focusDuration, breakDuration, presets,
    // Actions
    throttledToggle, throttledReset, handlePresetSelect,
    handleSaveReflection, handleHyperfocusComplete,
    handleFocusInputBlur, handleBreakInputBlur,
  };
}
