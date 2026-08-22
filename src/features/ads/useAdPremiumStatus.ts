import { useEffect, useState } from "react";

import type { AdPremiumStatus } from "@/lib/adController";
import { supabase } from "@/lib/supabaseClient";
import { getLocalDataOwnerId } from "@/storage/db";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { useAppStore } from "@/stores/appStore";

export const AD_ENTITLEMENT_APP_METADATA_KEY = "zenflow_ad_entitlement";

interface AdEntitlementUser {
  id: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

/**
 * Supabase app_metadata is server-controlled. User-editable user_metadata is
 * deliberately ignored so a client cannot declare itself free or premium.
 */
export function readAdPremiumStatusFromServerMetadata(
  user: AdEntitlementUser | null,
): AdPremiumStatus {
  const value = user?.app_metadata?.[AD_ENTITLEMENT_APP_METADATA_KEY];
  return value === "free" || value === "premium" ? value : "unknown";
}

async function resolveOwnerBoundStatus(
  user: AdEntitlementUser | null,
): Promise<AdPremiumStatus> {
  const metadataStatus = readAdPremiumStatusFromServerMetadata(user);
  if (!user || metadataStatus === "unknown") return "unknown";

  try {
    const activeOwnerUserId = await validateSyncOwner(
      user.id,
      "Rewarded-ad entitlement",
    );
    if (activeOwnerUserId !== user.id) return "unknown";

    const localOwnerUserId = await getLocalDataOwnerId();
    return localOwnerUserId === user.id ? metadataStatus : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Resolves the ad entitlement from the signed session and revalidates it at
 * every auth transition. Every pending, malformed, signed-out or owner-race
 * state is published as unknown before any asynchronous verification begins.
 */
export function useAdPremiumStatus(): AdPremiumStatus {
  const [status, setStatus] = useState<AdPremiumStatus>("unknown");
  const hasValidSession = useAppStore((state) => state.hasValidSession);
  const isAccountBoundaryInProgress = useAppStore(
    (state) => state.isAccountBoundaryInProgress,
  );
  const accountAdmitted =
    hasValidSession === true && !isAccountBoundaryInProgress;

  useEffect(() => {
    if (!supabase || !accountAdmitted) {
      setStatus("unknown");
      return;
    }

    let active = true;
    let authRevision = 0;

    const resolveSessionUser = (user: AdEntitlementUser | null) => {
      const revision = ++authRevision;
      setStatus("unknown");
      if (!user) return;

      void resolveOwnerBoundStatus(user).then((nextStatus) => {
        if (active && revision === authRevision) setStatus(nextStatus);
      });
    };

    const initialRevision = authRevision;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || authRevision !== initialRevision) return;
        resolveSessionUser(error ? null : (data.session?.user ?? null));
      })
      .catch(() => {
        if (active && authRevision === initialRevision) resolveSessionUser(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveSessionUser(session?.user ?? null);
    });

    return () => {
      active = false;
      authRevision += 1;
      subscription.unsubscribe();
    };
  }, [accountAdmitted]);

  return accountAdmitted ? status : "unknown";
}
