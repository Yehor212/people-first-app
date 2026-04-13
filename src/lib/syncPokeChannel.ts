/**
 * Sync Poke Channel — Telegram-style lightweight sync notification.
 *
 * Single Supabase Realtime broadcast channel for all sync notifications.
 * On poke: triggers delta pull (doesn't apply data from notification).
 * Reduces connection count vs per-entity channels.
 */

import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { SK } from "@/lib/storageKeys";
import { safeLocalStorageGet } from "@/lib/safeJson";

let pokeChannel: RealtimeChannel | null = null;

interface SyncPoke {
  seq: number;
  entity_type: string;
  device_id: string;
}

/**
 * Subscribe to sync poke channel.
 * When another device syncs, we get a lightweight notification
 * and trigger a delta pull — no data in the notification itself.
 */
export function subscribeSyncPokes(onPoke: (poke: SyncPoke) => void): () => void {
  if (!supabase) {
    logger.warn("[SyncPoke] No supabase client, skipping poke subscription");
    // INTENTIONAL: no-op cleanup when supabase unavailable — nothing was subscribed
    return () => {
      /* no-op: supabase not available */
    };
  }

  const myDeviceId = safeLocalStorageGet<string>(SK.DEVICE_ID, "");

  pokeChannel = supabase.channel("sync-poke", {
    config: { broadcast: { self: false } },
  });

  pokeChannel
    .on("broadcast", { event: "sync-available" }, (payload) => {
      const poke = payload.payload as SyncPoke;
      // Skip self-echo (same device)
      if (poke.device_id === myDeviceId) return;
      logger.log("[SyncPoke] Received poke:", poke.entity_type, "seq:", poke.seq);
      onPoke(poke);
    })
    .subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        logger.log("[SyncPoke] Subscribed to sync-poke channel");
      }
    });

  return () => {
    if (pokeChannel && supabase) {
      void supabase.removeChannel(pokeChannel);
      pokeChannel = null;
      logger.log("[SyncPoke] Unsubscribed from sync-poke channel");
    }
  };
}

/**
 * Send a sync poke to notify other devices that new data is available.
 * Called after successful cloud write operations.
 */
export async function sendSyncPoke(entityType: string, seq: number): Promise<void> {
  if (!supabase || !pokeChannel) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  const myDeviceId = safeLocalStorageGet<string>(SK.DEVICE_ID, "");

  try {
    await pokeChannel.send({
      type: "broadcast",
      event: "sync-available",
      payload: {
        seq,
        entity_type: entityType,
        device_id: myDeviceId,
      } satisfies SyncPoke,
    });
    logger.log("[SyncPoke] Sent poke for", entityType, "seq:", seq);
  } catch (err) {
    logger.warn("[SyncPoke] Failed to send poke:", err);
  }
}
