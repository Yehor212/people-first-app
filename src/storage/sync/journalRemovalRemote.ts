import { isEncryptedJournalContent } from "@/features/journal/journalCrypto";
import { isEncryptedJournalMediaData } from "@/features/journal/journalMediaCrypto";
import { journalInventorySha256 } from "@/features/journal/journalRemovalInventory";
import { journalStyleFieldsToCloud } from "@/features/journal/journalStyleFields";
import type {
  JournalLocalCommitInventory,
  JournalLocalCommitPostimageReceipt,
} from "@/features/journal/journalSecurityMigration";
import type { JournalAudio, JournalEntry, JournalPhoto } from "@/features/journal/types";
import { SK } from "@/lib/storageKeys";
import { supabase } from "@/lib/supabaseClient";
import { db, getLocalDataOwnerId } from "@/storage/db";
import {
  writeExactEventAndBroadcast,
  type SyncEventWriteIntent,
} from "@/storage/eventSync";
import type { Json } from "@/types/supabase";
import {
  REQUIRED_REMOTE_COMMIT_RESULT,
  RequiredRemoteCommitError,
  type RequiredRemoteCommitResult,
} from "./remoteCommit";
import { validateSyncOwner } from "./syncOwner";

const PROTECTION_JOURNAL_BACKUP_FIELDS = [
  "journalEntries",
  "journalPhotos",
  "journalAudio",
  "journalSpaces",
  "journalSpaceCaptures",
] as const;
type JournalBackupField = (typeof PROTECTION_JOURNAL_BACKUP_FIELDS)[number];
type JournalBackupCollections = Record<JournalBackupField, Array<Record<string, unknown>>>;
const REMOTE_VERIFICATION_PAGE_SIZE = 500;
const MAX_JOURNAL_REMOVAL_EVENT_RECEIPTS = 20_001;

export interface JournalRemovalRemoteInput {
  expectedOwnerUserId: string;
  operationRevision: string;
  signal?: AbortSignal;
  localCommitInventory?: JournalLocalCommitInventory;
}

export interface JournalRemovalFenceInput extends JournalRemovalRemoteInput {
  expectedVaultRevision: number;
}

interface JournalRemovalInventoryRow {
  id: string;
  parentId?: string;
  rowSha256: string;
  backupSha256: string;
  postimageBackupSha256: string;
}

interface JournalRemovalInventoryBackupItem {
  id: string;
  backupSha256: string;
  postimageBackupSha256: string;
}

export interface JournalPasswordRemovalInventory {
  version: 1;
  entries: JournalRemovalInventoryRow[];
  photos: JournalRemovalInventoryRow[];
  audios: JournalRemovalInventoryRow[];
  spaces: JournalRemovalInventoryBackupItem[];
  captures: JournalRemovalInventoryBackupItem[];
  storageObjects: Array<{
    bucket: "journal-photos" | "journal-audio";
    path: string;
    objectId: string;
    version: string;
    etag: string | null;
    size: number | null;
  }>;
}

export interface JournalRemovalBeginInput extends JournalRemovalFenceInput {
  inventory: JournalPasswordRemovalInventory;
}

export interface JournalRemovalOrphanRecoveryInput {
  expectedOwnerUserId: string;
  signal?: AbortSignal;
}

export type RemoteJournalPasswordRemovalRecovery =
  | { status: "not-pending" }
  | {
      status: "abortable" | "manual-recovery-required" | "complete";
      operationRevision: string;
      vaultRevision: number;
    };

export type RemoteJournalPasswordRemovalStart =
  | "ready"
  | "complete"
  | "fresh-auth-required"
  | "fresh-auth-required-no-fence"
  | "fresh-auth-required-existing-fence";
export type RemoteJournalPasswordRemovalAbort = "aborted" | "mutation-started" | "stale";

export class RemoteProtectedJournalDataError extends Error {
  readonly retryable = true;

