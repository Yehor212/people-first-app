/**
 * Event Sync — Core engine for Telegram-style delta synchronization.
 *
 * writeEvent: Records a sync event after successful cloud operation.
 * fetchDelta: Pulls events newer than lastSeq (keyset pagination).
 * applyDelta: Applies events to IndexedDB atomically in a single transaction.
 * getLastSeq / saveLastSeq: Cursor management via Dexie settings table.
 */

import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import { db, getLocalDataOwnerId } from "@/storage/db";
import { logger } from "@/lib/logger";
import { offlineQueue } from "@/lib/offlineQueue";
import { isAbortError } from "@/lib/validation";
import { triggerDataRefresh } from "@/hooks/useIndexedDB";
import { broadcastChange, type SyncEntity } from "@/lib/syncBroadcast";
import type { Json } from "@/types/supabase";
import Dexie, { type IndexableType, type Table } from "dexie";
import type { LoopHabitType } from "@/types";
import { decodeHabitCompletionFromCloud } from "@/storage/sync/habitCompletionCodec";
import { storageRemove } from "@/lib/safeJson";
import {
  getDeletionTrackerKeyForSyncEntity,
  normalizeDeletedIdsForStorage,
} from "@/storage/deletionTracker";
import { isAccountSyncedSettingKey } from "@/storage/sync/settingSyncPolicy";
import { applyIncomingAccountSetting } from "@/storage/sync/journalVaultSyncPolicy";
import { SyncOwnerBoundaryError, validateSyncOwner } from "@/storage/sync/syncOwner";
import { SK } from "@/lib/storageKeys";
import {
  MAX_AUDIO_PER_ENTRY,
  MAX_AUDIO_DURATION_SEC,
  MAX_PHOTOS_PER_ENTRY,
  MAX_STICKERS_PER_ENTRY,
  type JournalAudio,
  type JournalEntry,
} from "@/features/journal/types";
import { normalizeJournalAudioMimeType } from "@/features/journal/journalAudioValidation";
import { normalizeJournalPhotoLayout } from "@/features/journal/photoLayout";
import {
  normalizeJournalStyleFields,
  normalizeJournalStyleFieldsFromCloud,
} from "@/features/journal/journalStyleFields";
import { isEncryptedJournalContent } from "@/features/journal/journalCrypto";
import { runWithJournalSecurityWriteLock } from "@/features/journal/journalSecurityWriteLock";
import {
  persistAutomationRemoteEventInCurrentTransaction,
  reconcileAutomationRemoteEventsInCurrentTransaction,
  reconcilePendingAutomationEvents as reconcilePendingAutomationEventsImpl,
} from "@/features/automation/automationRemoteSync";
import { reconcilePendingAutomationHistoryPurges } from "@/features/automation/automationHistoryClear";
import { hashAutomationValue } from "@/features/automation/canonicalJson";
import { automationRecordRevisionStoreRowSchema } from "@/features/automation/types";

// ── Types ─────────────────────────────────────────────────────────────

export type SyncEntityType =
  | "mood"
  | "habit"
  | "focus"
  | "gratitude"
  | "journal"
  | "habit_completion"
  | "setting"
  | "automation_transaction"
  | "automation_history_purge";

export type SyncOp = "upsert" | "delete";
export type ClientWritableSyncEntityType = Exclude<
  SyncEntityType,
  "automation_transaction" | "automation_history_purge"
>;

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

export interface SyncEventWriteIntent {
  entityType: ClientWritableSyncEntityType;
  entityId: string;
  op: SyncOp;
  payload: Record<string, unknown> | null;
  deviceId: string;
  idempotencyKey?: string;
}

