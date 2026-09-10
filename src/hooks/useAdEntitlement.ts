import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { deriveCurrentProductAdEntitlement, type AdEntitlement } from "@/lib/adEligibility";
import { loadCurrentProductAdEntitlement } from "@/lib/adEntitlementSource";
import { disableAds } from "@/lib/adController";
import { isAndroid, isNative } from "@/lib/platform";
import { IS_ADMOB_QA_TEST_MODE, IS_DEV } from "@/lib/env";
import { supabase } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";
import {
  ACCOUNT_BOUNDARY_WRITERS_RESUMED_EVENT,
  ACCOUNT_BOUNDARY_WRITERS_SUSPENDED_EVENT,
  areAccountBoundaryWritersSuspended,
  getAccountBoundaryWritersEpoch,
} from "@/lib/accountBoundaryState";

const ENTITLEMENT_REQUEST_TIMEOUT_MS = 8_000;
const ENTITLEMENT_LEASE_MS = 5 * 60_000;

interface EntitlementLease {
  entitlement: AdEntitlement;
  boundaryEpoch: number;
  validUntil: number;
}

interface AdEntitlementResolution {
  entitlement: AdEntitlement;
  revision: number;
}

export function useAdEntitlement(input: {
  enabled: boolean;
  accountBoundaryInProgress: boolean;
}): AdEntitlementResolution {
  const supported = isNative && isAndroid && (!IS_DEV || IS_ADMOB_QA_TEST_MODE);
  const [lease, setLease] = useState<EntitlementLease | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (
      !supported ||
      !input.enabled ||
      input.accountBoundaryInProgress ||
      IS_ADMOB_QA_TEST_MODE ||
      !supabase
    ) {
      setLease(null);
      return;
    }

    let disposed = false;
    let generation = 0;
    let request: AbortController | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let nativeListener: { remove: () => Promise<void> } | undefined;
    let nativeListenerReady = false;
    let appActive = true;
    let signedOut = false;
    let sessionOwner: string | null | undefined;

    const invalidate = () => {
      generation += 1;
      // Native work must lose its epoch before a batched React render. The
      // public revision also forces a fresh SDK handshake if React coalesces
      // an unknown -> free transition for the same or a different account.
      disableAds();
      request?.abort();
      request = undefined;
      if (deadline !== undefined) clearTimeout(deadline);
      if (scheduled !== undefined) clearTimeout(scheduled);
      if (expiry !== undefined) clearTimeout(expiry);
      deadline = scheduled = expiry = undefined;
      if (!disposed) {
        setLease(null);
        setRevision((current) => current + 1);
      }
    };

    const canRead = () =>
      !disposed &&
      !signedOut &&
      nativeListenerReady &&
      appActive &&
      document.visibilityState !== "hidden" &&
      navigator.onLine !== false &&
      !areAccountBoundaryWritersSuspended();

    const refresh = () => {
      invalidate();
      if (!canRead()) return;
      const currentGeneration = generation;
      const boundaryEpoch = getAccountBoundaryWritersEpoch();
      const controller = new AbortController();
      request = controller;
      deadline = setTimeout(() => {
        if (disposed || generation !== currentGeneration) return;
        invalidate();
        logger.warn("[Ads] Account entitlement timed out; ads remain disabled");
      }, ENTITLEMENT_REQUEST_TIMEOUT_MS);

      void loadCurrentProductAdEntitlement(controller.signal)
        .then((snapshot) => {
          if (disposed || generation !== currentGeneration || controller.signal.aborted) return;
          if (deadline !== undefined) clearTimeout(deadline);
          deadline = undefined;
          request = undefined;
          if (!snapshot || !canRead() || boundaryEpoch !== getAccountBoundaryWritersEpoch()) return;
          sessionOwner = snapshot.accountId;
          setLease({
            entitlement: snapshot.entitlement,
            boundaryEpoch,
            validUntil: Date.now() + ENTITLEMENT_LEASE_MS,
          });
          expiry = setTimeout(refresh, ENTITLEMENT_LEASE_MS);
        })
        .catch(() => {
          if (disposed || generation !== currentGeneration) return;
          invalidate();
          logger.warn("[Ads] Account entitlement unavailable; ads remain disabled");
        });
    };

    // Supabase auth callbacks must remain synchronous. Defer client calls
    // outside their auth lock, and coalesce simultaneous resume notifications.
    const scheduleRefresh = () => {
      invalidate();
      if (canRead()) scheduled = setTimeout(refresh, 0);
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (disposed) return;
      if (event === "SIGNED_OUT" || event === "PASSWORD_RECOVERY" || !session?.user.id) {
        signedOut = true;
        sessionOwner = null;
        invalidate();
        return;
      }
      const nextOwner = session.user.id;
      const ownerChanged = nextOwner !== sessionOwner;
      signedOut = false;
      sessionOwner = nextOwner;
      if (
        ownerChanged ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        scheduleRefresh();
      }
    });

    void App.addListener("appStateChange", ({ isActive }) => {
      if (disposed || appActive === isActive) return;
      appActive = isActive;
      scheduleRefresh();
    })
      .then((handle) => {
        if (disposed) {
          void handle
            .remove()
            .catch(() => logger.warn("[Ads] Entitlement lifecycle cleanup failed"));
          return;
        }
        nativeListener = handle;
        nativeListenerReady = true;
        scheduleRefresh();
      })
      .catch(() => {
        nativeListenerReady = false;
        invalidate();
        logger.warn("[Ads] Entitlement lifecycle unavailable; ads remain disabled");
      });

    document.addEventListener("visibilitychange", scheduleRefresh);
    window.addEventListener("online", scheduleRefresh);
    window.addEventListener("offline", invalidate);
    window.addEventListener(ACCOUNT_BOUNDARY_WRITERS_SUSPENDED_EVENT, invalidate);
    window.addEventListener(ACCOUNT_BOUNDARY_WRITERS_RESUMED_EVENT, scheduleRefresh);
    return () => {
      disposed = true;
      invalidate();
      subscription.unsubscribe();
      void nativeListener
        ?.remove()
        .catch(() => logger.warn("[Ads] Entitlement lifecycle cleanup failed"));
      document.removeEventListener("visibilitychange", scheduleRefresh);
      window.removeEventListener("online", scheduleRefresh);
      window.removeEventListener("offline", invalidate);
      window.removeEventListener(ACCOUNT_BOUNDARY_WRITERS_SUSPENDED_EVENT, invalidate);
      window.removeEventListener(ACCOUNT_BOUNDARY_WRITERS_RESUMED_EVENT, scheduleRefresh);
    };
  }, [input.accountBoundaryInProgress, input.enabled, supported]);

  if (!supported || !input.enabled) return { entitlement: "unknown", revision };
  const entitlement = deriveCurrentProductAdEntitlement({
    accountBoundaryInProgress:
      input.accountBoundaryInProgress || areAccountBoundaryWritersSuspended(),
    qaTestEligibility: IS_ADMOB_QA_TEST_MODE,
    serverEntitlement:
      lease &&
      lease.boundaryEpoch === getAccountBoundaryWritersEpoch() &&
      lease.validUntil > Date.now()
        ? lease.entitlement
        : "unknown",
  });
  return { entitlement, revision };
}