  constructor() {
    super("Remote journal still contains protected objects");
    this.name = "RemoteProtectedJournalDataError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/;
const JOURNAL_REMOVAL_EVENT_RECEIPT_KEYS = [
  "deviceId",
  "entityId",
  "entityType",
  "idempotencyKey",
  "op",
  "payload",
  "payloadSha256",
] as const;

async function journalRemovalReceiptSha256(value: unknown): Promise<string> {
  try {
    return await journalInventorySha256(value);
  } catch {
    throw new RequiredRemoteCommitError("stale");
  }
}

async function parseJournalRemovalEventReceipt(
  value: unknown,
  operationRevision: string,
  expectedVaultRevision: number,
  position: number
): Promise<SyncEventWriteIntent & { idempotencyKey: string }> {
  const receipt = asRecord(value);
  if (
    !receipt ||
    Object.keys(receipt).sort().join("\n") !==
      [...JOURNAL_REMOVAL_EVENT_RECEIPT_KEYS].sort().join("\n") ||
    (receipt.entityType !== "journal" && receipt.entityType !== "setting") ||
    typeof receipt.entityId !== "string" ||
    receipt.entityId.length === 0 ||
    (receipt.op !== "upsert" && receipt.op !== "delete") ||
    receipt.deviceId !== "server:journal-password-removal" ||
    typeof receipt.idempotencyKey !== "string" ||
    !UUID_RE.test(receipt.idempotencyKey) ||
    typeof receipt.payloadSha256 !== "string" ||
    !SHA256_RE.test(receipt.payloadSha256)
  ) {
    throw new RequiredRemoteCommitError("stale");
  }
  const payload = asRecord(receipt.payload);
  if (
    !payload ||
    payload.removalOperationRevision !== operationRevision ||
    (await journalRemovalReceiptSha256(payload)) !== receipt.payloadSha256
  ) {
    throw new RequiredRemoteCommitError("stale");
  }

  const payloadKeys = Object.keys(payload).sort().join("\n");
  if (position === 0) {
    if (
      receipt.entityType !== "setting" ||
      receipt.entityId !== SK.JOURNAL_VAULT_KEY ||
      receipt.op !== "delete" ||
      payloadKeys !==
        ["key", "operationRevision", "removalOperationRevision", "vaultRevision"]
          .sort()
          .join("\n") ||
      payload.key !== SK.JOURNAL_VAULT_KEY ||
      payload.operationRevision !== operationRevision ||
      payload.vaultRevision !== expectedVaultRevision
    ) {
      throw new RequiredRemoteCommitError("stale");
    }
  } else if (
    receipt.entityType !== "journal" ||
    (receipt.op === "upsert"
      ? payloadKeys !==
          ["journalRemovalRefetch", "removalOperationRevision", "vaultRevision"]
            .sort()
            .join("\n") ||
        payload.journalRemovalRefetch !== true ||
        payload.vaultRevision !== expectedVaultRevision
      : payloadKeys !== "removalOperationRevision")
  ) {
    throw new RequiredRemoteCommitError("stale");
  }

  return {
    entityType: receipt.entityType,
    entityId: receipt.entityId,
    op: receipt.op,
    payload,
    deviceId: receipt.deviceId,
    idempotencyKey: receipt.idempotencyKey,
  };
}

async function persistJournalRemovalEventManifest(
  input: JournalRemovalRemoteInput & { expectedVaultRevision: number },
  value: unknown,
  requireCurrentOperation: boolean
): Promise<void> {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_JOURNAL_REMOVAL_EVENT_RECEIPTS
  ) {
    throw new RequiredRemoteCommitError("stale");
  }
  await validateSyncOwner(
    input.expectedOwnerUserId,
    "Diary removal event manifest owner check"
  );
  if (requireCurrentOperation) await assertRemovalOperationCurrent(input);

  const intents = await Promise.all(
    value.map((receipt, position) =>
      parseJournalRemovalEventReceipt(
        receipt,
        input.operationRevision,
        input.expectedVaultRevision,
        position
      )
    )
  );
  const idempotencyKeys = new Set<string>();
  const journalEntityIds = new Set<string>();
  for (const intent of intents) {
    if (idempotencyKeys.has(intent.idempotencyKey)) {
      throw new RequiredRemoteCommitError("stale");
    }
    idempotencyKeys.add(intent.idempotencyKey);
    if (intent.entityType === "journal") {
      if (journalEntityIds.has(intent.entityId)) {
        throw new RequiredRemoteCommitError("stale");
      }
      journalEntityIds.add(intent.entityId);
    }
  }

  for (const intent of intents) {
    throwIfAborted(input.signal);
    await validateSyncOwner(
      input.expectedOwnerUserId,
      "Diary removal event manifest write"
    );
    if (requireCurrentOperation) await assertRemovalOperationCurrent(input);
    await writeExactEventAndBroadcast(intent, input.expectedOwnerUserId);
  }

  await validateSyncOwner(
    input.expectedOwnerUserId,
    "Diary removal event manifest acknowledgement"
  );
  if (requireCurrentOperation) await assertRemovalOperationCurrent(input);

  const client = supabase;
  if (!client) throw new RequiredRemoteCommitError("no-op");
  const request = client.rpc("acknowledge_journal_password_removal_events", {
    p_expected_vault_revision: input.expectedVaultRevision,
    p_operation_revision: input.operationRevision,
  });
  const { data, error } = input.signal ? await request.abortSignal(input.signal) : await request;
  throwIfAborted(input.signal);
  if (error) throw error;
  if (data !== "acknowledged") throw new RequiredRemoteCommitError("stale");
  await validateSyncOwner(
    input.expectedOwnerUserId,
    "Diary removal event manifest server acknowledgement"
  );
  if (requireCurrentOperation) await assertRemovalOperationCurrent(input);
}

function removalRevision(value: unknown): string | null {
  const intent = asRecord(value);
  if (!intent || (intent.version !== 1 && intent.version !== 2)) return null;
  const revision = intent.operationRevision ?? intent.revision;
  return typeof revision === "string" && revision.length > 0 ? revision : null;
}

async function assertRemovalOperationCurrent(input: JournalRemovalRemoteInput): Promise<void> {
  const [ownerUserId, intentRecord] = await Promise.all([
    getLocalDataOwnerId(),
    db.settings.get(SK.JOURNAL_SECURITY_REMOVAL),
  ]);
  if (
    ownerUserId !== input.expectedOwnerUserId ||
    removalRevision(intentRecord?.value) !== input.operationRevision
  ) {
    throw new RequiredRemoteCommitError("stale");
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new RequiredRemoteCommitError("aborted");
}

function assertFenceInput(input: JournalRemovalFenceInput): void {
  if (
    !input.expectedOwnerUserId ||
    !input.operationRevision ||
    !Number.isSafeInteger(input.expectedVaultRevision) ||
    input.expectedVaultRevision < 0
  ) {
    throw new RequiredRemoteCommitError("stale");
  }
}

async function callJournalRemovalRpc(
  functionName: "begin_journal_password_removal" | "finalize_journal_password_removal",
  input: JournalRemovalFenceInput | JournalRemovalBeginInput
): Promise<unknown> {
  assertFenceInput(input);
  throwIfAborted(input.signal);
  const client = supabase;
  if (!client) throw new RequiredRemoteCommitError("no-op");
  const ownerUserId = await validateSyncOwner(
    input.expectedOwnerUserId,
    functionName === "begin_journal_password_removal"
      ? "Diary removal server fence"
      : "Diary removal atomic finalization"
  );
  if (!ownerUserId) throw new RequiredRemoteCommitError("no-op");
  await assertRemovalOperationCurrent(input);

  const request =
    functionName === "begin_journal_password_removal"
      ? client.rpc(functionName, {
          p_expected_vault_revision: input.expectedVaultRevision,
          p_operation_revision: input.operationRevision,
          p_inventory: (input as JournalRemovalBeginInput).inventory as unknown as Json,
        })
      : client.rpc(functionName, {
          p_expected_vault_revision: input.expectedVaultRevision,
          p_operation_revision: input.operationRevision,
        });
  const { data, error } = input.signal ? await request.abortSignal(input.signal) : await request;
  throwIfAborted(input.signal);
  if (error) throw error;

  await validateSyncOwner(ownerUserId, "Diary removal server acknowledgement");
  await assertRemovalOperationCurrent(input);
  return data;
}

export async function beginRemoteJournalPasswordRemoval(
  input: JournalRemovalBeginInput
): Promise<RemoteJournalPasswordRemovalStart> {
  const status = await callJournalRemovalRpc("begin_journal_password_removal", input);
  if (
    status === "ready" ||
    status === "complete" ||
    status === "fresh-auth-required" ||
    status === "fresh-auth-required-no-fence" ||
    status === "fresh-auth-required-existing-fence"
  ) {
    return status;
  }
  throw new RequiredRemoteCommitError("stale");
}

type JournalRemovalOperationMutationInput = JournalRemovalFenceInput;

async function prepareJournalRemovalMutation(
  input: JournalRemovalOperationMutationInput,
  operation: string
): Promise<NonNullable<typeof supabase>> {
  assertFenceInput(input);
  throwIfAborted(input.signal);
  const client = supabase;
  if (!client) throw new RequiredRemoteCommitError("no-op");
  const ownerUserId = await validateSyncOwner(input.expectedOwnerUserId, operation);
  if (!ownerUserId) throw new RequiredRemoteCommitError("no-op");
  await assertRemovalOperationCurrent(input);
  return client;
}

async function acknowledgeJournalRemovalMutation(
  input: JournalRemovalOperationMutationInput,
  resultValue: unknown,
  error: unknown,
  operation: string
): Promise<RequiredRemoteCommitResult> {
  throwIfAborted(input.signal);
  if (error) {
    const remoteError = new Error("Diary removal remote mutation failed");
    Object.defineProperty(remoteError, "cause", { value: error });
    throw remoteError;
  }
  const result = asRecord(resultValue);
  if (
    result?.status !== "committed" ||
    Object.keys(result).sort().join("\n") !== "status"
  ) {
    throw new RequiredRemoteCommitError("stale");
  }
  await validateSyncOwner(input.expectedOwnerUserId, operation);
  await assertRemovalOperationCurrent(input);
  await validateSyncOwner(input.expectedOwnerUserId, operation);
  await assertRemovalOperationCurrent(input);
  return REQUIRED_REMOTE_COMMIT_RESULT;
}

function journalEntryRemovalCloudPayload(
  entry: JournalEntry,
  ownerUserId: string
): Json {
  return {
    id: entry.id,
    user_id: ownerUserId,
    date: entry.date,
    title: entry.title,
    content: entry.content,
    stickers: entry.stickers,
    mood: entry.mood || null,
    tags: entry.tags,
    template_id: entry.templateId || null,
    habit_snapshot: (entry.habitSnapshot ?? null) as Json,
    photo_ids: entry.photoIds,
    audio_ids: entry.audioIds || [],
    photo_layout: (entry.photoLayout ?? null) as Json,
    ...journalStyleFieldsToCloud(entry),
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    vault_revision: null,
  };
}

export async function commitRemoteJournalPasswordRemovalEntry(
  input: JournalRemovalFenceInput & { entry: JournalEntry }
): Promise<RequiredRemoteCommitResult> {
  const client = await prepareJournalRemovalMutation(
    input,
    "Diary removal entry conversion"
  );
  const request = client.rpc("commit_journal_password_removal_entry", {
    p_expected_vault_revision: input.expectedVaultRevision,
    p_operation_revision: input.operationRevision,
    p_entry: journalEntryRemovalCloudPayload(input.entry, input.expectedOwnerUserId),
  });
  const { data, error } = input.signal ? await request.abortSignal(input.signal) : await request;
  return acknowledgeJournalRemovalMutation(
    input,
    data,
    error,
    "Diary removal entry acknowledgement"
  );
}

export async function commitRemoteJournalPasswordRemovalPhoto(
  input: JournalRemovalFenceInput & { photo: JournalPhoto }
): Promise<RequiredRemoteCommitResult> {
  const client = await prepareJournalRemovalMutation(
    input,
    "Diary removal photo conversion"
  );
  const request = client.rpc("commit_journal_password_removal_photo", {
    p_expected_vault_revision: input.expectedVaultRevision,
    p_operation_revision: input.operationRevision,
    p_photo: {
      id: input.photo.id,
      user_id: input.expectedOwnerUserId,
      entry_id: input.photo.entryId,
      width: input.photo.width,
      height: input.photo.height,
      storage_path: input.photo.storagePath ?? null,
      storage_url: null,
      created_at: input.photo.createdAt,
      vault_revision: null,
    },
  });
  const { data, error } = input.signal ? await request.abortSignal(input.signal) : await request;
  return acknowledgeJournalRemovalMutation(
    input,
    data,
    error,
    "Diary removal photo acknowledgement"
  );
}

export async function commitRemoteJournalPasswordRemovalAudio(
  input: JournalRemovalFenceInput & { audio: JournalAudio; parentEntry: JournalEntry }
): Promise<RequiredRemoteCommitResult> {
  const client = await prepareJournalRemovalMutation(
    input,
    "Diary removal audio conversion"
  );
  const request = client.rpc("commit_journal_password_removal_audio", {
    p_expected_vault_revision: input.expectedVaultRevision,
    p_operation_revision: input.operationRevision,
    p_audio: {
      id: input.audio.id,
      user_id: input.expectedOwnerUserId,
      entry_id: input.audio.entryId,
      duration: input.audio.duration,
      mime_type: input.audio.mimeType,
      storage_path: input.audio.storagePath ?? null,
      storage_url: null,
      created_at: input.audio.createdAt,
      vault_revision: null,
    },
  });
  const { data, error } = input.signal ? await request.abortSignal(input.signal) : await request;
  return acknowledgeJournalRemovalMutation(
    input,
    data,
    error,
    "Diary removal audio acknowledgement"
  );
}

export async function deleteRemoteJournalPasswordRemovalArtifact(
  input: JournalRemovalFenceInput & {
    surface: "entry" | "photo" | "audio";
    entityId: string;
    parentEntry?: JournalEntry;
  }
): Promise<RequiredRemoteCommitResult> {
  const client = await prepareJournalRemovalMutation(input, "Diary removal deletion");
  const request = client.rpc("delete_journal_password_removal_artifact", {
    p_expected_vault_revision: input.expectedVaultRevision,
    p_operation_revision: input.operationRevision,
    p_surface: input.surface,
    p_entity_id: input.entityId,
    p_parent_entry: input.parentEntry
      ? journalEntryRemovalCloudPayload(input.parentEntry, input.expectedOwnerUserId)
      : null,
  });
  const { data, error } = input.signal ? await request.abortSignal(input.signal) : await request;
  return acknowledgeJournalRemovalMutation(
    input,
    data,
    error,
    "Diary removal deletion acknowledgement"
  );
}

export async function reserveRemoteJournalPasswordRemovalMedia(
  input: JournalRemovalFenceInput & {
    bucket: "journal-photos" | "journal-audio";
    entityId: string;
    storagePath: string;
    contentSha256: string;
    contentSize: number;
    mimeType: string;
  }
): Promise<RequiredRemoteCommitResult> {
  if (
    !input.storagePath.startsWith(
      `${input.expectedOwnerUserId}/removal/${input.operationRevision}/`
    ) ||
    input.storagePath.includes("..") ||
    input.storagePath.includes("\0") ||
    !SHA256_RE.test(input.contentSha256) ||
    !Number.isSafeInteger(input.contentSize) ||
    input.contentSize <= 0 ||
    (input.bucket === "journal-photos"
      ? !["image/jpeg", "image/png", "image/webp"].includes(input.mimeType)
      : !["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav"].includes(
          input.mimeType
        ))
  ) {
    throw new RequiredRemoteCommitError("stale");
  }
  const client = await prepareJournalRemovalMutation(
    input,
    "Diary removal media reservation"
  );
  const request = client.rpc("reserve_journal_password_removal_media", {
    p_expected_vault_revision: input.expectedVaultRevision,
    p_operation_revision: input.operationRevision,
    p_bucket_id: input.bucket,
    p_entity_id: input.entityId,
    p_storage_path: input.storagePath,
    p_content_sha256: input.contentSha256,
    p_content_size: input.contentSize,
    p_mime_type: input.mimeType,
  });
  const { data, error } = input.signal ? await request.abortSignal(input.signal) : await request;
  throwIfAborted(input.signal);
  if (error) throw error;
  if (data !== "reserved") throw new RequiredRemoteCommitError("stale");
  await validateSyncOwner(
    input.expectedOwnerUserId,
    "Diary removal media reservation acknowledgement"
  );
  await assertRemovalOperationCurrent(input);
  return REQUIRED_REMOTE_COMMIT_RESULT;
}

export async function abortRemoteJournalPasswordRemoval(
  input: JournalRemovalFenceInput
): Promise<RemoteJournalPasswordRemovalAbort> {
  assertFenceInput(input);
  throwIfAborted(input.signal);
  const client = supabase;
  if (!client) throw new RequiredRemoteCommitError("no-op");
  const ownerUserId = await validateSyncOwner(
    input.expectedOwnerUserId,
    "Diary removal fence abort"
  );
  if (!ownerUserId) throw new RequiredRemoteCommitError("no-op");
  await assertRemovalOperationCurrent(input);
  const request = client.rpc("abort_journal_password_removal", {
    p_expected_vault_revision: input.expectedVaultRevision,
    p_operation_revision: input.operationRevision,
  });
  const { data, error } = input.signal ? await request.abortSignal(input.signal) : await request;
  throwIfAborted(input.signal);
  if (error) throw error;
  if (data !== "aborted" && data !== "mutation-started" && data !== "stale") {
    throw new RequiredRemoteCommitError("stale");
  }
  await validateSyncOwner(ownerUserId, "Diary removal fence abort acknowledgement");
  await assertRemovalOperationCurrent(input);
  return data;
}

export async function finalizeRemoteJournalPasswordRemoval(
  input: JournalRemovalFenceInput
): Promise<RequiredRemoteCommitResult> {
  const result = asRecord(
    await callJournalRemovalRpc("finalize_journal_password_removal", input)
  );
  if (result?.status === "complete") {
    await persistJournalRemovalEventManifest(input, result.eventReceipts, true);
    await assertRemovalOperationCurrent(input);
    return REQUIRED_REMOTE_COMMIT_RESULT;
  }
  if (
    result?.status === "protected-data" ||
    result?.status === "media-pending" ||
    result?.status === "media-orphan"
  ) {
    throw new RemoteProtectedJournalDataError();
  }
  throw new RequiredRemoteCommitError("stale");
}

export async function recoverRemoteJournalPasswordRemoval(
  input: JournalRemovalOrphanRecoveryInput
): Promise<RemoteJournalPasswordRemovalRecovery> {
  if (!input.expectedOwnerUserId) throw new RequiredRemoteCommitError("stale");
  throwIfAborted(input.signal);
  const client = supabase;
  if (!client) throw new RequiredRemoteCommitError("no-op");
  const ownerUserId = await validateSyncOwner(
    input.expectedOwnerUserId,
    "Diary removal orphan recovery"
  );
  if (!ownerUserId || (await getLocalDataOwnerId()) !== ownerUserId) {
    throw new RequiredRemoteCommitError("stale");
  }

  const request = client.rpc("recover_journal_password_removal");
  const { data, error } = input.signal ? await request.abortSignal(input.signal) : await request;
  throwIfAborted(input.signal);
  if (error) throw error;
  await validateSyncOwner(ownerUserId, "Diary removal orphan recovery acknowledgement");
  if ((await getLocalDataOwnerId()) !== ownerUserId) {
    throw new RequiredRemoteCommitError("stale");
  }

  const result = asRecord(data);
  const status = result?.status;
  if (status === "not-pending") return { status };
  const operationRevision = result?.operationRevision;
  const vaultRevision = Number(result?.vaultRevision);
  if (
    (status === "abortable" ||
      status === "manual-recovery-required" ||
      status === "complete") &&
    typeof operationRevision === "string" &&
    /^[0-9]+:[a-z0-9]+$/.test(operationRevision) &&
    Number.isSafeInteger(vaultRevision) &&
    vaultRevision >= 0
  ) {
    if (status === "complete") {
      await persistJournalRemovalEventManifest(
        {
          expectedOwnerUserId: ownerUserId,
          operationRevision,
          expectedVaultRevision: vaultRevision,
          signal: input.signal,
        },
        result?.eventReceipts,
        false
      );
      await validateSyncOwner(
        ownerUserId,
        "Diary removal recovery event acknowledgement"
      );
      if ((await getLocalDataOwnerId()) !== ownerUserId) {
        throw new RequiredRemoteCommitError("stale");
      }
    } else if (result?.eventReceipts !== undefined) {
      throw new RequiredRemoteCommitError("stale");
    }
    return { status, operationRevision, vaultRevision };
  }
  throw new RequiredRemoteCommitError("stale");
}

function containsProtectedJournalValue(value: unknown): boolean {
  if (typeof value === "string") {
    return isEncryptedJournalContent(value) || isEncryptedJournalMediaData(value);
  }
  if (Array.isArray(value)) return value.some(containsProtectedJournalValue);
  const record = asRecord(value);
  return record ? Object.values(record).some(containsProtectedJournalValue) : false;
}

async function remoteRowsContainProtectedValue<Row>(
  input: JournalRemovalRemoteInput,
  ownerUserId: string,
  operation: string,
  loadPage: (
    from: number,
    to: number,
    signal: AbortSignal | undefined
  ) => Promise<{ data: Row[] | null; error: unknown }>,
  isProtected: (row: Row) => boolean
): Promise<boolean> {
  let from = 0;
  while (true) {
    throwIfAborted(input.signal);
    await validateSyncOwner(ownerUserId, operation);
    await assertRemovalOperationCurrent(input);
    const result = await loadPage(from, from + REMOTE_VERIFICATION_PAGE_SIZE - 1, input.signal);
    throwIfAborted(input.signal);
    if (result.error) {
      throw result.error instanceof Error
        ? result.error
        : new Error("Remote diary verification read failed");
    }
    const rows = result.data ?? [];
    if (rows.some(isProtected)) return true;
    if (rows.length < REMOTE_VERIFICATION_PAGE_SIZE) return false;
    if (from > Number.MAX_SAFE_INTEGER - REMOTE_VERIFICATION_PAGE_SIZE) {
      throw new RequiredRemoteCommitError("stale");
    }
    from += REMOTE_VERIFICATION_PAGE_SIZE;
  }
}

function journalBackupCollection(value: unknown): Array<Record<string, unknown>> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new RequiredRemoteCommitError("stale");
  const items: Array<Record<string, unknown>> = [];
  const ids = new Set<string>();
  for (const valueItem of value) {
    const item = asRecord(valueItem);
    const id = item?.id;
    if (!item || typeof id !== "string" || id.length === 0 || ids.has(id)) {
      throw new RequiredRemoteCommitError("stale");
    }
    ids.add(id);
    items.push(item);
  }
  return items;
}

function mergeJournalBackupCollection(
  remoteValue: unknown,
  localValue: unknown,
  expectedIds: ReadonlySet<string>,
  deletedIds: ReadonlySet<string>
): Array<Record<string, unknown>> {
  const remoteItems = journalBackupCollection(remoteValue);
  const localItems = journalBackupCollection(localValue);
  const localById = new Map(localItems.map((item) => [item.id as string, item]));
  const merged = remoteItems.map((remoteItem) => {
    const localItem = localById.get(remoteItem.id as string);
    if (localItem) return localItem;
    if (deletedIds.has(remoteItem.id as string)) return null;
    // A remote-only item is ambiguous without a collection-specific deletion
    // receipt. Preserving it can resurrect an intentional local deletion;
    // dropping it can destroy backup-only data. Fail closed and keep the
    // operation pending until an explicit recovery path resolves membership.
    throw new RequiredRemoteCommitError("stale");
  }).filter((item): item is Record<string, unknown> => item !== null);
  const remoteIds = new Set(remoteItems.map((item) => item.id as string));
  for (const localItem of localItems) {
    if (!remoteIds.has(localItem.id as string)) merged.push(localItem);
  }
  return merged;
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateLocalJournalBackupItem(
  field: (typeof PROTECTION_JOURNAL_BACKUP_FIELDS)[number],
  item: Record<string, unknown>
): void {
  const optionalString = (value: unknown): boolean =>
    value === undefined || value === null || typeof value === "string";
  const optionalFiniteNumber = (value: unknown): boolean =>
    value === undefined || (typeof value === "number" && Number.isFinite(value));
  let valid = false;
  if (field === "journalEntries") {
    valid =
      typeof item.content === "string" &&
      optionalString(item.date) &&
      optionalString(item.title) &&
      (item.photoIds === undefined || isStringArray(item.photoIds)) &&
      (item.audioIds === undefined || isStringArray(item.audioIds)) &&
      optionalFiniteNumber(item.createdAt) &&
      optionalFiniteNumber(item.updatedAt);
  } else if (field === "journalPhotos") {
    valid =
      typeof item.entryId === "string" &&
      optionalString(item.data) &&
      optionalString(item.thumbnail) &&
      optionalString(item.storagePath) &&
      optionalFiniteNumber(item.width) &&
      optionalFiniteNumber(item.height) &&
      optionalFiniteNumber(item.createdAt);
  } else if (field === "journalAudio") {
    valid =
      typeof item.entryId === "string" &&
      optionalString(item.data) &&
      optionalString(item.storagePath) &&
      optionalString(item.mimeType) &&
      optionalFiniteNumber(item.duration) &&
      optionalFiniteNumber(item.createdAt);
  } else if (field === "journalSpaces") {
    valid =
      optionalString(item.name) &&
      optionalString(item.description) &&
      optionalFiniteNumber(item.createdAt) &&
      optionalFiniteNumber(item.updatedAt);
  } else {
    valid =
      typeof item.spaceId === "string" &&
      optionalString(item.spaceName) &&
      optionalString(item.title) &&
      optionalString(item.entryId) &&
      Array.isArray(item.fields) &&
      item.fields.every((fieldValue) => {
        const captureField = asRecord(fieldValue);
        return (
          captureField !== null &&
          typeof captureField.prompt === "string" &&
          typeof captureField.value === "string"
        );
      });
  }
  if (!valid || containsProtectedJournalValue(item) || item.vaultRevision != null) {
    throw new RequiredRemoteCommitError("stale");
  }
}

async function validateLocalJournalBackup(
  localBackup: JournalBackupCollections,
  inventory: JournalLocalCommitInventory
): Promise<JournalBackupCollections> {
  if (!inventory.postimages) {
    throw new RequiredRemoteCommitError("stale");
  }
  const expectedIdsByField: Record<(typeof PROTECTION_JOURNAL_BACKUP_FIELDS)[number], string[]> = {
    journalEntries: inventory.entryIds,
    journalPhotos: inventory.photoIds,
    journalAudio: inventory.audioIds,
    journalSpaces: inventory.spaceIds,
    journalSpaceCaptures: inventory.captureIds,
  };
  const postimagesByField = {
    journalEntries: inventory.postimages.entries,
    journalPhotos: inventory.postimages.photos,
    journalAudio: inventory.postimages.audios,
    journalSpaces: inventory.postimages.spaces,
    journalSpaceCaptures: inventory.postimages.captures,
  } satisfies Record<
    (typeof PROTECTION_JOURNAL_BACKUP_FIELDS)[number],
    JournalLocalCommitPostimageReceipt[]
  >;
  const collectionEntries = await Promise.all(
    PROTECTION_JOURNAL_BACKUP_FIELDS.map(async (field) => {
      const items = journalBackupCollection(localBackup[field]);
      items.forEach((item) => validateLocalJournalBackupItem(field, item));
      const itemById = new Map(items.map((item) => [item.id as string, item]));
      const ids = new Set(itemById.keys());
      if (
        items.length !== expectedIdsByField[field].length ||
        expectedIdsByField[field].some((id) => !ids.has(id))
      ) {
        throw new RequiredRemoteCommitError("stale");
      }
      const receipts = postimagesByField[field];
      const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]));
      if (
        receipts.length !== expectedIdsByField[field].length ||
        expectedIdsByField[field].some((id) => !receiptById.has(id))
      ) {
        throw new RequiredRemoteCommitError("stale");
      }
      for (const id of expectedIdsByField[field]) {
        const item = itemById.get(id);
        const receipt = receiptById.get(id);
        if (
          !item ||
          !receipt ||
          (await journalRemovalReceiptSha256(item)) !== receipt.postimageBackupSha256
        ) {
          throw new RequiredRemoteCommitError("stale");
        }
      }
      return [field, items];
    })
  );
  const collections = Object.fromEntries(collectionEntries) as Record<
    (typeof PROTECTION_JOURNAL_BACKUP_FIELDS)[number],
    Array<Record<string, unknown>>
  >;

  const entryIds = new Set(collections.journalEntries.map((item) => item.id as string));
  const spaceIds = new Set(collections.journalSpaces.map((item) => item.id as string));
  if (
    collections.journalPhotos.some((item) => !entryIds.has(item.entryId as string)) ||
    collections.journalAudio.some((item) => !entryIds.has(item.entryId as string)) ||
    collections.journalSpaceCaptures.some(
      (item) =>
        !spaceIds.has(item.spaceId as string) ||
        (typeof item.entryId === "string" && !entryIds.has(item.entryId))
    )
  ) {
    throw new RequiredRemoteCommitError("stale");
  }
  return collections;
}

