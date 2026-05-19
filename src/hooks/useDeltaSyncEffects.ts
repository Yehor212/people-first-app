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
import { getCurrentSessionUserId, supabase } from "@/lib/supabaseClient";
import {
  fetchAllDeltas,
  applyDelta,
  getServerMaxSeq,
  getPersistentDeviceId,
  getLastSeq,
} from "@/storage/eventSync";
import { bootstrapSnapshotThenDelta } from "@/storage/initialDeltaSync";
import { syncReducer, INITIAL_STATE, getRetryDelay } from "@/lib/syncStateMachine";
import { SyncGapDetector } from "@/lib/syncGapDetector";
import { pullFromCloud } from "@/storage/realtimeSync";
import { isAbortError } from "@/lib/validation";
import { recordSyncHealthReceipt } from "@/observability/syncHealthRecorder";
import { scheduleIdle } from "@/lib/scheduleIdle";

const DELTA_SYNC_INTERVAL = 5 * 60 * 1000;
const MAX_GAP_SIZE = 1000;
const GAP_WAIT_MS = 500;

export function useDeltaSyncEffects(): void {
  const { isFeatureEnabled } = useFeatureFlags();
  const isDeltaSyncEnabled = isFeatureEnabled("deltaSync");

  const [, dispatch] = useReducer(syncReducer, INITIAL_STATE);
  const stateRef = useRef(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const gapDetectorRef = useRef<SyncGapDetector | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  const dispatchAndSync = (action: Parameters<typeof syncReducer>[1]) => {
    const next = syncReducer(stateRef.current, action);
    stateRef.current = next;
    dispatch(action);
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
    if (!(await getCurrentSessionUserId())) {
      logger.sync("[DeltaSync] Skipped; no authenticated session");
      recordSyncHealthReceipt({ kind: "session-missing", source: "delta" });
      return;
    }

    isRunningRef.current = true;
    abortRef.current = new AbortController();

    try {
      const locked = await runWithSyncLeaderLock("delta-sync", async () => {
        dispatchAndSync({ type: "TRIGGER_DELTA" });

        const localSeq = await getLastSeq();
        if (localSeq === 0) {
          const result = await bootstrapSnapshotThenDelta(abortRef.current?.signal);
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
        const events = await fetchAllDeltas(lastSeq, abortRef.current?.signal);

        if (events.length === 0) {
          gapDetectorRef.current?.resetTo(lastSeq);
          dispatchAndSync({ type: "RESET", lastSeq });
          recordSyncHealthReceipt({ kind: "delta-empty", source: "delta", seq: lastSeq });
          return;
        }

        const deviceId = await getPersistentDeviceId();
        const applied = await applyDelta(events, deviceId);
        const maxSeq = events[events.length - 1].seq;

        logger.sync("[DeltaSync] Applied " + applied + " events, seq=" + maxSeq);
        dispatchAndSync({ type: "DELTA_SUCCESS", lastSeq: maxSeq });
        recordSyncHealthReceipt({
          kind: "delta-applied",
          source: "delta",
          fetched: events.length,
          applied,
          seq: maxSeq,
        });

        if (gapDetectorRef.current) {
          gapDetectorRef.current.resetTo(maxSeq);
        }
      });

      if (!locked.acquired) {
        logger.sync("[DeltaSync] Delta pull skipped; another tab is applying the cursor");
        recordSyncHealthReceipt({ kind: "leader-skipped", source: "delta" });
      }
    } catch (err) {
      if (isAbortError(err)) return;

      if (err instanceof Error && err.name === "QuotaExceededError") {
        logger.error("[DeltaSync] Storage full");
        dispatchAndSync({ type: "ERROR", retryDelayMs: 0 });
        return;
      }

      logger.error("[DeltaSync] Delta pull failed:", err);
      recordSyncHealthReceipt({
        kind: "error",
        source: "delta",
        errorName: err instanceof Error ? err.name : "UnknownError",
      });
      const delay = getRetryDelay(stateRef.current.consecutiveErrors);
      dispatchAndSync({ type: "ERROR", retryDelayMs: delay });

      retryTimerRef.current = setTimeout(() => {
        void runDeltaSyncRef.current();
      }, delay);
    } finally {
      isRunningRef.current = false;
      abortRef.current = null;
    }
  });

  const runSnapshotSyncRef = useRef(async () => {
    if (isRunningRef.current) return;
    if (!(await getCurrentSessionUserId())) {
      logger.sync("[DeltaSync] Snapshot skipped; no authenticated session");
      return;
    }
    isRunningRef.current = true;
    dispatchAndSync({ type: "SNAPSHOT_START" });

    try {
      await pullFromCloud();
      const serverMax = await getServerMaxSeq();
      dispatchAndSync({ type: "SNAPSHOT_SUCCESS", lastSeq: serverMax });
      recordSyncHealthReceipt({ kind: "snapshot-applied", source: "delta", seq: serverMax });

      if (gapDetectorRef.current) {
        gapDetectorRef.current.resetTo(serverMax);
      }

      logger.sync("[DeltaSync] Snapshot complete, seq=" + serverMax);
    } catch (err) {
      logger.error("[DeltaSync] Snapshot failed:", err);
      const delay = getRetryDelay(stateRef.current.consecutiveErrors);
      dispatchAndSync({ type: "ERROR", retryDelayMs: delay });
    } finally {
      isRunningRef.current = false;
    }
  });

  useEffect(() => {
    if (!isDeltaSyncEnabled) return;

    gapDetectorRef.current = new SyncGapDetector(stateRef.current.lastSeq, {
      gapWaitMs: GAP_WAIT_MS,
      maxGapSize: MAX_GAP_SIZE,
      onFallbackToSnapshot: () => void runSnapshotSyncRef.current(),
      onPullRange: async (fromSeq: number) => {
        const events = await fetchAllDeltas(fromSeq, abortRef.current?.signal);
        if (events.length > 0) {
          const deviceId = await getPersistentDeviceId();
          await applyDelta(events, deviceId);
          const maxSeq = events[events.length - 1].seq;
          gapDetectorRef.current?.resetTo(maxSeq);
          dispatchAndSync({ type: "RESET", lastSeq: maxSeq });
          recordSyncHealthReceipt({
            kind: "gap-recovered",
            source: "delta",
            fetched: events.length,
            seq: maxSeq,
          });
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
      if (session?.user) {
        void runDeltaSyncRef.current();
        return;
      }

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
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
      6500,
    );

    return () => {
      isMounted = false;
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
      if (gapDetectorRef.current) gapDetectorRef.current.destroy();
    };
  }, [isDeltaSyncEnabled]);
}
