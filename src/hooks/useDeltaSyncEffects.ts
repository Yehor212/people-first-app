/**
 * Delta Sync Effects — Phase 3 consumer hook.
 * Uses ref pattern for stable callbacks, mutex for TOCTOU prevention,
 * Capacitor appStateChange for native platforms.
 * Gated behind 'deltaSync' feature flag.
 */

import { useEffect, useReducer, useRef } from "react";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { logger } from "@/lib/logger";
import { onRemoteChange } from "@/lib/syncBroadcast";
import { runWithSyncLeaderLock } from "@/lib/syncLeader";
import { offlineQueue } from "@/lib/offlineQueue";
import { getCurrentSessionUserId, supabase } from "@/lib/supabaseClient";
import {
  fetchAllDeltas,
  applyDelta,
  getServerMaxSeq,
  getPersistentDeviceId,
  getLastSeq,
  saveLastSeq,
} from "@/storage/eventSync";
import { bootstrapSnapshotThenDelta } from "@/storage/initialDeltaSync";
import { syncReducer, INITIAL_STATE, getRetryDelay } from "@/lib/syncStateMachine";
import { SyncGapDetector } from "@/lib/syncGapDetector";
import { pullFromCloud } from "@/storage/realtimeSync";
import { bootstrapAutomationHistoryOnce } from "@/features/automation";
import { isAbortError } from "@/lib/validation";
import { recordSyncHealthReceipt } from "@/observability/syncHealthRecorder";
import { scheduleIdle } from "@/lib/scheduleIdle";
import { SyncOwnerBoundaryError } from "@/storage/sync/syncOwner";

const DELTA_SYNC_INTERVAL = 5 * 60 * 1000;
const MAX_GAP_SIZE = 1000;
const GAP_WAIT_MS = 500;

interface DeltaSyncOwnerOperation {
  ownerUserId: string;
  generation: number;
}

class DeltaSyncOwnerChangedError extends Error {
  constructor() {
    super("[DeltaSync] Active account changed during sync");
    this.name = "DeltaSyncOwnerChangedError";
  }
}

function isOwnerBoundaryError(error: unknown): boolean {
  return error instanceof DeltaSyncOwnerChangedError || error instanceof SyncOwnerBoundaryError;
}

function pendingQueueCounts(ownerUserId: string): {
  pending: number;
  criticalPending: number;
  criticalActionType?: string;
} {
  const actions = offlineQueue
    .getState()
    .actions.filter((action) => action.ownerUserId === ownerUserId);
  const criticalActions = actions.filter(
    (action) => action.type === "WRITE_SYNC_EVENT" || action.priority === "critical"
  );
  return {
    pending: actions.length,
    criticalPending: criticalActions.length,
    criticalActionType: criticalActions[0]?.type,
  };
}