async function readLocalJournalBackupForRemoval(): Promise<JournalBackupCollections> {
  return db.transaction(
    "r",
    [
      db.journalEntries,
      db.journalPhotos,
      db.journalAudio,
      db.journalSpaces,
      db.journalSpaceCaptures,
    ],
    async () => {
      const [journalEntries, journalPhotos, journalAudio, journalSpaces, journalSpaceCaptures] =
        await Promise.all([
          db.journalEntries.toArray(),
          db.journalPhotos.toArray(),
          db.journalAudio.toArray(),
          db.journalSpaces.toArray(),
          db.journalSpaceCaptures.toArray(),
        ]);
      return {
        journalEntries: journalEntries as unknown as Array<Record<string, unknown>>,
        journalPhotos: journalPhotos as unknown as Array<Record<string, unknown>>,
        journalAudio: journalAudio as unknown as Array<Record<string, unknown>>,
        journalSpaces: journalSpaces as unknown as Array<Record<string, unknown>>,
        journalSpaceCaptures: journalSpaceCaptures as unknown as Array<Record<string, unknown>>,
      };
    }
  );
}

async function patchRemoteBackup(
  remotePayload: unknown,
  localBackup: JournalBackupCollections,
  inventory: JournalLocalCommitInventory
): Promise<JournalBackupCollections> {
  const localCollections = await validateLocalJournalBackup(localBackup, inventory);
  if (remotePayload === null || remotePayload === undefined) return localCollections;
  const remote = asRecord(remotePayload);
  const remoteData = asRecord(remote?.data);
  if (!remote || !remoteData || remote.schemaVersion !== 3) {
    throw new RequiredRemoteCommitError("stale");
  }

  const expectedIdsByField: Record<
    (typeof PROTECTION_JOURNAL_BACKUP_FIELDS)[number],
    Set<string>
  > = {
    journalEntries: new Set(inventory.entryIds),
    journalPhotos: new Set(inventory.photoIds),
    journalAudio: new Set(inventory.audioIds),
    journalSpaces: new Set(inventory.spaceIds),
    journalSpaceCaptures: new Set(inventory.captureIds),
  };
  const deletedIdsByField: Record<
    (typeof PROTECTION_JOURNAL_BACKUP_FIELDS)[number],
    Set<string>
  > = {
    journalEntries: new Set(inventory.deletedEntryIds ?? []),
    journalPhotos: new Set(inventory.deletedPhotoIds ?? []),
    journalAudio: new Set(inventory.deletedAudioIds ?? []),
    journalSpaces: new Set(),
    journalSpaceCaptures: new Set(),
  };
  return Object.fromEntries(
    PROTECTION_JOURNAL_BACKUP_FIELDS.map((field) => [
      field,
      mergeJournalBackupCollection(
        remoteData[field],
        localCollections[field],
        expectedIdsByField[field],
        deletedIdsByField[field]
      ),
    ])
  ) as JournalBackupCollections;
}

