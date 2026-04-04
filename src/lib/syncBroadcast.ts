/**
 * Cross-device sync signaling via Supabase Broadcast.
 *
 * Uses Broadcast (NOT postgres_changes) for zero WAL/DB overhead.
 * Pattern: Device A changes data → broadcasts signal → Device B pulls.
 * Only signals are broadcast, never data payloads.
 */

import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SyncEntity = 'moods' | 'habits' | 'focus' | 'gratitude' | 'journal' | 'settings' | 'backup';

interface SyncSignal {
  entity: SyncEntity;
  deviceId: string;
  ts: number;
}

type RemoteChangeHandler = (signal: SyncSignal) => void;

// Unique device ID for this session (survives page reload via sessionStorage)
const DEVICE_ID_KEY = 'zenflow-device-id';
function getDeviceId(): string {
  let id = sessionStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

let channel: RealtimeChannel | null = null;
let handlers: RemoteChangeHandler[] = [];
let currentDeviceId = '';

/**
 * Initialize broadcast channel for a user. Call once after auth.
 */
export function initSyncBroadcast(userId: string): void {
  if (!supabase) return;

  // Clean up previous channel if any
  destroySyncBroadcast();

  currentDeviceId = getDeviceId();
  const channelName = `sync-signal:${userId}`;

  channel = supabase.channel(channelName);

  channel.on('broadcast', { event: 'data-changed' }, ({ payload }) => {
    const signal = payload as SyncSignal;

    // Ignore our own broadcasts
    if (signal.deviceId === currentDeviceId) return;

    logger.sync(`[Broadcast] Remote change: ${signal.entity} from device ${signal.deviceId.slice(0, 8)}`);

    for (const handler of handlers) {
      try {
        handler(signal);
      } catch (err) {
        logger.error('[Broadcast] Handler error:', err);
      }
    }
  });

  channel.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      logger.sync(`[Broadcast] Joined channel ${channelName}`);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      logger.warn(`[Broadcast] Channel ${status} — scheduling reconnect`);
      setTimeout(() => initSyncBroadcast(userId), 5000);
    }
  });
}

/**
 * Broadcast a change signal to other devices. Fire-and-forget.
 */
export function broadcastChange(entity: SyncEntity): void {
  if (!channel) return;

  const signal: SyncSignal = {
    entity,
    deviceId: currentDeviceId,
    ts: Date.now(),
  };

  channel.send({
    type: 'broadcast',
    event: 'data-changed',
    payload: signal,
  }).catch((err) => {
    logger.warn('[Broadcast] Send failed:', err);
  });
}

/**
 * Register a handler for remote changes. Returns unsubscribe function.
 */
export function onRemoteChange(handler: RemoteChangeHandler): () => void {
  handlers.push(handler);
  return () => {
    handlers = handlers.filter(h => h !== handler);
  };
}

/**
 * Cleanup broadcast channel. Call on logout or unmount.
 */
export function destroySyncBroadcast(): void {
  if (channel) {
    void supabase?.removeChannel(channel);
    channel = null;
  }
  handlers = [];
  currentDeviceId = '';
}
