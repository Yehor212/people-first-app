-- Private Realtime Broadcast authorization for Telegram-grade sync wake signals.
-- Broadcast is only a wake-up signal; sync_events.seq remains the durable order.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

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
