-- =============================================
-- Migration: Data Integrity — triggers + deprecation + pgvector
-- Created: 2026-03-14
-- Applied via Supabase MCP (already live)
-- Fixes: D1 (journal_embeddings), D2 (match_journal_entries), D3 (triggers), D4 (deprecation)
-- =============================================

-- D1+D2: pgvector + journal embeddings for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.journal_embeddings (
  entry_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding vector(768) NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own embeddings"
  ON public.journal_embeddings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own embeddings"
  ON public.journal_embeddings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own embeddings"
  ON public.journal_embeddings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own embeddings"
  ON public.journal_embeddings FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON public.journal_embeddings TO authenticated;

CREATE INDEX IF NOT EXISTS idx_journal_embeddings_user_id ON public.journal_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_embeddings_hnsw ON public.journal_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_journal_entries(
  query_embedding vector(768),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10
)
RETURNS TABLE (entry_id TEXT, similarity FLOAT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT je.entry_id, (1 - (je.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.journal_embeddings je
  WHERE je.user_id = match_user_id
    AND (1 - (je.embedding <=> query_embedding)) > match_threshold
  ORDER BY je.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

REVOKE ALL ON FUNCTION match_journal_entries(vector(768), UUID, FLOAT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_journal_entries(vector(768), UUID, FLOAT, INT) TO authenticated;

-- D3: Add missing updated_at triggers
CREATE TRIGGER set_updated_at_user_inner_world
  BEFORE UPDATE ON public.user_inner_world FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_user_profiles
  BEFORE UPDATE ON public.user_profiles FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_user_reminder_settings
  BEFORE UPDATE ON public.user_reminder_settings FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- D4: Mark orphaned tables as deprecated
COMMENT ON TABLE public.challenges IS 'DEPRECATED v1.7: Superseded by user_challenges (20260113). DROP planned for v2.0';
COMMENT ON TABLE public.badges IS 'DEPRECATED v1.7: Superseded by user_badges (20260113). DROP planned for v2.0';
COMMENT ON TABLE public.user_data IS 'DEPRECATED v1.7: Replaced by user_backups (002_user_backups_safe). DROP planned for v2.0';
COMMENT ON TABLE public.user_stats IS 'DEPRECATED v1.7: Stats computed via get_user_stats() RPC. DROP planned for v2.0';
COMMENT ON TABLE public.adhd_state IS 'DEPRECATED v1.7: State managed client-side in Zustand. DROP planned for v2.0';
COMMENT ON TABLE public.mystery_boxes IS 'DEPRECATED v1.7: Feature removed. DROP planned for v2.0';
COMMENT ON TABLE public.time_challenges IS 'DEPRECATED v1.7: Replaced by user_challenges. DROP planned for v2.0';
