/**
 * Event Sync — Core engine for Telegram-style delta synchronization.
 *
 * writeEvent: Records a sync event after successful cloud operation.
 * fetchDelta: Pulls events newer than lastSeq (keyset pagination).
 * applyDelta: Applies events to IndexedDB atomically in a single transaction.
 * getLastSeq / saveLastSeq: Cursor management via Dexie settings table.
 */

import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import { db } from "@/storage/db";
import { logger } from "@/lib/logger";
import { isAbortError } from "@/lib/validation";
import { triggerDataRefresh } from "@/hooks/useIndexedDB";
import type { Json } from "@/types/supabase";
import type { IndexableType, Table } from "dexie";
import type { LoopHabitType } from "@/types";
import { decodeHabitCompletionFromCloud } from "@/storage/sync/habitCompletionCodec";

// ── Types ─────────────────────────────────────────────────────────────

export type SyncEntityType =
  | "mood"
  | "habit"
  | "focus"
  | "gratitude"
  | "journal"
  | "habit_completion"
  | "setting";

export type SyncOp = "upsert" | "delete";

export interface SyncEvent {
  id: string;
  seq: number;
  entity_type: SyncEntityType;
  entity_id: string;
  op: SyncOp;
  payload: Record<string, unknown> | null;
  device_id: string;
  created_at: string;
}

export interface DeltaResult {
  events: SyncEvent[];
  hasMore: boolean;
}

// ── Entity type to Dexie table mapping ────────────────────────────────

// Maps entity types to Dexie table names for applyDelta.
// habit_completion: no dedicated table — completions are embedded in habit.entries.
// setting: no dedicated table — settings in db.settings, synced via backup pullFromCloud.
const ENTITY_TABLE_MAP: Record<string, string> = {
  mood: "moods",
  habit: "habits",
  habit_completion: "habits",
  focus: "focusSessions",
  gratitude: "gratitudeEntries",
  journal: "journalEntries",
};

// ── Cursor management ─────────────────────────────────────────────────

const SYNC_SEQ_KEY = "sync-last-seq";
const DEVICE_ID_KEY = "zenflow-device-id";

/** Cached device ID — avoids IndexedDB read on every writeEvent call.
 * Call clearDeviceIdCache() on logout to prevent stale ID across account switch. */
let cachedDeviceId: string | null = null;

/** Invalidate cached device ID (call on logout before clearUserData) */
export function clearDeviceIdCache(): void {
  cachedDeviceId = null;
}

/** Get persistent device ID from IndexedDB (survives app restarts, unlike sessionStorage) */
export async function getPersistentDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const existing = await db.settings.get(DEVICE_ID_KEY);
  if (existing?.value && typeof existing.value === "string") {
    cachedDeviceId = existing.value;
    return cachedDeviceId;
  }
  const deviceId = `device_${crypto.randomUUID()}`;
  await db.settings.put({ key: DEVICE_ID_KEY, value: deviceId });
  cachedDeviceId = deviceId;
  return deviceId;
}

/**
 * Bootstrap lastSeq for first-time delta sync enablement.
 * Sets cursor to server max so we don't replay entire event history.
 */
export async function bootstrapLastSeq(): Promise<number> {
  const localSeq = await getLastSeq();
  if (localSeq > 0) return localSeq;
  const serverMax = await getServerMaxSeq();
  if (serverMax > 0) {
    await saveLastSeq(serverMax);
    logger.sync(`[EventSync] Bootstrapped lastSeq to ${serverMax}`);
  }
  return serverMax;
}

export async function getLastSeq(): Promise<number> {
  const entry = await db.settings.get(SYNC_SEQ_KEY);
  return (entry?.value as number) ?? 0;
}

export async function saveLastSeq(seq: number): Promise<void> {
  await db.settings.put({ key: SYNC_SEQ_KEY, value: seq });
}

// ── Write event (called after successful sync op) ─────────────────────

/**
 * Record a sync event in the cloud event log.
 * Fire-and-forget: failure is logged but never thrown.
 * The server assigns seq via BEFORE INSERT trigger.
 */
