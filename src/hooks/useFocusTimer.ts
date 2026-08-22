import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import type { FocusSession } from "@/types";
import { getToday } from "@/lib/utils";
import {
  safeLocalStorageSet,
  storageReadRaw,
  storageRemove,
} from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useThrottledCallback } from "@/hooks/useThrottledCallback";
import { useScrollLock } from "@/hooks/useScrollLock";
import { haptics } from "@/lib/haptics";
import { announceSuccess } from "@/lib/a11y";
import { scheduleFocusCompletionNotification } from "@/lib/focusCompletionNotification";
import { useUIStore, setFocusControls } from "@/stores";
import {
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
  registerAccountBoundaryRuntimeReset,
  subscribeAccountSessionTransition,
  subscribeOriginAccountBoundaryObservation,
} from "@/storage/accountBoundaryRuntime";
import { getLocalDataOwnerId } from "@/storage/db";
import {
  DEFAULT_FOCUS_MINUTES,
  clearPendingFocusCommit,
  createFocusSession,
  pendingFocusCommitMatches,
  persistPendingFocusCommit,
  readPendingFocusCommit,
  readTimerState,
} from "@/types/focusTimerTypes";
import type {
  FocusCommitBoundary,
  PendingFocusCommit,
  PendingFocusCommitRead,
  TimerState,
  TimerStateRead,
  UseFocusTimerOptions,
} from "@/types/focusTimerTypes";
import { useFocusTimerConfig } from "./useFocusTimerConfig";

// Re-export for backward compatibility
export { presetColors } from "@/types/focusTimerTypes";

async function assertPendingBoundary(pending: PendingFocusCommit): Promise<void> {
  assertOriginAccountBoundaryGeneration(pending.accountBoundaryGeneration);
  const currentOwnerUserId = await getLocalDataOwnerId();
  assertOriginAccountBoundaryGeneration(pending.accountBoundaryGeneration);
  if (currentOwnerUserId !== pending.ownerUserId) {
    throw new Error("Focus recovery owner changed");
  }
}

async function createDurablePendingFocusCommit(
  session: FocusSession,
  requiresReflection: boolean,
  accountBoundaryGeneration: string
): Promise<PendingFocusCommit | null> {
  try {
    return await runWithOriginExclusiveLock(
      ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
      async () => {
        assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
        const ownerUserId = await getLocalDataOwnerId();
        assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
        if (readPendingFocusCommit().status !== "absent") return null;
        const pending: PendingFocusCommit = {
          schemaVersion: 1,
          ownerUserId,
          accountBoundaryGeneration,
          session,
          requiresReflection,
        };
        if (!persistPendingFocusCommit(pending)) return null;
        await assertPendingBoundary(pending);
        return pending;
      }
    );
  } catch {
    return null;
  }
}

async function updateDurablePendingFocusCommit(
  expected: PendingFocusCommit,
  session: FocusSession
): Promise<PendingFocusCommit | null> {
  try {
    return await runWithOriginExclusiveLock(
      ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
      async () => {
        await assertPendingBoundary(expected);
        const current = readPendingFocusCommit();
        if (
          current.status !== "present" ||
          !pendingFocusCommitMatches(current.value, expected)
        ) {
          return null;
        }
        const next: PendingFocusCommit = { ...current.value, session };
        if (!persistPendingFocusCommit(next)) return null;
        await assertPendingBoundary(next);
        return next;
      }
    );
  } catch {
    return null;
  }
}

async function validateDurablePendingFocusCommit(
  expected: PendingFocusCommit
): Promise<boolean> {
  try {
    return await runWithOriginExclusiveLock(
      ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
      async () => {
        await assertPendingBoundary(expected);
        const current = readPendingFocusCommit();
        return (
          current.status === "present" &&
          pendingFocusCommitMatches(current.value, expected)
        );
      }
    );
  } catch {
    return false;
  }
}

