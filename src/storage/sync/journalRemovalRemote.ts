import { isEncryptedJournalContent } from "@/features/journal/journalCrypto";
import { isEncryptedJournalMediaData } from "@/features/journal/journalMediaCrypto";
import { SK } from "@/lib/storageKeys";
import { supabase } from "@/lib/supabaseClient";
import { exportBackup, type BackupPayloadV3 } from "@/storage/backup";
import { db, getLocalDataOwnerId } from "@/storage/db";
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
const REMOTE_VERIFICATION_PAGE_SIZE = 500;

export interface JournalRemovalRemoteInput {
  expectedOwnerUserId: string;
  operationRevision: string;
  signal?: AbortSignal;
}

export interface JournalRemovalFenceInput extends JournalRemovalRemoteInput {
  expectedVaultRevision: number;
}

interface JournalRemovalInventoryRow {
  id: string;
  rowSha256: string;
  backupSha256: string;
}

interface JournalRemovalInventoryBackupItem {
  id: string;
  backupSha256: string;
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
      status: "manual-recovery-required" | "complete";
      operationRevision: string;
      vaultRevision: number;
    };

export type RemoteJournalPasswordRemovalStart = "ready" | "complete";

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
  functionName:
    | "begin_journal_password_removal"
    | "finalize_journal_password_removal",
  input: JournalRemovalFenceInput | JournalRemovalBeginInput,
): Promise<string> {
  assertFenceInput(input);
  throwIfAborted(input.signal);
  const client = supabase;
  if (!client) throw new RequiredRemoteCommitError("no-op");
  const ownerUserId = await validateSyncOwner(
    input.expectedOwnerUserId,
    functionName === "begin_journal_password_removal"
      ? "Diary removal server fence"
      : "Diary removal atomic finalization",
  );
  if (!ownerUserId) throw new RequiredRemoteCommitError("no-op");
  await assertRemovalOperationCurrent(input);

  const request = functionName === "begin_journal_password_removal"
    ? client.rpc(functionName, {
        p_expected_vault_revision: input.expectedVaultRevision,
        p_operation_revision: input.operationRevision,
        p_inventory: (input as JournalRemovalBeginInput).inventory as unknown as Json,
      })
    : client.rpc(functionName, {
        p_expected_vault_revision: input.expectedVaultRevision,
        p_operation_revision: input.operationRevision,
      });
  const { data, error } = input.signal
    ? await request.abortSignal(input.signal)
    : await request;
  throwIfAborted(input.signal);
  if (error) throw error;

  await validateSyncOwner(ownerUserId, "Diary removal server acknowledgement");
  await assertRemovalOperationCurrent(input);
  return typeof data === "string" ? data : "invalid";
}

export async function beginRemoteJournalPasswordRemoval(
  input: JournalRemovalBeginInput,
): Promise<RemoteJournalPasswordRemovalStart> {
  const status = await callJournalRemovalRpc("begin_journal_password_removal", input);
  if (status === "ready" || status === "complete") return status;
  throw new RequiredRemoteCommitError("stale");
}

export async function finalizeRemoteJournalPasswordRemoval(
  input: JournalRemovalFenceInput,
): Promise<RequiredRemoteCommitResult> {
  const status = await callJournalRemovalRpc("finalize_journal_password_removal", input);
  if (status === "complete") return REQUIRED_REMOTE_COMMIT_RESULT;
  if (status === "protected-data") throw new RemoteProtectedJournalDataError();
  throw new RequiredRemoteCommitError("stale");
}

