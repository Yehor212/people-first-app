import type { AdEntitlement } from "@/lib/adEligibility";
import { z } from "zod";
import { getCurrentUser, getVerifiedCurrentSessionUserId, supabase } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";

const AndroidBannerPolicySchema = z
  .object({
    version: z.literal(1),
    enabled: z.boolean(),
    model: z.literal("free_with_banner"),
  })
  .strict();

export interface CurrentProductAdEntitlement {
  accountId: string;
  entitlement: AdEntitlement;
}

export async function loadCurrentProductAdEntitlement(
  signal: AbortSignal
): Promise<CurrentProductAdEntitlement | null> {
  if (!supabase || signal.aborted) return null;

  try {
    const accountId = await getVerifiedCurrentSessionUserId();
    if (!accountId || signal.aborted) return null;
    const user = await getCurrentUser();
    if (!user || user.id !== accountId || signal.aborted) return null;

    // app_config writes are service-role-only. This declares the current
    // product model; it does not invent a subscription or purchase record.
    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "android_banner_policy")
      .abortSignal(signal)
      .maybeSingle();
    if (signal.aborted) return null;
    if (error) {
      logger.warn("[Ads] Banner policy unavailable; ads remain disabled");
      return null;
    }
    const parsed = AndroidBannerPolicySchema.safeParse(data?.value);
    if (!parsed.success || !parsed.data.enabled) return null;

    // Only fresh server-owned app_metadata can override the product default.
    // Never consult user_metadata for account entitlement.
    const override: unknown = user.app_metadata?.ad_entitlement;
    if (override !== undefined && override !== "free" && override !== "premium") return null;
    const currentAccountId = await getVerifiedCurrentSessionUserId();
    if (signal.aborted || currentAccountId !== accountId) return null;

    return { accountId, entitlement: override === "premium" ? "premium" : "free" };
  } catch {
    if (!signal.aborted) {
      logger.warn("[Ads] Account entitlement unavailable; ads remain disabled");
    }
    return null;
  }
}
