-- Private Realtime Broadcast authorization for Telegram-grade sync wake signals.
-- Broadcast is only a wake-up signal; sync_events.seq remains the durable order.
-- Supabase owns this table and enables RLS during Realtime bootstrap. Policy
-- management is supported, while owner-only ALTER TABLE is intentionally avoided.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'realtime'
      AND relation.relname = 'messages'
      AND relation.relkind IN ('r', 'p')
      AND relation.relrowsecurity IS TRUE
  ) THEN
    RAISE EXCEPTION
      'Realtime bootstrap invariant failed: realtime.messages must exist with RLS enabled';
  END IF;
END;
$$;

DROP POLICY IF EXISTS "sync broadcast receive own topic" ON realtime.messages;
CREATE POLICY "sync broadcast receive own topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) = 'sync-signal:' || (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "sync broadcast send own topic" ON realtime.messages;
CREATE POLICY "sync broadcast send own topic"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) = 'sync-signal:' || (SELECT auth.uid())::text
);

COMMENT ON POLICY "sync broadcast receive own topic" ON realtime.messages IS
  'Allows authenticated users to receive sync wake signals only on their own sync-signal:<uid> topic.';

COMMENT ON POLICY "sync broadcast send own topic" ON realtime.messages IS
  'Allows authenticated users to send sync wake signals only on their own sync-signal:<uid> topic.';