export async function writeEvent(
  entityType: SyncEntityType,
  entityId: string,
  op: SyncOp,
  payload: Record<string, unknown> | null,
  deviceId: string
): Promise<void> {
  if (!supabase) return;
  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    const { error } = await supabase.from("sync_events").insert({
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      op,
      payload: payload as Json,
      device_id: deviceId,
    });

    if (error) {
      logger.warn("[EventSync] writeEvent failed:", error.message);
    }
  } catch (err) {
    if (isAbortError(err)) return;
    logger.warn("[EventSync] writeEvent error:", err);
  }
}

// ── Fetch delta (keyset pagination) ───────────────────────────────────

/**
 * Pull events newer than lastSeq for the current user.
 * Fetches limit+1 to detect hasMore without COUNT.
 */
export async function fetchDelta(lastSeq: number, limit = 200): Promise<DeltaResult> {
  if (!supabase) return { events: [], hasMore: false };
  const userId = await getCurrentUserId();
  if (!userId) return { events: [], hasMore: false };

  const { data, error } = await supabase
    .from("sync_events")
    .select("id, seq, entity_type, entity_id, op, payload, device_id, created_at")
    .gt("seq", lastSeq)
    .order("seq", { ascending: true })
    .limit(limit + 1);

  if (error) {
    throw new Error(`[EventSync] fetchDelta failed: ${error.message}`);
  }

  const hasMore = (data?.length ?? 0) > limit;
  const events = (data ?? []).slice(0, limit) as SyncEvent[];

  return { events, hasMore };
}

/**
 * Pull all events in batches until caught up.
 */
export async function fetchAllDeltas(lastSeq: number, signal?: AbortSignal): Promise<SyncEvent[]> {
  const allEvents: SyncEvent[] = [];
  let cursor = lastSeq;

  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Delta sync aborted", "AbortError");
    }

    const { events, hasMore } = await fetchDelta(cursor, 200);
    allEvents.push(...events);

    if (events.length > 0) {
      cursor = events[events.length - 1].seq;
    }

    if (!hasMore) break;
  }

  return allEvents;
}

export interface PullAndApplyDeltaResult {
  fetched: number;
  applied: number;
  lastSeq: number;
}

/**
 * Pull and apply events from the same cursor used by eventSync.
 * Keep lifecycle callers away from syncCursor-v2; eventSync persists its cursor
 * in SYNC_SEQ_KEY after a successful IndexedDB transaction.
 */
export async function pullAndApplyDeltasFromLastSeq(
  signal?: AbortSignal
): Promise<PullAndApplyDeltaResult> {
  const lastSeq = await getLastSeq();
  const events = await fetchAllDeltas(lastSeq, signal);

  if (events.length === 0) {
    return { fetched: 0, applied: 0, lastSeq };
  }

  const deviceId = await getPersistentDeviceId();
  const applied = await applyDelta(events, deviceId);
  const maxSeq = events[events.length - 1].seq;

  return { fetched: events.length, applied, lastSeq: maxSeq };
}

