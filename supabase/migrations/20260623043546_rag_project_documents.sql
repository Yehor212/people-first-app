-- Recover live Supabase migration history for project-document RAG.
-- Live migration history: 20260623043546 / rag_project_documents
-- Live evidence: public.rag_chunks is a service-owned project docs index with 0 rows and no user_id.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.rag_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  title text NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  content_hash text NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  indexed_at timestamp with time zone NOT NULL DEFAULT now(),
  embedding extensions.vector(768) NOT NULL
);

ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rag_chunks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.rag_chunks TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS rag_chunks_source_chunk_index_key
  ON public.rag_chunks (source, chunk_index);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_source
  ON public.rag_chunks (source);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_content_hash
  ON public.rag_chunks (content_hash);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
  ON public.rag_chunks USING hnsw (embedding vector_cosine_ops);

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
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: project RAG search requires authentication'
      USING ERRCODE = '42501';
  END IF;

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

REVOKE ALL ON FUNCTION public.match_rag_chunks(extensions.vector, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_rag_chunks(extensions.vector, double precision, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
