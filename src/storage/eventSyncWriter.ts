/**
 * Event Sync writer — durable event publication and shared device identity.
 * Kept independent of delta application and journal recovery to avoid import cycles.
 */

import { supabase } from "@/lib/supabaseClient";
import { db, getLocalDataOwnerId } from "@/storage/db";
import { logger } from "@/lib/logger";
import { offlineQueue } from "@/lib/offlineQueue";
import { isAbortError } from "@/lib/validation";
import { broadcastChange, type SyncEntity } from "@/lib/syncBroadcast";
import { signalAutomationSourceReady } from "@/features/automation/automationRuntimeSignals";
import type { Json } from "@/types/supabase";
import { SyncOwnerBoundaryError, validateSyncOwner } from "@/storage/sync/syncOwner";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function normalizeSyncEventWriteIntent(
  intent: SyncEventWriteIntent,
  fallbackIdempotencyKey?: string
): SyncEventWriteIntent {
  return {
    ...intent,
    idempotencyKey: isUuid(intent.idempotencyKey)
      ? intent.idempotencyKey
      : isUuid(fallbackIdempotencyKey)
        ? fallbackIdempotencyKey
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
    logger.warn("[EventSync] writeEvent failed");
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
  options: {
    expectedOwnerUserId: string;
    queueOnFailure?: boolean;
    idempotencyKey?: string;
    requireRemoteCommit?: boolean;
  }
): Promise<SyncEvent | null> {
  const intent = withIdempotencyKey({
    entityType,
    entityId,
    op,
    payload,
    deviceId,
    idempotencyKey: options.idempotencyKey,
  });
  const { expectedOwnerUserId } = options;
  try {
    const event = await writeEventStrict(intent, expectedOwnerUserId);
    broadcastChange(SYNC_ENTITY_BROADCAST_MAP[entityType], event.seq);
    signalAutomationSourceReady();
    return event;
  } catch (err) {
    if (options.requireRemoteCommit) throw err;
    if (err instanceof AccountOwnerChangedError) {
      logger.warn("[EventSync] Event write stopped at an account boundary");
      return null;
    }
    if (!isAbortError(err)) {
      logger.warn("[EventSync] Durable event write failed; queued for retry");
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
  signalAutomationSourceReady();
  return event;
}

/** Broadcast a server-validated event receipt without issuing another write. */
export function broadcastCommittedSyncEvent(event: SyncEvent): void {
  broadcastChange(SYNC_ENTITY_BROADCAST_MAP[event.entity_type], event.seq);
  signalAutomationSourceReady();
}

export async function validateEventSyncNetworkOwner(
  expectedOwnerUserId: string | undefined,
  operation: string
): Promise<string> {
  const ownerUserId = await validateSyncOwner(expectedOwnerUserId, operation);
  if (!ownerUserId || (await getLocalDataOwnerId()) !== ownerUserId) {
    throw new SyncOwnerBoundaryError(operation);
  }
  return ownerUserId;
}
