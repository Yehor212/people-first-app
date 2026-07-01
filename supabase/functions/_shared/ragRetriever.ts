import type { RagChunk } from "./rag.ts";

export interface RagMatchRow {
  id?: string;
  source: string;
  title: string;
  chunk_index: number;
  content: string;
  content_hash: string;
  updated_at: string;
  similarity: number;
}

export interface RagMatchRequest {
  queryEmbedding: number[];
  matchThreshold: number;
  matchCount: number;
}

export interface RetrieveRagChunksOptions {
  message: string;
  embedText: (text: string) => Promise<number[]>;
  matchChunks: (request: RagMatchRequest) => Promise<RagMatchRow[]>;
  matchThreshold: number;
  matchCount: number;
  onError?: (error: unknown) => void;
}

export function mapRagMatchRow(row: RagMatchRow): RagChunk {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    chunkIndex: row.chunk_index,
    content: row.content,
    contentHash: row.content_hash,
    updatedAt: row.updated_at,
    similarity: row.similarity,
  };
}

export async function retrieveRagChunks(options: RetrieveRagChunksOptions): Promise<RagChunk[]> {
  const query = options.message.trim();
  if (!query) return [];

  try {
    const queryEmbedding = await options.embedText(query);
    const rows = await options.matchChunks({
      queryEmbedding,
      matchThreshold: options.matchThreshold,
      matchCount: options.matchCount,
    });
    return rows.map(mapRagMatchRow);
  } catch (error) {
    options.onError?.(error);
    return [];
  }
}
