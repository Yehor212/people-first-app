/**
 * Claude Managed Agent — Client service
 *
 * Calls the `claude-agent` Supabase Edge Function which proxies
 * to Claude's API with agentic tools (web search, code execution).
 *
 * Usage:
 *   import { askAgent } from '@/lib/claudeAgent';
 *
 *   const result = await askAgent({
 *     prompt: 'Find latest mindfulness research and summarize key findings',
 *     tools: ['web_search'],
 *   });
 *   logger.log(result.message);
 */

import { supabase } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";

// --- Types ---

export type AgentTool = "web_search" | "code_execution" | "web_fetch";

export type AgentModel =
  | "claude-sonnet-4-6-20250514"
  | "claude-haiku-4-5-20251001"
  | "claude-opus-4-6-20250630";

export interface AgentQueryOptions {
  /** The prompt/instruction for the agent */
  prompt: string;
  /** Which tools the agent can use (default: ['web_search']) */
  tools?: AgentTool[];
  /** Model to use (default: claude-sonnet-4-6) */
  model?: AgentModel;
  /** Max agentic turns (1-10, default: 5) */
  maxTurns?: number;
  /** Optional system prompt to guide behavior */
  systemPrompt?: string;
}

export interface AgentResponse {
  /** The agent's final text response */
  message: string;
  /** How many turns the agent took */
  turns: number;
  /** Summary of tools used */
  toolResults: Array<{ tool: string; summary: string }>;
  /** Model used */
  model: string;
}

// --- Main API ---

/**
 * Send a prompt to the Claude Managed Agent.
 *
 * @example
 * const result = await askAgent({
 *   prompt: 'What are the latest studies on habit formation?',
 *   tools: ['web_search'],
 * });
 *
 * @example
 * const result = await askAgent({
 *   prompt: 'Analyze this breathing pattern data',
 *   tools: ['web_search', 'code_execution'],
 *   systemPrompt: 'You are a wellness research assistant.',
 *   maxTurns: 8,
 * });
 */
export async function askAgent(options: AgentQueryOptions): Promise<AgentResponse> {
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  const { prompt, tools = ["web_search"], model, maxTurns = 5, systemPrompt } = options;

  if (!prompt.trim()) {
    throw new Error("prompt is required");
  }

  const { data, error } = await supabase.functions.invoke("claude-agent", {
    body: {
      action: "query",
      prompt,
      tools,
      model,
      maxTurns,
      systemPrompt,
    },
  });

  if (error) {
    logger.log("[ClaudeAgent] Edge function error:", error.message);
    throw new Error(error.message || "Agent request failed");
  }

  if (data?.error) {
    logger.log("[ClaudeAgent] Agent error:", data.error);
    throw new Error(data.error);
  }

  return data as AgentResponse;
}

/**
 * Pre-configured agent for wellness/mindfulness research.
 * Uses web_search to find evidence-based answers.
 */
export async function askWellnessAgent(
  prompt: string,
  language: string = "en"
): Promise<AgentResponse> {
  const systemPrompts: Record<string, string> = {
    en: "You are a wellness research assistant for ZenFlow, a mindfulness and habit tracking app. Provide evidence-based answers with citations. Keep responses concise (3-5 paragraphs max).",
    ru: "Ты — исследовательский ассистент по велнесу для ZenFlow, приложения осознанности и отслеживания привычек. Давай ответы на основе доказательств с источниками. Отвечай кратко (максимум 3-5 абзацев).",
    uk: "Ти — дослідницький асистент з велнесу для ZenFlow, застосунку усвідомленості та відстеження звичок. Давай відповіді на основі доказів з джерелами. Відповідай стисло (максимум 3-5 абзаців).",
  };

  return askAgent({
    prompt,
    tools: ["web_search"],
    systemPrompt: systemPrompts[language] || systemPrompts.en,
    maxTurns: 3,
  });
}

/**
 * Agent with code_execution for data analysis
 * (mood patterns, habit correlations, etc).
 */
export async function askAnalysisAgent(
  prompt: string,
  data: Record<string, unknown>
): Promise<AgentResponse> {
  return askAgent({
    prompt: `Analyze this user data and ${prompt}\n\nData:\n${JSON.stringify(data, null, 2)}`,
    tools: ["code_execution"],
    systemPrompt:
      "You are a data analyst for a wellness app. Analyze patterns in mood, habits, and behavioral data. Provide actionable insights. Never store or transmit raw user data externally.",
    maxTurns: 5,
  });
}