async function acknowledgeDurablePendingFocusCommit(
  expected: PendingFocusCommit
): Promise<boolean> {
  try {
    return await runWithOriginExclusiveLock(
      ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
      async () => {
        await assertPendingBoundary(expected);
        const current = readPendingFocusCommit();
        if (current.status === "unavailable" || current.status === "invalid") {
          return false;
        }
        if (current.status === "absent") {
          const pendingRaw = storageReadRaw(SK.FOCUS_PENDING_COMMIT);
          const timerRaw = storageReadRaw(SK.TIMER_STATE);
          return (
            pendingRaw.ok &&
            pendingRaw.value === null &&
            timerRaw.ok &&
            timerRaw.value === null
          );
        }
        if (!pendingFocusCommitMatches(current.value, expected)) return false;
        // The expired/running checkpoint must be removed before the durable
        // pending marker. If either operation fails, the exact primary identity
        // remains retryable and the UI stays behind the acknowledgement gate.
        if (!storageRemove(SK.TIMER_STATE)) return false;
        if (!clearPendingFocusCommit()) return false;
        await assertPendingBoundary(expected);
        return true;
      }
    );
  } catch {
    return false;
  }
}

async function discardExpiredBoundaryFocusRecovery(
  expected: PendingFocusCommit
): Promise<boolean> {
  try {
    return await runWithOriginExclusiveLock(
      ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
      async () => {
        const current = readPendingFocusCommit();
        if (current.status === "unavailable" || current.status === "invalid") return false;
        if (
          current.status === "absent" ||
          !pendingFocusCommitMatches(current.value, expected)
        ) {
          return true;
        }
        if (!storageRemove(SK.TIMER_STATE)) return false;
        return clearPendingFocusCommit();
      }
    );
  } catch {
    return false;
  }
}

