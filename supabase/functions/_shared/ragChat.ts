import { buildRagPromptSection, formatRagContext, type RagChunk } from "./rag.ts";

export interface RagConversationMessage {
  role: string;
  content: string;
}

export interface GeminiTextPart {
  text: string;
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiTextPart[];
}

export interface BuildRagChatContentsOptions {
  systemPrompt: string;
  triggerPrompt: string;
  trustedUserContext: string;
  ragChunks: RagChunk[];
  conversationHistory: RagConversationMessage[];
  currentMessage: string;
  acknowledgement?: string;
}

export function buildRagChatContents(options: BuildRagChatContentsOptions): GeminiContent[] {
  const promptText = [
    options.systemPrompt,
    options.triggerPrompt,
    buildRagPromptSection(),
    `Trusted app user context:\n${options.trustedUserContext}`,
    `Retrieved project context:\n${formatRagContext(options.ragChunks)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    {
      role: "user",
      parts: [{ text: promptText }],
    },
    {
      role: "model",
      parts: [{ text: options.acknowledgement ?? "Понял. Готов помочь." }],
    },
    ...options.conversationHistory.slice(-10).map((message) => ({
      role: message.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: message.content }],
    })),
    {
      role: "user",
      parts: [{ text: options.currentMessage }],
    },
  ];
}
