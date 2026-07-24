/**
 * Privacy-safe Presence boundary.
 *
 * The former implementation published raw Auth UUIDs to one public Realtime
 * channel. Public Presence exposes the complete channel state to every
 * subscriber, while this repository has no server-authoritative friendship
 * membership or private Presence RLS policy. Online indicators therefore stay
 * disabled until a private, friend-scoped protocol can be proved end to end.
 *
 * The retained API keeps callers and friend surfaces stable while aggressively
 * removing legacy `zenflow-presence` channels that an older bundle or the
 * shared Supabase SDK client may still hold.
 */

import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

const LEGACY_PRESENCE_CHANNEL = "zenflow-presence";
const LEGACY_PRESENCE_TOPIC = `realtime:${LEGACY_PRESENCE_CHANNEL}`;

const onlineUsers = new Map<string, number>();
const listeners = new Set<() => void>();
let teardownTail: Promise<void> = Promise.resolve();

export type PresenceBoundaryTeardownResult = {
  status: "removed" | "not-tracked" | "owner-changed";
};

function notifyListeners(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      logger.warn("[Presence] A local listener failed");
    }
  }
}

function clearCachedPresence(): void {
  onlineUsers.clear();
  notifyListeners();
}

function isLegacyPresenceChannel(channel: RealtimeChannel): boolean {
  return (
    channel.topic === LEGACY_PRESENCE_TOPIC ||
    channel.topic === LEGACY_PRESENCE_CHANNEL
  );
}

function readPresenceOwner(channel: RealtimeChannel): string | null {
  const params = channel.params as unknown;
  if (!params || typeof params !== "object") return null;
  const config = (params as Record<string, unknown>).config;
  if (!config || typeof config !== "object") return null;
  const presence = (config as Record<string, unknown>).presence;
  if (!presence || typeof presence !== "object") return null;
  const key = (presence as Record<string, unknown>).key;
  return typeof key === "string" && key.trim().length > 0 ? key : null;
}

function getLegacyPresenceChannels(): RealtimeChannel[] {
  if (!supabase) return [];
  return Array.from(
    new Set(supabase.getChannels().filter(isLegacyPresenceChannel)),
  );
}

function enqueueTeardown<T>(operation: () => Promise<T>): Promise<T> {
  const result = teardownTail.catch(() => undefined).then(operation);
  teardownTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function removeLegacyChannels(
  channels: RealtimeChannel[],
): Promise<void> {
  if (!supabase || channels.length === 0) return;

  let acknowledged = true;
  for (const channel of channels) {
    try {
      if ((await channel.untrack()) !== "ok") acknowledged = false;
    } catch {
      acknowledged = false;
    }

    try {
      if ((await supabase.removeChannel(channel)) !== "ok") acknowledged = false;
    } catch {
      acknowledged = false;
    }
  }

  if (!acknowledged) {
    throw new Error("Presence teardown was not acknowledged");
  }
}

/** Subscribe to the local, currently empty online-user view. */
export function subscribeToPresence(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Online state is fail-closed until private friend-scoped Presence exists. */
export function isUserOnline(_userId: string): boolean {
  return false;
}

export function getOnlineCount(): number {
  return 0;
}

export function getOnlineUserIds(): Set<string> {
  return new Set();
}

/**
 * Presence publication is intentionally disabled. Joining now means proving
 * that no legacy public channel remains in this Supabase client.
 */
export async function joinPresence(): Promise<void> {
  await leavePresence();
}

/** Remove every legacy public Presence channel, regardless of its old owner. */
export function leavePresence(): Promise<void> {
  return enqueueTeardown(async () => {
    clearCachedPresence();
    await removeLegacyChannels(getLegacyPresenceChannels());
    clearCachedPresence();
  });
}

/**
 * Remove Presence only for the expected account boundary. A newer owner's
 * channel is preserved; unknown or mixed ownership blocks the transition.
 */
export function leavePresenceForAccountBoundary(
  expectedOwnerUserId: string,
): Promise<PresenceBoundaryTeardownResult> {
  if (typeof expectedOwnerUserId !== "string" || expectedOwnerUserId.trim() === "") {
    return Promise.reject(new Error("Expected Presence owner is required"));
  }

  return enqueueTeardown(async () => {
    clearCachedPresence();
    const channels = getLegacyPresenceChannels();
    if (channels.length === 0) return { status: "not-tracked" };

    const ownedChannels: RealtimeChannel[] = [];
    let hasAnotherOwner = false;
    for (const channel of channels) {
      const owner = readPresenceOwner(channel);
      if (owner === null) {
        throw new Error("Presence channel ownership could not be verified");
      }
      if (owner === expectedOwnerUserId) ownedChannels.push(channel);
      else hasAnotherOwner = true;
    }

    if (ownedChannels.length > 0 && hasAnotherOwner) {
      throw new Error("Presence channel ownership is mixed");
    }
    if (ownedChannels.length === 0) return { status: "owner-changed" };

    await removeLegacyChannels(ownedChannels);
    clearCachedPresence();
    return { status: "removed" };
  });
}

/** Cleanup for app destruction and hot reload. */
export function destroyPresence(): void {
  listeners.clear();
  void leavePresence().catch(() => {
    logger.warn("[Presence] Legacy channel cleanup was not acknowledged");
  });
}
