-- Android 2.1 connected-records ledger.
--
-- This migration is deliberately additive. Direct writes to automation state
-- remain private; authenticated clients use the owner-derived RPCs below.
-- Rollback is forward-only once any v11 client has written history: deploy a
-- v11-aware replacement that disables new commits before removing functions.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.automation_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  server_revision bigint NOT NULL DEFAULT 0 CHECK (server_revision >= 0),
  enabled boolean NOT NULL DEFAULT false,
  consent_epoch uuid,
  consented_at bigint CHECK (consented_at IS NULL OR consented_at >= 0),
  revoked_at bigint CHECK (revoked_at IS NULL OR revoked_at >= 0),
  enabled_rule_ids text[] NOT NULL DEFAULT '{}',
  focus_habit_id text,
  focus_minimum_minutes integer NOT NULL DEFAULT 25
    CHECK (focus_minimum_minutes BETWEEN 1 AND 1440),
  planning_habit_mappings jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(planning_habit_mappings) = 'object'),
  updated_at bigint NOT NULL CHECK (updated_at >= 0),
  CHECK (
    (enabled AND consent_epoch IS NOT NULL AND consented_at IS NOT NULL AND revoked_at IS NULL)
    OR
    (NOT enabled AND consent_epoch IS NULL)
  )
);

CREATE TABLE public.automation_history_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  history_generation bigint NOT NULL DEFAULT 1 CHECK (history_generation > 0),
  last_sequence bigint NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  record_revision_version bigint NOT NULL DEFAULT 0
    CHECK (record_revision_version >= 0),
  all_history_purged_at bigint CHECK (all_history_purged_at IS NULL OR all_history_purged_at >= 0),
  updated_at bigint NOT NULL CHECK (updated_at >= 0)
);

CREATE TABLE public.automation_transactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_epoch uuid NOT NULL,
  source_key text NOT NULL CHECK (source_key ~ '^sha256:[a-f0-9]{64}$'),
  rule_id text NOT NULL CHECK (rule_id IN (
    'mood.note-to-journal.v1',
    'journal.mood-to-checkin.v1',
    'focus.to-mapped-habit.v1',
    'habit.to-planning.v1'
  )),
  rule_version integer NOT NULL CHECK (rule_version = 1),
  source_type text NOT NULL CHECK (source_type IN ('mood', 'journal', 'focus', 'habit')),
  source_id text NOT NULL CHECK (length(source_id) BETWEEN 1 AND 512),
  source_revision text NOT NULL CHECK (length(source_revision) BETWEEN 1 AND 512),
  status text NOT NULL CHECK (status IN ('committed', 'undone')),
  revision_ciphertext text NOT NULL
    CHECK (
      revision_ciphertext LIKE 'zenflow:automation-revision:v1:%'
      AND length(revision_ciphertext) <= 90000
    ),
  device_id text NOT NULL CHECK (length(device_id) BETWEEN 1 AND 512),
  server_sequence bigint NOT NULL CHECK (server_sequence > 0),
  history_generation bigint NOT NULL CHECK (history_generation > 0),
  created_at bigint NOT NULL CHECK (created_at >= 0),
  updated_at bigint NOT NULL CHECK (updated_at >= created_at),
  undone_at bigint CHECK (undone_at IS NULL OR undone_at BETWEEN created_at AND updated_at),
  undo_transaction_id uuid,
  CHECK (
    (status = 'committed' AND undone_at IS NULL AND undo_transaction_id IS NULL)
    OR
    (status = 'undone' AND undone_at IS NOT NULL AND undo_transaction_id IS NOT NULL)
  ),
  UNIQUE (user_id, source_key),
  UNIQUE (user_id, server_sequence),
  UNIQUE (user_id, undo_transaction_id)
);

CREATE TABLE public.automation_mutations (
  transaction_id uuid NOT NULL REFERENCES public.automation_transactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mutation_ordinal integer NOT NULL CHECK (mutation_ordinal BETWEEN 0 AND 31),
  entity_type text NOT NULL CHECK (entity_type IN (
    'mood', 'habit_completion', 'journal', 'setting'
  )),
  entity_id text NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 512),
  operation text NOT NULL CHECK (operation IN ('upsert', 'delete')),
  before_hash text NOT NULL CHECK (before_hash ~ '^sha256:[a-f0-9]{64}$'),
  after_hash text NOT NULL CHECK (after_hash ~ '^sha256:[a-f0-9]{64}$'),
  before_revision_token uuid,
  after_revision_token uuid,
  PRIMARY KEY (transaction_id, mutation_ordinal),
  UNIQUE (transaction_id, entity_type, entity_id),
  CHECK (
    (operation = 'upsert' AND after_revision_token IS NOT NULL)
    OR
    (operation = 'delete' AND before_revision_token IS NOT NULL AND after_revision_token IS NULL)
  )
);

CREATE TABLE public.automation_record_revisions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN (
    'mood', 'habit_completion', 'journal', 'setting'
  )),
  entity_id text NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 512),
  record_exists boolean NOT NULL,
  revision_token uuid,
  state_hash text NOT NULL CHECK (state_hash ~ '^sha256:[a-f0-9]{64}$'),
  mutation_generation bigint NOT NULL CHECK (mutation_generation > 0),
  transaction_id uuid,
  updated_at bigint NOT NULL CHECK (updated_at >= 0),
  PRIMARY KEY (user_id, entity_type, entity_id),
  CHECK (
    (record_exists AND revision_token IS NOT NULL)
    OR
    (NOT record_exists AND revision_token IS NULL)
  )
);

CREATE TABLE public.automation_history_tombstones (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purged_transaction_id uuid NOT NULL,
  purged_at bigint NOT NULL CHECK (purged_at >= 0),
  server_sequence bigint NOT NULL CHECK (server_sequence > 0),
  history_generation bigint NOT NULL CHECK (history_generation > 0),
  PRIMARY KEY (user_id, purged_transaction_id)
);

CREATE INDEX automation_transactions_owner_sequence_idx
  ON public.automation_transactions (user_id, server_sequence);
CREATE INDEX automation_transactions_owner_status_idx
  ON public.automation_transactions (user_id, status, updated_at DESC);
CREATE INDEX automation_mutations_owner_target_idx
  ON public.automation_mutations (user_id, entity_type, entity_id);
CREATE INDEX automation_history_tombstones_owner_sequence_idx
  ON public.automation_history_tombstones (
    user_id,
    server_sequence,
    purged_transaction_id
  );

ALTER TABLE public.automation_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_history_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_record_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_history_tombstones ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.automation_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.automation_history_state FORCE ROW LEVEL SECURITY;
ALTER TABLE public.automation_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.automation_mutations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.automation_record_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.automation_history_tombstones FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.automation_preferences FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.automation_history_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.automation_transactions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.automation_mutations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.automation_record_revisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.automation_history_tombstones FROM PUBLIC, anon, authenticated;

CREATE POLICY automation_preferences_select_own
  ON public.automation_preferences FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY automation_history_state_select_own
  ON public.automation_history_state FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY automation_transactions_select_own
  ON public.automation_transactions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY automation_mutations_select_own
  ON public.automation_mutations FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY automation_history_tombstones_select_own
  ON public.automation_history_tombstones FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON TABLE public.automation_preferences TO authenticated;
GRANT SELECT ON TABLE public.automation_history_state TO authenticated;
GRANT SELECT ON TABLE public.automation_transactions TO authenticated;
GRANT SELECT ON TABLE public.automation_mutations TO authenticated;
GRANT SELECT ON TABLE public.automation_history_tombstones TO authenticated;

CREATE OR REPLACE FUNCTION public.automation_now_ms()
RETURNS bigint
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT floor(extract(epoch FROM pg_catalog.clock_timestamp()) * 1000)::bigint;
$$;