export async function recoverRemoteJournalPasswordRemoval(
  input: JournalRemovalOrphanRecoveryInput,
): Promise<RemoteJournalPasswordRemovalRecovery> {
  if (!input.expectedOwnerUserId) throw new RequiredRemoteCommitError("stale");
  throwIfAborted(input.signal);
  const client = supabase;
  if (!client) throw new RequiredRemoteCommitError("no-op");
  const ownerUserId = await validateSyncOwner(
    input.expectedOwnerUserId,
    "Diary removal orphan recovery",
  );
  if (!ownerUserId || (await getLocalDataOwnerId()) !== ownerUserId) {
    throw new RequiredRemoteCommitError("stale");
  }

  const request = client.rpc("recover_journal_password_removal");
  const { data, error } = input.signal
    ? await request.abortSignal(input.signal)
    : await request;
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
    (status === "manual-recovery-required" || status === "complete") &&
    typeof operationRevision === "string" &&
    /^[0-9]+:[a-z0-9]+$/.test(operationRevision) &&
    Number.isSafeInteger(vaultRevision) &&
    vaultRevision >= 0
  ) {
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
    const result = await loadPage(
      from,
      from + REMOTE_VERIFICATION_PAGE_SIZE - 1,
      input.signal
    );
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

function patchRemoteBackup(
  remotePayload: unknown,
  localBackup: BackupPayloadV3
): BackupPayloadV3 {
  if (remotePayload === null || remotePayload === undefined) return localBackup;
  const remote = asRecord(remotePayload);
  const remoteData = asRecord(remote?.data);
  if (!remote || !remoteData || remote.schemaVersion !== 3) {
    throw new RequiredRemoteCommitError("stale");
  }

  const localData = localBackup.data as Record<string, unknown>;
  const journalPatch = Object.fromEntries(
    PROTECTION_JOURNAL_BACKUP_FIELDS.map((field) => [field, localData[field] ?? []])
  );
  const deletedJournalEntryIds = Array.from(new Set([
    ...((remote.deletedJournalEntryIds as string[] | undefined) ?? []),
    ...(localBackup.deletedJournalEntryIds ?? []),
  ]));
  return {
    ...(remote as unknown as BackupPayloadV3),
    data: {
      ...(remoteData as BackupPayloadV3["data"]),
      ...journalPatch,
    },
    deletedJournalEntryIds:
      deletedJournalEntryIds.length > 0 ? deletedJournalEntryIds : undefined,
  };
}

export async function patchJournalBackupForPasswordRemoval(
  input: JournalRemovalRemoteInput
): Promise<RequiredRemoteCommitResult> {
  throwIfAborted(input.signal);
  const client = supabase;
  if (!client) throw new RequiredRemoteCommitError("no-op");
  const ownerUserId = await validateSyncOwner(
    input.expectedOwnerUserId,
    "Diary removal backup patch"
  );
  if (!ownerUserId) throw new RequiredRemoteCommitError("no-op");
  await assertRemovalOperationCurrent(input);
  const localBackup = await exportBackup();
  throwIfAborted(input.signal);
  await assertRemovalOperationCurrent(input);

  const fetchRequest = client
    .from("user_backups")
    .select("payload, updated_at, vault_revision")
    .eq("user_id", ownerUserId);
  const { data: remote, error: fetchError } = input.signal
    ? await fetchRequest.abortSignal(input.signal).maybeSingle()
    : await fetchRequest.maybeSingle();
  if (fetchError) throw fetchError;
  const payload = patchRemoteBackup(remote?.payload, localBackup);
  const updatedAt = new Date().toISOString();

  throwIfAborted(input.signal);
  await validateSyncOwner(ownerUserId, "Diary removal backup commit");
  await assertRemovalOperationCurrent(input);
  const mutation = remote
    ? client
        .from("user_backups")
        .update({
          payload: payload as unknown as Json,
          updated_at: updatedAt,
          vault_revision: null,
        })
        .eq("user_id", ownerUserId)
        .eq("updated_at", remote.updated_at)
        .select("user_id")
    : client
        .from("user_backups")
        .insert({
          user_id: ownerUserId,
          payload: payload as unknown as Json,
          updated_at: updatedAt,
          vault_revision: null,
        })
        .select("user_id");
  const { data: committed, error: mutationError } = input.signal
    ? await mutation.abortSignal(input.signal).maybeSingle()
    : await mutation.maybeSingle();
  if (mutationError) throw mutationError;
  if (committed?.user_id !== ownerUserId) {
    throw new RequiredRemoteCommitError("stale");
  }
  await validateSyncOwner(ownerUserId, "Diary removal backup acknowledgement");
  await assertRemovalOperationCurrent(input);
  return REQUIRED_REMOTE_COMMIT_RESULT;
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
  if (backupResult.data?.vault_revision !== null && backupResult.data?.vault_revision !== undefined) {
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
