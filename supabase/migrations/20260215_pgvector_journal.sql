-- ============================================
-- pgvector extension + journal embeddings for semantic search
-- Phase 5 of Supabase Pro upgrade
-- ============================================

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Journal embeddings table
CREATE TABLE IF NOT EXISTS public.journal_embeddings (
  entry_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding vector(768) NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.journal_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own embeddings"
  ON public.journal_embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own embeddings"
  ON public.journal_embeddings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own embeddings"
  ON public.journal_embeddings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own embeddings"
  ON public.journal_embeddings FOR DELETE
  USING (auth.uid() = user_id);

-- Grants
GRANT ALL ON public.journal_embeddings TO authenticated;

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_journal_embeddings_user_id
  ON public.journal_embeddings(user_id);

-- HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_journal_embeddings_hnsw
  ON public.journal_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- Match function for semantic search via RPC
-- ============================================
CREATE OR REPLACE FUNCTION match_journal_entries(
  query_embedding vector(768),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  entry_id TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    je.entry_id,
    (1 - (je.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.journal_embeddings je
  WHERE je.user_id = match_user_id
    AND (1 - (je.embedding <=> query_embedding)) > match_threshold
  ORDER BY je.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