export function useDeltaSyncEffects(): void {
  const { isFeatureVisible } = useFeatureFlags();
  const isDeltaSyncEnabled = isFeatureVisible("deltaSync");

  const [, dispatch] = useReducer(syncReducer, INITIAL_STATE);
  const stateRef = useRef(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const gapAbortRef = useRef<AbortController | null>(null);
  const gapDetectorRef = useRef<SyncGapDetector | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);
  const authGenerationRef = useRef(0);
  const observedAuthOwnerRef = useRef<string | null>(null);
  const rerunAfterCurrentRef = useRef(false);
  const effectActiveRef = useRef(false);

  const dispatchAndSync = (action: Parameters<typeof syncReducer>[1]) => {
    const next = syncReducer(stateRef.current, action);
    stateRef.current = next;
    dispatch(action);
  };

  const captureOwnerOperation = async (): Promise<DeltaSyncOwnerOperation | null> => {
    const generation = authGenerationRef.current;
    const ownerUserId = await getCurrentSessionUserId();
    if (!ownerUserId) return null;
    if (generation !== authGenerationRef.current) {
      throw new DeltaSyncOwnerChangedError();
    }
    if (observedAuthOwnerRef.current === null) {
      observedAuthOwnerRef.current = ownerUserId;
    }
    return { ownerUserId, generation };
  };

  const assertOwnerOperationCurrent = async (operation: DeltaSyncOwnerOperation): Promise<void> => {
    if (operation.generation !== authGenerationRef.current) {
      throw new DeltaSyncOwnerChangedError();
    }
    const activeOwnerUserId = await getCurrentSessionUserId();
    if (
      operation.generation !== authGenerationRef.current ||
      activeOwnerUserId !== operation.ownerUserId
    ) {
      throw new DeltaSyncOwnerChangedError();
    }
  };

  const runDeltaSyncRef = useRef(async () => {
    if (isRunningRef.current) return;
    const current = stateRef.current;
    if (current.phase === "delta" || current.phase === "snapshot") return;
    if (!navigator.onLine) {
      dispatchAndSync({ type: "WENT_OFFLINE" });
      recordSyncHealthReceipt({ kind: "offline", source: "delta" });
      return;
    }
    let operation: DeltaSyncOwnerOperation | null;
    try {
      operation = await captureOwnerOperation();
    } catch (error) {
      if (isOwnerBoundaryError(error)) return;
      throw error;
    }
    if (!operation) {
      logger.sync("[DeltaSync] Skipped; no authenticated session");
      recordSyncHealthReceipt({ kind: "session-missing", source: "delta" });
      return;
    }

    isRunningRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const locked = await runWithSyncLeaderLock("delta-sync", async () => {
        await offlineQueue.waitForInit();
        await assertOwnerOperationCurrent(operation);
        const pendingBefore = pendingQueueCounts(operation.ownerUserId);
        if (pendingBefore.pending > 0) {
          recordSyncHealthReceipt({
            kind: "queue-draining",
            source: "delta",
            actionType: pendingBefore.criticalActionType ?? "offline-queue",
            priority: pendingBefore.criticalPending > 0 ? "critical" : "normal",
          });
          await offlineQueue.processQueue();
          await assertOwnerOperationCurrent(operation);

          const pendingAfter = pendingQueueCounts(operation.ownerUserId);
          if (pendingAfter.pending > 0) {
            recordSyncHealthReceipt({
              kind: "queue-blocked",
              source: "delta",
              actionType: pendingAfter.criticalActionType ?? "offline-queue",
              priority: pendingAfter.criticalPending > 0 ? "critical" : "normal",
            });
            logger.sync("[DeltaSync] Delta pull blocked; saved local actions still need retry");
            return;
          }

          dispatchAndSync({ type: "QUEUE_DRAINED" });
          recordSyncHealthReceipt({
            kind: "queue-drained",
            source: "delta",
            actionType: pendingBefore.criticalActionType ?? "offline-queue",
            priority: pendingBefore.criticalPending > 0 ? "critical" : "normal",
          });
        }

        dispatchAndSync({ type: "TRIGGER_DELTA" });

        const localSeq = await getLastSeq();
        await assertOwnerOperationCurrent(operation);
        if (localSeq === 0) {
          const result = await bootstrapSnapshotThenDelta(controller.signal, operation.ownerUserId);
          await assertOwnerOperationCurrent(operation);
          logger.sync(
            "[DeltaSync] Snapshot bootstrap complete, fetched=" +
              result.fetched +
              ", applied=" +
              result.applied +
              ", seq=" +
              result.lastSeq
          );
          recordSyncHealthReceipt({
            kind: "snapshot-applied",
            source: "delta",
            fetched: result.fetched,
            applied: result.applied,
            seq: result.lastSeq,
          });
          gapDetectorRef.current?.resetTo(result.lastSeq);
          dispatchAndSync({ type: "RESET", lastSeq: result.lastSeq });
          return;
        }

        const lastSeq = localSeq;
        const events = await fetchAllDeltas(lastSeq, controller.signal);
        await assertOwnerOperationCurrent(operation);

        if (events.length === 0) {
          gapDetectorRef.current?.resetTo(lastSeq);
          dispatchAndSync({ type: "RESET", lastSeq });
          recordSyncHealthReceipt({ kind: "delta-empty", source: "delta", seq: lastSeq });
          return;
        }

        const deviceId = await getPersistentDeviceId();
        await assertOwnerOperationCurrent(operation);
        const applied = await applyDelta(events, deviceId, {
          expectedOwnerUserId: operation.ownerUserId,
          assertOwnerCurrent: () => assertOwnerOperationCurrent(operation),
        });
        await assertOwnerOperationCurrent(operation);
        const committedSeq = await getLastSeq();
        await assertOwnerOperationCurrent(operation);

        logger.sync("[DeltaSync] Applied " + applied + " events, seq=" + committedSeq);
        dispatchAndSync({ type: "DELTA_SUCCESS", lastSeq: committedSeq });
        recordSyncHealthReceipt({
          kind: "delta-applied",
          source: "delta",
          fetched: events.length,
          applied,
          seq: committedSeq,
        });

        if (gapDetectorRef.current) {
          gapDetectorRef.current.resetTo(committedSeq);
        }
      });

      if (!locked.acquired) {
        await assertOwnerOperationCurrent(operation);
        logger.sync("[DeltaSync] Delta pull skipped; another tab is applying the cursor");
        recordSyncHealthReceipt({ kind: "leader-skipped", source: "delta" });
      }
    } catch (err) {
      if (isAbortError(err)) return;

      if (isOwnerBoundaryError(err)) {
        logger.sync("[DeltaSync] Discarded stale work at an account boundary");
        dispatchAndSync({ type: "RESET", lastSeq: 0 });
        return;
      }

      if (err instanceof Error && err.name === "QuotaExceededError") {
        logger.error("[DeltaSync] Storage full");
        dispatchAndSync({ type: "ERROR", retryDelayMs: 0 });
        return;
      }

      logger.error("[DeltaSync] Delta pull failed");
      recordSyncHealthReceipt({
        kind: "error",
        source: "delta",
        errorName: "DELTA_SYNC_FAILED",
      });
      const delay = getRetryDelay(stateRef.current.consecutiveErrors);
      dispatchAndSync({ type: "ERROR", retryDelayMs: delay });

      retryTimerRef.current = setTimeout(() => {
        void runDeltaSyncRef.current();
      }, delay);
    } finally {
      isRunningRef.current = false;
      if (abortRef.current === controller) abortRef.current = null;
      const shouldRerun = rerunAfterCurrentRef.current && effectActiveRef.current;
      rerunAfterCurrentRef.current = false;
      if (shouldRerun) void runDeltaSyncRef.current();
    }
  });

  const runSnapshotSyncRef = useRef(async () => {
    if (isRunningRef.current) return;
    let operation: DeltaSyncOwnerOperation | null;
    try {
      operation = await captureOwnerOperation();
    } catch (error) {
      if (isOwnerBoundaryError(error)) return;
      throw error;
    }
    if (!operation) {
      logger.sync("[DeltaSync] Snapshot skipped; no authenticated session");
      return;
    }
    isRunningRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    dispatchAndSync({ type: "SNAPSHOT_START" });

    try {
      await assertOwnerOperationCurrent(operation);
      const baselineSeq = await getServerMaxSeq(operation.ownerUserId);
      await assertOwnerOperationCurrent(operation);
      const snapshotApplied = await pullFromCloud(operation.ownerUserId);
      await assertOwnerOperationCurrent(operation);
      if (!snapshotApplied) {
        throw new Error("[DeltaSync] Snapshot pull failed");
      }
      await bootstrapAutomationHistoryOnce(operation.ownerUserId, { force: true });
      await assertOwnerOperationCurrent(operation);
      const tailEvents = await fetchAllDeltas(baselineSeq, controller.signal);
      await assertOwnerOperationCurrent(operation);
      let lastSeq = baselineSeq;
      let applied = 0;
      if (tailEvents.length > 0) {
        const deviceId = await getPersistentDeviceId();
        await assertOwnerOperationCurrent(operation);
        applied = await applyDelta(tailEvents, deviceId, {
          expectedOwnerUserId: operation.ownerUserId,
          assertOwnerCurrent: () => assertOwnerOperationCurrent(operation),
        });
        await assertOwnerOperationCurrent(operation);
        lastSeq = tailEvents[tailEvents.length - 1].seq;
      } else {
        await saveLastSeq(baselineSeq, {
          expectedOwnerUserId: operation.ownerUserId,
          assertOwnerCurrent: () => assertOwnerOperationCurrent(operation),
        });
        await assertOwnerOperationCurrent(operation);
      }
      dispatchAndSync({ type: "SNAPSHOT_SUCCESS", lastSeq });
      recordSyncHealthReceipt({
        kind: "snapshot-applied",
        source: "delta",
        seq: lastSeq,
        fetched: tailEvents.length,
        applied,
      });

      if (gapDetectorRef.current) {
        gapDetectorRef.current.resetTo(lastSeq);
      }

      logger.sync("[DeltaSync] Snapshot complete, seq=" + lastSeq);
    } catch (err) {
      if (isAbortError(err)) return;
      if (isOwnerBoundaryError(err)) {
        logger.sync("[DeltaSync] Discarded stale snapshot at an account boundary");
        dispatchAndSync({ type: "RESET", lastSeq: 0 });
        return;
      }
      logger.error("[DeltaSync] Snapshot failed");
      const delay = getRetryDelay(stateRef.current.consecutiveErrors);
      dispatchAndSync({ type: "ERROR", retryDelayMs: delay });
    } finally {
      isRunningRef.current = false;
      if (abortRef.current === controller) abortRef.current = null;
      const shouldRerun = rerunAfterCurrentRef.current && effectActiveRef.current;
      rerunAfterCurrentRef.current = false;
      if (shouldRerun) void runDeltaSyncRef.current();
    }
  });

  useEffect(() => {
    if (!isDeltaSyncEnabled) return;
    effectActiveRef.current = true;

    gapDetectorRef.current = new SyncGapDetector(stateRef.current.lastSeq, {
      gapWaitMs: GAP_WAIT_MS,
      maxGapSize: MAX_GAP_SIZE,
      onFallbackToSnapshot: () => void runSnapshotSyncRef.current(),
      onPullRange: async (fromSeq: number) => {
        let operation: DeltaSyncOwnerOperation | null;
        try {
          operation = await captureOwnerOperation();
        } catch (error) {
          if (isOwnerBoundaryError(error)) return;
          throw error;
        }
        if (!operation) return;

        const controller = new AbortController();
        gapAbortRef.current = controller;
        try {
          await assertOwnerOperationCurrent(operation);
          const events = await fetchAllDeltas(fromSeq, controller.signal);
          await assertOwnerOperationCurrent(operation);
          if (events.length > 0) {
            const deviceId = await getPersistentDeviceId();
            await assertOwnerOperationCurrent(operation);
            await applyDelta(events, deviceId, {
              expectedOwnerUserId: operation.ownerUserId,
              assertOwnerCurrent: () => assertOwnerOperationCurrent(operation),
            });
            await assertOwnerOperationCurrent(operation);
            const committedSeq = await getLastSeq();
            await assertOwnerOperationCurrent(operation);
            gapDetectorRef.current?.resetTo(committedSeq);
            dispatchAndSync({ type: "RESET", lastSeq: committedSeq });
            recordSyncHealthReceipt({
              kind: "gap-recovered",
              source: "delta",
              fetched: events.length,
              seq: committedSeq,
            });
          }
        } catch (error) {
          if (isAbortError(error) || isOwnerBoundaryError(error)) {
            logger.sync("[DeltaSync] Discarded stale gap recovery at an account boundary");
            return;
          }
          throw error;
        } finally {
          if (gapAbortRef.current === controller) gapAbortRef.current = null;
        }
      },
    });

    const unsubBroadcast = onRemoteChange((signal) => {
      if (typeof signal.eventSeq === "number" && gapDetectorRef.current) {
        const currentSeq = stateRef.current.lastSeq;
        if (signal.eventSeq <= currentSeq) return;
        if (signal.eventSeq > currentSeq + 1) {
          gapDetectorRef.current.onEventSignal(signal.eventSeq);
          return;
        }
      }
      void runDeltaSyncRef.current();
    });

    const handleOnline = () => {
      dispatchAndSync({ type: "CAME_ONLINE" });
      void runDeltaSyncRef.current();
    };
    const handleOffline = () => dispatchAndSync({ type: "WENT_OFFLINE" });
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void runDeltaSyncRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
      const nextOwnerUserId = session?.user?.id ?? null;
      const previousOwnerUserId = observedAuthOwnerRef.current;
      observedAuthOwnerRef.current = nextOwnerUserId;

      if (previousOwnerUserId === nextOwnerUserId) {
        if (nextOwnerUserId) void runDeltaSyncRef.current();
        return;
      }

      authGenerationRef.current += 1;
      dispatchAndSync({ type: "RESET", lastSeq: 0 });

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (gapAbortRef.current) {
        gapAbortRef.current.abort();
      }
      if (nextOwnerUserId) {
        if (isRunningRef.current) {
          rerunAfterCurrentRef.current = true;
        } else {
          void runDeltaSyncRef.current();
        }
      }
    }).data.subscription;

    // INTENTIONAL: noop cleanup — async Capacitor addListener replaces it when native platform detected
    let isMounted = true;
    let removeAppListener = () => {
      logger.sync("[DeltaSync] No native listener registered");
    };
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) void runDeltaSyncRef.current();
        });
        if (isMounted) {
          removeAppListener = () => void handle.remove();
        } else {
          // Component already unmounted — clean up immediately to prevent leak
          void handle.remove();
        }
      } catch (_e) {
        logger.sync("[DeltaSync] Capacitor not available");
      }
    })();

    intervalRef.current = setInterval(() => {
      void runDeltaSyncRef.current();
    }, DELTA_SYNC_INTERVAL);

    const startupSyncHandle = scheduleIdle(
      () => {
        void runDeltaSyncRef.current();
      },
      9000,
      6500
    );

    return () => {
      isMounted = false;
      effectActiveRef.current = false;
      rerunAfterCurrentRef.current = false;
      startupSyncHandle.cancel();
      unsubBroadcast();
      removeAppListener();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      authSubscription?.unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
      if (gapAbortRef.current) gapAbortRef.current.abort();
      if (gapDetectorRef.current) gapDetectorRef.current.destroy();
    };
  }, [isDeltaSyncEnabled]);
}
