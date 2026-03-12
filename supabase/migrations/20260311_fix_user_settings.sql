-- ==========================================================================
-- Migration: Fix user_settings schema for key-value pattern
-- Date: 2026-03-11
-- Problem: Production 400 on GET /rest/v1/user_settings
--          Code uses key-value (user_id, key, value) but table may have
--          column model (id, user_id, weekly_digest_enabled) from 20260125
-- Strategy: Idempotent — safe to run on any production state
-- ==========================================================================

-- ============================================
-- 1. ENSURE TABLE EXISTS
-- ============================================
-- If neither 001 nor 20260125 created the table, create with key-value schema
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);

-- ============================================
-- 2. ADD KEY-VALUE COLUMNS IF MISSING
-- ============================================
-- Handles column-model table (from 20260125) that lacks key/value columns
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS value JSONB;

-- ============================================
-- 3. DROP SINGLE-COLUMN UNIQUE ON user_id
-- ============================================
-- Column model (20260125) has UNIQUE(user_id) which blocks multiple settings per user.
-- Key-value model needs multiple rows per user_id (one per key).
-- Find and drop by constraint type, not name (name varies between migrations).
DO $$
DECLARE
  _cname TEXT;
BEGIN
  FOR _cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'user_settings'
      AND nsp.nspname = 'public'
      AND con.contype = 'u'  -- UNIQUE constraints only (not PK)
  LOOP
    EXECUTE format('ALTER TABLE public.user_settings DROP CONSTRAINT %I', _cname);
  END LOOP;
END $$;

-- ============================================
-- 4. CREATE COMPOSITE UNIQUE FOR UPSERT
-- ============================================
-- Code does: .upsert({user_id, key, value}, {onConflict: 'user_id,key'})
-- PostgREST needs a matching UNIQUE index for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_settings_user_key
  ON public.user_settings(user_id, key);

-- ============================================
-- 5. MIGRATE COLUMN-MODEL DATA TO KEY-VALUE
-- ============================================
-- If weekly_digest_enabled column exists (from 20260125), migrate rows
-- that don't have a key yet to key-value format
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'weekly_digest_enabled'
  ) THEN
    UPDATE public.user_settings
    SET key = 'weekly_digest_enabled',
        value = to_jsonb(COALESCE(weekly_digest_enabled, false))
    WHERE key IS NULL;
  END IF;
END $$;

-- ============================================
-- 6. RLS — ENSURE OPTIMIZED POLICY
-- ============================================
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Drop ALL known policy names from migration history
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can create own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_all" ON public.user_settings;

-- Single consolidated policy with (SELECT auth.uid()) for performance
CREATE POLICY "user_settings_all" ON public.user_settings FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- 7. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id
  ON public.user_settings(user_id);

-- ============================================
-- 8. AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_user_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_settings_timestamp ON public.user_settings;
CREATE TRIGGER user_settings_timestamp
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_timestamp();

-- ============================================
-- 9. RELOAD POSTGREST SCHEMA CACHE
-- ============================================
-- Critical: clears stale cache after schema/policy changes
-- Also resolves habits DELETE 400 from stale cache after 20260204 policy optimization
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 10. DIAGNOSTIC QUERIES (uncomment to verify)
-- ============================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'user_settings'
--   ORDER BY ordinal_position;
--
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'user_settings';
--
-- SELECT policyname, cmd, qual, with_check
--   FROM pg_policies WHERE tablename = 'user_settings';