function readHabitCompletionIdentity(
  event: SyncEvent
): { habitId: string; date: string } | null {
  const payload = event.payload;
  const payloadHabitId = typeof payload?.habitId === "string" ? payload.habitId : null;
  const payloadDate = typeof payload?.date === "string" ? payload.date : null;
  if (payloadHabitId && payloadDate) {
    return { habitId: payloadHabitId, date: payloadDate };
  }

  const match = event.entity_id.match(/^(.*)_(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return { habitId: match[1], date: match[2] };
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readLoopHabitType(value: unknown, fallback: LoopHabitType): LoopHabitType {
  return value === "numerical" || value === "boolean" ? value : fallback;
}

function shouldKeepLocalHabitEntry(localEntry: unknown, event: SyncEvent): boolean {
  const loggedAt =
    localEntry && typeof localEntry === "object"
      ? (localEntry as Record<string, unknown>).loggedAt
      : null;
  if (typeof loggedAt !== "string") return false;

  const localTime = Date.parse(loggedAt);
  const remoteTime = Date.parse(event.created_at);
  return Number.isFinite(localTime) && Number.isFinite(remoteTime) && localTime > remoteTime;
}

async function applyHabitCompletionEvent(event: SyncEvent): Promise<boolean> {
  const identity = readHabitCompletionIdentity(event);
  if (!identity) return false;

  const habit = await db.habits.get(identity.habitId);
  if (!habit) return false;

  const entries = { ...(habit.entries || {}) };
  const existingEntry = entries[identity.date];
  if (shouldKeepLocalHabitEntry(existingEntry, event)) return false;

  if (event.op === "delete") {
    if (existingEntry) {
      delete entries[identity.date];
      await db.habits.put({ ...habit, entries, updatedAt: event.created_at });
      return true;
    }
    return false;
  }

  const payload = event.payload || {};
  const habitType = readLoopHabitType(payload.habitType, habit.habitType || "boolean");
  const entryValue =
    readNumber(payload.entryValue) ??
    decodeHabitCompletionFromCloud({
      habitType,
      count: readNumber(payload.count),
      duration: readNumber(payload.duration),
    });

  entries[identity.date] = {
    ...(existingEntry || {}),
    value: entryValue,
    loggedAt: event.created_at,
  };
  await db.habits.put({ ...habit, entries, updatedAt: event.created_at });
  return true;
}

// ── Apply delta to IndexedDB ──────────────────────────────────────────

/**
 * Apply a batch of sync events to IndexedDB atomically.
 * All events + cursor update happen in ONE Dexie transaction.
 * Uses timestamp-based conflict resolution (keep newer, like pullFromCloud).
 * Handles QuotaExceededError gracefully.
 */
export async function applyDelta(events: SyncEvent[], currentDeviceId: string): Promise<number> {
  if (events.length === 0) return 0;

  const remoteEvents = events.filter((e) => e.device_id !== currentDeviceId);
  if (remoteEvents.length === 0) {
    const maxSeq = events[events.length - 1].seq;
    await saveLastSeq(maxSeq);
    return 0;
  }

  const tableNames = new Set<string>();
  for (const event of remoteEvents) {
    const tableName = ENTITY_TABLE_MAP[event.entity_type];
    if (tableName) tableNames.add(tableName);
  }

  type TransactionTable = Table<unknown, IndexableType, unknown>;
  const tables: TransactionTable[] = [...tableNames].map(
    (name) => db.table(name) as unknown as TransactionTable
  );
  tables.push(db.settings as unknown as TransactionTable);

  const maxSeq = events[events.length - 1].seq;
  let applied = 0;

  try {
    // applied is set AFTER successful commit — rolled-back tx won't trigger refresh
    let txApplied = 0;
    await db.transaction("rw", tables, async () => {
      for (const event of remoteEvents) {
        const tableName = ENTITY_TABLE_MAP[event.entity_type];
        if (!tableName) continue;

        if (event.entity_type === "habit_completion") {
          if (await applyHabitCompletionEvent(event)) txApplied++;
          continue;
        }

        const table = db.table(tableName);

        switch (event.op) {
          case "upsert":
            if (event.payload) {
              // Timestamp-based conflict resolution: keep newer entry
              const entityId = event.payload.id as string;
              if (entityId) {
                const local = await table.get(entityId);
                if (local) {
                  const localTime = ((local as Record<string, unknown>).updatedAt as number) ?? 0;
                  const remoteTime = (event.payload.updatedAt as number) ?? 0;
                  if (localTime > remoteTime) break; // local is newer, skip
                }
              }
              await table.put(event.payload);
              txApplied++;
            }
            break;
          case "delete":
            await table.delete(event.entity_id);
            txApplied++;
            break;
        }
      }

      await db.settings.put({ key: SYNC_SEQ_KEY, value: maxSeq });
    });
    applied = txApplied; // only count after successful commit
  } catch (err) {
    // QuotaExceededError: stop retrying, notify user
    if (err instanceof Error && err.name === "QuotaExceededError") {
      logger.error("[EventSync] Storage quota exceeded during applyDelta");
      window.dispatchEvent(new CustomEvent("zenflow:storage-full"));
      throw err; // let caller handle (don't retry)
    }
    throw err;
  }

  if (applied > 0) {
    triggerDataRefresh();
  }

  logger.sync(`[EventSync] Applied ${applied} events, cursor at seq=${maxSeq}`);
  return applied;
}

// ── Server max seq ────────────────────────────────────────────────────

export async function getServerMaxSeq(): Promise<number> {
  if (!supabase) return 0;
  const userId = await getCurrentUserId();
  if (!userId) return 0;

  const { data, error } = await supabase.from("sync_seq_counters").select("last_seq").single();

  if (error || !data) return 0;
  return data.last_seq;
}