export async function patchJournalBackupForPasswordRemoval(
  input: JournalRemovalFenceInput
): Promise<RequiredRemoteCommitResult> {
  assertFenceInput(input);
  throwIfAborted(input.signal);
  const client = supabase;
  if (!client) throw new RequiredRemoteCommitError("no-op");
  const ownerUserId = await validateSyncOwner(
    input.expectedOwnerUserId,
    "Diary removal backup patch"
  );
  if (!ownerUserId) throw new RequiredRemoteCommitError("no-op");
  await assertRemovalOperationCurrent(input);
  if (!input.localCommitInventory) {
    throw new RequiredRemoteCommitError("stale");
  }
  const localBackup = await readLocalJournalBackupForRemoval();
  throwIfAborted(input.signal);
  await assertRemovalOperationCurrent(input);

  const fetchRequest = client
    .from("user_backups")
    .select("payload, vault_revision")
    .eq("user_id", ownerUserId);
  const { data: remote, error: fetchError } = input.signal
    ? await fetchRequest.abortSignal(input.signal).maybeSingle()
    : await fetchRequest.maybeSingle();
  if (fetchError) throw fetchError;
  const journalPatch = await patchRemoteBackup(
    remote?.payload,
    localBackup,
    input.localCommitInventory
  );

  throwIfAborted(input.signal);
  await validateSyncOwner(ownerUserId, "Diary removal backup commit");
  await assertRemovalOperationCurrent(input);
  const mutation = client.rpc("commit_journal_password_removal_backup", {
    p_expected_vault_revision: input.expectedVaultRevision,
    p_operation_revision: input.operationRevision,
    p_journal_patch: journalPatch as unknown as Json,
    p_deleted_inventory: {
      entryIds: input.localCommitInventory.deletedEntryIds ?? [],
      photoIds: input.localCommitInventory.deletedPhotoIds ?? [],
      audioIds: input.localCommitInventory.deletedAudioIds ?? [],
    },
  });
  const { data: committed, error: mutationError } = input.signal
    ? await mutation.abortSignal(input.signal)
    : await mutation;
  return acknowledgeJournalRemovalMutation(
    input,
    committed,
    mutationError,
    "Diary removal backup acknowledgement"
  );
}

