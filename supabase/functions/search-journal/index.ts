/**
 * Authenticated lexical search over the signed-in user's journal entries.
 * No journal content or query is sent to an external AI provider.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { getCorsHeaders, parseJsonBody } from "../_shared/http.ts";
import { requireJournalAiConsent } from "../_shared/journal_ai_consent.ts";
import { searchJournalEntriesLexically } from "../_shared/journal_ai_free.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

interface SearchRequest {
  query?: unknown;
  limit?: unknown;
}

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
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return jsonResponse(401, { error: "Invalid token" });
  if (!checkRateLimit(user.id)) return jsonResponse(429, { error: "Too many requests" });

  const consent = await requireJournalAiConsent(supabase, user.id);
  if (!consent.allowed) return jsonResponse(consent.status, { error: consent.code });

  try {
    const [body, bodyError] = await parseJsonBody<SearchRequest>(req, origin);
    if (bodyError) return bodyError;
    if (typeof body.query !== "string" || !body.query.trim()) {
      return jsonResponse(400, { error: "Query is required" });
    }
    if (body.query.length > 2_000) {
      return jsonResponse(400, { error: "Query too long (max 2000 chars)" });
    }

    const requestedLimit = typeof body.limit === "number" ? body.limit : 10;
    const safeLimit = Math.min(50, Math.max(1, Math.floor(requestedLimit)));
    const { data: entries, error } = await supabase
      .from("journal_entries")
      .select("id, title, content, mood, tags, updated_at, created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[SearchJournal] Lexical search fetch failed", { code: error.code });
      return jsonResponse(500, { error: "Search failed" });
    }

    return jsonResponse(200, {
      results: searchJournalEntriesLexically(entries || [], body.query.trim(), safeLimit),
      mode: "journal_search_free_lexical",
      externalProvider: false,
      requiresPaidApi: false,
    });
  } catch (error) {
    console.error("[SearchJournal] Search failed", error instanceof Error ? error.name : "error");
    return jsonResponse(500, { error: "Internal error" });
  }
});
