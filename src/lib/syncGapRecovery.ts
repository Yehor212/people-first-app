/**
 * Sync Gap Detection & Recovery — Telegram-style algorithm.
 *
 * When a gap is detected (local_seq + 1 < event.seq), the client:
 * 1. Waits 500ms for filling events (Telegram's pattern to reduce API calls)
 * 2. If gap persists, fetches missing events via getDifference
 * 3. Applies events in order, advancing the cursor
 *
 * Based on Telegram's pts gap handling:
 * - local_seq + 1 === event.seq → apply (next expected)
 * - local_seq + 1 > event.seq  → ignore (already applied, idempotent)
 * - local_seq + 1 < event.seq  → gap detected, wait then fill
 */

import { logger } from "@/lib/logger";
import { loadSyncCursor, advanceCursor, type SyncEntityType } from "@/lib/syncCursor";

export interface SyncEvent {
  seq: number;
  entity_type: SyncEntityType;
  entity_id: string;
  op: "upsert" | "delete";
  payload: Record<string, unknown> | null;
  device_id: string;
  created_at: string;
}

type EventDecision = "apply" | "ignore" | "gap";

/** Determine whether to apply, ignore, or flag a gap for a given event */
export function shouldApplyEvent(eventSeq: number, localSeq: number): EventDecision {
  if (localSeq + 1 === eventSeq) return "apply";
  if (localSeq + 1 > eventSeq) return "ignore";
  return "gap";
}

// ROOT-CAUSE: Telegram protocol design — 500ms gap wait reduces unnecessary API round-trips when events arrive out of order via realtime channels
const GAP_WAIT_MS = 500;

/**
 * Handle a gap by waiting 500ms then checking again.
 * Returns missing events to fetch, or empty if gap was filled concurrently.
 */
export async function handleGap(
  entityType: SyncEntityType,
  remoteSeq: number,
  fetchEventRange: (from: number, to: number) => Promise<SyncEvent[]>
): Promise<SyncEvent[]> {
  logger.log(`[SyncGap] Gap detected for ${entityType}, waiting ${GAP_WAIT_MS}ms...`);

  // ROOT-CAUSE: Telegram-documented 500ms coalescing window — events arriving out-of-order fill gaps without API calls
  await new Promise((resolve) => {
    const timerId = window.setTimeout(resolve, GAP_WAIT_MS);
    // Cleanup not needed: one-shot timer, resolve called once
    void timerId;
  });

  const cursor = await loadSyncCursor();
  const localSeq = cursor.entitySeqs[entityType];

  if (localSeq >= remoteSeq) {
    logger.log(`[SyncGap] Gap filled concurrently for ${entityType}`);
    return [];
  }

  logger.log(`[SyncGap] Fetching missing events for ${entityType}: ${localSeq + 1} → ${remoteSeq}`);
  return fetchEventRange(localSeq + 1, remoteSeq);
}

/**
 * Process a batch of sync events in order, applying each and advancing cursor.
 * Skips events from the same device (no self-echo).
 */
export async function processEventBatch(
  events: SyncEvent[],
  myDeviceId: string,
  applyEvent: (event: SyncEvent) => Promise<void>
): Promise<{ applied: number; skipped: number; gaps: number }> {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  let applied = 0;
  let skipped = 0;
  let gaps = 0;

  // Load cursor once to avoid N+1 IndexedDB reads per event
  const cursor = await loadSyncCursor();
  const localSeqs = { ...cursor.entitySeqs };

  for (const event of sorted) {
    if (event.device_id === myDeviceId) {
      skipped++;
      continue;
    }

    const localSeq = localSeqs[event.entity_type] ?? 0;
    const decision = shouldApplyEvent(event.seq, localSeq);

    switch (decision) {
      case "apply":
        await applyEvent(event);
        localSeqs[event.entity_type] = event.seq;
        applied++;
        break;
      case "ignore":
        skipped++;
        break;
      case "gap":
        gaps++;
        logger.warn(`[SyncGap] Unexpected gap at seq ${event.seq} (local: ${localSeq})`);
        break;
    }
  }

  // Persist cursor once at end (batch write instead of per-event)
  for (const [type, seq] of Object.entries(localSeqs)) {
    if (seq > (cursor.entitySeqs[type as SyncEntityType] ?? 0)) {
      await advanceCursor(type as SyncEntityType, seq);
    }
  }

  logger.log(`[SyncGap] Batch processed: ${applied} applied, ${skipped} skipped, ${gaps} gaps`);
  return { applied, skipped, gaps };
}
