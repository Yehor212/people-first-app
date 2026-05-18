import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  DEVICE_SESSION_HEARTBEAT_INTERVAL_MS,
  upsertCurrentDeviceSession,
} from "@/storage/deviceSessions";
import { recordSyncHealthReceipt } from "@/observability/syncHealthRecorder";

/**
 * Account-device presence for Telegram-grade sync.
 *
 * This heartbeat is intentionally delayed until after first paint and only
 * stores coarse metadata. It does not store user-agent strings, IPs, payloads,
 * journal text, habit names, or other content.
 */
export function useDeviceSessionRuntime(): void {
  useEffect(() => {
    if (!supabase || typeof window === "undefined") return;

    let disposed = false;
    let lastHeartbeatAt = 0;
    let pending: Promise<void> | null = null;

    const runHeartbeat = (reason: Parameters<typeof upsertCurrentDeviceSession>[0]) => {
      if (disposed) return;
      const now = Date.now();
      const isForced = reason === "auth" || reason === "manual";
      if (!isForced && now - lastHeartbeatAt < DEVICE_SESSION_HEARTBEAT_INTERVAL_MS) return;
      if (pending) return;

      pending = upsertCurrentDeviceSession(reason)
        .then((session) => {
          if (session) {
            lastHeartbeatAt = Date.now();
            recordSyncHealthReceipt({
              kind: "processed",
              source: "runtime",
              actionType: "UPDATE_SETTINGS",
            });
          }
        })
        .catch((err) => {
          recordSyncHealthReceipt({
            kind: "error",
            source: "runtime",
            errorName: err instanceof Error ? err.name : "DeviceSessionError",
          });
        })
        .finally(() => {
          pending = null;
        });
    };

    const mountTimer = window.setTimeout(() => runHeartbeat("mount"), 1500);

    const handleOnline = () => runHeartbeat("online");
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        runHeartbeat("visible");
      }
    };
    const handleFocus = () => runHeartbeat("resume");

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        runHeartbeat("auth");
      }
    });

    return () => {
      disposed = true;
      window.clearTimeout(mountTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      authSubscription.subscription.unsubscribe();
    };
  }, []);
}
