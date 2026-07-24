/**
 * Legacy journal indexing endpoint.
 *
 * Journal search is lexical and does not require an embedding index. Keeping
 * this authenticated no-op preserves compatibility with older clients while
 * ensuring journal text never leaves ZenFlow for external AI processing.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { getCorsHeaders } from "../_shared/http.ts";
import { requireJournalAiConsent } from "../_shared/journal_ai_consent.ts";
import { redactUserRef } from "../_shared/redaction.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const current = rateLimitMap.get(userId);
  if (!current || now > current.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  const jsonResponse = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return jsonResponse(401, { error: "Invalid token" });
  if (!checkRateLimit(user.id)) return jsonResponse(429, { error: "Too many requests" });

  const consent = await requireJournalAiConsent(supabase, user.id);
  if (!consent.allowed) return jsonResponse(consent.status, { error: consent.code });

  console.log(`[GenerateEmbedding] Lexical mode active for ${redactUserRef(user.id)}`);
  return jsonResponse(200, {
    processed: 0,
    skipped: true,
    mode: "journal_search_free_lexical",
    externalProvider: false,
    requiresPaidApi: false,
  });
});
