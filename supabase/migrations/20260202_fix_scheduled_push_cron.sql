-- ============================================================
-- FIX: 401 Unauthorized on send-scheduled-push
-- ============================================================
-- ROOT CAUSE: Cron job calls Edge Function WITHOUT Authorization header
-- SOLUTION: Recreate cron job with proper headers using Vault
-- ============================================================

-- STEP 1: Check required extensions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension is not enabled. Enable it in Supabase Dashboard → Database → Extensions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net extension is not enabled. Enable it in Supabase Dashboard → Database → Extensions';
  END IF;
END $$;

-- STEP 2: View existing cron jobs (diagnostic)
-- Run this SELECT to see all existing jobs:
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname LIKE '%push%' OR command LIKE '%send-scheduled-push%';

-- STEP 3: Delete old broken cron job (if exists)
-- Replace JOB_ID with actual ID from step 2
-- SELECT cron.unschedule(JOB_ID);

-- Alternative: Delete by name pattern
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN
    SELECT jobid, jobname FROM cron.job
    WHERE jobname LIKE '%push%' OR command LIKE '%send-scheduled-push%'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
    RAISE NOTICE 'Unscheduled job: % (id: %)', job_record.jobname, job_record.jobid;
  END LOOP;
END $$;

-- ============================================================
-- STEP 4: Create new cron job with proper Authorization
-- ============================================================
--
-- OPTION A: Using SERVICE_ROLE_KEY directly (simpler, less secure)
-- Replace YOUR_SERVICE_ROLE_KEY with actual key from Supabase Dashboard → Settings → API
--
-- SELECT cron.schedule(
--   'send-scheduled-push-v2',
--   '*/15 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://bwgfslmxmueyglpumkbf.supabase.co/functions/v1/send-scheduled-push',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- ============================================================
-- OPTION B: Using Vault (RECOMMENDED - more secure)
-- ============================================================
-- First, add the service_role_key to Vault:
-- Supabase Dashboard → Settings → Vault → Add Secret
-- Name: service_role_key
-- Value: (your service_role key from Settings → API)

-- Then run this:
SELECT cron.schedule(
  'send-scheduled-push-v2',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bwgfslmxmueyglpumkbf.supabase.co/functions/v1/send-scheduled-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- STEP 5: Verify the new job was created
-- ============================================================
SELECT jobid, jobname, schedule,
       CASE WHEN command LIKE '%Authorization%' THEN 'HAS_AUTH' ELSE 'NO_AUTH' END as auth_status
FROM cron.job
WHERE jobname = 'send-scheduled-push-v2';

-- ============================================================
-- VERIFICATION CHECKLIST
-- ============================================================
-- [ ] pg_cron extension enabled
-- [ ] pg_net extension enabled
-- [ ] Old cron job deleted
-- [ ] service_role_key added to Vault
-- [ ] New cron job created with Authorization header
-- [ ] Edge Function logs show: hasAuthHeader: true
-- [ ] No more 401 errors in Supabase Logs
