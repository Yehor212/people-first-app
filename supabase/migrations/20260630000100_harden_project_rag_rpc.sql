-- Harden service-owned project RAG docs after V2-only release readiness review.
-- Live Supabase drift evidence:
-- - public.rag_chunks has row level security enabled but no policies.
-- - public.rag_chunks has no user_id and is treated as a service-owned project docs index.
-- - public.match_rag_chunks is a privileged definer RPC currently executable by authenticated.
-- Deploy the ai-coach server-side RAG client before applying this migration to keep coaching available.

DO $$
BEGIN
  IF to_regclass('public.rag_chunks') IS NOT NULL THEN
    ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.rag_chunks FROM PUBLIC, anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rag_chunks TO service_role;

    DROP POLICY IF EXISTS "rag_chunks_no_client_access" ON public.rag_chunks;
    CREATE POLICY "rag_chunks_no_client_access"
      ON public.rag_chunks
      FOR ALL
      TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.match_rag_chunks(
  query_embedding extensions.vector(768),
  match_threshold double precision DEFAULT 0.35,
  match_count integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  source text,
  title text,
  chunk_index integer,
  content text,
  content_hash text,
  updated_at timestamp with time zone,
  similarity double precision
)
LANGUAGE plpgsql
STABLE SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.source,
    rc.title,
    rc.chunk_index,
    rc.content,
    rc.content_hash,
    rc.updated_at,
    (1 - (rc.embedding <=> query_embedding))::double precision AS similarity
  FROM public.rag_chunks rc
  WHERE (1 - (rc.embedding <=> query_embedding)) > match_threshold
  ORDER BY rc.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 20);
END;
$function$;

REVOKE ALL ON FUNCTION public.match_rag_chunks(extensions.vector, double precision, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_rag_chunks(extensions.vector, double precision, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
