-- Migration: Optimize journal + storage RLS policies for Supabase Performance Advisor
-- Date: 2026-02-22
-- Fixes ALL 21 advisor warnings:
--   1. Multiple Permissive Policies (4 per journal table → 1 FOR ALL)
--   2. Auth RLS Initialization Plan (auth.uid() → (select auth.uid()))
--   3. Storage policies (auth.uid()::text → (select auth.uid())::text)
-- Pattern: Matches 20260204_optimize_rls_policies.sql convention
-- NOTE: No BEGIN/COMMIT — Supabase SQL Editor auto-wraps; explicit tx caused
--       full rollback on journal_embeddings error in first attempt.

-- ============================================================
-- PART A: Journal tables (public schema)
-- ============================================================

-- journal_entries: drop ALL old policies → 1 optimized
DROP POLICY IF EXISTS "Users can view own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can insert own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can update own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can delete own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can manage their own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries_all" ON public.journal_entries;

CREATE POLICY "journal_entries_all" ON public.journal_entries FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- journal_photos: 4 old → 1 optimized
DROP POLICY IF EXISTS "Users can view own journal photos" ON public.journal_photos;
DROP POLICY IF EXISTS "Users can insert own journal photos" ON public.journal_photos;
DROP POLICY IF EXISTS "Users can update own journal photos" ON public.journal_photos;
DROP POLICY IF EXISTS "Users can delete own journal photos" ON public.journal_photos;
DROP POLICY IF EXISTS "journal_photos_all" ON public.journal_photos;

CREATE POLICY "journal_photos_all" ON public.journal_photos FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- journal_audio: 4 old → 1 optimized
DROP POLICY IF EXISTS "Users can view own journal audio" ON public.journal_audio;
DROP POLICY IF EXISTS "Users can insert own journal audio" ON public.journal_audio;
DROP POLICY IF EXISTS "Users can update own journal audio" ON public.journal_audio;
DROP POLICY IF EXISTS "Users can delete own journal audio" ON public.journal_audio;
DROP POLICY IF EXISTS "journal_audio_all" ON public.journal_audio;

CREATE POLICY "journal_audio_all" ON public.journal_audio FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- NOTE: journal_embeddings skipped — table does not exist on production

-- ============================================================
-- PART B: Storage policies (storage.objects)
-- Fix auth.uid()::text → (select auth.uid())::text
-- ============================================================

-- Drop old storage policies
DROP POLICY IF EXISTS "Users can upload own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own audio" ON storage.objects;

-- Recreate with (select auth.uid()) subquery for planner caching
CREATE POLICY "journal_photos_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "journal_photos_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "journal_photos_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "journal_audio_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "journal_audio_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "journal_audio_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
