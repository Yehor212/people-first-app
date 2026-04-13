/**
 * Sync Cursor Management — Telegram-style sequence counter tracking.
 *
 * Each entity type has an independent sequence counter (like Telegram's per-channel pts).
 * Clients track their last-known seq and pull only events after that point.
 * O(1) sync state detection: compare local seq vs server seq.
 */

import { db } from "@/storage/db";
import { logger } from "@/lib/logger";

export type SyncEntityType = "mood" | "habit" | "focus" | "gratitude" | "journal" | "setting";

export interface SyncCursor {
  globalSeq: number;
  entitySeqs: Record<SyncEntityType, number>;
  deviceId: string;
  lastSyncAt: string;
}

const CURSOR_KEY = "sync-cursor-v2";

const DEFAULT_CURSOR: SyncCursor = {
  globalSeq: 0,
  entitySeqs: {
    mood: 0,
    habit: 0,
    focus: 0,
    gratitude: 0,
    journal: 0,
    setting: 0,
  },
  deviceId: "",
  lastSyncAt: "",
};

/** Load sync cursor from IndexedDB settings table */
export async function loadSyncCursor(): Promise<SyncCursor> {
  try {
    const row = await db.settings.get(CURSOR_KEY);
    if (row?.value && typeof row.value === "object") {
      return { ...DEFAULT_CURSOR, ...(row.value as Partial<SyncCursor>) };
    }
    return { ...DEFAULT_CURSOR };
  } catch (err) {
    logger.warn("[SyncCursor] Failed to load cursor:", err);
    return { ...DEFAULT_CURSOR };
  }
}

/** Save sync cursor to IndexedDB settings table */
export async function saveSyncCursor(cursor: SyncCursor): Promise<void> {
  try {
    await db.settings.put({ key: CURSOR_KEY, value: cursor as unknown as string });
  } catch (err) {
    logger.error("[SyncCursor] Failed to save cursor:", err);
  }
}

/** Update the global seq and entity-specific seq after applying events */
export async function advanceCursor(entityType: SyncEntityType, newSeq: number): Promise<void> {
  const cursor = await loadSyncCursor();
  cursor.entitySeqs[entityType] = Math.max(cursor.entitySeqs[entityType], newSeq);
  cursor.globalSeq = Math.max(cursor.globalSeq, newSeq);
  cursor.lastSyncAt = new Date().toISOString();
  await saveSyncCursor(cursor);
}

/** Check if local is behind remote — O(1) state detection (Telegram pattern) */
export function isBehind(localSeq: number, remoteSeq: number): boolean {
  return localSeq < remoteSeq;
}

/** Detect gap size between local and remote cursors */
export function getGapSize(localSeq: number, remoteSeq: number): number {
  return Math.max(0, remoteSeq - localSeq);
}
