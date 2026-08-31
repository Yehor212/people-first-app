BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SET LOCAL statement_timeout = '5s';

SELECT plan(37);

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000172', 'authenticated', 'authenticated', 't172-creator@example.invalid', '', clock_timestamp(), '{}', '{}', clock_timestamp(), clock_timestamp()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000173', 'authenticated', 'authenticated', 't172-joiner@example.invalid', '', clock_timestamp(), '{}', '{}', clock_timestamp(), clock_timestamp()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000174', 'authenticated', 'authenticated', 't172-outsider@example.invalid', '', clock_timestamp(), '{}', '{}', clock_timestamp(), clock_timestamp()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000175', 'authenticated', 'authenticated', 't172-rate@example.invalid', '', clock_timestamp(), '{}', '{}', clock_timestamp(), clock_timestamp()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000176', 'authenticated', 'authenticated', 't172-retention@example.invalid', '', clock_timestamp(), '{}', '{}', clock_timestamp(), clock_timestamp()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000177', 'authenticated', 'authenticated', 't172-stale@example.invalid', '', clock_timestamp(), '{}', '{}', clock_timestamp(), clock_timestamp()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000178', 'authenticated', 'authenticated', 't172-cascade@example.invalid', '', clock_timestamp(), '{}', '{}', clock_timestamp(), clock_timestamp())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.friend_challenges (
  id,
  code,
  creator_id,
  habit_name,
  habit_icon,
  duration,
  start_date,
  end_date,
  status
)
VALUES
  ('00000000-0000-4000-8000-000000000182', 'ZEN-ABC234', '00000000-0000-4000-8000-000000000172', 'Synthetic T172 Habit', 'T', 7, CURRENT_DATE, CURRENT_DATE + 7, 'active'),
  ('00000000-0000-4000-8000-000000000183', 'ZEN-BCD345', '00000000-0000-4000-8000-000000000172', 'Synthetic Expired Habit', 'T', 7, CURRENT_DATE - 14, CURRENT_DATE - 7, 'expired'),
  ('00000000-0000-4000-8000-000000000184', 'ZEN-CDE456', '00000000-0000-4000-8000-000000000172', 'Synthetic Creator Habit', 'T', 7, CURRENT_DATE, CURRENT_DATE + 7, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.friend_challenge_members (challenge_id, user_id, display_name)
VALUES
  ('00000000-0000-4000-8000-000000000182', '00000000-0000-4000-8000-000000000172', 'Creator'),
  ('00000000-0000-4000-8000-000000000183', '00000000-0000-4000-8000-000000000172', 'Creator')
ON CONFLICT (challenge_id, user_id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000173';

SELECT lives_ok(
  $$SELECT count(*) FROM public.friend_challenge_members WHERE challenge_id = '00000000-0000-4000-8000-000000000182'$$,
  'an authenticated pre-join member read does not recurse'
);
SELECT results_eq(
  $$SELECT count(*)::bigint FROM public.friend_challenge_members WHERE challenge_id = '00000000-0000-4000-8000-000000000182'$$,
  $$VALUES (0::bigint)$$,
  'an unjoined user cannot see challenge members'
);

RESET ROLE;
RESET "request.jwt.claim.sub";
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000172';

SELECT results_eq(
  $$SELECT code FROM public.friend_challenges WHERE id = '00000000-0000-4000-8000-000000000184'$$,
  $$VALUES ('ZEN-CDE456'::text)$$,
  'a creator can see a challenge without relying on membership'
);

RESET ROLE;
RESET "request.jwt.claim.sub";
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000174';

SELECT results_eq(
  $$SELECT code FROM public.friend_challenges WHERE id = '00000000-0000-4000-8000-000000000182'$$,
  $$SELECT NULL::text WHERE false$$,
  'an outsider cannot see a challenge'
);

RESET ROLE;
RESET "request.jwt.claim.sub";

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'is_friend_challenge_participant'
      AND pg_get_function_identity_arguments(procedure.oid) = 'p_challenge_id uuid'
  ),
  'the non-recursive participant predicate exists'
);
SELECT ok(
  COALESCE((
    SELECT procedure.prosecdef
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'is_friend_challenge_participant'
      AND pg_get_function_identity_arguments(procedure.oid) = 'p_challenge_id uuid'
  ), false),
  'the participant predicate bypasses member RLS as a security definer'
);
SELECT ok(
  COALESCE((
    SELECT 'search_path=""' = ANY (procedure.proconfig)
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'is_friend_challenge_participant'
      AND pg_get_function_identity_arguments(procedure.oid) = 'p_challenge_id uuid'
  ), false),
  'the participant predicate has an empty search path'
);
SELECT ok(
  COALESCE((
    SELECT has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'is_friend_challenge_participant'
      AND pg_get_function_identity_arguments(procedure.oid) = 'p_challenge_id uuid'
  ), false),
  'authenticated policy evaluation can execute the participant predicate'
);
SELECT ok(
  NOT COALESCE((
    SELECT has_function_privilege('anon', procedure.oid, 'EXECUTE')
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'is_friend_challenge_participant'
      AND pg_get_function_identity_arguments(procedure.oid) = 'p_challenge_id uuid'
  ), true),
  'anonymous callers cannot execute the participant predicate'
);
SELECT is(
  (SELECT roles::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friend_challenge_members' AND policyname = 'friend_challenge_members_select'),
  '{authenticated}',
  'member visibility is authenticated-only'
);
SELECT ok(
  (SELECT qual LIKE '%is_friend_challenge_participant%' FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friend_challenge_members' AND policyname = 'friend_challenge_members_select'),
  'member visibility delegates to the non-recursive predicate'
);
SELECT ok(
  (SELECT qual NOT LIKE '%FROM friend_challenge_members%' FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friend_challenge_members' AND policyname = 'friend_challenge_members_select'),
  'member visibility does not query its own RLS table'
);
SELECT ok(
  (SELECT qual LIKE '%creator_id%' AND qual LIKE '%is_friend_challenge_participant%'
   FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'friend_challenges' AND policyname = 'friend_challenges_select'),
  'challenge visibility remains creator-or-participant only'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.friend_challenges', 'SELECT')
    AND has_table_privilege('authenticated', 'public.friend_challenge_members', 'SELECT'),
  'authenticated participant reads have the minimum table grants required before RLS'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.friend_challenge_join_attempts', 'SELECT'),
  'authenticated callers cannot read private rate-limit state'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.friend_challenge_join_attempts', 'SELECT'),
  'anonymous callers cannot read private rate-limit state'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'friend_challenge_join_attempts_retention_idx'),
  'rate-limit retention has an indexed cleanup path'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000173';

SELECT results_eq(
  $$SELECT code, habit_name, habit_icon, duration, start_date FROM public.join_friend_challenge_by_code('ZEN-ABC234')$$,
  $$VALUES ('ZEN-ABC234'::text, 'Synthetic T172 Habit'::text, 'T'::text, 7::integer, CURRENT_DATE::date)$$,
  'a valid code atomically joins and returns the minimal preview'
);

RESET ROLE;
RESET "request.jwt.claim.sub";

SELECT is(
  (SELECT count(*)::bigint FROM public.friend_challenge_members WHERE challenge_id = '00000000-0000-4000-8000-000000000182' AND user_id = '00000000-0000-4000-8000-000000000173'),
  1::bigint,
  'the valid join creates exactly one membership'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000173';

SELECT results_eq(
  $$SELECT code FROM public.friend_challenges WHERE id = '00000000-0000-4000-8000-000000000182'$$,
  $$VALUES ('ZEN-ABC234'::text)$$,
  'the joined participant can see the challenge'
);
SELECT results_eq(
  $$SELECT count(*)::bigint FROM public.friend_challenge_members WHERE challenge_id = '00000000-0000-4000-8000-000000000182'$$,
  $$VALUES (2::bigint)$$,
  'the joined participant can see challenge members'
);
SELECT results_eq(
  $$SELECT code, habit_name, habit_icon, duration, start_date FROM public.join_friend_challenge_by_code('ZEN-ABC234')$$,
  $$VALUES ('ZEN-ABC234'::text, 'Synthetic T172 Habit'::text, 'T'::text, 7::integer, CURRENT_DATE::date)$$,
  'a repeated valid join is idempotent and still returns the preview'
);

RESET ROLE;
RESET "request.jwt.claim.sub";

SELECT is(
  (SELECT count(*)::bigint FROM public.friend_challenge_members WHERE challenge_id = '00000000-0000-4000-8000-000000000182' AND user_id = '00000000-0000-4000-8000-000000000173'),
  1::bigint,
  'an idempotent join does not duplicate membership'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000174';

SELECT results_eq(
  $$SELECT code FROM public.friend_challenges WHERE id = '00000000-0000-4000-8000-000000000182'$$,
  $$SELECT NULL::text WHERE false$$,
  'the joined challenge remains hidden from an outsider'
);
SELECT results_eq(
  $$SELECT id FROM public.friend_challenge_members WHERE challenge_id = '00000000-0000-4000-8000-000000000182'$$,
  $$SELECT NULL::uuid WHERE false$$,
  'participant identities remain hidden from an outsider'
);
SELECT results_eq(
  $$SELECT code FROM public.join_friend_challenge_by_code('not-a-code')$$,
  $$SELECT NULL::text WHERE false$$,
  'an invalid code returns the uniform empty shape'
);

RESET ROLE;
RESET "request.jwt.claim.sub";

SELECT is(
  (SELECT count(*)::bigint FROM public.friend_challenge_join_attempts WHERE user_id = '00000000-0000-4000-8000-000000000174'),
  0::bigint,
  'an invalid code does not consume retained rate-limit state'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000174';

SELECT results_eq(
  $$SELECT code FROM public.join_friend_challenge_by_code('ZEN-DEF567')$$,
  $$SELECT NULL::text WHERE false$$,
  'a missing code returns the uniform empty shape'
);
SELECT results_eq(
  $$SELECT code FROM public.join_friend_challenge_by_code('ZEN-BCD345')$$,
  $$SELECT NULL::text WHERE false$$,
  'an expired code returns the uniform empty shape'
);

RESET ROLE;
RESET "request.jwt.claim.sub";

SELECT is(
  (SELECT attempt_count FROM public.friend_challenge_join_attempts WHERE user_id = '00000000-0000-4000-8000-000000000174'),
  2,
  'missing and expired valid-format probes share one bounded rate counter'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000175';

DO $$
BEGIN
  FOR attempt IN 1..10 LOOP
    PERFORM * FROM public.join_friend_challenge_by_code('ZEN-EFG678');
  END LOOP;
END;
$$;
SELECT results_eq(
  $$SELECT code FROM public.join_friend_challenge_by_code('ZEN-ABC234')$$,
  $$SELECT NULL::text WHERE false$$,
  'the eleventh attempt is uniformly rate-limited even for a valid code'
);

RESET ROLE;
RESET "request.jwt.claim.sub";

SELECT is(
  (SELECT count(*)::bigint FROM public.friend_challenge_members WHERE challenge_id = '00000000-0000-4000-8000-000000000182' AND user_id = '00000000-0000-4000-8000-000000000175'),
  0::bigint,
  'a rate-limited valid code cannot create membership'
);
SELECT is(
  (SELECT attempt_count FROM public.friend_challenge_join_attempts WHERE user_id = '00000000-0000-4000-8000-000000000175'),
  11,
  'the bounded rate counter caps at the terminal value'
);

INSERT INTO public.friend_challenge_join_attempts (user_id, window_started_at, attempt_count)
VALUES
  ('00000000-0000-4000-8000-000000000176', clock_timestamp() - INTERVAL '10 minutes', 10),
  ('00000000-0000-4000-8000-000000000177', clock_timestamp() - INTERVAL '2 days', 4);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000176';

SELECT results_eq(
  $$SELECT code FROM public.join_friend_challenge_by_code('ZEN-ABC234')$$,
  $$VALUES ('ZEN-ABC234'::text)$$,
  'an expired rate window resets and permits a valid join'
);

RESET ROLE;
RESET "request.jwt.claim.sub";

SELECT is(
  (SELECT count(*)::bigint FROM public.friend_challenge_join_attempts WHERE user_id = '00000000-0000-4000-8000-000000000177'),
  0::bigint,
  'lazy retention removes rate rows older than one day'
);
SELECT ok(
  (SELECT attempt_count = 1 AND window_started_at > clock_timestamp() - INTERVAL '1 minute'
   FROM public.friend_challenge_join_attempts
   WHERE user_id = '00000000-0000-4000-8000-000000000176'),
  'an expired caller window resets to one recent attempt'
);

INSERT INTO public.friend_challenge_join_attempts (user_id, window_started_at, attempt_count)
VALUES ('00000000-0000-4000-8000-000000000178', clock_timestamp(), 1);
DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-000000000178';

SELECT is(
  (SELECT count(*)::bigint FROM public.friend_challenge_join_attempts WHERE user_id = '00000000-0000-4000-8000-000000000178'),
  0::bigint,
  'auth-account deletion cascade-clears retained rate state'
);

SELECT * FROM finish();
ROLLBACK;
