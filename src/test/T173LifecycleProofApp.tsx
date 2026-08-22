import { useCallback, useEffect, useState } from "react";
import { SplashScreen } from "@capacitor/splash-screen";

import {
  advanceT173LifecycleScenario,
  cleanupT173LifecycleScenario,
  initializeT173LifecycleScenario,
  readT173LifecycleStatus,
  reopenT173Database,
  retainCorruptT173LifecycleMarker,
  type T173LifecycleStatus,
} from "./t173LifecycleScenario";

const emptyStatus: T173LifecycleStatus = {
  stage: "BEFORE_PRIMARY_COMMIT",
  primaryCount: 0,
  ownerOutboxCount: 0,
  unrelatedOwnerOutboxCount: 0,
  remoteSubmissionCount: 0,
  acknowledgementCount: 0,
  tombstoneCount: 0,
  staleCallbacksRejected: 0,
  duplicateCallbacksIgnored: 0,
  staleResponsesRejected: 0,
  ownerBoundary: "FAIL",
  exactlyOnce: "GREEN",
  deletionFence: "PENDING",
  online: navigator.onLine,
};

export function T173LifecycleProofApp() {
  const [status, setStatus] = useState<T173LifecycleStatus>(emptyStatus);
  const [runtimeCode, setRuntimeCode] = useState("T173_READY");
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (operation: () => Promise<T173LifecycleStatus | void>) => {
    setBusy(true);
    setRuntimeCode("T173_RUNNING");
    try {
      const result = await operation();
      if (result) setStatus(result);
      setRuntimeCode("T173_OK");
    } catch (error) {
      setRuntimeCode(error instanceof Error ? error.message : "T173_UNKNOWN_FAILURE");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void SplashScreen.hide();
    if (import.meta.env.VITE_T173_LIFECYCLE_AUTOSTEP === "true") {
      void run(async () => {
        try {
          return await advanceT173LifecycleScenario();
        } catch (error) {
          if (error instanceof Error && error.message === "T173_SCENARIO_NOT_INITIALIZED") {
            return initializeT173LifecycleScenario();
          }
          throw error;
        }
      });
    } else {
      void readT173LifecycleStatus()
        .then((current) => {
          setStatus(current);
          setRuntimeCode("T173_RELAUNCH_RECOVERED");
        })
        .catch(() => setRuntimeCode("T173_NOT_INITIALIZED"));
    }
    const updateConnectivity = () => {
      void readT173LifecycleStatus().then(setStatus).catch(() => undefined);
    };
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, [run]);

  return (
    <main className="min-h-screen bg-background p-4 text-foreground" data-testid="t173-proof">
      <section className="mx-auto w-full max-w-2xl space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
        <header>
          <p className="text-sm font-semibold">T173 LOCAL LIFECYCLE PROOF</p>
          <h1 className="break-words text-2xl font-bold" data-testid="t173-stage">
            {status.stage}
          </h1>
          <p aria-live="polite" className="text-sm" data-testid="t173-runtime-code">
            {runtimeCode}
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-2 text-sm" data-testid="t173-counts">
          <div><dt>PRIMARY</dt><dd>{status.primaryCount}</dd></div>
          <div><dt>OUTBOX</dt><dd>{status.ownerOutboxCount}</dd></div>
          <div><dt>REMOTE SUBMISSION</dt><dd>{status.remoteSubmissionCount}</dd></div>
          <div><dt>ACK CURSOR</dt><dd>{status.acknowledgementCount}</dd></div>
          <div><dt>TOMBSTONE</dt><dd>{status.tombstoneCount}</dd></div>
          <div><dt>UNRELATED OWNER</dt><dd>{status.unrelatedOwnerOutboxCount}</dd></div>
          <div><dt>STALE CALLBACKS</dt><dd>{status.staleCallbacksRejected}</dd></div>
          <div><dt>DUPLICATES</dt><dd>{status.duplicateCallbacksIgnored}</dd></div>
          <div><dt>STALE RESPONSES</dt><dd>{status.staleResponsesRejected}</dd></div>
          <div><dt>NETWORK</dt><dd>{status.online ? "ONLINE" : "OFFLINE"}</dd></div>
        </dl>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="t173-assertions">
          <p>EXACTLY ONCE: {status.exactlyOnce}</p>
          <p>OWNER BOUNDARY: {status.ownerBoundary}</p>
          <p>DELETION FENCE: {status.deletionFence}</p>
          <p>VISUAL FRAME: LIVE</p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            className="min-h-11 rounded-lg border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2"
            disabled={busy}
            onClick={() => void run(initializeT173LifecycleScenario)}
            type="button"
          >
            Initialize
          </button>
          <button
            className="min-h-11 rounded-lg border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2"
            disabled={busy}
            onClick={() => void run(advanceT173LifecycleScenario)}
            type="button"
          >
            Advance
          </button>
          <button
            className="min-h-11 rounded-lg border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2"
            disabled={busy}
            onClick={() => void run(async () => {
              await reopenT173Database();
              return readT173LifecycleStatus();
            })}
            type="button"
          >
            Reopen storage
          </button>
          <button
            className="min-h-11 rounded-lg border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2"
            disabled={busy}
            onClick={() => void run(async () => {
              await retainCorruptT173LifecycleMarker();
            })}
            type="button"
          >
            Retain corrupt marker
          </button>
          <button
            className="min-h-11 rounded-lg border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 sm:col-span-2"
            disabled={busy}
            onClick={() => void run(async () => {
              await cleanupT173LifecycleScenario();
              setStatus(emptyStatus);
            })}
            type="button"
          >
            Clean fixture
          </button>
        </div>
      </section>
    </main>
  );
}
