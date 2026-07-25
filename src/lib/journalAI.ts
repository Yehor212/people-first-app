/**
 * Account-backed private journal search.
 *
 * The server performs lexical matching inside the user's Supabase account.
 * No embedding index is created and no external AI provider receives content.
 */

import { supabase } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";

export interface SemanticSearchResult {
  entry_id: string;
  similarity: number;
}

// Retained for older call sites; lexical search needs no entry upload or index.
export async function generateEmbeddings(_entryIds: string[]): Promise<void> {
  return Promise.resolve();
}

export async function searchJournalSemantic(
  query: string,
  limit: number = 10,
  _threshold: number = 0.3,
): Promise<SemanticSearchResult[]> {
  if (!supabase || !query.trim()) return [];

  const { data, error } = await supabase.functions.invoke("search-journal", {
    body: { query, limit },
  });
  if (error) {
    logger.warn("[JournalSearch] Private search failed:", error.message);
    throw error;
  }
  return (data?.results || []) as SemanticSearchResult[];
}

// Retained for older clients; no indexing is performed in lexical mode.
export async function generateAllMissingEmbeddings(): Promise<number> {
  return 0;
}