export function useFocusTimer({
  sessions,
  onCompleteSession,
  onMinuteUpdate,
}: UseFocusTimerOptions) {
  const [showHyperfocus, setShowHyperfocus] = useState(false);

  const timerReadRef = useRef<TimerStateRead | null>(null);
  if (timerReadRef.current === null) timerReadRef.current = readTimerState();
  const timerRead = timerReadRef.current;
  const savedState = timerRead.status === "present" ? timerRead.value : null;

  const pendingReadRef = useRef<PendingFocusCommitRead | null>(null);
  if (pendingReadRef.current === null) pendingReadRef.current = readPendingFocusCommit();
  const pendingRead = pendingReadRef.current;
  const storedPending = pendingRead.status === "present" ? pendingRead.value : null;
  const initialStorageReadBlocked =
    timerRead.status === "unavailable" ||
    timerRead.status === "invalid" ||
    pendingRead.status === "unavailable" ||
    pendingRead.status === "invalid";
  const expiredFocusCheckpoint = Boolean(
    !storedPending &&
      savedState?.endTime &&
      savedState.isRunning &&
      !savedState.isBreak &&
      Math.ceil((savedState.endTime - Date.now()) / 1000) <= 0
  );
  const initialRecoveryNeeded = Boolean(
    initialStorageReadBlocked || storedPending || expiredFocusCheckpoint
  );

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

  const [timeLeft, setTimeLeft] = useState(() => {
    if (initialRecoveryNeeded) {
      return (savedState?.focusMinutes || DEFAULT_FOCUS_MINUTES) * 60;
    }
    if (savedState?.endTime && savedState.isRunning) {
      const remaining = Math.ceil((savedState.endTime - Date.now()) / 1000);
      if (remaining > 0) return remaining;
    }
    return (savedState?.focusMinutes || DEFAULT_FOCUS_MINUTES) * 60;
  });
  const [isRunning, setIsRunning] = useState(
    initialRecoveryNeeded ? false : savedState?.isRunning || false
  );
  const [isBreak, setIsBreak] = useState(
    initialRecoveryNeeded ? false : savedState?.isBreak || false
  );
  const [label, setLabel] = useState(savedState?.label || "");
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionValue, setReflectionValue] = useState<number | null>(null);
  const [pendingSession, setPendingSession] = useState<FocusSession | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const intervalTickRef = useRef(0);
  const isMountedRef = useRef(true);
  const savePendingRef = useRef(false);
  const endTimeRef = useRef<number | null>(
    initialRecoveryNeeded ? null : savedState?.endTime || null
  );
  const focusStartRef = useRef<number | null>(
    initialRecoveryNeeded ? null : savedState?.focusStartTime || null
  );
  const focusAccumulatedRef = useRef(savedState?.focusAccumulated || 0);
  const lastMinuteRef = useRef(0);
  const pendingCommitRef = useRef<PendingFocusCommit | null>(storedPending);
  const recoveryBlockedRef = useRef(initialRecoveryNeeded);
  const recoveryStartedRef = useRef(false);
  const expiredRecoverySessionRef = useRef<FocusSession | null>(null);
  const primaryCommitTokenRef = useRef<object | null>(null);
  const runtimeEpochRef = useRef(0);
  const boundaryGenerationRef = useRef(captureOriginAccountBoundaryGeneration());

  const stateRef = useRef({ isRunning, isBreak, focusMinutes, breakMinutes, label, preset });
  stateRef.current = { isRunning, isBreak, focusMinutes, breakMinutes, label, preset };
  const prevFocusDurationRef = useRef(focusDuration);
  const prevBreakDurationRef = useRef(breakDuration);

  const todaySessions = sessions.filter((session) => {
    return session.date === getToday() && session.status !== "aborted";
  });
  const todayMinutes = todaySessions.reduce((total, session) => total + session.duration, 0);
  const getCurrentRunningMinutes = () => {
    if (!isRunning || isBreak) return 0;
    const runningElapsed = focusStartRef.current ? Date.now() - focusStartRef.current : 0;
    return Math.floor((focusAccumulatedRef.current + runningElapsed) / 60_000);
  };
  const totalMinutesToday = todayMinutes + getCurrentRunningMinutes();
  const progress = isBreak
    ? ((breakDuration - timeLeft) / breakDuration) * 100
    : ((focusDuration - timeLeft) / focusDuration) * 100;

  const clearInMemoryTimer = useCallback(
    (nextIsBreak = false) => {
      endTimeRef.current = null;
      focusStartRef.current = null;
      focusAccumulatedRef.current = 0;
      lastMinuteRef.current = 0;
      setIsRunning(false);
      setIsBreak(nextIsBreak);
      setTimeLeft(nextIsBreak ? breakDuration : focusDuration);
      useUIStore.getState().clearFocusTimerBridge();
    },
    [breakDuration, focusDuration]
  );

  const commitAndAcknowledgePending = useCallback(
    async (pending: PendingFocusCommit): Promise<boolean> => {
      if (primaryCommitTokenRef.current) return false;
      const epoch = runtimeEpochRef.current;
      if (!(await validateDurablePendingFocusCommit(pending))) return false;
      if (epoch !== runtimeEpochRef.current) return false;
      const token = {};
      primaryCommitTokenRef.current = token;
      const boundary: FocusCommitBoundary = {
        ownerUserId: pending.ownerUserId,
        accountBoundaryGeneration: pending.accountBoundaryGeneration,
        expectedPending: pending,
      };
      try {
        await onCompleteSession(pending.session, boundary);
        if (epoch !== runtimeEpochRef.current) return false;
        return await acknowledgeDurablePendingFocusCommit(pending);
      } catch {
        logger.warn("[FocusTimer] Primary focus persistence deferred");
        return false;
      } finally {
        if (primaryCommitTokenRef.current === token) {
          primaryCommitTokenRef.current = null;
        }
      }
    },
    [onCompleteSession]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const resetForAccountBoundary = () => {
      runtimeEpochRef.current += 1;
      boundaryGenerationRef.current = captureOriginAccountBoundaryGeneration();
      primaryCommitTokenRef.current = null;
      pendingCommitRef.current = null;
      recoveryBlockedRef.current = initialStorageReadBlocked;
      recoveryStartedRef.current = false;
      expiredRecoverySessionRef.current = null;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (!isMountedRef.current) return;
      setPendingSession(null);
      setShowReflection(false);
      setReflectionValue(null);
      setShowHyperfocus(false);
      setLabel("");
      clearInMemoryTimer(false);
    };
    const unregisterReset = registerAccountBoundaryRuntimeReset(resetForAccountBoundary);
    const unsubscribeSessionTransition = subscribeAccountSessionTransition(
      resetForAccountBoundary
    );
    const unsubscribeObservation = subscribeOriginAccountBoundaryObservation(
      resetForAccountBoundary
    );
    return () => {
      unregisterReset();
      unsubscribeSessionTransition();
      unsubscribeObservation();
    };
  }, [clearInMemoryTimer, initialStorageReadBlocked]);

  useEffect(() => {
    if (!initialRecoveryNeeded || recoveryStartedRef.current) return;
    recoveryStartedRef.current = true;
    recoveryBlockedRef.current = true;
    const epoch = runtimeEpochRef.current;

    void (async () => {
      if (initialStorageReadBlocked) {
        logger.error("[FocusTimer] Durable recovery state unavailable");
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("zenflow:storage-error", {
              detail: {
                type: "read_failed",
                message: t.storageErrorDesc,
              },
            })
          );
        }
        return;
      }
      let pending = storedPending;
      if (pending) {
        if (!(await validateDurablePendingFocusCommit(pending))) {
          const discarded = await discardExpiredBoundaryFocusRecovery(pending);
          if (!discarded) logger.warn("[FocusTimer] Stale recovery cleanup deferred");
          if (epoch === runtimeEpochRef.current) {
            pendingCommitRef.current = null;
            recoveryBlockedRef.current = !discarded;
            if (discarded && isMountedRef.current) clearInMemoryTimer(false);
          }
          return;
        }
      } else if (expiredFocusCheckpoint && savedState) {
        expiredRecoverySessionRef.current ??= createFocusSession(
          savedState.focusMinutes,
          savedState.label,
          "completed"
        );
        pending = await createDurablePendingFocusCommit(
          expiredRecoverySessionRef.current,
          true,
          boundaryGenerationRef.current
        );
        if (!pending) {
          logger.error("[FocusTimer] Pending completion recovery unavailable");
          return;
        }
      }

      if (!pending || epoch !== runtimeEpochRef.current) return;
      pendingCommitRef.current = pending;
      if (pending.requiresReflection) {
        if (!isMountedRef.current) return;
        setPendingSession(pending.session);
        setReflectionValue(pending.session.reflection ?? null);
        setShowReflection(true);
        logger.log("[FocusTimer] Recovered pending completed session");
        return;
      }

      const acknowledged = await commitAndAcknowledgePending(pending);
      if (!acknowledged || epoch !== runtimeEpochRef.current) {
        logger.warn("[FocusTimer] Aborted session recovery deferred");
        return;
      }
      pendingCommitRef.current = null;
      recoveryBlockedRef.current = false;
      if (isMountedRef.current) clearInMemoryTimer(false);
    })();
  }, [
    clearInMemoryTimer,
    commitAndAcknowledgePending,
    expiredFocusCheckpoint,
    initialRecoveryNeeded,
    initialStorageReadBlocked,
    savedState,
    storedPending,
    t.storageErrorDesc,
  ]);

  useEffect(() => {
    return () => {
      if (pendingCommitRef.current || recoveryBlockedRef.current) return;
      const current = stateRef.current;
      const state: TimerState = {
        endTime: endTimeRef.current,
        focusMinutes: current.focusMinutes,
        breakMinutes: current.breakMinutes,
        isRunning: current.isRunning,
        isBreak: current.isBreak,
        label: current.label,
        focusStartTime: focusStartRef.current,
        focusAccumulated: focusAccumulatedRef.current,
        preset: current.preset,
      };
      safeLocalStorageSet(SK.TIMER_STATE, state);
    };
  }, []);

  const saveTimerState = useCallback(() => {
    if (pendingCommitRef.current || recoveryBlockedRef.current) return;
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

  useEffect(() => {
    if (!isRunning && !isBreak && focusDuration !== prevFocusDurationRef.current) {
      setTimeLeft(focusDuration);
    }
    prevFocusDurationRef.current = focusDuration;
  }, [focusDuration, isRunning, isBreak]);

  useEffect(() => {
    if (!isRunning && isBreak && breakDuration !== prevBreakDurationRef.current) {
      setTimeLeft(breakDuration);
    }
    prevBreakDurationRef.current = breakDuration;
  }, [breakDuration, isRunning, isBreak]);

  useEffect(() => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    savePendingRef.current = true;
    saveDebounceRef.current = setTimeout(() => {
      saveTimerState();
      savePendingRef.current = false;
    }, 300);
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, [saveTimerState]);

  useEffect(() => {
    if (initialRecoveryNeeded) return;
    const saved = readTimerState();
    if (
      saved.status === "present" &&
      saved.value.endTime &&
      saved.value.isRunning &&
      saved.value.endTime > Date.now()
    ) {
      setTimeLeft(Math.ceil((saved.value.endTime - Date.now()) / 1000));
    }
  }, [initialRecoveryNeeded]);

  const beginCompletedRecovery = useCallback(
    async (session: FocusSession): Promise<void> => {
      recoveryBlockedRef.current = true;
      const epoch = runtimeEpochRef.current;
      const pending = await createDurablePendingFocusCommit(
        session,
        true,
        boundaryGenerationRef.current
      );
      if (!pending || epoch !== runtimeEpochRef.current) {
        logger.error("[FocusTimer] Pending completion recovery unavailable");
        return;
      }
      pendingCommitRef.current = pending;
      if (!isMountedRef.current) return;
      setPendingSession(session);
      setReflectionValue(session.reflection ?? null);
      setShowReflection(true);
      announceSuccess(t.focusCompletedShort || "Focus session complete");
      void scheduleFocusCompletionNotification(
        t.focusCompletedShort || "Focus session complete"
      ).catch(() => logger.warn("[FocusTimer] Completion notification deferred"));
    },
    [t.focusCompletedShort]
  );

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      saveTimerState();
      return;
    }

    intervalRef.current = setInterval(() => {
      if (!isMountedRef.current || !endTimeRef.current || recoveryBlockedRef.current) return;
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      setTimeLeft(remaining);

      if (!isBreak) {
        const runningElapsed = focusStartRef.current ? now - focusStartRef.current : 0;
        const currentMinutes = Math.floor(
          (focusAccumulatedRef.current + runningElapsed) / 60_000
        );
        if (currentMinutes !== lastMinuteRef.current) {
          lastMinuteRef.current = currentMinutes;
          onMinuteUpdate?.(currentMinutes);
        }
      }

      if (remaining === 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (!isBreak) {
          recoveryBlockedRef.current = true;
          setIsRunning(false);
          const session = createFocusSession(focusMinutes, label, "completed");
          void beginCompletedRecovery(session);
        } else {
          endTimeRef.current = null;
          setIsRunning(false);
          setIsBreak(false);
          setTimeLeft(focusDuration);
          storageRemove(SK.TIMER_STATE);
          useUIStore.getState().clearFocusTimerBridge();
        }
      }

      intervalTickRef.current += 1;
      if (intervalTickRef.current >= 10) {
        intervalTickRef.current = 0;
        if (!savePendingRef.current) saveTimerState();
      }
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [
    beginCompletedRecovery,
    focusDuration,
    focusMinutes,
    isBreak,
    isRunning,
    label,
    onMinuteUpdate,
    saveTimerState,
  ]);

  const toggleTimer = () => {
    if (
      recoveryBlockedRef.current ||
      pendingCommitRef.current ||
      primaryCommitTokenRef.current
    ) {
      return;
    }
    const pendingStatus = readPendingFocusCommit().status;
    const timerStatus = readTimerState().status;
    if (
      pendingStatus !== "absent" ||
      timerStatus === "unavailable" ||
      timerStatus === "invalid"
    ) {
      recoveryBlockedRef.current = true;
      logger.warn("[FocusTimer] Pending recovery must finish before timer start");
      return;
    }

    if (isRunning) {
      if (endTimeRef.current) {
        setTimeLeft(Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000)));
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

    boundaryGenerationRef.current = captureOriginAccountBoundaryGeneration();
    if (timeLeft <= 0) setTimeLeft(isBreak ? breakDuration : focusDuration);
    endTimeRef.current =
      Date.now() +
      (timeLeft > 0 ? timeLeft : isBreak ? breakDuration : focusDuration) * 1000;
    if (!isBreak) {
      focusStartRef.current = Date.now();
      void haptics.focusStarted();
    }
    setIsRunning(true);
    useUIStore.getState().setFocusTimerBridge({
      endTime: endTimeRef.current,
      isRunning: true,
      isBreak,
      label,
    });
  };

  const resetTimer = async () => {
    if (primaryCommitTokenRef.current) return;
    const durablePending = pendingCommitRef.current;
    if (durablePending) {
      if (durablePending.requiresReflection) return;
      const acknowledged = await commitAndAcknowledgePending(durablePending);
      if (!acknowledged) {
        logger.warn("[FocusTimer] Aborted session acknowledgement deferred");
        return;
      }
      pendingCommitRef.current = null;
      recoveryBlockedRef.current = false;
      clearInMemoryTimer(false);
      return;
    }
    if (recoveryBlockedRef.current) return;

    if (isRunning && !isBreak) {
      const runningElapsed = focusStartRef.current ? Date.now() - focusStartRef.current : 0;
      const minutes = Math.max(
        1,
        Math.round((focusAccumulatedRef.current + runningElapsed) / 60_000)
      );
      recoveryBlockedRef.current = true;
      const session = createFocusSession(minutes, label, "aborted");
      const pending = await createDurablePendingFocusCommit(
        session,
        false,
        boundaryGenerationRef.current
      );
      if (!pending) {
        logger.error("[FocusTimer] Pending aborted-session recovery unavailable");
        recoveryBlockedRef.current = false;
        return;
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsRunning(false);
      pendingCommitRef.current = pending;
      const acknowledged = await commitAndAcknowledgePending(pending);
      if (!acknowledged) {
        logger.warn("[FocusTimer] Aborted session persistence deferred");
        return;
      }
      pendingCommitRef.current = null;
      recoveryBlockedRef.current = false;
      clearInMemoryTimer(false);
      return;
    }

    if (!storageRemove(SK.TIMER_STATE)) {
      logger.warn("[FocusTimer] Timer reset persistence deferred");
      return;
    }
    clearInMemoryTimer(false);
    saveTimerState();
  };

  const throttledToggle = useThrottledCallback(toggleTimer, 800);
  const throttledReset = useThrottledCallback(resetTimer, 800);

  const handleSaveReflection = async (value: number | null): Promise<boolean> => {
    const current = pendingCommitRef.current;
    if (!current?.requiresReflection || !pendingSession || primaryCommitTokenRef.current) {
      return false;
    }
    const committedSession = { ...pendingSession, reflection: value ?? undefined };
    const updated = await updateDurablePendingFocusCommit(current, committedSession);
    if (!updated) {
      logger.error("[FocusTimer] Pending reflection recovery unavailable");
      return false;
    }
    pendingCommitRef.current = updated;
    setPendingSession(committedSession);
    const acknowledged = await commitAndAcknowledgePending(updated);
    if (!acknowledged) {
      logger.warn("[FocusTimer] Completed session acknowledgement deferred");
      return false;
    }
    pendingCommitRef.current = null;
    recoveryBlockedRef.current = false;
    setPendingSession(null);
    setShowReflection(false);
    setReflectionValue(null);
    clearInMemoryTimer(true);
    return true;
  };

  const handleHyperfocusComplete = () => {
    if (pendingCommitRef.current || recoveryBlockedRef.current) return;
    recoveryBlockedRef.current = true;
    const session = createFocusSession(focusMinutes, label, "completed");
    const epoch = runtimeEpochRef.current;
    void createDurablePendingFocusCommit(
      session,
      true,
      boundaryGenerationRef.current
    ).then((pending) => {
      if (!pending || epoch !== runtimeEpochRef.current) {
        logger.error("[FocusTimer] Pending hyperfocus recovery unavailable");
        if (epoch === runtimeEpochRef.current) recoveryBlockedRef.current = false;
        return;
      }
      pendingCommitRef.current = pending;
      if (!isMountedRef.current) return;
      setShowHyperfocus(false);
      setPendingSession(session);
      setShowReflection(true);
    });
  };

  useBackHandler(showReflection, () => void handleSaveReflection(null));
  useScrollLock(showReflection);
  useBackHandler(showHyperfocus, () => setShowHyperfocus(false));

  useEffect(() => {
    setFocusControls({ toggle: throttledToggle, reset: throttledReset });
    if (isRunning && endTimeRef.current) {
      useUIStore.getState().setFocusTimerBridge({
        endTime: endTimeRef.current,
        isRunning: true,
        isBreak,
        label,
      });
    }
    return () => setFocusControls(null);
  }, [throttledToggle, throttledReset]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    preset,
    focusMinutes,
    breakMinutes,
    focusInputValue,
    breakInputValue,
    label,
    setLabel,
    setFocusInputValue,
    setBreakInputValue,
    timeLeft,
    isRunning,
    isBreak,
    showReflection,
    reflectionValue,
    setReflectionValue,
    showHyperfocus,
    setShowHyperfocus,
    totalMinutesToday,
    progress,
    focusDuration,
    breakDuration,
    presets,
    throttledToggle,
    throttledReset,
    handlePresetSelect,
    handleSaveReflection,
    handleHyperfocusComplete,
    handleFocusInputBlur,
    handleBreakInputBlur,
  };
}
