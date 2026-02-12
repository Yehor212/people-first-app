-- Fix user_profiles RLS: security (anonymous access) + performance (auth.uid() per-row)
-- Addresses 4 Supabase Linter issues:
--   1 security: SELECT USING (true) allows anonymous access
--   3 performance: auth.uid() evaluated per-row instead of once

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.user_profiles;

-- Recreate with fixes:
-- SELECT: auth.role() = 'authenticated' (blocks anonymous, allows cross-user reads for friends)
-- INSERT/UPDATE/DELETE: (select auth.uid()) subquery for performance (evaluated once per query)

CREATE POLICY "user_profiles_select" ON public.user_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "user_profiles_insert" ON public.user_profiles
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "user_profiles_update" ON public.user_profiles
  FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "user_profiles_delete" ON public.user_profiles
  FOR DELETE USING (user_id = (select auth.uid()));
