/**
 * Supabase Edge Function: Generate Embedding
 *
 * Generates vector embeddings for journal entries using Gemini API.
 * Stores embeddings in journal_embeddings table for semantic search.
 *
 * Required secrets:
 *   - GEMINI_API_KEY: same key used by ai-coach
 *   - SUPABASE_URL
 *   - SUPABASE_ANON_KEY
 *
 * Request body:
 *   - entryIds?: string[] — specific entries to embed (max 20)
 *   - If omitted, processes all entries missing embeddings
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
const MAX_BATCH_SIZE = 20;

// Rate limit: 30 requests per minute per user
const RATE_LIMIT = 30;
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
    "Access-Control-Allow-Origin": isAllowed ? effectiveOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
};

// ============================================
// HELPERS
// ============================================

async function computeContentHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface EntryRow {
  id: string;
  title: string;
  content: string;
  mood: string | null;
  tags: string[] | null;
}

function buildEmbeddingText(entry: EntryRow): string {
  const parts: string[] = [];
  if (entry.title) parts.push(entry.title);
  if (entry.content) parts.push(entry.content);
  if (entry.mood) parts.push(`Mood: ${entry.mood}`);
  if (entry.tags?.length) parts.push(`Tags: ${entry.tags.join(", ")}`);
  return parts.join("\n").slice(0, 10000);
}

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

async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
        })),
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Gemini batch embedding API error: ${response.status} ${errText}`
    );
  }

  const result = await response.json();
  return result.embeddings.map((e: { values: number[] }) => e.values);
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
    const entryIds: string[] | undefined = body.entryIds;

    // 1. Fetch entries from DB
    let entriesQuery = supabase
      .from("journal_entries")
      .select("id, title, content, mood, tags")
      .eq("user_id", user.id);

    if (entryIds?.length) {
      entriesQuery = entriesQuery.in("id", entryIds.slice(0, MAX_BATCH_SIZE));
    } else {
      // When no specific IDs, limit to batch size
      entriesQuery = entriesQuery.limit(100);
    }

    const { data: entries, error: fetchError } = await entriesQuery;
    if (fetchError) {
      console.error("[GenerateEmbedding] Fetch error:", fetchError);
      return jsonResponse(500, { error: "Failed to fetch entries" });
    }
    if (!entries?.length) {
      return jsonResponse(200, { processed: 0 });
    }

    // 2. Get existing hashes to skip unchanged content
    const { data: existing } = await supabase
      .from("journal_embeddings")
      .select("entry_id, content_hash")
      .in(
        "entry_id",
        entries.map((e: EntryRow) => e.id)
      );

    const hashMap = new Map(
      (existing || []).map(
        (e: { entry_id: string; content_hash: string }) => [e.entry_id, e.content_hash]
      )
    );

    // 3. Filter to entries needing new/updated embeddings
    const toProcess: { entry: EntryRow; text: string; hash: string }[] = [];
    for (const entry of entries as EntryRow[]) {
      const text = buildEmbeddingText(entry);
      if (!text.trim()) continue; // Skip empty entries
      const hash = await computeContentHash(text);
      if (hashMap.get(entry.id) !== hash) {
        toProcess.push({ entry, text, hash });
      }
      if (toProcess.length >= MAX_BATCH_SIZE) break;
    }

    if (toProcess.length === 0) {
      return jsonResponse(200, { processed: 0, upToDate: true });
    }

    // 4. Generate embeddings via Gemini
    const texts = toProcess.map((p) => p.text);
    const embeddings =
      texts.length === 1
        ? [await generateEmbedding(texts[0])]
        : await generateBatchEmbeddings(texts);

    // 5. Upsert to journal_embeddings
    const rows = toProcess.map((p, i) => ({
      entry_id: p.entry.id,
      user_id: user.id,
      embedding: `[${embeddings[i].join(",")}]`,
      content_hash: p.hash,
    }));

    const { error: upsertError } = await supabase
      .from("journal_embeddings")
      .upsert(rows, { onConflict: "entry_id" });

    if (upsertError) {
      console.error("[GenerateEmbedding] Upsert error:", upsertError);
      return jsonResponse(500, { error: "Failed to store embeddings" });
    }

    console.log(
      `[GenerateEmbedding] Processed ${toProcess.length} entries for user ${user.id}`
    );
    return jsonResponse(200, { processed: toProcess.length });
  } catch (error) {
    console.error("[GenerateEmbedding] Error:", error);
    return jsonResponse(500, { error: "Internal error" });
  }
});
