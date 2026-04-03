/**
 * AI Coach Service
 * Handles HTTP communication with the AI Coach edge function.
 * Pure service — no React hooks or state.
 */

import { supabase } from "@/lib/supabaseClient";
import { SUPABASE_URL } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface AICoachRequest {
  message: string;
  context: object;
  language: string;
  trigger: string | null;
  conversationHistory: Array<{ role: string; content: string }>;
}

export interface AICoachResponse {
  reply: string;
}

/**
 * Send a message to the AI Coach edge function.
 * Handles auth token retrieval and request formatting.
 */
export async function sendAICoachMessage(
  request: AICoachRequest,
  signal?: AbortSignal
): Promise<AICoachResponse> {
  if (!supabase) {
    throw new Error("Not authenticated");
  }

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) {
    throw new Error("Not authenticated");
  }

  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not configured");
  }

  logger.log("[AICoach] Sending message to edge function");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-coach`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})); // graceful: response may not be JSON (e.g. 502 proxy error)
    throw new Error(errorData.error || "API error");
  }

  const data = await response.json().catch(() => {
    throw new Error("Invalid JSON response from AI Coach");
  });
  return { reply: data.message || "" };
}