CREATE OR REPLACE FUNCTION public.automation_canonical_json(p_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE pg_catalog.jsonb_typeof(p_value)
    WHEN 'object' THEN
      '{' || COALESCE((
        SELECT pg_catalog.string_agg(
          pg_catalog.to_jsonb(item.key)::text || ':' || public.automation_canonical_json(item.value),
          ',' ORDER BY item.key
        )
        FROM pg_catalog.jsonb_each(p_value) AS item(key, value)
      ), '') || '}'
    WHEN 'array' THEN
      '[' || COALESCE((
        SELECT pg_catalog.string_agg(
          public.automation_canonical_json(item.value),
          ',' ORDER BY item.ordinality
        )
        FROM pg_catalog.jsonb_array_elements(p_value)
          WITH ORDINALITY AS item(value, ordinality)
      ), '') || ']'
    ELSE p_value::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.automation_hash_json(p_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT 'sha256:' || encode(
    extensions.digest(
      pg_catalog.convert_to(public.automation_canonical_json(p_value), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.automation_source_key(
  p_owner uuid,
  p_consent_epoch uuid,
  p_rule_id text,
  p_rule_version integer,
  p_source_type text,
  p_source_id text,
  p_source_revision text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.automation_hash_json(
    pg_catalog.jsonb_build_object(
      'consentEpoch', p_consent_epoch::text,
      'ownerUserId', p_owner::text,
      'ruleId', p_rule_id,
      'ruleVersion', p_rule_version,
      'source', pg_catalog.jsonb_build_object(
        'id', p_source_id,
        'revision', p_source_revision,
        'type', p_source_type
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.automation_preference_payload(
  p_preference public.automation_preferences
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'enabled', p_preference.enabled,
    'serverRevision', p_preference.server_revision,
    'consentEpoch', p_preference.consent_epoch,
    'consentedAt', p_preference.consented_at,
    'revokedAt', p_preference.revoked_at,
    'enabledRuleIds', pg_catalog.to_jsonb(p_preference.enabled_rule_ids),
    'focusHabitId', p_preference.focus_habit_id,
    'focusMinimumMinutes', p_preference.focus_minimum_minutes,
    'planningHabitMappings', p_preference.planning_habit_mappings,
    'updatedAt', p_preference.updated_at
  );
$$;

CREATE OR REPLACE FUNCTION public.reject_reserved_automation_setting()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := CASE WHEN TG_OP = 'DELETE' THEN OLD.key ELSE NEW.key END;
  IF v_key = 'zenflow-connected-records-preferences'
    AND COALESCE(pg_catalog.current_setting('zenflow.automation_internal', true), '') <> 'on'
  THEN
    RAISE EXCEPTION 'Reserved connected-record preference key'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS reject_reserved_automation_setting
  ON public.user_settings;
CREATE TRIGGER reject_reserved_automation_setting
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.reject_reserved_automation_setting();

CREATE OR REPLACE FUNCTION public.get_automation_preference()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid());
  v_now bigint := public.automation_now_ms();
  v_preference public.automation_preferences%ROWTYPE;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.automation_preferences (user_id, updated_at)
  VALUES (v_owner, v_now)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.automation_history_state (user_id, updated_at)
  VALUES (v_owner, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO STRICT v_preference
  FROM public.automation_preferences
  WHERE user_id = v_owner;
  RETURN public.automation_preference_payload(v_preference);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_automation_preference(
  p_expected_server_revision bigint,
  p_enabled_rule_ids text[],
  p_focus_habit_id text,
  p_focus_minimum_minutes integer,
  p_planning_habit_mappings jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid());
  v_now bigint := public.automation_now_ms();
  v_preference public.automation_preferences%ROWTYPE;
  v_rule_count integer;
  v_unique_rule_count integer;
  v_mapping_count integer;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_expected_server_revision IS NULL OR p_expected_server_revision < 0
    OR p_enabled_rule_ids IS NULL
    OR p_focus_minimum_minutes NOT BETWEEN 1 AND 1440
    OR p_planning_habit_mappings IS NULL
    OR pg_catalog.jsonb_typeof(p_planning_habit_mappings) <> 'object'
    OR length(COALESCE(p_focus_habit_id, '')) > 512
    OR pg_catalog.octet_length(p_planning_habit_mappings::text) > 65536
  THEN
    RAISE EXCEPTION 'Invalid connected-record preference' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), count(DISTINCT rule_id)
  INTO v_rule_count, v_unique_rule_count
  FROM pg_catalog.unnest(p_enabled_rule_ids) AS rule_id;
  IF v_rule_count > 4 OR v_rule_count <> v_unique_rule_count
    OR EXISTS (
      SELECT 1 FROM pg_catalog.unnest(p_enabled_rule_ids) AS rule_id
      WHERE rule_id NOT IN (
        'mood.note-to-journal.v1',
        'journal.mood-to-checkin.v1',
        'focus.to-mapped-habit.v1',
        'habit.to-planning.v1'
      )
    )
  THEN
    RAISE EXCEPTION 'Invalid connected-record rule set' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_mapping_count
  FROM pg_catalog.jsonb_object_keys(p_planning_habit_mappings);
  IF v_mapping_count > 100 OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_each_text(p_planning_habit_mappings) AS mapping(key, value)
    WHERE length(mapping.key) NOT BETWEEN 1 AND 512
       OR length(mapping.value) NOT BETWEEN 1 AND 512
  ) THEN
    RAISE EXCEPTION 'Invalid connected-record mapping' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text, 2101)
  );
  INSERT INTO public.automation_preferences (user_id, updated_at)
  VALUES (v_owner, v_now)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.automation_history_state (user_id, updated_at)
  VALUES (v_owner, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO STRICT v_preference
  FROM public.automation_preferences
  WHERE user_id = v_owner
  FOR UPDATE;
  IF v_preference.server_revision <> p_expected_server_revision THEN
    RAISE EXCEPTION 'Connected-record preference revision conflict'
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.automation_preferences
  SET server_revision = server_revision + 1,
      enabled = true,
      consent_epoch = extensions.gen_random_uuid(),
      consented_at = v_now,
      revoked_at = NULL,
      enabled_rule_ids = p_enabled_rule_ids,
      focus_habit_id = p_focus_habit_id,
      focus_minimum_minutes = p_focus_minimum_minutes,
      planning_habit_mappings = p_planning_habit_mappings,
      updated_at = v_now
  WHERE user_id = v_owner
  RETURNING * INTO STRICT v_preference;

  RETURN public.automation_preference_payload(v_preference);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_automation_preference_with_planning(
  p_expected_server_revision bigint,
  p_enabled_rule_ids text[],
  p_focus_habit_id text,
  p_focus_minimum_minutes integer,
  p_planning_habit_mappings jsonb,
  p_planning_blocks jsonb,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid());
  v_now bigint := public.automation_now_ms();
  v_preference public.automation_preferences%ROWTYPE;
  v_revision public.automation_record_revisions%ROWTYPE;
  v_schedule jsonb := '[]'::jsonb;
  v_next_schedule jsonb := '[]'::jsonb;
  v_rule_count integer;
  v_unique_rule_count integer;
  v_mapping_count integer;
  v_block_count integer;
  v_event_seq bigint;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_expected_server_revision IS NULL OR p_expected_server_revision < 0
    OR p_enabled_rule_ids IS NULL
    OR p_focus_minimum_minutes NOT BETWEEN 1 AND 1440
    OR p_planning_habit_mappings IS NULL
    OR pg_catalog.jsonb_typeof(p_planning_habit_mappings) <> 'object'
    OR p_planning_blocks IS NULL
    OR pg_catalog.jsonb_typeof(p_planning_blocks) <> 'array'
    OR length(COALESCE(p_focus_habit_id, '')) > 512
    OR pg_catalog.octet_length(p_planning_habit_mappings::text) > 65536
    OR pg_catalog.octet_length(p_planning_blocks::text) > 262144
    OR length(COALESCE(p_device_id, '')) NOT BETWEEN 1 AND 512
  THEN
    RAISE EXCEPTION 'Invalid connected planning preference' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), count(DISTINCT rule_id)
  INTO v_rule_count, v_unique_rule_count
  FROM pg_catalog.unnest(p_enabled_rule_ids) AS rule_id;
  IF v_rule_count > 4 OR v_rule_count <> v_unique_rule_count
    OR EXISTS (
      SELECT 1 FROM pg_catalog.unnest(p_enabled_rule_ids) AS rule_id
      WHERE rule_id NOT IN (
        'mood.note-to-journal.v1',
        'journal.mood-to-checkin.v1',
        'focus.to-mapped-habit.v1',
        'habit.to-planning.v1'
      )
    )
  THEN
    RAISE EXCEPTION 'Invalid connected-record rule set' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_mapping_count
  FROM pg_catalog.jsonb_object_keys(p_planning_habit_mappings);
  v_block_count := pg_catalog.jsonb_array_length(p_planning_blocks);
  IF v_mapping_count > 100
    OR v_block_count > 100
    OR v_mapping_count <> v_block_count
    OR (
      'habit.to-planning.v1' = ANY(p_enabled_rule_ids)
      AND v_mapping_count = 0
    )
    OR (
      NOT ('habit.to-planning.v1' = ANY(p_enabled_rule_ids))
      AND (v_mapping_count <> 0 OR v_block_count <> 0)
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_each_text(p_planning_habit_mappings) AS mapping(key, value)
      WHERE length(mapping.key) NOT BETWEEN 1 AND 512
         OR length(mapping.value) NOT BETWEEN 1 AND 512
    )
    OR (
      SELECT count(DISTINCT mapping.value)
      FROM pg_catalog.jsonb_each_text(p_planning_habit_mappings) AS mapping(key, value)
    ) <> v_mapping_count
  THEN
    RAISE EXCEPTION 'Invalid connected planning mapping' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_planning_blocks) AS item(block)
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN COALESCE(item.block->>'startHour', '') ~ '^[0-9]{1,2}$'
          THEN (item.block->>'startHour')::integer END AS start_hour,
        CASE WHEN COALESCE(item.block->>'startMinute', '') ~ '^[0-9]{1,2}$'
          THEN (item.block->>'startMinute')::integer END AS start_minute,
        CASE WHEN COALESCE(item.block->>'endHour', '') ~ '^[0-9]{1,2}$'
          THEN (item.block->>'endHour')::integer END AS end_hour,
        CASE WHEN COALESCE(item.block->>'endMinute', '') ~ '^[0-9]{1,2}$'
          THEN (item.block->>'endMinute')::integer END AS end_minute
    ) AS parsed_clock
    WHERE pg_catalog.jsonb_typeof(item.block) <> 'object'
       OR (item.block - ARRAY[
         'id', 'title', 'startHour', 'startMinute', 'endHour', 'endMinute',
         'color', 'colorVar', 'urgent', 'emoji', 'date', 'note', 'source',
         'habitId', 'taskId', 'isAutoGenerated', 'isEditable', 'completed'
       ]) <> '{}'::jsonb
       OR length(COALESCE(item.block->>'id', '')) NOT BETWEEN 1 AND 512
       OR length(COALESCE(item.block->>'title', '')) NOT BETWEEN 1 AND 512
       OR length(COALESCE(item.block->>'color', '')) NOT BETWEEN 1 AND 128
       OR COALESCE(item.block->>'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       OR item.block->>'source' <> 'habit'
       OR length(COALESCE(item.block->>'habitId', '')) NOT BETWEEN 1 AND 512
       OR item.block->'isAutoGenerated' IS DISTINCT FROM 'true'::jsonb
       OR item.block->'isEditable' IS DISTINCT FROM 'false'::jsonb
       OR item.block->'completed' IS DISTINCT FROM 'false'::jsonb
       OR item.block ? 'completedAt'
       OR parsed_clock.start_hour IS NULL
       OR parsed_clock.end_hour IS NULL
       OR parsed_clock.start_minute IS NULL
       OR parsed_clock.end_minute IS NULL
       OR parsed_clock.start_hour NOT BETWEEN 0 AND 23
       OR parsed_clock.end_hour NOT BETWEEN 0 AND 23
       OR parsed_clock.start_minute NOT BETWEEN 0 AND 59
       OR parsed_clock.end_minute NOT BETWEEN 0 AND 59
       OR (parsed_clock.end_hour * 60 + parsed_clock.end_minute)
          <= (parsed_clock.start_hour * 60 + parsed_clock.start_minute)
       OR p_planning_habit_mappings->>(item.block->>'habitId')
          IS DISTINCT FROM item.block->>'id'
  ) OR (
    SELECT count(DISTINCT item.block->>'id')
    FROM pg_catalog.jsonb_array_elements(p_planning_blocks) AS item(block)
  ) <> v_block_count THEN
    RAISE EXCEPTION 'Invalid dedicated planning block' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text, 2101)
  );
  INSERT INTO public.automation_preferences (user_id, updated_at)
  VALUES (v_owner, v_now)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.automation_history_state (user_id, updated_at)
  VALUES (v_owner, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO STRICT v_preference
  FROM public.automation_preferences
  WHERE user_id = v_owner
  FOR UPDATE;
  IF v_preference.server_revision <> p_expected_server_revision THEN
    RAISE EXCEPTION 'Connected-record preference revision conflict'
      USING ERRCODE = '40001';
  END IF;

  SELECT setting.value INTO v_schedule
  FROM public.user_settings AS setting
  WHERE setting.user_id = v_owner
    AND setting.key = 'zenflow-schedule-events'
  FOR UPDATE;
  IF NOT FOUND THEN
    v_schedule := '[]'::jsonb;
  END IF;
  IF pg_catalog.jsonb_typeof(v_schedule) <> 'array'
    OR pg_catalog.octet_length(v_schedule::text) > 262144
  THEN
    RAISE EXCEPTION 'Invalid current planning schedule' USING ERRCODE = '40001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(v_schedule) AS current_event(event)
    JOIN pg_catalog.jsonb_each_text(p_planning_habit_mappings) AS mapping(habit_id, event_id)
      ON mapping.event_id = current_event.event->>'id'
    WHERE current_event.event->>'source' IS DISTINCT FROM 'habit'
       OR current_event.event->>'habitId' IS DISTINCT FROM mapping.habit_id
       OR current_event.event->'isAutoGenerated' IS DISTINCT FROM 'true'::jsonb
       OR current_event.event->'isEditable' IS DISTINCT FROM 'false'::jsonb
  ) THEN
    RAISE EXCEPTION 'Dedicated planning block identity conflict' USING ERRCODE = '40001';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(current_event.event ORDER BY current_event.ordinality), '[]'::jsonb)
  INTO v_next_schedule
  FROM pg_catalog.jsonb_array_elements(v_schedule)
    WITH ORDINALITY AS current_event(event, ordinality)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_each_text(v_preference.planning_habit_mappings)
      AS old_mapping(habit_id, event_id)
    WHERE old_mapping.event_id = current_event.event->>'id'
      AND old_mapping.habit_id = current_event.event->>'habitId'
      AND current_event.event->>'source' = 'habit'
      AND current_event.event->'isAutoGenerated' = 'true'::jsonb
      AND current_event.event->'isEditable' = 'false'::jsonb
      AND NOT (
        current_event.event->'completed' = 'true'::jsonb
        AND p_planning_habit_mappings->>old_mapping.habit_id
          IS NOT DISTINCT FROM old_mapping.event_id
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_each_text(p_planning_habit_mappings)
      AS new_mapping(habit_id, event_id)
    WHERE new_mapping.event_id = current_event.event->>'id'
      AND new_mapping.habit_id = current_event.event->>'habitId'
      AND current_event.event->>'source' = 'habit'
      AND current_event.event->'isAutoGenerated' = 'true'::jsonb
      AND current_event.event->'isEditable' = 'false'::jsonb
      AND NOT (
        current_event.event->'completed' = 'true'::jsonb
        AND v_preference.planning_habit_mappings->>new_mapping.habit_id
          IS NOT DISTINCT FROM new_mapping.event_id
      )
  );
  v_next_schedule := v_next_schedule || COALESCE((
    SELECT pg_catalog.jsonb_agg(candidate.block ORDER BY candidate.ordinality)
    FROM pg_catalog.jsonb_array_elements(p_planning_blocks)
      WITH ORDINALITY AS candidate(block, ordinality)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_schedule) AS current_completed(event)
      WHERE current_completed.event->>'id' = candidate.block->>'id'
        AND current_completed.event->>'habitId' = candidate.block->>'habitId'
        AND current_completed.event->>'source' = 'habit'
        AND current_completed.event->'isAutoGenerated' = 'true'::jsonb
        AND current_completed.event->'isEditable' = 'false'::jsonb
        AND current_completed.event->'completed' = 'true'::jsonb
    )
  ), '[]'::jsonb);
  IF pg_catalog.octet_length(v_next_schedule::text) > 262144 THEN
    RAISE EXCEPTION 'Connected planning schedule is too large' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_settings (user_id, key, value, updated_at)
  VALUES (
    v_owner,
    'zenflow-schedule-events',
    v_next_schedule,
    pg_catalog.clock_timestamp()
  )
  ON CONFLICT (user_id, key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

  SELECT * INTO STRICT v_revision
  FROM public.automation_record_revisions
  WHERE user_id = v_owner
    AND entity_type = 'setting'
    AND entity_id = 'zenflow-schedule-events';

  UPDATE public.automation_preferences
  SET server_revision = server_revision + 1,
      enabled = true,
      consent_epoch = extensions.gen_random_uuid(),
      consented_at = v_now,
      revoked_at = NULL,
      enabled_rule_ids = p_enabled_rule_ids,
      focus_habit_id = p_focus_habit_id,
      focus_minimum_minutes = p_focus_minimum_minutes,
      planning_habit_mappings = p_planning_habit_mappings,
      updated_at = v_now
  WHERE user_id = v_owner
  RETURNING * INTO STRICT v_preference;

  INSERT INTO public.sync_events (
    id, user_id, entity_type, entity_id, op, payload, device_id, idempotency_key
  ) VALUES (
    extensions.gen_random_uuid(),
    v_owner,
    'setting',
    'zenflow-schedule-events',
    'upsert',
    pg_catalog.jsonb_build_object(
      'key', 'zenflow-schedule-events',
      'value', v_next_schedule,
      'updatedAt', v_now,
      'automationRevision', pg_catalog.jsonb_build_object(
        'recordExists', v_revision.record_exists,
        'revisionToken', v_revision.revision_token,
        'stateHash', v_revision.state_hash,
        'mutationGeneration', v_revision.mutation_generation,
        'transactionId', v_revision.transaction_id,
        'updatedAt', v_revision.updated_at
      )
    ),
    p_device_id,
    extensions.gen_random_uuid()
  )
  RETURNING seq INTO STRICT v_event_seq;

  RETURN pg_catalog.jsonb_build_object(
    'preference', public.automation_preference_payload(v_preference),
    'scheduleEvents', v_next_schedule,
    'scheduleRevision', pg_catalog.jsonb_build_object(
      'recordExists', v_revision.record_exists,
      'revisionToken', v_revision.revision_token,
      'stateHash', v_revision.state_hash,
      'mutationGeneration', v_revision.mutation_generation,
      'transactionId', v_revision.transaction_id,
      'updatedAt', v_revision.updated_at
    ),
    'eventSeq', v_event_seq
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_automation_preference()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid());
  v_now bigint := public.automation_now_ms();
  v_preference public.automation_preferences%ROWTYPE;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text, 2101)
  );
  INSERT INTO public.automation_preferences (user_id, updated_at)
  VALUES (v_owner, v_now)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO STRICT v_preference
  FROM public.automation_preferences
  WHERE user_id = v_owner
  FOR UPDATE;

  IF NOT v_preference.enabled AND v_preference.revoked_at IS NOT NULL THEN
    RETURN public.automation_preference_payload(v_preference);
  END IF;

  UPDATE public.automation_preferences
  SET server_revision = server_revision + 1,
      enabled = false,
      consent_epoch = NULL,
      revoked_at = GREATEST(v_now, COALESCE(consented_at, 0)),
      updated_at = v_now
  WHERE user_id = v_owner
  RETURNING * INTO STRICT v_preference;
  RETURN public.automation_preference_payload(v_preference);
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_automation_record_revision()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid;
  v_entity_type text;
  v_entity_id text;
  v_projection jsonb;
  v_exists boolean := TG_OP <> 'DELETE';
  v_token uuid;
  v_transaction_id uuid;
  v_expected_hash text;
  v_actual_hash text;
  v_now bigint := public.automation_now_ms();
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'journal_entries' THEN
      v_owner := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
      v_entity_type := 'journal';
      v_entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
      v_projection := CASE WHEN TG_OP = 'DELETE'
        THEN 'null'::jsonb
        ELSE pg_catalog.to_jsonb(NEW) - 'user_id'
      END;
    WHEN 'moods' THEN
      v_owner := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
      v_entity_type := 'mood';
      v_entity_id := (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END)::text;
      v_projection := CASE WHEN TG_OP = 'DELETE'
        THEN 'null'::jsonb
        ELSE pg_catalog.to_jsonb(NEW) - 'user_id' - 'created_at'
      END;
    WHEN 'habit_completions' THEN
      v_owner := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
      v_entity_type := 'habit_completion';
      v_entity_id :=
        (CASE WHEN TG_OP = 'DELETE' THEN OLD.habit_id ELSE NEW.habit_id END)::text
        || ':' ||
        (CASE WHEN TG_OP = 'DELETE' THEN OLD.date ELSE NEW.date END)::text;
      v_projection := CASE WHEN TG_OP = 'DELETE'
        THEN 'null'::jsonb
        ELSE pg_catalog.to_jsonb(NEW) - 'user_id' - 'id' - 'created_at'
      END;
    WHEN 'user_settings' THEN
      IF (CASE WHEN TG_OP = 'DELETE' THEN OLD.key ELSE NEW.key END)
        <> 'zenflow-schedule-events'
      THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END IF;
      v_owner := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
      v_entity_type := 'setting';
      v_entity_id := 'zenflow-schedule-events';
      v_projection := CASE WHEN TG_OP = 'DELETE' THEN 'null'::jsonb ELSE NEW.value END;
  END CASE;

  v_expected_hash := NULLIF(
    pg_catalog.current_setting('zenflow.automation_after_hash', true),
    ''
  );
  v_actual_hash := public.automation_hash_json(COALESCE(v_projection, 'null'::jsonb));
  IF v_expected_hash IS NOT NULL AND v_expected_hash <> v_actual_hash THEN
    RAISE EXCEPTION 'Automation projection hash mismatch' USING ERRCODE = '40001';
  END IF;

  IF v_exists THEN
    v_token := COALESCE(
      NULLIF(
        pg_catalog.current_setting('zenflow.automation_revision_token', true),
        ''
      )::uuid,
      extensions.gen_random_uuid()
    );
  END IF;
  v_transaction_id := NULLIF(
    pg_catalog.current_setting('zenflow.automation_transaction_id', true),
    ''
  )::uuid;

  INSERT INTO public.automation_record_revisions (
    user_id,
    entity_type,
    entity_id,
    record_exists,
    revision_token,
    state_hash,
    mutation_generation,
    transaction_id,
    updated_at
  ) VALUES (
    v_owner,
    v_entity_type,
    v_entity_id,
    v_exists,
    v_token,
    v_actual_hash,
    1,
    v_transaction_id,
    v_now
  )
  ON CONFLICT (user_id, entity_type, entity_id)
  DO UPDATE SET
    record_exists = EXCLUDED.record_exists,
    revision_token = EXCLUDED.revision_token,
    state_hash = EXCLUDED.state_hash,
    mutation_generation = public.automation_record_revisions.mutation_generation + 1,
    transaction_id = EXCLUDED.transaction_id,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.automation_history_state (
    user_id,
    record_revision_version,
    updated_at
  ) VALUES (
    v_owner,
    1,
    v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    record_revision_version =
      public.automation_history_state.record_revision_version + 1,
    updated_at = GREATEST(public.automation_history_state.updated_at, EXCLUDED.updated_at);

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER capture_automation_revision_journal
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.capture_automation_record_revision();
CREATE TRIGGER capture_automation_revision_mood
  AFTER INSERT OR UPDATE OR DELETE ON public.moods
  FOR EACH ROW EXECUTE FUNCTION public.capture_automation_record_revision();
CREATE TRIGGER capture_automation_revision_habit_completion
  AFTER INSERT OR UPDATE OR DELETE ON public.habit_completions
  FOR EACH ROW EXECUTE FUNCTION public.capture_automation_record_revision();
CREATE TRIGGER capture_automation_revision_schedule_setting
  AFTER INSERT OR UPDATE OR DELETE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.capture_automation_record_revision();

-- Backfill revision tokens for current projections. Only hashes and opaque
-- tokens are added; user prose is not copied into the automation ledger.
INSERT INTO public.automation_record_revisions (
  user_id, entity_type, entity_id, record_exists, revision_token,
  state_hash, mutation_generation, transaction_id, updated_at
)
SELECT
  entry.user_id,
  'journal',
  entry.id,
  true,
  extensions.gen_random_uuid(),
  public.automation_hash_json(pg_catalog.to_jsonb(entry) - 'user_id'),
  1,
  NULL,
  public.automation_now_ms()
FROM public.journal_entries AS entry
ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING;

INSERT INTO public.automation_record_revisions (
  user_id, entity_type, entity_id, record_exists, revision_token,
  state_hash, mutation_generation, transaction_id, updated_at
)
SELECT
  mood.user_id,
  'mood',
  mood.id::text,
  true,
  extensions.gen_random_uuid(),
  public.automation_hash_json(pg_catalog.to_jsonb(mood) - 'user_id' - 'created_at'),
  1,
  NULL,
  public.automation_now_ms()
FROM public.moods AS mood
ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING;

INSERT INTO public.automation_record_revisions (
  user_id, entity_type, entity_id, record_exists, revision_token,
  state_hash, mutation_generation, transaction_id, updated_at
)
SELECT
  completion.user_id,
  'habit_completion',
  completion.habit_id::text || ':' || completion.date::text,
  true,
  extensions.gen_random_uuid(),
  public.automation_hash_json(
    pg_catalog.to_jsonb(completion) - 'user_id' - 'id' - 'created_at'
  ),
  1,
  NULL,
  public.automation_now_ms()
FROM public.habit_completions AS completion
ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING;

INSERT INTO public.automation_record_revisions (
  user_id, entity_type, entity_id, record_exists, revision_token,
  state_hash, mutation_generation, transaction_id, updated_at
)
SELECT
  setting.user_id,
  'setting',
  setting.key,
  true,
  extensions.gen_random_uuid(),
  public.automation_hash_json(COALESCE(setting.value, 'null'::jsonb)),
  1,
  NULL,
  public.automation_now_ms()
FROM public.user_settings AS setting
WHERE setting.key = 'zenflow-schedule-events'
ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING;

-- Seed the snapshot-consistency fence after the one-time revision backfill.
-- Subsequent manual or automation writes increment it in the capture trigger.
INSERT INTO public.automation_history_state (
  user_id,
  record_revision_version,
  updated_at
)
SELECT
  revision.user_id,
  1,
  public.automation_now_ms()
FROM public.automation_record_revisions AS revision
GROUP BY revision.user_id
ON CONFLICT (user_id) DO UPDATE SET
  record_revision_version = GREATEST(
    public.automation_history_state.record_revision_version,
    EXCLUDED.record_revision_version
  ),
  updated_at = GREATEST(
    public.automation_history_state.updated_at,
    EXCLUDED.updated_at
  );

CREATE OR REPLACE FUNCTION public.automation_current_projection(
  p_owner uuid,
  p_entity_type text,
  p_entity_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_projection jsonb;
  v_habit_id uuid;
  v_date date;
BEGIN
  CASE p_entity_type
    WHEN 'journal' THEN
      SELECT pg_catalog.to_jsonb(entry) - 'user_id'
      INTO v_projection
      FROM public.journal_entries AS entry
      WHERE entry.user_id = p_owner AND entry.id = p_entity_id;
    WHEN 'mood' THEN
      IF NOT pg_catalog.pg_input_is_valid(p_entity_id, 'uuid') THEN
        RETURN NULL;
      END IF;
      SELECT pg_catalog.to_jsonb(mood) - 'user_id' - 'created_at'
      INTO v_projection
      FROM public.moods AS mood
      WHERE mood.user_id = p_owner AND mood.id = p_entity_id::uuid;
    WHEN 'habit_completion' THEN
      IF NOT pg_catalog.pg_input_is_valid(pg_catalog.split_part(p_entity_id, ':', 1), 'uuid')
        OR NOT pg_catalog.pg_input_is_valid(pg_catalog.split_part(p_entity_id, ':', 2), 'date')
      THEN
        RETURN NULL;
      END IF;
      v_habit_id := pg_catalog.split_part(p_entity_id, ':', 1)::uuid;
      v_date := pg_catalog.split_part(p_entity_id, ':', 2)::date;
      SELECT pg_catalog.to_jsonb(completion) - 'user_id' - 'id' - 'created_at'
      INTO v_projection
      FROM public.habit_completions AS completion
      WHERE completion.user_id = p_owner
        AND completion.habit_id = v_habit_id
        AND completion.date = v_date;
    WHEN 'setting' THEN
      IF p_entity_id <> 'zenflow-schedule-events' THEN
        RETURN NULL;
      END IF;
      SELECT setting.value
      INTO v_projection
      FROM public.user_settings AS setting
      WHERE setting.user_id = p_owner AND setting.key = p_entity_id;
    ELSE
      RETURN NULL;
  END CASE;
  RETURN v_projection;
END;
$$;

CREATE OR REPLACE FUNCTION public.automation_apply_mutation(
  p_owner uuid,
  p_transaction_id uuid,
  p_mutation jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entity_type text := p_mutation->>'entityType';
  v_entity_id text := p_mutation->>'entityId';
  v_operation text := p_mutation->>'operation';
  v_after jsonb := p_mutation->'after';
  v_after_token text := NULLIF(p_mutation->>'afterRevisionToken', '');
  v_after_hash text := p_mutation->>'afterHash';
  v_journal public.journal_entries%ROWTYPE;
  v_mood public.moods%ROWTYPE;
  v_completion public.habit_completions%ROWTYPE;
  v_revision public.automation_record_revisions%ROWTYPE;
BEGIN
  PERFORM pg_catalog.set_config('zenflow.automation_internal', 'on', true);
  PERFORM pg_catalog.set_config(
    'zenflow.automation_revision_token',
    COALESCE(v_after_token, ''),
    true
  );
  PERFORM pg_catalog.set_config(
    'zenflow.automation_transaction_id',
    p_transaction_id::text,
    true
  );
  PERFORM pg_catalog.set_config('zenflow.automation_after_hash', v_after_hash, true);

  CASE v_entity_type
    WHEN 'journal' THEN
      IF v_operation = 'delete' THEN
        DELETE FROM public.journal_entries AS entry
        WHERE entry.user_id = p_owner AND entry.id = v_entity_id;
      ELSE
        v_journal := pg_catalog.jsonb_populate_record(
          NULL::public.journal_entries,
          v_after || pg_catalog.jsonb_build_object('user_id', p_owner)
        );
        IF v_journal.id IS DISTINCT FROM v_entity_id
          OR v_journal.user_id IS DISTINCT FROM p_owner
          OR length(v_journal.id) NOT BETWEEN 1 AND 512
        THEN
          RAISE EXCEPTION 'Invalid journal automation projection' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.journal_entries (
          id, user_id, date, title, content, stickers, mood, tags, template_id,
          habit_snapshot, photo_ids, audio_ids, created_at, updated_at,
          bg_intensity, bg_pattern, font, font_size, ink_color, paper_color,
          paper_texture, particle_speed, photo_layout, theme
        ) VALUES (
          v_journal.id, p_owner, v_journal.date, v_journal.title, v_journal.content,
          v_journal.stickers, v_journal.mood, v_journal.tags, v_journal.template_id,
          v_journal.habit_snapshot, v_journal.photo_ids, v_journal.audio_ids,
          v_journal.created_at, v_journal.updated_at, v_journal.bg_intensity,
          v_journal.bg_pattern, v_journal.font, v_journal.font_size,
          v_journal.ink_color, v_journal.paper_color, v_journal.paper_texture,
          v_journal.particle_speed, v_journal.photo_layout, v_journal.theme
        )
        ON CONFLICT (id) DO UPDATE SET
          date = EXCLUDED.date,
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          stickers = EXCLUDED.stickers,
          mood = EXCLUDED.mood,
          tags = EXCLUDED.tags,
          template_id = EXCLUDED.template_id,
          habit_snapshot = EXCLUDED.habit_snapshot,
          photo_ids = EXCLUDED.photo_ids,
          audio_ids = EXCLUDED.audio_ids,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          bg_intensity = EXCLUDED.bg_intensity,
          bg_pattern = EXCLUDED.bg_pattern,
          font = EXCLUDED.font,
          font_size = EXCLUDED.font_size,
          ink_color = EXCLUDED.ink_color,
          paper_color = EXCLUDED.paper_color,
          paper_texture = EXCLUDED.paper_texture,
          particle_speed = EXCLUDED.particle_speed,
          photo_layout = EXCLUDED.photo_layout,
          theme = EXCLUDED.theme
        WHERE public.journal_entries.user_id = p_owner;
      END IF;

    WHEN 'mood' THEN
      IF NOT pg_catalog.pg_input_is_valid(v_entity_id, 'uuid') THEN
        RAISE EXCEPTION 'Invalid mood automation identity' USING ERRCODE = '22023';
      END IF;
      IF v_operation = 'delete' THEN
        DELETE FROM public.moods AS mood
        WHERE mood.user_id = p_owner AND mood.id = v_entity_id::uuid;
      ELSE
        v_mood := pg_catalog.jsonb_populate_record(
          NULL::public.moods,
          v_after || pg_catalog.jsonb_build_object('user_id', p_owner)
        );
        IF v_mood.id IS DISTINCT FROM v_entity_id::uuid
          OR v_mood.user_id IS DISTINCT FROM p_owner
        THEN
          RAISE EXCEPTION 'Invalid mood automation projection' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.moods (
          id, user_id, mood, note, tags, date, timestamp, updated_at,
          valence, log_type, emotion_tags, contexts, emotion
        ) VALUES (
          v_mood.id, p_owner, v_mood.mood, v_mood.note, v_mood.tags,
          v_mood.date, v_mood.timestamp, v_mood.updated_at, v_mood.valence,
          v_mood.log_type, v_mood.emotion_tags, v_mood.contexts, v_mood.emotion
        )
        ON CONFLICT (id) DO UPDATE SET
          mood = EXCLUDED.mood,
          note = EXCLUDED.note,
          tags = EXCLUDED.tags,
          date = EXCLUDED.date,
          timestamp = EXCLUDED.timestamp,
          updated_at = EXCLUDED.updated_at,
          valence = EXCLUDED.valence,
          log_type = EXCLUDED.log_type,
          emotion_tags = EXCLUDED.emotion_tags,
          contexts = EXCLUDED.contexts,
          emotion = EXCLUDED.emotion
        WHERE public.moods.user_id = p_owner;
      END IF;

    WHEN 'habit_completion' THEN
      IF v_operation = 'delete' THEN
        IF NOT pg_catalog.pg_input_is_valid(pg_catalog.split_part(v_entity_id, ':', 1), 'uuid')
          OR NOT pg_catalog.pg_input_is_valid(pg_catalog.split_part(v_entity_id, ':', 2), 'date')
        THEN
          RAISE EXCEPTION 'Invalid habit completion identity' USING ERRCODE = '22023';
        END IF;
        DELETE FROM public.habit_completions AS completion
        WHERE completion.user_id = p_owner
          AND completion.habit_id = pg_catalog.split_part(v_entity_id, ':', 1)::uuid
          AND completion.date = pg_catalog.split_part(v_entity_id, ':', 2)::date;
      ELSE
        v_completion := pg_catalog.jsonb_populate_record(
          NULL::public.habit_completions,
          v_after || pg_catalog.jsonb_build_object('user_id', p_owner)
        );
        IF v_completion.user_id IS DISTINCT FROM p_owner
          OR v_completion.habit_id::text || ':' || v_completion.date::text <> v_entity_id
          OR NOT EXISTS (
            SELECT 1 FROM public.habits AS habit
            WHERE habit.id = v_completion.habit_id AND habit.user_id = p_owner
          )
        THEN
          RAISE EXCEPTION 'Invalid habit completion projection' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.habit_completions (
          id, user_id, habit_id, date, count, duration, entry_status,
          entry_value, habit_type, is_complete, target_type
        ) VALUES (
          COALESCE(v_completion.id, extensions.gen_random_uuid()),
          p_owner,
          v_completion.habit_id,
          v_completion.date,
          v_completion.count,
          v_completion.duration,
          v_completion.entry_status,
          v_completion.entry_value,
          v_completion.habit_type,
          v_completion.is_complete,
          v_completion.target_type
        )
        ON CONFLICT (habit_id, date) DO UPDATE SET
          count = EXCLUDED.count,
          duration = EXCLUDED.duration,
          entry_status = EXCLUDED.entry_status,
          entry_value = EXCLUDED.entry_value,
          habit_type = EXCLUDED.habit_type,
          is_complete = EXCLUDED.is_complete,
          target_type = EXCLUDED.target_type
        WHERE public.habit_completions.user_id = p_owner;
      END IF;

    WHEN 'setting' THEN
      IF v_entity_id <> 'zenflow-schedule-events'
        OR (v_operation = 'upsert' AND (
          pg_catalog.jsonb_typeof(v_after) <> 'array'
          OR pg_catalog.octet_length(v_after::text) > 262144
        ))
      THEN
        RAISE EXCEPTION 'Invalid planning automation projection' USING ERRCODE = '22023';
      END IF;
      IF v_operation = 'delete' THEN
        DELETE FROM public.user_settings AS setting
        WHERE setting.user_id = p_owner AND setting.key = v_entity_id;
      ELSE
        INSERT INTO public.user_settings (user_id, key, value, updated_at)
        VALUES (p_owner, v_entity_id, v_after, pg_catalog.clock_timestamp())
        ON CONFLICT (user_id, key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at;
      END IF;
    ELSE
      RAISE EXCEPTION 'Unsupported automation target' USING ERRCODE = '22023';
  END CASE;

  SELECT * INTO STRICT v_revision
  FROM public.automation_record_revisions
  WHERE user_id = p_owner
    AND entity_type = v_entity_type
    AND entity_id = v_entity_id;
  IF v_operation = 'upsert' AND (
    NOT v_revision.record_exists
    OR v_revision.revision_token::text IS DISTINCT FROM v_after_token
    OR v_revision.state_hash IS DISTINCT FROM v_after_hash
    OR v_revision.transaction_id IS DISTINCT FROM p_transaction_id
  ) THEN
    RAISE EXCEPTION 'Automation write revision mismatch' USING ERRCODE = '40001';
  ELSIF v_operation = 'delete' AND (
    v_revision.record_exists
    OR v_revision.revision_token IS NOT NULL
    OR v_revision.state_hash IS DISTINCT FROM v_after_hash
    OR v_revision.transaction_id IS DISTINCT FROM p_transaction_id
  ) THEN
    RAISE EXCEPTION 'Automation delete revision mismatch' USING ERRCODE = '40001';
  END IF;

  PERFORM pg_catalog.set_config('zenflow.automation_internal', 'off', true);
  PERFORM pg_catalog.set_config('zenflow.automation_revision_token', '', true);
  PERFORM pg_catalog.set_config('zenflow.automation_transaction_id', '', true);
  PERFORM pg_catalog.set_config('zenflow.automation_after_hash', '', true);
END;
$$;

-- Add encrypted automation envelopes to the ordered sync log. Existing entity
-- values remain unchanged; this constraint replacement runs in one migration
-- transaction and is validated before commit.
ALTER TABLE public.sync_events
  DROP CONSTRAINT IF EXISTS sync_events_entity_type_check;
ALTER TABLE public.sync_events
  ADD CONSTRAINT sync_events_entity_type_check CHECK (entity_type IN (
    'mood', 'habit', 'focus', 'gratitude', 'journal',
    'habit_completion', 'setting', 'automation_transaction',
    'automation_history_purge'
  )) NOT VALID;
ALTER TABLE public.sync_events
  VALIDATE CONSTRAINT sync_events_entity_type_check;

CREATE OR REPLACE FUNCTION public.automation_commit_rejection(
  p_code text,
  p_transaction_id uuid,
  p_preference_revision bigint,
  p_history_generation bigint
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'code', p_code,
    'transactionId', p_transaction_id,
    'currentPreferenceRevision', p_preference_revision,
    'historyGeneration', p_history_generation
  );
$$;

CREATE OR REPLACE FUNCTION public.commit_automation_transaction(p_request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid());
  v_now bigint := public.automation_now_ms();
  v_transaction_id uuid := extensions.gen_random_uuid();
  v_consent_epoch uuid;
  v_preference public.automation_preferences%ROWTYPE;
  v_history public.automation_history_state%ROWTYPE;
  v_existing public.automation_transactions%ROWTYPE;
  v_source jsonb;
  v_mutation jsonb;
  v_revision public.automation_record_revisions%ROWTYPE;
  v_revision_found boolean;
  v_current_projection jsonb;
  v_expected_source_key text;
  v_rule_id text;
  v_rule_target text;
  v_source_type text;
  v_server_sequence bigint;
  v_event_id uuid;
  v_event_seq bigint;
BEGIN
  IF v_owner IS NULL THEN
    RETURN public.automation_commit_rejection(
      'UNAUTHORIZED', v_transaction_id, 0, 1
    );
  END IF;
  IF p_request IS NULL OR pg_catalog.jsonb_typeof(p_request) <> 'object'
    OR p_request - ARRAY[
      'schemaVersion', 'transactionId', 'consentEpoch',
      'expectedPreferenceRevision', 'expectedHistoryGeneration', 'sourceKey',
      'ruleId', 'ruleVersion', 'source', 'revisionCiphertext', 'deviceId',
      'mutations', 'requestedAt'
    ] <> '{}'::jsonb
    OR p_request->>'schemaVersion' <> '1'
    OR NOT pg_catalog.pg_input_is_valid(p_request->>'transactionId', 'uuid')
  THEN
    RETURN public.automation_commit_rejection(
      'INVALID_REQUEST', v_transaction_id, 0, 1
    );
  END IF;
  v_transaction_id := (p_request->>'transactionId')::uuid;

  IF NOT pg_catalog.pg_input_is_valid(p_request->>'consentEpoch', 'uuid')
    OR NOT pg_catalog.pg_input_is_valid(p_request->>'expectedPreferenceRevision', 'bigint')
    OR NOT pg_catalog.pg_input_is_valid(p_request->>'expectedHistoryGeneration', 'bigint')
    OR NOT pg_catalog.pg_input_is_valid(p_request->>'requestedAt', 'bigint')
    OR length(COALESCE(p_request->>'deviceId', '')) NOT BETWEEN 1 AND 512
    OR COALESCE(p_request->>'sourceKey', '') !~ '^sha256:[a-f0-9]{64}$'
    OR COALESCE(p_request->>'revisionCiphertext', '')
      NOT LIKE 'zenflow:automation-revision:v1:%'
    OR length(COALESCE(p_request->>'revisionCiphertext', '')) > 90000
    OR pg_catalog.jsonb_typeof(p_request->'source') <> 'object'
    OR pg_catalog.jsonb_typeof(p_request->'mutations') <> 'array'
    OR pg_catalog.jsonb_array_length(p_request->'mutations') = 0
    OR pg_catalog.jsonb_array_length(p_request->'mutations') > 32
  THEN
    RETURN public.automation_commit_rejection(
      'INVALID_REQUEST', v_transaction_id, 0, 1
    );
  END IF;

  v_consent_epoch := (p_request->>'consentEpoch')::uuid;
  v_rule_id := p_request->>'ruleId';
  v_source := p_request->'source';
  v_source_type := v_source->>'type';
  IF p_request->>'ruleVersion' <> '1'
    OR v_source - ARRAY['schemaVersion', 'type', 'id', 'revision', 'committedAt']
      <> '{}'::jsonb
    OR v_source->>'schemaVersion' <> '1'
    OR length(COALESCE(v_source->>'id', '')) NOT BETWEEN 1 AND 512
    OR length(COALESCE(v_source->>'revision', '')) NOT BETWEEN 1 AND 512
    OR NOT pg_catalog.pg_input_is_valid(v_source->>'committedAt', 'bigint')
    OR (v_rule_id, v_source_type) NOT IN (
      ('mood.note-to-journal.v1', 'mood'),
      ('journal.mood-to-checkin.v1', 'journal'),
      ('focus.to-mapped-habit.v1', 'focus'),
      ('habit.to-planning.v1', 'habit')
    )
  THEN
    RETURN public.automation_commit_rejection(
      'INVALID_REQUEST', v_transaction_id, 0, 1
    );
  END IF;

  v_rule_target := CASE v_rule_id
    WHEN 'mood.note-to-journal.v1' THEN 'journal'
    WHEN 'journal.mood-to-checkin.v1' THEN 'mood'
    WHEN 'focus.to-mapped-habit.v1' THEN 'habit_completion'
    WHEN 'habit.to-planning.v1' THEN 'setting'
  END;
  IF pg_catalog.jsonb_array_length(p_request->'mutations') <> 1 THEN
    RETURN public.automation_commit_rejection(
      'INVALID_REQUEST', v_transaction_id, 0, 1
    );
  END IF;

  v_expected_source_key := public.automation_source_key(
    v_owner,
    v_consent_epoch,
    v_rule_id,
    1,
    v_source_type,
    v_source->>'id',
    v_source->>'revision'
  );
  IF p_request->>'sourceKey' IS DISTINCT FROM v_expected_source_key THEN
    RETURN public.automation_commit_rejection(
      'INVALID_REQUEST', v_transaction_id, 0, 1
    );
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text, 2101)
  );
  INSERT INTO public.automation_preferences (user_id, updated_at)
  VALUES (v_owner, v_now)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.automation_history_state (user_id, updated_at)
  VALUES (v_owner, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO STRICT v_preference
  FROM public.automation_preferences
  WHERE user_id = v_owner
  FOR UPDATE;
  SELECT * INTO STRICT v_history
  FROM public.automation_history_state
  WHERE user_id = v_owner
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.automation_history_tombstones AS tombstone
    WHERE tombstone.user_id = v_owner
      AND tombstone.purged_transaction_id = v_transaction_id
  ) THEN
    RETURN public.automation_commit_rejection(
      'TRANSACTION_PURGED', v_transaction_id,
      v_preference.server_revision, v_history.history_generation
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.automation_transactions
  WHERE user_id = v_owner AND source_key = v_expected_source_key
  FOR UPDATE;
  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'code', 'ALREADY_COMMITTED',
      'transactionId', v_existing.id,
      'serverSequence', v_existing.server_sequence,
      'historyGeneration', v_existing.history_generation,
      'completedAt', v_existing.updated_at
    );
  END IF;

  IF NOT v_preference.enabled OR v_preference.consent_epoch IS DISTINCT FROM v_consent_epoch THEN
    RETURN public.automation_commit_rejection(
      'STALE_CONSENT_EPOCH', v_transaction_id,
      v_preference.server_revision, v_history.history_generation
    );
  END IF;
  IF v_preference.server_revision <> (p_request->>'expectedPreferenceRevision')::bigint THEN
    RETURN public.automation_commit_rejection(
      'PREFERENCE_REVISION_CONFLICT', v_transaction_id,
      v_preference.server_revision, v_history.history_generation
    );
  END IF;
  IF v_history.history_generation <> (p_request->>'expectedHistoryGeneration')::bigint THEN
    RETURN public.automation_commit_rejection(
      'HISTORY_GENERATION_STALE', v_transaction_id,
      v_preference.server_revision, v_history.history_generation
    );
  END IF;
  IF NOT (v_rule_id = ANY(v_preference.enabled_rule_ids)) THEN
    RETURN public.automation_commit_rejection(
      'STALE_CONSENT_EPOCH', v_transaction_id,
      v_preference.server_revision, v_history.history_generation
    );
  END IF;
  IF (
    SELECT count(*) FROM public.automation_transactions AS transaction
    WHERE transaction.user_id = v_owner
  ) >= 128 OR (
    SELECT COALESCE(
      sum(pg_catalog.octet_length(transaction.revision_ciphertext)),
      0
    )
    FROM public.automation_transactions AS transaction
    WHERE transaction.user_id = v_owner
  ) + pg_catalog.octet_length(p_request->>'revisionCiphertext') > 8 * 1024 * 1024 THEN
    RETURN public.automation_commit_rejection(
      'HISTORY_LIMIT_REACHED', v_transaction_id,
      v_preference.server_revision, v_history.history_generation
    );
  END IF;

  -- Sorted target locks serialize absent-row creates as well as updates. This
  -- is the all-target planned-before CAS boundary for the whole batch.
  FOR v_mutation IN
    SELECT mutation.value
    FROM pg_catalog.jsonb_array_elements(p_request->'mutations') AS mutation(value)
    ORDER BY mutation.value->>'entityType', mutation.value->>'entityId'
  LOOP
    IF pg_catalog.jsonb_typeof(v_mutation) <> 'object'
      OR v_mutation - ARRAY[
        'entityType', 'entityId', 'operation', 'before', 'after',
        'beforeHash', 'afterHash', 'beforeRevisionToken', 'afterRevisionToken'
      ] <> '{}'::jsonb
      OR v_mutation->>'entityType' <> v_rule_target
      OR length(COALESCE(v_mutation->>'entityId', '')) NOT BETWEEN 1 AND 512
      OR v_mutation->>'operation' NOT IN ('upsert', 'delete')
      OR COALESCE(v_mutation->>'beforeHash', '') !~ '^sha256:[a-f0-9]{64}$'
      OR COALESCE(v_mutation->>'afterHash', '') !~ '^sha256:[a-f0-9]{64}$'
      OR (
        v_mutation->>'entityType' = 'setting'
        AND v_mutation->>'entityId' <> 'zenflow-schedule-events'
      )
    THEN
      RETURN public.automation_commit_rejection(
        'INVALID_REQUEST', v_transaction_id,
        v_preference.server_revision, v_history.history_generation
      );
    END IF;
    IF (v_mutation->'before') <> 'null'::jsonb
      AND NOT pg_catalog.pg_input_is_valid(v_mutation->>'beforeRevisionToken', 'uuid')
    THEN
      RETURN public.automation_commit_rejection(
        'INVALID_REQUEST', v_transaction_id,
        v_preference.server_revision, v_history.history_generation
      );
    END IF;
    IF v_mutation->>'operation' = 'upsert' AND (
      (v_mutation->'after') = 'null'::jsonb
      OR NOT pg_catalog.pg_input_is_valid(v_mutation->>'afterRevisionToken', 'uuid')
    ) THEN
      RETURN public.automation_commit_rejection(
        'INVALID_REQUEST', v_transaction_id,
        v_preference.server_revision, v_history.history_generation
      );
    ELSIF v_mutation->>'operation' = 'delete' AND (
      (v_mutation->'before') = 'null'::jsonb
      OR (v_mutation->'after') <> 'null'::jsonb
      OR (v_mutation->'afterRevisionToken') <> 'null'::jsonb
    ) THEN
      RETURN public.automation_commit_rejection(
        'INVALID_REQUEST', v_transaction_id,
        v_preference.server_revision, v_history.history_generation
      );
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_owner::text || ':' || v_mutation->>'entityType' || ':' || v_mutation->>'entityId',
        2102
      )
    );
  END LOOP;

  FOR v_mutation IN
    SELECT mutation.value
    FROM pg_catalog.jsonb_array_elements(p_request->'mutations') AS mutation(value)
    ORDER BY mutation.value->>'entityType', mutation.value->>'entityId'
  LOOP
    SELECT * INTO v_revision
    FROM public.automation_record_revisions
    WHERE user_id = v_owner
      AND entity_type = v_mutation->>'entityType'
      AND entity_id = v_mutation->>'entityId'
    FOR UPDATE;
    v_revision_found := FOUND;
    v_current_projection := public.automation_current_projection(
      v_owner,
      v_mutation->>'entityType',
      v_mutation->>'entityId'
    );

    IF (v_mutation->'before') = 'null'::jsonb THEN
      -- A retained deleted-state revision is still authoritative evidence that
      -- this target existed. Reject token-free re-creation so an
      -- absent -> create -> delete -> stale-create ABA cannot pass.
      IF v_revision_found THEN
        RETURN public.automation_commit_rejection(
          'TARGET_REVISION_CONFLICT', v_transaction_id,
          v_preference.server_revision, v_history.history_generation
        );
      END IF;
      IF v_current_projection IS NOT NULL
        OR (v_mutation->'beforeRevisionToken') <> 'null'::jsonb
      THEN
        RETURN public.automation_commit_rejection(
          'TARGET_REVISION_CONFLICT', v_transaction_id,
          v_preference.server_revision, v_history.history_generation
        );
      END IF;
    ELSE
      IF NOT v_revision_found OR NOT v_revision.record_exists
        OR v_revision.revision_token::text IS DISTINCT FROM v_mutation->>'beforeRevisionToken'
        OR v_revision.state_hash IS DISTINCT FROM v_mutation->>'beforeHash'
        OR v_current_projection IS NULL
        OR public.automation_hash_json(v_current_projection)
          IS DISTINCT FROM v_revision.state_hash
      THEN
        RETURN public.automation_commit_rejection(
          'TARGET_REVISION_CONFLICT', v_transaction_id,
          v_preference.server_revision, v_history.history_generation
        );
      END IF;
    END IF;
  END LOOP;

  UPDATE public.automation_history_state
  SET last_sequence = last_sequence + 1,
      updated_at = v_now
  WHERE user_id = v_owner
  RETURNING last_sequence INTO STRICT v_server_sequence;

  INSERT INTO public.automation_transactions (
    id, user_id, consent_epoch, source_key, rule_id, rule_version,
    source_type, source_id, source_revision, status, revision_ciphertext,
    device_id, server_sequence, history_generation, created_at, updated_at
  ) VALUES (
    v_transaction_id,
    v_owner,
    v_consent_epoch,
    v_expected_source_key,
    v_rule_id,
    1,
    v_source_type,
    v_source->>'id',
    v_source->>'revision',
    'committed',
    p_request->>'revisionCiphertext',
    p_request->>'deviceId',
    v_server_sequence,
    v_history.history_generation,
    v_now,
    v_now
  );

  INSERT INTO public.automation_mutations (
    transaction_id, user_id, mutation_ordinal, entity_type, entity_id,
    operation, before_hash, after_hash, before_revision_token,
    after_revision_token
  )
  SELECT
    v_transaction_id,
    v_owner,
    mutation.ordinality::integer - 1,
    mutation.value->>'entityType',
    mutation.value->>'entityId',
    mutation.value->>'operation',
    mutation.value->>'beforeHash',
    mutation.value->>'afterHash',
    NULLIF(mutation.value->>'beforeRevisionToken', '')::uuid,
    NULLIF(mutation.value->>'afterRevisionToken', '')::uuid
  FROM pg_catalog.jsonb_array_elements(p_request->'mutations')
    WITH ORDINALITY AS mutation(value, ordinality);

  FOR v_mutation IN
    SELECT mutation.value
    FROM pg_catalog.jsonb_array_elements(p_request->'mutations') AS mutation(value)
    ORDER BY mutation.value->>'entityType', mutation.value->>'entityId'
  LOOP
    PERFORM public.automation_apply_mutation(v_owner, v_transaction_id, v_mutation);
  END LOOP;

  INSERT INTO public.sync_events (
    id, user_id, entity_type, entity_id, op, payload, device_id, idempotency_key
  ) VALUES (
    extensions.gen_random_uuid(),
    v_owner,
    'automation_transaction',
    v_transaction_id::text,
    'upsert',
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'id', v_transaction_id,
      'consentEpoch', v_consent_epoch,
      'sourceKey', v_expected_source_key,
      'ruleId', v_rule_id,
      'ruleVersion', 1,
      'sourceType', v_source_type,
      'sourceId', v_source->>'id',
      'status', 'committed',
      'revisionCiphertext', p_request->>'revisionCiphertext',
      'createdAt', v_now,
      'updatedAt', v_now,
      'serverSequence', v_server_sequence,
      'historyGeneration', v_history.history_generation
    ),
    p_request->>'deviceId',
    v_transaction_id
  )
  RETURNING id, seq INTO STRICT v_event_id, v_event_seq;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'code', 'COMMITTED',
    'transactionId', v_transaction_id,
    'serverSequence', v_server_sequence,
    'historyGeneration', v_history.history_generation,
    'completedAt', v_now
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.automation_undo_rejection(
  p_code text,
  p_transaction_id uuid,
  p_history_generation bigint
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'code', p_code,
    'transactionId', p_transaction_id,
    'historyGeneration', p_history_generation
  );
