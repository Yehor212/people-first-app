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

function getFirstIncompleteHabitName(context: object): string {
  const maybeContext = context as { habits?: Array<{ name?: string; completedToday?: boolean }> };
  const habits = Array.isArray(maybeContext.habits) ? maybeContext.habits : [];
  const incomplete = habits.find((habit) => habit?.completedToday === false);
  return incomplete?.name || habits[0]?.name || "your next habit";
}

function buildClientCoachLiteReply(request: AICoachRequest): string {
  const habitName = getFirstIncompleteHabitName(request.context);

  if (request.language === "ru") {
    return `Coach Lite (бесплатный локальный режим): уменьши "${habitName}" до микро-шага, даже 1 минута считается. Какой самый маленький следующий шаг ты можешь сделать сегодня?`;
  }

  if (request.language === "uk") {
    return `Coach Lite (безкоштовний локальний режим): зменш "${habitName}" до мікрокроку, навіть 1 хвилина рахується. Який найменший наступний крок ти можеш зробити сьогодні?`;
  }

  return `Coach Lite (free local mode): make ${habitName} tiny today, even 1 minute counts. What is the smallest next step you can do before the day ends?`;
}

function isMissingPaidAiConfigError(errorMessage: string): boolean {
  return errorMessage === "AI service not configured";
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
    const errorMessage = typeof errorData.error === "string" ? errorData.error : "API error";

    if (isMissingPaidAiConfigError(errorMessage)) {
      logger.warn("[AICoach] Paid AI provider is not configured; using Coach Lite fallback");
      return { reply: buildClientCoachLiteReply(request) };
    }

    throw new Error(errorMessage);
  }

  const data = await response.json().catch(() => {
    throw new Error("Invalid JSON response from AI Coach");
  });
  return { reply: data.message || "" };
}
