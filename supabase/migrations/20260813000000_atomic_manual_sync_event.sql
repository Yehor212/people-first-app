-- T170: accept one durable manual mutation and its ordered sync event in the
-- same server transaction. The operation id is the immutable replay receipt;
-- a retry returns the original event without touching the domain row again.
--
-- Rollback is forward-only: disable callers first, then replace this function
-- with a compatibility implementation. Do not delete accepted rows, revision
-- history, or sync events. Kill the feature if receipt validation fails.

-- The original moods trigger always overwrites updated_at during UPDATE. That
-- is correct for ordinary table writes, but it would invalidate the canonical
-- projection hash selected by the authenticated automation/manual acceptance
-- transaction. Keep the legacy behavior outside the internal write boundary
-- and preserve the exact accepted timestamp only inside that boundary.
CREATE OR REPLACE FUNCTION public.update_moods_updated_at_for_accepted_write()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(
    pg_catalog.current_setting('zenflow.automation_internal', true),
    ''
  ) <> 'on' THEN
    NEW.updated_at := pg_catalog.now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_moods_updated_at_for_accepted_write()
  FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS update_moods_updated_at ON public.moods;
CREATE TRIGGER update_moods_updated_at
  BEFORE UPDATE ON public.moods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_moods_updated_at_for_accepted_write();

