import { useEffect } from "react";
import { offlineQueue } from "@/lib/offlineQueue";
import { storageGetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import {
  installSyncHealthRecorder,
  recordSyncHealthReceipt,
  SYNC_HEALTH_RECEIPT_EVENT,
  updateSyncHealthSnapshot,
  type SyncHealthAuthState,
  type SyncHealthQueueSnapshot,
} from "@/observability/syncHealthRecorder";

function currentRoute(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function readQueueSnapshot(): SyncHealthQueueSnapshot {
  const state = offlineQueue.getState();
  return {
    pending: state.actions.length,
    criticalPending: state.actions.filter((action) => action.priority === "critical").length,
    processing: state.isProcessing,
    lastProcessedAt: state.lastProcessedAt,
  };
}

async function readAuthState(): Promise<SyncHealthAuthState> {
  try {
    const { getCurrentSessionUserId } = await import("@/lib/supabaseClient");
    return (await getCurrentSessionUserId()) ? "authenticated" : "anonymous";
  } catch {
    return "unknown";
  }
}

async function readLastSeq(): Promise<number> {
  const { getLastSeq } = await import("@/storage/eventSync");
  return getLastSeq();
}

/**
 * Privacy-safe sync diagnostics for support and release proof.
 *
 * This does not expose user content, entity ids, journal text, habit names, or
 * payloads. It only reports route, online/auth state, queue counts, cursor seq,
 * and coarse-grained sync receipts.
 */
export function useSyncHealthRuntime(): void {
  useEffect(() => {
    const installed = installSyncHealthRecorder(
      window.location.search,
      storageGetRaw(SK.SYNC_HEALTH_RECORDER, ""),
      import.meta.env.DEV,
    );
    if (!installed) return;

    let mounted = true;

    const refresh = async () => {
      try {
        await offlineQueue.waitForInit();
        const [auth, lastSeq] = await Promise.all([readAuthState(), readLastSeq()]);
        if (!mounted) return;
        updateSyncHealthSnapshot({
          route: currentRoute(),
          online: navigator.onLine,
          auth,
          lastSeq,
          queue: readQueueSnapshot(),
        });
      } catch (err) {
        recordSyncHealthReceipt({
          kind: "error",
          source: "runtime",
          errorName: err instanceof Error ? err.name : "UnknownError",
        });
      }
    };

    const unsubscribeQueue = offlineQueue.subscribe(() => {
      void refresh();
    });
    const handleOnline = () => void refresh();
    const handleOffline = () => void refresh();
    const handleReceipt = () => void refresh();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(SYNC_HEALTH_RECEIPT_EVENT, handleReceipt);

    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);

    return () => {
      mounted = false;
      unsubscribeQueue();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(SYNC_HEALTH_RECEIPT_EVENT, handleReceipt);
      window.clearInterval(interval);
    };
  }, []);
}
