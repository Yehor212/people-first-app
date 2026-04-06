/**
 * Cross-device sync signaling via Supabase Broadcast.
 *
 * Uses Broadcast (NOT postgres_changes) for zero WAL/DB overhead.
 * Pattern: Device A changes data → broadcasts signal → Device B pulls.
 * Only signals are broadcast, never data payloads.
 *
 * Security: S4 replay protection via monotonic seq counter per device.
 * Reliability: S7 exponential backoff with jitter on reconnect.
 */

import { supabase } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type SyncEntity =
  | "moods"
  | "habits"
  | "focus"
  | "gratitude"
  | "journal"
  | "settings"
  | "backup";

interface SyncSignal {
  entity: SyncEntity;
  deviceId: string;
  ts: number;
  seq: number;
}

type RemoteChangeHandler = (signal: SyncSignal) => void;

// Unique device ID for this session (survives page reload via sessionStorage)
const DEVICE_ID_KEY = "zenflow-device-id";
export function getDeviceId(): string {
  let id = sessionStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectAttempt = 0;
let broadcastSeq = 0;
const seenSeqs = new Map<string, number>();
let channel: RealtimeChannel | null = null;
let handlers: RemoteChangeHandler[] = [];
let currentDeviceId = "";

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

  channel.on("broadcast", { event: "data-changed" }, ({ payload }) => {
    const signal = payload as SyncSignal;

    // Ignore our own broadcasts
    if (signal.deviceId === currentDeviceId) return;

    // S4: Replay protection — reject signals with seq <= last seen from this device
    const lastSeen = seenSeqs.get(signal.deviceId) ?? -1;
    if (typeof signal.seq === "number" && signal.seq <= lastSeen) {
      logger.warn(
        `[Broadcast] Rejected replay: device ${signal.deviceId.slice(0, 8)} seq ${signal.seq} <= ${lastSeen}`
      );
      return;
    }
    if (typeof signal.seq === "number") {
      seenSeqs.set(signal.deviceId, signal.seq);
    }

    logger.sync(
      `[Broadcast] Remote change: ${signal.entity} from device ${signal.deviceId.slice(0, 8)}`
    );

    for (const handler of handlers) {
      try {
        handler(signal);
      } catch (err) {
        logger.error("[Broadcast] Handler error:", err);
      }
    }
  });

  channel.subscribe((status: string) => {
    if (status === "SUBSCRIBED") {
      reconnectAttempt = 0;
      logger.sync(`[Broadcast] Joined channel ${channelName}`);
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      reconnectAttempt++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt) + Math.random() * 1000, 30000);
      logger.warn(
        `[Broadcast] Channel ${status} — reconnect #${reconnectAttempt} in ${Math.round(delay)}ms`
      );
      if (reconnectAttempt <= MAX_RECONNECT_ATTEMPTS) {
        setTimeout(() => initSyncBroadcast(userId), delay);
      } else {
        logger.error(
          `[Broadcast] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached — giving up`
        );
      }
    }
  });
}

/**
 * Broadcast a change signal to other devices. Fire-and-forget.
 */
export function broadcastChange(entity: SyncEntity): void {
  if (!channel) return;

  broadcastSeq++;
  const signal: SyncSignal = {
    entity,
    deviceId: currentDeviceId,
    ts: Date.now(),
    seq: broadcastSeq,
  };

  channel
    .send({
      type: "broadcast",
      event: "data-changed",
      payload: signal,
    })
    .catch((err) => {
      logger.warn("[Broadcast] Send failed:", err);
    });
}

/**
 * Register a handler for remote changes. Returns unsubscribe function.
 */
export function onRemoteChange(handler: RemoteChangeHandler): () => void {
  handlers.push(handler);
  return () => {
    handlers = handlers.filter((h) => h !== handler);
  };
}

/**
 * Cleanup broadcast channel. Call on logout or unmount.
 * Preserves seenSeqs and broadcastSeq on reconnect to maintain replay protection (S4).
 * Full reset only on explicit logout (isLogout=true).
 */
export function destroySyncBroadcast(isLogout = false): void {
  if (channel) {
    void supabase?.removeChannel(channel);
    channel = null;
  }
  handlers = [];
  if (isLogout) {
    currentDeviceId = "";
    reconnectAttempt = 0;
    broadcastSeq = 0;
    seenSeqs.clear();
  }
}