CREATE OR REPLACE FUNCTION public.commit_manual_sync_event(p_request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid());
  v_operation_id uuid;
  v_entity_type text;
  v_entity_id text;
  v_operation text;
  v_projection jsonb;
  v_device_id text;
  v_now bigint;
  v_accepted_at timestamptz;
  v_event_payload jsonb;
  v_existing_payload jsonb;
  v_requested_payload jsonb;
  v_existing_event public.sync_events%ROWTYPE;
  v_event public.sync_events%ROWTYPE;
  v_mood public.moods%ROWTYPE;
  v_journal public.journal_entries%ROWTYPE;
  v_completion public.habit_completions%ROWTYPE;
  v_focus public.focus_sessions%ROWTYPE;
  v_revision public.automation_record_revisions%ROWTYPE;
  v_revision_entity_id text;
  v_after_hash text;
  v_revision_token uuid;
  v_deleted_count bigint := 0;
  v_written_count bigint := 0;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'MANUAL_SYNC_UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  IF p_request IS NULL
    OR pg_catalog.jsonb_typeof(p_request) <> 'object'
    OR p_request - ARRAY[
      'schemaVersion', 'operationId', 'entityType', 'entityId',
      'op', 'projection', 'deviceId'
    ] <> '{}'::jsonb
    OR p_request->>'schemaVersion' <> '1'
    OR NOT pg_catalog.pg_input_is_valid(p_request->>'operationId', 'uuid')
    OR length(COALESCE(p_request->>'entityId', '')) NOT BETWEEN 1 AND 512
    OR length(COALESCE(p_request->>'deviceId', '')) NOT BETWEEN 1 AND 512
    OR pg_catalog.octet_length(COALESCE((p_request->'projection')::text, '')) > 1048576
  THEN
    RAISE EXCEPTION 'MANUAL_SYNC_INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;

  v_operation_id := (p_request->>'operationId')::uuid;
  v_entity_type := p_request->>'entityType';
  v_entity_id := p_request->>'entityId';
  v_operation := p_request->>'op';
  v_projection := p_request->'projection';
  v_device_id := p_request->>'deviceId';

  IF (v_entity_type, v_operation) NOT IN (
    ('mood', 'upsert'),
    ('journal', 'upsert'),
    ('habit_completion', 'upsert'),
    ('habit_completion', 'delete'),
    ('setting', 'upsert'),
    ('focus', 'upsert')
  ) OR (
    v_operation = 'delete' AND v_projection <> 'null'::jsonb
  ) OR (
    v_operation = 'upsert'
    AND v_entity_type <> 'setting'
    AND pg_catalog.jsonb_typeof(v_projection) <> 'object'
  ) OR (
    v_entity_type = 'setting'
    AND (
      v_entity_id <> 'zenflow-schedule-events'
      OR pg_catalog.jsonb_typeof(v_projection) <> 'array'
      OR pg_catalog.octet_length(v_projection::text) > 262144
    )
  ) THEN
    RAISE EXCEPTION 'MANUAL_SYNC_INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;

  -- Parse and normalize the caller projection before taking any write lock.
  -- The ordered payload is produced from this normalized server row rather
  -- than trusting a second, potentially divergent client payload.
  CASE v_entity_type
    WHEN 'mood' THEN
      IF NOT pg_catalog.pg_input_is_valid(v_entity_id, 'uuid')
        OR v_projection - ARRAY[
          'id', 'mood', 'note', 'tags', 'date', 'timestamp', 'emotion',
          'valence', 'log_type', 'emotion_tags', 'contexts', 'updated_at'
        ] <> '{}'::jsonb
      THEN
        RAISE EXCEPTION 'MANUAL_SYNC_INVALID_REQUEST' USING ERRCODE = '22023';
      END IF;
      v_mood := pg_catalog.jsonb_populate_record(
        NULL::public.moods,
        v_projection || pg_catalog.jsonb_build_object('user_id', v_owner)
      );
      IF v_mood.id IS DISTINCT FROM v_entity_id::uuid
        OR v_mood.user_id IS DISTINCT FROM v_owner
      THEN
        RAISE EXCEPTION 'MANUAL_SYNC_INVALID_REQUEST' USING ERRCODE = '22023';
      END IF;

    WHEN 'journal' THEN
      IF v_projection - ARRAY[
        'id', 'date', 'title', 'content', 'stickers', 'mood', 'tags',
        'template_id', 'habit_snapshot', 'photo_ids', 'audio_ids',
        'created_at', 'updated_at', 'bg_intensity', 'bg_pattern', 'font',
        'font_size', 'ink_color', 'paper_color', 'paper_texture',
        'particle_speed', 'photo_layout', 'theme'
      ] <> '{}'::jsonb
      THEN
        RAISE EXCEPTION 'MANUAL_SYNC_INVALID_REQUEST' USING ERRCODE = '22023';
      END IF;
      v_journal := pg_catalog.jsonb_populate_record(
        NULL::public.journal_entries,
        v_projection || pg_catalog.jsonb_build_object('user_id', v_owner)
      );
      IF v_journal.id IS DISTINCT FROM v_entity_id
        OR v_journal.user_id IS DISTINCT FROM v_owner
        OR length(v_journal.id) NOT BETWEEN 1 AND 512
      THEN
        RAISE EXCEPTION 'MANUAL_SYNC_INVALID_REQUEST' USING ERRCODE = '22023';
      END IF;

    WHEN 'habit_completion' THEN
      IF v_operation = 'upsert' THEN
        IF v_projection - ARRAY[
          'habit_id', 'date', 'count', 'duration', 'entry_status',
          'entry_value', 'habit_type', 'is_complete', 'target_type'
        ] <> '{}'::jsonb
        THEN
          RAISE EXCEPTION 'MANUAL_SYNC_INVALID_REQUEST' USING ERRCODE = '22023';
        END IF;
        v_completion := pg_catalog.jsonb_populate_record(
          NULL::public.habit_completions,
          v_projection || pg_catalog.jsonb_build_object('user_id', v_owner)
        );
        IF v_completion.user_id IS DISTINCT FROM v_owner
          OR v_completion.habit_id::text || '_' || v_completion.date::text <> v_entity_id
          OR NOT EXISTS (
            SELECT 1
            FROM public.habits AS habit
            WHERE habit.id = v_completion.habit_id
              AND habit.user_id = v_owner
          )
        THEN
          RAISE EXCEPTION 'MANUAL_SYNC_INVALID_REQUEST' USING ERRCODE = '22023';
        END IF;
      ELSE
        IF v_entity_id !~ '^[0-9a-fA-F-]{36}_[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          OR NOT pg_catalog.pg_input_is_valid(
            pg_catalog.split_part(v_entity_id, '_', 1),
            'uuid'
          )
          OR NOT pg_catalog.pg_input_is_valid(
            pg_catalog.split_part(v_entity_id, '_', 2),
            'date'
          )
        THEN
          RAISE EXCEPTION 'MANUAL_SYNC_INVALID_REQUEST' USING ERRCODE = '22023';
        END IF;
      END IF;

    WHEN 'focus' THEN
      IF NOT pg_catalog.pg_input_is_valid(v_entity_id, 'uuid')
        OR v_projection - ARRAY[
          'id', 'duration', 'label', 'status', 'reflection', 'date',
          'completed_at', 'updated_at'
        ] <> '{}'::jsonb
      THEN
        RAISE EXCEPTION 'MANUAL_SYNC_INVALID_REQUEST' USING ERRCODE = '22023';
      END IF;
      v_focus := pg_catalog.jsonb_populate_record(
        NULL::public.focus_sessions,
        v_projection || pg_catalog.jsonb_build_object('user_id', v_owner)
      );
      IF v_focus.id IS DISTINCT FROM v_entity_id::uuid
        OR v_focus.user_id IS DISTINCT FROM v_owner
      THEN
        RAISE EXCEPTION 'MANUAL_SYNC_INVALID_REQUEST' USING ERRCODE = '22023';
      END IF;

    WHEN 'setting' THEN
      NULL;
  END CASE;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text, 2101)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_owner::text || ':' || v_entity_type || ':' ||
      CASE
        WHEN v_entity_type = 'habit_completion'
          THEN pg_catalog.replace(v_entity_id, '_', ':')
        ELSE v_entity_id
      END,
      2102
    )
  );

  v_now := public.automation_now_ms();
  IF v_entity_type = 'journal' THEN
    SELECT GREATEST(v_now, COALESCE(entry.updated_at, 0) + 1)
    INTO v_now
    FROM public.journal_entries AS entry
    WHERE entry.user_id = v_owner AND entry.id = v_entity_id;
    v_now := COALESCE(v_now, public.automation_now_ms());
  END IF;
  v_accepted_at := pg_catalog.to_timestamp(v_now::double precision / 1000.0);

  CASE v_entity_type
    WHEN 'mood' THEN
      v_mood.updated_at := v_accepted_at;
      v_projection := pg_catalog.to_jsonb(v_mood) - 'user_id' - 'created_at';
      v_event_payload := pg_catalog.jsonb_build_object(
        'id', v_mood.id,
        'mood', v_mood.mood,
        'note', v_mood.note,
        'tags', v_mood.tags,
        'date', v_mood.date,
        'timestamp', v_mood.timestamp,
        'emotion', v_mood.emotion,
        'valence', v_mood.valence,
        'logType', v_mood.log_type,
        'emotionTags', v_mood.emotion_tags,
        'contexts', v_mood.contexts,
        'updatedAt', v_now
      );

    WHEN 'journal' THEN
      v_journal.updated_at := v_now;
      v_projection := pg_catalog.to_jsonb(v_journal) - 'user_id';
      v_event_payload := pg_catalog.jsonb_build_object(
        'id', v_journal.id,
        'date', v_journal.date,
        'title', v_journal.title,
        'content', v_journal.content,
        'stickers', v_journal.stickers,
        'mood', v_journal.mood,
        'tags', v_journal.tags,
        'templateId', v_journal.template_id,
        'habitSnapshot', v_journal.habit_snapshot,
        'photoIds', v_journal.photo_ids,
        'audioIds', v_journal.audio_ids,
        'createdAt', v_journal.created_at,
        'updatedAt', v_now,
        'bgIntensity', v_journal.bg_intensity,
        'bgPattern', v_journal.bg_pattern,
        'font', v_journal.font,
        'fontSize', v_journal.font_size,
        'inkColor', v_journal.ink_color,
        'paperColor', v_journal.paper_color,
        'paperTexture', v_journal.paper_texture,
        'particleSpeed', v_journal.particle_speed,
        'photoLayout', v_journal.photo_layout,
        'theme', v_journal.theme
      );

    WHEN 'habit_completion' THEN
      IF v_operation = 'delete' THEN
        v_projection := 'null'::jsonb;
        v_event_payload := NULL;
        v_revision_entity_id :=
          pg_catalog.split_part(v_entity_id, '_', 1) || ':' ||
          pg_catalog.split_part(v_entity_id, '_', 2);
      ELSE
        v_projection := pg_catalog.to_jsonb(v_completion)
          - 'user_id' - 'id' - 'created_at';
        v_revision_entity_id := v_completion.habit_id::text || ':' || v_completion.date::text;
        v_event_payload := pg_catalog.jsonb_build_object(
          'habitId', v_completion.habit_id,
          'date', v_completion.date,
          'count', v_completion.count,
          'duration', v_completion.duration,
          'entryValue', v_completion.entry_value,
          'habitType', v_completion.habit_type,
          'targetType', v_completion.target_type,
          'completed', v_completion.is_complete
        );
      END IF;

    WHEN 'setting' THEN
      v_event_payload := pg_catalog.jsonb_build_object(
        'key', v_entity_id,
        'value', v_projection,
        'updatedAt', v_now
      );

    WHEN 'focus' THEN
      v_focus.updated_at := v_accepted_at;
      v_projection := pg_catalog.to_jsonb(v_focus) - 'user_id' - 'created_at';
      v_event_payload := pg_catalog.jsonb_build_object(
        'id', v_focus.id,
        'duration', v_focus.duration,
        'label', v_focus.label,
        'status', v_focus.status,
        'reflection', v_focus.reflection,
        'date', v_focus.date,
        'completedAt', v_focus.completed_at,
        'updatedAt', v_now
      );
  END CASE;

  SELECT event.*
  INTO v_existing_event
  FROM public.sync_events AS event
  WHERE event.user_id = v_owner
    AND event.idempotency_key = v_operation_id
  FOR UPDATE;

  IF FOUND THEN
    v_existing_payload := CASE
      WHEN v_existing_event.payload IS NULL THEN 'null'::jsonb
      ELSE v_existing_event.payload - ARRAY['updatedAt', 'automationRevision']
    END;
    v_requested_payload := CASE
      WHEN v_event_payload IS NULL THEN 'null'::jsonb
      ELSE v_event_payload - ARRAY['updatedAt', 'automationRevision']
    END;
    IF v_existing_event.entity_type IS DISTINCT FROM v_entity_type
      OR v_existing_event.entity_id IS DISTINCT FROM v_entity_id
      OR v_existing_event.op IS DISTINCT FROM v_operation
      OR v_existing_event.device_id IS DISTINCT FROM v_device_id
      OR v_existing_payload IS DISTINCT FROM v_requested_payload
    THEN
      RAISE EXCEPTION 'MANUAL_SYNC_IDEMPOTENCY_MISMATCH' USING ERRCODE = '22023';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'code', 'ALREADY_COMMITTED',
      'operationId', v_operation_id,
      'event', pg_catalog.jsonb_build_object(
        'id', v_existing_event.id,
        'seq', v_existing_event.seq,
        'entity_type', v_existing_event.entity_type,
        'entity_id', v_existing_event.entity_id,
        'op', v_existing_event.op,
        'payload', v_existing_event.payload,
        'device_id', v_existing_event.device_id,
        'created_at', v_existing_event.created_at
      )
    );
  END IF;

  IF v_entity_type IN ('mood', 'journal', 'habit_completion', 'setting') THEN
    v_after_hash := public.automation_hash_json(v_projection);
    v_revision_token := CASE
      WHEN v_operation = 'upsert' THEN extensions.gen_random_uuid()
      ELSE NULL
    END;
    PERFORM pg_catalog.set_config('zenflow.automation_internal', 'on', true);
    PERFORM pg_catalog.set_config(
      'zenflow.automation_revision_token',
      COALESCE(v_revision_token::text, ''),
      true
    );
    PERFORM pg_catalog.set_config('zenflow.automation_transaction_id', '', true);
    PERFORM pg_catalog.set_config('zenflow.automation_after_hash', v_after_hash, true);
  END IF;

  CASE v_entity_type
    WHEN 'mood' THEN
      INSERT INTO public.moods (
        id, user_id, mood, note, tags, date, timestamp, updated_at,
        valence, log_type, emotion_tags, contexts, emotion
      ) VALUES (
        v_mood.id, v_owner, v_mood.mood, v_mood.note, v_mood.tags,
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
      WHERE public.moods.user_id = v_owner;
      GET DIAGNOSTICS v_written_count = ROW_COUNT;
      IF v_written_count <> 1 THEN
        RAISE EXCEPTION 'MANUAL_SYNC_OWNER_CONFLICT' USING ERRCODE = '42501';
      END IF;

    WHEN 'journal' THEN
      INSERT INTO public.journal_entries (
        id, user_id, date, title, content, stickers, mood, tags, template_id,
        habit_snapshot, photo_ids, audio_ids, created_at, updated_at,
        bg_intensity, bg_pattern, font, font_size, ink_color, paper_color,
        paper_texture, particle_speed, photo_layout, theme
      ) VALUES (
        v_journal.id, v_owner, v_journal.date, v_journal.title, v_journal.content,
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
      WHERE public.journal_entries.user_id = v_owner;
      GET DIAGNOSTICS v_written_count = ROW_COUNT;
      IF v_written_count <> 1 THEN
        RAISE EXCEPTION 'MANUAL_SYNC_OWNER_CONFLICT' USING ERRCODE = '42501';
      END IF;

    WHEN 'habit_completion' THEN
      IF v_operation = 'delete' THEN
        DELETE FROM public.habit_completions AS completion
        WHERE completion.user_id = v_owner
          AND completion.habit_id = pg_catalog.split_part(v_entity_id, '_', 1)::uuid
          AND completion.date = pg_catalog.split_part(v_entity_id, '_', 2)::date;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        IF v_deleted_count = 0 THEN
          INSERT INTO public.automation_record_revisions (
            user_id, entity_type, entity_id, record_exists, revision_token,
            state_hash, mutation_generation, transaction_id, updated_at
          ) VALUES (
            v_owner, 'habit_completion', v_revision_entity_id, false, NULL,
            v_after_hash, 1, NULL, v_now
          )
          ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
            record_exists = false,
            revision_token = NULL,
            state_hash = EXCLUDED.state_hash,
            mutation_generation = public.automation_record_revisions.mutation_generation + 1,
            transaction_id = NULL,
            updated_at = EXCLUDED.updated_at;
          INSERT INTO public.automation_history_state (
            user_id, record_revision_version, updated_at
          ) VALUES (v_owner, 1, v_now)
          ON CONFLICT (user_id) DO UPDATE SET
            record_revision_version =
              public.automation_history_state.record_revision_version + 1,
            updated_at = GREATEST(
              public.automation_history_state.updated_at,
              EXCLUDED.updated_at
            );
        END IF;
      ELSE
        INSERT INTO public.habit_completions (
          id, user_id, habit_id, date, count, duration, entry_status,
          entry_value, habit_type, is_complete, target_type
        ) VALUES (
          COALESCE(v_completion.id, extensions.gen_random_uuid()),
          v_owner, v_completion.habit_id, v_completion.date,
          v_completion.count, v_completion.duration, v_completion.entry_status,
          v_completion.entry_value, v_completion.habit_type,
          v_completion.is_complete, v_completion.target_type
        )
        ON CONFLICT (habit_id, date) DO UPDATE SET
          count = EXCLUDED.count,
          duration = EXCLUDED.duration,
          entry_status = EXCLUDED.entry_status,
          entry_value = EXCLUDED.entry_value,
          habit_type = EXCLUDED.habit_type,
          is_complete = EXCLUDED.is_complete,
          target_type = EXCLUDED.target_type
        WHERE public.habit_completions.user_id = v_owner;
        GET DIAGNOSTICS v_written_count = ROW_COUNT;
        IF v_written_count <> 1 THEN
          RAISE EXCEPTION 'MANUAL_SYNC_OWNER_CONFLICT' USING ERRCODE = '42501';
        END IF;
      END IF;

    WHEN 'setting' THEN
      INSERT INTO public.user_settings (user_id, key, value, updated_at)
      VALUES (v_owner, v_entity_id, v_projection, v_accepted_at)
      ON CONFLICT (user_id, key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at;

    WHEN 'focus' THEN
      INSERT INTO public.focus_sessions (
        id, user_id, duration, label, status, reflection,
        date, completed_at, updated_at
      ) VALUES (
        v_focus.id, v_owner, v_focus.duration, v_focus.label, v_focus.status,
        v_focus.reflection, v_focus.date, v_focus.completed_at, v_focus.updated_at
      )
      ON CONFLICT (id) DO UPDATE SET
        duration = EXCLUDED.duration,
        label = EXCLUDED.label,
        status = EXCLUDED.status,
        reflection = EXCLUDED.reflection,
        date = EXCLUDED.date,
        completed_at = EXCLUDED.completed_at,
        updated_at = EXCLUDED.updated_at
      WHERE public.focus_sessions.user_id = v_owner;
      GET DIAGNOSTICS v_written_count = ROW_COUNT;
      IF v_written_count <> 1 THEN
        RAISE EXCEPTION 'MANUAL_SYNC_OWNER_CONFLICT' USING ERRCODE = '42501';
      END IF;
  END CASE;

  IF v_entity_type IN ('mood', 'journal', 'habit_completion', 'setting') THEN
    v_revision_entity_id := COALESCE(v_revision_entity_id, v_entity_id);
    SELECT revision.*
    INTO STRICT v_revision
    FROM public.automation_record_revisions AS revision
    WHERE revision.user_id = v_owner
      AND revision.entity_type = v_entity_type
      AND revision.entity_id = v_revision_entity_id;
    IF v_revision.record_exists IS DISTINCT FROM (v_operation = 'upsert')
      OR v_revision.revision_token IS DISTINCT FROM v_revision_token
      OR v_revision.state_hash IS DISTINCT FROM v_after_hash
      OR v_revision.transaction_id IS NOT NULL
    THEN
      RAISE EXCEPTION 'MANUAL_SYNC_REVISION_MISMATCH' USING ERRCODE = '40001';
    END IF;
    IF v_entity_type = 'setting' THEN
      v_event_payload := v_event_payload || pg_catalog.jsonb_build_object(
        'automationRevision', pg_catalog.jsonb_build_object(
          'recordExists', v_revision.record_exists,
          'revisionToken', v_revision.revision_token,
          'stateHash', v_revision.state_hash,
          'mutationGeneration', v_revision.mutation_generation,
          'transactionId', v_revision.transaction_id,
          'updatedAt', v_revision.updated_at
        )
      );
    END IF;
    PERFORM pg_catalog.set_config('zenflow.automation_internal', 'off', true);
    PERFORM pg_catalog.set_config('zenflow.automation_revision_token', '', true);
    PERFORM pg_catalog.set_config('zenflow.automation_transaction_id', '', true);
    PERFORM pg_catalog.set_config('zenflow.automation_after_hash', '', true);
  END IF;

  INSERT INTO public.sync_events (
    id, user_id, entity_type, entity_id, op, payload, device_id, idempotency_key
  ) VALUES (
    extensions.gen_random_uuid(), v_owner, v_entity_type, v_entity_id,
    v_operation, v_event_payload, v_device_id, v_operation_id
  )
  RETURNING * INTO STRICT v_event;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'code', 'COMMITTED',
    'operationId', v_operation_id,
    'event', pg_catalog.jsonb_build_object(
      'id', v_event.id,
      'seq', v_event.seq,
      'entity_type', v_event.entity_type,
      'entity_id', v_event.entity_id,
      'op', v_event.op,
      'payload', v_event.payload,
      'device_id', v_event.device_id,
      'created_at', v_event.created_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commit_manual_sync_event(jsonb)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_manual_sync_event(jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.commit_manual_sync_event(jsonb) IS
  'Owner-derived, idempotent acceptance boundary for one manual domain mutation and its ordered sync event.';

NOTIFY pgrst, 'reload schema';