class AccountOwnerChangedError extends Error {
  constructor() {
    super("[EventSync] Active account changed before event write");
    this.name = "AccountOwnerChangedError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Entity type to Dexie table mapping ────────────────────────────────

// Maps entity types to Dexie table names for applyDelta.
// habit_completion: no dedicated table — completions are embedded in habit.entries.
// setting: no dedicated table — settings are keyed records in db.settings.
const ENTITY_TABLE_MAP: Record<string, string> = {
  mood: "moods",
  habit: "habits",
  habit_completion: "habits",
  focus: "focusSessions",
  gratitude: "gratitudeEntries",
  journal: "journalEntries",
  setting: "settings",
  automation_transaction: "automationRemoteEvents",
  automation_history_purge: "automationRemoteEvents",
};

// ── Cursor management ─────────────────────────────────────────────────

const SYNC_SEQ_KEY = "sync-last-seq";
const DEVICE_ID_KEY = "zenflow-device-id";
const SYNC_ENTITY_BROADCAST_MAP: Record<SyncEntityType, SyncEntity> = {
  mood: "moods",
  habit: "habits",
  focus: "focus",
  gratitude: "gratitude",
  journal: "journal",
  habit_completion: "habits",
  setting: "settings",
  automation_transaction: "automation",
  automation_history_purge: "automation",
};

const SYNC_ENTITY_TYPES: SyncEntityType[] = [
  "mood",
  "habit",
  "focus",
  "gratitude",
  "journal",
  "habit_completion",
  "setting",
  "automation_transaction",
  "automation_history_purge",
];

const CLIENT_WRITABLE_SYNC_ENTITY_TYPES = new Set<ClientWritableSyncEntityType>([
  "mood",
  "habit",
  "focus",
  "gratitude",
  "journal",
  "habit_completion",
  "setting",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSyncEvent(value: unknown): value is SyncEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.seq === "number" &&
    Number.isSafeInteger(value.seq) &&
    value.seq > 0 &&
    typeof value.entity_type === "string" &&
    SYNC_ENTITY_TYPES.includes(value.entity_type as SyncEntityType) &&
    typeof value.entity_id === "string" &&
    value.entity_id.length > 0 &&
    (value.op === "upsert" || value.op === "delete") &&
    (value.payload === null || isRecord(value.payload)) &&
    typeof value.device_id === "string" &&
    value.device_id.length > 0 &&
    typeof value.created_at === "string" &&
    Number.isFinite(Date.parse(value.created_at))
  );
}

const JOURNAL_MOODS = new Set(["great", "good", "okay", "bad", "terrible"]);
const MAX_JOURNAL_TAGS = 100;
const MAX_JOURNAL_HABIT_SNAPSHOT_ITEMS = 100;

function normalizeBoundedStringArray(value: unknown, maximum: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  if (!value.every((item) => typeof item === "string")) return null;
  return [...new Set(value)];
}

function normalizeJournalHabitSnapshot(value: unknown): JournalEntry["habitSnapshot"] {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > MAX_JOURNAL_HABIT_SNAPSHOT_ITEMS) return undefined;

  const normalized = value.filter(
    (item): item is NonNullable<JournalEntry["habitSnapshot"]>[number] =>
      isRecord(item) &&
      typeof item.habitId === "string" &&
      typeof item.habitName === "string" &&
      typeof item.habitIcon === "string" &&
      typeof item.completed === "boolean"
  );
  return normalized.length === value.length ? normalized : undefined;
}

function normalizeJournalDeltaPayload(
  payload: Record<string, unknown>,
  entityId: string
): JournalEntry | null {
  const photoIds = normalizeBoundedStringArray(payload.photoIds, MAX_PHOTOS_PER_ENTRY);
  const stickers = normalizeBoundedStringArray(payload.stickers, MAX_STICKERS_PER_ENTRY);
  const tags = normalizeBoundedStringArray(payload.tags, MAX_JOURNAL_TAGS);
  const audioIds =
    payload.audioIds === undefined
      ? undefined
      : normalizeBoundedStringArray(payload.audioIds, MAX_AUDIO_PER_ENTRY);

  if (
    payload.id !== entityId ||
    typeof payload.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) ||
    typeof payload.title !== "string" ||
    typeof payload.content !== "string" ||
    typeof payload.createdAt !== "number" ||
    !Number.isFinite(payload.createdAt) ||
    typeof payload.updatedAt !== "number" ||
    !Number.isFinite(payload.updatedAt) ||
    !photoIds ||
    !stickers ||
    !tags ||
    audioIds === null
  ) {
    return null;
  }

  const habitSnapshot = normalizeJournalHabitSnapshot(payload.habitSnapshot);
  if (payload.habitSnapshot !== undefined && payload.habitSnapshot !== null && !habitSnapshot) {
    return null;
  }

  return {
    id: entityId,
    date: payload.date,
    title: payload.title,
    content: payload.content,
    stickers,
    photoIds,
    audioIds,
    mood:
      typeof payload.mood === "string" && JOURNAL_MOODS.has(payload.mood)
        ? (payload.mood as JournalEntry["mood"])
        : undefined,
    tags,
    templateId: typeof payload.templateId === "string" ? payload.templateId : undefined,
    habitSnapshot,
    photoLayout: normalizeJournalPhotoLayout(payload.photoLayout, photoIds),
    ...normalizeJournalStyleFields(payload),
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  };
}

function isContentlessJournalEventPayload(payload: Record<string, unknown> | null): boolean {
  return (
    payload !== null &&
    payload.schemaVersion === 1 &&
    Object.keys(payload).length === 1
  );
}

