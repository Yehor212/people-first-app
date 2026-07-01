import { ensureRagCitations, toRagSources, type RagSource } from "./rag.ts";
import { buildRagChatContents, type GeminiContent, type RagConversationMessage } from "./ragChat.ts";
import type { RagChunk } from "./rag.ts";

export type RetrieveAICoachChunks = (message: string) => Promise<RagChunk[]>;
export type GenerateAICoachReply = (contents: GeminiContent[]) => Promise<string>;

export interface AICoachRagResponse {
  message: string;
  sources: RagSource[];
}

export interface BuildAICoachRagResponseOptions {
  message: string;
  systemPrompt: string;
  triggerPrompt: string;
  trustedUserContext: string;
  conversationHistory: RagConversationMessage[];
  retrieveChunks: RetrieveAICoachChunks;
  generateReply: GenerateAICoachReply;
  fallbackContents: GeminiContent[];
}

export async function buildAICoachRagResponse(
  options: BuildAICoachRagResponseOptions,
): Promise<AICoachRagResponse> {
  const ragChunks = await options.retrieveChunks(options.message);

  if (ragChunks.length === 0) {
    const fallbackMessage = await options.generateReply(options.fallbackContents);
    if (!fallbackMessage.trim()) {
      throw new Error("Empty AI response");
    }
    return { message: fallbackMessage.trim(), sources: [] };
  }

  const contents = buildRagChatContents({
    systemPrompt: options.systemPrompt,
    triggerPrompt: options.triggerPrompt,
    trustedUserContext: options.trustedUserContext,
    ragChunks,
    conversationHistory: options.conversationHistory,
    currentMessage: options.message,
  });

  const modelMessage = await options.generateReply(contents);
  const message = ensureRagCitations(modelMessage, ragChunks);

  if (!message.trim()) {
    throw new Error("Empty AI response");
  }

  return {
    message,
    sources: toRagSources(ragChunks),
  };
}
