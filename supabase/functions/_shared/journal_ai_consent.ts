import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

export type JournalAiConsentCheck =
  | { allowed: true }
  | {
      allowed: false;
      status: 403 | 503;
      code: "JOURNAL_AI_CONSENT_REQUIRED" | "JOURNAL_AI_CONSENT_CHECK_UNAVAILABLE";
    };

export async function requireJournalAiConsent(
  supabase: SupabaseClient,
  userId: string,
): Promise<JournalAiConsentCheck> {
  const { data, error } = await supabase
    .from("journal_ai_consents")
    .select("granted_at, revoked_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[JournalAIConsent] Consent check unavailable", { code: error.code });
    return {
      allowed: false,
      status: 503,
      code: "JOURNAL_AI_CONSENT_CHECK_UNAVAILABLE",
    };
  }

  if (!data?.granted_at || data.revoked_at) {
    return {
      allowed: false,
      status: 403,
      code: "JOURNAL_AI_CONSENT_REQUIRED",
    };
  }

  return { allowed: true };
}