async function fetchCurrentJournalEntriesForContentlessEvents(
  events: SyncEvent[],
  ownerUserId: string
): Promise<Map<string, JournalEntry>> {
  if (!supabase) return new Map();

  const requestedIds = new Set(
    events
      .filter(
        (event) =>
          event.entity_type === "journal" &&
          event.op === "upsert" &&
          isContentlessJournalEventPayload(event.payload)
      )
      .map((event) => event.entity_id)
  );
  if (requestedIds.size === 0) return new Map();

  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", ownerUserId)
    .in("id", [...requestedIds]);
  if (error) throw error;

  const result = new Map<string, JournalEntry>();
  for (const rawRow of data ?? []) {
    const row = rawRow as unknown as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      !requestedIds.has(row.id) ||
      row.user_id !== ownerUserId
    ) {
      continue;
    }
    const normalized = normalizeJournalDeltaPayload(
      {
        id: row.id,
        date: row.date,
        title: row.title,
        content: row.content,
        stickers: row.stickers,
        mood: row.mood,
        tags: row.tags,
        templateId: row.template_id,
        habitSnapshot: row.habit_snapshot,
        photoIds: row.photo_ids,
        audioIds: row.audio_ids,
        photoLayout: row.photo_layout,
        ...normalizeJournalStyleFieldsFromCloud(row),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      row.id
    );
    if (normalized) result.set(row.id, normalized);
  }
  return result;
}

async function fetchLinkedJournalAudioMetadata(
  entries: JournalEntry[],
  ownerUserId: string
): Promise<Map<string, JournalAudio>> {
  if (!supabase) return new Map();

  const requestedParents = new Map<string, string>();
  const conflictingIds = new Set<string>();
  for (const entry of entries) {
    for (const audioId of entry.audioIds ?? []) {
      const existingParent = requestedParents.get(audioId);
      if (existingParent && existingParent !== entry.id) {
        conflictingIds.add(audioId);
        requestedParents.delete(audioId);
      } else if (!conflictingIds.has(audioId)) {
        requestedParents.set(audioId, entry.id);
      }
    }
  }

  const requestedIds = [...requestedParents.keys()];
  if (requestedIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("journal_audio")
    .select("id, entry_id, duration, mime_type, storage_path, created_at")
    .eq("user_id", ownerUserId)
    .in("id", requestedIds);
  if (error) throw error;

  const result = new Map<string, JournalAudio>();
  for (const row of data ?? []) {
    const expectedParent = requestedParents.get(row.id);
    const storagePath = row.storage_path;
    const normalizedMimeType = normalizeJournalAudioMimeType(row.mime_type);
    if (
      !expectedParent ||
      row.entry_id !== expectedParent ||
      typeof row.duration !== "number" ||
      !Number.isFinite(row.duration) ||
      row.duration < 0 ||
      row.duration > MAX_AUDIO_DURATION_SEC ||
      !normalizedMimeType ||
      typeof storagePath !== "string" ||
      !storagePath.startsWith(`${ownerUserId}/`) ||
      storagePath.includes("..") ||
      typeof row.created_at !== "number" ||
      !Number.isFinite(row.created_at)
    ) {
      logger.warn("[EventSync] Ignored invalid journal audio metadata:", row.id);
      continue;
    }

    result.set(row.id, {
      id: row.id,
      entryId: row.entry_id,
      data: "",
      duration: row.duration,
      mimeType: normalizedMimeType,
      storagePath,
      createdAt: row.created_at,
    });
  }
  return result;
}

export function isSyncEventWriteIntent(value: unknown): value is SyncEventWriteIntent {
  if (!isRecord(value)) return false;

  const { entityType, entityId, op, payload, deviceId, idempotencyKey } = value;
  return (
    typeof entityType === "string" &&
    CLIENT_WRITABLE_SYNC_ENTITY_TYPES.has(entityType as ClientWritableSyncEntityType) &&
    typeof entityId === "string" &&
    entityId.length > 0 &&
    (op === "upsert" || op === "delete") &&
    (payload === null || isRecord(payload)) &&
    typeof deviceId === "string" &&
    deviceId.length > 0 &&
    (idempotencyKey === undefined ||
      (typeof idempotencyKey === "string" && idempotencyKey.length > 0))
  );
}

function createEventIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isUuid(value: string | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function normalizeSyncEventWriteIntent(intent: SyncEventWriteIntent): SyncEventWriteIntent {
  return {
    ...intent,
    payload:
      intent.entityType === "journal"
        ? intent.op === "upsert"
          ? { schemaVersion: 1 }
          : null
        : intent.payload,
    idempotencyKey: isUuid(intent.idempotencyKey)
      ? intent.idempotencyKey
      : createEventIdempotencyKey(),
  };
}

function withIdempotencyKey(intent: SyncEventWriteIntent): SyncEventWriteIntent {
  return normalizeSyncEventWriteIntent(intent);
}

function isDuplicateIdempotencyError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return (
    error.code === "23505" ||
    (typeof error.message === "string" && error.message.includes("sync_events_idempotency_idx"))
  );
}

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
export async function bootstrapLastSeq(expectedOwnerUserId?: string): Promise<number> {
  const ownerUserId = await resolveDeltaOwner({ expectedOwnerUserId }, "Delta cursor bootstrap");
  const localSeq = await getLastSeq();
  await assertDeltaOwnerCurrent(ownerUserId, undefined, "Delta cursor bootstrap");
  if (localSeq > 0) return localSeq;
  const serverMax = await getServerMaxSeq(ownerUserId);
  if (serverMax > 0) {
    await saveLastSeq(serverMax, {
      expectedOwnerUserId: ownerUserId,
    });
    logger.sync(`[EventSync] Bootstrapped lastSeq to ${serverMax}`);
  }
  return serverMax;
}

export async function getLastSeq(): Promise<number> {
  const entry = await db.settings.get(SYNC_SEQ_KEY);
  return (entry?.value as number) ?? 0;
}

export async function saveLastSeq(
  seq: number,
  ownerOptions?: ApplyDeltaOwnerOptions
): Promise<void> {
  const ownerUserId = await resolveDeltaOwner(ownerOptions, "Delta cursor update");
  await db.transaction("rw", [db.settings], async () => {
    await Dexie.waitFor(
      assertDeltaOwnerCurrent(ownerUserId, ownerOptions, "Delta cursor update transaction")
    );
    await db.settings.put({ key: SYNC_SEQ_KEY, value: seq });
    await Dexie.waitFor(
      assertDeltaOwnerCurrent(ownerUserId, ownerOptions, "Delta cursor update transaction")
    );
  });
}

// ── Write event (called after successful sync op) ─────────────────────

/**
 * Record a sync event in the cloud event log.
 * The server assigns seq via BEFORE INSERT trigger.
 * Callers that need cross-device convergence should use writeEventAndBroadcast()
 * so transient failures enter the durable WRITE_SYNC_EVENT outbox.
 */
async function writeEventStrict(
  intent: SyncEventWriteIntent,
  expectedOwnerUserId: string
): Promise<SyncEvent> {
  if (!supabase) throw new Error("[EventSync] Supabase not configured");
  let userId: string;
  try {
    userId = await validateEventSyncNetworkOwner(expectedOwnerUserId, "Event write");
  } catch {
    throw new AccountOwnerChangedError();
  }
  const stableIntent = withIdempotencyKey(intent);

  const { data, error } = await supabase
    .from("sync_events")
    .insert({
      user_id: userId,
      entity_type: stableIntent.entityType,
      entity_id: stableIntent.entityId,
      op: stableIntent.op,
      payload: stableIntent.payload as Json,
      device_id: stableIntent.deviceId,
      idempotency_key: stableIntent.idempotencyKey,
    })
    .select("id, seq, entity_type, entity_id, op, payload, device_id, created_at")
    .single();

  if (error) {
    if (stableIntent.idempotencyKey && isDuplicateIdempotencyError(error)) {
      const existing = await fetchEventByIdempotencyKey(userId, stableIntent.idempotencyKey);
      if (existing) return existing;
    }
    throw new Error(`[EventSync] writeEvent failed: ${error.message}`);
  }
  if (!data) throw new Error("[EventSync] writeEvent failed: empty response");

  return data as SyncEvent;
}

async function fetchEventByIdempotencyKey(
  userId: string,
  idempotencyKey: string
): Promise<SyncEvent | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("sync_events")
    .select("id, seq, entity_type, entity_id, op, payload, device_id, created_at")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .single();

  if (error || !data) return null;
  return data as SyncEvent;
}

