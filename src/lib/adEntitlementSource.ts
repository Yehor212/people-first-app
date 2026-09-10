import type { AdEntitlement } from "@/lib/adEligibility";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";

const AndroidBannerPolicySchema = z
  .object({
    version: z.literal(1),
    enabled: z.boolean(),
    model: z.literal("free_with_banner"),
  })
  .strict();

const AccountIdSchema = z.string().uuid();
const VerifiedAdAccountSchema = z.object({
  id: AccountIdSchema,
  app_metadata: z.record(z.unknown()).optional(),
  is_anonymous: z.boolean().optional(),
});

export interface CurrentProductAdEntitlement {
  accountId: string;
  entitlement: AdEntitlement;
}

export async function loadCurrentProductAdEntitlement(
  signal: AbortSignal
): Promise<CurrentProductAdEntitlement | null> {
  const client = supabase;
  if (!client || signal.aborted) return null;

  // A session supplies only the owner to compare. Authorization still needs
  // the fresh Auth server response below; an email address is not required.
  const readSessionAccountId = async (): Promise<string | null> => {
    const { data, error } = await client.auth.getSession();
    if (error) return null;
    const parsed = AccountIdSchema.safeParse(data?.session?.user?.id);
    return parsed.success ? parsed.data : null;
  };

  try {
    const accountId = await readSessionAccountId();
    if (!accountId || signal.aborted) return null;
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || signal.aborted) return null;
    const verified = VerifiedAdAccountSchema.safeParse(authData?.user);
    if (
      !verified.success ||
      verified.data.id !== accountId ||
      verified.data.is_anonymous === true
    ) {
      return null;
    }
    const user = verified.data;

    // app_config writes are service-role-only. This declares the current
    // product model; it does not invent a subscription or purchase record.
    const { data, error } = await client
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
    const currentAccountId = await readSessionAccountId();
    if (signal.aborted || currentAccountId !== accountId) return null;

    return { accountId, entitlement: override === "premium" ? "premium" : "free" };
  } catch {
    if (!signal.aborted) {
      logger.warn("[Ads] Account entitlement unavailable; ads remain disabled");
    }
    return null;
  }
}
