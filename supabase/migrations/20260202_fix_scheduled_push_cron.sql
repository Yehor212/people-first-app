-- Keep the scheduled-push job replayable without installing privileged
-- extensions, embedding a hosted project identifier, or materializing a
-- decrypted credential in migration history or cron.job.
DO $migration$
DECLARE
  project_url_count bigint;
  project_url_value text;
  service_role_key_count bigint;
  service_role_key_nonempty boolean;
  app_role_has_cron_or_net_access boolean;
  existing_job record;
BEGIN
  -- Extension lifecycle and ACL ownership belong to the database operator.
  -- A fresh local replay intentionally records NOT_PROVISIONED and continues.
  IF to_regclass('cron.job') IS NULL
    OR to_regprocedure('cron.unschedule(bigint)') IS NULL
    OR to_regprocedure('cron.schedule(text,text,text)') IS NULL
    OR to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL
  THEN
    RAISE NOTICE 'Scheduled push cron not provisioned: operator-managed cron/net capabilities are unavailable';
    RETURN;
  END IF;

  -- Disable only the exact legacy job before validating replacement inputs.
  -- Missing or invalid prerequisites must not leave an older runnable command.
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'send-scheduled-push-v2'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  SELECT EXISTS (
    SELECT 1
    FROM unnest(ARRAY['anon', 'authenticated']) AS app_role(role_name)
    WHERE has_schema_privilege(app_role.role_name, 'net', 'USAGE')
      OR has_schema_privilege(app_role.role_name, 'cron', 'USAGE')
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc AS routine
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = routine.pronamespace
        WHERE namespace.nspname IN ('net', 'cron')
          AND has_function_privilege(app_role.role_name, routine.oid, 'EXECUTE')
      )
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname IN ('net', 'cron')
          AND relation.relkind IN ('r', 'p', 'v', 'm', 'S')
          AND (
            has_table_privilege(
              app_role.role_name,
              relation.oid,
              'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
            )
            OR has_sequence_privilege(app_role.role_name, relation.oid, 'USAGE,SELECT,UPDATE')
          )
      )
  )
  INTO app_role_has_cron_or_net_access;

  IF app_role_has_cron_or_net_access IS TRUE THEN
    RAISE NOTICE 'Scheduled push cron not provisioned: application roles retain cron/net privileges';
    RETURN;
  END IF;

  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE NOTICE 'Scheduled push cron not provisioned: Vault is unavailable';
    RETURN;
  END IF;

  SELECT
    pg_catalog.count(*),
    pg_catalog.min(NULLIF(pg_catalog.rtrim(decrypted_secret, '/'), ''))
  INTO project_url_count, project_url_value
  FROM vault.decrypted_secrets
  WHERE name = 'project_url';

  SELECT
    pg_catalog.count(*),
    pg_catalog.bool_and(NULLIF(pg_catalog.btrim(decrypted_secret), '') IS NOT NULL)
  INTO service_role_key_count, service_role_key_nonempty
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';

  IF project_url_count <> 1 OR project_url_value IS NULL THEN
    RAISE NOTICE 'Scheduled push cron not provisioned: project_url must exist exactly once';
    RETURN;
  END IF;

  IF project_url_value !~ '^https://[a-z0-9-]+[.]supabase[.]co$' THEN
    RAISE NOTICE 'Scheduled push cron not provisioned: project_url origin is not allowed';
    RETURN;
  END IF;

  IF service_role_key_count <> 1 OR service_role_key_nonempty IS NOT TRUE THEN
    RAISE NOTICE 'Scheduled push cron not provisioned: service_role_key must exist exactly once';
    RETURN;
  END IF;

  -- Resolve Vault values and re-check the effective ACL boundary on every run.
  PERFORM cron.schedule(
    'send-scheduled-push-v2',
    '*/15 * * * *',
    $cron_command$
      WITH acl_guard AS (
        SELECT true AS admitted
        WHERE NOT EXISTS (
          SELECT 1
          FROM unnest(ARRAY['anon', 'authenticated']) AS app_role(role_name)
          WHERE has_schema_privilege(app_role.role_name, 'net', 'USAGE')
            OR has_schema_privilege(app_role.role_name, 'cron', 'USAGE')
            OR EXISTS (
              SELECT 1
              FROM pg_catalog.pg_proc AS routine
              JOIN pg_catalog.pg_namespace AS namespace
                ON namespace.oid = routine.pronamespace
              WHERE namespace.nspname IN ('net', 'cron')
                AND has_function_privilege(app_role.role_name, routine.oid, 'EXECUTE')
            )
            OR EXISTS (
              SELECT 1
              FROM pg_catalog.pg_class AS relation
              JOIN pg_catalog.pg_namespace AS namespace
                ON namespace.oid = relation.relnamespace
              WHERE namespace.nspname IN ('net', 'cron')
                AND relation.relkind IN ('r', 'p', 'v', 'm', 'S')
                AND (
                  has_table_privilege(
                    app_role.role_name,
                    relation.oid,
                    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
                  )
                  OR has_sequence_privilege(
                    app_role.role_name,
                    relation.oid,
                    'USAGE,SELECT,UPDATE'
                  )
                )
            )
        )
      ),
      endpoint AS (
        SELECT pg_catalog.min(
          NULLIF(pg_catalog.rtrim(decrypted_secret, '/'), '')
        ) AS project_url
        FROM vault.decrypted_secrets
        WHERE name = 'project_url'
        HAVING pg_catalog.count(*) = 1
      ),
      credential AS (
        SELECT pg_catalog.min(
          NULLIF(pg_catalog.btrim(decrypted_secret), '')
        ) AS service_role_key
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key'
        HAVING pg_catalog.count(*) = 1
      )
      SELECT net.http_post(
        url := endpoint.project_url || '/functions/v1/send-scheduled-push',
        headers := pg_catalog.jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || credential.service_role_key
        ),
        body := '{}'::jsonb
      )
      FROM acl_guard
      CROSS JOIN endpoint
      CROSS JOIN credential
      WHERE endpoint.project_url ~ '^https://[a-z0-9-]+[.]supabase[.]co$'
        AND credential.service_role_key IS NOT NULL;
    $cron_command$
  );

  RAISE NOTICE 'Scheduled push cron provisioned from validated operator and Vault prerequisites';
END
$migration$;
