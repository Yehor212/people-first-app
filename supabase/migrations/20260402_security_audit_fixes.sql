-- Security Audit Fixes — 2026-04-02
-- Findings: 1 HIGH, 3 MEDIUM, 2 LOW (SQL-side)
-- Rollback: DROP and recreate functions without auth checks (not recommended)

-- HIGH: match_journal_entries() IDOR — any authenticated user could search another's journal embeddings
-- Fix: add auth.uid() ownership check (same pattern as get_user_stats, calculate_streak)
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
  -- IDOR fix: only allow querying own journal embeddings
  IF match_user_id != (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: cannot search other user journal entries'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

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

-- LOW: journal_embeddings RLS uses auth.uid() instead of optimized (select auth.uid())
-- Fix: drop old policy, create optimized version
DROP POLICY IF EXISTS "Users can read own embeddings" ON public.journal_embeddings;
CREATE POLICY "Users can read own embeddings"
  ON public.journal_embeddings FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own embeddings" ON public.journal_embeddings;
CREATE POLICY "Users can insert own embeddings"
  ON public.journal_embeddings FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own embeddings" ON public.journal_embeddings;
CREATE POLICY "Users can delete own embeddings"
  ON public.journal_embeddings FOR DELETE
  USING ((select auth.uid()) = user_id);

-- LOW: check_feedback_rate_limit() is unused — drop it
DROP FUNCTION IF EXISTS public.check_feedback_rate_limit(TEXT);
