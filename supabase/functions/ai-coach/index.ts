/**
 * Authenticated Coach Lite endpoint.
 * Responses are generated deterministically without an external AI provider.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { getCorsHeaders, parseJsonBody } from "../_shared/http.ts";
import { redactError, redactUserRef } from "../_shared/redaction.ts";
import { buildCoachLiteResponse } from "../_shared/coach_lite.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;
const MAX_MESSAGE_LENGTH = 2_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

interface CoachRequest {
  message?: unknown;
  context?: Record<string, unknown>;
  language?: string;
  trigger?: string;
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
  if (authError || !user) {
    console.warn("[CoachLite] Invalid token", redactError(authError));
    return jsonResponse(401, { error: "Invalid token" });
  }
  if (!checkRateLimit(user.id)) {
    console.warn(`[CoachLite] Rate limit exceeded for ${redactUserRef(user.id)}`);
    return jsonResponse(429, { error: "Too many requests. Please wait a minute." });
  }

  const [body, bodyError] = await parseJsonBody<CoachRequest>(req, origin);
  if (bodyError) return bodyError;
  if (typeof body.message !== "string" || !body.message.trim()) {
    return jsonResponse(400, { error: "Message is required" });
  }
  if (body.message.length > MAX_MESSAGE_LENGTH) {
    return jsonResponse(400, {
      error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`,
    });
  }

  const coachLite = buildCoachLiteResponse({
    message: body.message,
    context: body.context,
    language: body.language,
    trigger: body.trigger,
  });
  return jsonResponse(200, {
    message: coachLite.message,
    mode: coachLite.mode,
    requiresPaidApi: coachLite.requiresPaidApi,
    sources: coachLite.sources,
    externalProvider: false,
  });
});