async function queueSyncEventWrite(
  intent: SyncEventWriteIntent,
  expectedOwnerUserId: string
): Promise<void> {
  const stableIntent = withIdempotencyKey(intent);
  await offlineQueue.enqueue(
    "WRITE_SYNC_EVENT",
    `sync-event:${stableIntent.entityType}:${stableIntent.entityId}:${stableIntent.op}:${Date.now()}`,
    stableIntent,
    {
      expectedOwnerUserId,
      deduplicate: false,
      maxRetries: 20,
      priority: "critical",
    }
  );
}

export async function writeEvent(
  entityType: ClientWritableSyncEntityType,
  entityId: string,
  op: SyncOp,
  payload: Record<string, unknown> | null,
  deviceId: string,
  expectedOwnerUserId: string
): Promise<SyncEvent | null> {
  try {
    return await writeEventStrict(
      { entityType, entityId, op, payload, deviceId },
      expectedOwnerUserId
    );
  } catch (err) {
    if (isAbortError(err)) return null;
    logger.warn("[EventSync] writeEvent error:", err);
    return null;
  }
}

/**
 * Record the durable event first, then wake other clients.
 * Broadcast is only a hint; the ordered sync_events row is the source of truth.
 */
export async function writeEventAndBroadcast(
  entityType: ClientWritableSyncEntityType,
  entityId: string,
  op: SyncOp,
  payload: Record<string, unknown> | null,
  deviceId: string,
  options: { expectedOwnerUserId: string; queueOnFailure?: boolean }
): Promise<SyncEvent | null> {
  const intent = withIdempotencyKey({ entityType, entityId, op, payload, deviceId });
  const { expectedOwnerUserId } = options;
  try {
    const event = await writeEventStrict(intent, expectedOwnerUserId);
    broadcastChange(SYNC_ENTITY_BROADCAST_MAP[entityType], event.seq);
    return event;
  } catch (err) {
    if (err instanceof AccountOwnerChangedError) {
      logger.warn("[EventSync] Event write stopped at an account boundary");
      return null;
    }
    if (!isAbortError(err)) {
      logger.warn("[EventSync] Durable event write failed; queued for retry:", err);
    }
    if (options.queueOnFailure !== false) {
      await queueSyncEventWrite(intent, expectedOwnerUserId);
    }
    return null;
  }
}

