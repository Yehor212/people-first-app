/**
 * Journal AI — Client-side helpers for semantic search
 *
 * Uses Supabase Edge Functions:
 *   - generate-embedding: creates vector embeddings for journal entries
 *   - search-journal: semantic search via pgvector
 */

import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';

export interface SemanticSearchResult {
  entry_id: string;
  similarity: number;
}

/**
 * Trigger embedding generation for specific journal entries.
 * Fire-and-forget — errors are logged but not thrown.
 */
export async function generateEmbeddings(entryIds: string[]): Promise<void> {
  if (!supabase || !entryIds.length) return;

  try {
    const { error } = await supabase.functions.invoke('generate-embedding', {
      body: { entryIds },
    });
    if (error) {
      logger.log('[JournalAI] Embedding generation skipped:', error.message);
    }
  } catch (err) {
    logger.log('[JournalAI] Embedding generation failed:', err);
  }
}

/**
 * Semantic search through journal entries.
 * Returns entry IDs sorted by semantic similarity.
 */
export async function searchJournalSemantic(
  query: string,
  limit: number = 10,
  threshold: number = 0.3,
): Promise<SemanticSearchResult[]> {
  if (!supabase || !query.trim()) return [];

  const { data, error } = await supabase.functions.invoke('search-journal', {
    body: { query, limit, threshold },
  });

  if (error) {
    logger.warn('[JournalAI] Semantic search failed:', error.message);
    throw error;
  }

  return (data?.results || []) as SemanticSearchResult[];
}

/**
 * Generate embeddings for all entries that don't have them yet.
 * Called on first AI search activation to backfill.
 * Returns number of entries processed.
 */
export async function generateAllMissingEmbeddings(): Promise<number> {
  if (!supabase) return 0;

  try {
    const { data, error } = await supabase.functions.invoke('generate-embedding', {
      body: {},
    });

    if (error) {
      logger.warn('[JournalAI] Batch embedding failed:', error.message);
      return 0;
    }

    return data?.processed || 0;
  } catch (err) {
    logger.warn('[JournalAI] Batch embedding error:', err);
    return 0;
  }
}
