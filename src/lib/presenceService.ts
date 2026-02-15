/**
 * Realtime Presence Service
 *
 * Tracks online status of users via Supabase Realtime Presence.
 * All authenticated users join a shared channel. Friends can check
 * who is currently online from their friend list.
 *
 * Architecture:
 *   - Single shared channel "zenflow-presence"
 *   - Each user tracks with their userId as key
 *   - Presence state synced automatically by Supabase
 *   - Listeners notified on state changes
 */

import { supabase, getCurrentUserId } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import type { RealtimeChannel } from '@supabase/supabase-js';

let presenceChannel: RealtimeChannel | null = null;
let currentUserId: string | null = null;

// Online users map: userId → timestamp
const onlineUsers = new Map<string, number>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(l => l());
}

/**
 * Subscribe to presence changes.
 * Listener is called whenever the online users set changes.
 * Returns an unsubscribe function.
 */
export function subscribeToPresence(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Check if a specific user is currently online.
 */
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

/**
 * Get the count of currently online users.
 */
export function getOnlineCount(): number {
  return onlineUsers.size;
}

/**
 * Get all online user IDs (for filtering friend lists).
 */
export function getOnlineUserIds(): Set<string> {
  return new Set(onlineUsers.keys());
}

/**
 * Join the presence channel.
 * Call when user is authenticated and app is in foreground.
 */
export async function joinPresence(): Promise<void> {
  if (!supabase) return;
  const userId = await getCurrentUserId();
  if (!userId) return;

  // Already joined
  if (presenceChannel && currentUserId === userId) return;

  currentUserId = userId;

  // Leave existing channel first
  if (presenceChannel) {
    await supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }

  presenceChannel = supabase.channel('zenflow-presence', {
    config: { presence: { key: userId } },
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel?.presenceState() || {};
      onlineUsers.clear();
      for (const key of Object.keys(state)) {
        onlineUsers.set(key, Date.now());
      }
      notifyListeners();
    })
    .subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED' && presenceChannel) {
        await presenceChannel.track({
          online_at: new Date().toISOString(),
        });
        logger.log('[Presence] Joined, tracking as:', userId);
      }
    });
}

/**
 * Leave the presence channel.
 * Call on logout or when app goes to background for extended time.
 */
export async function leavePresence(): Promise<void> {
  if (presenceChannel && supabase) {
    try {
      await presenceChannel.untrack();
      await supabase.removeChannel(presenceChannel);
    } catch (err) {
      logger.warn('[Presence] Leave error:', err);
    }
    presenceChannel = null;
  }
  currentUserId = null;
  onlineUsers.clear();
  notifyListeners();
  logger.log('[Presence] Left channel');
}

/**
 * Cleanup — call on app destroy / hot reload.
 */
export function destroyPresence(): void {
  void leavePresence();
  listeners.clear();
}