export async function writeQueuedEventAndBroadcast(
  intent: SyncEventWriteIntent,
  expectedOwnerUserId: string
): Promise<SyncEvent> {
  const event = await writeEventStrict(intent, expectedOwnerUserId);
  broadcastChange(SYNC_ENTITY_BROADCAST_MAP[intent.entityType], event.seq);
  return event;
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
  await validateEventSyncNetworkOwner(userId, "Delta fetch");

  const { data, error } = await supabase
    .from("sync_events")
    .select("id, seq, entity_type, entity_id, op, payload, device_id, created_at")
    .gt("seq", lastSeq)
    .order("seq", { ascending: true })
    .limit(limit + 1);

  await validateEventSyncNetworkOwner(userId, "Delta fetch");

  if (error) {
    throw new Error(`[EventSync] fetchDelta failed: ${error.message}`);
  }

  const hasMore = (data?.length ?? 0) > limit;
  const rawEvents = (data ?? []).slice(0, limit);
  const events = rawEvents.map((event) => {
    if (!isSyncEvent(event)) {
      throw new Error("[EventSync] fetchDelta returned an invalid event envelope");
    }
    return event;
  });

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

export interface ApplyDeltaOwnerOptions {
  expectedOwnerUserId?: string;
  assertOwnerCurrent?: () => Promise<void>;
}

async function resolveDeltaOwner(
  options: ApplyDeltaOwnerOptions | undefined,
  operation: string
): Promise<string> {
  await options?.assertOwnerCurrent?.();
  const ownerUserId = await validateEventSyncNetworkOwner(options?.expectedOwnerUserId, operation);
  if (!ownerUserId) throw new SyncOwnerBoundaryError(operation);
  return ownerUserId;
}

async function validateEventSyncNetworkOwner(
  expectedOwnerUserId: string | undefined,
  operation: string
): Promise<string> {
  const ownerUserId = await validateSyncOwner(expectedOwnerUserId, operation);
  if (!ownerUserId || (await getLocalDataOwnerId()) !== ownerUserId) {
    throw new SyncOwnerBoundaryError(operation);
  }
  return ownerUserId;
}

async function assertDeltaOwnerCurrent(
  ownerUserId: string,
  options: ApplyDeltaOwnerOptions | undefined,
  operation: string
): Promise<void> {
  await options?.assertOwnerCurrent?.();
  await validateSyncOwner(ownerUserId, operation);
}

/**
 * Pull and apply events from the same cursor used by eventSync.
 * Keep lifecycle callers away from syncCursor-v2; eventSync persists its cursor
 * in SYNC_SEQ_KEY after a successful IndexedDB transaction.
 */
export async function pullAndApplyDeltasFromLastSeq(
  signal?: AbortSignal
): Promise<PullAndApplyDeltaResult> {
  const ownerUserId = await resolveDeltaOwner(undefined, "Delta pull and apply");
  const lastSeq = await getLastSeq();
  const events = await fetchAllDeltas(lastSeq, signal);

  if (events.length === 0) {
    return { fetched: 0, applied: 0, lastSeq };
  }

  const deviceId = await getPersistentDeviceId();
  const applied = await applyDelta(events, deviceId, {
    expectedOwnerUserId: ownerUserId,
  });
  const maxSeq = events[events.length - 1].seq;

  return { fetched: events.length, applied, lastSeq: maxSeq };
}

function readHabitCompletionIdentity(event: SyncEvent): { habitId: string; date: string } | null {
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

function readTimestampMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readEntityTimestampMs(entity: unknown): number {
  if (!entity || typeof entity !== "object") return 0;
  const record = entity as Record<string, unknown>;
  return (
    readTimestampMs(record.updatedAt) ||
    readTimestampMs(record.updated_at) ||
    readTimestampMs(record.timestamp) ||
    readTimestampMs(record.createdAt) ||
    readTimestampMs(record.created_at)
  );
}

function readLinkedMediaIds(entity: unknown, key: "photoIds" | "audioIds"): string[] {
  if (!entity || typeof entity !== "object") return [];
  const value = (entity as Record<string, unknown>)[key];
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
}

function getRemovedLinkedMediaIds(
  local: unknown,
  remote: unknown,
  key: "photoIds" | "audioIds"
): string[] {
  const nextIds = new Set(readLinkedMediaIds(remote, key));
  return readLinkedMediaIds(local, key).filter((id) => !nextIds.has(id));
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

async function applyHabitCompletionEvent(
  event: SyncEvent,
  isHabitTombstoned: (habitId: string) => Promise<boolean> = (habitId) =>
    isEntityIdLocallyTombstoned("habit", habitId)
): Promise<boolean> {
  const identity = readHabitCompletionIdentity(event);
  if (!identity) return false;

  if (await isHabitTombstoned(identity.habitId)) {
    await db.habits.delete(identity.habitId);
    return false;
  }

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

async function applySettingEvent(event: SyncEvent, ownerUserId: string): Promise<boolean> {
  const payload = event.payload || {};
  const key = typeof payload.key === "string" ? payload.key : event.entity_id;
  if (!key) return false;
  if (!isAccountSyncedSettingKey(key)) return false;

  if (event.op === "delete") {
    await db.settings.delete(key);
    storageRemove(key);
    return true;
  }

  if (!Object.prototype.hasOwnProperty.call(payload, "value")) return false;

  let planningRevision: ReturnType<typeof automationRecordRevisionStoreRowSchema.parse> | null = null;
  if (key === "zenflow-schedule-events" && payload.automationRevision !== undefined) {
    const parsedRevision = automationRecordRevisionStoreRowSchema.safeParse({
      kind: "record_revision",
      id: "record_revision:setting:zenflow-schedule-events",
      schemaVersion: 1,
      ownerUserId,
      entityType: "setting",
      entityId: "zenflow-schedule-events",
      ...(typeof payload.automationRevision === "object" && payload.automationRevision !== null
        ? payload.automationRevision
        : {}),
    });
    if (!parsedRevision.success) return false;
    const stateHash = await Dexie.waitFor(hashAutomationValue(payload.value));
    if (stateHash !== parsedRevision.data.stateHash) return false;
    planningRevision = parsedRevision.data;
  }

  const applied = await applyIncomingAccountSetting(key, payload.value);
  if (applied && planningRevision) {
    await db.automationTransactions.put(planningRevision);
  }
  return applied;
}

function readDeletedIdsSettingValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.length > 0);
}

async function isEntityIdLocallyTombstoned(entityType: string, entityId: string): Promise<boolean> {
  const key = getDeletionTrackerKeyForSyncEntity(entityType);
  if (!key) return false;

  const existing = await db.settings.get(key);
  return readDeletedIdsSettingValue(existing?.value).includes(entityId);
}

async function rememberAppliedDelete(event: SyncEvent): Promise<void> {
  const key = getDeletionTrackerKeyForSyncEntity(event.entity_type);
  if (!key) return;

  const existing = await db.settings.get(key);
  const ids = readDeletedIdsSettingValue(existing?.value);
  if (!ids.includes(event.entity_id)) {
    ids.push(event.entity_id);
  }

  await db.settings.put({
    key,
    value: normalizeDeletedIdsForStorage(ids),
  });
}

// ── Apply delta to IndexedDB ──────────────────────────────────────────

/**
 * Apply a batch of sync events to IndexedDB atomically.
 * All events + cursor update happen in ONE Dexie transaction.
 * Uses server event order as the cross-device authority. Entity timestamps only
 * guard a newer local write that has not yet reached the durable event log.
 * Handles QuotaExceededError gracefully.
 */
export async function applyDelta(
  events: SyncEvent[],
  currentDeviceId: string,
  ownerOptions?: ApplyDeltaOwnerOptions
): Promise<number> {
  if (events.length === 0) return 0;
  if (!events.every(isSyncEvent)) {
    throw new Error("[EventSync] Refused an invalid event envelope");
  }

  const ownerUserId = await resolveDeltaOwner(ownerOptions, "Delta apply");
  const assertOwnerInTransaction = () =>
    Dexie.waitFor(assertDeltaOwnerCurrent(ownerUserId, ownerOptions, "Delta apply transaction"));

  const remoteEvents = events
    .filter(
      (event) =>
        event.device_id !== currentDeviceId ||
        event.entity_type === "automation_transaction" ||
        event.entity_type === "automation_history_purge",
    )
    .sort((left, right) => left.seq - right.seq || left.id.localeCompare(right.id));
  if (remoteEvents.length === 0) {
    const maxSeq = Math.max(...events.map((event) => event.seq));
    await db.transaction("rw", [db.settings], async () => {
      await assertOwnerInTransaction();
      await db.settings.put({ key: SYNC_SEQ_KEY, value: maxSeq });
      await assertOwnerInTransaction();
    });
    return 0;
  }

  const fetchedJournalEntries = await fetchCurrentJournalEntriesForContentlessEvents(
    remoteEvents,
    ownerUserId
  );
  const resolveJournalEntry = (event: SyncEvent): JournalEntry | null => {
    if (event.entity_type !== "journal" || event.op !== "upsert" || !event.payload) {
      return null;
    }
    return isContentlessJournalEventPayload(event.payload)
      ? fetchedJournalEntries.get(event.entity_id) ?? null
      : normalizeJournalDeltaPayload(event.payload, event.entity_id);
  };
  const linkedJournalAudio = await fetchLinkedJournalAudioMetadata(
    remoteEvents
      .map(resolveJournalEntry)
      .filter((entry): entry is JournalEntry => entry !== null),
    ownerUserId
  );

  const tableNames = new Set<string>();
  for (const event of remoteEvents) {
    const tableName = ENTITY_TABLE_MAP[event.entity_type];
    if (tableName) tableNames.add(tableName);
  }

  type TransactionTable = Table<unknown, IndexableType, unknown>;
  const tables: TransactionTable[] = [...tableNames].map(
    (name) => db.table(name) as unknown as TransactionTable
  );
  const includesJournalEvent = remoteEvents.some((event) => event.entity_type === "journal");
  if (includesJournalEvent) {
    tables.push(db.journalPhotos as unknown as TransactionTable);
    tables.push(db.journalAudio as unknown as TransactionTable);
  }
  const includesAutomationEvent = remoteEvents.some(
    (event) =>
      event.entity_type === "automation_transaction" ||
      event.entity_type === "automation_history_purge",
  );
  if (includesAutomationEvent) {
    for (const table of [
      db.moods,
      db.habits,
      db.journalEntries,
      db.offlineQueue,
      db.automationTransactions,
      db.automationHistoryMarkers,
      db.automationRemoteEvents,
    ]) {
      if (!tables.includes(table as unknown as TransactionTable)) {
        tables.push(table as unknown as TransactionTable);
      }
    }
  }
  const includesPlanningRevisionEvent = remoteEvents.some(
    (event) =>
      event.entity_type === "setting" &&
      event.entity_id === "zenflow-schedule-events" &&
      event.payload?.automationRevision !== undefined,
  );
  if (
    includesPlanningRevisionEvent &&
    !tables.includes(db.automationTransactions as unknown as TransactionTable)
  ) {
    tables.push(db.automationTransactions as unknown as TransactionTable);
  }
  if (!tableNames.has("settings")) {
    tables.push(db.settings as unknown as TransactionTable);
  }

  const maxSeq = Math.max(...events.map((event) => event.seq));
  let applied = 0;
  const batchTombstones = new Map<string, Set<string>>();

  const markBatchTombstone = (event: SyncEvent) => {
    if (!getDeletionTrackerKeyForSyncEntity(event.entity_type)) return;
    const ids = batchTombstones.get(event.entity_type) ?? new Set<string>();
    ids.add(event.entity_id);
    batchTombstones.set(event.entity_type, ids);
  };

  const isTombstonedInApply = async (entityType: string, entityId: string) =>
    batchTombstones.get(entityType)?.has(entityId) ||
    (await isEntityIdLocallyTombstoned(entityType, entityId));

  try {
    // applied is set AFTER successful commit — rolled-back tx won't trigger refresh
    let txApplied = 0;
    const applyTransaction = async () => {
      await db.transaction("rw", tables, async () => {
        await assertOwnerInTransaction();
        for (const event of remoteEvents) {
          const tableName = ENTITY_TABLE_MAP[event.entity_type];
          if (!tableName) continue;

          if (event.entity_type === "habit_completion") {
            if (
              await applyHabitCompletionEvent(event, (habitId) =>
                isTombstonedInApply("habit", habitId)
              )
            )
              txApplied++;
            continue;
          }
          if (event.entity_type === "setting") {
            if (await applySettingEvent(event, ownerUserId)) txApplied++;
            continue;
          }
          if (
            event.entity_type === "automation_transaction" ||
            event.entity_type === "automation_history_purge"
          ) {
            await persistAutomationRemoteEventInCurrentTransaction(
              {
                entityType: event.entity_type,
                id: event.id,
                seq: event.seq,
                entityId: event.entity_id,
                op: event.op,
                payload: event.payload,
                createdAt: event.created_at,
              },
              ownerUserId,
            );
            continue;
          }

          const table = db.table(tableName);

          switch (event.op) {
            case "upsert":
              if (event.payload) {
                if (await isTombstonedInApply(event.entity_type, event.entity_id)) {
                  break;
                }
                let payload: Record<string, unknown> = event.payload;
                let normalizedJournalEntry: JournalEntry | null = null;
                if (event.entity_type === "journal") {
                  normalizedJournalEntry = resolveJournalEntry(event);
                  if (!normalizedJournalEntry) break;

                  const protectedJournalAtCommit = Boolean(
                    await db.settings.get(SK.JOURNAL_PASSWORD)
                  );
                  if (
                    protectedJournalAtCommit &&
                    normalizedJournalEntry.content &&
                    !isEncryptedJournalContent(normalizedJournalEntry.content)
                  ) {
                    break;
                  }
                  payload = normalizedJournalEntry as unknown as Record<string, unknown>;
                }

                // Timestamp-based conflict resolution: keep newer entry
                const entityId = payload.id as string;
                if (entityId) {
                  const local = await table.get(entityId);
                  if (local) {
                    const localTime = readEntityTimestampMs(local);
                    const remoteTime = Math.max(
                      readEntityTimestampMs(payload),
                      readTimestampMs(event.created_at)
                    );
                    if (localTime > remoteTime) break; // local is newer, skip
                    if (event.entity_type === "journal") {
                      const removedPhotoIds = getRemovedLinkedMediaIds(local, payload, "photoIds");
                      const removedAudioIds = getRemovedLinkedMediaIds(local, payload, "audioIds");
                      if (removedPhotoIds.length > 0) {
                        await db.journalPhotos.bulkDelete(removedPhotoIds);
                      }
                      if (removedAudioIds.length > 0) {
                        await db.journalAudio.bulkDelete(removedAudioIds);
                      }
                    }
                  }
                }
                await table.put(payload);
                if (normalizedJournalEntry?.audioIds?.length) {
                  const linkedAudio = normalizedJournalEntry.audioIds
                    .map((audioId) => linkedJournalAudio.get(audioId))
                    .filter((audio): audio is JournalAudio => Boolean(audio));
                  if (linkedAudio.length > 0) {
                    const mergedAudio = await Promise.all(
                      linkedAudio.map(async (remoteAudio) => {
                        const localAudio = await db.journalAudio.get(remoteAudio.id);
                        return localAudio?.data
                          ? { ...remoteAudio, data: localAudio.data }
                          : remoteAudio;
                      })
                    );
                    await db.journalAudio.bulkPut(mergedAudio);
                  }
                }
                txApplied++;
              }
              break;
            case "delete":
              if (event.entity_type === "journal") {
                await db.journalPhotos.where("entryId").equals(event.entity_id).delete();
                await db.journalAudio.where("entryId").equals(event.entity_id).delete();
              }
              await table.delete(event.entity_id);
              await rememberAppliedDelete(event);
              markBatchTombstone(event);
              txApplied++;
              break;
          }
        }

        if (includesAutomationEvent) {
          const automationResult = await reconcileAutomationRemoteEventsInCurrentTransaction(
            ownerUserId,
          );
          txApplied += automationResult.applied;
        }

        await assertOwnerInTransaction();
        await db.settings.put({ key: SYNC_SEQ_KEY, value: maxSeq });
      });
    };
    if (
      remoteEvents.some(
        (event) =>
          event.entity_type === "journal" ||
          event.entity_type === "automation_transaction" ||
          event.entity_type === "automation_history_purge",
      )
    ) {
      await runWithJournalSecurityWriteLock(applyTransaction);
    } else {
      await applyTransaction();
    }
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

  await assertDeltaOwnerCurrent(ownerUserId, ownerOptions, "Delta apply completion");

  if (includesAutomationEvent) {
    try {
      await reconcilePendingAutomationHistoryPurges(ownerUserId);
    } catch {
      logger.warn("[EventSync] Accepted automation history purge remains deferred");
    }
  }

  if (applied > 0) {
    await triggerDataRefresh();
  }

  logger.sync(`[EventSync] Applied ${applied} events, cursor at seq=${maxSeq}`);
  return applied;
}

export async function reconcilePendingAutomationEvents(
  expectedOwnerUserId: string,
) {
  const result = await reconcilePendingAutomationEventsImpl(expectedOwnerUserId);
  if (result.applied > 0) await triggerDataRefresh();
  return result;
}

// ── Server max seq ────────────────────────────────────────────────────

export async function getServerMaxSeq(expectedOwnerUserId?: string): Promise<number> {
  if (!supabase) return 0;
  const activeOwnerUserId = await getCurrentUserId();
  if (!activeOwnerUserId) return 0;
  const ownerUserId = await validateEventSyncNetworkOwner(
    expectedOwnerUserId ?? activeOwnerUserId,
    "Server max sequence"
  );

  const { data, error } = await supabase.from("sync_seq_counters").select("last_seq").single();

  await validateEventSyncNetworkOwner(ownerUserId, "Server max sequence");
  if (error || !data) return 0;
  return data.last_seq;
}
