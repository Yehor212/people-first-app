import { useState, useEffect, useRef, useCallback } from "react";
import { logger } from "@/lib/logger";
import { FocusSession } from "@/types";
import { getToday } from "@/lib/utils";
import { safeLocalStorageSet, storageRemove } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useThrottledCallback } from "@/hooks/useThrottledCallback";
import { useScrollLock } from "@/hooks/useScrollLock";
import { haptics } from "@/lib/haptics";
import { announceSuccess } from "@/lib/a11y";
import { scheduleFocusCompletionNotification } from "@/lib/focusCompletionNotification";

import { useUIStore, setFocusControls } from "@/stores";
import { DEFAULT_FOCUS_MINUTES, loadTimerState, createFocusSession } from "@/types/focusTimerTypes";
import type { TimerState, UseFocusTimerOptions } from "@/types/focusTimerTypes";
import { useFocusTimerConfig } from "./useFocusTimerConfig";

// Re-export for backward compatibility
export { presetColors } from "@/types/focusTimerTypes";

export function useFocusTimer({
  sessions,
  onCompleteSession,
  onMinuteUpdate,
}: UseFocusTimerOptions) {
  // Hyperfocus Mode state
  const [showHyperfocus, setShowHyperfocus] = useState(false);

  // Load persisted state once on mount
  const savedStateRef = useRef<TimerState | null>(null);
  if (savedStateRef.current === null) {
    savedStateRef.current = loadTimerState();
  }
  const savedState = savedStateRef.current;

  // Config sub-hook (preset, minutes, durations, presets, input handlers)
  const {
    t,
    preset,
    focusMinutes,
    breakMinutes,
    focusInputValue,
    setFocusInputValue,
    breakInputValue,
    setBreakInputValue,
    focusDuration,
    breakDuration,
    presets,
    handlePresetSelect,
    handleFocusInputBlur,
    handleBreakInputBlur,
  } = useFocusTimerConfig(savedState);

  // Session recovery: detect if a focus session expired while app was closed
  const expiredSessionRef = useRef<FocusSession | null>(
    savedState?.endTime &&
      savedState.isRunning &&
      !savedState.isBreak &&
      Math.ceil((savedState.endTime - Date.now()) / 1000) <= 0
      ? createFocusSession(savedState.focusMinutes, savedState.label || "", "completed")
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
  const [label, setLabel] = useState(savedState?.label || "");

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
  const prevFocusDurationRef = useRef(focusDuration);
  const prevBreakDurationRef = useRef(breakDuration);

  const todaySessions = sessions.filter((s) => s.date === getToday() && s.status !== "aborted");
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
      logger.log("[FocusTimer] Recovered expired session:", expired.duration, "min");
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
      logger.error("Failed to save timer state");
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
          const session = createFocusSession(focusMinutes, label, "completed");
          setPendingSession(session);
          setShowReflection(true);

          announceSuccess(t.focusCompletedShort || "Focus session complete");

          void scheduleFocusCompletionNotification(
            t.focusCompletedShort || "Focus session complete",
          ).catch((err) => logger.warn("[Focus]", "Notification failed:", err));

          // Switch to break mode
          focusStartRef.current = null;
          focusAccumulatedRef.current = 0;
          setIsRunning(false);
          setIsBreak(true);
          setTimeLeft(breakDuration);
          lastMinuteRef.current = 0;
          useUIStore
            .getState()
            .setFocusTimerBridge({ endTime: null, isRunning: false, isBreak: true, label });

          if (onMinuteUpdate) {
            onMinuteUpdate(0);
          }
        } else {
          // Break completed, switch back to focus mode
          setIsRunning(false);
          setIsBreak(false);
          setTimeLeft(focusDuration);
          useUIStore.getState().clearFocusTimerBridge();
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
  }, [
    isRunning,
    isBreak,
    focusMinutes,
    focusDuration,
    breakDuration,
    label,
    todayMinutes,
    onMinuteUpdate,
    saveTimerState,
    t,
  ]);

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
      useUIStore
        .getState()
        .setFocusTimerBridge({ endTime: null, isRunning: false, isBreak, label });
      void haptics.focusPaused();
      return;
    }

    if (timeLeft <= 0) {
      setTimeLeft(isBreak ? breakDuration : focusDuration);
    }
    endTimeRef.current =
      Date.now() + (timeLeft > 0 ? timeLeft : isBreak ? breakDuration : focusDuration) * 1000;
    if (!isBreak) {
      focusStartRef.current = Date.now();
      void haptics.focusStarted();
    }
    setIsRunning(true);
    useUIStore
      .getState()
      .setFocusTimerBridge({ endTime: endTimeRef.current, isRunning: true, isBreak, label });
  };

  const resetTimer = () => {
    if (isRunning && !isBreak) {
      const runningElapsed = focusStartRef.current ? Date.now() - focusStartRef.current : 0;
      const totalElapsed = focusAccumulatedRef.current + runningElapsed;
      const minutes = Math.max(1, Math.round(totalElapsed / 60000));
      const session = createFocusSession(minutes, label, "aborted");
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
    useUIStore.getState().clearFocusTimerBridge();
  };

  const throttledToggle = useThrottledCallback(toggleTimer, 800);
  const throttledReset = useThrottledCallback(resetTimer, 800);

  const handleSaveReflection = (value: number | null) => {
    if (pendingSession) {
      onCompleteSession({ ...pendingSession, reflection: value ?? undefined });
    }
    setPendingSession(null);
    setShowReflection(false);
    setReflectionValue(null);
  };

  const handleCancelReflection = useCallback(() => {
    setPendingSession(null);
    setShowReflection(false);
    setReflectionValue(null);
  }, []);

  const handleHyperfocusComplete = () => {
    setShowHyperfocus(false);
    const session = createFocusSession(focusMinutes, label, "completed");
    setPendingSession(session);
    setShowReflection(true);
  };

  useBackHandler(showReflection, handleCancelReflection);
  useScrollLock(showReflection);

  // Register focus controls for global mini-player bridge
  useEffect(() => {
    setFocusControls({ toggle: throttledToggle, reset: throttledReset });
    // Sync initial state if timer was running from localStorage restore
    if (isRunning && endTimeRef.current) {
      useUIStore.getState().setFocusTimerBridge({
        endTime: endTimeRef.current,
        isRunning: true,
        isBreak,
        label,
      });
    }
    return () => {
      setFocusControls(null);
    };
  }, [throttledToggle, throttledReset]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Config
    preset,
    focusMinutes,
    breakMinutes,
    focusInputValue,
    breakInputValue,
    label,
    setLabel,
    setFocusInputValue,
    setBreakInputValue,
    // Timer
    timeLeft,
    isRunning,
    isBreak,
    // Reflection
    showReflection,
    reflectionValue,
    setReflectionValue,
    // UI
    showHyperfocus,
    setShowHyperfocus,
    // Derived
    totalMinutesToday,
    progress,
    focusDuration,
    breakDuration,
    presets,
    // Actions
    throttledToggle,
    throttledReset,
    handlePresetSelect,
    handleSaveReflection,
    handleCancelReflection,
    handleHyperfocusComplete,
    handleFocusInputBlur,
    handleBreakInputBlur,
  };
}
