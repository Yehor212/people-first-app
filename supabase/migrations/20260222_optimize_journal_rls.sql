-- Migration: Optimize journal RLS policies for Supabase Performance Advisor
-- Date: 2026-02-22
-- Fixes:
--   1. Multiple Permissive Policies (4 per table → 1 FOR ALL)
--   2. Auth RLS Initialization Plan (auth.uid() → (select auth.uid()))
-- Pattern: Matches 20260204_optimize_rls_policies.sql convention

BEGIN;

-- ============================================================
-- journal_entries: DROP 4 old policies, CREATE 1 optimized
-- ============================================================
DROP POLICY IF EXISTS "Users can view own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can insert own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can update own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can delete own journal entries" ON public.journal_entries;

CREATE POLICY "journal_entries_all" ON public.journal_entries FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================
-- journal_photos: DROP 4 old policies, CREATE 1 optimized
-- ============================================================
DROP POLICY IF EXISTS "Users can view own journal photos" ON public.journal_photos;
DROP POLICY IF EXISTS "Users can insert own journal photos" ON public.journal_photos;
DROP POLICY IF EXISTS "Users can update own journal photos" ON public.journal_photos;
DROP POLICY IF EXISTS "Users can delete own journal photos" ON public.journal_photos;

CREATE POLICY "journal_photos_all" ON public.journal_photos FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================
-- journal_audio: DROP 4 old policies, CREATE 1 optimized
-- ============================================================
DROP POLICY IF EXISTS "Users can view own journal audio" ON public.journal_audio;
DROP POLICY IF EXISTS "Users can insert own journal audio" ON public.journal_audio;
DROP POLICY IF EXISTS "Users can update own journal audio" ON public.journal_audio;
DROP POLICY IF EXISTS "Users can delete own journal audio" ON public.journal_audio;

CREATE POLICY "journal_audio_all" ON public.journal_audio FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================
-- journal_embeddings: DROP 4 old policies, CREATE 1 optimized
-- ============================================================
DROP POLICY IF EXISTS "Users can read own embeddings" ON public.journal_embeddings;
DROP POLICY IF EXISTS "Users can insert own embeddings" ON public.journal_embeddings;
DROP POLICY IF EXISTS "Users can update own embeddings" ON public.journal_embeddings;
DROP POLICY IF EXISTS "Users can delete own embeddings" ON public.journal_embeddings;

CREATE POLICY "journal_embeddings_all" ON public.journal_embeddings FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

COMMIT;
