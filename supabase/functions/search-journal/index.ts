/**
 * Supabase Edge Function: Search Journal
 *
 * Performs semantic search over journal entries using pgvector.
 * Generates an embedding for the search query via Gemini,
 * then uses cosine similarity to find matching entries.
 *
 * Required secrets:
 *   - GEMINI_API_KEY
 *   - SUPABASE_URL
 *   - SUPABASE_ANON_KEY
 *
 * Request body:
 *   - query: string — the search text
 *   - limit?: number — max results (default 10)
 *   - threshold?: number — min similarity 0..1 (default 0.3)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ORIGINS = [
  "https://yehor212.github.io",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
  "http://localhost:5173",
  "http://localhost:8100",
  "null",
];

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMS = 768;

// Rate limit: 20 searches per minute per user
const RATE_LIMIT = 20;
const RATE_WINDOW = 60000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetAt) rateLimitMap.delete(key);
    }
  }
  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (userLimit.count >= RATE_LIMIT) return false;
  userLimit.count++;
  return true;
}

const getCorsHeaders = (origin: string | null) => {
  const effectiveOrigin = origin || "null";
  const isAllowed = ALLOWED_ORIGINS.includes(effectiveOrigin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? effectiveOrigin : "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
};

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Gemini embedding API error: ${response.status} ${errText}`
    );
  }

  const result = await response.json();
  const values = result?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Unexpected embedding dimensions: got ${values?.length}, expected ${EMBEDDING_DIMS}`
    );
  }
  return values;
}

// ============================================
// HANDLER
// ============================================

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
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonResponse(401, { error: "Invalid token" });
  }

  if (!checkRateLimit(user.id)) {
    return jsonResponse(429, { error: "Too many requests" });
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse(500, { error: "Gemini API not configured" });
  }

  try {
    const body = await req.json();
    const { query, limit = 10, threshold = 0.3 } = body;

    if (!query || typeof query !== "string") {
      return jsonResponse(400, { error: "Query is required" });
    }

    if (query.length > 2000) {
      return jsonResponse(400, { error: "Query too long (max 2000 chars)" });
    }

    // 1. Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query.trim());

    // 2. Search via pgvector using the match function
    const { data, error } = await supabase.rpc("match_journal_entries", {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_user_id: user.id,
      match_threshold: Math.max(0, Math.min(1, threshold)),
      match_count: Math.min(50, Math.max(1, limit)),
    });

    if (error) {
      console.error("[SearchJournal] RPC error:", error);
      return jsonResponse(500, { error: "Search failed" });
    }

    console.log(
      `[SearchJournal] Found ${data?.length || 0} results for user ${user.id}`
    );

    return jsonResponse(200, { results: data || [] });
  } catch (error) {
    console.error("[SearchJournal] Error:", error);
    return jsonResponse(500, { error: "Internal error" });
  }
});