export async function verifyRemoteJournalIsUnprotected(
  input: JournalRemovalRemoteInput
): Promise<RequiredRemoteCommitResult> {
  throwIfAborted(input.signal);
  const client = supabase;
  if (!client) throw new RequiredRemoteCommitError("no-op");
  const ownerUserId = await validateSyncOwner(
    input.expectedOwnerUserId,
    "Diary removal remote verification"
  );
  if (!ownerUserId) throw new RequiredRemoteCommitError("no-op");
  await assertRemovalOperationCurrent(input);

  const entriesProtected = await remoteRowsContainProtectedValue<{ content: string }>(
    input,
    ownerUserId,
    "Diary removal entry verification",
    async (from, to, signal) => {
      const query = client
        .from("journal_entries")
        .select("content")
        .eq("user_id", ownerUserId)
        .range(from, to);
      return signal ? await query.abortSignal(signal) : await query;
    },
    ({ content }) => isEncryptedJournalContent(content)
  );
  if (entriesProtected) throw new RemoteProtectedJournalDataError();

  const photosProtected = await remoteRowsContainProtectedValue<{
    storage_path: string | null;
  }>(
    input,
    ownerUserId,
    "Diary removal photo verification",
    async (from, to, signal) => {
      const query = client
        .from("journal_photos")
        .select("storage_path")
        .eq("user_id", ownerUserId)
        .range(from, to);
      return signal ? await query.abortSignal(signal) : await query;
    },
    ({ storage_path }) => storage_path?.endsWith(".bin") === true
  );
  if (photosProtected) throw new RemoteProtectedJournalDataError();

  const audioProtected = await remoteRowsContainProtectedValue<{
    storage_path: string | null;
  }>(
    input,
    ownerUserId,
    "Diary removal audio verification",
    async (from, to, signal) => {
      const query = client
        .from("journal_audio")
        .select("storage_path")
        .eq("user_id", ownerUserId)
        .range(from, to);
      return signal ? await query.abortSignal(signal) : await query;
    },
    ({ storage_path }) => storage_path?.endsWith(".bin") === true
  );
  if (audioProtected) throw new RemoteProtectedJournalDataError();

  throwIfAborted(input.signal);
  await validateSyncOwner(ownerUserId, "Diary removal backup verification");
  await assertRemovalOperationCurrent(input);
  const backupRequest = client
    .from("user_backups")
    .select("payload, vault_revision")
    .eq("user_id", ownerUserId);
  const backupResult = input.signal
    ? await backupRequest.abortSignal(input.signal).maybeSingle()
    : await backupRequest.maybeSingle();
  throwIfAborted(input.signal);
  if (backupResult.error) throw backupResult.error;
  if (
    backupResult.data?.vault_revision !== null &&
    backupResult.data?.vault_revision !== undefined
  ) {
    throw new RemoteProtectedJournalDataError();
  }
  const backupContainsProtectedObject = containsProtectedJournalValue(
    asRecord(backupResult.data?.payload)?.data
      ? Object.fromEntries(
          PROTECTION_JOURNAL_BACKUP_FIELDS.map((field) => [
            field,
            asRecord(asRecord(backupResult.data?.payload)?.data)?.[field],
          ])
        )
      : null
  );
  if (backupContainsProtectedObject) throw new RemoteProtectedJournalDataError();
  await validateSyncOwner(ownerUserId, "Diary removal remote verification acknowledgement");
  await assertRemovalOperationCurrent(input);
  return REQUIRED_REMOTE_COMMIT_RESULT;
}