$$;

CREATE OR REPLACE FUNCTION public.undo_automation_transaction(p_request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid());
  v_now bigint := public.automation_now_ms();
  v_transaction_id uuid := extensions.gen_random_uuid();
  v_operation_id uuid := extensions.gen_random_uuid();
  v_transaction public.automation_transactions%ROWTYPE;
  v_original_mutation public.automation_mutations%ROWTYPE;
  v_revision public.automation_record_revisions%ROWTYPE;
  v_revision_found boolean;
  v_history public.automation_history_state%ROWTYPE;
  v_compensation jsonb;
  v_current_projection jsonb;
  v_server_sequence bigint;
  v_event_id uuid;
  v_event_seq bigint;
BEGIN
  IF v_owner IS NULL THEN
    RETURN public.automation_undo_rejection(
      'UNAUTHORIZED', v_transaction_id, 1
    );
  END IF;
  IF p_request IS NULL OR pg_catalog.jsonb_typeof(p_request) <> 'object'
    OR p_request - ARRAY[
      'schemaVersion', 'operationId', 'transactionId', 'expectedServerSequence',
      'expectedHistoryGeneration', 'compensatingMutations', 'requestedAt',
      'deviceId'
    ] <> '{}'::jsonb
    OR p_request->>'schemaVersion' <> '1'
    OR NOT pg_catalog.pg_input_is_valid(p_request->>'operationId', 'uuid')
    OR NOT pg_catalog.pg_input_is_valid(p_request->>'transactionId', 'uuid')
  THEN
    RETURN public.automation_undo_rejection(
      'INVALID_REQUEST', v_transaction_id, 1
    );
  END IF;
  v_operation_id := (p_request->>'operationId')::uuid;
  v_transaction_id := (p_request->>'transactionId')::uuid;

  IF v_operation_id = v_transaction_id
    OR NOT pg_catalog.pg_input_is_valid(p_request->>'expectedServerSequence', 'bigint')
    OR NOT pg_catalog.pg_input_is_valid(p_request->>'expectedHistoryGeneration', 'bigint')
    OR NOT pg_catalog.pg_input_is_valid(p_request->>'requestedAt', 'bigint')
    OR length(COALESCE(p_request->>'deviceId', '')) NOT BETWEEN 1 AND 512
    OR pg_catalog.jsonb_typeof(p_request->'compensatingMutations') <> 'array'
    OR pg_catalog.jsonb_array_length(p_request->'compensatingMutations') = 0
    OR pg_catalog.jsonb_array_length(p_request->'compensatingMutations') > 32
  THEN
    RETURN public.automation_undo_rejection(
      'INVALID_REQUEST', v_transaction_id, 1
    );
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text, 2101)
  );
  INSERT INTO public.automation_history_state (user_id, updated_at)
  VALUES (v_owner, v_now)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO STRICT v_history
  FROM public.automation_history_state
  WHERE user_id = v_owner
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.automation_history_tombstones AS tombstone
    WHERE tombstone.user_id = v_owner
      AND tombstone.purged_transaction_id = v_transaction_id
  ) THEN
    RETURN public.automation_undo_rejection(
      'TRANSACTION_PURGED', v_transaction_id, v_history.history_generation
    );
  END IF;

  SELECT * INTO v_transaction
  FROM public.automation_transactions
  WHERE user_id = v_owner AND id = v_transaction_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.automation_undo_rejection(
      'TRANSACTION_NOT_FOUND', v_transaction_id, v_history.history_generation
    );
  END IF;
  IF v_transaction.status = 'undone' THEN
    RETURN pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'code', 'ALREADY_UNDONE',
      'transactionId', v_transaction.id,
      'undoTransactionId', v_transaction.undo_transaction_id,
      'serverSequence', v_transaction.server_sequence,
      'historyGeneration', v_transaction.history_generation,
      'completedAt', v_transaction.undone_at
    );
  END IF;
  IF v_history.history_generation <> (p_request->>'expectedHistoryGeneration')::bigint THEN
    RETURN public.automation_undo_rejection(
      'HISTORY_GENERATION_STALE', v_transaction_id, v_history.history_generation
    );
  END IF;
  IF v_transaction.server_sequence <> (p_request->>'expectedServerSequence')::bigint THEN
    RETURN public.automation_undo_rejection(
      'TARGET_REVISION_CONFLICT', v_transaction_id, v_history.history_generation
    );
  END IF;
  IF pg_catalog.jsonb_array_length(p_request->'compensatingMutations') <> (
    SELECT count(*)
    FROM public.automation_mutations AS mutation
    WHERE mutation.user_id = v_owner AND mutation.transaction_id = v_transaction_id
  ) THEN
    RETURN public.automation_undo_rejection(
      'INVALID_REQUEST', v_transaction_id, v_history.history_generation
    );
  END IF;

  FOR v_compensation IN
    SELECT compensation.value
    FROM pg_catalog.jsonb_array_elements(
      p_request->'compensatingMutations'
    ) AS compensation(value)
    ORDER BY compensation.value->>'entityType', compensation.value->>'entityId'
  LOOP
    IF pg_catalog.jsonb_typeof(v_compensation) <> 'object'
      OR v_compensation - ARRAY[
        'entityType', 'entityId', 'operation', 'before', 'after',
        'beforeHash', 'afterHash', 'beforeRevisionToken', 'afterRevisionToken'
      ] <> '{}'::jsonb
    THEN
      RETURN public.automation_undo_rejection(
        'INVALID_REQUEST', v_transaction_id, v_history.history_generation
      );
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_owner::text || ':' || v_compensation->>'entityType'
          || ':' || v_compensation->>'entityId',
        2102
      )
    );
  END LOOP;

  FOR v_compensation IN
    SELECT compensation.value
    FROM pg_catalog.jsonb_array_elements(
      p_request->'compensatingMutations'
    ) AS compensation(value)
    ORDER BY compensation.value->>'entityType', compensation.value->>'entityId'
  LOOP
    SELECT * INTO v_original_mutation
    FROM public.automation_mutations AS mutation
    WHERE mutation.user_id = v_owner
      AND mutation.transaction_id = v_transaction_id
      AND mutation.entity_type = v_compensation->>'entityType'
      AND mutation.entity_id = v_compensation->>'entityId';
    IF NOT FOUND
      OR v_compensation->>'beforeHash' IS DISTINCT FROM v_original_mutation.after_hash
      OR v_compensation->>'afterHash' IS DISTINCT FROM v_original_mutation.before_hash
      OR v_compensation->>'beforeRevisionToken'
        IS DISTINCT FROM v_original_mutation.after_revision_token::text
      OR public.automation_hash_json(v_compensation->'before')
        IS DISTINCT FROM v_original_mutation.after_hash
      OR public.automation_hash_json(v_compensation->'after')
        IS DISTINCT FROM v_original_mutation.before_hash
    THEN
      RETURN public.automation_undo_rejection(
        'INVALID_REQUEST', v_transaction_id, v_history.history_generation
      );
    END IF;

    IF v_original_mutation.before_revision_token IS NULL THEN
      IF v_compensation->>'operation' <> 'delete'
        OR (v_compensation->'after') <> 'null'::jsonb
        OR (v_compensation->'afterRevisionToken') <> 'null'::jsonb
      THEN
        RETURN public.automation_undo_rejection(
          'INVALID_REQUEST', v_transaction_id, v_history.history_generation
        );
      END IF;
    ELSE
      IF v_compensation->>'operation' <> 'upsert'
        OR (v_compensation->'after') = 'null'::jsonb
        OR NOT pg_catalog.pg_input_is_valid(
          v_compensation->>'afterRevisionToken',
          'uuid'
        )
      THEN
        RETURN public.automation_undo_rejection(
          'INVALID_REQUEST', v_transaction_id, v_history.history_generation
        );
      END IF;
    END IF;

    SELECT * INTO v_revision
    FROM public.automation_record_revisions
    WHERE user_id = v_owner
      AND entity_type = v_original_mutation.entity_type
      AND entity_id = v_original_mutation.entity_id
    FOR UPDATE;
    v_revision_found := FOUND;
    v_current_projection := public.automation_current_projection(
      v_owner,
      v_original_mutation.entity_type,
      v_original_mutation.entity_id
    );
    IF NOT v_revision_found OR NOT v_revision.record_exists
      OR v_revision.revision_token IS DISTINCT FROM v_original_mutation.after_revision_token
      OR v_revision.state_hash IS DISTINCT FROM v_original_mutation.after_hash
      OR v_revision.transaction_id IS DISTINCT FROM v_transaction_id
      OR v_current_projection IS NULL
      OR public.automation_hash_json(v_current_projection)
        IS DISTINCT FROM v_original_mutation.after_hash
    THEN
      RETURN public.automation_undo_rejection(
        'TARGET_REVISION_CONFLICT', v_transaction_id, v_history.history_generation
      );
    END IF;
  END LOOP;

  UPDATE public.automation_history_state
  SET last_sequence = last_sequence + 1,
      updated_at = v_now
  WHERE user_id = v_owner
  RETURNING last_sequence INTO STRICT v_server_sequence;

  FOR v_compensation IN
    SELECT compensation.value
    FROM pg_catalog.jsonb_array_elements(
      p_request->'compensatingMutations'
    ) AS compensation(value)
    ORDER BY compensation.value->>'entityType', compensation.value->>'entityId'
  LOOP
    PERFORM public.automation_apply_mutation(v_owner, v_operation_id, v_compensation);
  END LOOP;

  UPDATE public.automation_transactions
  SET status = 'undone',
      server_sequence = v_server_sequence,
      history_generation = v_history.history_generation,
      updated_at = v_now,
      undone_at = v_now,
      undo_transaction_id = v_operation_id
  WHERE user_id = v_owner AND id = v_transaction_id;

  INSERT INTO public.sync_events (
    id, user_id, entity_type, entity_id, op, payload, device_id, idempotency_key
  ) VALUES (
    extensions.gen_random_uuid(),
    v_owner,
    'automation_transaction',
    v_transaction_id::text,
    'upsert',
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'id', v_transaction.id,
      'consentEpoch', v_transaction.consent_epoch,
      'sourceKey', v_transaction.source_key,
      'ruleId', v_transaction.rule_id,
      'ruleVersion', v_transaction.rule_version,
      'sourceType', v_transaction.source_type,
      'sourceId', v_transaction.source_id,
      'status', 'undone',
      'revisionCiphertext', v_transaction.revision_ciphertext,
      'createdAt', v_transaction.created_at,
      'updatedAt', v_now,
      'undoneAt', v_now,
      'undoTransactionId', v_operation_id,
      'serverSequence', v_server_sequence,
      'historyGeneration', v_history.history_generation
    ),
    p_request->>'deviceId',
    v_operation_id
  )
  RETURNING id, seq INTO STRICT v_event_id, v_event_seq;

  -- Materialize permanent top-level tombstones for automation-created mood
  -- and journal rows. The same single encrypted automation event supplies the
  -- ordered sync sequence; no plaintext compensation enters sync_events.
  INSERT INTO public.sync_tombstones (
    user_id, entity_type, entity_id, deleted_seq, deleted_event_id,
    device_id, deleted_at
  )
  SELECT
    v_owner,
    compensation.value->>'entityType',
    compensation.value->>'entityId',
    v_event_seq,
    v_event_id,
    p_request->>'deviceId',
    pg_catalog.clock_timestamp()
  FROM pg_catalog.jsonb_array_elements(
    p_request->'compensatingMutations'
  ) AS compensation(value)
  WHERE compensation.value->>'operation' = 'delete'
    AND compensation.value->>'entityType' IN ('mood', 'journal')
  ON CONFLICT (user_id, entity_type, entity_id)
  DO UPDATE SET
    deleted_seq = EXCLUDED.deleted_seq,
    deleted_event_id = EXCLUDED.deleted_event_id,
    device_id = EXCLUDED.device_id,
    deleted_at = EXCLUDED.deleted_at
  WHERE public.sync_tombstones.deleted_seq < EXCLUDED.deleted_seq;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'code', 'UNDONE',
    'transactionId', v_transaction_id,
    'undoTransactionId', v_operation_id,
    'serverSequence', v_server_sequence,
    'historyGeneration', v_history.history_generation,
    'completedAt', v_now
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_automation_history_snapshot(
  p_snapshot_token jsonb DEFAULT NULL,
  p_cursor jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid());
  v_history public.automation_history_state%ROWTYPE;
  v_token jsonb;
  v_transactions jsonb := '[]'::jsonb;
  v_tombstones jsonb := '[]'::jsonb;
  v_record_revisions jsonb := '[]'::jsonb;
  v_transaction_after_sequence bigint := 0;
  v_tombstone_after_sequence bigint := 0;
  v_tombstone_after_transaction_id uuid;
  v_revision_after_entity_type text;
  v_revision_after_entity_id text;
  v_transactions_complete boolean := false;
  v_tombstones_complete boolean := false;
  v_record_revisions_complete boolean := false;
  v_transactions_more boolean := false;
  v_tombstones_more boolean := false;
  v_record_revisions_more boolean := false;
  v_next_cursor jsonb;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_history
  FROM public.automation_history_state
  WHERE user_id = v_owner;
  IF NOT FOUND THEN
    v_history.user_id := v_owner;
    v_history.history_generation := 1;
    v_history.last_sequence := 0;
    v_history.record_revision_version := 0;
  END IF;

  v_token := pg_catalog.jsonb_build_object(
    'historyGeneration', v_history.history_generation,
    'snapshotSequence', v_history.last_sequence,
    'recordRevisionVersion', v_history.record_revision_version
  );
  IF p_snapshot_token IS NOT NULL AND p_snapshot_token IS DISTINCT FROM v_token THEN
    RETURN pg_catalog.jsonb_build_object(
      'schemaVersion', 2,
      'code', 'SNAPSHOT_STALE'
    );
  END IF;

  IF p_cursor IS NOT NULL THEN
    IF p_snapshot_token IS NULL
      OR pg_catalog.jsonb_typeof(p_cursor) <> 'object'
      OR NOT pg_catalog.pg_input_is_valid(
        COALESCE(p_cursor->>'transactionAfterSequence', ''), 'bigint'
      )
      OR NOT pg_catalog.pg_input_is_valid(
        COALESCE(p_cursor->>'tombstoneAfterSequence', ''), 'bigint'
      )
      OR NOT pg_catalog.pg_input_is_valid(
        COALESCE(p_cursor->>'transactionsComplete', ''), 'boolean'
      )
      OR NOT pg_catalog.pg_input_is_valid(
        COALESCE(p_cursor->>'tombstonesComplete', ''), 'boolean'
      )
      OR NOT pg_catalog.pg_input_is_valid(
        COALESCE(p_cursor->>'recordRevisionsComplete', ''), 'boolean'
      )
      OR (p_cursor->>'transactionAfterSequence')::bigint < 0
      OR (p_cursor->>'tombstoneAfterSequence')::bigint < 0
      OR (
        p_cursor->>'tombstoneAfterTransactionId' IS NOT NULL
        AND NOT pg_catalog.pg_input_is_valid(
          p_cursor->>'tombstoneAfterTransactionId', 'uuid'
        )
      )
      OR (
        (p_cursor->>'recordRevisionAfterEntityType' IS NULL)
        <> (p_cursor->>'recordRevisionAfterEntityId' IS NULL)
      )
      OR (
        p_cursor->>'recordRevisionAfterEntityType' IS NOT NULL
        AND p_cursor->>'recordRevisionAfterEntityType'
          NOT IN ('mood', 'habit_completion', 'journal', 'setting')
      )
      OR length(COALESCE(p_cursor->>'recordRevisionAfterEntityId', '')) > 512
    THEN
      RAISE EXCEPTION 'Invalid automation snapshot cursor' USING ERRCODE = '22023';
    END IF;
    v_transaction_after_sequence := (p_cursor->>'transactionAfterSequence')::bigint;
    v_tombstone_after_sequence := (p_cursor->>'tombstoneAfterSequence')::bigint;
    v_tombstone_after_transaction_id :=
      (p_cursor->>'tombstoneAfterTransactionId')::uuid;
    v_revision_after_entity_type := p_cursor->>'recordRevisionAfterEntityType';
    v_revision_after_entity_id := p_cursor->>'recordRevisionAfterEntityId';
    v_transactions_complete := (p_cursor->>'transactionsComplete')::boolean;
    v_tombstones_complete := (p_cursor->>'tombstonesComplete')::boolean;
    v_record_revisions_complete :=
      (p_cursor->>'recordRevisionsComplete')::boolean;
  END IF;

  IF NOT v_transactions_complete THEN
    SELECT COALESCE(
      pg_catalog.jsonb_agg(snapshot.row ORDER BY snapshot.server_sequence),
      '[]'::jsonb
    ) INTO v_transactions
    FROM (
      SELECT
        transaction.server_sequence,
        pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
          'id', transaction.id,
          'consentEpoch', transaction.consent_epoch,
          'sourceKey', transaction.source_key,
          'ruleId', transaction.rule_id,
          'ruleVersion', transaction.rule_version,
          'sourceType', transaction.source_type,
          'sourceId', transaction.source_id,
          'status', transaction.status,
          'revisionCiphertext', transaction.revision_ciphertext,
          'createdAt', transaction.created_at,
          'updatedAt', transaction.updated_at,
          'undoneAt', transaction.undone_at,
          'undoTransactionId', transaction.undo_transaction_id,
          'serverSequence', transaction.server_sequence,
          'historyGeneration', transaction.history_generation,
          'schemaVersion', 1
        )) AS row
      FROM public.automation_transactions AS transaction
      WHERE transaction.user_id = v_owner
        AND transaction.history_generation = v_history.history_generation
        AND transaction.server_sequence > v_transaction_after_sequence
        AND NOT EXISTS (
          SELECT 1
          FROM public.automation_history_tombstones AS tombstone
          WHERE tombstone.user_id = v_owner
            AND tombstone.purged_transaction_id = transaction.id
        )
      ORDER BY transaction.server_sequence
      LIMIT 128
    ) AS snapshot;
    IF pg_catalog.jsonb_array_length(v_transactions) > 0 THEN
      v_transaction_after_sequence :=
        (v_transactions->-1->>'serverSequence')::bigint;
    END IF;
    SELECT EXISTS (
      SELECT 1
      FROM public.automation_transactions AS transaction
      WHERE transaction.user_id = v_owner
        AND transaction.history_generation = v_history.history_generation
        AND transaction.server_sequence > v_transaction_after_sequence
        AND NOT EXISTS (
          SELECT 1
          FROM public.automation_history_tombstones AS tombstone
          WHERE tombstone.user_id = v_owner
            AND tombstone.purged_transaction_id = transaction.id
        )
    ) INTO v_transactions_more;
    v_transactions_complete := NOT v_transactions_more;
  END IF;

  IF NOT v_tombstones_complete THEN
    SELECT COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'transactionId', tombstone.purged_transaction_id,
          'purgedAt', tombstone.purged_at,
          'serverSequence', tombstone.server_sequence
        ) ORDER BY tombstone.server_sequence, tombstone.purged_transaction_id
      ),
      '[]'::jsonb
    ) INTO v_tombstones
    FROM (
      SELECT tombstone.*
      FROM public.automation_history_tombstones AS tombstone
      WHERE tombstone.user_id = v_owner
        AND tombstone.history_generation = v_history.history_generation
        AND (
          tombstone.server_sequence > v_tombstone_after_sequence
          OR (
            tombstone.server_sequence = v_tombstone_after_sequence
            AND tombstone.purged_transaction_id > COALESCE(
              v_tombstone_after_transaction_id,
              '00000000-0000-0000-0000-000000000000'::uuid
            )
          )
        )
      ORDER BY tombstone.server_sequence, tombstone.purged_transaction_id
      LIMIT 128
    ) AS tombstone;
    IF pg_catalog.jsonb_array_length(v_tombstones) > 0 THEN
      v_tombstone_after_sequence :=
        (v_tombstones->-1->>'serverSequence')::bigint;
      v_tombstone_after_transaction_id :=
        (v_tombstones->-1->>'transactionId')::uuid;
    END IF;
    SELECT EXISTS (
      SELECT 1
      FROM public.automation_history_tombstones AS tombstone
      WHERE tombstone.user_id = v_owner
        AND tombstone.history_generation = v_history.history_generation
        AND (
          tombstone.server_sequence > v_tombstone_after_sequence
          OR (
            tombstone.server_sequence = v_tombstone_after_sequence
            AND tombstone.purged_transaction_id > COALESCE(
              v_tombstone_after_transaction_id,
              '00000000-0000-0000-0000-000000000000'::uuid
            )
          )
        )
    ) INTO v_tombstones_more;
    v_tombstones_complete := NOT v_tombstones_more;
  END IF;

  IF NOT v_record_revisions_complete THEN
    SELECT COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'entityType', revision.entity_type,
          'entityId', revision.entity_id,
          'recordExists', revision.record_exists,
          'revisionToken', revision.revision_token,
          'stateHash', revision.state_hash,
          'mutationGeneration', revision.mutation_generation,
          'transactionId', revision.transaction_id,
          'updatedAt', revision.updated_at
        ) ORDER BY revision.entity_type, revision.entity_id
      ),
      '[]'::jsonb
    ) INTO v_record_revisions
    FROM (
      SELECT revision.*
      FROM public.automation_record_revisions AS revision
      WHERE revision.user_id = v_owner
        AND (
          revision.entity_type > COALESCE(v_revision_after_entity_type, '')
          OR (
            revision.entity_type = COALESCE(v_revision_after_entity_type, '')
            AND revision.entity_id > COALESCE(v_revision_after_entity_id, '')
          )
        )
      ORDER BY revision.entity_type, revision.entity_id
      LIMIT 128
    ) AS revision;
    IF pg_catalog.jsonb_array_length(v_record_revisions) > 0 THEN
      v_revision_after_entity_type :=
        v_record_revisions->-1->>'entityType';
      v_revision_after_entity_id :=
        v_record_revisions->-1->>'entityId';
    END IF;
    SELECT EXISTS (
      SELECT 1
      FROM public.automation_record_revisions AS revision
      WHERE revision.user_id = v_owner
        AND (
          revision.entity_type > COALESCE(v_revision_after_entity_type, '')
          OR (
            revision.entity_type = COALESCE(v_revision_after_entity_type, '')
            AND revision.entity_id > COALESCE(v_revision_after_entity_id, '')
          )
        )
    ) INTO v_record_revisions_more;
    v_record_revisions_complete := NOT v_record_revisions_more;
  END IF;

  IF v_transactions_complete
    AND v_tombstones_complete
    AND v_record_revisions_complete
  THEN
    v_next_cursor := NULL;
  ELSE
    v_next_cursor := pg_catalog.jsonb_build_object(
      'transactionAfterSequence', v_transaction_after_sequence,
      'tombstoneAfterSequence', v_tombstone_after_sequence,
      'tombstoneAfterTransactionId', v_tombstone_after_transaction_id,
      'recordRevisionAfterEntityType', v_revision_after_entity_type,
      'recordRevisionAfterEntityId', v_revision_after_entity_id,
      'transactionsComplete', v_transactions_complete,
      'tombstonesComplete', v_tombstones_complete,
      'recordRevisionsComplete', v_record_revisions_complete
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 2,
    'code', 'PAGE',
    'snapshotToken', v_token,
    'tombstones', v_tombstones,
    'transactions', v_transactions,
    'recordRevisions', v_record_revisions,
    'nextCursor', v_next_cursor
  ) || CASE
    WHEN v_history.all_history_purged_at IS NULL THEN '{}'::jsonb
    ELSE pg_catalog.jsonb_build_object(
      'allHistoryPurgedAt', v_history.all_history_purged_at
    )
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_automation_history(
  p_operation_id uuid,
  p_transaction_ids uuid[],
  p_all boolean,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid());
  v_now bigint := public.automation_now_ms();
  v_history public.automation_history_state%ROWTYPE;
  v_preference public.automation_preferences%ROWTYPE;
  v_server_sequence bigint;
  v_detached_revision_count bigint := 0;
  v_purged_ids uuid[] := '{}';
  v_result jsonb;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL
    OR length(COALESCE(p_device_id, '')) NOT BETWEEN 1 AND 512
    OR p_all IS NULL
    OR (p_all AND COALESCE(pg_catalog.cardinality(p_transaction_ids), 0) <> 0)
    OR (NOT p_all AND COALESCE(pg_catalog.cardinality(p_transaction_ids), 0) = 0)
    OR COALESCE(pg_catalog.cardinality(p_transaction_ids), 0) > 512
    OR (
      SELECT count(*) <> count(DISTINCT transaction_id)
      FROM pg_catalog.unnest(COALESCE(p_transaction_ids, '{}'::uuid[])) AS transaction_id
    )
  THEN
    RAISE EXCEPTION 'Invalid automation history purge request' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text, 2101)
  );
  SELECT event.payload INTO v_result
  FROM public.sync_events AS event
  WHERE event.user_id = v_owner
    AND event.idempotency_key = p_operation_id
    AND event.entity_type = 'automation_history_purge'
    AND event.entity_id = p_operation_id::text;
  IF FOUND THEN
    RETURN v_result;
  END IF;

  INSERT INTO public.automation_history_state (user_id, updated_at)
  VALUES (v_owner, v_now)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO STRICT v_history
  FROM public.automation_history_state
  WHERE user_id = v_owner
  FOR UPDATE;

  IF p_all THEN
    INSERT INTO public.automation_preferences (user_id, updated_at)
    VALUES (v_owner, v_now)
    ON CONFLICT (user_id) DO NOTHING;
    UPDATE public.automation_preferences
    SET server_revision = server_revision + 1,
        enabled = false,
        consent_epoch = NULL,
        revoked_at = GREATEST(v_now, COALESCE(consented_at, 0)),
        updated_at = v_now
    WHERE user_id = v_owner;
    SELECT * INTO STRICT v_preference
    FROM public.automation_preferences
    WHERE user_id = v_owner;

    UPDATE public.automation_history_state
    SET history_generation = history_generation + 1,
        last_sequence = last_sequence + 1,
        all_history_purged_at = v_now,
        updated_at = v_now
    WHERE user_id = v_owner
    RETURNING history_generation, last_sequence
      INTO STRICT v_history.history_generation, v_server_sequence;
    SELECT COALESCE(array_agg(transaction.id ORDER BY transaction.server_sequence), '{}')
    INTO v_purged_ids
    FROM public.automation_transactions AS transaction
    WHERE transaction.user_id = v_owner;
  ELSE
    SELECT COALESCE(array_agg(requested.transaction_id ORDER BY requested.transaction_id), '{}')
    INTO v_purged_ids
    FROM pg_catalog.unnest(p_transaction_ids) AS requested(transaction_id)
    WHERE EXISTS (
      SELECT 1
      FROM public.automation_transactions AS transaction
      WHERE transaction.user_id = v_owner
        AND transaction.id = requested.transaction_id
    ) OR EXISTS (
      SELECT 1
      FROM public.automation_history_tombstones AS tombstone
      WHERE tombstone.user_id = v_owner
        AND tombstone.purged_transaction_id = requested.transaction_id
    );
    IF pg_catalog.cardinality(v_purged_ids)
      <> pg_catalog.cardinality(p_transaction_ids)
    THEN
      RAISE EXCEPTION 'Automation history transaction not found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.automation_history_state
    SET last_sequence = last_sequence + 1,
        updated_at = v_now
    WHERE user_id = v_owner
    RETURNING history_generation, last_sequence
      INTO STRICT v_history.history_generation, v_server_sequence;
  END IF;

  INSERT INTO public.automation_history_tombstones (
    user_id, purged_transaction_id, purged_at, server_sequence, history_generation
  )
  SELECT
    v_owner,
    transaction_id,
    v_now,
    v_server_sequence,
    v_history.history_generation
  FROM pg_catalog.unnest(v_purged_ids) AS transaction_id
  ON CONFLICT (user_id, purged_transaction_id) DO UPDATE SET
    purged_at = GREATEST(
      public.automation_history_tombstones.purged_at,
      EXCLUDED.purged_at
    ),
    server_sequence = GREATEST(
      public.automation_history_tombstones.server_sequence,
      EXCLUDED.server_sequence
    ),
    history_generation = GREATEST(
      public.automation_history_tombstones.history_generation,
      EXCLUDED.history_generation
    );

  -- Forget automation ownership while retaining the opaque current revision
  -- token needed for future CAS. Undo-operation IDs are also detached.
  UPDATE public.automation_record_revisions AS revision
  SET transaction_id = NULL,
      updated_at = GREATEST(revision.updated_at, v_now)
  WHERE revision.user_id = v_owner
    AND EXISTS (
      SELECT 1
      FROM public.automation_transactions AS transaction
      WHERE transaction.user_id = v_owner
        AND transaction.id = ANY(v_purged_ids)
        AND revision.transaction_id IN (
          transaction.id,
          transaction.undo_transaction_id
        )
    );
  GET DIAGNOSTICS v_detached_revision_count = ROW_COUNT;
  IF v_detached_revision_count > 0 THEN
    UPDATE public.automation_history_state
    SET record_revision_version = record_revision_version + 1,
        updated_at = GREATEST(updated_at, v_now)
    WHERE user_id = v_owner;
  END IF;

  DELETE FROM public.automation_transactions AS transaction
  WHERE transaction.user_id = v_owner
    AND transaction.id = ANY(v_purged_ids);

  -- The all-history generation marker rejects every older event/backup, so
  -- prior per-item tombstones are no longer needed for anti-resurrection and
  -- cannot grow without bound across clear-all cycles.
  IF p_all THEN
    DELETE FROM public.automation_history_tombstones AS tombstone
    WHERE tombstone.user_id = v_owner;
  END IF;

  v_result := pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'operationId', p_operation_id,
    'historyGeneration', v_history.history_generation,
    'serverSequence', v_server_sequence,
    'completedAt', v_now,
    'allHistoryPurgedAt', CASE WHEN p_all THEN v_now ELSE NULL END,
    'purgedTransactionIds', pg_catalog.to_jsonb(v_purged_ids),
    'preference', CASE
      WHEN p_all THEN public.automation_preference_payload(v_preference)
      ELSE NULL
    END
  );

  INSERT INTO public.sync_events (
    id, user_id, entity_type, entity_id, op, payload, device_id, idempotency_key
  ) VALUES (
    extensions.gen_random_uuid(),
    v_owner,
    'automation_history_purge',
    p_operation_id::text,
    'upsert',
    v_result,
    p_device_id,
    p_operation_id
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.automation_now_ms() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_canonical_json(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_hash_json(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_source_key(uuid, uuid, text, integer, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_preference_payload(public.automation_preferences)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_reserved_automation_setting()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_automation_record_revision()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_current_projection(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_apply_mutation(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_commit_rejection(text, uuid, bigint, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_undo_rejection(text, uuid, bigint)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_automation_preference()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_automation_preference(bigint, text[], text, integer, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_automation_preference_with_planning(
  bigint, text[], text, integer, jsonb, jsonb, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_automation_preference()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_automation_transaction(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.undo_automation_transaction(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_automation_history_snapshot(jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_automation_history(uuid, uuid[], boolean, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_automation_preference() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_automation_preference(bigint, text[], text, integer, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_automation_preference_with_planning(
  bigint, text[], text, integer, jsonb, jsonb, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_automation_preference() TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_automation_transaction(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_automation_transaction(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_automation_history_snapshot(jsonb, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_automation_history(uuid, uuid[], boolean, text)
  TO authenticated;

COMMENT ON TABLE public.automation_transactions IS
  'Owner-bound encrypted connected-record history. Non-encrypted columns contain identifiers and fixed metadata only.';
COMMENT ON TABLE public.automation_mutations IS
  'Prose-free CAS metadata for connected-record commit and undo. Domain before/after values are never stored here.';
COMMENT ON FUNCTION public.commit_automation_transaction(jsonb) IS
  'Atomically validates consent and every planned-before token, applies one bounded connected-record batch, stores its encrypted ledger row, and emits one ordered event.';
COMMENT ON FUNCTION public.set_automation_preference_with_planning(
  bigint, text[], text, integer, jsonb, jsonb, text
) IS
  'Atomically enables connected records, replaces only explicitly owned habit planning blocks, and returns the authoritative schedule revision.';
COMMENT ON FUNCTION public.undo_automation_transaction(jsonb) IS
  'Atomically compares exact after tokens, applies one compensating batch, materializes deletion tombstones, and returns the canonical idempotent result.';
COMMENT ON FUNCTION public.get_automation_history_snapshot(jsonb, jsonb) IS
  'Returns one owner-bound keyset page. A generation, sequence and record-revision token makes multi-request bootstrap restart instead of mixing snapshots.';

INSERT INTO public.design_flags (
  key, enabled, rollout_percent, killswitch, description
) VALUES (
  'automation.connected-records.v1',
  false,
  0,
  false,
  'Fail-closed operator control for encrypted connected-record writes'
)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
